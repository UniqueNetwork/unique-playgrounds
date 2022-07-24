const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Minting tests', () => {
  let uniqueHelper;
  const collectionOptions = {
    name: 'to test', description: 'to test collection interface', tokenPrefix: 'ttci',
    tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
  };
  let collection;
  let alice;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    collection = await uniqueHelper.nft.mintCollection(alice, collectionOptions);
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test getData', async () => {
    let data = await collection.getData()
    expect({id: collection.collectionId, name: collectionOptions.name, description: collectionOptions.description}).to.deep.eq({name: data.name, description: data.description, id: data.id});
  });

  it('Test getAdmins', async() => {
    expect(await collection.getAdmins()).to.deep.eq([]);
  });

  it('Test getLastTokenId', async() => {
    expect(await collection.getLastTokenId()).to.eq(0);
  });

  it('Test setProperties', async() => {
    let info = await collection.getData();
    expect(info.raw.properties).to.deep.eq([]);

    let res = await collection.setProperties(alice, [{key: 'new', value: 'new property'}]);
    expect(res).to.be.true;
    info = await collection.getData();
    expect(info.raw.properties).to.deep.eq([{key: 'new', value: 'new property'}]);
  });

  it('Test deleteProperties', async() => {
    let info = await collection.getData();
    expect(info.raw.properties).to.deep.eq([{key: 'new', value: 'new property'}]);

    let res = await collection.deleteProperties(alice, ['new']);
    expect(res).to.be.true;
    info = await collection.getData();
    expect(info.raw.properties).to.deep.eq([]);
  });

  it('Test setTokenPropertyPermissions', async() => {
    let res = await collection.setTokenPropertyPermissions(alice, [{key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]);
    expect(res).to.be.true;
    let info = await collection.getData();
    expect(info.raw.tokenPropertyPermissions).to.deep.eq([
      {key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);
  });

  it('Test mintToken', async() => {
    let token = await collection.mintToken(alice, alice.address, [{key: 'name', value: 'Alice'}]);
    expect(token.tokenId).to.eq(1);
    expect(token.collectionId).to.eq(collection.collectionId);
    expect((await token.getData()).normalizedOwner).to.deep.eq({substrate: alice.address});

    expect(await collection.getLastTokenId()).to.eq(1);
  });

  it('Test getToken', async() => {
    let token = await collection.getToken(1);
    expect(token).to.deep.eq({
      properties: [{key: 'name', value: 'Alice'}],
      owner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)},
      normalizedOwner: {substrate: alice.address}
    });
  });

  it('Test isTokenExists', async() => {
    let existToken = await collection.isTokenExists(1);
    expect(existToken).to.be.true;
    let nonExistToken = await collection.isTokenExists(2);
    expect(nonExistToken).to.be.false;
  });

  it('Test transferToken', async() => {
    let result = await collection.transferToken(alice, 1, {Ethereum: uniqueHelper.address.substrateToEth(alice.address)});
    expect(result).to.be.true;
    let currentOwner = (await collection.getToken(1)).normalizedOwner;
    expect(currentOwner).to.deep.eq({ethereum: uniqueHelper.address.substrateToEth(alice.address).toLocaleLowerCase()});
  });

  it('Test transferTokenFrom', async() => {
    let result = await collection.transferTokenFrom(alice, 1, {Ethereum: uniqueHelper.address.substrateToEth(alice.address)}, {Substrate: alice.address});
    expect(result).to.be.true;
    let currentOwner = (await collection.getToken(1)).normalizedOwner;
    expect(currentOwner).to.deep.eq({substrate: alice.address});
  });

  it('Test burnToken', async() => {
    let token = await collection.burnToken(alice, 1);
    expect(token).to.deep.eq({
      success: true,
      token: {
        tokenId: 1,
        collectionId: collection.collectionId,
        owner: {substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)}
      }
    });
    expect(await collection.getLastTokenId()).to.eq(1);
  });

  it('Test setSponsor', async() => {
    let result = await collection.setSponsor(alice, alice.address);
    expect(result).to.be.true;
    expect((await collection.getData()).raw.sponsorship).to.deep.eq({Unconfirmed: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)});
  });

  it('Test confirmSponsorship', async() => {
    let result = await collection.confirmSponsorship(alice);
    expect(result).to.be.true;
    expect((await collection.getData()).raw.sponsorship).to.deep.eq({Confirmed: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)});
  });

  it('Test setLimits', async() => {
    let result = await collection.setLimits(alice, {sponsorTransferTimeout: 0, sponsorApproveTimeout: 0});
    expect(result).to.be.true;
    let limits = (await collection.getData()).raw.limits;
    expect([limits.sponsorTransferTimeout, limits.sponsorApproveTimeout]).to.deep.eq([0, 0]);
  });

  it('Test getEffectiveLimits', async() => {
    let result = await collection.getEffectiveLimits();
    expect(result).to.deep.eq({
      "accountTokenOwnershipLimit": 100_000,
      "sponsoredDataSize": 2048,
      "sponsoredDataRateLimit": {
        "sponsoringDisabled": null
      },
      "tokenLimit": 4_294_967_295,
      "sponsorTransferTimeout": 0,
      "sponsorApproveTimeout": 0,
      "ownerCanTransfer": false,
      "ownerCanDestroy": true,
      "transfersEnabled": true
    });
  });

  it('Test getCollectionTokenNextSponsored', async () => {
    let bob = uniqueHelper.util.fromSeed('//Bob');
    expect(await uniqueHelper.collection.getTokenNextSponsored(0, 0, {Substrate: alice.address})).to.be.null;

    const collection = await uniqueHelper.nft.mintCollection(alice, {name: 't1', description: 't1', tokenPrefix: 'tst'});

    const tokenId = (await collection.mintToken(alice, bob.address)).tokenId;

    expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).to.be.null;

    await collection.setSponsor(alice, alice.address);
    await collection.confirmSponsorship(alice);

    expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).to.eq(0);
    await collection.transferToken(bob, tokenId, {Substrate: alice.address});

    expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).to.lte(5);
    await collection.transferToken(alice, tokenId, {Substrate: bob.address});

    expect(await collection.getTokenNextSponsored(tokenId, {Substrate: bob.address})).to.lte(4);

    expect(await collection.getTokenNextSponsored(tokenId + 1, {Substrate: bob.address})).to.be.null;

    expect(await collection.setLimits(alice, {sponsorTransferTimeout: 2, sponsorApproveTimeout: 2})).to.be.true;
    await collection.transferToken(bob, tokenId, {Substrate: alice.address});

    expect(await collection.getTokenNextSponsored(tokenId, {Substrate: alice.address})).to.lte(2);
  });

  it('Test addAdmin', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.addAdmin(alice, {Substrate: bob.address});
    expect(result).to.be.true;
    expect(await collection.getAdmins()).to.deep.eq([{Substrate: bob.address}]);
  });

  it('Test removeAdmin', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.removeAdmin(alice, {Substrate: bob.address});
    expect(result).to.be.true;
    expect(await collection.getAdmins()).to.deep.eq([]);
  });

  it('Test mintMultipleTokens', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.mintMultipleTokens(alice, [
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Alice'}]},
      {owner: {Substrate: bob.address}, properties: [{key: 'name', value: 'Bob'}]},
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Alice jr'}]},
    ]);
    expect(result.map(x => ({tokenId: x.tokenId, collectionId: x.collectionId}))).to.deep.eq([
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
    expect(await collection.getLastTokenId()).to.eq(4);
  });

  it('Test getTokensByAddress', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const charlie = uniqueHelper.util.fromSeed('//Charlie');

    const aliceTokens = await collection.getTokensByAddress({Substrate: alice.address});
    const bobTokens = await collection.getTokensByAddress({Substrate: bob.address});
    const charlieTokens = await collection.getTokensByAddress({Substrate: charlie.address});

    expect(aliceTokens).to.deep.eq([2, 4]);
    expect(bobTokens).to.deep.eq([3]);
    expect(charlieTokens).to.deep.eq([]);
  })

  it('Test changeOwner', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = await collection.changeOwner(alice, bob.address);
    expect(result).to.be.true;
    expect((await collection.getData()).normalizedOwner).to.eq(bob.address);
  });

  it('Test burn (empty collection)', async() => {
    const collectionToBurn = await uniqueHelper.nft.mintCollection(alice, collectionOptions)
    let result = await collectionToBurn.burn(alice);
    expect(result).to.be.true;
    expect(await collectionToBurn.getData()).to.be.null;
  });

  it('Test burn (full collection)', async() => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let result = false;
    try {
      result = await collection.burn(bob);
    }
    catch(e) {
      expect(e.toString()).to.eq(`Error: Unable to burn collection for collection #${collection.collectionId}`);
    }
    expect(result).to.be.false;
    expect(await collection.getData()).not.to.be.null;
  });
});
