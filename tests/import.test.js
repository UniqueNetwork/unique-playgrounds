const fs = require('fs');

const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { UniqueExporter } = require('../src/helpers/export');
const { UniqueImporter } = require('../src/helpers/import');
const { getConfig } = require('./config');
const { TMPDir } = require('./misc/util');

describe('Import helper tests', () => {
  let uniqueHelper;
  let importer;
  let exporter;
  let collectionId;
  let tmpDir;
  let alice;

  const createCollection = async () => {
    const dave = uniqueHelper.util.fromSeed('//Dave');
    collectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'to import', description: 'collection id to import', tokenPrefix: 'imp',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]
    })).collectionId;
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const charlie = uniqueHelper.util.fromSeed('//Charlie');
    await uniqueHelper.nft.mintMultipleTokens(alice, collectionId, [
      {owner: {substrate: bob.address}, properties: [{key: 'name', value: 'Bob'}]},
      {owner: {Substrate: alice.address}, properties: [{key: 'name', value: 'Alice'}]}
    ]);
    const toBurn = await uniqueHelper.nft.mintToken(alice, {collectionId, owner: alice.address});
    await toBurn.burn(alice);
    await uniqueHelper.nft.mintToken(alice, {collectionId, owner: charlie.address, properties: [{key: 'name', value: 'Charlie'}]});
    await uniqueHelper.collection.addAdmin(alice, collectionId, {Substrate: dave.address});
    await uniqueHelper.collection.changeOwner(alice, collectionId, bob.address);
  }

  const expectedState = {
    is_burned: false,
    is_created: true,
    has_properties: true,
    has_token_property_permissions: true,
    has_limits: true,
    has_sponsorship: true,
    changed_ownership: false
  }

  before(async () => {
    const config = getConfig();
    tmpDir = new TMPDir();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    const logger = new loggerCls();
    uniqueHelper = new UniqueHelper(logger);
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    importer = new UniqueImporter(alice, uniqueHelper, tmpDir.path, logger);
    exporter = new UniqueExporter(uniqueHelper, tmpDir.path, logger);
    await createCollection();
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Import to new collection', async () => {
    let collectionData = await exporter.genCollectionData(collectionId);
    let tokens = await exporter.getAllTokens(collectionData);

    let stateFile = importer.getStateFilename(collectionData.id);
    expect(fs.existsSync(stateFile)).to.be.false;

    await importer.createCollection(collectionData);

    let state = JSON.parse(fs.readFileSync(stateFile).toString());
    expect(state).to.deep.eq({
      ...expectedState,
      id: state.id,
      created_tokens: []
    });

    let collection = await exporter.genCollectionData(state.id);
    expect({...collectionData.raw, owner: await uniqueHelper.address.normalizeSubstrateToChainFormat(alice.address)}).to.deep.eq({...collection.raw});

    await importer.createTokens(collectionData, tokens);

    collection = await exporter.genCollectionData(state.id);
    let newTokens = await exporter.getAllTokens(collection);

    expect(newTokens).to.deep.eq(tokens);

    state = JSON.parse(fs.readFileSync(stateFile).toString());
    expect(state).to.deep.eq({
      ...expectedState,
      id: state.id,
      created_tokens: [1, 2, 3, 4]
    });

    await importer.changeOwnership(collectionData);

    collection = await exporter.genCollectionData(state.id);
    expect(collection.raw).to.deep.eq(collectionData.raw);
    expect(collection.admins).to.deep.eq(collectionData.admins);
    expect(collection.owner).to.deep.eq(collectionData.owner);

    state = JSON.parse(fs.readFileSync(stateFile).toString());
    expect(state).to.deep.eq({
      ...expectedState,
      id: state.id,
      created_tokens: [1, 2, 3, 4],
      changed_ownership: true
    });
  });

  it('Import to existed collection (Only collection)', async () => {
    let collectionData = await exporter.genCollectionData(collectionId);

    let existedCollectionId = (await uniqueHelper.nft.mintCollection(alice, {
      name: 'existed to import', description: 'existed collection id to import', tokenPrefix: 'eimp',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: false, collectionAdmin: true, tokenOwner: false}}]
    })).collectionId;

    let stateFile = importer.getStateFilename(collectionData.id);
    fs.writeFileSync(stateFile, JSON.stringify({
      id: existedCollectionId,
      is_burned: false,
      is_created: true,
      has_properties: true,
      has_token_property_permissions: true,
      has_limits: true,
      has_sponsorship: true,
      created_tokens: [],
      changed_ownership: false
    }, null, 2));

    await importer.createCollection(collectionData);

    let state = JSON.parse(fs.readFileSync(stateFile).toString());
    expect(state).to.deep.eq({
      ...expectedState,
      id: existedCollectionId,
      created_tokens: []
    });
  });

});
