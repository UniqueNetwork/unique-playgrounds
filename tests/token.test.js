const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Minting tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let collection;
  let firstToken;
  let secondToken;
  let alice;
  let bob;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);

    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    bob = uniqueHelper.util.fromSeed('//Bob');
    await uniqueHelper.transferBalanceToSubstrateAccount(alice, bob.address, 10n * await uniqueHelper.getOneTokenNominal());

    collection = await uniqueHelper.mintNFTCollection(alice, {
      name: 'to test', description: 'to test token interface', tokenPrefix: 'ttti',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
    });
    firstToken = await collection.mintToken(alice, {Substrate: alice.address}, [{key: 'name', value: 'first token'}]);
    secondToken = await collection.mintToken(alice, {Substrate: alice.address}, [{key: 'name', value: 'second token'}]);
  });

  afterAll(async () => {
    try {
      await uniqueHelper.disconnect();
    } catch (e) {}
  });

  it('Test getData', async() => {
    let info = await firstToken.getData();
    await expect(info.properties).toEqual([{key: 'name', value: 'first token'}]);

    info = await secondToken.getData();
    await expect(info.properties).toEqual([{key: 'name', value: 'second token'}]);
  });

  it('Test getNextSponsored', async() => {
    let nextSponsored = await firstToken.getNextSponsored({Substrate: alice.address});
    await expect(nextSponsored).toBeNull();
  });

  it('Test setProperties', async() => {
    let res = await firstToken.setProperties(alice, [{key: 'name', value: 'modified first'}]);
    await expect(res).toBe(true);

    let info = await firstToken.getData();
    await expect(info.properties).toEqual([{key: 'name', value: 'modified first'}]);
  });

  it('Test deleteProperties', async() => {
    let res = await firstToken.deleteProperties(alice, ['name']);
    await expect(res).toBe(true);

    let info = await firstToken.getData();
    await expect(info.properties).toEqual([]);
  });

  it('Test transfer', async() => {
    let res = await secondToken.transfer(alice, {Substrate: bob.address});
    await expect(res).toBe(true);

    let info = await secondToken.getData();
    await expect(info.normalizedOwner).toEqual({substrate: bob.address});
  });

  it('Test transferFrom', async() => {
    let res = await secondToken.transferFrom(bob, {Substrate: bob.address}, {Substrate: alice.address});
    await expect(res).toBe(true);

    let info = await secondToken.getData();
    await expect(info.normalizedOwner).toEqual({substrate: alice.address});
  });

  it('Test nest', async() => {
    await collection.enableNesting(alice, {tokenOwner: true});

    let res = await secondToken.nest(alice, firstToken);
    await expect(res).toBe(true);

    let info = await secondToken.getData();
    await expect(info.normalizedOwner).toEqual({ethereum: uniqueHelper.util.getNestingTokenAddress(firstToken.collectionId, firstToken.tokenId).toLocaleLowerCase()});
  });

  it('Test getTopmostOwner', async () => {
    let info = await secondToken.getData();
    await expect(info.normalizedOwner).toEqual({ethereum: uniqueHelper.util.getNestingTokenAddress(firstToken.collectionId, firstToken.tokenId).toLocaleLowerCase()});

    let res = await secondToken.getTopmostOwner();
    await expect(res).toEqual({Substrate: alice.address});
  });

  it('Test getChildren', async () => {
    let res = await firstToken.getChildren();
    await expect(res).toEqual([{collection: secondToken.collectionId, token: secondToken.tokenId}]);
  })

  it('Test unnest', async() => {
    let res = await secondToken.unnest(alice, firstToken, {Substrate: bob.address});
    await expect(res).toBe(true);

    let info = await secondToken.getData();
    await expect(info.normalizedOwner).toEqual({substrate: bob.address});
  });

  it('Test burn', async() => {
    await firstToken.burn(alice);
    await expect(await firstToken.getData()).toBeNull();
  });
});
