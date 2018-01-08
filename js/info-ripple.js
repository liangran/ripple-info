/*
 * 本JS最初由瑞狐网关ripplefox.com提供。
 * 任何人或组织基于此文件修改或扩展功能时必须保留本段文字。
 * 
 */
var Remote 		 = ripple.Remote;
var Amount 		 = ripple.Amount;
var Account 	 = ripple.Account;
var UInt160		 = ripple.UInt160;

var remote_config = {
	max_listeners : 100,
	trace : false,
	trusted : true,
	local_signing : true,
	connection_offest : 60,
	servers : [ 
	            //{host : 's-west.ripple.com',port : 443, secure : true, pool : 3},
	            //{host : 's-east.ripple.com',port : 443, secure : true, pool : 3},
	            //{host : 'ripple.gatehub.net',port : 443, secure : true, pool : 3},
	            //{host : '45.76.111.192',port : 443, secure : false, pool : 3},
	            {host : 's2.ripple.com',port : 443, secure : true, pool : 3}
	           ]
};
var remote = new Remote(remote_config);
var TIMEOUT = 60000;

var issuers = {
	ripplefox :  'rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y',
	ripplecn :   'rnuF96W4SZoCJmbHYBFoJZpR8eCaxNvekK',
	ripplechina: 'razqQKzJRdB4UxFPWf5NEpEG3WMkmwgcXA',
	bitstamp :   'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
	snapswap :   'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
	tokyojpy :   'r94s8px6kSw1uZ1MV98dhSRTvc6VMPoPcN',
	extokyo  :	 'r9ZFPSb1TFdnJwbTMYHvVwFK1bQPUCVNfJ',
	marketjp :	 'rJRi8WW24gt9X85PHAxfWNPCizMMhqUQwg',
	paxmoneta:	 'rUkMKjQitpgAM5WTGk79xpjT38DEJY283d'
}

var gateways = {
	XRP : ['-无-'],
	CNY : ['RippleFox'],
	FMM : ['RippleFox'],
	STR : ['RippleFox'],
	USD : ['Bitstamp', 'Snapswap'],
	JPY : ['Tokyojpy', 'Marketjp', 'Extokyo'],
	KRW : ['Paxmoneta']
}

function round(dight, howMany) {
	if(howMany) {
		dight = Math.round(dight * Math.pow(10, howMany)) / Math.pow(10, howMany);
	} else {
		dight = Math.round(dight);
	}	
	return dight;
}

function accountInfo(address, callback) {
	var request = remote.request_account_info(address)
		.on('success', function(data){ callback(null, data);})
		.on('error', function(e){
			callback(e, null);
		});
	request.timeout(TIMEOUT, function(){
		callback('查询超时，请再查询一次', null);
	});
	
	try {
		request.request();
	} catch (e) {
		callback(e, null);
	}
}

function accountLines(address, marker, lines, callback) {
	var request = remote.request_account_lines(address)
				.on('success', function(data){
					lines = lines.concat(data.lines);
					if (data.marker) {
						console.log(data.marker);
						accountLines(address, data.marker, lines, callback);
					} else {
						callback(null, {lines: lines});
					}
				}).on('error', function(e){
					callback(e, null);
				});
	request.timeout(TIMEOUT, function(){
		callback('查询资产超时，请再查询一次', null);
	});

	if (marker) {
		request.message.marker = marker;
	}
	try {
		request.request();
	} catch (e) {
		callback(e, null);
	}	
}

function accountOffers(address, callback) {
	var request = remote.request_account_offers(address)
					.on('success', function(data){parseOffers(data, callback);})
					.on('error', function(e){
						console.error('Check Order error.', e);
						callback('AccountOfferErr', null);
					});
	request.timeout(TIMEOUT, function(){
		callback('查询委托单超时，请再查询一次', null);
	});
	try {
		request.request();
	} catch (e) {
		callback(e, null);
	}
}

function parseOffers(data, callback) {
	var offers = {};
	data.offers.forEach(function(offerData) {
		var order = {};
		var gets = Amount.from_json(offerData.taker_gets);
		var pays = Amount.from_json(offerData.taker_pays);			

		order.type = (offerData.flags === 0) ? 'buy' : 'sell';
		order.gets_currency = gets.currency().to_human();
		order.gets_issuer   = gets.issuer().to_json();
		order.gets_value    = (order.gets_currency == 'XRP') ? gets.to_number()/1000000 : gets.to_number();
		order.pays_currency = pays.currency().to_human();
		order.pays_issuer   = pays.issuer().to_json();
		order.pays_value = (order.pays_currency == 'XRP') ? pays.to_number()/1000000 : pays.to_number();
		order.price = (order.type == 'buy') ? order.gets_value/order.pays_value : order.pays_value / order.gets_value;
		order.seq = offerData.seq;
		
		order.gets_value = round(order.gets_value, 5);
		order.pays_value = round(order.pays_value, 5);
		order.price = round(order.price, 5);
		offers[order.seq] = order;
	});	
	
	callback(null, offers);
}

function accountTx(address, marker, callback) {
	var params = {
		'account' : address,
		'ledger_index_min' : -1,
		'ledger_index_max' : -1,
		'forward' : false,
		'limit' : 100
	};
	if (marker) params.marker = marker;
	
	var request = remote.request_account_tx(params)
		.on('success', function(data){callback(null, data);})
		.on('error', function(e){
			console.error('Check Tx error. ', e);
			callback(e);
		});
	
	request.timeout(TIMEOUT, function(){
		callback('查询历史超时', null);
	});
	try {
		request.request();
	} catch (e) {
		callback(e, null);
	}
}

function parseOrder(offer) {
	var order = {};
	order.type = offer.flags ? 'sell' : 'buy';
	order.gets_currency = offer.gets.currency().to_human();
	order.gets_issuer   = offer.gets.issuer().to_json();
	order.gets_value    = (order.gets_currency == 'XRP') ? offer.gets.to_number()/1000000 : offer.gets.to_number();
	order.pays_currency = offer.pays.currency().to_human();
	order.pays_issuer   = offer.pays.issuer().to_json();
	order.pays_value = (order.pays_currency == 'XRP') ? offer.pays.to_number()/1000000 : offer.pays.to_number();
	order.price = (order.type == 'buy') ? order.gets_value/order.pays_value : order.pays_value / order.gets_value;
	order.seq = offer.seq;
	
	order.gets_value = round(order.gets_value, 5);
	order.pays_value = round(order.pays_value, 5);
	order.price = round(order.price, 8);
	return order;
}

function ascify(code) {
	var str = '';
	for (i = 0; i < code.length; i = i + 2) {
		str = str + String.fromCharCode('0x' + code.substring(i, i + 2))
	}
	return str;
}