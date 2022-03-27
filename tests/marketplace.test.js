const path = require('path');
const fs = require('fs');

const { evmToAddress } = require('@polkadot/util-crypto');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { connectWeb3, getContract, subToEth, sellTokenToContract, getEvmCollection} = require('../src/helpers/marketplace');

const { getConfig } = require('./config');
const { deployContract } = require('./misc/marketplace/contract');


describe('Marketplace utils tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let web3conn;
  let alice;

  const deployOrUseCachedContract = async () => {
    const contractCacheFilePath = path.join(__dirname, 'cache', 'contract.json');
    const contractCache = fs.existsSync(contractCacheFilePath) ? JSON.parse(fs.readFileSync(contractCacheFilePath).toString()) : {address: null};
    let contractAddress = contractCache.address;
    let code = '';
    try {
      code = await uniqueHelper.api.rpc.eth.getCode(contractAddress);
    } catch (e) {
      code = '';
    }
    if(!contractCache.address || code.length < 1) {
      contractAddress = await deployContract(web3conn.web3, uniqueHelper, alice);
      fs.writeFileSync(contractCacheFilePath, JSON.stringify({address: contractAddress}));
    }
    await expect((await uniqueHelper.api.query.evmContractHelpers.sponsoringMode(contractAddress)).toJSON()).toBe('Allowlisted');
    await expect((await uniqueHelper.api.query.evmContractHelpers.sponsoringRateLimit(contractAddress)).toJSON()).toBe(0);
    const oneToken = await uniqueHelper.getOneTokenNominal();
    let contractBalance = await uniqueHelper.getEthereumAccountBalance(contractAddress);
    if(contractBalance < 10n * oneToken) {
      await uniqueHelper.transferBalanceToSubstrateAccount(alice, evmToAddress(contractAddress), oneToken * 100n);
    }
    return contractAddress;
  }

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    await uniqueHelper.connect(config.wsEndpoint);
    web3conn = connectWeb3(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  afterAll(async () => {
    web3conn.provider.connection.close();
    await uniqueHelper.disconnect();
  });

  it('Test sell token to marketplace contract', async () => {
    const collection = await uniqueHelper.mintNFTCollection(alice, {name: 'to sell', description: 'collection to sell tokens on marketplace', tokenPrefix: 'ts'});
    await collection.mintMultipleTokens(alice, [
      {owner: {Substrate: alice.address}, variableData: 'first token'},
      {owner: {Substrate: alice.address}, variableData: 'second token'},
      {owner: {Substrate: alice.address}, variableData: 'third token'}
    ]);
    const contractAddress = await deployOrUseCachedContract();
    const contract = getContract(web3conn.web3, contractAddress);
    const evmCollection = getEvmCollection(web3conn.web3, collection.collectionId);
    let noAsk = await contract.methods.getOrder(evmCollection.options.address, 1).call();
    await expect({tokenId: noAsk.idNFT, price: noAsk.price}).toEqual({tokenId: '0', price: '0'});

    // TODO: remove this after fix billing
    await uniqueHelper.transferBalanceToSubstrateAccount(alice, evmToAddress(subToEth(alice.address)), 10n * await uniqueHelper.getOneTokenNominal());

    let result = await sellTokenToContract(alice, collection.collectionId, 1, 12_000_000_000, contract, uniqueHelper, web3conn.web3);
    await expect(result).toBe(true);
    let activeAsk = await contract.methods.getOrder(evmCollection.options.address, 1).call();
    await expect({tokenId: activeAsk.idNFT, price: activeAsk.price}).toEqual({tokenId: '1', price: '12000000000'});
    let currentOwner = (await collection.getToken(1)).normalizedOwner;
    await expect(currentOwner).toEqual({ethereum: contractAddress.toLocaleLowerCase()});
  });
});
