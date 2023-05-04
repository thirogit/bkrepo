'use strict';

var validation = require('./validation')
var moment = require('moment');
const admin = require('firebase-admin');


const MINFETCH = 5;
const MAXFETCH = 30;

function get_day_index(dt)
{
	return dt.year()*10000 + (dt.month()+1)*100 + dt.date();
}

function createpurchasecursor (req, res, bkskupRef) {
	
	var query = req.body;
			
	if(query.fromdt == undefined)
	{
		res.status(412).send("missing 'fromdt' in request object");
		return;
	}
	
	if(query.todt == undefined)
	{
		res.status(412).send("missing 'todt' in request object");
		return;
	}
	
	if(query.farmno == undefined)
	{
		res.status(412).send("missing 'farmno' in request object");
		return;
	}
		
	if(typeof query.fromdt != 'number')
	{
		res.status(400).send("'fromdt' parameter is not a number, its type is " + typeof query.fromdt);
		return;
	}
	
	if(typeof query.todt != 'number')
	{
		res.status(400).send("'todt' parameter is not a number, its type is " + typeof query.todt);
		return;
	}
	
	if(!validation.is_a_farm_no(query.farmno))
	{
		res.status(400).send("'farmno' parameter is not a proper farm no");
		return;
	}
		
	var cursorsRef = bkskupRef.child('/cursors');
	var farmRef = bkskupRef.child(query.farmno); 								
							
	var fromdtepoch = query.fromdt;
	var todtepoch = query.todt
	var farmno = query.farmno;

	var fromdt = moment.unix(query.fromdt);
	var todt = moment.unix(query.todt);

	var fromDayIndex = get_day_index(fromdt);
	var toDayIndex = get_day_index(todt);
	
	console.log('creating cursor for farm ' + farmno + ' from ' + fromDayIndex + ' to ' + toDayIndex);

	var distributionRef = farmRef.child('/distribution');
	var distributionQuery = distributionRef.orderByKey().startAt(fromDayIndex.toString()).endAt(toDayIndex.toString());	
		
	
	return distributionQuery.once('value')
				 .then(function (dayCounts) 
				 {
						var purchasesCount = 0;
						dayCounts.forEach(function (dayCount) {
							purchasesCount = purchasesCount + dayCount.val();
						});

						return cursorsRef.push(
										{ lastid: null,
											startdt: fromdtepoch,
											enddt:  todtepoch,
											farmno: query.farmno,
											timestamp: admin.database.ServerValue.TIMESTAMP,
											count : purchasesCount
										}) .then((snap) => 
										{
											const id = snap.key;
											res.status(200).send({
												cursorid: id,
												minfetch: MINFETCH,
												maxfetch : MAXFETCH,
												count : purchasesCount
											});
										});	
					});				
								
								
}

function fetchpurchases (req, res,  bkskupRef) {

	if(req.query.cursorid == undefined)
	{
		res.status(412).send("missing 'cursorid' query parameter");
		return;
	}
	
	var cursorid = req.query.cursorid;	
	var cursorsRef = bkskupRef.child('/cursors'); 							
				
	var cursorRef = cursorsRef.child(cursorid);
	return  cursorRef.once('value').then(function(cursor_snapshot) 
	 {
		 var cursor = cursor_snapshot.val();
		
		 if (cursor == null) 
		 {
			  return res.status(403).send('cursor with id ' + cursorid + ' does not exist');
		 } 

		 var farmRef = bkskupRef.child(cursor.farmno);
		 var purchasesRef = farmRef.child('/purchases'); 								
			
		 var limit = MAXFETCH;
		 if(cursor.lastid != null)
		 {
			 limit += 1;
		 }
		 var purchasesQuery = purchasesRef.orderByChild("start_dt_epoch").startAt(cursor.startdt,cursor.lastid).endAt(cursor.enddt).limitToFirst(limit);	
		 
		 console.log("cursor " + cursorid + ": quering purchases from " + cursor.startdt);
		 return purchasesQuery.once('value')
				 .then(function (purchaseSnapshots) 
				 {
					 var chunk = [];
					 var maxStartDt = 0;
					 var lastid;
					 purchaseSnapshots.forEach(function (purchaseSnapshot) {

							var purchaseEnvelope = purchaseSnapshot.val();
							
							if(!(cursor.lastid != null && purchaseSnapshot.key == cursor.lastid))
							{			
								var purchase = purchaseEnvelope.purchase;
								chunk.push({
									id: purchaseSnapshot.key,
									agentCd: purchase.agentCd,
									startDt: purchase.startDt,
									endDt: purchase.endDt,
									plateNo: purchase.plateNo,
									herdNo: purchase.herdNo,
									count: purchaseEnvelope.cow_count,
									wasDownloaded: purchaseEnvelope.wasDownloaded,
								});
								
								if(maxStartDt < purchaseEnvelope.start_dt_epoch)
								{
									maxStartDt = purchaseEnvelope.start_dt_epoch;
								}

								lastid = purchaseSnapshot.key;
						  }
						});
						
						if(chunk.length == 0)
						{
							return cursorRef.remove().then(function()
							{
								console.log("cursor " + cursorid + ": reached end - deleting cursor");
								return res.status(200).send(chunk);
							});
						}
						else
						{

							return cursorRef.update({ lastid: lastid,
								startdt: maxStartDt,
								enddt:  cursor.enddt,
								timestamp: admin.database.ServerValue.TIMESTAMP
							}).then(function()
							{
								console.log("cursor " + cursorid + ": returning chunk of " + chunk.length + " purchases  with max start_dt_epoch = " + maxStartDt);
								return res.status(200).send(chunk);
							});					 
					}
				 });

		});						
}
	
