// UTF-8
'use strict';
const fs = require('fs')
const ini = require('ini')
const readline = require('readline-sync');
const jsonrpcClientLib = require('./jsonrpc-cli-lib')
const cfdjs = require('cfd-js')
const erpc = require('./elements-rpc.js')
// const bigInt = require('big-integer');
// process.on('unhandledRejection', console.dir);

// load configure
const connInfoFunction = function(path){
  let config = {}
  try {
    fs.statSync(path)
    config = ini.parse(fs.readFileSync(path, 'utf-8'))
  } catch(err) {
    // unknown file
    console.log(err)
  }
  let result = {
    bitcoin: {
      host: ('mainchainrpchost' in config) ? config.mainchainrpchost : '127.0.0.1',
      port: ('mainchainrpcport' in config) ? config.mainchainrpcport : 18443,
      user: ('mainchainrpcuser' in config) ? config.mainchainrpcuser : 'bitcoinrpc',
      pass: ('mainchainrpcpassword' in config) ? config.mainchainrpcpassword : 'bitcoinrpc'
    },
    elements: {
      host: ('rpcbind' in config) ? config.rpcbind : '127.0.0.1',
      port: ('rpcport' in config) ? config.rpcport : 8443,
      user: ('rpcuser' in config) ? config.rpcuser : 'bitcoinrpc',
      pass: ('rpcpassword' in config) ? config.rpcpassword : 'bitcoinrpc'
    }
  }
  return result
}

const connInfo = connInfoFunction('./command.conf')

const elemConnInfo = jsonrpcClientLib.CreateConnection(connInfo.elements.host, connInfo.elements.port, connInfo.elements.user, connInfo.elements.pass)
const btcConnInfo = jsonrpcClientLib.CreateConnection(connInfo.bitcoin.host, connInfo.bitcoin.port, connInfo.bitcoin.user, connInfo.bitcoin.pass)

let elementsCli = new jsonrpcClientLib.ElementsCli(elemConnInfo)
let btcCli = new jsonrpcClientLib.BitcoinCli(btcConnInfo)

const listunspentMax = 9999999

const toSatoshiAmount = function(amount){
  return Number(Math.floor(amount * 100000000));
};

// -----------------------------------------------------------------------------

const SendToNewAddress = async function(amount, blind = true){
  let address = await elementsCli.directExecute('getnewaddress', []);
  const addressinfo = await elementsCli.directExecute('getaddressinfo', [address])
  if ((blind === false) && ('unconfidential' in addressinfo)) {
    address = addressinfo.unconfidential
  }
  const txid = await elementsCli.directExecute('sendtoaddress', [address, amount]);
  await elementsCli.directExecute('generatetoaddress', [6, address]);
  // const satoshi = Math.ceil(amount * 100000000);
  const gettransaction = await elementsCli.directExecute('gettransaction', [txid]);
  const tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex]);
  let vout = 0;
  if (tx.vout[0].value === amount) {
    vout = 0;
  } else if (tx.vout[1].value === amount) {
    vout = 1;
  } else if (tx.vout[2].value === amount) {
    vout = 2;
  } else if ((tx.vout.length > 3) && tx.vout[3].value === amount) {
    vout = 3;
  } else {
    console.log("decode fail. tx=", JSON.stringify(tx, null, 2));
  }
  return {txid:txid, vout:vout, address:address,};
}

const btcSendToAddress = async function(amount, btcAdrType){
  let address = await btcCli.directExecute('getnewaddress', ['', btcAdrType]);
  const txid = await btcCli.directExecute('sendtoaddress', [address, amount]);
  await btcCli.directExecute('generatetoaddress', [6, address]);
  const gettransaction = await btcCli.directExecute('gettransaction', [txid]);
  const tx = cfdjs.DecodeRawTransaction({hex: gettransaction.hex, network: 'regtest'});
  // console.log('btcSendToAddress: ', JSON.stringify(tx, null, 2));
  let vout = 0;
  const satoshi = toSatoshiAmount(amount);
  if (Number(tx.vout[0].value) === satoshi) {
    vout = 0;
  } else if ((tx.vout.length > 1) && Number(tx.vout[1].value) === satoshi) {
    vout = 1;
  } else if ((tx.vout.length > 2) && Number(tx.vout[2].value) === satoshi) {
    vout = 2;
  } else if ((tx.vout.length > 3) && Number(tx.vout[3].value) === satoshi) {
    vout = 3;
  } else {
    console.log("decode fail. tx=", JSON.stringify(tx, null, 2));
  }
  return {txid:txid, vout:vout, address:address, amount: amount};
}

const btcCfdSendToAddress = async function(utxo, amount, address){
  // createTx
  let newAddress = await btcCli.directExecute('getnewaddress', ['', 'bech32']);
  const txdata = cfdjs.CreateRawTransaction({
    'version': 2,
    'locktime': 0,
    'txins': [{
      'txid': utxo.txid,
      'vout': utxo.vout,
      'sequence': 4294967295,
    }],
    'txouts': [{
      'address': address,
      'amount': toSatoshiAmount(amount),
    },{
      'address': newAddress,
      'amount': toSatoshiAmount(utxo.amount - amount - 0.00002000),
    }],
  });
  // sign
  const signTx = await btcCli.directExecute('signrawtransactionwithwallet', [txdata.hex]);
  const txid = await btcCli.directExecute('sendrawtransaction', [signTx.hex]);
  // await elementsCli.directExecute('generatetoaddress', [6, utxoAddr]);
  console.log("txid = " + txid);
  // const decTx = cfdjs.DecodeRawTransaction({hex: signTx.hex, network: 'regtest'});
  // console.log('btcCfdSendToAddress: ', JSON.stringify(decTx, null, 2));
  return {txid: txid, vout: 0};
}

const GenerateKeyPair = function(network = 'regtest', wif = true, isCompressed = true){
  const result = cfdjs.CreateKeyPair({
    wif: wif,
    network: network,
    isCompressed: isCompressed,
  });
  return {pubkey:result.pubkey, privkey:result.privkey,};
}

const CreatePubkeyAddress = function(pubkey, network = 'regtest', hashType = 'p2wpkh'){
  const result = cfdjs.CreateAddress({
    'keyData': {
      'hex': pubkey,
      'type': 'pubkey',
    },
    'network': network,
    'isElements': true,
    'hashType': hashType,
  });
  return result.address;
}

