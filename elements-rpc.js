// UTF-8
'use strict';
const fs = require('fs')
const ini = require('ini')
const readline = require('readline-sync');
const jsonrpcClientLib = require('./jsonrpc-cli-lib')
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
const fix_masterblindingkey = ''  // bd9988aed6646c87a14fa5b9b82cac541074b0de03ee2f8851d79265e888ae12

// -----------------------------------------------------------------------------
const generate_function = async function(client, blockNum, address){
  await client.directExecute('generatetoaddress', [blockNum, address])
    //for (var i = 0; i < 6; ++i) {
      //const newAddress = await client.directExecute('getnewaddress', ['', 'bech32'])
    //console.log("address =>\n", newAddress)
    //await client.directExecute('sendtoaddress', [newAddress, 0.0002])
    //await client.directExecute('sendtoaddress', [newAddress, 0.0001])
    //}
}

// pegin function
const pegin_function = async function(amount, btc_address, elem_address, blockNum){
  const peginaddress = await elementsCli.directExecute('getpeginaddress', [])
  console.log("getpeginaddress =>\n", peginaddress)
  const pegin_address = peginaddress.mainchain_address
  const claim_script = peginaddress.claim_script
  // btc
  const send_txid = await btcCli.directExecute('sendtoaddress', [pegin_address, amount])
  console.log("sendtoaddress =>\n", send_txid)
  await btcCli.directExecute('generatetoaddress', [blockNum, btc_address])
  const tx_data = await btcCli.directExecute('gettransaction', [send_txid])
  //console.log("gettransaction =>\n", tx_data)
  const txoutproof = await btcCli.directExecute('gettxoutproof', [[send_txid]])
  //console.log("gettxoutproof =>\n", txoutproof)
  const pegin_tx = await elementsCli.directExecute('createrawpegin', [tx_data.hex, txoutproof, claim_script])
  //console.log("createrawpegin =>\n", pegin_tx)
  const pegin_tx_obj = await elementsCli.directExecute('decoderawtransaction', [pegin_tx.hex])
  const recv_addr = (pegin_tx_obj.vout[0].scriptPubKey.hex != '') ?
      pegin_tx_obj.vout[0].scriptPubKey.addresses[0] : pegin_tx_obj.vout[1].scriptPubKey.addresses[0]
  console.log("recv_addr =>\n", recv_addr)

  const validateaddress = await elementsCli.directExecute('validateaddress', [recv_addr])
  console.log("validateaddress =>\n", validateaddress)
  const addressinfo = await elementsCli.directExecute('getaddressinfo', [recv_addr])
  console.log("addressinfo =>\n", addressinfo)
  const privkey = await elementsCli.directExecute('dumpprivkey', [recv_addr])
  console.log("privkey =>\n", privkey)

  const signed_pegin_tx = await elementsCli.directExecute('signrawtransactionwithwallet', [pegin_tx.hex])
  //console.log("signrawtransaction =>\n", signed_pegin_tx)
  const pegin_txid = await elementsCli.directExecute('sendrawtransaction', [signed_pegin_tx.hex])
  console.log("sendrawtransaction =>\n", pegin_txid)

  await btcCli.directExecute('generatetoaddress', [blockNum, btc_address])
  //await elementsCli.directExecute('generatetoaddress', [blockNum, elem_address])
  await generate_function(elementsCli, blockNum, elem_address)
  const getbalance = await elementsCli.directExecute('getbalance', [])
  console.log("getbalance =>\n", getbalance)
}

// sendtoaddress function
const sendtoaddress_function = async function(client, address, amount, blockNum){
  const txid = await client.directExecute('sendtoaddress', [address, amount])
  console.log("sendtoaddress =>\n", txid)
  //await client.directExecute('generatetoaddress', [blockNum, address])
  await generate_function(client, blockNum, address)
  const rcvedbyaddr = await client.directExecute('getreceivedbyaddress', [address])
  console.log("getreceivedbyaddress =>\n", rcvedbyaddr)
  return txid
}

// blindrawtransaction function
const blindtransaction_function = async function(address, address2, amount, blockNum){
  // createrawtransaction [{"txid":"hex","vout":n,"sequence":n},...] [{"address":amount},{"data":"hex"},{"vdata":"hex"},{"burn":"hex"},{"fee":amount},...] ( locktime replaceable {"address":"str","fee":"str"} )

  // fundrawtransaction
  // blindrawtransaction

  const signed_blind_tx = await elementsCli.directExecute('signrawtransactionwithwallet', [pegin_tx.hex])
  //console.log("signrawtransaction =>\n", signed_pegin_tx)
  const blind_txid = await elementsCli.directExecute('sendrawtransaction', [signed_blind_tx.hex])
  console.log("sendrawtransaction =>\n", blind_txid)
  // await elementsCli.directExecute('generatetoaddress', [blockNum, address])
  await generate_function(elementsCli, blockNum, address)
}

// -----------------------------------------------------------------------------

