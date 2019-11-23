'use strict';
// https://www.npmjs.com/package/node-json-rpc2
const RpcClient = require('node-json-rpc2/lib/client');

const ExecuteRpc = async function (client, method, params) {
  const promise = client.callPromise(method, params, 1.0)
  const res = await promise
  if (res && ('error' in res) && (res['error'])) throw Error(res.error)
  else return res.result
};

exports.CreateConnection = function (host, port, id, password) {
  const config = {
    host: host,
    user: id,
    password: password,
    port: port,
    id: 'elements-rpc'
  };
  return config;
};

exports.BitcoinCli = function (connection) {
  const config = {
    protocol: 'http',
    method: 'POST',
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password
  };
  // console.log('config:', config);
  // console.log('requestData:', requestData);
  let client = new RpcClient(config);

  // Generating
  this.generatetoaddress = function (nblocks, address) {
    return ExecuteRpc(client, "generatetoaddress", [nblocks, address])
  }

  // wallet
  this.getaddressinfo = function (address) {
    return ExecuteRpc(client, "getaddressinfo", [address])
  }
  // util
  this.validateaddress = function (address) {
    return ExecuteRpc(client, "validateaddress", [address])
  }
  this.directExecute = function (method, params) {
    return ExecuteRpc(client, method, params)
  }
};

exports.ElementsCli = function (connection) {
  const config = {
    protocol: 'http',
    method: 'POST',
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password
  };
  // console.log('config:', config);
  // console.log('requestData:', requestData);
  let client = new RpcClient(config);

  // block
  this.getblockchaininfo = function () {
    return ExecuteRpc(client, "getblockchaininfo", [])
  }
  this.getsidechaininfo = function () {
    return ExecuteRpc(client, "getsidechaininfo", [])
  }
  // createblindedaddress "address" "blinding_key"
  // this.tweakfedpegscript = function(claim_script)

  // ---- bitcoin command ----
  // Generating
  this.generatetoaddress = function (nblocks, address) {
    return ExecuteRpc(client, "generatetoaddress", [nblocks, address])
  }
  // wallet
  this.createrawtransaction = function (inputs, outputs, locktime = 0, replaceable = false, outputAssets = null) {
    return ExecuteRpc(client, "createrawtransaction", [inputs, outputs, locktime, replaceable, outputAssets])
  }
  this.decoderawtransaction = function (hexstring, iswitness = true) {
    return ExecuteRpc(client, "decoderawtransaction", [hexstring, iswitness])
  }
  this.gettransaction = function (txid, includeWatchonly = false) {
    return ExecuteRpc(client, "gettransaction", [txid, includeWatchonly])
  }
  this.rawissueasset = function (transaction, issuances) {
    return ExecuteRpc(client, "rawissueasset", [transaction, issuances])
  }
  this.rawreissueasset = function (transaction, reissuances) {
    return ExecuteRpc(client, "rawreissueasset", [transaction, reissuances])
  }
  this.sendrawtransaction = function (hexstring, allowhighfees = false) {
    return ExecuteRpc(client, "sendrawtransaction", [hexstring, allowhighfees])
  }
  // Wallet
  this.blindrawtransaction = function (hexstring, ignoreblindfail = true, assetCommitments = [], blindIssuances = true, totalblinder = "") {
    return ExecuteRpc(client, "blindrawtransaction", [hexstring, ignoreblindfail, assetCommitments, blindIssuances, totalblinder])
  }
  this.dumpassetlabels = function () {
    return ExecuteRpc(client, "dumpassetlabels", [])
  }
  this.dumpblindingkey = function (address) {
    return ExecuteRpc(client, "dumpblindingkey", [address])
  }
  this.dumpmasterblindingkey = function () {
    return ExecuteRpc(client, "dumpmasterblindingkey", [])
  }
  this.dumpissuanceblindingkey = function (txid, vin) {
    return ExecuteRpc(client, "dumpissuanceblindingkey", [txid, vin])
  }
  this.dumpprivkey = function (address) {
    return ExecuteRpc(client, "dumpprivkey", [address])
  }
  this.getaddressinfo = function (address) {
    return ExecuteRpc(client, "getaddressinfo", [address])
  }
  this.getbalance = function (dummy = "*", minConfNum = 0, includeWatchonly = false, assetlabel = "") {
    return ExecuteRpc(client, "getbalance", ["*", minConfNum, includeWatchonly, assetlabel])
  }
  this.getnewaddress = function (label = null, type = null) {
    return ExecuteRpc(client, "getnewaddress", [label, type])
  }
  this.importblindingkey = function (address, blindingkey) {
    return ExecuteRpc(client, "importblindingkey", [address, blindingkey])
  }
  this.importprivkey = function (privkey, label = "", rescan = true) {
    return ExecuteRpc(client, "importprivkey", [privkey, label, rescan])
  }
  this.listissuances = function (asset = "") {
    return ExecuteRpc(client, "listissuances", [asset])
  }
  this.listunspent = function (minConfNum = 0, maxConfNum = 100, addresses = [], includeUnsafe = false, queryOptions) {
    return ExecuteRpc(client, "listunspent", [minConfNum, maxConfNum, [...addresses], includeUnsafe, queryOptions])
  }
  this.signrawtransactionwithwallet = function (hexstring, prevtxs = [], sighashtype = "ALL") {
    return ExecuteRpc(client, "signrawtransactionwithwallet", [hexstring, prevtxs, sighashtype])
  }
  this.unblindrawtransaction = function (hex) {
    return ExecuteRpc(client, "unblindrawtransaction", [hex])
  }
  // util
  this.validateaddress = function (address) {
    return ExecuteRpc(client, "validateaddress", [address])
  }
  this.directExecute = function (method, params) {
    return ExecuteRpc(client, method, params)
  }
};

// curl --user myusername --data-binary '{"jsonrpc": "1.0", "id":"curltest", "method": "signrawtransactionwithkey", "params": ["myhex"] }' -H 'content-type: text/plain;' http://127.0.0.1:8332

