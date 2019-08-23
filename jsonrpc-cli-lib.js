'use strict';
// https://www.npmjs.com/package/node-json-rpc2
const RpcClient = require('./node-json-rpc2/lib/client');
const { promisify } = require('util');

const ExecuteRpc = async function(client, method, params){
  const promise = client.callPromise(method, params, 1.0)
  const res = await promise
  if (res && ('error' in res) && (res['error'])) throw res.error
  if (res && ('result' in res) && (res['result'])) return res.result
  throw res
};

exports.CreateConnection = function(host, port, id, password){
  const config = {
    host: host,
    user: id,
    password: password,
    port: port,
    id: 'elements-rpc'
  };
  return config;
};

exports.BitcoinCli = function(connection){
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
  this.generatetoaddress = function(nblocks, address){
    return ExecuteRpc(client, "generatetoaddress", [nblocks, address])
  }

  // wallet
  this.getaddressinfo = function(address){
    return ExecuteRpc(client, "getaddressinfo", [address])
  }
  // util
  this.validateaddress = function(address){
    return ExecuteRpc(client, "validateaddress", [address])
  }
  this.directExecute = function(method, params){
    return ExecuteRpc(client, method, params)
  }
};

exports.ElementsCli = function(connection){
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
  this.getsidechaininfo = function(){
    return ExecuteRpc(client, "getsidechaininfo", [])
  }
  // createblindedaddress "address" "blinding_key"
  // this.tweakfedpegscript = function(claim_script)

  // ---- bitcoin command ----
  // Generating
  this.generatetoaddress = function(nblocks, address){
    return ExecuteRpc(client, "generatetoaddress", [nblocks, address])
  }

  // wallet
  this.getaddressinfo = function(address){
    return ExecuteRpc(client, "getaddressinfo", [address])
  }
  // util
  this.validateaddress = function(address){
    return ExecuteRpc(client, "validateaddress", [address])
  }
  this.directExecute = function(method, params){
    return ExecuteRpc(client, method, params)
  }
};

// curl --user myusername --data-binary '{"jsonrpc": "1.0", "id":"curltest", "method": "signrawtransactionwithkey", "params": ["myhex"] }' -H 'content-type: text/plain;' http://127.0.0.1:8332

