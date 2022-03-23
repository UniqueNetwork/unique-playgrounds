const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { EXAMPLE_SCHEMA_JSON, EXAMPLE_DATA_BINARY } = require('./misc/schema.data');
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
      offchainSchema: 'custom',
      schemaVersion: 'Unique',
      constOnChainSchema: EXAMPLE_SCHEMA_JSON,
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
        "access": "Normal",
        "name": uniqueHelper.util.str2vec(collection.name).map(x => x.toString()),
        "description": uniqueHelper.util.str2vec(collection.description).map(x => x.toString()),
        "tokenPrefix": collection.tokenPrefix,
        "mintMode": false,
        "offchainSchema": collection.offchainSchema,
        "schemaVersion": collection.schemaVersion,
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
        "variableOnChainSchema": "",
        "constOnChainSchema": EXAMPLE_SCHEMA_JSON,
        "metaUpdatePermission": "ItemOwner"
      }
    });
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
        "access": "Normal",
        "name": uniqueHelper.util.str2vec(collection.name).map(x => x.toString()),
        "description": uniqueHelper.util.str2vec(collection.description).map(x => x.toString()),
        "tokenPrefix": collection.tokenPrefix,
        "mintMode": false,
        "offchainSchema": "",
        "schemaVersion": "ImageURL",
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
        "variableOnChainSchema": "",
        "constOnChainSchema": "",
        "metaUpdatePermission": "ItemOwner"
      }
    });
  });

  it('Burn collection', async () => {
    let burnId = (await uniqueHelper.mintNFTCollection(alice, {name: 'to burn', description: 'to burn', tokenPrefix: 'brn'})).collectionId;
    let result = await uniqueHelper.burnNFTCollection(alice, burnId);
    await expect(result).toBe(true);
  });

  it('Set collection schema version', async () => {
    let result = await uniqueHelper.setNFTCollectionSchemaVersion(alice, collectionId, 'Unique');
    expect(result).toBe(true);
    try {
      await uniqueHelper.setNFTCollectionSchemaVersion(alice, collectionId, 'NotExist', `collection #${collectionId} schemaVersion`);
    }
    catch(e) {
      await expect(e.toString()).toEqual(`Error: Unable to set collection schema version for label collection #${collectionId} schemaVersion: invalid schema version "NotExist"`)
    }
  });

  it('Set collection offchain schema', async () => {
    let result = await uniqueHelper.setNFTCollectionOffchainSchema(alice, collectionId, 'abc');
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

  it('Set collection constOnChainSchema', async () => {
    let result = await uniqueHelper.setNFTCollectionConstOnChainSchema(alice, collectionId, EXAMPLE_SCHEMA_JSON);
    await expect(result).toBe(true);
  });

  it('Set collection variableOnChainSchema', async () => {
    let result = await uniqueHelper.setNFTCollectionVariableOnChainSchema(alice, collectionId, 'abc');
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
    const result = await uniqueHelper.mintNFTToken(alice, {collectionId, owner: alice.address, constData: EXAMPLE_DATA_BINARY});
    await expect(result.success).toBe(true);
    await expect(result.token.collectionId).toEqual(collectionId);
    await expect(result.token.tokenId).toEqual(1);
    await expect(uniqueHelper.util.normalizeSubstrateAddress(result.token.owner.substrate)).toEqual(alice.address);
    const tokenData = await uniqueHelper.getToken(collectionId, result.token.tokenId);
    await expect(tokenData).toEqual({
      constData: EXAMPLE_DATA_BINARY,
      variableData: '',
      owner: {
        Substrate: await uniqueHelper.normalizeSubstrateAddressToChainFormat(alice.address)
      },
      normalizedOwner: {
        substrate: alice.address
      }
    });
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
      {owner: {substrate: bob.address}, constData: EXAMPLE_DATA_BINARY},
      {owner: {Substrate: alice.address}, constData: EXAMPLE_DATA_BINARY}
    ]);
    await expect(result.success).toBe(true);
    await expect(result.tokens.length).toEqual(2);
    const expectedTokens = [{owner: bob.address, id: 2}, {owner: alice.address, id: 3}];
    for(let i = 0; i < result.tokens.length; i++) {
      let token = result.tokens[i];
      let expected = expectedTokens[i];
      await expect(uniqueHelper.util.normalizeSubstrateAddress(token.owner.substrate)).toEqual(expected.owner);
      await expect(token.tokenId).toEqual(expected.id);
      await expect(token.collectionId).toEqual(collectionId);

      let chainToken = await uniqueHelper.getToken(collectionId, token.tokenId);
      await expect(chainToken.constData).toEqual(EXAMPLE_DATA_BINARY);
      await expect(chainToken.variableData).toEqual('');
      await expect(chainToken.normalizedOwner.substrate).toEqual(expected.owner);
    }
  });

  it('Mint multiple tokens with one owner', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const result = await uniqueHelper.mintMultipleNFTTokensWithOneOwner(alice, collectionId, bob.address,[
      {constData: EXAMPLE_DATA_BINARY}, {constData: EXAMPLE_DATA_BINARY}
    ]);
    await expect(result.success).toBe(true);
    await expect(result.tokens.length).toEqual(2);
    for(let i = 0; i < result.tokens.length; i++) {
      let token = result.tokens[i];
      await expect(uniqueHelper.util.normalizeSubstrateAddress(token.owner.substrate)).toEqual(bob.address);
      await expect(token.tokenId).toEqual(i + 4);
      await expect(token.collectionId).toEqual(collectionId);

      let chainToken = await uniqueHelper.getToken(collectionId, token.tokenId);
      await expect(chainToken.constData).toEqual(EXAMPLE_DATA_BINARY);
      await expect(chainToken.variableData).toEqual('');
      await expect(chainToken.normalizedOwner.substrate).toEqual(bob.address);
    }
  });
});
