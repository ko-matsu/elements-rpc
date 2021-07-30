// UTF-8
'use strict';
const fs = require('fs')
const ini = require('ini')
const readline = require('readline-sync');
const zlib = require('zlib');
const needle = require('needle');

// -----------------------------------------------------------------------------

const commandData = {
  gettx: {
    name: 'gettx',
    alias: undefined,
    parameter: '[txid]'
  },
  tgettx: {
    name: 'tgettx',
    alias: undefined,
    parameter: '[txid]'
  },
  lgettx: {
    name: 'lgettx',
    alias: undefined,
    parameter: '[txid]'
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

const checkString = function(arg, matchText, alias = undefined, alias2 = undefined){
  if (arg == matchText) {
    return true
  } else if ((alias) && (arg == alias)) {
    return true
  } else if ((alias2) && (arg == alias2)) {
    return true
  }
  return false
}

const getPrefix = function(command, test_command, liquid_command) {
  let prefix = 'api'
  if (command == test_command) {
    prefix = 'testnet/api'
  }
  else if (command == liquid_command) {
    prefix = 'liquid/api'
  }
  return prefix
}

function doRequest(options, postData = undefined) {
  return new Promise(function (resolve, reject) {
    try {
      const func = function (error, res, body) {
        if (!error && res && res["statusCode"] && (res.statusCode === 200)) {
          const statusCode = res.statusCode;
          resolve({statusCode: statusCode, data: body, headers: res});
        } else if (!error && res && body) {
          resolve({statusCode: 299, data: body, headers: res});
        } else {
          reject(error);
        }
      };
      if (!postData) {
        needle.get(options.url, options, func);
      } else {
        needle.post(options.url, postData, options, func);
      }
    } catch (e) {
      throw e;
    }
  });
}

const getRequest = async function(url) {
  const headers = {
  };
  const requestOptions = {
    url: url,
    method: "GET",
    headers: headers,
    gzip: true
  };
  const res = await doRequest(requestOptions);
  return res;
}

const callGet = async function(url) {
  console.log(`url = ${url}`)
  // const opt = { 'SSL_VERIFYPEER':false, 'ENCODING':'gzip' }
  // const { statusCode, data, headers } = await curly.get(url, opt)
  const { statusCode, data, headers } = await getRequest(url)
  console.log(`status = ${statusCode}`)
  if ((statusCode >= 200) && (statusCode < 300)) {
    // console.log(`headers = ${headers}`)
    let result = data
    try {
      result = zlib.gunzipSync(data);
      console.log(`data(unzip) = ${result}`)
    } catch (error) {
      // do nothing
    }
    try {
      let jsonData = JSON.parse(data)
      console.log('data =', JSON.stringify(jsonData, null, 2))
    } catch (error) {
      if (data instanceof String) {
        console.log('data =', data)
      } else if (data instanceof Buffer) {
        console.log('data(hex) =', data.toString('hex'))
      } else if (data instanceof Object) {
        if (!(data instanceof Array)) {
          console.log('data =', data)
        } else {
          console.log('data(hex) =', data.toString('hex'))
        }
      } else {
        console.log('data =', data)
      }
    }
  }
}

const callPost = async function(url, formData, contextType) {
  console.log(`url = ${url}`)
  const reqHeaders = {
    'content-type': contextType,
  };
  const requestOptions = {
    url: url,
    method: 'POST',
    form: formData,
  };
  // push tx
  // pushtx$.map(rawtx     => ({ category: 'pushtx',     method: 'POST', path: `/tx`, send: rawtx, type: 'text/plain' }))
  // const opt = { 'SSL_VERIFYPEER':false, 'ENCODING':'gzip' }
  // const { statusCode, data, headers } = await curly.get(url, opt)
  const resp = await doRequest(requestOptions, formData.tx);
  try {
    // console.log(`response:`, resp)
    const { statusCode, data, headers } = resp;
    console.log(`status = ${statusCode}`)
    if ((statusCode >= 200) && (statusCode < 300)) {
      // console.log(`headers = ${headers}`)
      let result = data
      console.log('data =', result)
      console.log('jsondata =', JSON.stringify(result))
    }
  } catch (e) {
    console.log('post fail: ', e);
    throw e;
  }
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
    else if (checkString(process.argv[2], "sendtx", "tsendtx", "lsendtx")) {
      let filePath = ''
      if (process.argv.length < 4) {
        filePath = readline.question('txFilePath > ');
      } else {
        filePath = process.argv[3]
      }

      const hex = fs.readFileSync(filePath, 'utf-8').toString().trim();
      if (hex == '') {
        console.log("fail tx hex.\n")
        return
      }
      const formData = { tx: hex };
      console.log('formData =', formData);
      let prefix = getPrefix(process.argv[2], "tsendtx", "lsendtx");
      const url = `https://blockstream.info/${prefix}/tx`;
      await callPost(url, formData, 'text/plain');
    }
    else if (checkString(process.argv[2], "gettx", "tgettx", "lgettx")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == 'liquid/api') {
        console.log("fail txid.\n")
        
      }
      let prefix = getPrefix(process.argv[2], "tgettx", "lgettx")
      const url = `https://blockstream.info/${prefix}/tx/${txid}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gettxstatus", "tgettxstatus", "lgettxstatus")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == '') {
        console.log("fail txid.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgettxstatus", "lgettxstatus")
      const url = `https://blockstream.info/${prefix}/tx/${txid}/status`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gettxhex", "tgettxhex", "lgettxhex")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == '') {
        console.log("fail txid.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgettxhex", "lgettxhex")
      const url = `https://blockstream.info/${prefix}/tx/${txid}/hex`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gettxproof", "tgettxproof", "lgettxproof")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == '') {
        console.log("fail txid.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgettxproof", "lgettxproof")
      const url = `https://blockstream.info/${prefix}/tx/${txid}/merkle-proof`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gettxoutspends", "tgettxoutspends", "lgettxoutspends")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == '') {
        console.log("fail txid.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgettxoutspends", "lgettxoutspends")
      const url = `https://blockstream.info/${prefix}/tx/${txid}/outspends`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gettxoutspend", "tgettxoutspend", "lgettxoutspend")) {
      let txid = ''
      if (process.argv.length < 4) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[3]
      }
      if (txid == '') {
        console.log("fail txid.\n")
        return
      }
      let vout = ''
      if (process.argv.length < 5) {
        vout = readline.question('vout > ');
      } else {
        vout = process.argv[4]
      }
      if (vout == '') {
        console.log("fail vout.\n")
        return
      }
      const voutNum = Number(vout)
      let prefix = getPrefix(process.argv[2], "tgettxoutspend", "lgettxoutspend")
      const url = `https://blockstream.info/${prefix}/tx/${txid}/outspend/${voutNum}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getaddr", "tgetaddr", "lgetaddr")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('address > ');
      } else {
        address = process.argv[3]
      }
      if (address == '') {
        console.log("fail address.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetaddr", "lgetaddr")
      const url = `https://blockstream.info/${prefix}/address/${address}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getaddrtxs", "tgetaddrtxs", "lgetaddrtxs")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('address > ');
      } else {
        address = process.argv[3]
      }
      if (address == '') {
        console.log("fail address.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetaddrtxs", "lgetaddrtxs")
      const url = `https://blockstream.info/${prefix}/address/${address}/txs`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getaddrmempool", "tgetaddrmempool", "lgetaddrmempool")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('address > ');
      } else {
        address = process.argv[3]
      }
      if (address == '') {
        console.log("fail address.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetaddrmempool", "lgetaddrmempool")
      const url = `https://blockstream.info/${prefix}/address/${address}/txs/mempool`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getaddrutxo", "tgetaddrutxo", "lgetaddrutxo")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('address > ');
      } else {
        address = process.argv[3]
      }
      if (address == '') {
        console.log("fail address.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetaddrutxo", "lgetaddrutxo")
      const url = `https://blockstream.info/${prefix}/address/${address}/utxo`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getaddrchain", "tgetaddrchain", "lgetaddrchain")) {
      let address = ''
      if (process.argv.length < 4) {
        address = readline.question('address > ');
      } else {
        address = process.argv[3]
      }
      if (address == '') {
        console.log("fail address.\n")
        return
      }
      let txid = ''
      if (process.argv.length < 5) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[4]
      }
      let prefix = getPrefix(process.argv[2], "tgetaddrchain", "lgetaddrchain")
      let url = `https://blockstream.info/${prefix}/address/${address}/txs/chain`
      if ((txid != '') && (txid != ' ')) {
        url = `https://blockstream.info/${prefix}/address/${address}/txs/chain/${txid}`
      }
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gethaddr", "tgethaddr", "lgethaddr")) {
      let scripthash = ''
      if (process.argv.length < 4) {
        scripthash = readline.question('scripthash > ');
      } else {
        scripthash = process.argv[3]
      }
      if (scripthash == '') {
        console.log("fail scripthash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgethaddr", "lgethaddr")
      const url = `https://blockstream.info/${prefix}/scripthash/${scripthash}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gethaddrtxs", "tgethaddrtxs", "lgethaddrtxs")) {
      let scripthash = ''
      if (process.argv.length < 4) {
        scripthash = readline.question('scripthash > ');
      } else {
        scripthash = process.argv[3]
      }
      if (scripthash == '') {
        console.log("fail scripthash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgethaddrtxs", "lgethaddrtxs")
      const url = `https://blockstream.info/${prefix}/scripthash/${scripthash}/txs`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gethaddrmempool", "tgethaddrmempool", "lgethaddrmempool")) {
      let scripthash = ''
      if (process.argv.length < 4) {
        scripthash = readline.question('scripthash > ');
      } else {
        scripthash = process.argv[3]
      }
      if (scripthash == '') {
        console.log("fail scripthash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgethaddrmempool", "lgethaddrmempool")
      const url = `https://blockstream.info/${prefix}/scripthash/${scripthash}/txs/mempool`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gethaddrutxo", "tgethaddrutxo", "lgethaddrutxo")) {
      let scripthash = ''
      if (process.argv.length < 4) {
        scripthash = readline.question('scripthash > ');
      } else {
        scripthash = process.argv[3]
      }
      if (scripthash == '') {
        console.log("fail scripthash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgethaddrutxo", "lgethaddrutxo")
      const url = `https://blockstream.info/${prefix}/scripthash/${scripthash}/utxo`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "gethaddrchain", "tgethaddrchain", "lgethaddrchain")) {
      let scripthash = ''
      if (process.argv.length < 4) {
        scripthash = readline.question('scripthash > ');
      } else {
        scripthash = process.argv[3]
      }
      if (scripthash == '') {
        console.log("fail scripthash.\n")
        return
      }
      let txid = ''
      if (process.argv.length < 5) {
        txid = readline.question('txid > ');
      } else {
        txid = process.argv[4]
      }
      let prefix = getPrefix(process.argv[2], "tgethaddrchain", "lgethaddrchain")
      let url = `https://blockstream.info/${prefix}/scripthash/${scripthash}/txs/chain`
      if ((txid != '') && (txid != ' ')) {
        url = `https://blockstream.info/${prefix}/scripthash/${scripthash}/txs/chain/${txid}`
      }
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblock", "tgetblock", "lgetblock")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetblock", "lgetblock")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblockstatus", "tgetblockstatus", "lgetblockstatus")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetblockstatus", "lgetblockstatus")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}/status`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocktxs", "tgetblocktxs", "lgetblocktxs")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let index = ''
      if (process.argv.length < 5) {
        index = readline.question('index > ');
      } else {
        index = process.argv[4]
      }
      let prefix = getPrefix(process.argv[2], "tgetblocktxs", "lgetblocktxs")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}/txs`
      if ((index != '') && (index != ' ')) {
        const indexNum = Number(index)
        url = `https://blockstream.info/${prefix}/block/${blockhash}/txs/${indexNum}`
      }
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocktxids", "tgetblocktxids", "lgetblocktxids")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetblocktxids", "lgetblocktxids")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}/txids`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocktxid", "tgetblocktxid", "lgetblocktxid")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let index = ''
      if (process.argv.length < 5) {
        index = readline.question('index > ');
      } else {
        index = process.argv[4]
      }
      if (index == '') {
        console.log("fail index.\n")
        return
      }
      const indexNum = Number(index)
      let prefix = getPrefix(process.argv[2], "tgetblocktxid", "lgetblocktxid")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}/txid/${indexNum}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblockraw", "tgetblockraw", "lgetblockraw")) {
      let blockhash = ''
      if (process.argv.length < 4) {
        blockhash = readline.question('blockhash > ');
      } else {
        blockhash = process.argv[3]
      }
      if (blockhash == '') {
        console.log("fail blockhash.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetblockraw", "lgetblockraw")
      let url = `https://blockstream.info/${prefix}/block/${blockhash}/raw`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblockheight", "tgetblockheight", "lgetblockheight")) {
      let height = ''
      if (process.argv.length < 4) {
        height = readline.question('block-height > ');
      } else {
        height = process.argv[3]
      }
      if (height == '') {
        console.log("fail height.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "tgetblockheight", "lgetblockheight")
      let url = `https://blockstream.info/${prefix}/block-height/${height}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocks", "tgetblocks", "lgetblocks")) {
      let height = ''
      if (process.argv.length < 4) {
        height = readline.question('block-height > ');
      } else {
        height = process.argv[3]
      }
      let prefix = getPrefix(process.argv[2], "tgetblocks", "lgetblocks")
      let url = `https://blockstream.info/${prefix}/blocks`
      if ((height != '') && (height != ' ')) {
        const heightNum = Number(height)
        url = `https://blockstream.info/${prefix}/blocks/${heightNum}`
      }
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocks_tip_height", "tgetblocks_tip_height", "lgetblocks_tip_height")) {
      let prefix = getPrefix(process.argv[2], "tgetblocks_tip_height", "lgetblocks_tip_height")
      let url = `https://blockstream.info/${prefix}/blocks/tip/height`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getblocks_tip_hash", "tgetblocks_tip_hash", "lgetblocks_tip_hash")) {
      let prefix = getPrefix(process.argv[2], "tgetblocks_tip_hash", "lgetblocks_tip_hash")
      let url = `https://blockstream.info/${prefix}/blocks/tip/hash`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getmempool", "tgetmempool", "lgetmempool")) {
      let prefix = getPrefix(process.argv[2], "tgetmempool", "lgetmempool")
      let url = `https://blockstream.info/${prefix}/mempool`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getmempooltxids", "tgetmempooltxids", "lgetmempooltxids")) {
      let prefix = getPrefix(process.argv[2], "tgetmempooltxids", "lgetmempooltxids")
      let url = `https://blockstream.info/${prefix}/mempool/txids`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getmempoolrecent", "tgetmempoolrecent", "lgetmempoolrecent")) {
      let prefix = getPrefix(process.argv[2], "tgetmempoolrecent", "lgetmempoolrecent")
      let url = `https://blockstream.info/${prefix}/mempool/recent`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getfee-estimates", "tgetfee-estimates", "lgetfee-estimates")) {
      let prefix = getPrefix(process.argv[2], "tgetfee-estimates", "lgetfee-estimates")
      let url = `https://blockstream.info/${prefix}/fee-estimates`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getasset")) {
      let asset = ''
      if (process.argv.length < 4) {
        asset = readline.question('asset > ');
      } else {
        asset = process.argv[3]
      }
      if (asset == '') {
        console.log("fail asset.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "dummy", "getasset")
      let url = `https://blockstream.info/${prefix}/asset/${asset}`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getassettxs")) {
      let asset = ''
      if (process.argv.length < 4) {
        asset = readline.question('asset > ');
      } else {
        asset = process.argv[3]
      }
      if (asset == '') {
        console.log("fail asset.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "dummy", "getassettxs")
      let url = `https://blockstream.info/${prefix}/asset/${asset}/txs`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getassetmempool")) {
      let asset = ''
      if (process.argv.length < 4) {
        asset = readline.question('asset > ');
      } else {
        asset = process.argv[3]
      }
      if (asset == '') {
        console.log("fail asset.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "dummy", "getassetmempool")
      let url = `https://blockstream.info/${prefix}/asset/${asset}/txs/mempool`
      await callGet(url)
    }
    else if (checkString(process.argv[2], "getassettxschain")) {
      let asset = ''
      if (process.argv.length < 4) {
        asset = readline.question('asset > ');
      } else {
        asset = process.argv[3]
      }
      if (asset == '') {
        console.log("fail asset.\n")
        return
      }
      let lastSeen = ''
      if (process.argv.length < 4) {
        lastSeen = readline.question('lastSeen > ');
      } else {
        lastSeen = process.argv[3]
      }
      if (lastSeen == '') {
        console.log("fail asset.\n")
        return
      }
      let prefix = getPrefix(process.argv[2], "dummy", "getassettxschain")
      let url = `https://blockstream.info/${prefix}/asset/${asset}/txs/chain`
      if ((lastSeen != '') && (lastSeen != ' ')) {
        const heightNum = Number(height)
        url = `https://blockstream.info/${prefix}/asset/${asset}/txs/chain/${lastSeen}`
      }
      await callGet(url)
    }
    else {
      for(var i = 0;i < process.argv.length; i++){
        console.log("argv[" + i + "] = " + process.argv[i]);
      }
      help()
    }
  } catch (error) {
    console.log('cause exception:', error);
    return 1;
  }
  return 0
}
main()