const CreateConfidentialPubkeyAddress = function(pubkey, confidentialKey, network = 'regtest', hashType = 'p2wpkh'){
  const addr = CreatePubkeyAddress(pubkey, network, hashType);
  const result = cfdjs.GetConfidentialAddress({
    'unblindedAddress': addr,
    'key': confidentialKey,
  });
  return result.confidentialAddress;
}

const checkString = function(arg, matchText, alias = undefined){
  if (arg == matchText) {
    return true
  } else if ((alias) && (arg == alias)) {
    return true
  }
  return false
}

// -----------------------------------------------------------------------------

const helpDump = function(nameobj) {
  if (!nameobj.parameter) {
    console.log('  ' + nameobj.name)
  } else {
    console.log('  ' + nameobj.name + ' ' + nameobj.parameter)
  }
  if (nameobj.alias) {
    console.log('    - alias: ' + nameobj.alias)
  }
}

const commandData = {
  cfdGenerateKey: {
    name: 'cfdGenerateKey',
    alias: 'cgenkey',
    parameter: '[<network> [<wif> [<isCompressed>]]]'
  },
  decodeTx: {
    name: 'decodeTx',
    alias: 'dec',
    parameter: '<tx> [<network>]'
  },
  blindtest_783: {
    name: 'blindtest_783',
    alias: undefined,
    parameter: '[<generateKey(default:false)>]'
  },
}

const help = function() {
  console.log('usage:')
  for (const key in commandData) {
    helpDump(commandData[key]);
  }
  erpc.help();
}

// -----------------------------------------------------------------------------
function strToBool(str) {
  return (str == 'true') ? true : false;
}
const toBigInt = function (n) {
  let s = bigInt(n).toString(16);
  while (s.length < 16) s = '0' + s;
  return new Uint8Array(Buffer.from(s, 'hex'));
}

