const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');
const { testSeedGenerator, getTestAliceSeed } = require('./misc/util');


describe('Nonfungible tests', () => {
  let uniqueHelper;
  let collectionId = null;
  let alice;
  let testSeed;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    testSeed = testSeedGenerator(uniqueHelper, __filename);
    alice = uniqueHelper.util.fromSeed(getTestAliceSeed(__filename));
    let bob = testSeed('//Bob');
    await uniqueHelper.balance.transferToSubstrate(alice, bob.address, 10n * (await uniqueHelper.balance.getOneTokenNominal()));
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Create collection', async () => {
    let collection = {
      name: 'test',
      description: 'test description',
      tokenPrefix: 'tst',
      properties: [{key: 'is_substrate', value: 'true'}],
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}],
      limits: {
        ownerCanTransfer: true
      }
    }
    collectionId = (await uniqueHelper.nft.mintCollection(alice, collection)).collectionId;
    expect(collectionId).not.to.be.null;
    const collectionInfo = await uniqueHelper.collection.getData(collectionId);

    expect(collectionInfo).to.deep.eq({
      "id": collectionId,
      "name": collection.name,
      "description": collection.description,
      "normalizedOwner": alice.address,
      "tokensCount": 0,
      "admins": [],
      "raw": {
        "owner": await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address),
        "mode": "NFT",
        "readOnly": false,
        "name": uniqueHelper.util.str2vec(collection.name).map(x => x.toString()),
        "description": uniqueHelper.util.str2vec(collection.description).map(x => x.toString()),
        "tokenPrefix": collection.tokenPrefix,
        "permissions": {
          "access": "Normal",
          "mintMode": false,
          "nesting": {
            "collectionAdmin": false,
            "restricted": null,
            "tokenOwner": false
          }
        },
        "sponsorship": "Disabled",
        "limits": {
          "accountTokenOwnershipLimit": null,
          "sponsoredDataSize": null,
          "sponsoredDataRateLimit": null,
          "tokenLimit": null,
          "sponsorTransferTimeout": null,
          "sponsorApproveTimeout": null,
          "ownerCanTransfer": collection.limits.ownerCanTransfer,
          "ownerCanDestroy": null,
          "transfersEnabled": null
        },
        "properties": [{"key": "is_substrate", "value": "true"}],
        "tokenPropertyPermissions": [{"key": "name", "permission": {"mutable": false, "collectionAdmin": true, "tokenOwner": false}}]
      }
    });
  });

  it('Set collection properties', async() => {
    let res, info;
    res = await uniqueHelper.collection.setProperties(alice, collectionId, [{key: 'first', value: 'First value'}]);
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.properties).to.deep.eq([{key: 'first', value: 'First value'}, {key: 'is_substrate', value: 'true'}]);

    res = await uniqueHelper.collection.setProperties(alice, collectionId, [{key: 'first', value: 'New value'}, {key: 'second', value: 'Second value'}]);
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.properties).to.deep.eq([{key: 'first', value: 'New value'}, {key: 'is_substrate', value: 'true'}, {key: 'second', value: 'Second value'}]);
  });

  it('Delete collection properties', async() => {
    let res, info;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.properties).to.deep.eq([{key: 'first', value: 'New value'}, {key: 'is_substrate', value: 'true'}, {key: 'second', value: 'Second value'}]);

    res = await uniqueHelper.collection.deleteProperties(alice, collectionId, ['first', 'second']);
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.properties).to.deep.eq([{key: 'is_substrate', value: 'true'}]);
  });

  it('Burn collection', async () => {
    let burnId = (await uniqueHelper.nft.mintCollection(alice, {name: 'to burn', description: 'to burn', tokenPrefix: 'brn'})).collectionId;
    let result = await uniqueHelper.collection.burn(alice, burnId);
    expect(result).to.be.true;
  });

  it('Set collection sponsor', async () => {
    let bob = testSeed('//Bob');

    let result = await uniqueHelper.collection.setSponsor(alice, collectionId, bob.address);
    expect(result).to.be.true;

    result = await uniqueHelper.collection.confirmSponsorship(bob, collectionId);
    expect(result).to.be.true;
    try {
      await uniqueHelper.collection.confirmSponsorship(alice, collectionId, `collection #${collectionId} sponsorship`);
    }
    catch(e) {
      expect(e.toString()).to.eq(`Error: Unable to confirm collection sponsorship for collection #${collectionId} sponsorship`)
    }
  });

  it('Set collection limits', async () => {
    let result = await uniqueHelper.collection.setLimits(alice, collectionId, {sponsorTransferTimeout: 0});
    expect(result).to.be.true;
  });

  it('Change collection owner', async () => {
    let bob = testSeed('//Bob');
    let collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 'to bob', description: 'collection from alice to bob', tokenPrefix: 'atb'})).collectionId;

    let collection = await uniqueHelper.collection.getData(collectionId);
    expect(uniqueHelper.util.normalizeSubstrateAddress(collection.raw.owner)).to.eq(alice.address);

    let result = await uniqueHelper.collection.changeOwner(alice, collectionId, bob.address);
    expect(result).to.be.true;

    collection = await uniqueHelper.collection.getData(collectionId);
    expect(uniqueHelper.util.normalizeSubstrateAddress(collection.raw.owner)).to.eq(bob.address);
  });

  it('Add and remove collection admin', async () => {
    let bob = testSeed('//Bob');
    let charlie = testSeed('//Charlie');
    let result;

    expect(await uniqueHelper.collection.getAdmins(collectionId)).to.deep.eq([]);

    result = await uniqueHelper.collection.addAdmin(alice, collectionId, {Substrate: bob.address});
    expect(result).to.be.true;

    expect(await uniqueHelper.collection.getAdmins(collectionId)).to.deep.eq([{Substrate: bob.address}]);

    result = await uniqueHelper.collection.addAdmin(alice, collectionId, {Substrate: charlie.address});
    expect(result).to.be.true;

    expect(await uniqueHelper.collection.getAdmins(collectionId)).to.deep.eq([{Substrate: bob.address}, {Substrate: charlie.address}]);

    result = await uniqueHelper.collection.removeAdmin(alice, collectionId, {Substrate: charlie.address});
    expect(result).to.be.true;

    expect(await uniqueHelper.collection.getAdmins(collectionId)).to.deep.eq([{Substrate: bob.address}]);

    result = await uniqueHelper.collection.removeAdmin(alice, collectionId, {Substrate: bob.address});
    expect(result).to.be.true;

    expect(await uniqueHelper.collection.getAdmins(collectionId)).to.deep.eq([]);
  });


  it('Mint token', async () => {
    const result = await uniqueHelper.nft.mintToken(alice, {collectionId, owner: alice.address, properties: [{key: 'name', value: 'Alice'}]});
    expect(result.collectionId).to.eq(collectionId);
    expect(result.tokenId).to.eq(1);
    const tokenData = await uniqueHelper.nft.getToken(collectionId, result.tokenId);
    expect(tokenData).to.deep.eq({
      properties: [{key: 'name', value: 'Alice'}],
      owner: {
        Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)
      },
      normalizedOwner: {
        substrate: alice.address
      }
    });
  });

  it('Transfer and transferFrom token', async () => {
    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'to test transfer', description: 'collection to test tokens transfer', tokenPrefix: 'ttt',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]
    })).collectionId;
    await uniqueHelper.nft.mintToken(alice, {collectionId, owner: alice.address, properties: [{key: 'name', value: 'Alice'}]});
    let transferResult = await uniqueHelper.nft.transferToken(alice, collectionId, 1, {Ethereum: uniqueHelper.address.substrateToEth(alice.address)});
    expect(transferResult).to.be.true;
    let currentOwner = (await uniqueHelper.nft.getToken(collectionId, 1)).normalizedOwner;
    expect(currentOwner).to.deep.eq({ethereum: uniqueHelper.address.substrateToEth(alice.address).toLocaleLowerCase()});
    let transferFromResult = await uniqueHelper.nft.transferTokenFrom(alice, collectionId, 1, {Ethereum: uniqueHelper.address.substrateToEth(alice.address)}, {Substrate: alice.address});
    expect(transferFromResult).to.be.true;
    currentOwner = (await uniqueHelper.nft.getToken(collectionId, 1)).normalizedOwner;
    expect(currentOwner).to.deep.eq({substrate: alice.address});
  });

  it('Burn token', async () => {
    const result = await uniqueHelper.nft.burnToken(alice, collectionId, 1);
    expect(result.success).to.be.true;
    expect(result.token.collectionId).to.eq(collectionId);
    expect(result.token.tokenId).to.eq(1);
    expect(uniqueHelper.util.normalizeSubstrateAddress(result.token.owner.substrate)).to.eq(alice.address);
    const tokenData = await uniqueHelper.nft.getToken(collectionId, result.token.tokenId);
    expect(tokenData).to.be.null;
  })

  it('Mint multiple tokens', async () => {
    const bob = testSeed('//Bob');
    const result = await uniqueHelper.nft.mintMultipleTokens(alice, collectionId, [
      {owner: {substrate: bob.address}, properties: [{key: 'name', value: 'Same'}]},
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Same'}]}
    ]);
    expect(result.length).to.eq(2);
    const expectedTokens = [{owner: bob.address, id: 2}, {owner: alice.address, id: 3}];
    for(let i = 0; i < result.length; i++) {
      let token = result[i];
      let expected = expectedTokens[i];
      expect(token.tokenId).to.eq(expected.id);
      expect(token.collectionId).to.eq(collectionId);

      let chainToken = await uniqueHelper.nft.getToken(collectionId, token.tokenId);
      expect(chainToken.properties).to.deep.eq([{key: 'name', value: 'Same'}]);
      expect(chainToken.normalizedOwner.substrate).to.eq(expected.owner);
    }
  });

  it('Mint multiple tokens with one owner', async () => {
    const bob = testSeed('//Bob');
    const result = await uniqueHelper.nft.mintMultipleTokensWithOneOwner(alice, collectionId, bob.address,[
      {properties: [{key: 'name', value: 'Same'}]}, {properties: [{key: 'name', value: 'Same'}]}
    ]);
    expect(result.length).to.eq(2);
    for(let i = 0; i < result.length; i++) {
      let token = result[i];
      expect(token.tokenId).to.eq(i + 4);
      expect(token.collectionId).to.eq(collectionId);

      let chainToken = await uniqueHelper.nft.getToken(collectionId, token.tokenId);
      expect(chainToken.properties).to.deep.eq([{key: 'name', value: 'Same'}]);
      expect(chainToken.normalizedOwner.substrate).to.eq(bob.address);
    }
  });

  it('Get collection tokens by address', async () => {
    const bob = testSeed('//Bob');
    const charlie = testSeed('//Charlie');
    const dave = testSeed('//Dave');

    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 'test rpc tokens', description: 'test collection tokens by rpc', tokenPrefix: 'trt'})).collectionId;

    await uniqueHelper.nft.mintMultipleTokens(alice, collectionId, [
      {owner: {Substrate: alice.address}},
      {owner: {Substrate: bob.address}},
      {owner: {Substrate: charlie.address}},
      {owner: {Substrate: alice.address}}
    ]);

    const aliceTokens = await uniqueHelper.nft.getTokensByAddress(collectionId, {Substrate: alice.address});
    expect(aliceTokens).to.deep.eq([1, 4]);
    const bobTokens = await uniqueHelper.nft.getTokensByAddress(collectionId, {Substrate: bob.address});
    expect(bobTokens).to.deep.eq([2]);
    const daveTokens = await uniqueHelper.nft.getTokensByAddress(collectionId, {Substrate: dave.address});
    expect(daveTokens).to.deep.eq([]);
  });

  it('Change token properties', async() => {
    let collectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'with properties', description: 'collection with properties', tokenPrefix: 'wp',
      tokenPropertyPermissions: [
        {key: 'admin', permission: {mutable: true, collectionAdmin: true, tokenOwner: false}},
        {key: 'user', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}
      ]
    })).collectionId;

    const bob = testSeed('//Bob');
    await uniqueHelper.balance.transferToSubstrate(alice, bob.address, 10n * await uniqueHelper.balance.getOneTokenNominal());

    const tokenId  = (await uniqueHelper.nft.mintToken(alice, {
      collectionId, owner: bob.address, properties: [{key: 'admin', value: 'From Alice with love'}]
    })).tokenId;

    expect((await uniqueHelper.nft.getToken(collectionId, tokenId)).properties).to.deep.eq([{key: 'admin', value: 'From Alice with love'}]);

    // Bob can't change admin property
    let result = false;
    try {
      result = await uniqueHelper.nft.setTokenProperties(bob, collectionId, tokenId, [{key: 'admin', value: 'I cant change this'}]);
    }
    catch (e) {
      expect(e.toString()).to.eq(`Error: Unable to set token properties for token #${tokenId} from collection #${collectionId}`);
    }
    expect(result).to.be.false;
    expect((await uniqueHelper.nft.getToken(collectionId, tokenId)).properties).to.deep.eq([{key: 'admin', value: 'From Alice with love'}]);

    // Bob can change user property
    result = await uniqueHelper.nft.setTokenProperties(bob, collectionId, tokenId, [{key: 'user', value: 'Thanks!'}]);
    expect(result).to.be.true;
    expect((await uniqueHelper.nft.getToken(collectionId, tokenId)).properties).to.deep.eq([
      {key: 'admin', value: 'From Alice with love'},
      {key: 'user', value: 'Thanks!'},
    ]);

    // Alice can't change user property
    result = false;
    try {
      result = await uniqueHelper.nft.setTokenProperties(alice, collectionId, tokenId, [{key: 'user', value: 'I cant change this'}]);
    }
    catch (e) {
      expect(e.toString()).to.eq(`Error: Unable to set token properties for token #${tokenId} from collection #${collectionId}`);
    }
    expect(result).to.be.false;
    expect((await uniqueHelper.nft.getToken(collectionId, tokenId)).properties).to.deep.eq([
      {key: 'admin', value: 'From Alice with love'},
      {key: 'user', value: 'Thanks!'},
    ]);

    // Bob can change admin property
    result = await uniqueHelper.nft.setTokenProperties(alice, collectionId, tokenId, [{key: 'admin', value: 'What was the question?'}]);
    expect(result).to.be.true;
    expect((await uniqueHelper.nft.getToken(collectionId, tokenId)).properties).to.deep.eq([
      {key: 'admin', value: 'What was the question?'},
      {key: 'user', value: 'Thanks!'},
    ]);
  });

  it('Delete token properties', async () => {
    let collectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'with properties', description: 'collection with properties', tokenPrefix: 'wp',
      tokenPropertyPermissions: [
        {key: 'first', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
        {key: 'second', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}
      ]
    })).collectionId;

    const tokenId  = (await uniqueHelper.nft.mintToken(alice, {
      collectionId, owner: alice.address, properties: [{key: 'first', value: 'First key'}, {key: 'second', value: 'Second key'}]
    })).tokenId;

    let info = await uniqueHelper.nft.getToken(collectionId, tokenId);
    expect(info.properties).to.deep.eq([{key: 'first', value: 'First key'}, {key: 'second', value: 'Second key'}]);

    let res = await uniqueHelper.nft.deleteTokenProperties(alice, collectionId, tokenId, ['first']);
    expect(res).to.be.true;
    info = await uniqueHelper.nft.getToken(collectionId, tokenId);
    expect(info.properties).to.deep.eq([{key: 'second', value: 'Second key'}]);

    res = await uniqueHelper.nft.setTokenProperties(alice, collectionId, tokenId, [{key: 'first', value: 'New first'}]);
    expect(res).to.be.true;
    info = await uniqueHelper.nft.getToken(collectionId, tokenId);
    expect(info.properties).to.deep.eq([{key: 'first', value: 'New first'}, {key: 'second', value: 'Second key'}]);

    res = await uniqueHelper.nft.deleteTokenProperties(alice, collectionId, tokenId, ['first', 'second']);
    expect(res).to.be.true;
    info = await uniqueHelper.nft.getToken(collectionId, tokenId);
    expect(info.properties).to.deep.eq([]);
  });

  it('Modify collection permissions', async() => {
    let collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 'with perms', description: 'collection with permissions', tokenPrefix: 'wp'})).collectionId;
    let info = await uniqueHelper.collection.getData(collectionId), res;
    expect(info.raw.permissions).to.deep.eq({
      access: 'Normal',
      mintMode: false,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.collection.setPermissions(alice, collectionId, {mintMode: true});
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.permissions).to.deep.eq({
      access: 'Normal',
      mintMode: true,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.collection.setPermissions(alice, collectionId, {access: 'AllowList'});
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.permissions).to.deep.eq({
      access: 'AllowList',
      mintMode: true,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.collection.setPermissions(alice, collectionId, {access: 'Normal', mintMode: false});
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.permissions).to.deep.eq({
      access: 'Normal',
      mintMode: false,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });
  });

  it('Set tokenPropertyPermissions', async() => {
    let collectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'with tpp', description: 'collection with tokenPropertyPermissions', tokenPrefix: 'wtpp',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}]
    })).collectionId, info, res;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.tokenPropertyPermissions).to.deep.eq([
      {key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}
    ]);

    res = await uniqueHelper.nft.setTokenPropertyPermissions(alice, collectionId, [{key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]);
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.tokenPropertyPermissions).to.deep.eq([
      {key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);

    res = await uniqueHelper.nft.setTokenPropertyPermissions(alice, collectionId, [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]);
    expect(res).to.be.true;
    info = await uniqueHelper.collection.getData(collectionId);
    expect(info.raw.tokenPropertyPermissions).to.deep.eq([
      {key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);
  });
});
