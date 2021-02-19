#!/bin/sh

if [ $# -ne 4 ]; then
  echo "usage: tx_search.sh startBlockHeight endBlockHeight targetTxid targetVout"
  exit 1
fi

bitcoin_bin=elements-cli
# bitcoin_bin=/d/workspace/7_install_wsl/dest/bin/bitcoin-cli
bitcoin_data_dir=
# bitcoin_data_dir=-datadir=/d/workspace/2_personal-repository/0_bitcoin/local_test/bitcoin

startIdx=$1
endIdx=$2
targetTxid=$3
targetVout=$4

for offset in $(seq 0 $(($endIdx - $startIdx))); do
  i=$(expr $startIdx + $offset)
  # echo $i
  hash=$($bitcoin_bin -regtest $bitcoin_data_dir getblockhash $i)
  txs=$($bitcoin_bin -regtest $bitcoin_data_dir getblock $hash | jq -c ".tx")
  len=$(echo "$txs" | jq length)
  # echo blockhash=$hash
  # echo txids=$txs
  # echo txidsLen=$len

  for j in $(seq 0 $(($len - 1))); do
    tx=$(echo "$txs" | jq -r .[$j])
    # echo "$j, $tx"
    vins=$($bitcoin_bin -regtest $bitcoin_data_dir getrawtransaction $tx true | jq -c ".vin[] | select(.txid == \"$targetTxid\" and .vout == $targetVout)")
    # echo $vins
    # vinlen=$(echo $vins | jq length)
    # echo "$vinlen"

    if [ $vins ]; then
      echo "txid=$tx"
      $bitcoin_bin -regtest $bitcoin_data_dir getrawtransaction $tx true
    fi
  done
done
