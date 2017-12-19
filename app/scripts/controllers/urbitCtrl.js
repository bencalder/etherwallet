'use strict';
var urbitCtrl = function($scope, $sce, $routeParams, $location, $rootScope, walletService, obService) {
    // add route params to scope
    $scope.$routeParams = $routeParams;

    $rootScope.loadShips = true;

    // ++  ob 
    $scope.ob = obService;

    //$scope.poolAddress;
    $scope.sparkBal = 0;

    //Offline status and poolAddress done through rootScope for persistence
    $scope.offline = $rootScope.offline;

    $scope.poolAddress = $rootScope.poolAddress;


    //Is creating/signing tx
    $scope.loading = false;

    $scope.ajaxReq = ajaxReq;
    $scope.visibility = "interactView";
    $scope.showReadWrite = false;
    $scope.Validator = Validator;
    $scope.oneSpark = 1000000000000000000;
    $scope.tx = {
        gasLimit: '',
        data: '',
        to: '',
        unit: "ether",
        value: 0,
        nonce: null,
        gasPrice: null
    }

    // Use these in lieu of tx.* for offline transaction generation
    $scope.nonceDec;
    $scope.gasPriceDec;

    // Ship states for UI
    $scope.shipStates = ['Latent', 'Locked', 'Living']; 

    $scope.contract = {
        address: globalFuncs.urlGet('address') != null && $scope.Validator.isValidAddress(globalFuncs.urlGet('address')) ? globalFuncs.urlGet('address') : '',
        abi: '',
        functions: [],
        selectedFunc: null
    }
    //$scope.selectedAbi = ajaxReq.abiList[0];
    $scope.showRaw = false;
    $scope.$watch(function() {
        if (walletService.wallet == null) return null;
        return walletService.wallet.getAddressString();
    }, function() {
        if (walletService.wallet == null) return;
        $scope.wallet = walletService.wallet;
        $scope.wd = true;
        $scope.tx.nonce = 0;
    });
    $scope.$watch('wallet', function(newVal, oldVal) {
      if (newVal) {
        $scope.readOwnedShips(newVal.getAddressString());
        $scope.readBalance();
      }
    });
    $scope.$watch('visibility', function(newValue, oldValue) {
        $scope.tx = {
            gasLimit: '',
            data: '',
            to: '',
            unit: "ether",
            value: 0,
            nonce: null,
            gasPrice: null
        }

    });
    $scope.$watch('contract.address', function(newValue, oldValue) {
        if ($scope.Validator.isValidAddress($scope.contract.address)) {
            for (var i in ajaxReq.abiList) {
                if (ajaxReq.abiList[i].address.toLowerCase() == $scope.contract.address.toLowerCase()) {
                    $scope.contract.abi = ajaxReq.abiList[i].abi;
                    break;
                }
            }
        }
    });
    $scope.$watch('ownedShips', function(newVal, oldVal) {
      console.log('watch triggered');
      if (newVal == oldVal) {
        return;
      }
      var k = Object.keys(newVal);
      for (var i = 0; i < k.length; i ++) {
        $scope.readShipData(k[i]);
      };
    });
    $scope.$watch('rawTx', function(newVal, oldVal) {
      if (newVal == oldVal) {
        return;
      }
      $scope.loading = false;
    });
    $scope.path = function(path) {
      $location.path(path);
    }
    $scope.toWei = function(ether) {
      return etherUnits.toWei(ether, "ether");
    }
    $scope.toEther = function(wei) {
      return etherUnits.toEther(wei, "wei");
    }
    $scope.selectExistingAbi = function(index) {
        $scope.selectedAbi = ajaxReq.abiList[index];
        $scope.contract.address = $scope.selectedAbi.address;
        $scope.addressDrtv.ensAddressField = $scope.selectedAbi.address;
        $scope.addressDrtv.showDerivedAddress = false;
        $scope.dropdownExistingContracts = false;
        $scope.contract.selectedFunc=null
        $scope.dropdownContracts = false;

        if ($scope.initContractTimer) clearTimeout($scope.initContractTimer);
        $scope.initContractTimer = setTimeout(function() {
            $scope.initContract();
        }, 50);
    }

    $scope.generateTxOffline = function() {
        if (!ethFuncs.validateEtherAddress($scope.tx.to)) {
            $scope.notifier.danger(globalFuncs.errorMsgs[5]);
            return;
        }
        var txData = uiFuncs.getTxData($scope);
        txData.isOffline = true;
        txData.nonce = ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.nonceDec));
        txData.gasPrice = ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.gasPriceDec));
        if ($scope.tokenTx.id != 'ether') {
            txData.data = $scope.tokenObjs[$scope.tokenTx.id].getData($scope.tx.to, $scope.tx.value).data;
            txData.to = $scope.tokenObjs[$scope.tokenTx.id].getContractAddress();
            txData.value = '0x00';
        }
        uiFuncs.generateTx(txData, function(rawTx) {
            if (!rawTx.isError) {
                $scope.rawTx = rawTx.rawTx;
                $scope.signedTx = rawTx.signedTx;
                $scope.showRaw = true;
            } else {
                $scope.showRaw = false;
                $scope.notifier.danger(rawTx.error);
            }
            if (!$scope.$$phase) $scope.$apply();
        });
    }

    $scope.generateTx = function() {
        try {
            if ($scope.wallet == null)
            { throw globalFuncs.errorMsgs[3]; }
            else if (!ethFuncs.validateHexString($scope.tx.data))
            { throw globalFuncs.errorMsgs[9]; }
            else if (!globalFuncs.isNumeric($scope.tx.gasLimit) || parseFloat($scope.tx.gasLimit) <= 0)
            { throw globalFuncs.errorMsgs[8]; }
            $scope.tx.data = ethFuncs.sanitizeHex($scope.tx.data);
            ajaxReq.getTransactionData($scope.wallet.getAddressString(), function(data) {
                if (data.error) $scope.notifier.danger(data.msg);
                data = data.data;
                $scope.tx.to = $scope.tx.to == '' ? '0xCONTRACT' : $scope.tx.to;
                $scope.tx.contractAddr = $scope.tx.to == '0xCONTRACT' ? ethFuncs.getDeteministicContractAddress($scope.wallet.getAddressString(), data.nonce) : '';
                var txData = uiFuncs.getTxData($scope);
                uiFuncs.generateTx(txData, function(rawTx) {
                    if (!rawTx.isError) {
                        $scope.rawTx = rawTx.rawTx;
                        $scope.signedTx = rawTx.signedTx;
                        $scope.showRaw = true;
                    } else {
                        $scope.showRaw = false;
                        $scope.notifier.danger(rawTx.error);
                    }
                    if (!$scope.$$phase) $scope.$apply();
                });
            });
        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.sendTx = function() {
        // need some way to show error or success
        uiFuncs.sendTx($scope.signedTx, function(resp) {
            if (!resp.isError) {
                var bExStr = $scope.ajaxReq.type != nodes.nodeTypes.Custom ? "<a href='" + $scope.ajaxReq.blockExplorerTX.replace("[[txHash]]", resp.data) + "' target='_blank' rel='noopener'> View your transaction </a>" : '';
                var contractAddr = $scope.tx.contractAddr != '' ? " & Contract Address <a href='" + ajaxReq.blockExplorerAddr.replace('[[address]]', $scope.tx.contractAddr) + "' target='_blank' rel='noopener'>" + $scope.tx.contractAddr + "</a>" : '';
                $scope.notifier.success(globalFuncs.successMsgs[2] + "<br />" + resp.data + "<br />" + bExStr + contractAddr);
                $location.path('state');
            } else {
                $scope.notifier.danger(resp.error);
            }
        });
    }
    $scope.setVisibility = function(str) {
        $scope.visibility = str;
    }
    $scope.selectFunc = function(index) {
        $scope.contract.selectedFunc = { name: $scope.contract.functions[index].name, index: index };
        if (!$scope.contract.functions[index].inputs.length) {
            $scope.readFromContract();
            $scope.showRead = false;
        } else $scope.showRead = true;
        $scope.dropdownContracts = !$scope.dropdownContracts;
    }
    $scope.getTxData = function() {
        var curFunc = $scope.contract.functions[$scope.contract.selectedFunc.index];
        var fullFuncName = ethUtil.solidityUtils.transformToFullName(curFunc);
        var funcSig = ethFuncs.getFunctionSignature(fullFuncName);
        var typeName = ethUtil.solidityUtils.extractTypeName(fullFuncName);
        var types = typeName.split(',');
        types = types[0] == "" ? [] : types;
        var values = [];
        for (var i in curFunc.inputs) {
            if (curFunc.inputs[i].value) {
                if (curFunc.inputs[i].type.indexOf('[') !== -1 && curFunc.inputs[i].type.indexOf(']') !== -1) values.push(curFunc.inputs[i].value.split(','));
                else values.push(curFunc.inputs[i].value);
            } else values.push('');
        }
        return '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, values);
    }
    $scope.readFromContract = function() {
        ajaxReq.getEthCall({ to: $scope.contract.address, data: $scope.getTxData() }, function(data) {
            if (!data.error) {
                var curFunc = $scope.contract.functions[$scope.contract.selectedFunc.index];
                var outTypes = curFunc.outputs.map(function(i) {
                    return i.type;
                });
                var decoded = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''));
                for (var i in decoded) {
                    if (decoded[i] instanceof BigNumber) curFunc.outputs[i].value = decoded[i].toFixed(0);
                    else curFunc.outputs[i].value = decoded[i];
                }
            } else throw data.msg;

        });
    }
    $scope.initContract = function() {
        try {
            if (!$scope.Validator.isValidAddress($scope.contract.address)) throw globalFuncs.errorMsgs[5];
            else if (!$scope.Validator.isJSON($scope.contract.abi)) throw globalFuncs.errorMsgs[26];
            $scope.contract.functions = [];
            var tAbi = JSON.parse($scope.contract.abi);
            for (var i in tAbi)
                if (tAbi[i].type == "function") {
                    tAbi[i].inputs.map(function(i) { i.value = ''; });
                    $scope.contract.functions.push(tAbi[i]);
                }
            $scope.showReadWrite = true;

        } catch (e) {
            $scope.notifier.danger(e);
        }
    }
    $scope.generateContractTx = function() {
        if (!$scope.wd) {
            $scope.notifier.danger(globalFuncs.errorMsgs[3]);
            return;
        }
        $scope.tx.data = $scope.getTxData();
        $scope.tx.to = $scope.contract.address;
        //$scope.sendContractModal.open();
        // just generate the transaction
        $scope.generateTx();
    }
    //
    $scope.buildTransactionData = function(func, input) {
        var funcSig = ethFuncs.getFunctionSignature(func);
        var typeName = ethUtil.solidityUtils.extractTypeName(func);
        var types = typeName.split(',');
        types = types[0] == "" ? [] : types;
        return '0x' + funcSig + ethUtil.solidityCoder.encodeParams(types, input);
    }
    //NOTE value is expected in wei
    $scope.doTransaction = function(address, func, input, value) {
      if ($scope.wallet == null) {
        return;
      }
      var data = $scope.buildTransactionData(func, input);
      $scope.tx.data = data;
      $scope.tx.value = value || 0;
      $scope.tx.unit = "wei";
      if (!$scope.offline) {
        var estObj = {
          from: $scope.wallet.getAddressString(),
          value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex($scope.tx.value)),
          data: ethFuncs.sanitizeHex(data),
        }
        estObj.to = address;
        ethFuncs.estimateGas(estObj, function(data) {
          if (data.error) {
            // Proper input validation should prevent this.
          } else {
            // to not fall victim to inaccurate estimates, allow slightly more gas to be used.
            //TODO 1.8 is a bit much though. consult experts on why this can be so
            //     unpredictable, and how to fix it.
            $scope.tx.gasLimit = Math.round(data.data * 1.8);
            try {
              if ($scope.wallet == null)
              { throw globalFuncs.errorMsgs[3]; }
              else if (!ethFuncs.validateHexString($scope.tx.data))
              { throw globalFuncs.errorMsgs[9]; }
              else if (!globalFuncs.isNumeric($scope.tx.gasLimit) || parseFloat($scope.tx.gasLimit) <= 0)
              { throw globalFuncs.errorMsgs[8]; }
              $scope.tx.data = ethFuncs.sanitizeHex($scope.tx.data);
              ajaxReq.getTransactionData($scope.wallet.getAddressString(), function(data) {
                if (data.error) $scope.notifier.danger(data.msg);
                data = data.data;
                $scope.tx.to = address;
                $scope.tx.contractAddr = $scope.tx.to;
                $scope.showRaw = false;
                //$scope.sendContractModal.open();
                // just generate transaction with default amount and gas
                $scope.generateTx();
              });
            } catch (e) {
              $scope.notifier.danger(e);
            }
          }
        });
      } else {
        $scope.tx.to = address;
        $scope.tokenTx = {
            to: '',
            value: 0,
            id: 'ether',
            gasLimit: 150000
        };
        $scope.localToken = {
            contractAdd: "",
            symbol: "",
            decimals: "",
            type: "custom",
        };
        $scope.generateTxOffline();
      }
    }
    $scope.readContractData = function(address, func, input, outTypes, callback) {
        $scope.contract.address = address;
        var call = $scope.buildTransactionData(func, input);
        ajaxReq.getEthCall({ to: $scope.contract.address, data: call }, function(data) {
          if (!data.error) {
            var decoded = ethUtil.solidityCoder.decodeParams(outTypes, data.data.replace('0x', ''));
            for (var i in decoded) {
              if (decoded[i] instanceof BigNumber) decoded[i] = decoded[i].toFixed(0);
            }
            callback(decoded);
          } else throw data.msg;
        });
    }
    $scope.loadAddresses = function() {
      $scope.contracts = {};
      $scope.contracts.ships = "0xe0834579269eac6beca2882a6a21f6fb0b1d7196";
      $scope.contracts.votes = "0x0654b24a5da81f6ed1ac568e802a9d6b21483561";
      $scope.contracts.spark = "0x56db68f29203ff44a803faa2404a44ecbb7a7480";
      $scope.contracts.constitution = '0x56db68f29203ff44a803faa2404a44ecbb7a7480';
    }
    ////
    //// VALIDATE: validate input data
    ////
    $scope.validateShip = function(ship, next) {
      if (ship < 0 || ship > 4294967295)
        return $scope.notifier.danger("Ship " + ship + " not a galaxy, star or planet.");
      return next();
    }
    $scope.validateParent = function(ship, next) {
      if (ship < 0 || ship > 65535)
        return $scope.notifier.danger("Ship " + ship + " not a galaxy or star.");
      return next();
    }
    $scope.validateChild = function(ship, next) {
      if (ship < 256 || ship > 4294967295)
        return $scope.notifier.danger("Ship " + ship + " not a star or planet.");
      return next();
    }
    $scope.validateGalaxy = function(galaxy, next) {
      if (galaxy < 0 || galaxy > 255)
        return $scope.notifier.danger("Ship " + galaxy + " not a galaxy.");
      return next();
    }
    $scope.validateStar = function(star, next) {
      if (star < 256 || star > 65535)
        return $scope.notifier.danger("Ship " + star + " not a star.");
      return next();
    }
    $scope.validateAddress = function(address, next) {
      if (!ethFuncs.validateEtherAddress(address))
        return $scope.notifier.danger(address + " is not a valid Ethereum address.");
      return next();
    }
    $scope.validateState = function(state, next) {
      if (state < 0 || state > 3)
        return $scope.notifier.danger("Invalid state: " + state);
      return next();
    }
    $scope.validateTimestamp = function(timestamp, next) {
      if (timestamp < 0 || timestamp > 4200000000)
        return $scope.notifier.danger("Weird timestamp: " + timestamp);
      return next();
    }
    $scope.validateBytes32 = function(bytes, next) {
      if (bytes.length > 32)
        return $scope.notifier.danger("Input too long: " + bytes);
      return next();
    }
    //
    // UI Validators
    //
    $scope.valGalaxy = function(galaxy) {
      if (galaxy < 0 || galaxy > 255 || typeof galaxy !== 'number') {
        return true;
      } else {
        return false;
      }
    }

    $scope.valStar = function(star) {
      if (star < 256 || star > 65535 || typeof star !== 'number') {
        return true;
      } else {
        return false;
      }
    }
    $scope.valShip = function(ship) {
      if (ship < 0 || ship > 4294967295 || typeof ship !== 'number') {
        return true;
      } else {
        return false;
      }
    }

    $scope.valAddress = function(address) {
      if (!ethFuncs.validateEtherAddress(address)) {
        return true;
      } else {
        return false;
      }
    }

    $scope.valTimestamp = function(timestamp) {
      if (timestamp < 0 || timestamp > 4200000000) {
        return true;
      } else {
        return false;
      }
    }

    //
    //UI Conviences
    //
    $scope.isPast = function(secs) {
      if (!secs) {
        return false
      }
      console.log('is past ' + secs);
      return secs <= (Date.now() / 1000);
    }
    $scope.remainingSecs = function(secs) {
      console.log('remaining ' + secs);
      return secs - (Date.now() / 1000);
    }
    $scope.secToString = function(secs) {
      if (secs <= 0) {
        return 'Completed';
      }
      secs = Math.round(secs)
      var min = 60;
      var hour = 60 * min;
      var day = 24 * hour;
      var week = 7 * day;
      var year = 52 * week;
      var fy = function(s) {
        if (s < year) {
          return ['', s];
        } else {
          return [Math.round(s / year) + 'y', s % year];
        }
      }
      var fw = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < week) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / week) + 'w', sec % week];
        }
      }
      var fd = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < day) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / day) + 'd', sec % day];
        }
      }
      var fh = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < hour) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / hour) + 'h', sec % hour];
        }
      }
      var fm = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        if (sec < min) {
          return [str, sec];
        } else {
          return [str + ' ' + Math.round(sec / min) + 'm', sec % min];
        }
      }
      var fs = function(tup) {
        var str = tup[0];
        var sec = tup[1];
        return str + ' ' + sec + 's';
      }
      return fs(fm(fh(fd(fw(fy(secs)))))).trim();
    }

    $scope.formatShipName = function(ship) {
      if (!ship) {
        return ship;
      } 
      if (ship.length < 2) {
        return ship;
      }
      if (ship[0] != '~') {
        return '~' + ship;
      } else {
        return ship;
      }
    }
    $scope.buildOwnedShips = function() {
      readOwnedShips();
    };

    $scope.setPoolAddress = function(x) {
      $rootScope.poolAddress = x;
      $scope.poolAddress = $rootScope.poolAddress;
    }

    $scope.toShipName = function(address) {
      if (address > -1 && address < 256) {
        return $scope.ob.toGalaxyName(address);
      } else if (address > 255 && address < 65536) {
        return $scope.ob.toStarName(address);
      } else {
        return $scope.ob.toPlanetName(address);
      }
    };

    $scope.getChildCandidate = function(address) {
      var candidate;
      if (address > -1 && address < 256) {
        candidate = ((Math.floor(Math.random() * 255) + 1) * 256 + address);
        return candidate;
      } else if (address > 255 && address < 65536) {
        candidate = ((Math.floor(Math.random() * 65535) + 1) * 65536 + address);
        return candidate;
      } else {
        return;
      }
    };

    $scope.generateShipList = function(shipListString) {
      var t = shipListString.split('\n');
      var r = {};
      for (var i = 0; i < t.length; i ++) {
        if (t[i]) {
          r[t[i]] = { address: t[i], name: '~' + $scope.toShipName(t[i])};
        }
      };
      return r;
    };
    //
    // GET: read contract data, pass the result to callback
    //
    $scope.getShipsOwner = function(callback) {
      $scope.readContractData($scope.contracts.ships,
        "owner()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getConstitutionOwner = function(callback) {
      $scope.readContractData($scope.contracts.constitution,
        "owner()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getVotesAddress = function(callback) {
      $scope.readContractData($scope.contracts.constitution,
        "votes()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getSparkAddress = function(callback) {
      $scope.readContractData($scope.contracts.constitution,
        "USP()",
        [],
        ["address"],
        callback
      );
    }
    $scope.getShipData = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getShipData(uint32)",
        [ship],
        [ "address",  // pilot
          "uint8",    // state
          "uint64",   // locked
          "bytes32",  // key
          "uint256",  // revision
          "uint16",   // parent
          "uint32"    // escape
        ],
        callback
      );
    }
    $scope.getOwnedShips = function(addr, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getOwnedShips(address)",
        [addr],
        ["uint32[]"],
        callback
      );
    }
    $scope.getHasPilot = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "hasPilot(uint32)",
        [ship],
        ["bool"],
        callback
      );
    }
    $scope.getIsPilot = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isPilot(uint32,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getIsState = function(ship, state, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isState(uint32,uint8)",
        [ship, state],
        ["bool"],
        callback
      );
    }
    $scope.getPoolAssets = function(callback) {
      $scope.readContractData($rootScope.poolAddress,
        "getAllAssets()",
        [],
        ["uint16[]"],
        callback
      );
    }
    $scope.getLocked = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getLocked(uint32)",
        [ship],
        ["uint64"],
        callback
      );
    }
    $scope.getParent = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getParent(uint32)",
        [ship],
        ["uint16"],
        callback
      );
    }
    $scope.getIsEscape = function(ship, escape, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isEscape(uint32,uint16)",
        [ship, escape],
        ["bool"],
        callback
      );
    }
    $scope.getKey = function(ship, callback) {
      $scope.readContractData($scope.contracts.ships,
        "getKey(uint32)",
        [ship],
        ["bytes32"],
        callback
      );
    }
    $scope.getIsTransferrer = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isTransferrer(uint32,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getIsLauncher = function(ship, address, callback) {
      $scope.readContractData($scope.contracts.ships,
        "isLauncher(uint16,address)",
        [ship, address],
        ["bool"],
        callback
      );
    }
    $scope.getSparkBalance = function(callback) {
      $scope.readContractData($rootScope.poolAddress,
        "balanceOf(address)",
        [$scope.wallet.getAddressString()],
        ["uint256"],
        callback
      );
    }
    $scope.getAllowance = function(callback) {
      // specifically: allowance of the constitution
      $scope.readContractData($scope.contracts.spark,
        "allowance(address,address)",
        [ $scope.wallet.getAddressString(),
          $scope.contracts.constitution
        ],
        ["uint256"],
        callback
      );
    }
    $scope.getConcreteVote = function(galaxy, address, callback) {
      $scope.readContractData($scope.contracts.votes,
        "getVote(uint8,address)",
        [galaxy, address],
        ["bool"],
        callback
      );
    }
    $scope.getIsAbstractMajority = function(proposal, callback) {
      $scope.readContractData($scope.contracts.votes,
        "abstractMajorityMap(bytes32)",
        [proposal],
        ["bool"],
        callback
      );
    }
    $scope.getAbstractVote = function(galaxy, proposal, callback) {
      $scope.readContractData($scope.contracts.votes,
        "getVote(uint8,bytes32)",
        [galaxy, proposal],
        ["bool"],
        callback
      );
    }
    $scope.getSalePrice = function(address, callback) {
      $scope.readContractData(address,
        "price()",
        [],
        ["uint256"],
        callback
      );
    }
    $scope.getSalePlanets = function(address, callback) {
      $scope.readContractData(address,
        "getAvailable()",
        [],
        ["uint32[]"],
        callback
      );
    }
    $scope.getAuctionWhitelisted = function(address, callback) {
      $scope.readContractData(address,
        "whitelist(address)",
        [$scope.wallet.getAddressString()],
        ["bool"],
        callback
      );
    }
    $scope.getAuctionDeposit = function(address, callback) {
      $scope.readContractData(address,
        "deposits(address)",
        [$scope.wallet.getAddressString()],
        ["uint256"],
        callback
      );
    }
    $scope.getAuctionEndTime = function(address, callback) {
      $scope.readContractData(address,
        "endTimestamp()",
        [],
        ["uint256"],
        callback
      );
    }
    $scope.getAuctionStrikePrice = function(address, callback) {
      $scope.readContractData(address,
        "strikePrice()",
        [],
        ["uint256"],
        callback
      );
    }
    //
    // READ: fill fields with requested data
    //
    $scope.readShipData = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getShipData(ship, put);
      });
      function put(data) {
        console.log('ship data ' + data);
        $scope.ownedShips[ship]['state'] = data[1];
        $scope.ownedShips[ship]['locktime'] = data[2];
        console.log($scope.ownedShips[ship]);
      }
    }
    $scope.readOwnedShips = function(addr) {
      if (!addr) {
        return;
      }
      $scope.getOwnedShips(addr, function(data) {
        var res = "";
        for (var i in data[0]) {
          res = res + data[0][i] + "\n";
        }
        $scope.ownedShips = $scope.generateShipList(res);
      });
    }
    $scope.readHasPilot = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getHasPilot(ship, put);
      });
      function put(data) {
        $scope.hasPilot = data[0];
      }
    }
    $scope.readIsPilot = function(ship, addr) {
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          $scope.getIsPilot(ship, addr, put);
        });
      });
      function put(data) {
        // not 100% that this is bool
        $scope.isPilot = data[0];
      }
    }
    $scope.readIsState = function(ship, stat) {
      $scope.validateShip(ship, function() {
        $scope.validateState(stat, function() {
          $scope.getIsState(ship, stat, put);
        });
      });
      function put(data) {
        $scope.isState = data[0];
      }
    }
    $scope.readLocked = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getLocked(ship, put);
      });
      function put(data) {
        $scope.locked = data[0];
      }
    }
    $scope.readPoolAssets = function() {
      $scope.getPoolAssets(put);
      function put(data) {
        var t = [];
        for (var i = 0; i < data[0].length; i++) {
            t.push($scope.formatShipName($scope.toShipName(data[0][i].toFixed(0))));
        }
        $scope.poolAssets = t;
        if ($scope.poolAssets.length > 0) {
          $scope.ship = $scope.poolAssets[0];
        } else {
          // trigger an error?
        }
      };
    }
    $scope.readParent = function(ship) {
      $scope.validateChild(ship, function() {
        $scope.getParent(ship, put);
      });
      function put(data) {
        // changed 'parent' to 'parentShip'
        $scope.parentShip = data[0];
      }
    }
    $scope.readIsEscape = function(ship, escape) {
      $scope.validateChild(ship, function() {
        $scope.validateParent(escp, function () {
          $scope.getIsEscape(ship, escp, put);
        });
      });
      function put(data) {
        $scope.isEscape = data[0];
      }
    }
    $scope.readKey = function(ship) {
      $scope.validateShip(ship, function() {
        $scope.getKey(ship, put);
      });
      function put(data) {
        $scope.key = data[0];
      }
    }
    $scope.readIsLauncher = function(ship, addr) {
      $scope.validateParent(ship, function() {
        $scope.validateAddress(addr, function () {
          $scope.getIsLauncher(ship, addr, put);
        });
      });
      function put(data) {
        $scope.isLauncher = data[0];
      }
    }
    $scope.readBalance = function() {
      if ($rootScope.poolAddress) {
        $scope.getSparkBalance(function(data) {
          $scope.balance = data[0] / $scope.oneSpark;
        });
      } else {
        // throw an error here
      }
    }
    $scope.readAllowance = function() {
      $scope.getAllowance(function(data) {
        $scope.allowance = data[0] / $scope.oneSpark;
      })
    }
    $scope.readSaleData = function(addr) {
      $scope.validateAddress(addr, function() {
        $scope.getSalePrice(addr, putPrice);
        $scope.getSalePlanets(addr, putPlanets);
      });
      function putPrice(data) {
        $scope.sale_price = $scope.toEther(data[0]);
      }
      function putPlanets(data) {
        var res = "";
        for (var i in data[0]) {
          res = res + data[0][i] + "\n";
        }
        $scope.sale_planets = res;
      }
    }
    $scope.readAuctionData = function(addr) {
      $scope.validateAddress(addr, function() {
        $scope.getAuctionWhitelisted(addr, putWhitelisted);
        $scope.getAuctionEndTime(addr, putTime);
        $scope.getAuctionDeposit(addr, putDeposit);
      });
      function putWhitelisted(data) {
        $scope.auction_whitelisted = data[0];
      }
      function putTime(data) {
        $scope.auction_time = data[0];
      }
      function putDeposit(data) {
        var eth = $scope.toEther(data[0]);
        $scope.auction_deposit = eth;
      }
    }
    //
    // CHECK: verify if conditions for a transaction are met
    //
    $scope.checkOwnership = function(ship, next) {
      $scope.getIsPilot(ship, $scope.wallet.getAddressString(), function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Not your ship. " + ship);
      });
    }
    $scope.checkIsTransferrer = function(ship, addr, next) {
      $scope.getIsTransferrer(ship, addr, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Ship is not transferable by " + addr);
      });
    }
    $scope.checkState = function(ship, state, next) {
      $scope.getIsState(ship, state, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Ship is not in state " + state);
      });
    }
    $scope.checkEscape = function(ship, parent, next) {
      $scope.getIsEscape(ship, parent, function(data) {
        if (data[0]) return next();
        $scope.notifier.danger("Escape doesn't match.");
      });
    }
    //NOTE expects amount in wei
    $scope.checkBalance = function(amount, next) {
      $scope.wallet.setBalance(function() {
        if (amount <= $scope.toWei($scope.wallet.getBalance()))
          return next();
        $scope.notifier.danger("Not enough ETH in wallet.");
      });
    }
    $scope.checkSale = function(ship, address, next) {
      //TODO move to utility function maybe
      var parent = ship % 65536;
      if (ship < 65536) parent = ship % 256;
      $scope.getIsLauncher(parent, address, checkLauncher);
      function checkLauncher(data) {
        if (data[0]) return $scope.getSalePrice(address, checkPrice);
        return $scope.notifier.danger("Contract can't launch ships.");
      }
      function checkPrice(data) {
        $scope.checkBalance(data[0], function() { next(data[0]); })
      }
    }
    //
    // DO: do transactions that modify the blockchain
    //
    $scope.doSetAllowance = function(amount) {
      $scope.loading = true;
      if (amount < 0) return $scope.notifier.danger("Can't set negative allowance.");
      amount = amount * $scope.oneSpark;
      if ($scope.offline) return transact();
      $scope.getAllowance(function(data) {
        if (amount == 0 || data[0] == 0) return transact();
        $scope.notifier.danger("To change allowance, set to 0 first.");
        //TODO we can use increaseApproval and decreaseApproval
      });
      function transact() {
        $scope.doTransaction($scope.contracts.spark,
          "approve(address,uint256)",
          [$scope.contracts.constitution, amount]
        );
      }
    }
    $scope.doCreateGalaxy = function(galaxy, address, locktime, completetime) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateAddress(address, function() {
          $scope.validateTimestamp(locktime, function() {
            $scope.validateTimestamp(locktime, function() {
              if ($scope.offline) return transact();
              $scope.getConstitutionOwner(checkPermission);
            });
          });
        });
      });
      function checkPermission(data) {
        if (data[0] != $scope.wallet.getAddressString())
          return $scope.notifier.danger("Insufficient permissions.");
        $scope.getHasPilot(galaxy, checkAvailable);
      }
      function checkAvailable(data) {
        if (data[0])
          return $scope.notifier.danger("Galaxy already owned.");
        transact();
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "createGalaxy(uint8,address,uint64,uint64)",
          [galaxy, address, locktime, completetime]
        );
      }
    }
    $scope.doClaimStar = function(star) {
      $scope.loading = true;
      $scope.validateStar(star, function() {
        if ($scope.offline) return transact();
        $scope.getSparkBalance(checkBalance);
      });
      function checkBalance(data) {
        if (data[0] < $scope.oneSpark)
          return $scope.notifier.danger("Insufficient Sparks.");
        //TODO state enum (liquid)
        $scope.checkState(star, 1, function() {
          $scope.getAllowance(transact);
        });
      }
      function transact(data) {
        if (data[0] < $scope.oneSpark) {
          return $scope.notifier.danger("Insufficient allowance.");
        }
        $scope.doTransaction($scope.contracts.constitution,
          "claimStar(uint16)",
          [star]
        );
      }
    }
    $scope.doDeposit = function(star) {
      $scope.loading = true;
      $scope.validateStar(star, function() {
        if ($scope.offline) return transact();
          //TODO state enum (latent)
          $scope.checkIsTransferrer(star, $rootScope.poolAddress, function() {
            $scope.checkOwnership(star, function() {
              $scope.checkState(star, 1, transact);
            });
          });
      });
      function transact() {
        // will this bork if you enter a new pool address on the deposit screen?
        $scope.doTransaction($rootScope.poolAddress,
          "deposit(uint16)",
          [star]
        );
      }
    }
    $scope.doWithdraw = function(star) {
      $scope.loading = true;
      $scope.validateStar(star, function() {
        return transact();
      });
      function transact() {
        $scope.doTransaction($rootScope.poolAddress,
          "withdraw(uint16)",
          [star]
        );
      }
    }
    $scope.doLaunch = function(ship, addr, locktime) {
      console.log('starting with locktime ' + locktime);
      $scope.loading = true;
      var parent = ship % 256;
      if (ship > 65535) parent = ship % 65536;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          $scope.validateTimestamp(locktime, function() {
            if ($scope.offline) return transact();
            // ship needs to be latent
            //TODO state enum (latent)
            $scope.checkState(ship, 0, checkParent);
          });
        });
      });
      // ship needs to be galaxy, or its parent needs to be living
      function checkParent() {
        if (ship < 256) return checkRights();
        //TODO state enum (living)
        $scope.checkState(parent, 2, checkRights);
      }
      // user needs to be pilot of parent or launcher of parent
      function checkRights() {
        $scope.getIsLauncher(parent, $scope.wallet.getAddressString(),
        function(data) {
          if (data[0]) return transact();
          $scope.checkOwnership(parent, transact);
        });
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "launch(uint32,address,uint64)",
          [ship, addr, locktime]
        );
      }
    }
    $scope.doLiquidateStar = function(star) {
      $scope.loading = true;
      var parent = star % 256;
      $scope.validateStar(star, function() {
        if ($scope.offline) return transact();
        $scope.checkOwnership(parent, function() {
          //TODO state enum (living)
          $scope.checkState(parent, 3, function() {
            //TODO state enum (latent)
            $scope.checkState(star, 0, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "liquidateStar(uint16)",
          [star]
        );
      }
    }
    $scope.doGrantLaunchRights = function(star, addr) {
      $scope.loading = true;
      $scope.validateParent(star, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(star, function() {
            //TODO state enum (living)
            $scope.checkState(star, 2, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "grantLaunchRights(uint16,address)",
          [star, addr]
        );
      }
    }
    $scope.doRevokeLaunchRights = function(star, addr) {
      $scope.loading = true;
      $scope.validateParent(star, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(star, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "revokeLaunchRights(uint16,address)",
          [star, addr]
        );
      }
    }
    $scope.doStart = function(ship, key) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateBytes32(key, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, function() {
            // have to update all these states to reflect changes in contract
            $scope.checkState(ship, 1, function() {
              $scope.getLocked(ship, checkLocktime);
            });
          });
        });
      });
      function checkLocktime(data) {
        if (data[0] <= (Date.now() / 1000)) return transact();
        $scope.notifier.danger("Ship locked until " + data[0])
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "start(uint32,bytes32)",
          [ship, key]
        );
      }
    }
    $scope.doTransferShip = function(ship, addr, reset) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "transferShip(uint32,address,bool)",
          [ship, addr, reset]
        );
      }
    }
    $scope.doAllowTransferBy = function(ship, addr) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "allowTransferBy(uint32,address)",
          [ship, addr]
        );
      }
    }
    $scope.doRekey = function(ship, key) {
      $scope.loading = true;
      $scope.validateShip(ship, function() {
        $scope.validateBytes32(key, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "rekey(uint32,bytes32)",
          [ship, key]
        );
      }
    }
    $scope.doEscape = function(ship, parent) {
      $scope.loading = true;
      $scope.validateChild(ship, function() {
        $scope.validateParent(parent, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, transact);
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "escape(uint32,uint16)",
          [ship, parent]
        );
      }
    }
    $scope.doAdopt = function(parent, ship) {
      $scope.loading = true;
      $scope.validateParent(parent, function() {
        $scope.validateChild(ship, function () {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, function() {
            $scope.checkEscape(ship, parent, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "adopt(uint16,uint32)",
          [parent, ship]
        );
      }
    }
    $scope.doReject = function(parent, ship) {
      $scope.loading = true;
      $scope.validateParent(parent, function() {
        $scope.validateChild(ship, function () {
          if ($scope.offline) return transact();
          $scope.checkOwnership(ship, function() {
            $scope.checkEscape(ship, parent, transact);
          });
        });
      });
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "reject(uint16,uint32)",
          [parent, ship]
        );
      }
    }
    $scope.doCastConcreteVote = function(galaxy, addr, vote) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateAddress(addr, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(galaxy, function() {
            //TODO state enum (living)
            $scope.checkState(galaxy, 2, function() {
              $scope.getConcreteVote(galaxy, addr, checkVote);
            });
          });
        });
      });
      function checkVote(data) {
        if (data[0] != vote) return transact();
        $scope.notifier.danger("Vote already registered.");
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "castConcreteVote(uint8,address,bool)",
          [galaxy, addr, vote]
        );
      }
    }
    $scope.doCastAbstractVote = function(galaxy, prop, vote) {
      $scope.loading = true;
      $scope.validateGalaxy(galaxy, function() {
        $scope.validateBytes32(prop, function() {
          if ($scope.offline) return transact();
          $scope.checkOwnership(galaxy, function() {
            //TODO state enum (living)
            $scope.checkState(galaxy, 2, function() {
              $scope.getIsAbstractMajority(prop, checkMajority);
            });
          });
        });
      });
      function checkMajority(data) {
        if (!data[0]) return $scope.getAbstractVote(galaxy, prop, checkVote);
        return $scope.notifier.danger("Proposal already has majority.");
      }
      function checkVote(data) {
        if (data[0] != vote) return transact();
        $scope.notifier.danger("Vote already registered.");
      }
      function transact() {
        $scope.doTransaction($scope.contracts.constitution,
          "castAbstractVote(uint8,bytes32,bool)",
          [galaxy, prop, vote]
        );
      }
    }
}
module.exports = urbitCtrl;