const commandData = {
  getsidechaininfo: {
    name: 'getsidechaininfo',
    alias: undefined,
    parameter: undefined
  },
  sendtoaddress: {
    name: 'sendtoaddress',
    alias: 'sndaddr',
    parameter: '<address> <amount> (<nBlock>)'
  },
  btc_sendtoaddress: {
    name: 'btc_sendtoaddress',
    alias: 'bsndaddr',
    parameter: '<address> <amount> (<nBlock>)'
  },
  pegin: {
    name: 'pegin',
    alias: 'peg',
    parameter: '<amount> <btc_address> <elem_address>'
  },
  pegin_auto: {
    name: 'pegin_auto',
    alias: 'apeg',
    parameter: undefined
  },
  pegin_generate: {
    name: 'pegin_generate',
    alias: 'peg2snd',
    parameter: '<elem_address> <amount> <btc_address> (<nBlock>)'
  },
  generate: {
    name: 'generate',
    alias: 'gen',
    parameter: undefined
  },
  generate_confidential: {
    name: 'generate_confidential',
    alias: 'genct',
    parameter: undefined
  },
  pegout: {
    name: 'pegout',
    alias: undefined,
    parameter: '<amount> <btc_address>'
  },
  btc_validaddress: {
    name: 'btc_validaddress',
    alias: 'bvaddr',
    parameter: '[<address>]'
  },
  validaddress: {
    name: 'validaddress',
    alias: 'vaddr',
    parameter: '[<address>]'
  },
  dumptransaction: {
    name: 'dumptransaction',
    alias: 'dumptx',
    parameter: '[<txid>]'
  },
  btc_dumptransaction: {
    name: 'btc_dumptransaction',
    alias: 'bdumptx',
    parameter: '[<txid>]'
  },
  unblindtransaction: {
    name: 'unblindtransaction',
    alias: 'unblindtx',
    parameter: '[<txid>]'
  },
  listunspent: {
    name: 'listunspent',
    alias: 'utxo',
    parameter: '[<address>]'
  },
  getbalance: {
    name: 'getbalance',
    alias: undefined,
    parameter: undefined
  },
  createrawtransaction_single: {
    name: 'createrawtransaction_single',
    alias: 'createtx1',
    parameter: '<txid> <vout> <address> <amount> <fee>'
  },
  createrawtransaction_fund: {
    name: 'createrawtransaction_fund',
    alias: 'createtxf',
    parameter: undefined
  },
  createrawtransaction_unspent: {
    name: 'createrawtransaction_unspent',
    alias: 'createtxu',
    parameter: '[<[send_addr_list]> <fee>]'
  },
  sendissue: {
    name: 'sendissue',
    alias: undefined,
    parameter: '[<is_blind> <fee>]'
  },
  sendreissue: {
    name: 'sendissue',
    alias: undefined,
    parameter: '[<is_blind> <fee>]'
  },
}

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