function fetchpurchase (req, res,  bkskupRef) {

	if(req.query.purchaseid == undefined)
	{
		res.status(412).send("missing 'purchaseid' query parameter");
		return;
	}

	if(req.query.farmno == undefined)
	{
		res.status(412).send("missing 'farmno' query parameter");
		return;
	}

	if(!validation.is_a_farm_no(req.query.farmno))
	{
		res.status(400).send("'farmno' query parameter is not a proper farm no");
		return;
	}
				
	var farmRef = bkskupRef.child(req.query.farmno);
	var purchasesRef = farmRef.child('/purchases'); 								
	var purchaseRef = purchasesRef.child(req.query.purchaseid); 								
		
	return purchaseRef.once('value')
		 .then(function (purchaseSnapshot) 
		 {
			
			var purchaseEnvelope = purchaseSnapshot.val();
			return res.status(200).send(purchaseEnvelope.purchase);
				
		 });

							
}


	
function markpurchase (req, res,  bkskupRef) {

	var markrq = req.body;
	
	if(markrq.purchaseid == undefined)
	{
		res.status(412).send("missing 'purchaseid' in request object");
		return;
	}

	if(markrq.farmno == undefined)
	{
		res.status(412).send("missing 'farmno' in request object");
		return;
	}
	
	if(markrq.downloaded == undefined)
	{
		res.status(412).send("missing 'downloaded' in request object");
		return;
	}

	if(!validation.is_a_farm_no(markrq.farmno))
	{
		res.status(400).send("'farmno' parameter is not a proper farm no");
		return;
	}
	
	if(!validation.is_a_boolean(markrq.downloaded))
	{
		res.status(400).send("'downloaded' parameter is not a proper boolean");
		return;
	}
					
	var farmRef = bkskupRef.child(markrq.farmno);
	var purchasesRef = farmRef.child('/purchases'); 								
	var purchaseRef = purchasesRef.child(markrq.purchaseid); 									
	return purchaseRef.update({wasDownloaded : markrq.downloaded}).then(function()
							{								
								return res.status(200).end();
							});
							
}


function uploadpurchase (req, res,farmRef) {
   
   
		var distributionRef = farmRef.child('/distribution');
		var purchasesRef = farmRef.child('/purchases');
		var purchaseToUpload = req.body;
		
		var start = moment(purchaseToUpload.startDt,"YYYY-MM-DD HH:mm");

		var day = get_day_index(start);
		var dayRef = distributionRef.child(day);

		var count = 0;
		purchaseToUpload.invoices.forEach(function (invoice)
		{
				count = count + invoice.cows.length;
		});
		
		var purchaseEnvelope = {
			start_dt_epoch : start.unix(),
			purchase : purchaseToUpload,
			cow_count: count	
		}
		
		
		return purchasesRef.push(purchaseEnvelope).then(function (saved)
		{;
			return dayRef.transaction((current) =>  {
														return (current || 0) + 1;
													}).then(() =>   {
																		res.status(200).send({ id: saved.getKey() });
																	});
		
		});			
	  
}


module.exports = 
{
	handle_uploadpurchase : uploadpurchase,
	handle_createpurchasecursor : createpurchasecursor,
	handle_fetchpurchase : fetchpurchase,
	handle_fetchpurchases : fetchpurchases,
	handle_markpurchase : markpurchase
}