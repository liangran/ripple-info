var app = angular.module('myApp', []);

app.controller('MyController', function($scope, $http) {
	$scope.gateways = gateways;
	$scope.timeoption = timeoption;
	$scope.txPeriod = '05';
	$scope.working = {
		info : false,
		lines: false,
		offers : false
	}
	$scope.history = {
		error : null,
		address : null,
		now : null,
		txPeriod : 0,
		working : false,
		marker : null,
		count : 0,
		data : {},
		data2 : [],
		data3 : {}
	}
	$scope.state = false;
	$scope.connecting = false;
	$scope.isWorking = false;
	$scope.account = {
		address: 'rPFLkxQk6xUGdGYEykqe7PR25Gr7mLHDc8',
		name : null,
		xrp: null,
		avatar: null,
		domain: null,
		fee: null,
		sequence: null,
		lines : {},
		trust : {
			count : 0,
			lines : {}
		},
		offers : {}
	};
	$scope.url = '';
	$scope.data = [];
	$scope.includeOffer = true;
	$scope.includeConvert = true;
	$scope.error = null;

	$scope.updateData = function(msg) {
		$scope.data.push(msg);
		setTimeout(function(){
			$scope.$apply(shiftData);
		}, 15000);
	}
	var shiftData = function() {
		$scope.data.shift();
	}
	$scope.updateError = function(msg) {
		$scope.error = msg;
		setTimeout(function(){
			$scope.$apply(removeError);
		}, 45000);
	}
	var removeError = function() {
		$scope.error = null;
	}
	$scope.walletName = function(address, curr) {
		var name = wallets[address] ? wallets[address] : address;
		return name ? name : '';
	}
	$scope.walletShortName = function(address, curr) {
		return wallets[address] ? wallets[address] : '';
	}
	$scope.cssCurrency = function(curr) {
		if (curr == 'XRP') return 'xrp';
		if (curr == 'FMM' || curr == 'XMF') return 'fund';
		return fiat.indexOf(curr) > -1 ? 'fiat' : 'nonefiat';
	}
	$scope.isEmpty = function(obj) {
		return !Object.keys(obj).length;
	}
	$scope.objKeyLength = function(obj) {
		return Object.keys(obj).length;
	}
	$scope.dateStr = function(dt) {
		return (dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate()+' '+dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds()).replace(/([\-\: ])(\d{1})(?!\d)/g,'$10$2');
	}
	$scope.rippleName = function() {
		$http({
			method: 'GET',
			url: 'https://id.ripple.com/v1/user/' + $scope.account.address
		}).success(function(data, status){
			if (data.exists) {
				if (data.address != $scope.account.address) {
					$scope.account.address = data.address;
					$scope.queryInfo();
					$scope.queryLines();
					$scope.queryOffers();
				}
				$scope.account.name = data.username;
			}
		}).error(function(data, status){
			$scope.updateError(data);
		});
	}
	$scope.cardWeight = function() {
		$scope.account.weight = 0;
		$http({
			method: 'GET',
			url: 'https://ripplefox.com/data/rpcard/' + $scope.account.address
		}).success(function(data, status){
			console.log(data);
			if (data.weight) {
				$scope.account.weight = data.weight;
			}
		}).error(function(data, status){
			$scope.updateError(data);
		});
	}
	$scope.queryInfo = function() {
		window.location.href = $scope.url + "#" + $scope.account.address;
		$scope.working.info = true;
		accountInfo($scope.account.address, function(err, data){
			$scope.working.info = false;
			$scope.$apply(updateAccountInfo(err, data));
		});
	}
	$scope.queryLines = function() {
		$scope.working.lines = true;
		accountLines($scope.account.address, null, [], function(err, data){
			$scope.working.lines = false;
			$scope.$apply(updateAccountLines(err, data));
		});
	}
	$scope.queryOffers = function() {
		$scope.working.offers = true;
		accountOffers($scope.account.address, function(err, data){
			$scope.working.offers = false;
			$scope.$apply(updateAccountOffers(err, data));
		});
	}
	$scope.queryAll = function() {
		$scope.account.name = null;
		$scope.account.xrp = null;
		$scope.account.avatar = null;
		$scope.account.domain = null;
		$scope.account.fee = null;
		$scope.account.sequence = null;
		$scope.account.lines = {};
		$scope.account.trust = {count : 0, lines : {}};
		$scope.account.offers = {};
		
		if (!$scope.account.address) return;
		if ($scope.account.address != $scope.history.address) {
			$scope.history.error = null;
			$scope.history.count = 0;
			$scope.history.data = {};
			$scope.history.data2 = [];
			$scope.history.data3 = {};
		}
		
		if (UInt160.is_valid($scope.account.address)) {
			$scope.queryInfo();
			$scope.queryLines();
			$scope.queryOffers();
		}
		$scope.rippleName();
		$scope.cardWeight();
	}
	$scope.queryHistory = function() {
		if (!UInt160.is_valid($scope.account.address)) {
			$scope.history.error = '地址不是有效的！';
			return;
		}
		$scope.history.working = true;
		$scope.history.error = null;
		$scope.history.address = $scope.account.address;
		$scope.history.now = new Date();
		$scope.history.txPeriod = parseFloat($scope.txPeriod);
		$scope.history.marker = null;
		$scope.history.count = 0;
		$scope.history.data = {};
		$scope.history.data2 = [];
		$scope.history.data3 = {};
		console.log('History');
		updateAccountHistory();
	}
	var updateAccountHistory = function() {
		var account = $scope.account.address;
		accountTx(account, $scope.history.marker, function(err, data){
			$scope.$apply(processHistory(err, data, account));
		});
	}
	var processHistory = function(err, data, account) {
		if (err) {
			$scope.history.error = err['engine_result_message'] ? err['engine_result_message'] : err;
			$scope.history.working = false;
			return;
		}
		
		var finished = false;
		data.transactions.forEach(function(e) {
			var processedTxn = processTxn(e.tx, e.meta, account);
			
			if (processedTxn && !finished) {
				$scope.history.count++;
				
				var trade = {};
				var transaction = processedTxn.transaction;	
				// Show status notification
				if (processedTxn.tx_result === "tesSUCCESS") {
					if (transaction) {
						if (processedTxn.tx_type === "Payment") { // sent/received/convert
							trade.hash = transaction.hash;
							trade.type = transaction.type;
							trade.order = {type : trade.type}; // just for easy use;
							trade.counterparty = transaction.counterparty;
							trade.currency = transaction.currency;
							if (trade.currency) {
								trade.value = (trade.currency === 'XRP') ? transaction.amount.to_number()/1000000 : transaction.amount.to_number();
							}
							if (trade.type == 'convert') {
								if (transaction.amountSent.currency) {
									trade.amountSent = {
										currency : transaction.amountSent.currency,
										value : transaction.amountSent.value
									}
								} else {
									trade.amountSent = {
										currency : 'XRP',
										value : parseFloat(transaction.amountSent) / 1000000
									}
								}
								
								trade.spent = {
									currency : transaction.spent.currency().to_human(),
									value : transaction.spent.currency().to_human() == 'XRP'? transaction.spent.to_number()/1000000 : transaction.spent.to_number()
								}
								trade.balance = {
									currency : transaction.balance.currency().to_human(),
									value : transaction.balance.currency().to_human() == 'XRP'? transaction.balance.to_number()/1000000 : transaction.balance.to_number()
								}
								
								console.log(transaction);
							}
						} else if (processedTxn.tx_type == "OfferCreate"){
							var order = parseOrder(transaction);
			        		trade.type = order.type;
			        		trade.order = order;
						} else if (processedTxn.tx_type == "OfferCancel"){
							console.log(transaction);
							var offer = {
								flags : e.tx.Flags,
								gets : ripple.Amount.from_json(transaction.gets),
								pays : ripple.Amount.from_json(transaction.pays)
							}
							var order = parseOrder(offer);
							trade.type = "cancel";
							trade.order = order;
						}
					}
				}

				trade.ledger_index = processedTxn.ledger_index;
				trade.tx_index = e.meta.TransactionIndex;
				//trade.sequence = processedTxn.sequence;
				trade.date = new Date(processedTxn.date);
				trade.hash = e.tx.hash;
				trade.tag = processedTxn.tag;
				
				if (processedTxn.amtSent) {
					console.log(JSON.stringify(trade), processedTxn.amtSent);
					var curr = processedTxn.amtSent.currency().to_human();
					trade.delivered = (curr == 'XRP') ? processedTxn.amtSent.to_number()/1000000 : processedTxn.amtSent.to_number();
				}
				
				if (trade.type == 'sent' || trade.type == 'received') {
					if (!$scope.history.data[trade.hash]) {
						$scope.history.data[trade.hash] = trade;
						$scope.history.data2.push(trade);
						
						if (!$scope.history.data3[trade.currency]) {
							$scope.history.data3[trade.currency] = {
								currency : trade.currency,
								send_count : 0,
								recv_count : 0,
								send_value : 0,
								recv_value : 0
							}
						}
						if (trade.type == 'sent') {
							$scope.history.data3[trade.currency].send_count++;
							$scope.history.data3[trade.currency].send_value += trade.value;
						} else {
							$scope.history.data3[trade.currency].recv_count++;
							$scope.history.data3[trade.currency].recv_value += trade.value;
						}
						
						//console.log(JSON.stringify(trade));
					}
					//console.log($scope.history.now, trade.date, ($scope.history.now - trade.date)/1000/3600/24);
				}

				if ($scope.includeConvert && trade.type == 'convert') {
					if (!$scope.history.data[trade.hash]) {
						$scope.history.data[trade.hash] = trade;
						$scope.history.data2.push(trade);
					}
					console.log(JSON.stringify(trade));
				}
				
				if ($scope.includeOffer && (trade.type == 'buy' || trade.type == 'sell' || trade.type == 'cancel')) {
					if (!$scope.history.data[trade.hash]) {
						$scope.history.data[trade.hash] = trade;
						$scope.history.data2.push(trade);
					}
					//console.log(trade.type + ' ' + order.pays_value + order.pays_currency + '@' + order.price);
				}
				
				if ($scope.history.txPeriod < 99 && ($scope.history.now - trade.date)/1000/3600/24 > $scope.history.txPeriod) {
					finished = true;
				}
			}
		});
		
		if (data.marker) {
			$scope.history.marker = data.marker;
		} else {
			finished = true;
		}
		console.log("marker: ", data.marker);

		if (finished) {
			$scope.history.working = false;
		} else {
			updateAccountHistory();
		}
	}
	
	$scope.setSecret = function() {
		remote.setSecret($scope.account.address, $scope.account.secret);
		$scope.isSecretSet = true;
		$scope.account.obj = remote.account($scope.account.address);
		$scope.account.obj.on('transaction', $scope.handleAccountEvent);
	}
	$scope.handleAccountEvent = function(e) {
		$scope.$apply(_handleAccountEvent(e));
	}
	$scope.getBalance = function(curr, issuer) {
		curr = curr.toUpperCase();
		if (curr == 'XRP') {
			return $scope.account.xrp;
		}
		var issuer_address = UInt160.is_valid(issuer) ? issuer : issuers[issuer.toLowerCase()];
		var key = curr + ':' + issuer_address;
		return $scope.account.lines[key] ? $scope.account.lines[key]['balance'] : 0;
	}
	
	var _handleAccountEvent = function(e) {
		processTx(e.transaction, e.meta);
	}
	var processTx = function(tx, meta) {
		var account = $scope.account.address;
		var processedTxn = processTxn(tx, meta, account);
		if (processedTxn) {
		      var transaction = processedTxn.transaction;

		      // Update account
		      if (processedTxn.accountRoot) {
		    	  $scope.account.xrp = processedTxn.accountRoot.Balance / 1000000;
		    	  $scope.updateData('XRP ->' + $scope.account.xrp);
		      }   
		      
		      // Update Ripple lines
		      if (processedTxn.effects) {
		    	  processedTxn.effects.forEach(function(effect) {
		    	    	if (effect.type == 'trust_create_local'
		    				|| effect.type == 'trust_create_remote'
		    				|| effect.type == 'trust_change_local'
		    				|| effect.type == 'trust_change_remote'
		    				|| effect.type == 'trust_change_balance') {
		    	    		
		    	            var line = {};
		    	    		line.currency = effect.currency;
		    	            line.account = effect.counterparty;
		    	            //line.flags = effect.flags;
		    	            //line.no_ripple = effect.noRipple;
		    	            
		    	            var key = line.currency + ':' + line.account;
		    	            
		    	            //console.log('updateLines', effect.type, JSON.stringify(effect));
		    	            if (effect.balance) {
		    	                line.balance = effect.balance.to_number();
		    	                //console.log('updateLines', JSON.stringify(line.balance));
		    	                $scope.account.lines[key] = {
									account: line.account,
									currency: line.currency,
									balance: round(line.balance, 3)
								}
		    	                
		    	                $scope.updateData(key + '->' + line.balance);
		    	            }
		    	            
		    	            if (effect.deleted) {
		    	            	delete $scope.account.lines[key];
		    	            	$scope.updateData(key + '-> deleted');
		    	            }            
		    	    	}
		    	    });
		      }

		      // Update my offers
		      if (processedTxn.effects) {
		        // Iterate on each effect to find offers
		        processedTxn.effects.forEach(function (effect) {
		        	//console.log(effect.type);
		        	if (effect.type == 'offer_created'
		        			|| effect.type == 'offer_funded'
		        			|| effect.type == 'offer_partially_funded'
		        			|| effect.type == 'offer_cancelled') {
		        		var offer = {
		  	            	seq: +effect.seq,
		  	            	gets: effect.gets,
		  	            	pays: effect.pays,
		  	            	deleted: effect.deleted,
		  	            	flags: effect.flags
	      	            };
		        		
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
		        		order.price = round(order.price, 5);
		        		order.checked = false;
		        		order.disabled = false;
		        		
		        		$scope.account.offers[order.seq] = order;
		        		if (offer.deleted) {
		        	    	delete $scope.account.offers[order.seq];
		        	    	console.log('Delete ' + JSON.stringify(offer))
		        	    } else {
		        	    	console.log('offer: ' + JSON.stringify(offer));
		        	    }
		        	}
		        });
		      }
		}
	}
	
	var updateState = function(state) {
		if ('online' === state) {
			$scope.state = true;
		} else if ('offline' === state) {
			$scope.state = false;
		}
	}
	var updateConnecting = function(isConnection) {
		$scope.connecting = isConnection;
	}
	var updateError = function(err) {
		if (err['engine_result_message']) {
			$scope.updateError(err['engine_result_message']);
		} else {
			$scope.updateError(err);
		}
	}
	var updateAccountInfo = function(err, data) {
		if (err) {
			$scope.updateError(err);
		} else {
			$scope.account.xrp = round(data['account_data']['Balance']/1000000, 3);
			$scope.account.avatar = data['account_data']['urlgravatar'];
			$scope.account.domain = data['account_data']['Domain'];
			$scope.account.fee = data['account_data']['TransferRate'];
			$scope.account.sequence = data['account_data']['Sequence'];
			
			if ($scope.account.fee) $scope.account.fee = ($scope.account.fee / 1000000 - 1000) / 10;
			if ($scope.account.domain) $scope.account.domain = ascify($scope.account.domain);
			if ($scope.account.avatar) $scope.account.avatar = $scope.account.avatar.replace('http://www.gravatar.com', 'https://secure.gravatar.com');
		}
	}
	var updateAccountLines = function(err, data) {
		if (err) {
			$scope.updateError(err);
		} else {
			if (data['lines']) {
				data.lines.forEach(function(line){
					var balance = round(line.balance, 3);
					if (balance > 0 || line.limit > 0) {
						var key = line.currency + ':' + line.account;
						$scope.account.lines[key] = {
							account : line.account,
							currency: line.currency,
							balance : balance,
							limit   : line.limit
						}
					} else {
						//$scope.account.trust.count++;
						if (!$scope.account.trust.lines[line.currency]) {
							$scope.account.trust.lines[line.currency] = {
								count : 0,
								hold : 0,
								currency: line.currency,
								balance : 0
							}
						}
						$scope.account.trust.lines[line.currency].balance += parseFloat(line.balance);
						$scope.account.trust.lines[line.currency].count++;
						if (line.balance < -0.000001) $scope.account.trust.lines[line.currency].hold++;
					}
				});
				
				for (var curr in $scope.account.trust.lines) {
					var line = $scope.account.trust.lines[curr];
					line.balance = round(line.balance, 3);
					if (line.balance == 0) {
						delete $scope.account.trust.lines[curr];
					} else {
						$scope.account.trust.count += line.count;
					}
					
				}
			}
		}
	}
	var updateAccountOffers = function(err, data) {
		if (err) {
			$scope.updateError(err);
		} else {
			$scope.account.offers = data;
		}
	}
	var connect = function() {
		if (remote.state == 'online') {
			remote.disconnect();
		}
		$scope.connecting = true;
		
		remote.connect(function() {
			$scope.$apply(updateConnecting(false));
		});
	}
	
	remote.on('state', function(state) {
		console.log('State: ' + state);
		$scope.$apply(updateState(state));
	});
	
	console.log('Connecting...');
	connect();
	$scope.url = document.URL;
	if ($scope.url.indexOf("#") > 0) {
		$scope.account.address = $scope.url.split("#")[1].trim();
		$scope.url = $scope.url.split("#")[0];
	}
	$scope.queryAll();
	
	/*
	var updateClock = function() {
		$scope.clock = new Date();
	};
	var timer = setInterval(function() {
		$scope.$apply(updateClock);
		updateClock();
	}, 1000);
	updateClock();
	*/
	
});
