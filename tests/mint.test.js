const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');


describe('Minting tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let collectionId = null;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  afterAll(async () => {
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
    collectionId = (await uniqueHelper.mintNFTCollection(alice, collection)).collectionId;
    await expect(collectionId).not.toBeNull();
    const collectionInfo = await uniqueHelper.getCollection(collectionId);

    await expect(collectionInfo).toEqual({
      "id": collectionId,
      "name": collection.name,
      "description": collection.description,
      "normalizedOwner": alice.address,
      "tokensCount": 0,
      "admins": [],
      "raw": {
        "owner": await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address),
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
    res = await uniqueHelper.setCollectionProperties(alice, collectionId, [{key: 'first', value: 'First value'}]);
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.properties).toEqual([{key: 'first', value: 'First value'}, {key: 'is_substrate', value: 'true'}]);

    res = await uniqueHelper.setCollectionProperties(alice, collectionId, [{key: 'first', value: 'New value'}, {key: 'second', value: 'Second value'}]);
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.properties).toEqual([{key: 'first', value: 'New value'}, {key: 'is_substrate', value: 'true'}, {key: 'second', value: 'Second value'}]);
  });

  it('Delete collection properties', async() => {
    let res, info;
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.properties).toEqual([{key: 'first', value: 'New value'}, {key: 'is_substrate', value: 'true'}, {key: 'second', value: 'Second value'}]);

    res = await uniqueHelper.deleteCollectionProperties(alice, collectionId, ['first', 'second']);
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.properties).toEqual([{key: 'is_substrate', value: 'true'}]);
  });

  it('Create collection with defaults', async () => {
    let collection = {name: 'def test', description: 'def test description', tokenPrefix: 'dtst'};
    let collectionIdWithDefaults = (await uniqueHelper.mintNFTCollectionWithDefaults(alice, collection)).collectionId;
    await expect(collectionIdWithDefaults).not.toBeNull();
    const collectionInfo = await uniqueHelper.getCollection(collectionIdWithDefaults);

    await expect(collectionInfo).toEqual({
      "id": collectionIdWithDefaults,
      "name": collection.name,
      "description": collection.description,
      "normalizedOwner": alice.address,
      "tokensCount": 0,
      "admins": [],
      "raw": {
        "owner": await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address),
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
          "ownerCanTransfer": null,
          "ownerCanDestroy": null,
          "transfersEnabled": null
        },
        "properties": [],
        "tokenPropertyPermissions": []
      }
    });
  });

  it('Burn collection', async () => {
    let burnId = (await uniqueHelper.mintNFTCollection(alice, {name: 'to burn', description: 'to burn', tokenPrefix: 'brn'})).collectionId;
    let result = await uniqueHelper.burnNFTCollection(alice, burnId);
    await expect(result).toBe(true);
  });

  it('Set collection sponsor', async () => {
    let bob = uniqueHelper.util.fromSeed('//Bob');

    let result = await uniqueHelper.setNFTCollectionSponsor(alice, collectionId, bob.address);
    await expect(result).toBe(true);

    result = await uniqueHelper.confirmNFTCollectionSponsorship(bob, collectionId);
    await expect(result).toBe(true);
    try {
      await uniqueHelper.confirmNFTCollectionSponsorship(alice, collectionId, `collection #${collectionId} sponsorship`);
    }
    catch(e) {
      await expect(e.toString()).toEqual(`Error: Unable to confirm collection sponsorship for collection #${collectionId} sponsorship`)
    }
  });

  it('Set collection limits', async () => {
    let result = await uniqueHelper.setNFTCollectionLimits(alice, collectionId, {sponsorTransferTimeout: 0});
    await expect(result).toBe(true);
  });

  it('Change collection owner', async () => {
    let bob = uniqueHelper.util.fromSeed('//Bob');
    let collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 'to bob', description: 'collection from alice to bob', tokenPrefix: 'atb'})).collectionId;

    let collection = await uniqueHelper.getCollection(collectionId);
    await expect(uniqueHelper.util.normalizeSubstrateAddress(collection.raw.owner)).toEqual(alice.address);

    let result = await uniqueHelper.changeNFTCollectionOwner(alice, collectionId, bob.address);
    await expect(result).toBe(true);

    collection = await uniqueHelper.getCollection(collectionId);
    await expect(uniqueHelper.util.normalizeSubstrateAddress(collection.raw.owner)).toEqual(bob.address);
  });

  it('Add and remove collection admin', async () => {
    let bob = uniqueHelper.util.fromSeed('//Bob');
    let charlie = uniqueHelper.util.fromSeed('//Charlie');
    let result;

    await expect(await uniqueHelper.getCollectionAdmins(collectionId)).toEqual([]);

    result = await uniqueHelper.addNFTCollectionAdmin(alice, collectionId, {Substrate: bob.address});
    await expect(result).toBe(true);

    await expect(await uniqueHelper.getCollectionAdmins(collectionId)).toEqual([{Substrate: bob.address}]);

    result = await uniqueHelper.addNFTCollectionAdmin(alice, collectionId, {Substrate: charlie.address});
    await expect(result).toBe(true);

    await expect(await uniqueHelper.getCollectionAdmins(collectionId)).toEqual([{Substrate: bob.address}, {Substrate: charlie.address}]);

    result = await uniqueHelper.removeNFTCollectionAdmin(alice, collectionId, {Substrate: charlie.address});
    await expect(result).toBe(true);

    await expect(await uniqueHelper.getCollectionAdmins(collectionId)).toEqual([{Substrate: bob.address}]);

    result = await uniqueHelper.removeNFTCollectionAdmin(alice, collectionId, {Substrate: bob.address});
    await expect(result).toBe(true);

    await expect(await uniqueHelper.getCollectionAdmins(collectionId)).toEqual([]);
  });


  it('Mint token', async () => {
    const result = await uniqueHelper.mintNFTToken(alice, {collectionId, owner: alice.address, properties: [{key: 'name', value: 'Alice'}]});
    await expect(result.collectionId).toEqual(collectionId);
    await expect(result.tokenId).toEqual(1);
    const tokenData = await uniqueHelper.getToken(collectionId, result.tokenId);
    await expect(tokenData).toEqual({
      properties: [{key: 'name', value: 'Alice'}],
      owner: {
        Substrate: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)
      },
      normalizedOwner: {
        substrate: alice.address
      }
    });
  });

  it('Transfer and transferFrom token', async () => {
    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {
      name: 'to test transfer', description: 'collection to test tokens transfer', tokenPrefix: 'ttt',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]
    })).collectionId;
    await uniqueHelper.mintNFTToken(alice, {collectionId, owner: alice.address, properties: [{key: 'name', value: 'Alice'}]});
    let transferResult = await uniqueHelper.transferNFTToken(alice, collectionId, 1, {Ethereum: uniqueHelper.substrateAddressToEth(alice.address)});
    await expect(transferResult).toBe(true);
    let currentOwner = (await uniqueHelper.getToken(collectionId, 1)).normalizedOwner;
    await expect(currentOwner).toEqual({ethereum: uniqueHelper.substrateAddressToEth(alice.address).toLocaleLowerCase()});
    let transferFromResult = await uniqueHelper.transferNFTTokenFrom(alice, collectionId, 1, {Ethereum: uniqueHelper.substrateAddressToEth(alice.address)}, {Substrate: alice.address});
    await expect(transferFromResult).toBe(true);
    currentOwner = (await uniqueHelper.getToken(collectionId, 1)).normalizedOwner;
    await expect(currentOwner).toEqual({substrate: alice.address});
  });

  it('Burn token', async () => {
    const result = await uniqueHelper.burnNFTToken(alice, collectionId, 1);
    await expect(result.success).toBe(true);
    await expect(result.token.collectionId).toEqual(collectionId);
    await expect(result.token.tokenId).toEqual(1);
    await expect(uniqueHelper.util.normalizeSubstrateAddress(result.token.owner.substrate)).toEqual(alice.address);
    const tokenData = await uniqueHelper.getToken(collectionId, result.token.tokenId);
    await expect(tokenData).toBeNull();
  })

  it('Mint multiple tokens', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const result = await uniqueHelper.mintMultipleNFTTokens(alice, collectionId, [
      {owner: {substrate: bob.address}, properties: [{key: 'name', value: 'Same'}]},
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Same'}]}
    ]);
    await expect(result.length).toEqual(2);
    const expectedTokens = [{owner: bob.address, id: 2}, {owner: alice.address, id: 3}];
    for(let i = 0; i < result.length; i++) {
      let token = result[i];
      let expected = expectedTokens[i];
      await expect(token.tokenId).toEqual(expected.id);
      await expect(token.collectionId).toEqual(collectionId);

      let chainToken = await uniqueHelper.getToken(collectionId, token.tokenId);
      await expect(chainToken.properties).toEqual([{key: 'name', value: 'Same'}]);
      await expect(chainToken.normalizedOwner.substrate).toEqual(expected.owner);
    }
  });

  it('Mint multiple tokens with one owner', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const result = await uniqueHelper.mintMultipleNFTTokensWithOneOwner(alice, collectionId, bob.address,[
      {properties: [{key: 'name', value: 'Same'}]}, {properties: [{key: 'name', value: 'Same'}]}
    ]);
    await expect(result.length).toEqual(2);
    for(let i = 0; i < result.length; i++) {
      let token = result[i];
      await expect(token.tokenId).toEqual(i + 4);
      await expect(token.collectionId).toEqual(collectionId);

      let chainToken = await uniqueHelper.getToken(collectionId, token.tokenId);
      await expect(chainToken.properties).toEqual([{key: 'name', value: 'Same'}]);
      await expect(chainToken.normalizedOwner.substrate).toEqual(bob.address);
    }
  });

  it('Get collection tokens by address', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const charlie = uniqueHelper.util.fromSeed('//Charlie');
    const dave = uniqueHelper.util.fromSeed('//Dave');

    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 'test rpc tokens', description: 'test collection tokens by rpc', tokenPrefix: 'trt'})).collectionId;

    await uniqueHelper.mintMultipleNFTTokens(alice, collectionId, [
      {owner: {Substrate: alice.address}},
      {owner: {Substrate: bob.address}},
      {owner: {Substrate: charlie.address}},
      {owner: {Substrate: alice.address}}
    ]);

    const aliceTokens = await uniqueHelper.getCollectionTokensByAddress(collectionId, {Substrate: alice.address});
    await expect(aliceTokens).toEqual([1, 4]);
    const bobTokens = await uniqueHelper.getCollectionTokensByAddress(collectionId, {Substrate: bob.address});
    await expect(bobTokens).toEqual([2]);
    const daveTokens = await uniqueHelper.getCollectionTokensByAddress(collectionId, {Substrate: dave.address});
    await expect(daveTokens).toEqual([]);
  });

  it('Change token properties', async() => {
    let collectionId = (await uniqueHelper.mintNFTCollection(alice, {
      name: 'with properties', description: 'collection with properties', tokenPrefix: 'wp',
      tokenPropertyPermissions: [
        {key: 'admin', permission: {mutable: true, collectionAdmin: true, tokenOwner: false}},
        {key: 'user', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}
      ]
    })).collectionId;

    const bob = uniqueHelper.util.fromSeed('//Bob');
    await uniqueHelper.transferBalanceToSubstrateAccount(alice, bob.address, 10n * await uniqueHelper.getOneTokenNominal());

    const tokenId  = (await uniqueHelper.mintNFTToken(alice, {
      collectionId, owner: bob.address, properties: [{key: 'admin', value: 'From Alice with love'}]
    })).tokenId;

    await expect((await uniqueHelper.getToken(collectionId, tokenId)).properties).toEqual([{key: 'admin', value: 'From Alice with love'}]);

    // Bob can't change admin property
    let result = false;
    try {
      result = await uniqueHelper.setNFTTokenProperties(bob, collectionId, tokenId, [{key: 'admin', value: 'I cant change this'}]);
    }
    catch (e) {
      await expect(e.toString()).toEqual(`Error: Unable to set token properties for token #${tokenId} from collection #${collectionId}`);
    }
    await expect(result).toBe(false);
    await expect((await uniqueHelper.getToken(collectionId, tokenId)).properties).toEqual([{key: 'admin', value: 'From Alice with love'}]);

    // Bob can change user property
    result = await uniqueHelper.setNFTTokenProperties(bob, collectionId, tokenId, [{key: 'user', value: 'Thanks!'}]);
    await expect(result).toBe(true);
    await expect((await uniqueHelper.getToken(collectionId, tokenId)).properties).toEqual([
      {key: 'admin', value: 'From Alice with love'},
      {key: 'user', value: 'Thanks!'},
    ]);

    // Alice can't change user property
    result = false;
    try {
      result = await uniqueHelper.setNFTTokenProperties(alice, collectionId, tokenId, [{key: 'user', value: 'I cant change this'}]);
    }
    catch (e) {
      await expect(e.toString()).toEqual(`Error: Unable to set token properties for token #${tokenId} from collection #${collectionId}`);
    }
    await expect(result).toBe(false);
    await expect((await uniqueHelper.getToken(collectionId, tokenId)).properties).toEqual([
      {key: 'admin', value: 'From Alice with love'},
      {key: 'user', value: 'Thanks!'},
    ]);

    // Bob can change admin property
    result = await uniqueHelper.setNFTTokenProperties(alice, collectionId, tokenId, [{key: 'admin', value: 'What was the question?'}]);
    await expect(result).toBe(true);
    await expect((await uniqueHelper.getToken(collectionId, tokenId)).properties).toEqual([
      {key: 'admin', value: 'What was the question?'},
      {key: 'user', value: 'Thanks!'},
    ]);
  });

  it('Delete token properties', async () => {
    let collectionId = (await uniqueHelper.mintNFTCollection(alice, {
      name: 'with properties', description: 'collection with properties', tokenPrefix: 'wp',
      tokenPropertyPermissions: [
        {key: 'first', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
        {key: 'second', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}
      ]
    })).collectionId;

    const tokenId  = (await uniqueHelper.mintNFTToken(alice, {
      collectionId, owner: alice.address, properties: [{key: 'first', value: 'First key'}, {key: 'second', value: 'Second key'}]
    })).tokenId;

    let info = await uniqueHelper.getToken(collectionId, tokenId);
    await expect(info.properties).toEqual([{key: 'first', value: 'First key'}, {key: 'second', value: 'Second key'}]);

    let res = await uniqueHelper.deleteNFTTokenProperties(alice, collectionId, tokenId, ['first']);
    await expect(res).toBe(true);
    info = await uniqueHelper.getToken(collectionId, tokenId);
    await expect(info.properties).toEqual([{key: 'second', value: 'Second key'}]);

    res = await uniqueHelper.setNFTTokenProperties(alice, collectionId, tokenId, [{key: 'first', value: 'New first'}]);
    await expect(res).toBe(true);
    info = await uniqueHelper.getToken(collectionId, tokenId);
    await expect(info.properties).toEqual([{key: 'first', value: 'New first'}, {key: 'second', value: 'Second key'}]);

    res = await uniqueHelper.deleteNFTTokenProperties(alice, collectionId, tokenId, ['first', 'second']);
    await expect(res).toBe(true);
    info = await uniqueHelper.getToken(collectionId, tokenId);
    await expect(info.properties).toEqual([]);
  });

  it('Modify collection permissions', async() => {
    let collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 'with perms', description: 'collection with permissions', tokenPrefix: 'wp'})).collectionId;
    let info = await uniqueHelper.getCollection(collectionId), res;
    await expect(info.raw.permissions).toEqual({
      access: 'Normal',
      mintMode: false,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.setCollectionPermissions(alice, collectionId, {mintMode: true});
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.permissions).toEqual({
      access: 'Normal',
      mintMode: true,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.setCollectionPermissions(alice, collectionId, {access: 'AllowList'});
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.permissions).toEqual({
      access: 'AllowList',
      mintMode: true,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });

    res = await uniqueHelper.setCollectionPermissions(alice, collectionId, {access: 'Normal', mintMode: false});
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.permissions).toEqual({
      access: 'Normal',
      mintMode: false,
      nesting: {collectionAdmin: false, tokenOwner: false, restricted: null}
    });
  });

  it('Set tokenPropertyPermissions', async() => {
    let collectionId = (await uniqueHelper.mintNFTCollection(alice, {
      name: 'with tpp', description: 'collection with tokenPropertyPermissions', tokenPrefix: 'wtpp',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}]
    })).collectionId, info, res;
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.tokenPropertyPermissions).toEqual([
      {key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}}
    ]);

    res = await uniqueHelper.setTokenPropertyPermissions(alice, collectionId, [{key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]);
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.tokenPropertyPermissions).toEqual([
      {key: 'name', permission: {mutable: true, collectionAdmin: false, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);

    res = await uniqueHelper.setTokenPropertyPermissions(alice, collectionId, [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]);
    await expect(res).toBe(true);
    info = await uniqueHelper.getCollection(collectionId);
    await expect(info.raw.tokenPropertyPermissions).toEqual([
      {key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}},
      {key: 'owner', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}
    ]);
  });
});
