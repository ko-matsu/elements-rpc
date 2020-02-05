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

// -----------------------------------------------------------------------------

const SendToNewAddress = async function(amount, blind = true){
  let address = await elementsCli.directExecute('getnewaddress', []);
  const addressinfo = await elementsCli.directExecute('getaddressinfo', [address])
  if ((blind === false) && ('unconfidential' in addressinfo)) {
    address = addressinfo.unconfidential
  }
  const txid = await elementsCli.directExecute('sendtoaddress', [address, amount]);
  await elementsCli.directExecute('generatetoaddress', [6, address]);
  const satoshi = Math.ceil(amount * 100000000);
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