const help = function() {
  console.log('usage:')
  for (const key in commandData) {
    helpDump(commandData[key])
  }
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

const elementsRpcFunction = async (dumpConsole = true) =>{
  try {
    if (process.argv.length <= 2) {
      if (!dumpConsole) return -1;
      for (var i = 0;i < process.argv.length; i++) {
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
    else if (checkString(process.argv[2], "listunspent", "utxo")) {
      if (process.argv.length < 4) {
        const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []])
        console.log("listunspent =>\n", listunspent_result)
      }
      else if (process.argv.length < 5) {
        const address = process.argv[3]
        const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, [address]])
        console.log("listunspent =>\n", listunspent_result)
      }
      else {
        const address = process.argv[3]
        let asset = process.argv[4]
        if (asset === 'bitcoin') {
          const labels = await elementsCli.directExecute('dumpassetlabels', [])
          asset = labels.bitcoin
        }
        if (address === '') {
          const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, [], true, {"asset":asset}])
          console.log("listunspent =>\n", listunspent_result)
        } else {
          const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, [address], true, {"asset":asset}])
          console.log("listunspent =>\n", listunspent_result)
        }
      }
    }
    else if (process.argv[2] == "btc_listunspent") {
      if (process.argv.length < 4) {
        const listunspent_result = await btcCli.directExecute('listunspent', [0, listunspentMax, []])
        console.log("listunspent =>\n", listunspent_result)
      }
      else if (process.argv.length < 5) {
        const address = process.argv[3]
        const listunspent_result = await btcCli.directExecute('listunspent', [0, listunspentMax, [address]])
        console.log("listunspent =>\n", listunspent_result)
      }
      else {
        const address = process.argv[3]
        if (address === '') {
          const listunspent_result = await btcCli.directExecute('listunspent', [0, listunspentMax, []])
          console.log("listunspent =>\n", listunspent_result)
        } else {
          const listunspent_result = await btcCli.directExecute('listunspent', [0, listunspentMax, [address]])
          console.log("listunspent =>\n", listunspent_result)
        }
      }
    }
    else if (process.argv[2] == "getbitcoinid") {
      const labels = await elementsCli.directExecute('dumpassetlabels', [])
      console.log("bitcoin =>\n", labels.bitcoin)
    }
    else if (process.argv[2] == "getbalance") {
      const getbalance = await elementsCli.directExecute('getbalance', [])
      console.log("getbalance =>\n", getbalance)
    }
    else if (process.argv[2] == "btc_listlabels") {
      const listslabels = await btcCli.directExecute('listlabels', [])
      console.log("listslabels =>\n", listslabels)
    }
    else if (process.argv[2] == "listlabels") {
      const listslabels = await elementsCli.directExecute('listlabels', [])
      console.log("listslabels =>\n", listslabels)
    }
    else if (process.argv[2] == "getsidechaininfo") {
      const result = await elementsCli.getsidechaininfo()
      console.log(process.argv[2] + "getsidechaininfo =>\n", result)
    }
    else if (checkString(process.argv[2], "btc_sendtoaddress", "bsndaddr")) {
      if (process.argv.length < 5) {
        console.log("format: btc_sendtoaddress <address> <amount> (<nBlock>)")
        return 0
      }
      const address = process.argv[3]
      const amount = process.argv[4]
      const blockNum = (process.argv.length >= 6) ? process.argv[5] : 105
      await sendtoaddress_function(btcCli, address, amount, blockNum)
    }
    else if (checkString(process.argv[2], "sendtoaddress", "sndaddr")) {
      if (process.argv.length < 5) {
        console.log("format: sendtoaddress <address> <amount> (<nBlock>)")
        return 0
      }
      const address = process.argv[3]
      const amount = process.argv[4]
      const blockNum = (process.argv.length >= 6) ? process.argv[5] : 105
      await sendtoaddress_function(elementsCli, address, amount, blockNum)
    }
    else if (checkString(process.argv[2], "btc_searchblock", "bsblock")) {
      if (process.argv.length < 5) {
        console.log("format: btc_searchblock <blockHash> <lockingScript>")
        return 0
      }
      const blockHash = process.argv[3];
      const lockingScript = process.argv[4];
      const result = await btcCli.directExecute('getblock', [blockHash]);
      for(var i = 0;i < result.tx.length; i++){
        const txid = result.tx[i];
        const txData = await btcCli.directExecute('getrawtransaction', [txid, true, blockHash]);
        for(var j = 0; j < txData.vout.length; j++){
          if (txData.vout[j].scriptPubKey.hex === lockingScript) {
            const amount = txData.vout[j].value;
            console.log(`  utxo[${txid},${j}] amount= ${amount}`)
          }
        }
      }
    }
    else if (checkString(process.argv[2], "btc_generatetoaddress", "bgenaddr")) {
      if (process.argv.length < 5) {
        console.log("format: btc_generatetoaddress <genNum> <address> <lockingScript>")
        return 0
      }
      const genNum = parseInt(process.argv[3]);
      const address = process.argv[4];
      const lockingScript = process.argv[5];
      const result = await btcCli.directExecute('generatetoaddress', [genNum, address, 1000000]);
      console.log(`  generatetoaddress = ${result}`)
      for(var k = 0; k < result.length; k++){
        const blockHash = result[k];
        const block = await btcCli.directExecute('getblock', [blockHash]);
        for(var i = 0;i < block.tx.length; i++){
          const txid = block.tx[i];
          const txData = await btcCli.directExecute('getrawtransaction', [txid, true, blockHash]);
          for(var j = 0; j < txData.vout.length; j++){
            if (txData.vout[j].scriptPubKey.hex === lockingScript) {
              const amount = txData.vout[j].value;
              console.log(`  utxo[${txid},${j}] amount = ${amount}`)
              console.log("  tx = ", txData.vout[j])
            }
          }
        }
      }
    }
    else if (checkString(process.argv[2], "pegin_generate", "peg2snd")) {
      if (process.argv.length < 6) {
        console.log("format: pegin_generate  <elem_address> <amount> <btc_address> (<nBlock>)")
        return 0
      }
      const address = process.argv[3]
      const amount = process.argv[4]
      const btc_address = process.argv[5]
      const blockNum = (process.argv.length >= 7) ? process.argv[6] : 105
      await pegin_function(amount + 1, btc_address, address, blockNum)
      await sendtoaddress_function(elementsCli, address, amount, blockNum)
    }
    else if (checkString(process.argv[2], "pegin", "peg")) {
      if (process.argv.length < 6) {
        console.log("format: pegin <amount> <btc_address> <elem_address>")
        return 0
      }
      await pegin_function(process.argv[3], process.argv[4], process.argv[5], 105)
    }
    else if (checkString(process.argv[2], "pegin_auto", "apeg")) {
      let amount = 1000.0
      const btc_address = await btcCli.directExecute('getnewaddress', [])
      console.log("BTC address: ", btc_address)
      let elem_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("elements confidential address: ", elem_address)
      const addressinfo = await elementsCli.directExecute('getaddressinfo', [elem_address])
      elem_address = addressinfo.unconfidential
      console.log("elements address: ", elem_address)
      while (true) {
        try {
          await pegin_function(amount, btc_address, elem_address, 105)
          break
        } catch (pegError) {
          let err = JSON.parse(pegError)
          if ((err.error.message === 'Insufficient funds')) {
            amount /= 10
          } else {
            throw pegError
          }
        }
      }
    }
    else if (checkString(process.argv[2], "pegin_auto_confidential", "apegct")) {
      let amount = 1000.0
      const btc_address = await btcCli.directExecute('getnewaddress', [])
      console.log("BTC address: ", btc_address)
      let elem_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("elements address: ", elem_address)
      while (true) {
        try {
          await pegin_function(amount, btc_address, elem_address, 105)
          break
        } catch (pegError) {
          let err = JSON.parse(pegError)
          if ((err.error.message === 'Insufficient funds')) {
            amount /= 10
          } else {
            throw pegError
          }
        }
      }
    }
    else if (checkString(process.argv[2], "btc_generate_auto", "bgen")) {
      const amount = 0.1
      let address = await btcCli.directExecute('getnewaddress', [])
      console.log("btc address: ", address)
      for (let count = 0; count < 10; ++count) {
        await btcCli.directExecute('generatetoaddress', [105, address])
        const txid = await btcCli.directExecute('sendtoaddress', [address, amount])
        console.log("sendtoaddress =>\n", txid)
      }
    }
    else if (checkString(process.argv[2], "pegingenerate_auto", "gen")) {
      const amount = 0.1
      let address = await elementsCli.directExecute('getnewaddress', [])
      const addressinfo = await elementsCli.directExecute('getaddressinfo', [address])
      address = addressinfo.unconfidential
      console.log("elements address: ", address)
      for (let count = 0; count < 10; ++count) {
        const txid = await elementsCli.directExecute('sendtoaddress', [address, amount])
        console.log("sendtoaddress =>\n", txid)
      }
    }
    else if (checkString(process.argv[2], "generate_confidential", "genct")) {
      const amount = 0.1
      let address = await elementsCli.directExecute('getnewaddress', [])
      console.log("elements address: ", address)
      for (let count = 0; count < 10; ++count) {
        const txid = await elementsCli.directExecute('sendtoaddress', [address, amount])
        console.log("sendtoaddress =>\n", txid)
      }
    }
    else if (checkString(process.argv[2], "btc_validaddress", "bvaddr")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('target address > ');
      } else {
        address = process.argv[3]
      }
      const validateaddress = await btcCli.directExecute('validateaddress', [address])
      console.log("validateaddress =>\n", validateaddress)
      const addressinfo = await btcCli.directExecute('getaddressinfo', [address])
      console.log("addressinfo =>\n", addressinfo)
      const rcvedbyaddress = await btcCli.directExecute('getreceivedbyaddress', [address])
      console.log("getreceivedbyaddress =>\n", rcvedbyaddress)
      const privkey = await btcCli.directExecute('dumpprivkey', [address])
      console.log("privkey =>\n", privkey)
    }
    else if (checkString(process.argv[2], "btc_labeladdress", "bladdr")) {
      let label = ''
      if (process.argv.length < 4) {
        label = readline.question('target label > ');
      } else {
        label = process.argv[3]
      }
      const addressbylabels = await btcCli.directExecute('getaddressesbylabel', [label])
      console.log("getaddressesbylabel =>\n", addressbylabels)
      for(let key in addressbylabels){
        const address = key
        const validateaddress = await btcCli.directExecute('validateaddress', [address])
        console.log("validateaddress =>\n", validateaddress)
        const addressinfo = await btcCli.directExecute('getaddressinfo', [address])
        console.log("addressinfo =>\n", addressinfo)
        const privkey = await btcCli.directExecute('dumpprivkey', [address])
        console.log("privkey =>\n", privkey)
        const rcvedbyaddress = await btcCli.directExecute('getreceivedbyaddress', [address])
        console.log("getreceivedbyaddress =>\n", rcvedbyaddress)
      }
    }
    else if (checkString(process.argv[2], "labeladdress", "laddr")) {
      let label = ''
      if (process.argv.length < 4) {
        label = readline.question('target label > ');
      } else {
        label = process.argv[3]
      }
      const addressbylabels = await elementsCli.directExecute('getaddressesbylabel', [label])
      console.log("getaddressesbylabel =>\n", addressbylabels)
      for(let key in addressbylabels){
        const address = key
        const validateaddress = await elementsCli.directExecute('validateaddress', [address])
        console.log("validateaddress =>\n", validateaddress)
        const addressinfo = await elementsCli.directExecute('getaddressinfo', [address])
        console.log("addressinfo =>\n", addressinfo)
        const privkey = await elementsCli.directExecute('dumpprivkey', [address])
        console.log("privkey =>\n", privkey)
        const rcvedbyaddress = await elementsCli.directExecute('getreceivedbyaddress', [address])
        console.log("getreceivedbyaddress =>\n", rcvedbyaddress)
        try {
          const blindingkey = await elementsCli.directExecute('dumpblindingkey', [address])
          console.log("blindingkey =>\n", blindingkey)
        } catch (addrErr) {
          if (addressinfo.confidential != addressinfo.unconfidential) {
            const conf_addressinfo = await elementsCli.directExecute('validateaddress', [addressinfo.confidential])
            console.log("confidential addressinfo =>\n", conf_addressinfo)
            const blindingkey2 = await elementsCli.directExecute('dumpblindingkey', [addressinfo.confidential])
            console.log("blindingkey =>\n", blindingkey2)
          }
        }
      }
    }
    else if (checkString(process.argv[2], "validaddress", "vaddr")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('target address > ');
      } else {
        address = process.argv[3]
      }
      const validateaddress = await elementsCli.directExecute('validateaddress', [address])
      console.log("validateaddress =>\n", validateaddress)
      const addressinfo = await elementsCli.directExecute('getaddressinfo', [address])
      console.log("addressinfo =>\n", addressinfo)
      const privkey = await elementsCli.directExecute('dumpprivkey', [address])
      console.log("privkey =>\n", privkey)
      const rcvedbyaddress = await elementsCli.directExecute('getreceivedbyaddress', [address])
      console.log("getreceivedbyaddress =>\n", rcvedbyaddress)
      try {
        const blindingkey = await elementsCli.directExecute('dumpblindingkey', [address])
        console.log("blindingkey =>\n", blindingkey)
      } catch (addrErr) {
        if (addressinfo.confidential != addressinfo.unconfidential) {
          const conf_addressinfo = await elementsCli.directExecute('validateaddress', [addressinfo.confidential])
          console.log("confidential addressinfo =>\n", conf_addressinfo)
          const blindingkey2 = await elementsCli.directExecute('dumpblindingkey', [addressinfo.confidential])
          console.log("blindingkey =>\n", blindingkey2)
        }
      }
    }
    else if (checkString(process.argv[2], "btc_dumptransaction", "bdumptx")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('target txid > ');
      } else {
        txid = process.argv[3]
      }
      const gettransaction = await btcCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)
      const tx = await btcCli.directExecute('decoderawtransaction', [gettransaction.hex])
      console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
    }
    else if (checkString(process.argv[2], "dumptransaction", "dumptx")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('target txid > ');
      } else {
        txid = process.argv[3]
      }
      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)
      const tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex])
      console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
    }
    else if (checkString(process.argv[2], "unblindtransaction", "unblindtx")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('target txid > ');
      } else {
        txid = process.argv[3]
      }
      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)
      const unblind_tx = await elementsCli.directExecute('unblindrawtransaction', [gettransaction.hex])
      const tx = await elementsCli.directExecute('decoderawtransaction', [unblind_tx.hex])
      console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
    }
    else if (checkString(process.argv[2], "createrawtransaction_single", "createtx1")) {
      if (process.argv.length < 8) {
        console.log("format: pegin <amount> <btc_address> <elem_address>")
        return 0
      }
      let txid = process.argv[3]
      let vout = process.argv[4]
      let address = process.argv[5]
      let amount = process.argv[6]
      let fee = process.argv[7]
      const createtx = await elementsCli.directExecute('createrawtransaction', [[{"txid":txid,"vout":vout}], [{address:amount}, {"fee":fee}]])
      console.log("createtx =>\n", createtx)
    }
    else if (checkString(process.argv[2], "createrawtransaction_unspent", "createtxu")) {
      let fee = 0.0001
      let sendAddrList = ['','']
      let sendNum = 2
      if (process.argv.length >= 4) {
        sendNum = process.argv[3]
        if (sendNum <= 1) {
          sendNum = 1
          sendAddrList = ['']
        }
      }
      if (process.argv.length >= 5) {
        fee = process.argv[4]
      }
      let needAmount = fee * sendNum
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      } catch (addrErr) {
        console.log("bitcoin label not found.\n")
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []])
      let is_find = false
      let map = {}
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > needAmount) {
            if (!is_find) {
              map = listunspent_result[idx]
              is_find = true
            } else if (listunspent_result[idx].amount < map.amount) {
              map = listunspent_result[idx]
            }
          }
        }
      }
      if (!is_find) {
        console.log("listunspent fail. low fee.")
        return 0
      }
      console.log("unspent >> ", map)
      let amount = map.amount - (fee * sendNum)
      let txinList = [{"txid":map.txid, "vout":map.vout}]
      const addr = map.address
      sendAddrList[0] = addr
      let txoutListStr = "[{\"" + addr + "\":" + amount.toFixed(8) + "}"
      for (let index = 1; index < sendNum; ++index) {
        if (sendAddrList.length <= index) {
          const newAddr = await elementsCli.directExecute('getnewaddress', [])
          sendAddrList.push(newAddr)
        } else if (sendAddrList[index] === '') {
          sendAddrList[index] = await elementsCli.directExecute('getnewaddress', [])
        }
        txoutListStr += ",{\"" + sendAddrList[index] + "\":" + fee.toFixed(8) + "}"
      }
      txoutListStr += ",{\"fee\":" + fee + "}]"
      let txoutList = JSON.parse(txoutListStr)
      const createtx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList])
      console.log("createtx =>\n", createtx)
      console.log(`addr[${addr}], amount : ${map.amount}`)
      for (let index = 1; index < sendNum; ++index) {
        const sendAddr = sendAddrList[index]
        console.log(`addr[${sendAddr}], amount : ${fee}`)
      }
    }
    else if (checkString(process.argv[2], "createrawtransaction_fund", "createtxf")) {
      const createtx = await elementsCli.directExecute('createrawtransaction', [[], [{"data":"00"}]])
      console.log("createtx =>\n", createtx)
      const fund_tx = await elementsCli.directExecute('fundrawtransaction', [createtx])
      console.log("fund_tx =>\n", fund_tx)
      const tx = await elementsCli.directExecute('decoderawtransaction', [fund_tx.hex])
      console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
    }
    else if (checkString(process.argv[2], "sendreissue")) {
      let is_blind = true
      let fee = 0.0001
      if (process.argv.length >= 4) {
        if ((process.argv[3] === false) || (process.argv[3] === 'false')) {
          console.log("reissue command is blind only.")
          return 0;
        } else {
          console.log("input = " + process.argv[3])
        }
      }
      if (process.argv.length >= 5) {
        fee = process.argv[4]
      }
      const blockNum = 105
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      } catch (assetErr) {
        console.log("bitcoin label not found.\n")
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []])
      let is_find = false
      let is_find2 = false
      let map = {}
      let map2 = {}
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > fee) {
            if (is_blind) {
              if (listunspent_result[idx].amountblinder === '0000000000000000000000000000000000000000000000000000000000000000') {
                continue
              }
            } else {
              if (listunspent_result[idx].amountblinder !== '0000000000000000000000000000000000000000000000000000000000000000') {
                continue
              }
            }
            if (!is_find) {
              map = listunspent_result[idx]
              is_find = true
            } else if (!is_find2) {
              map2 = listunspent_result[idx]
              is_find2 = true
            } else if (listunspent_result[idx].amount < map.amount) {
              map = listunspent_result[idx]
            } else if (listunspent_result[idx].amount < map2.amount) {
              map2 = listunspent_result[idx]
            }
          }
        }
      }
      if (!is_find) {
        console.log("listunspent fail. low fee.")
        return 0
      }
      if (!is_find2) {
        console.log("listunspent fail2. low fee.")
        return 0
      }
      console.log("unspent >> ", map)
      let amount = map.amount - fee
      let txinList = [{"txid":map.txid, "vout":map.vout}]
      let addr = map.address
      if (is_blind) {
        const addrinfo = await elementsCli.directExecute('getaddressinfo', [addr])
        addr = addrinfo.confidential
        console.log("confidential addr =>\n", addr)
      }

      let txoutListStr = "[{\"" + addr + "\":" + amount.toFixed(8) + "},{\"fee\":" + fee + "}]"
      let txoutList = JSON.parse(txoutListStr)
      const createtx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList])
      console.log("createtx =>\n", createtx)
      console.log(`unspent amount : ${map.amount}\n`)

      let asset_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("asset_address =>\n", asset_address)
      if (!is_blind) {
        const asset_addrinfo = await elementsCli.directExecute('getaddressinfo', [asset_address])
        asset_address = asset_addrinfo.unconfidential
      }
      let token_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("token_address =>\n", token_address)
      if (!is_blind) {
        const token_addrinfo = await elementsCli.directExecute('getaddressinfo', [token_address])
        token_address = token_addrinfo.unconfidential
      }

      const token_amount = 1
      const issueasset = await elementsCli.directExecute('rawissueasset', [createtx, [{"asset_amount":10,"asset_address":asset_address,"token_amount":token_amount,"token_address":token_address, "blind":is_blind}]])
      console.log("issueasset =>\n", issueasset)
      let issue_hex = issueasset[issueasset.length - 1].hex

      let gen_tx = issue_hex
      if (is_blind) {
        gen_tx = await elementsCli.directExecute('blindrawtransaction', [issue_hex, true, [map.assetcommitment], true])
        // gen_tx = await elementsCli.directExecute('rawblindrawtransaction', [issue_hex, [map.amountblinder], [map.amount], [map.asset], [map.assetblinder]])
        console.log("blindtx =>\n", gen_tx)
      }

      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [gen_tx])
      console.log("signTx =>\n", signTx)

      const issueTxid = await elementsCli.directExecute('sendrawtransaction', [signTx.hex])
      console.log("issueTxid =>\n", issueTxid)

      // await elementsCli.directExecute('generatetoaddress', [blockNum, addr])

      let issueRawTx = await elementsCli.directExecute('gettransaction', [issueTxid])

      gen_tx = issueRawTx.hex
      if (is_blind) {
        const ctissueTx = await elementsCli.directExecute('decoderawtransaction', [gen_tx])
        console.log("blinded issueTx =>\n", JSON.stringify(ctissueTx, null, 2))
        const ubtx = await elementsCli.directExecute('unblindrawtransaction', [gen_tx])
        gen_tx = ubtx.hex
      }
      const issueTx = await elementsCli.directExecute('decoderawtransaction', [gen_tx])
      console.log("issueTx =>\n", JSON.stringify(issueTx, null, 2))

      let token_vout = 3
      if (issueTx.vout[0].value == 1) {
        token_vout = 0
      }
      else if (issueTx.vout[1].value == 1) {
        token_vout = 1
      }
      else if (issueTx.vout[2].value == 1) {
        token_vout = 2
      }

      // キー変更は、`importmasterblindingkey "hexkey"`
      // listunspentのscriptPubKeyでbech32かどうかは判定可能

      // getbalance
      const issue_data = issueasset[issueasset.length - 1]
      const balance1 = await elementsCli.directExecute('getbalance', [])
      console.log("issued asset amount = ", balance1[issue_data.asset])
      console.log("issued token amount = ", balance1[issue_data.token])

      // createrawtransaction(in:token,btc out:token,btc,fee)
      console.log("unspent >> ", map2)
      amount = map2.amount - fee
      txinList = [{"txid":issueTxid, "vout":token_vout},{"txid":map2.txid, "vout":map2.vout}]
      txoutListStr = "[{\"" + token_address + "\":" + token_amount.toFixed(8) + "},{\"" + addr + "\":" + amount.toFixed(8) + "},{\"fee\":" + fee.toFixed(8) + "}]"
      txoutList = JSON.parse(txoutListStr)
      const txoutAssetListStr = "{\"" + token_address + "\":\"" + issue_data.token + "\"}"
      const txoutAssetList = JSON.parse(txoutAssetListStr)
      const creatertx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList, 0, false, txoutAssetList])
      console.log("creatertx =>\n", creatertx)
      console.log(`unspent amount : ${map2.amount}\n`)

      let asset_blinder = '0000000000000000000000000000000000000000000000000000000000000000'
      const token_utxo = await elementsCli.directExecute('listunspent', [0, listunspentMax, [], true, {"asset":issue_data.token}])
      console.log("token_utxo =>\n", token_utxo)
      if (token_utxo.length == 1) {
        asset_blinder = token_utxo[0].assetblinder
      }
      const tokenCommitment = token_utxo[0].assetcommitment
      // rawreissueasset   [hex, [{"asset_amount":15, "asset_address":asset_address, "input_index":0, "asset_blinder":map2.assetblinder, "entropy":issue_data.entropy}]]
      const rawreissueasset = await elementsCli.directExecute('rawreissueasset', [creatertx, [{"asset_amount":15,"asset_address":asset_address,"input_index":0,"asset_blinder":asset_blinder, "entropy":issue_data.entropy}]])
      console.log("reissueasset =>\n", rawreissueasset)
      let reissue_hex = rawreissueasset.hex
      const rawreissue_tx = await elementsCli.directExecute('decoderawtransaction', [reissue_hex])
      console.log("rawreissue_tx =>\n", JSON.stringify(rawreissue_tx, null, 2))

      gen_tx = reissue_hex
      if (is_blind) {
        console.log("token_utxo =>\n", tokenCommitment)
        console.log("map2       =>\n", map2.assetcommitment)
        gen_tx = await elementsCli.directExecute('blindrawtransaction', [gen_tx, true, [tokenCommitment, map2.assetcommitment], true])
        // gen_tx = await elementsCli.directExecute('rawblindrawtransaction', [reissue_hex, [map.amountblinder], [map.amount], [map.asset], [map.assetblinder]])
        console.log("blindtx =>\n", gen_tx)
      }

      const signRiTx = await elementsCli.directExecute('signrawtransactionwithwallet', [gen_tx])
      console.log("signTx =>\n", signRiTx)

      
      let txid = ''
      try {
        txid = await elementsCli.directExecute('sendrawtransaction', [signRiTx.hex])
        console.log("reissueTxid =>\n", txid)
      } catch (reissueErr) {
        gen_tx = signRiTx.hex
        if (is_blind) {
          const ubtx = await elementsCli.directExecute('unblindrawtransaction', [gen_tx])
          gen_tx = ubtx.hex
        }
        gen_tx = await elementsCli.directExecute('decoderawtransaction', [gen_tx])
        console.log("fail tx =>\n", JSON.stringify(gen_tx, null, 2))
        console.log("issueasset =>\n", issueasset)
        throw reissueErr
      }

      await elementsCli.directExecute('generatetoaddress', [blockNum, addr])

      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)
      try {
        const unblind_tx = await elementsCli.directExecute('unblindrawtransaction', [gettransaction.hex])
        const tx = await elementsCli.directExecute('decoderawtransaction', [unblind_tx.hex])
        const blind_tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex])
        console.log("decoderawtransaction =>\n", JSON.stringify(blind_tx, null, 2))
        console.log("unblind_decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
      } catch (assetErr) {
        const tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex])
        console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
      }
      if (is_blind) {
        const issue_key = await elementsCli.directExecute('dumpissuanceblindingkey', [txid, 0])
        console.log("dumpissuanceblindingkey ->", issue_key)
      }

      const balance2 = await elementsCli.directExecute('getbalance', [])
      console.log("reissued asset amount = ", balance2[issue_data.asset])
      console.log("reissued token amount = ", balance2[issue_data.token])
    }
    else if (checkString(process.argv[2], "sendissue")) {
      let is_blind = false
      let fee = 0.0001
      if (process.argv.length >= 4) {
        if ((process.argv[3] === true) || (process.argv[3] === 'true')) {
          is_blind = true
        } else {
          console.log("input = " + process.argv[3])
        }
      }
      if (process.argv.length >= 5) {
        fee = process.argv[4]
      }
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      } catch (assetErr) {
        console.log("bitcoin label not found.\n")
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, listunspentMax, []])
      let is_find = false
      let map = {}
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > fee) {
            if (is_blind) {
              if (listunspent_result[idx].amountblinder === '0000000000000000000000000000000000000000000000000000000000000000') {
                continue
              }
            } else {
              if (listunspent_result[idx].amountblinder !== '0000000000000000000000000000000000000000000000000000000000000000') {
                continue
              }
            }
            if (!is_find) {
              map = listunspent_result[idx]
              is_find = true
            } else if (listunspent_result[idx].amount < map.amount) {
              map = listunspent_result[idx]
            }
          }
        }
      }
      if (!is_find) {
        console.log("listunspent fail. low fee.")
        return 0
      }
      console.log("unspent >> ", map)
      let amount = map.amount - fee
      let txinList = [{"txid":map.txid, "vout":map.vout}]
      let addr = map.address
      if (is_blind) {
        const addrinfo = await elementsCli.directExecute('getaddressinfo', [addr])
        addr = addrinfo.confidential
        console.log("confidential addr =>\n", addr)
      }

      let txoutListStr = "[{\"" + addr + "\":" + amount.toFixed(8) + "},{\"fee\":" + fee + "}]"
      let txoutList = JSON.parse(txoutListStr)
      const createtx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList])
      console.log("createtx =>\n", createtx)
      console.log(`unspent amount : ${map.amount}\n`)

      let asset_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("asset_address =>\n", asset_address)
      if (!is_blind) {
        const asset_addrinfo = await elementsCli.directExecute('getaddressinfo', [asset_address])
        asset_address = asset_addrinfo.unconfidential
      }
      let token_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("token_address =>\n", token_address)
      if (!is_blind) {
        const token_addrinfo = await elementsCli.directExecute('getaddressinfo', [token_address])
        token_address = token_addrinfo.unconfidential
      }

      const issueasset = await elementsCli.directExecute('rawissueasset', [createtx, [{"asset_amount":10,"asset_address":asset_address,"token_amount":1,"token_address":token_address, "blind":is_blind}]])
      console.log("issueasset =>\n", issueasset)
      let issue_hex = issueasset[issueasset.length - 1].hex

      let gen_tx = issue_hex
      if (is_blind) {
        gen_tx = await elementsCli.directExecute('blindrawtransaction', [issue_hex, true, [map.assetcommitment], true])
        // gen_tx = await elementsCli.directExecute('rawblindrawtransaction', [issue_hex, [map.amountblinder], [map.amount], [map.asset], [map.assetblinder]])
        console.log("blindtx =>\n", gen_tx)
      }

      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [gen_tx])
      console.log("signTx =>\n", signTx)

      const txid = await elementsCli.directExecute('sendrawtransaction', [signTx.hex])
      console.log("txid =>\n", txid)

      const gettransaction = await elementsCli.directExecute('gettransaction', [txid])
      console.log("tx.amount =>\n", gettransaction.amount)
      console.log("tx.details =>\n", gettransaction.details)
      try {
        const unblind_tx = await elementsCli.directExecute('unblindrawtransaction', [gettransaction.hex])
        const tx = await elementsCli.directExecute('decoderawtransaction', [unblind_tx.hex])
        const blind_tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex])
        console.log("decoderawtransaction =>\n", JSON.stringify(blind_tx, null, 2))
        console.log("unblind_decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
      } catch (assetErr) {
        const tx = await elementsCli.directExecute('decoderawtransaction', [gettransaction.hex])
        console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
      }
      if (is_blind) {
        const issue_key = await elementsCli.directExecute('dumpissuanceblindingkey', [txid, 0])
        console.log("dumpissuanceblindingkey ->", issue_key)
      }
    }
    else if (checkString(process.argv[2], "pegout")) {
      if (process.argv.length < 5) {
        console.log("format: pegout <amount> <btc_address>")
        return 0
      }
      const amount = process.argv[3]
      const btcAddr = process.argv[4]
      const fee = 0.0001

      const rcv1 = await btcCli.directExecute('getreceivedbyaddress', [btcAddr])
      console.log("btc getreceivedbyaddress =>\n", rcv1)
      const txid = await elementsCli.directExecute('sendtomainchain', [btcAddr, amount])
      console.log("pegout txid =>\n", txid)

      const tx = await elementsCli.directExecute('gettransaction', [txid])
      const dectx = await elementsCli.directExecute('decoderawtransaction', [tx.hex])
      console.log("tx.amount =>\n", tx.amount)
      console.log("tx.details =>\n", tx.details)
      console.log("decoderawtransaction =>\n", JSON.stringify(dectx, null, 2))
      const ubtx = await elementsCli.directExecute('unblindrawtransaction', [tx.hex])
      const ubdectx = await elementsCli.directExecute('decoderawtransaction', [ubtx.hex])

      const addr = await elementsCli.directExecute('getnewaddress', [])
      const assets = await elementsCli.directExecute('getbalance', [])
      const send = await elementsCli.directExecute('sendtoaddress', [addr, assets.bitcoin, "", "", true])
      console.log("sendtoaddress =>\n", send)
      // elements-cli.exe sendtoaddress Azpk4e1w5xq74pw6hYj37WvURgdzq1sgqVwycrG58Xu2eZ1D5pz3usrXLtvRCCGwg9egWwCi3qwwSPZ7 5299.99977740 "" "" true 
      const blockNum = 105
      await elementsCli.directExecute('generatetoaddress', [blockNum, addr])
      await btcCli.directExecute('generatetoaddress', [blockNum, btcAddr])

      const rcv2 = await btcCli.directExecute('getreceivedbyaddress', [btcAddr])
      console.log("btc getreceivedbyaddress =>\n", rcv2)

      // elements-cli.exe sendtoaddress Azpk4e1w5xq74pw6hYj37WvURgdzq1sgqVwycrG58Xu2eZ1D5pz3usrXLtvRCCGwg9egWwCi3qwwSPZ7 5299.99977740 "" "" true
    } else if (process.argv[2] === 'createpegoutblock') {
      let xpub = '';
      if (process.argv.length < 4) {
        xpub = readline.question('target xpub > ');
      } else {
        xpub = process.argv[3];
      }

      const newAddress = await elementsCli.directExecute('getnewaddress', ['', 'bech32']);
      const addrinfo = await elementsCli.directExecute('getaddressinfo', [newAddress]);
      const liquidPak = addrinfo.pubkey;
      const privkey = await elementsCli.directExecute('dumpprivkey', [newAddress]);

      const xpubKeys = `sh(wpkh(${xpub}/0/*))`;
      const pegoutwallet = await elementsCli.directExecute('initpegoutwallet', [xpubKeys, 0, liquidPak]);
      console.log('pegoutwallet ->', pegoutwallet);

      let pakinfo = pegoutwallet.pakentry;
      // "pak=0260fd8ada8fae8e2a7399591aec5c999f6344eb2fc4bab83db94cef1a757c617a:026289577a6f0a3f8733716f07404ff2c07b47a53b62fdde1a4d6ce476c8e8bba4"
      pakinfo = pakinfo.replace(/pak=/g, '');
      pakinfo = pakinfo.replace(/:/g, '');
      const blockinfoStr = '{"signblockscript":"00204ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc33260","max_block_witness":3,"fedpegscript":"51","extension_space":["' + pakinfo + '"]}';
      const blockinfo = JSON.parse(blockinfoStr);
      console.log('blockinfo ->', blockinfo);
      for (let count = 0; count < 9; ++count) {
        const newblock = await elementsCli.directExecute('getnewblockhex', [0, blockinfo]);
        /*
        let sig = []
        try {
          sig = await elementsCli.directExecute('signblock', [newblock, ""])
        } catch (sigError) {
        }
        try {
          let combine = await elementsCli.directExecute('combineblocksigs', [newblock, sig, ""])
          newblock = combine.hex
        } catch (combError) {
          console.log("combError ->", combError)
        }
        */
        // console.log("newblock ->", newblock)
        try {
          const submit = await elementsCli.directExecute('submitblock', [newblock]);
          console.log('submit ->', submit);
        } catch (submitError) {
          // console.log("submitError ->", submitError)
          // どうもレスポンスが空のためエラーが発生している模様
        }
      }
      const blockchaininfo = await elementsCli.directExecute('getblockchaininfo', []);
      console.log('getblockchaininfo ->', blockchaininfo);
      console.log('liquidPak ->', liquidPak);
      console.log('liquidPak_privkey ->', privkey);
    }
    /*
    else if (process.argv[2] == "sendblindtx") {
      if (process.argv.length < 5) {
        console.log("format: sendtoaddress <address> <amount> (<nBlock>)")
        return 0
      }
      const address = process.argv[3]
      const amount = process.argv[4]
      const blockNum = (process.argv.length >= 6) ? process.argv[5] : 105
      const txid = await sendtoaddress_function(elementsCli, address, amount, blockNum)
      
      let targetAddr = address
      try {
        const validaddr = await elementsCli.directExecute('validateaddress', [address])
        if(('unconfidential' in validaddr) && (validaddr.unconfidential)){
          targetAddr = validaddr.unconfidential
        }
      } catch(error) {
        
      }
      const sendtx = await elementsCli.directExecute('gettransaction', [txid])
      const tx = await elementsCli.directExecute('decoderawtransaction', [sendtx.hex])
      let targetIndex = -1
      for (let idx=0; idx<tx.vout.length; ++idx) {
        if (tx.vout[idx].scriptPubKey.hex != '') {
          if (tx.vout[idx].scriptPubKey.addresses[0] == targetAddr) {
            targetIndex = idx
            break
          }
        }
      }

    }
    else if (process.argv[2] == "issuance") {
      if (process.argv.length < 4) {
        console.log("format: issuance <address>")
        return 0
      }
      
    }
    */
    else {
      if (!dumpConsole) return -1;
      for(var i = 0;i < process.argv.length; i++){
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
  } catch (error) {
    console.log(error);
  }
  return 0;
}

