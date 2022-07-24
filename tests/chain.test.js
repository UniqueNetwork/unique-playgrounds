const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Chain state tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let alice;
  let bob;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    bob   = uniqueHelper.util.fromSeed('//Bob');
  });

  afterAll(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test chain spec detection', async() => {
    const quartzNetwork = await UniqueHelper.detectNetworkByWsEndpoint('wss://ws-quartz.unique.network');
    await expect(quartzNetwork).toEqual('quartz');
    const uniqueNetwork = await UniqueHelper.detectNetworkByWsEndpoint('wss://us-ws.unique.network');
    await expect(uniqueNetwork).toEqual('unique')
  });

  it('Test chain properties', async () => {
    const properties = await uniqueHelper.chain.getChainProperties();
    await expect(typeof properties.ss58Format).toEqual('number');
    for(let key of ['tokenDecimals', 'tokenSymbol']) {
      await expect(Array.isArray(properties[key])).toBe(true);
      await expect(properties[key].length >= 1).toBe(true);
    }
    await expect(typeof properties.tokenDecimals[0]).toEqual('number');
    await expect(typeof properties.tokenSymbol[0]).toEqual('string');

    const oneToken = await uniqueHelper.balance.getOneTokenNominal();
    await expect(oneToken).toEqual(10n ** BigInt(properties.tokenDecimals[0]));
  });

  it('Test block info', async() => {
    const lastBlock = await uniqueHelper.chain.getLatestBlockNumber();
    await expect(typeof lastBlock).toEqual('number');
    await expect(lastBlock > 0).toBe(true);
    const blockHash = await uniqueHelper.chain.getBlockHashByNumber(lastBlock);
    await expect(typeof blockHash).toEqual('string');
    await expect(blockHash.length).toEqual(66);
    const nonExistentHash = await uniqueHelper.chain.getBlockHashByNumber(lastBlock + 10_000);
    await expect(nonExistentHash).toBeNull();
  });

  it('Test getCollectionTokenNextSponsored', async () => {
    await expect(await uniqueHelper.collection.getTokenNextSponsored(0, 0, {Substrate: alice.address})).toBeNull();

    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 't1', description: 't1', tokenPrefix: 'tst'})).collectionId;
    const tokenId = (await uniqueHelper.nft.mintToken(alice, {collectionId, owner: bob.address})).tokenId;

    await expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).toBeNull();

    await uniqueHelper.collection.setSponsor(alice, collectionId, alice.address);
    await uniqueHelper.collection.confirmSponsorship(alice, collectionId);

    await expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).toEqual(0);
    await uniqueHelper.nft.transferToken(bob, collectionId, tokenId, {Substrate: alice.address});

    await expect(await uniqueHelper.collection.getTokenNextSponsored(collectionId, tokenId, {Substrate: alice.address})).toBeLessThanOrEqual(5);
    await uniqueHelper.nft.transferToken(alice, collectionId, tokenId, {Substrate: bob.address});
  });

  it('Test address.ethToSubstrate', async () => {
    await expect(await uniqueHelper.address.ethToSubstrate('0x5c03d3976Ad16F50451d95113728E0229C50cAB8')).toEqual('5Gppc4U5bFnhXCo3GUshZfooP85nMKrAfKvqpprFf8rhviop')
  });

  it('Test address.substrateToEth', async () => {
    await expect(await uniqueHelper.address.substrateToEth('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')).toEqual('0xd43593c715Fdd31c61141ABd04a99FD6822c8558');
  });
});
