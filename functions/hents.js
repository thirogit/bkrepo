'use strict';

var validation = require('./validation')
const admin = require('firebase-admin');

function fetchhentupdates (req, res, farmRef) {
								
	if(req.query.since == undefined)
	{
		res.status(412).send("missing 'since' query parameter");
		return;
	}

	if(!validation.is_a_number(req.query.since))
	{
		res.status(400).send("'since' query parameter is not a number");
		return;
	}

	var since = parseInt(req.query.since);

	var hentsRef = farmRef.child('/hents'); 								

	var hentsQuery = hentsRef.orderByChild("lastmodified").startAt(since).limitToFirst(100);	

	console.log(req.farm_no + ": quering hents since " + since);
	return hentsQuery.once('value')
			.then(function (snaps) 
			{
			  var chunk = [];
			  var maxLastModified = 0;
			  snaps.forEach(function (childSnap) {
				var hent = childSnap.val();
				chunk.push(hent);
				
				if(maxLastModified < hent.lastmodified)
				{
					maxLastModified = hent.lastmodified;
				}
			  });										  
			  console.log(req.farm_no + ": returning chunk of " + chunk.length + " hents  with max lastmodified = " + maxLastModified);
			  res.status(200).send({chunk : chunk,
									maxlastmodified: maxLastModified,
									since: since});
			  
			});
									
								
							
}

function updatehent(n, bkskupRef)
{
	var farmNo = n.farm_no;
	var season = n.season_id;
	var hent = n.hent;
	
	var farmRef = bkskupRef.child(farmNo);
	var hentsRef = farmRef.child('hents');
	var hentRef = hentsRef.child(hent.hent_no);	
	
	return hentRef.once('value').then(function(snapshot) 
		 {
			var existing_hent = snapshot.val();		
			
			if (existing_hent == null) 
			{
				hent.season = season;
				hent.lastmodified = admin.database.ServerValue.TIMESTAMP;
				hentsRef.child(hent.hent_no).set(hent);
			}
			else
			{
		 
				if(existing_hent.season <= season)
				{
					hent.season = season;
					hent.lastmodified = admin.database.ServerValue.TIMESTAMP;
					hentRef.update(hent);					
				}
			}			
		 });
}

module.exports = 
{
	handle_fetchhentupdates : fetchhentupdates,
	handle_updatehent_notification : updatehent
}