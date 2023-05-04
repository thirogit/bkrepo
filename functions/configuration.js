'use strict';


function fetchconfiguration (req, res, farmRef) {
	
	var configurationRef = farmRef.child('configuration');
	
	if(req.query.company != undefined)
	{
		var comapnyRef = configurationRef.child("company");	
	
		return comapnyRef.once('value').then(function(snapshot) 
		 {		
			res.status(200).send(snapshot.val());
						
		 });
	}

	if(req.query.herds != undefined)
	{
		var herdsRef = configurationRef.child("herds");	
		var herdsQuery = herdsRef.orderByKey();
		return herdsQuery.once('value').then(function(snapshots) 
		{		
			var herds = [];
										  
			snapshots.forEach(function (snapshot) {
				var herd = snapshot.val();
				herds.push(herd);
			});	
			res.status(200).send(herds);
						
		 });
	}	
	
	if(req.query.stocks != undefined)
	{
		var stocksRef = configurationRef.child("stocks");	
		var stocksQuery = stocksRef.orderByKey();
		return stocksQuery.once('value').then(function(snapshots) 
		{		
			var stocks = [];
										  
			snapshots.forEach(function (snapshot) {
				var stock = snapshot.val();
				stocks.push(stock);
			});	
			res.status(200).send(stocks);
						
		 });
	}	
	
	if(req.query.classes != undefined)
	{
		var classesRef = configurationRef.child("classes");	
		var classesQuery = classesRef.orderByKey();
		return classesQuery.once('value').then(function(snapshots) 
		{		
			var classes = [];
										  
			snapshots.forEach(function (snapshot) {
				var cowclass = snapshot.val();
				classes.push(cowclass);
			});	
			res.status(200).send(classes);
						
		 });
	}	
	
	if(req.query.herds != undefined)
	{
		var herdsRef = configurationRef.child("herds");	
		var herdsQuery = herdsRef.orderByKey();
		return herdsQuery.once('value').then(function(snapshots) 
		{		
			var herds = [];
										  
			snapshots.forEach(function (snapshot) {
				var herd = snapshot.val();
				herds.push(herd);
			});	
			res.status(200).send(herds);
						
		 });
	}	
		
	res.status(200).send(null);
}

module.exports = 
{
	handle_fetchconfiguration : fetchconfiguration
}