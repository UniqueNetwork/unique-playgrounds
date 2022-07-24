const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Minting tests', () => {
  let uniqueHelper;
  let collection;
  let firstToken;
  let secondToken;
  let alice;
  let bob;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);

    alice = uniqueHelper.util.fromSeed(config.mainSeed);
    bob = uniqueHelper.util.fromSeed('//Bob');
    await uniqueHelper.balance.transferToSubstrate(alice, bob.address, 10n * await uniqueHelper.balance.getOneTokenNominal());

    collection = await uniqueHelper.nft.mintCollection(alice, {
      name: 'to test', description: 'to test token interface', tokenPrefix: 'ttti',
      tokenPropertyPermissions: [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]
    });
    firstToken = await collection.mintToken(alice, {Substrate: alice.address}, [{key: 'name', value: 'first token'}]);
    secondToken = await collection.mintToken(alice, {Substrate: alice.address}, [{key: 'name', value: 'second token'}]);
  });

  after(async () => {
    try {
      await uniqueHelper.disconnect();
    } catch (e) {}
  });

  it('Test getData', async() => {
    let info = await firstToken.getData();
    expect(info.properties).to.deep.eq([{key: 'name', value: 'first token'}]);

    info = await secondToken.getData();
    expect(info.properties).to.deep.eq([{key: 'name', value: 'second token'}]);
  });

  it('Test getNextSponsored', async() => {
    let nextSponsored = await firstToken.getNextSponsored({Substrate: alice.address});
    expect(nextSponsored).to.be.null;
  });

  it('Test setProperties', async() => {
    let res = await firstToken.setProperties(alice, [{key: 'name', value: 'modified first'}]);
    expect(res).to.be.true;

    let info = await firstToken.getData();
    expect(info.properties).to.deep.eq([{key: 'name', value: 'modified first'}]);
  });

  it('Test deleteProperties', async() => {
    let res = await firstToken.deleteProperties(alice, ['name']);
    expect(res).to.be.true;

    let info = await firstToken.getData();
    expect(info.properties).to.deep.eq([]);
  });

  it('Test transfer', async() => {
    let res = await secondToken.transfer(alice, {Substrate: bob.address});
    expect(res).to.be.true;

    let info = await secondToken.getData();
    expect(info.normalizedOwner).to.deep.eq({substrate: bob.address});
  });

  it('Test transferFrom', async() => {
    let res = await secondToken.transferFrom(bob, {Substrate: bob.address}, {Substrate: alice.address});
    expect(res).to.be.true;

    let info = await secondToken.getData();
    expect(info.normalizedOwner).to.deep.eq({substrate: alice.address});
  });

  it('Test nest', async() => {
    await collection.enableNesting(alice, {tokenOwner: true});

    let res = await secondToken.nest(alice, firstToken);
    expect(res).to.be.true;

    let info = await secondToken.getData();
    expect(info.normalizedOwner).to.deep.eq({ethereum: uniqueHelper.util.getNestingTokenAddress(firstToken.collectionId, firstToken.tokenId).toLocaleLowerCase()});
  });

  it('Test getTopmostOwner', async () => {
    let info = await secondToken.getData();
    expect(info.normalizedOwner).to.deep.eq({ethereum: uniqueHelper.util.getNestingTokenAddress(firstToken.collectionId, firstToken.tokenId).toLocaleLowerCase()});

    let res = await secondToken.getTopmostOwner();
    expect(res).to.deep.eq({Substrate: alice.address});
  });

  it('Test getChildren', async () => {
    let res = await firstToken.getChildren();
    expect(res).to.deep.eq([{collection: secondToken.collectionId, token: secondToken.tokenId}]);
  })

  it('Test unnest', async() => {
    let res = await secondToken.unnest(alice, firstToken, {Substrate: bob.address});
    expect(res).to.be.true;

    let info = await secondToken.getData();
    expect(info.normalizedOwner).to.deep.eq({substrate: bob.address});
  });

  it('Test burn', async() => {
    await firstToken.burn(alice);
    expect(await firstToken.getData()).to.be.null;
  });
});
