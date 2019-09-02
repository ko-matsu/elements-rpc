'use strict';
const jsonrpcClientLib = require('./jsonrpc-cli-lib')
const fs = require('fs')
const ini = require('ini')
const readline = require('readline-sync');
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
  pegin_generate: {
    name: 'pegin_generate',
    alias: 'peg2snd',
    parameter: '<elem_address> <amount> <btc_address> (<nBlock>)'
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
    alias: undefined,
    parameter: undefined
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
    parameter: '[<fee>]'
  },
  sendissue: {
    name: 'sendissue',
    alias: undefined,
    parameter: undefined
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
  helpDump(commandData.getsidechaininfo)
  helpDump(commandData.sendtoaddress)
  helpDump(commandData.btc_sendtoaddress)
  helpDump(commandData.pegin)
  helpDump(commandData.pegin_generate)
  helpDump(commandData.validaddress)
  helpDump(commandData.btc_validaddress)
  helpDump(commandData.dumptransaction)
  helpDump(commandData.btc_dumptransaction)
  helpDump(commandData.unblindtransaction)
  helpDump(commandData.listunspent)
  helpDump(commandData.getbalance)
  helpDump(commandData.createrawtransaction_single)
  helpDump(commandData.createrawtransaction_fund)
  helpDump(commandData.createrawtransaction_unspent)
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

const main = async () =>{
  try {
    if (process.argv.length <= 2) {
      for (var i = 0;i < process.argv.length; i++) {
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
    else if (process.argv[2] == "listunspent") {
      const listunspent_result = await elementsCli.directExecute('listunspent', [0, 100, []])
      console.log("listunspent =>\n", listunspent_result)
    }
    else if (process.argv[2] == "getbalance") {
      const getbalance = await elementsCli.directExecute('getbalance', [])
      console.log("getbalance =>\n", getbalance)
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
      const privkey = await btcCli.directExecute('dumpprivkey', [address])
      console.log("privkey =>\n", privkey)
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
      if (process.argv.length >= 4) {
        fee = process.argv[3]
      }
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      } catch (addrErr) {
        console.log("bitcoin label not found.\n")
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, 100, []])
      let is_find = false
      let map = {}
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > fee) {
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
      const addr = map.address
      let txoutListStr = "[{\"" + addr + "\":" + amount.toFixed(8) + "},{\"fee\":" + fee + "}]"
      let txoutList = JSON.parse(txoutListStr)
      const createtx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList])
      console.log("createtx =>\n", createtx)
      console.log(`unspent amount : ${map.amount}\n`)
    }
    else if (checkString(process.argv[2], "createrawtransaction_fund", "createtxf")) {
      const createtx = await elementsCli.directExecute('createrawtransaction', [[], [{"data":"00"}]])
      console.log("createtx =>\n", createtx)
      const fund_tx = await elementsCli.directExecute('fundrawtransaction', [createtx])
      console.log("fund_tx =>\n", fund_tx)
      const tx = await elementsCli.directExecute('decoderawtransaction', [fund_tx.hex])
      console.log("decoderawtransaction =>\n", JSON.stringify(tx, null, 2))
    }
    else if (checkString(process.argv[2], "sendissue")) {
      let fee = 0.0001
      if (process.argv.length >= 4) {
        fee = process.argv[3]
      }
      const assetlabels = await elementsCli.directExecute('dumpassetlabels', [])
      try {
        console.log(`bitcoin asset id = ${assetlabels.bitcoin}`)
      } catch (assetErr) {
        console.log("bitcoin label not found.\n")
      }

      const listunspent_result = await elementsCli.directExecute('listunspent', [0, 100, []])
      let is_find = false
      let map = {}
      for (let idx=0; idx<listunspent_result.length; ++idx) {
        if (listunspent_result[idx].asset === assetlabels.bitcoin) {
          if (listunspent_result[idx].amount > fee) {
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
      const addr = map.address
      let txoutListStr = "[{\"" + addr + "\":" + amount.toFixed(8) + "},{\"fee\":" + fee + "}]"
      let txoutList = JSON.parse(txoutListStr)
      const createtx = await elementsCli.directExecute('createrawtransaction', [txinList, txoutList])
      console.log("createtx =>\n", createtx)
      console.log(`unspent amount : ${map.amount}\n`)

      const asset_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("asset_address =>\n", asset_address)
      const token_address = await elementsCli.directExecute('getnewaddress', [])
      console.log("token_address =>\n", token_address)
      const issueasset = await elementsCli.directExecute('rawissueasset', [createtx, [{"asset_amount":10,"asset_address":asset_address,"token_amount":1,"token_address":token_address, "blind":false}]])
      console.log("issueasset =>\n", issueasset)
      let issue_hex = issueasset[issueasset.length - 1].hex

      const blindtx = await elementsCli.directExecute('rawblindrawtransaction', [issue_hex, [map.amountblinder], [map.amount], [map.asset], [map.assetblinder]])
      console.log("blindtx =>\n", blindtx)

      const signTx = await elementsCli.directExecute('signrawtransactionwithwallet', [blindtx])
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

