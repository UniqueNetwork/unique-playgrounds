const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Chain state tests', () => {
  let uniqueHelper;
  let alice;
  let bob;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    bob   = uniqueHelper.util.fromSeed('//Bob');
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test chain spec detection', async() => {
    const quartzNetwork = await UniqueHelper.detectNetworkByWsEndpoint('wss://ws-quartz.unique.network');
    expect(quartzNetwork).to.eq('quartz');
    const uniqueNetwork = await UniqueHelper.detectNetworkByWsEndpoint('wss://us-ws.unique.network');
    expect(uniqueNetwork).to.eq('unique');
  });

  it('Test chain properties', async () => {
    const properties = await uniqueHelper.chain.getChainProperties();
    expect(typeof properties.ss58Format).to.eq('number');
    for(let key of ['tokenDecimals', 'tokenSymbol']) {
      expect(Array.isArray(properties[key])).to.be.true;
      expect(properties[key].length).to.gte(1);
    }
    expect(typeof properties.tokenDecimals[0]).to.eq('number');
    expect(typeof properties.tokenSymbol[0]).to.eq('string');

    const oneToken = await uniqueHelper.balance.getOneTokenNominal();
    expect(oneToken).to.eq(10n ** BigInt(properties.tokenDecimals[0]));
  });

  it('Test block info', async() => {
    const lastBlock = await uniqueHelper.chain.getLatestBlockNumber();
    expect(typeof lastBlock).to.eq('number');
    expect(lastBlock).to.gt(0);
    const blockHash = await uniqueHelper.chain.getBlockHashByNumber(lastBlock);
    expect(typeof blockHash).to.eq('string');
    expect(blockHash.length).to.eq(66);
    const nonExistentHash = await uniqueHelper.chain.getBlockHashByNumber(lastBlock + 10_000);
    expect(nonExistentHash).to.be.null;
  });

  it('Test getCollectionTokenNextSponsored', async () => {
    expect(await uniqueHelper.collection.getTokenNextSponsored(0, 0, {Substrate: alice.address})).to.be.null;

    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 't1', description: 't1', tokenPrefix: 'tst'})).collectionId;
    const tokenId = (await uniqueHelper.nft.mintToken(alice, {collectionId, owner: bob.address})).tokenId;

    expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).to.be.null;

    await uniqueHelper.collection.setSponsor(alice, collectionId, alice.address);
    await uniqueHelper.collection.confirmSponsorship(alice, collectionId);

    expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).to.eq(0);
    await uniqueHelper.nft.transferToken(bob, collectionId, tokenId, {Substrate: alice.address});

    expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).to.lte(5);
  });

  it('Test address.ethToSubstrate', async () => {
    expect(await uniqueHelper.address.ethToSubstrate('0x5c03d3976Ad16F50451d95113728E0229C50cAB8')).to.eq('5Gppc4U5bFnhXCo3GUshZfooP85nMKrAfKvqpprFf8rhviop')
  });

  it('Test address.substrateToEth', async () => {
    expect(await uniqueHelper.address.substrateToEth('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).to.eq('0xd43593c715Fdd31c61141ABd04a99FD6822c8558');
  });
});