const main = async () =>{
  try {
    if (process.argv.length <= 2) {
      for (var i = 0;i < process.argv.length; i++) {
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
    else if (checkString(process.argv[2], "cfdGenerateKey", "cgenkey")) {
      let network = 'regtest';
      let wif = true;
      let isCompressed = true;
      if (process.argv.length > 3) network = process.argv[3];
      if (process.argv.length > 4) wif = strToBool(process.argv[4]);
      if (process.argv.length > 5) isCompressed = strToBool(process.argv[5]);
      const result = GenerateKeyPair(network, wif, isCompressed);
      console.log(result);
    }
    else if (checkString(process.argv[2], "decodeTx", "dec")) {
      let tx = ''
      if (process.argv.length < 4) {
        let workTx = readline.question('target tx > ');
        tx += workTx.trim();
        while (workTx.length > 1020) {
          workTx = readline.question('tx input continue > ');
          if (workTx.length > 2) {
            tx += workTx.trim();
          }
        }
      } else {
        tx = process.argv[3]
      }
      let network = 'regtest';
      if (process.argv.length < 5) {
        network = readline.question('network > ');
      } else {
        network = process.argv[4];
      }
      let decTx = '';
      try {
        decTx = cfdjs.ElementsDecodeRawTransaction({
          hex: tx,
          mainchainNetwork: network,
        });
        console.log(JSON.stringify(decTx, null, 2));
        return;
      } catch (err) {
      }
      try {
        decTx = cfdjs.DecodeRawTransaction({
          hex: tx,
          network: network,
        });
        console.log(JSON.stringify(decTx, null, 2));
      } catch (err) {
        console.log(err);
        console.log(`tx = ${tx}`);
      }
    }
    else if (checkString(process.argv[2], "cfdBtcGetNewAddress", "cbnewaddr")) {
      // bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest'
      let network = 'regtest';
      // p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh
      let address_type = 'p2wpkh';
      let script = false;
      let hexData = '';
      if (process.argv.length > 3) hexData = process.argv[3];
      if (process.argv.length > 4) network = process.argv[4];
      if (process.argv.length > 5) address_type = process.argv[5];
      if (process.argv.length > 6) script = strToBool(process.argv[6]);
      const keyType = (script) ? 'redeem_script' : 'pubkey';
      if (hexData === '' && script === false) {
        const keyData = GenerateKeyPair(network, true, true);
        console.log(keyData);
        hexData = keyData.pubkey;
      }
      const result = cfdjs.CreateAddress({
        keyData: {
          hex: hexData,
          type: keyType,
        },
        network: network,
        hashType: address_type,
      });
      console.log(result);
    }
    else if (checkString(process.argv[2], "cfdElmGetNewAddress", "cenewaddr")) {
      // bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest'
      let network = 'regtest';
      // p2wpkh, p2wsh, p2pkh, p2sh, p2sh-p2wpkh, p2sh-p2wsh
      let address_type = 'p2wpkh';
      let script = false;
      const hexData = process.argv[3];
      if (process.argv.length > 4) network = process.argv[4];
      if (process.argv.length > 5) address_type = process.argv[5];
      if (process.argv.length > 6) script = strToBool(process.argv[6]);
      const keyType = (script) ? 'redeem_script' : 'pubkey';
      const result = cfdjs.CreateKeyPair({
        isElements: true,
        keyData: {
          hex: hexData,
          type: keyType,
        },
        network: network,
        hashType: address_type,
      });
      console.log(result);
    }
// generatefunds
    else if (checkString(process.argv[2], "cfdBtcGenerateFunds", "cbgenfund")) {
      // 
      if (process.argv.length < 5) {
        console.log("format: cfdBtcGenerateFunds <requireAmount> <address>")
        return 0
      }
      // bitcoin:'mainnet, testnet, regtest'. elements:'liquidv1, regtest'
      let network = 'regtest';
      const amount = parseInt(process.argv[3]);
      const address = process.argv[4];
      let sync = false;
      if (process.argv.length > 5) sync = strToBool(process.argv[5]);
      let totalAmount = 0;
      while(totalAmount < amount){
        const result = await btcCli.directExecute('generatetoaddress', [1, address, 1000000]);
        // console.log(`  generatetoaddress = ${result}`)
        for(var k = 0; k < result.length; k++){
          const blockHash = result[k];
          const block = await btcCli.directExecute('getblock', [blockHash]);
          for(var i = 0;i < block.tx.length; i++){
            const txid = block.tx[i];
            const txData = await btcCli.directExecute('getrawtransaction', [txid, false, blockHash]);
            // decode tx
            const decTx = cfdjs.DecodeRawTransaction({
              hex: txData, network: network,
            });
            for(var j = 0; j < decTx.vout.length; j++){
              // console.log("  tx = ", decTx.vout[j])
              if (decTx.vout[j].scriptPubKey.addresses) {
                if (decTx.vout[j].scriptPubKey.addresses.length === 0) {
                  // do nothing
                } else if (decTx.vout[j].scriptPubKey.addresses[0] === address) {
                  const amount = decTx.vout[j].value;
                  console.log(`  utxo[${txid},${j}] amount = ${amount}`)
                  totalAmount = totalAmount + decTx.vout[j].value;
                }
              }
            }
          }
        }
      }
      if (sync) {
        await btcCli.directExecute('generatetoaddress', [100, address, 1000000]);
      }
      console.log(`  totalAmount = ${totalAmount}`)
    }
// sendtoaddress
    else if (checkString(process.argv[2], "cfdBtcSendtoaddress", "cbsndaddr")) {
      // 
    }
// wallet command is need internal impl.
  // signrawtransactionwithwallet
  // getnewaddress
  // getaddressinfo
  // addmultisigaddress
  // dumpprivkey
  // estimatesmartfee
  // getbalance
  // listunspent
  // setpaytxfee
  // setrelayfee
  // validateaddress
  // fundrawtransaction
  // importaddress
// decoderawtransaction
// GenerateKey : done
// createnewaddress : done

    else if (checkString(process.argv[2], "blindtest_783")) {
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      const lbtcAsset = assetlabels.bitcoin;

      const network = 'regtest';
      const hashType = 'p2wpkh';
      let genKey = false;
      if (process.argv.length > 3) genKey = strToBool(process.argv[3]);

      // キー生成
      let keys1;
      let keys2;
      let confKeys1;
      let confKeys2;
      if (genKey) {
        keys1 = GenerateKeyPair(network);
        keys2 = GenerateKeyPair(network);
        confKeys1 = GenerateKeyPair(network, false);
        confKeys2 = GenerateKeyPair(network, false);
      } else {
        keys1 = {
          pubkey: '038fbe823e80ff4fd2368fd1cf04b97626bd1fb2db033ed5a0442ab5e616c14040',
          privkey: 'cW7TNDhv5wzXJqCEf1DfFi5ihCkSf5bCCuoFbZbYmGu8WwRjTa4q'
        };
        keys2 = {
          pubkey: '037cdfa375512efb497274e74db9861fca4dbd7a4729e6127f4e063b0c74c79091',
          privkey: 'cNpJqHZmmdudazLy7tAK8gky27fRFypC4rQNSapVNX8wVRNUi4go'
        };
        confKeys1 = {
          pubkey: '03a81625d4bd49dd519f65cc81652ca26ecf25fd05e95f9d84d36f84477cfe8927',
          privkey: '4a41d64ad4b10ce6bea5859e18d448c3d39ce235708d2348f8e560aed8a6c715'
        };
        confKeys2 = {
          pubkey: '0376995be8c4578187dc903d05888ba52918026c1b3d1ba9f9072e6f01ba76e04e',
          privkey: '2a8d0804abeaa461f6223175d797e337455e4be8f015b5de46b0a07d8a138cf3'
        };
      }
      console.log("keys1    =", keys1);
      console.log("keys2    =", keys2);
      console.log("confKeys1=", confKeys1);
      console.log("confKeys2=", confKeys2);

      const tx1out1Pubkey = keys1.pubkey;
      const tx1out1Privkey = keys1.privkey;
      const tx1out2Pubkey = keys2.pubkey;
      const tx1out2Privkey = keys2.privkey;

      // sendtoaddress (0.01btc, unblind)
      const send1 = await SendToNewAddress(0.01, false);
      const utxoAddr = send1.address;
      const utxoTxid = send1.txid;
      const utxoVout = send1.vout;

      // cfd createAddress
      const tx1out1Addr = CreateConfidentialPubkeyAddress(
          tx1out1Pubkey, confKeys1.pubkey, network, hashType);
      const tx1out2Addr = CreateConfidentialPubkeyAddress(
          tx1out2Pubkey, confKeys2.pubkey, network, hashType);

      // createTx
      const txdata = cfdjs.ElementsCreateRawTransaction({
        'version': 2,
        'locktime': 0,
        'txins': [{
          'txid': utxoTxid,
          'vout': utxoVout,
          'sequence': 4294967295,
        }],
        'txouts': [{
          'address': tx1out1Addr,
          'amount': 900000,
          'asset': lbtcAsset,
        },{
          'address': tx1out2Addr,
          'amount': 50000,
          'asset': lbtcAsset,
        }],
        'fee': {
          'amount': 50000,
          'asset': lbtcAsset,
        },
      });

      // blindTx
      const blindTx = cfdjs.BlindRawTransaction({
        'tx': txdata.hex,
        'txins': [{
          'txid': utxoTxid,
          'vout': utxoVout,
          'asset': lbtcAsset,
          'blindFactor': '0000000000000000000000000000000000000000000000000000000000000000',
          'assetBlindFactor': '0000000000000000000000000000000000000000000000000000000000000000',
          'amount': 1000000,
        }],
        'txouts': [{
            'index': 0,
            'blindPubkey': confKeys1.pubkey,
          },{
            'index': 1,
            'blindPubkey': confKeys2.pubkey,
          },
        ],
      });
      // console.log("blindTx=", JSON.stringify(blindTx, null, 2));
      const decodeTx = cfdjs.ElementsDecodeRawTransaction({hex: blindTx.hex, network: network,});
      console.log("blindTx=", JSON.stringify(decodeTx, null, 2));

      // unblind(for BlindFactor)
      const unblindTx = cfdjs.UnblindRawTransaction({
        'tx': blindTx.hex,
        'txouts': [{
            'index': 0,
            'blindingKey': confKeys1.privkey,
          },{
            'index': 1,
            'blindingKey': confKeys2.privkey,
          },
        ],
      });
      console.log("unblindTx=", JSON.stringify(unblindTx, null, 2));

      const generator1 = decodeTx.vout[0].assetcommitment
      const generator2 = decodeTx.vout[1].assetcommitment
      // const generator3 = decodeTx.vout[2].assetcommitment
      console.log("generator1 = " + generator1);
      console.log("generator2 = " + generator2);
      // console.log("generator3 = " + generator3);

      // sign, send
      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [blindTx.hex]);
      const txid = await elementsCli.directExecute('sendrawtransaction', [signTx.hex]);
      // await elementsCli.directExecute('generatetoaddress', [6, utxoAddr]);
      console.log("txid = " + txid);

      const send2 = await SendToNewAddress(0.001, false);

      // create addr(Confidential)
      let address1 = await elementsCli.directExecute('getnewaddress', []);
      let address2 = await elementsCli.directExecute('getnewaddress', []);
      console.log('address1 = ' + address1);
      console.log('address2 = ' + address2);

      // createTx
      const testTx = cfdjs.ElementsCreateRawTransaction({
        'version': 2,
        'locktime': 0,
        'txins': [{
          'txid': txid,
          'vout': 0,
          'sequence': 4294967295,
        },{
          'txid': send2.txid,
          'vout': send2.vout,
          'sequence': 4294967295,
        },{
          'txid': txid,
          'vout': 1,
          'sequence': 4294967295,
        }],
        'txouts': [{
          'address': address1,
          'amount': 900000,
          'asset': lbtcAsset,
        },{
          'address': address2,
          'amount': 100000,
          'asset': lbtcAsset,
        }],
        'fee': {
          'amount': 50000,
          'asset': lbtcAsset,
        },
      });
      console.log('testTx = ', testTx.hex);

      const emptyGen = '000000000000000000000000000000000000000000000000000000000000000000';
      let assetgenlist = [generator1, emptyGen, generator2];
      const blindTx2 = await elementsCli.directExecute(
          'blindrawtransaction', [testTx.hex, true, assetgenlist]);
      console.log('blindTx2 = ', blindTx2);

      const sighashRet1 = cfdjs.CreateElementsSignatureHash({
        tx: blindTx2,
        txin: {
          'txid': txid,
          'vout': 0,
          'keyData': {
            'hex': tx1out1Pubkey,
            'type': 'pubkey',
          },
          'confidentialValueCommitment': decodeTx.vout[0].valuecommitment,
          'hashType': hashType,
        },
      });
      const sighashRet2 = cfdjs.CreateElementsSignatureHash({
        tx: blindTx2,
        txin: {
          'txid': txid,
          'vout': 1,
          'keyData': {
            'hex': tx1out2Pubkey,
            'type': 'pubkey',
          },
          'confidentialValueCommitment': decodeTx.vout[1].valuecommitment,
          'hashType': hashType,
        },
      });
      const ecSig1 = cfdjs.CalculateEcSignature({
        'sighash': sighashRet1.sighash,
        'privkeyData': {
          'privkey': tx1out1Privkey,
          'network': network,
        },
      });
      const ecSig2 = cfdjs.CalculateEcSignature({
        'sighash': sighashRet2.sighash,
        'privkeyData': {
          'privkey': tx1out2Privkey,
          'network': network,
        },
      });
      const sign1 = cfdjs.AddSign({
        tx: blindTx2,
        isElements: true,
        txin: {
          txid: txid,
          vout: 0,
          signParam: [{
              hex: ecSig1.signature,
              type: 'sign',
              derEncode: true,
            },{
              hex: tx1out1Pubkey,
              type: 'pubkey',
            },
          ],
        },
      });
      const sign2 = cfdjs.AddSign({
        tx: sign1.hex,
        isElements: true,
        txin: {
          txid: txid,
          vout: 1,
          signParam: [{
              hex: ecSig2.signature,
              type: 'sign',
              derEncode: true,
            },{
              hex: tx1out2Pubkey,
              type: 'pubkey',
            },
          ],
        },
      });

      const signTx2 = await elementsCli.directExecute('signrawtransactionwithwallet', [sign2.hex]);
      const txid2 = await elementsCli.directExecute('sendrawtransaction', [signTx2.hex]);
      // await elementsCli.directExecute('generatetoaddress', [6, utxoAddr]);
      console.log("txid2 = " + txid2);
    }
    else if (checkString(process.argv[2], "blindpegin")) {
      const network = 'regtest';
      const mainchainNetwork = 'regtest';

      const amount = Number(process.argv[3]);
      let isBlind = true;
      let isScript = false;
      let fee = 0.001;
      if (process.argv.length >= 5) {
        fee = Number(process.argv[4]);
      }
      if (process.argv.length >= 6) {
        isBlind = (process.argv[5] === 'true');
      }
      let targetType = 'bech32'; // 'bech32'; 'p2sh-segwit'
      if (process.argv.length >= 7) {
        targetType = process.argv[6];
      }
      if (process.argv.length >= 8) {
        isScript = (process.argv[7] === 'true');
      }
      if (!amount || !fee) {
        throw Error('Invalid parameter');
      }
      const elmAmount = 0.00200000;
      const blockNum = 101;

      const befGetbalance = await elementsCli.directExecute('getbalance', []);
      console.log(`  before bitcoin amount = ${befGetbalance.bitcoin}`);

      // === pre process ===
      // get assetlabels
      const assetlabels = await elementsCli.dumpassetlabels();
      if (!assetlabels.bitcoin) {
        throw Error('bitcoin label not found.');
      }
      // console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      // pick token info
      const issuances = {};
      issuances.before = await elementsCli.listissuances();
      // console.log("=== issuances ===\n", issuances.before)
      const generateAddr = await elementsCli.getnewaddress();

      const adrType = targetType;
      let adrHashType = 'p2pkh';
      if (adrType === 'bech32') {
        adrHashType = 'p2wpkh';
      } else if (adrType === 'p2sh-segwit') {
        adrHashType = 'p2sh-p2wpkh';
      }

      // liquid and elements is constant. dynafed is native segwit.
      let peginAddrType = 'p2sh-p2wsh';
      let peginHashType = 'p2wpkh';

      let elemUtxoAddress = await elementsCli.directExecute(
          'getnewaddress', ['', adrType]);
      // console.log("elemUtxoAddress =>\n", elemUtxoAddress)
      const elemUtxoAddressinfo = await elementsCli.directExecute(
          'getaddressinfo', [elemUtxoAddress]);
      console.log('elemUtxoAddressinfo =>\n', elemUtxoAddressinfo);
      if (!isBlind && ('unconfidential' in elemUtxoAddressinfo)) {
        elemUtxoAddress = elemUtxoAddressinfo.unconfidential;
        console.log('send unconfidential address: ', elemUtxoAddress);
      }
      const utxoTxid = await elementsCli.directExecute(
          'sendtoaddress', [elemUtxoAddress, elmAmount]);
      console.log('utxoTxid =>\n', utxoTxid);
      await elementsCli.generatetoaddress(1, generateAddr);

      let elemSendAddress = await elementsCli.directExecute(
          'getnewaddress', ['', adrType]);
      const elemSendAddressinfo = await elementsCli.directExecute(
          'getaddressinfo', [elemSendAddress]);
      console.log('elemSendAddressinfo =>\n', elemSendAddressinfo);
      if (!isBlind && ('unconfidential' in elemSendAddressinfo)) {
        elemSendAddress = elemSendAddressinfo.unconfidential;
        console.log('send unconfidential address: ', elemSendAddress);
      }

      // === pick input utxo ===
      const utxos = {};
      const listunspentResult = await elementsCli.listunspent(
          0, listunspentMax);
      listunspentResult.sort((a, b) => (a.amount - b.amount));
      // pick btc utxo (If isBlinded is true, pick blinded utxo)
      utxos.btc = listunspentResult.find((unspent) => {
        return (unspent.txid === utxoTxid) && (Number(unspent.amount) === elmAmount);
      });
      if (!utxos.btc) {
        throw Error('listunspent fail. Maybe low fee.');
      }
      console.log('unspents >>\n', JSON.stringify(utxos, null, 2));

      const sidechainInfo = await elementsCli.getsidechaininfo();

      let elemPeginAddress = await elementsCli.directExecute(
          'getnewaddress', ['', adrType]);
      const elemPeginAddressinfo = await elementsCli.directExecute(
          'getaddressinfo', [elemPeginAddress]);
      if (!isBlind && ('unconfidential' in elemPeginAddressinfo)) {
        elemPeginAddress = elemPeginAddressinfo.unconfidential;
        console.log('pegin address: ', elemPeginAddress);
      }

      const btcAddress = await btcCli.directExecute('getnewaddress', []);
      let elemAddress = await elementsCli.directExecute(
          'getnewaddress', ['', adrType]);
      console.log('elements confidential address: ', elemAddress);
      const addressinfo = await elementsCli.directExecute(
          'getaddressinfo', [elemAddress]);
      if (!isBlind && ('unconfidential' in addressinfo)) {
        elemAddress = addressinfo.unconfidential;
        console.log('elements unconfidential address: ', elemAddress);
      }
      const pegPrivkey = await elementsCli.directExecute(
          'dumpprivkey', [elemAddress]);
      console.log("elemAddressinfo =>\n", addressinfo)

      let elemAddress2 = await elementsCli.directExecute(
          'getnewaddress', ['', adrType]);
      const addressinfo2 = await elementsCli.directExecute(
          'getaddressinfo', [elemAddress2]);
      const pegPrivkey2 = await elementsCli.directExecute(
          'dumpprivkey', [elemAddress2]);

      let paramPeginAddrJson;
      let multisigScript = '';
      if (isScript) {
        const multisig = cfdjs.CreateMultisig({
          'nrequired': 2,
          'keys': [
            addressinfo.pubkey,
            addressinfo2.pubkey,
          ],
          'network': network,
          'hashType': 'p2sh-p2wsh',
          'isElements': true,
        });
        multisigScript = multisig.witnessScript;

        paramPeginAddrJson = {
          'fedpegscript': sidechainInfo.fedpegscript,
          'redeemScript': multisigScript,
          'network': mainchainNetwork,
          'hashType': peginAddrType,  // if use dynafed, can use p2wsh.
        };
      } else {
        paramPeginAddrJson = {
          'fedpegscript': sidechainInfo.fedpegscript,
          'pubkey': addressinfo.pubkey,
          'network': mainchainNetwork,
          'hashType': peginAddrType,  // if use dynafed, can use p2wsh.
        };
      }

      const peginaddressInfo = cfdjs.CreatePegInAddress(paramPeginAddrJson);

      // const peginaddress = await elementsCli.directExecute(
      //     'getpeginaddress', [])
      console.log('getpeginaddress =>\n', peginaddressInfo);
      const peginAddress = peginaddressInfo.mainchainAddress;
      const claimScript = peginaddressInfo.claimScript;

      // btc
      const btcSnd0 = await btcSendToAddress(amount * 2, adrType);
      // console.log('btcSendToAddress: ', btcSnd0);
      const btcSnd = await btcCfdSendToAddress(btcSnd0, amount, peginAddress);
      console.log('btcSnd =>\n', btcSnd);
      const sendTxid = btcSnd.txid;
      const sendTxidVout = btcSnd.vout;
      await btcCli.directExecute('generatetoaddress', [blockNum, btcAddress]);
      const txData = await btcCli.directExecute('gettransaction', [sendTxid]);
      const txoutproof = await btcCli.directExecute(
          'gettxoutproof', [[sendTxid], txData.blockhash]);
      // console.log("gettransaction =>\n", txData)
      // console.log("gettxoutproof =>\n", txoutproof)

      let utxoAddrinfo = await elementsCli.directExecute(
          'getaddressinfo', [utxos.btc.address]);
      const utxoConfAddr = (isBlind) ? utxoAddrinfo.confidential : utxos.btc.address;
      utxoAddrinfo = await elementsCli.directExecute(
          'getaddressinfo', [utxoConfAddr]);
      console.log("utxoAddrinfo =>\n", utxoAddrinfo)
      console.log("utxoConfAddr =>\n", utxoConfAddr)

      const peginBtcTxObj = cfdjs.DecodeRawTransaction({
        'hex': txData.hex,
        'network': mainchainNetwork,
      });

      // Pegin ---------------------------------------------------------------
      const paramPeginJson = {
        'version': 2,
        'locktime': 0,
        'txins': [{
          'isPegin': true,
          'txid': sendTxid,
          'vout': sendTxidVout,
          'sequence': 4294967295,
          'peginwitness': {
            'amount': toSatoshiAmount(amount),
            'asset': assetlabels.bitcoin,
            'mainchainGenesisBlockHash': sidechainInfo.parent_blockhash,
            'claimScript': claimScript,
            'mainchainRawTransaction': txData.hex,
            'mainchainTxoutproof': txoutproof,
          },
          'isRemoveMainchainTxWitness': false,
        }, {
          'isPegin': false,
          'txid': utxos.btc.txid,
          'vout': utxos.btc.vout,
          'sequence': 4294967295,
        }],
        'txouts': [{
          'address': elemAddress,
          'amount': toSatoshiAmount(amount),
          'asset': assetlabels.bitcoin,
        }, {
          'address': elemSendAddress,
          'amount': toSatoshiAmount(utxos.btc.amount - fee),
          'asset': assetlabels.bitcoin,
        }],
        'fee': {
          'amount': toSatoshiAmount(fee),
          'asset': assetlabels.bitcoin,
        },
      };
      // console.log("paramPeginJson =>\n",
      //     JSON.stringify(paramPeginJson, null, 2))
      const peginTx = cfdjs.CreateRawPegin(paramPeginJson);
      // const pegin_tx = await elementsCli.directExecute(
      //     'createrawpegin', [txData.hex, txoutproof, claimScript])
      // console.log("createrawpegin =>\n", pegin_tx)

      const peginTxObj = cfdjs.ElementsDecodeRawTransaction({
        'hex': peginTx.hex,
        'network': network,
      });
      console.log("peginTxObj =>\n", JSON.stringify(peginTxObj, null, 2))

      // === blind transaction ===
      let blindTx = peginTx;
      if (isBlind) {
        blindTx = cfdjs.BlindRawTransaction({
          'tx': peginTx.hex,
          'txins': [
            {
              'txid': sendTxid,
              'vout': sendTxidVout,
              'asset': assetlabels.bitcoin,
              'amount': toSatoshiAmount(amount),
              'blindFactor': '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
              'assetBlindFactor': '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
            },
            {
              'txid': utxos.btc.txid,
              'vout': utxos.btc.vout,
              'asset': utxos.btc.asset,
              'blindFactor': utxos.btc.amountblinder,
              'assetBlindFactor': utxos.btc.assetblinder,
              'amount': toSatoshiAmount(utxos.btc.amount),
            },
          ],
          'txouts': [
            {
              'index': 0,
              'blindPubkey': addressinfo.confidential_key,
            },
            {
              'index': 1,
              'blindPubkey': utxoAddrinfo.confidential_key,
            },
          ],
        });
      }
      // console.log("blindTx = ", blindTx)

      // === sign transaction ===
      const inputAddrInfo = {};
      let signedTx = blindTx;
      // calc signature hash
      inputAddrInfo.btc = await elementsCli.getaddressinfo(utxoConfAddr);
      let sighashParamJson = {
        'tx': signedTx.hex,
        'txin': {
          'txid': utxos.btc.txid,
          'vout': utxos.btc.vout,
          'keyData': {
            'hex': utxoAddrinfo.pubkey,
            'type': 'pubkey',
          },
          'amount': (!isBlind) ? toSatoshiAmount(utxos.btc.amount) : 0,
          'confidentialValueCommitment': (!isBlind) ? '' : utxos.btc.amountcommitment,
          'hashType': (adrHashType === 'p2sh-p2wpkh') ? 'p2wpkh' : adrHashType,
          'sighashType': 'all',
          'sighashAnyoneCanPay': false,
        },
      };
      const sighash = cfdjs.CreateElementsSignatureHash(sighashParamJson);
      console.log('sighash = ', sighash);

      // calc signature
      const privkey = await elementsCli.dumpprivkey(utxoConfAddr);
      // let signature = cfdtest.CalculateEcSignature(
      //     sighash.sighash, privkey, "regtest")
      let signature = cfdjs.CalculateEcSignature({
        'sighash': sighash.sighash,
        'privkeyData': {
          'privkey': privkey,
          'network': mainchainNetwork,
        },
      }).signature;
      // set sign to wit
      signedTx = cfdjs.AddSign({
        'tx': signedTx.hex,
        'isElements': true,
        'txin': {
          'txid': utxos.btc.txid,
          'vout': utxos.btc.vout,
          'isWitness': (adrHashType === 'p2pkh') ? false : true,
          'signParam': [
            {
              'hex': signature,
              'type': 'sign',
              'derEncode': true,
              'sighashType': 'all',
              'sighashAnyoneCanPay': false,
            },
            {
              'hex': utxoAddrinfo.pubkey,
              'type': 'pubkey',
            },
          ],
        },
      });

      if ((adrHashType !== 'p2pkh') && utxoAddrinfo.isscript) {
        let redeemScript = utxoAddrinfo.hex;
        if (!redeemScript) {
          redeemScript = utxoAddrinfo.scriptPubKey;
        }
        signedTx = cfdjs.AddSign({
          'tx': signedTx.hex,
          'isElements': true,
          'txin': {
            'txid': utxos.btc.txid,
            'vout': utxos.btc.vout,
            'isWitness': false,
            'signParam': [
              {
                'hex': redeemScript,
                'type': 'redeem_script',
              },
            ],
          },
        });
        // console.log("redeem_script =>\n", inputAddrInfo.btc);
      }
      // console.log("signed pegout transaction =>\n", signedTx);

      // pegin witness sign
      if (!isScript) {
        const signatureHash = cfdjs.CreateElementsSignatureHash({
          'tx': signedTx.hex,
          'isElements': true,
          'txin': {
            'txid': sendTxid,
            'vout': sendTxidVout,
            'keyData': {
              'hex': addressinfo.pubkey,
              'type': 'pubkey',
            },
            'amount': toSatoshiAmount(amount),
            'hashType': (peginHashType === 'p2sh-p2wpkh') ? 'p2wpkh' : peginHashType,
            'sighashType': 'all',
            'sighashAnyoneCanPay': false,
          },
        });
        // console.log("\n*** signature hash ***\n", signatureHash, "\n")

        // calculate signature
        signature = cfdjs.CalculateEcSignature({
          'sighash': signatureHash.sighash,
          'privkeyData': {
            'privkey': pegPrivkey,
            'network': mainchainNetwork,
          },
        }).signature;

        signedTx = cfdjs.AddSign({
          'tx': signedTx.hex,
          'isElements': true,
          'txin': {
            'txid': sendTxid,
            'vout': sendTxidVout,
            'isWitness': (peginHashType === 'p2pkh') ? false : true,
            'signParam': [{
                'hex': signature,
                'type': 'sign',
                'derEncode': true,
                'sighashType': 'all',
                'sighashAnyoneCanPay': false,
              },{
                'hex': addressinfo.pubkey,
                'type': 'pubkey',
                'derEncode': false,
              },
            ],
          },
        });
      } else {
        const datas = [{
            pubkey: addressinfo.pubkey,
            privkey: pegPrivkey,
          }, {
            pubkey: addressinfo2.pubkey,
            privkey: pegPrivkey2,
          }
        ];
        let sigArr = [];
        for (let i = 0; i < datas.length; ++i) {
          const signatureHash = cfdjs.CreateElementsSignatureHash({
            'tx': signedTx.hex,
            'isElements': true,
            'txin': {
              'txid': sendTxid,
              'vout': sendTxidVout,
              'keyData': {
                'hex': (isScript) ? multisigScript : datas[i].pubkey,
                'type': (isScript) ? 'redeem_script' : 'pubkey',
              },
              'amount': toSatoshiAmount(amount),
              'hashType': (peginHashType === 'p2pkh') ? 'p2sh' : 'p2wsh',
              'sighashType': 'all',
              'sighashAnyoneCanPay': false,
            },
          });
          // console.log("\n*** signature hash ***\n", signatureHash, "\n")

          // calculate signature
          const signature = cfdjs.CalculateEcSignature({
            'sighash': signatureHash.sighash,
            'privkeyData': {
              'privkey': datas[i].privkey,
              'network': mainchainNetwork,
            },
          }).signature;
          sigArr.push(signature);
        }

        signedTx = cfdjs.AddMultisigSign({
          tx: signedTx.hex,
          isElements: true,
          txin: {
            'txid': sendTxid,
            'vout': sendTxidVout,
            'isWitness': (peginHashType === 'p2pkh') ? false : true,
            signParams: [
              {
                hex: sigArr[0],
                type: 'sign',
                derEncode: true,
                sighashType: 'all',
                sighashAnyoneCanPay: false,
                relatedPubkey: datas[0].pubkey,
              },
              {
                hex: sigArr[1],
                type: 'sign',
                derEncode: true,
                sighashType: 'all',
                sighashAnyoneCanPay: false,
                relatedPubkey: datas[1].pubkey,
              },
            ],
            redeemScript: (peginHashType === 'p2pkh') ? multisigScript : '',
            witnessScript: (peginHashType === 'p2pkh') ? '' : multisigScript,
            hashType: (peginHashType === 'p2pkh') ? 'p2sh' : 'p2wsh',
          },
        });
      }
      /*
      if (adrHashType === 'p2sh-p2wpkh') {
        signedTx = cfdjs.AddSign({
          'tx': signedTx.hex,
          'isElements': true,
          'txin': {
            'txid': sendTxid,
            'vout': sendTxidVout,
            'isWitness': false,
            'signParam': [
              {
                'hex': addressinfo.scriptPubKey,
                'type': 'redeem_script',
              },
            ],
          },
        });
        // console.log("redeem_script =>\n", inputAddrInfo.btc);
      }
      */

      // === send transaction ===
      let txid = '';
      try {
        txid = await elementsCli.sendrawtransaction(signedTx.hex);
        console.log(`\n=== pegout txid === => ${txid}\n`);
      } catch (sendErr) {
        const failedTxHex = signedTx.hex;
        const failedTx = cfdjs.ElementsDecodeRawTransaction({
          'hex': failedTxHex,
          'network': network,
          'mainchainNetwork': mainchainNetwork,
        });
        console.error('fail tx =>\n', JSON.stringify(failedTx, null, 2));
        throw sendErr;
      }

      // === post process ===
      await elementsCli.generatetoaddress(2, generateAddr);

      const balance = await elementsCli.getbalance();
      console.log(`  after bitcoin amount = ${balance.bitcoin}`);

      const gettransaction = await elementsCli.gettransaction(txid);
      const decodePegoutTx = cfdjs.ElementsDecodeRawTransaction({
        'hex': gettransaction.hex,
        'network': network,
        'mainchainNetwork': mainchainNetwork,
      });
      console.log('\n\n\n=== pegout tx decoded data === \n',
          JSON.stringify(decodePegoutTx, null, 2));
    }
    else if (checkString(process.argv[2], "blindtest")) {
      let is_blind = true;
      let sendAmt = 0.01;
      let checkAmt = sendAmt * 2;
      let fee = 0.0001;
      const blockNum = 105;
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', []);
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`);
      } catch (assetErr) {
        console.log("bitcoin label not found.\n");
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []]);
      let is_find = false;
      let is_find2 = false;
      let blindData = undefined;
      let unblindData = undefined;
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > checkAmt) {
            if (listunspent_result[idx].amountblinder === '0000000000000000000000000000000000000000000000000000000000000000') {
              if (!unblindData) {
                unblindData = listunspent_result[idx];
              }
            } else {
              if (!blindData) {
                blindData = listunspent_result[idx];
              }
            }
            if (blindData && unblindData) {
              break;
            }
          }
        }
      }
      if (!blindData || !unblindData) {
        console.log("listunspent fail. low fee.");
        return 0;
      }
      console.log("blindData >> ", blindData);
      console.log("unblindData >> ", unblindData);
      let amountList = {amount1: sendAmt, amount2: (blindData.amount - sendAmt),
          amount3: sendAmt, amount4: (unblindData.amount - sendAmt - fee)};

      const listlabels = await elementsCli.directExecute('listlabels', []);
      let testaddrNames = ['testaddr1', 'testaddr2', 'testaddr3', 'testaddr4'];
      let testaddrs = [undefined, undefined, undefined, undefined];
      let testaddrInfos = [undefined, undefined, undefined, undefined];
      // to unblind: 0, 1
      // to blind: 2, 3
      for (let key in listlabels) {
        for (let idx in testaddrNames) {
          if (!listlabels[key] || !testaddrNames[idx]) {
            // do nothing
          } else if (listlabels[key] === testaddrNames[idx]) {
            const addrname = await elementsCli.directExecute('getaddressesbylabel', [testaddrNames[idx]]);
            for (let key2 in addrname) {
              if (key2) {
                testaddrs[idx] = key2;
                break;
              }
            }
          }
        }
      }
      for (let idx in testaddrNames) {
        if (!testaddrs[idx]) {
          testaddrs[idx] = await elementsCli.getnewaddress(testaddrNames[idx], 'bech32');
        }
        const addr = testaddrs[idx];
        testaddrInfos[idx] = await elementsCli.directExecute('getaddressinfo', [addr])
        if (idx < 2) {
          // unblind
          testaddrs[idx] = testaddrInfos[idx].unconfidential;
        }
      }

      const testaddr1 = testaddrs[0];
      const testaddr2 = testaddrs[1];
      const testaddr3 = testaddrs[2];
      const testaddr4 = testaddrs[3];
      const createData = {
        version: 2,
        locktime: 0,
        txins: [{
          txid: blindData.txid,
          vout: blindData.vout,
          sequence: 4294967295,
        }, {
          txid: unblindData.txid,
          vout: unblindData.vout,
          sequence: 4294967295,
        }],
        txouts: [{
          address: testaddr1,
          amount: toSatoshiAmount(amountList.amount1),
          asset: assetlabels.bitcoin,
          isRemoveNonce: true,
        },{
          address: testaddr2,
          amount: toSatoshiAmount(amountList.amount2),
          asset: assetlabels.bitcoin,
          isRemoveNonce: true,
        },{
          address: testaddr3,
          amount: toSatoshiAmount(amountList.amount3),
          asset: assetlabels.bitcoin,
          isRemoveNonce: true,
        },{
          address: testaddr4,
          amount: toSatoshiAmount(amountList.amount4),
          asset: assetlabels.bitcoin,
          isRemoveNonce: true,
        }],
        fee: {
          amount: toSatoshiAmount(fee),
          asset: assetlabels.bitcoin,
        },
      };
      console.log('ElementsCreateRawTransaction req = ', createData);
      const txdata = cfdjs.ElementsCreateRawTransaction(createData);

      // === blind transaction ===
      let blindTx = txdata;
      blindTx = cfdjs.BlindRawTransaction({
        tx: txdata.hex,
        txins: [{
            txid: blindData.txid,
            vout: blindData.vout,
            asset: assetlabels.bitcoin,
            amount: toSatoshiAmount(blindData.amount),
            blindFactor: blindData.amountblinder,
            assetBlindFactor: blindData.assetblinder,
          }, {
            txid: unblindData.txid,
            vout: unblindData.vout,
            asset: assetlabels.bitcoin,
            amount: toSatoshiAmount(unblindData.amount),
            blindFactor: '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
            assetBlindFactor: '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
          },
        ],
        'txouts': [
          {
            'index': 2,
            'blindPubkey': testaddrInfos[2].confidential_key,
          }, {
            'index': 3,
            'blindPubkey': testaddrInfos[3].confidential_key,
          },
        ],
      });
      // console.log("blindTx = ", blindTx)

      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [blindTx.hex])
      console.log("signTx =>\n", signTx)

      const txid = await elementsCli.directExecute('sendrawtransaction', [signTx.hex])
      console.log("txid =>\n", txid)

      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)

    }
    else if (checkString(process.argv[2], "blindtest2")) {
      let is_blind = true;
      let sendAmt = 0.01;
      let checkAmt = sendAmt * 2;
      let fee = 0.0001;
      const blockNum = 105;
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', []);
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`);
      } catch (assetErr) {
        console.log("bitcoin label not found.\n");
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []]);
      let is_find = false;
      let is_find2 = false;
      let unblindData = undefined;
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > checkAmt) {
            if (listunspent_result[idx].amountblinder === '0000000000000000000000000000000000000000000000000000000000000000') {
              if (!unblindData) {
                unblindData = listunspent_result[idx];
                break;
              }
            }
            if (unblindData) {
              break;
            }
          }
        }
      }
      if (!unblindData) {
        console.log("listunspent fail. low fee.");
        return 0;
      }
      console.log("unblindData >> ", unblindData);
      let amountList = {amount1: unblindData.amount - fee};

      const listlabels = await elementsCli.directExecute('listlabels', []);
      let testaddrNames = ['testaddr1','testaddr2'];
      let testaddrs = [undefined, undefined];
      let testaddrInfos = [undefined, undefined];
      // to blind: 2, 3
      for (let key in listlabels) {
        for (let idx in testaddrNames) {
          if (!listlabels[key] || !testaddrNames[idx]) {
            // do nothing
          } else if (listlabels[key] === testaddrNames[idx]) {
            const addrname = await elementsCli.directExecute('getaddressesbylabel', [testaddrNames[idx]]);
            for (let key2 in addrname) {
              if (key2) {
                testaddrs[idx] = key2;
                break;
              }
            }
          }
        }
      }
      for (let idx in testaddrNames) {
        if (!testaddrs[idx]) {
          testaddrs[idx] = await elementsCli.getnewaddress(testaddrNames[idx], 'bech32');
        }
        const addr = testaddrs[idx];
        testaddrInfos[idx] = await elementsCli.directExecute('getaddressinfo', [addr])
      }

      const testaddr1 = testaddrs[0];
      const createData = {
        version: 2,
        locktime: 0,
        txins: [{
          txid: unblindData.txid,
          vout: unblindData.vout,
          sequence: 4294967295,
        }],
        txouts: [{
          address: testaddr1,
          amount: toSatoshiAmount(amountList.amount1),
          asset: assetlabels.bitcoin,
          isRemoveNonce: true,
        }],
        destroy: {
          amount: 0,
          asset: assetlabels.bitcoin,
        },
        fee: {
          amount: toSatoshiAmount(fee),
          asset: assetlabels.bitcoin,
        },
      };
      console.log('CreateDestroyAmount req = ', createData);
      const txdata = cfdjs.CreateDestroyAmount(createData);

      // === blind transaction ===
      let blindTx = txdata;
      blindTx = cfdjs.BlindRawTransaction({
        tx: txdata.hex,
        txins: [{
            txid: unblindData.txid,
            vout: unblindData.vout,
            asset: assetlabels.bitcoin,
            amount: toSatoshiAmount(unblindData.amount),
            blindFactor: '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
            assetBlindFactor: '0000000000000000000000000000000000000000000000000000000000000000', // eslint-disable-line max-len
          },
        ],
        'txouts': [
          {
            'index': 0,
            'blindPubkey': testaddrInfos[0].confidential_key,
          }, {
            'index': 1,
            'blindPubkey': testaddrInfos[1].confidential_key,
          },
        ],
      });
      // console.log("blindTx = ", blindTx)

      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [blindTx.hex])
      console.log("signTx =>\n", signTx)

      const txid = await elementsCli.directExecute('sendrawtransaction', [signTx.hex])
      console.log("txid =>\n", txid)

      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)

    }
    else if (checkString(process.argv[2], "negatepubkey")) {
      const pubkey = process.argv[3];
      console.log('negate pubkey =', cfdjs.NegatePubkey({pubkey}));
    }
    else if (erpc.elementsRpcFunction(false) == 0) {
      // execute elements-rpc.js
    }
    else {
      for(var i = 0;i < process.argv.length; i++){
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
  } catch (error) {
    console.log(error);
  }
  return 0
}
main()
