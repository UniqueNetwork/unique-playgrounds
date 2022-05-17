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
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    bob   = uniqueHelper.util.fromSeed('//Bob');
  });

  afterAll(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test chain properties', async () => {
    const properties = await uniqueHelper.getChainProperties();
    await expect(typeof properties.ss58Format).toEqual('string');
    await expect(`${parseInt(properties.ss58Format)}`).toEqual(properties.ss58Format);
    for(let key of ['tokenDecimals', 'tokenSymbol']) {
      await expect(Array.isArray(properties[key])).toBe(true);
      await expect(properties[key].length >= 1).toBe(true);
    }

    const oneToken = await uniqueHelper.getOneTokenNominal();
    await expect(oneToken).toEqual(10n ** BigInt(properties.tokenDecimals[0]));
  });

  it('Test block info', async() => {
    const lastBlock = await uniqueHelper.getLatestBlockNumber();
    await expect(typeof lastBlock).toEqual('number');
    await expect(lastBlock > 0).toBe(true);
    const blockHash = await uniqueHelper.getBlockHashByNumber(lastBlock);
    await expect(typeof blockHash).toEqual('string');
    await expect(blockHash.length).toEqual(66);
    const nonExistentHash = await uniqueHelper.getBlockHashByNumber(lastBlock + 10_000);
    await expect(nonExistentHash).toBeNull();
  });

  it('Test getCollectionTokenNextSponsored', async () => {
    expect(await uniqueHelper.getCollectionTokenNextSponsored(0, 0, {Substrate: alice.address})).toBeNull();

    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 't1', description: 't1', tokenPrefix: 'tst'})).collectionId;
    const token = (await uniqueHelper.mintNFTToken(alice, {collectionId, owner: bob.address, variableData: 'bob token', constData: "0x1111"})).token.tokenId;

    await uniqueHelper.setNFTCollectionSponsor(alice, collectionId, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    await uniqueHelper.confirmNFTCollectionSponsorship(alice, collectionId);

    await expect(await uniqueHelper.getCollectionTokenNextSponsored(collectionId, token, {Substrate: alice.address})).toEqual(0);
    await uniqueHelper.transferNFTToken(bob, collectionId, token, {Substrate: alice.address});

    await expect(await uniqueHelper.getCollectionTokenNextSponsored(collectionId, token, {Substrate: alice.address})).toEqual(5);
    await uniqueHelper.transferNFTToken(alice, collectionId, token, {Substrate: bob.address});
  });
});