if ((process.argv.length >= 2) && (process.argv[1].lastIndexOf('elements-rpc.js') >= 0)) {
  elementsRpcFunction();
}

module.exports = { help, elementsRpcFunction };

// fundrawtransaction "hexstring" ( options iswitness )
// - txin補填

// combinerawtransaction ["hexstring",...]
// - 複数の部分的に署名されたトランザクションを1つのトランザクションに結合します。
//   結合されたトランザクションは、別の部分的に署名されたトランザクションまたは完全に署名されたトランザクション。

// blindrawtransaction "hexstring" ( ignoreblindfail ["assetcommitment",...] blind_issuances "totalblinder" )
//   - wallet利用
// rawblindrawtransaction "hexstring" ["inputamountblinder",...] [inputamount,...] ["inputasset",...] ["inputassetblinder",...] ( "totalblinder" ignoreblindfail )
// unblindrawtransaction "hex"

// signrawtransactionwithkey "hexstring" ["privatekey",...] ( [{"txid":"hex","vout":n,"scriptPubKey":"hex","redeemScript":"hex","witnessScript":"hex","amount":amount,"amountcommitment":"hex"},...] "sighashtype" )
// signrawtransactionwithwallet "hexstring" ( [{"txid":"hex","vout":n,"scriptPubKey":"hex","redeemScript":"hex","witnessScript":"hex","amount":amount,"amountcommitment":"str"},...] "sighashtype" )

// sendrawtransaction "hexstring" ( allowhighfees )

// rawissueasset "transaction" [{"asset_amount":amount,"asset_address":"str","token_amount":amount,"token_address":"str","blind":bool,"contract_hash":"hex"},...]
// rawreissueasset "transaction" [{"asset_amount":amount,"asset_address":"str","input_index":n,"asset_blinder":"hex","entropy":"hex"},...]

// rawissueasset "transaction" [{"asset_amount":amount,"asset_address":"str","token_amount":amount,"token_address":"str","blind":bool,"contract_hash":"hex"},...]
// rawreissueasset "transaction" [{"asset_amount":amount,"asset_address":"str","input_index":n,"asset_blinder":"hex","entropy":"hex"},...]
// issueasset assetamount tokenamount ( blind )
// reissueasset "asset" assetamount

