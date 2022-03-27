const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const { addressToEvm } = require('@polkadot/util-crypto');
const Web3 = require('web3');

const contractAbiPath = path.join(__dirname, 'marketplace', 'contract.abi');
const nonFungibleAbiPath = path.join(__dirname, 'marketplace', 'nonfungible.abi');

const connectWeb3 = wsEndpoint => {
  const provider = new Web3.providers.WebsocketProvider(wsEndpoint, {reconnect: {auto: true, maxAttempts: 5, delay: 1000}});
  const web3 = new Web3(provider);

  return {web3, provider};
}

const getContract = (web3, contractAddress) => {
  return new web3.eth.Contract(JSON.parse(fs.readFileSync(contractAbiPath).toString()), contractAddress);
}

const collectionIdToAddress = collectionId => {
  if (collectionId >= 0xffffffff || collectionId < 0) throw new Error('id overflow');
  const buf = Buffer.from([0x17, 0xc4, 0xe6, 0x45, 0x3c, 0xc4, 0x9a, 0xaa, 0xae, 0xac, 0xa8, 0x94, 0xe6, 0xd9, 0x68, 0x3e,
    collectionId >> 24,
    (collectionId >> 16) & 0xff,
    (collectionId >> 8) & 0xff,
    collectionId & 0xff,
  ]);
  return Web3.utils.toChecksumAddress('0x' + buf.toString('hex'));
}

const getEvmCollection = (web3, collectionId) => {
  return new web3.eth.Contract(JSON.parse(fs.readFileSync(nonFungibleAbiPath).toString()), collectionIdToAddress(collectionId));
}


const callEVM = async (signer, contract, transaction, uniqueHelper, web3) => {
  let result = await uniqueHelper.signTransaction(
    signer,
    uniqueHelper.api.tx.evm.call(
      subToEth(signer.address),
      contract.options.address,
      transaction.encodeABI(),
      0,
      2_500_000,
      await web3.eth.getGasPrice(),
      null,
      null,
      []
    ),
    'api.tx.evm.call'
  );
  return {success: result.result.events.some(({event: {section, method}}) => section === 'evm' && method === 'Executed'), result};
}


const sellTokenToContract = async (signer, collectionId, tokenId, tokenPrice, contract, uniqueHelper, web3) => {
  let res = await uniqueHelper.transferNFTToken(signer, collectionId, tokenId, {Ethereum: subToEth(signer.address)});
  if(!res) throw Error('Unable to transfer token to ethereum mirror');
  const evmCollection = getEvmCollection(web3, collectionId);
  res = await callEVM(signer, evmCollection, evmCollection.methods.approve(contract.options.address, tokenId), uniqueHelper, web3);
  if(!res.success) throw Error('Unable to approve token to contract');
  res = await callEVM(signer, contract, contract.methods.addAsk(tokenPrice, '0x0000000000000000000000000000000000000001', evmCollection.options.address, tokenId), uniqueHelper, web3);
  if(!res.success) throw Error('Unable to add offer to contract (addAsk failed)');
  return true;
}

const subToEthLowercase = eth => {
  const bytes = addressToEvm(eth);
  return '0x' + Buffer.from(bytes).toString('hex');
}

const subToEth = eth => {
  return Web3.utils.toChecksumAddress(subToEthLowercase(eth));
}

const getBalanceString = async (uniqueHelper) => {
  const chainProperties = await uniqueHelper.getChainProperties();
  return balance => {
    return `${balance / (10n ** BigInt((chainProperties.tokenDecimals || ['18'])[0]))} ${(chainProperties.tokenSymbol || ['tokens'])[0]} (${balance})`
  };
}

const getRemoteMarketplaceSettings = url => {
  let module = (url.indexOf('https://') === 0) ? https : http;
  return new Promise((resolve, reject) => {
    let responseSent = false;
    module.get(url, response => {
      response.on('data', d => {
        resolve(JSON.parse(d));
      });
    }).on('error', err => {
      if(responseSent)  return;
      responseSent = true;
      reject(err);
    });
  });
}

module.exports = {
  subToEth, getBalanceString, connectWeb3, getContract, sellTokenToContract, getEvmCollection, getRemoteMarketplaceSettings
}
