const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { subToEth } = require('../src/helpers/marketplace');
const { getConfig } = require('./config');

describe('Minting tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  const collectionOptions = {
    name: 'to test', description: 'to test collection interface', tokenPrefix: 'ttci',
    tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
  };
  let collection;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    collection = await uniqueHelper.mintNFTCollection(alice, collectionOptions);
  });

  afterAll(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test getData', async () => {
    let data = await collection.getData()
    await expect({id: collection.collectionId, name: collectionOptions.name, description: collectionOptions.description}).toEqual({name: data.name, description: data.description, id: data.id});
  });

  it('Test getAdmins', async() => {
    await expect(await collection.getAdmins()).toEqual([]);
  });

  it('Test getLastTokenId', async() => {
    await expect(await collection.getLastTokenId()).toEqual(0);
  });

  it('Test setProperties', async() => {
    let info = await collection.getData();
    await expect(info.raw.properties).toEqual([]);

    let res = await collection.setProperties(alice, [{key: 'new', value: 'new property'}]);
    await expect(res).toBe(true);
    info = await collection.getData();
    await expect(info.raw.properties).toEqual([{key: 'new', value: 'new property'}]);
  });

  it('Test deleteProperties', async() => {
    let info = await collection.getData();
    await expect(info.raw.properties).toEqual([{key: 'new', value: 'new property'}]);

    let res = await collection.deleteProperties(alice, ['new']);
    await expect(res).toBe(true);
    info = await collection.getData();
    await expect(info.raw.properties).toEqual([]);
  });

  it('Test setTokenPropertyPermissions', async() => {
    let res = await collection.setTokenPropertyPermissions(alice, [{key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]);
    await expect(res).toBe(true);
    let info = await collection.getData();
    await expect(info.raw.tokenPropertyPermissions).toEqual([
      {key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);
  });

  it('Test mintToken', async() => {
    let token = await collection.mintToken(alice, alice.address, [{key: 'name', value: 'Alice'}]);
    await expect(token.tokenId).toEqual(1);
    await expect(token.collectionId).toEqual(collection.collectionId);
    await expect((await token.getData()).normalizedOwner).toEqual({substrate: alice.address});

    await expect(await collection.getLastTokenId()).toEqual(1);
  });

  it('Test getToken', async() => {
    let token = await collection.getToken(1);
    await expect(token).toEqual({
      properties: [{key: 'name', value: 'Alice'}],
      owner: {Substrate: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)},
      normalizedOwner: {substrate: alice.address}
    });
  });

  it('Test isTokenExists', async() => {
    let existToken = await collection.isTokenExists(1);
    await expect(existToken).toBe(true);
    let nonExistToken = await collection.isTokenExists(2);
    await expect(nonExistToken).toBe(false);
  });

  it('Test transferToken', async() => {
    let result = await collection.transferToken(alice, 1, {Ethereum: subToEth(alice.address)});
    await expect(result).toBe(true);
    let currentOwner = (await collection.getToken(1)).normalizedOwner;
    await expect(currentOwner).toEqual({ethereum: subToEth(alice.address).toLocaleLowerCase()});
  });

  it('Test transferTokenFrom', async() => {
    let result = await collection.transferTokenFrom(alice, 1, {Ethereum: subToEth(alice.address)}, {Substrate: alice.address});
    await expect(result).toBe(true);
    let currentOwner = (await collection.getToken(1)).normalizedOwner;
    await expect(currentOwner).toEqual({substrate: alice.address});
  });

  it('Test burnToken', async() => {
    let token = await collection.burnToken(alice, 1);
    await expect(token).toEqual({
      success: true,
      token: {
        tokenId: 1,
        collectionId: collection.collectionId,
        owner: {substrate: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)}
      }
    });
    await expect(await collection.getLastTokenId()).toEqual(1);
  });

  it('Test setSponsor', async() => {
    let result = await collection.setSponsor(alice, alice.address);
    await expect(result).toBe(true);
    await expect((await collection.getData()).raw.sponsorship).toEqual({Unconfirmed: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)});
  });

  it('Test confirmSponsorship', async() => {
    let result = await collection.confirmSponsorship(alice);
    await expect(result).toBe(true);
    await expect((await collection.getData()).raw.sponsorship).toEqual({Confirmed: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)});
  });

  it('Test setLimits', async() => {
    let result = await collection.setLimits(alice, {sponsorTransferTimeout: 0, sponsorApproveTimeout: 0});
    await expect(result).toBe(true);
    let limits = (await collection.getData()).raw.limits;
    await expect([limits.sponsorTransferTimeout, limits.sponsorApproveTimeout]).toEqual([0, 0]);
  });

  it('Test getEffectiveLimits', async() => {
    let result = await collection.getEffectiveLimits();
    await expect(result).toEqual({
      "accountTokenOwnershipLimit": 100_000,
      "sponsoredDataSize": 2048,
      "sponsoredDataRateLimit": {
        "sponsoringDisabled": null
      },
      "tokenLimit": 4_294_967_295,
      "sponsorTransferTimeout": 0,
      "sponsorApproveTimeout": 0,
      "ownerCanTransfer": true,
      "ownerCanDestroy": true,
      "transfersEnabled": true
    });
  });

  it('Test getCollectionTokenNextSponsored', async () => {
    let bob = uniqueHelper.util.fromSeed('//Bob');
    expect(await uniqueHelper.getCollectionTokenNextSponsored(0, 0, {Substrate: alice.address})).toBeNull();

    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 't1', description: 't1', tokenPrefix: 'tst'})).collectionId;

    const collection = uniqueHelper.getCollectionObject(collectionId);

    const tokenId = (await collection.mintToken(alice, bob.address)).tokenId;

    await expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).toBeNull();

    await collection.setSponsor(alice, alice.address);
    await collection.confirmSponsorship(alice);

    await expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).toEqual(0);
    await collection.transferToken(bob, tokenId, {Substrate: alice.address});

    await expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).toBeLessThanOrEqual(5);
    await collection.transferToken(alice, tokenId, {Substrate: bob.address});

    await expect(await collection.getTokenNextSponsored(tokenId, {Substrate: bob.address})).toBeLessThanOrEqual(4);

    await expect(await collection.getTokenNextSponsored(tokenId + 1, {Substrate: bob.address})).toBeNull();

    await expect(await collection.setLimits(alice, {sponsorTransferTimeout: 2, sponsorApproveTimeout: 2})).toBeTruthy();
    await collection.transferToken(bob, tokenId, {Substrate: alice.address});

    await expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).toBeLessThanOrEqual(2);
  });

  it('Test addAdmin', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.addAdmin(alice, {Substrate: bob.address});
    await expect(result).toBe(true);
    await expect(await collection.getAdmins()).toEqual([{Substrate: bob.address}]);
  });

  it('Test removeAdmin', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.removeAdmin(alice, {Substrate: bob.address});
    await expect(result).toBe(true);
    await expect(await collection.getAdmins()).toEqual([]);
  });

  it('Test mintMultipleTokens', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.mintMultipleTokens(alice, [
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Alice'}]},
      {owner: {Substrate: bob.address}, properties: [{key: 'name', value: 'Bob'}]},
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Alice jr'}]},
    ]);
    await expect(result.map(x => ({tokenId: x.tokenId, collectionId: x.collectionId}))).toEqual([
      {
        tokenId: 2,
        collectionId: collection.collectionId,
      },
      {
        tokenId: 3,
        collectionId: collection.collectionId,
      },
      {
        tokenId: 4,
        collectionId: collection.collectionId,
      }
    ]);
    await expect(await collection.getLastTokenId()).toEqual(4);
  });

  it('Test getTokensByAddress', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const charlie = uniqueHelper.util.fromSeed('//Charlie');

    const aliceTokens = await collection.getTokensByAddress({Substrate: alice.address});
    const bobTokens = await collection.getTokensByAddress({Substrate: bob.address});
    const charlieTokens = await collection.getTokensByAddress({Substrate: charlie.address});

    await expect(aliceTokens).toEqual([2, 4]);
    await expect(bobTokens).toEqual([3]);
    await expect(charlieTokens).toEqual([]);
  })

  it('Test changeOwner', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.changeOwner(alice, bob.address);
    await expect(result).toBe(true);
    await expect((await collection.getData()).normalizedOwner).toEqual(bob.address);
  });

  it('Test burn', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.burn(bob);
    await expect(result).toBe(true);
    await expect(await collection.getData()).toBeNull();
  });
});
