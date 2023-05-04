'use strict';

var authparser = require('http-auth-parser')
var auth = require('basic-auth')
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const express = require("express")

var configuration = require('./configuration')
var purchases = require('./purchases')
var validation = require('./validation')
var hents = require('./hents')
var moment = require('moment');
var invoices = require('./invoices')

admin.initializeApp(functions.config().firebase);
var db = admin.database();

const client = jwksClient({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: "https://bkrepo.eu.auth0.com/.well-known/jwks.json"
});

function do_auth0_authorized (req, res, scope, fn) {
  
	/*if (!req.headers || !req.headers.authorization) {
	  res.status(401).send('No authorization token found.');
	  return;
	}
	 
	const parts = req.headers.authorization.split(' ');
	if (parts.length != 2) {
	  res.status(401).send('Bad credential format.');
	  return;
	}
	const scheme = parts[0];
	const credentials = parts[1];

	if (!/^Bearer$/i.test(scheme)) {
	  res.status(401).send('Bad credential format.');
	  return;
	}
	
	verifyToken(credentials,scope, function (err) {
	  if (err) {
		res.status(401).send('Invalid token: ' + err.message );
		return;
	  }	

	  
	});*/
	
	
	var bkskupRef = db.ref('/');	  
	  
	return fn(req, res, bkskupRef);
 
}

function do_basic_authorized (req, res, action) {
   
    var credentials = auth.parse(req.get('Authorization'));
	if (credentials === undefined) {
		res.status(403).send('permision denied');
		return;
	} else
	{
		var bkskupRef = db.ref('/');
				 
		var mobile_password = undefined;
		
		var farmRef = bkskupRef.child(credentials.name);
		
		var passwordRef = farmRef.child('/mobile_password');
	    return  passwordRef.once('value').then(function(snapshot) 
		{
			mobile_password = snapshot.val();
			
			if (mobile_password == null) 
			{
				console.log('cannot execute operation for farm ' + credentials.name + ' with password ' + credentials.pass + '; mobile_password is not set');
				res.status(403).send('invalid farm no');
			} 
			else if(mobile_password != credentials.pass)
			{
				console.log('cannot execute operation for farm ' + credentials.name + ' with password ' + credentials.pass + '; incorrect password');
				res.status(403).send('invalid password');
			} 
			else
			{
				console.log('executing authorized operation for farm ' + credentials.name + ' with password ' + credentials.pass);
				req.farm_no = credentials.name;
				return action(req,res,farmRef);
			}			
		});  
	} 
}


function verifyToken(token, scope, callback) {
  let decodedToken;
  try {
    decodedToken = jwt.decode(token, {complete: true});
  } catch (e) {
    console.error(e);
    callback(e);
    return;
  }
  
  if(decodedToken == null)
  {
	console.error('unable to decode token: ' + token);
	callback({
		message: 'unable to decode'
	});
    return;
  }
   
  client.getSigningKey(decodedToken.header.kid, function (err, key) {
    if (err) {
      console.error(err);
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    jwt.verify(token, signingKey, function (err, decoded) {
      if (err) {
        console.error(err);
        callback(err);
        return
      }
      //console.log(decoded);
	  
	  
	  var scopes = decoded.scope.split(' ');
	  console.log('scopes: ' + scopes);
	  if(scopes.indexOf(scope) != -1) 
	  {
		callback(null, decoded);
	  }
	  else{
		  callback({message: "not authorized for scope " + scope});
	  }
    });
  });
}


exports.uploadpurchase = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'PUT':
      return do_basic_authorized(req, res,purchases.handle_uploadpurchase);
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});

exports.createpurchasecursor = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'POST':
      return do_auth0_authorized(req, res,'fetch:purchase', purchases.handle_createpurchasecursor);
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});

exports.fetchpurchases = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'GET':
	  return do_auth0_authorized(req, res,'fetch:purchase', purchases.handle_fetchpurchases);      
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});

exports.markpurchase = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'POST':
	  return do_auth0_authorized(req,res,'fetch:purchase',purchases.handle_markpurchase);      
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});

exports.fetchpurchase = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'GET':
      return do_auth0_authorized(req,res,'fetch:purchase',purchases.handle_fetchpurchase);
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});


exports.fetchhentupdates = functions.https.onRequest((req, res) => {
  switch (req.method) {
    case 'GET':
      return do_basic_authorized(req, res, hents.handle_fetchhentupdates);
      break;
    default:
      res.status(500).send({ error: 'unsupported http method' });
      break;
  }
});

exports.updatehent = functions.pubsub.topic('bkskup_hents').onPublish((message) => {
    
  let n = null;
  try {	  
    n = message.json;
	var bkskupRef = db.ref('/');
	return hents.handle_updatehent_notification(n,bkskupRef);
  } catch (e) {
    console.error('pubsub message: ' + JSON.stringify(message) + ' was not JSON', e);
  }
 
});


exports.hourly_job = functions.pubsub.topic('hourly-tick').onPublish((event) => 
{    
	var bkskupRef = db.ref('/');	
	var cursorsRef = bkskupRef.child('cursors'); 							
	var allCursorsQuery = cursorsRef.orderByKey();	
	
	return allCursorsQuery.once('value')
				 .then(function (cursorSnapshots) 
				 {
					console.log('found ' + cursorSnapshots.numChildren() + ' cursors');
				    cursorSnapshots.forEach(function (cursorSnapshot) {
					 var cursor = cursorSnapshot.val();
					 
					 var now = moment().valueOf();
					 var cursorAge = (now - cursor.timestamp);
					 
					 var removes = [];
					 if(cursorAge > 1000*60*60)
					 {
						console.log('removing cursor ' + cursorSnapshot.key + ' becouse its too old ( ' + cursorAge/(1000.0*60.0) + ' minutes )');
						var cursorRef = cursorsRef.child(cursorSnapshot.key);
						removes.push(cursorRef.remove());
					 }
					 
					 return Promise.all(removes);
					});
					 
				 });
});
  
exports.fetchconfiguration = functions.https.onRequest((req, res) => {
switch (req.method) {
case 'GET':
  return do_basic_authorized(req,res, configuration.handle_fetchconfiguration);
  break;
default:
  res.status(500).send({ error: 'unsupported http method' });
  break;
	}
});


exports.pull_invoices = functions.https.onRequest((req, res) => {
switch (req.method) {
case 'GET':
  return do_basic_authorized(req,res, invoices.handle_pullinvoices);
  break;
default:
  res.status(500).send({ error: 'unsupported http method' });
  break;
	}
});

exports.ack_invoices = functions.https.onRequest((req, res) => {
switch (req.method) {
case 'POST':
  return do_basic_authorized(req,res, invoices.handle_ackinvoices);
  break;
default:
  res.status(500).send({ error: 'unsupported http method' });
  break;
	}
});



/*
const configurationEndpoint = express()

app1.get("/", (request, response) => {
  response.send("Hello from Express on Firebase!")
})

app1.get("/configuration", (request, response) => {
  response.send("Express configuration")
})



exports.api = functions.https.onRequest(app1)

*/