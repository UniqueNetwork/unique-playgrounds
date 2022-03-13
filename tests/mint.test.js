const { UniqueHelper } = require('../src/lib/unique');
const { EXAMPLE_SCHEMA_JSON, EXAMPLE_DATA_BINARY } = require('./misc/schema.data');
const { getConfig } = require('../src/config');

describe('Minting tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let collectionId = null;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    uniqueHelper = new UniqueHelper();
    await uniqueHelper.connect(config.testing.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.testing.mainSeed);
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
    collectionId = await uniqueHelper.mintNFTCollection(alice, collection);
    await expect(collectionId).not.toBeNull();
    const collectionInfo = await uniqueHelper.getCollection(collectionId);

    await expect(collectionInfo).toEqual({
      "id": collectionId,
      "name": collection.name,
      "description": collection.description,
      "tokensCount": 0,
      "admins": [],
      "raw": {
        "owner": alice.address,
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
    let collectionIdWithDefaults = await uniqueHelper.mintNFTCollectionWithDefaults(alice, collection);
    await expect(collectionIdWithDefaults).not.toBeNull();
    const collectionInfo = await uniqueHelper.getCollection(collectionIdWithDefaults);

    await expect(collectionInfo).toEqual({
      "id": collectionIdWithDefaults,
      "name": collection.name,
      "description": collection.description,
      "tokensCount": 0,
      "admins": [],
      "raw": {
        "owner": alice.address,
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
  })

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
      await expect(chainToken.owner.substrate).toEqual(expected.owner);
    }
  });

  it('Mint multiple tokens with different owners', async () => {
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
      await expect(chainToken.owner.substrate).toEqual(bob.address);
    }
  });
});
