const fs = require('fs');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { UniqueExporter } = require('../src/helpers/export');
const { getConfig } = require('./config');
const { TMPDir } = require('./misc/util');


describe('Export helper tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let logger;
  let exporter;
  let collectionId = null;
  let tmpDir;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    tmpDir = new TMPDir();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    logger = new loggerCls();
    uniqueHelper = new UniqueHelper(logger);
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    exporter = new UniqueExporter(uniqueHelper, tmpDir.path, logger);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  afterAll(async () => {
    tmpDir.remove();
    await uniqueHelper.disconnect();
  });

  it('Export token owners by blockNumber', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    let collection = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'test', description: 'test', tokenPrefix: 'tst',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
    }));
    await collection.mintToken(alice, alice.address, [{key: 'name', value: 'alice token'}]);
    const lastBlockAfterMint = await uniqueHelper.chain.getLatestBlockNumber();
    const collectionData = await exporter.genCollectionData(collection.collectionId);

    let tokens = await exporter.getAllTokens(collectionData);
    const aliceTokenData = {
      tokenId: 1,
      owner: {substrate: alice.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)},
      properties: [{key: 'name', value: 'alice token'}]
    };
    await expect(tokens).toEqual([aliceTokenData]);

    // Make changes
    await collection.setTokenProperties(alice, 1, [{key: 'name', value: 'bob token'}]);
    await collection.transferToken(alice, 1, {Substrate: bob.address});

    tokens = await exporter.getAllTokens(collectionData);
    await expect(tokens).toEqual([{
      tokenId: 1,
      owner: {substrate: bob.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(bob.address)},
      properties: [{key: 'name', value: 'bob token'}]
    }]);

    // Get state before changes
    let newExporter = new UniqueExporter(uniqueHelper, tmpDir.path, logger, await uniqueHelper.chain.getBlockHashByNumber(lastBlockAfterMint));
    tokens = await newExporter.getAllTokens(collectionData);
    await expect(tokens).toEqual([aliceTokenData]);
  });

  it('Export collection', async () => {
    const collection = {
      name: 'export',
      description: 'collection to export',
      tokenPrefix: 'exp',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
    };
    collectionId = (await uniqueHelper.nft.mintCollection(alice, collection)).collectionId;
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const charlie = uniqueHelper.util.fromSeed('//Charlie');
    const dave = uniqueHelper.util.fromSeed('//Dave');

    await uniqueHelper.nft.mintMultipleTokens(alice, collectionId, [
      {owner: {substrate: alice.address}, properties: [{key: 'name', value: 'alice token'}]},
      {owner: {Substrate: bob.address}, properties: [{key: 'name', value: 'bob token'}]},
      {owner: {Substrate: charlie.address}, properties: [{key: 'name', value: 'charlie token'}]},
      {owner: {Substrate: dave.address}, properties: [{key: 'name', value: 'dave token'}]}
    ]);

    let collectionData = await exporter.genCollectionData(collectionId);

    const expectedCollectionInfo = {
      "id": collectionId,
      "name": collection.name,
      "description": collection.description,
      "normalizedOwner": alice.address,
      "tokensCount": 4,
      "admins": [],
      "raw": {
        "owner": await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address),
        "mode": "NFT",
        "readOnly": false,
        "name": uniqueHelper.util.str2vec(collection.name).map(x => x.toString()),
        "description": uniqueHelper.util.str2vec(collection.description).map(x => x.toString()),
        "tokenPrefix": collection.tokenPrefix,
        "sponsorship": "Disabled",
        "permissions": {
          "access": "Normal",
          "mintMode": false,
          "nesting": {
            "collectionAdmin": false,
            "restricted": null,
            "tokenOwner": false
          }
        },
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
        "tokenPropertyPermissions": [{"key": "name", "permission": {"mutable": true, "collectionAdmin": true, "tokenOwner": true}}]
      }
    }

    await expect(collectionData).toEqual(expectedCollectionInfo);
    const tokens = await exporter.getAllTokens(collectionData);
    const expectedTokens = [
      {
        tokenId: 1,
        owner: {substrate: alice.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)},
        properties: [{key: 'name', value: 'alice token'}]
      },
      {
        tokenId: 2,
        owner: {substrate: bob.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(bob.address)},
        properties: [{key: 'name', value: 'bob token'}]
      },
      {
        tokenId: 3,
        owner: {substrate: charlie.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(charlie.address)},
        properties: [{key: 'name', value: 'charlie token'}]
      },
      {
        tokenId: 4,
        owner: {substrate: dave.address}, chainOwner: {Substrate: await uniqueHelper.address.normalizeSubstrateToChainFormat(dave.address)},
        properties: [{key: 'name', value: 'dave token'}]
      },
    ];
    await expect(tokens).toEqual(expectedTokens);

    await exporter.export(collectionId, true);

    let fileCollectionData = JSON.parse(fs.readFileSync(exporter.getCollectionFilename(collectionId)).toString());
    await expect(fileCollectionData).toEqual(expectedCollectionInfo);

    let fileTokensData = JSON.parse(fs.readFileSync(exporter.getTokensFilename(collectionId)).toString());
    await expect(fileTokensData).toEqual(expectedTokens);
  })
});
