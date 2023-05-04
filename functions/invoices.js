'use strict';

var moment = require('moment');
const admin = require('firebase-admin');
const PubSub = require(`@google-cloud/pubsub`);
const pubsub = new PubSub();

const pubsub_client = new PubSub.v1.SubscriberClient();

function get_subsctiption_ref(farmRef)
{
	var integrationsRef = farmRef.child('integrations');
	var buyinvoiceRef = integrationsRef.child('buy_invoice');
	var subscribtionRef = buyinvoiceRef.child('subscribtion');
	return subscribtionRef;
}

function respond_with_no_integration_exception(res)
{
	res.status(400).send("integration is not configured");
}


function pull_invoices(req, res,farmRef)
{		
	var subscriptionRef = get_subsctiption_ref(farmRef);	
			
	return subscriptionRef.once('value').then(subscriptionDoc => {
					if(subscriptionDoc.exists())
					{						
						var subscription = subscriptionDoc.val();
						pull_subscription(subscription).then(invoices =>
						{
							res.status(200).send(invoices);
						});
					}
					else
					{
						console.error(`pull for invoices requested for incomplete integration for farm ${req.farm_no} - no subscription defined`);
						respond_with_no_integration_exception(res);
					}	
			});	
}


function pull_subscription(subscription_name)
{
 	const maxMessages = 100;
    const ackDeadlineSeconds = 300;
    const request = {
     	subscription: subscription_name,
		maxMessages: maxMessages,
		returnImmediately: true,
 	};

	console.info(`pulling invoices for subscription ${subscription_name}`);
	
	return pubsub_client.pull(request)
  	.then(response => {    
    	const pullresponse = response[0];
		var messages = pullresponse.receivedMessages;
		
		var notifications = [];
		
		messages.forEach( function(message) { 
			var ackId = message.ackId;
			var encoded_message = message.message;			
			var type = encoded_message.type;
			var data = encoded_message.data;			
			const body = Buffer.from(data, 'base64').toString('utf-8');
			console.info("body = " + body);
			var notifcation = JSON.parse(body);
			 
			notifications.push({ ack_id: ackId, notification: notifcation});
			
		} );
		

		return notifications;
		
	  });
}


function ack_invoices(req, res,farmRef)
{
	var subscriptionRef = get_subsctiption_ref(farmRef);	 
			
	return subscriptionRef.once('value').then(subscriptionDoc => {
					if(subscriptionDoc.exists)
					{						
						var subscription = subscriptionDoc.val();
						return ack_subscription(subscription,req.ack_ids);
					}
					else
					{
						console.error(`ack invoices requested for incomplete integration for farm ${req.farm_no} - no subscription defined`);
						respond_with_no_integration_exception(res);
					}	
			});	
}


function ack_subscription(subscription,ackIds)
{
	const ackRequest = {
      subscription: subscription,
      ackIds: ackIds,
    };
	
	console.info('acking invoices with ids:' + JSON.stringify(ackIds));

    return pubsub_client.acknowledge(ackRequest);
}

module.exports = 
{
	handle_pullinvoices : pull_invoices,
	handle_ackinvoices : ack_invoices	
}