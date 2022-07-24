const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');
const { testSeedGenerator, getTestAliceSeed } = require('./misc/util');

describe('Nesting tests', () => {
  let uniqueHelper;
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
  });

  after(async () => {
    try {
      await uniqueHelper.disconnect();
    } catch (e) {}
  });

  it('Test nesting addresses', () => {
    const firstToken = uniqueHelper.util.getNestingTokenAddress(1, 1);
    expect(firstToken).to.eq('0xF8238ccFFF8ED887463Fd5e00000000100000001');
    const secondToken = uniqueHelper.util.getNestingTokenAddress(13, 17);
    expect(secondToken).to.eq('0xf8238cCFFf8Ed887463fD5E00000000D00000011');
  });

  it('Test change nesting permissions', async () => {
    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 'to nest', description: 'collection with nesting', tokenPrefix: 'tn'})).collectionId;

    // Nesting disabled by default
    let collection = await uniqueHelper.collection.getData(collectionId);
    expect(collection.raw.permissions.nesting).to.deep.eq({tokenOwner: false, collectionAdmin: false, restricted: null});

    // Manually enable nesting
    let result = await uniqueHelper.collection.enableNesting(alice, collectionId, {tokenOwner: true});
    expect(result).to.be.true;

    collection = await uniqueHelper.collection.getData(collectionId);
    expect(collection.raw.permissions.nesting).to.deep.eq({tokenOwner: true, collectionAdmin: false, restricted: null});

    // Allow nesting only for this collection tokens
    result = await uniqueHelper.collection.enableNesting(alice, collectionId, {tokenOwner: true, restricted: [collectionId]});
    expect(result).to.be.true;

    collection = await uniqueHelper.collection.getData(collectionId);
    expect(collection.raw.permissions.nesting).to.deep.eq({tokenOwner: true, collectionAdmin: false, restricted: [collectionId]});

    // Disable nesting back
    result = await uniqueHelper.collection.disableNesting(alice, collectionId);
    expect(result).to.be.true;

    collection = await uniqueHelper.collection.getData(collectionId);
    expect(collection.raw.permissions.nesting).to.deep.eq({tokenOwner: false, collectionAdmin: false, restricted: null});
  });

  it('Test nest and unnest tokens', async () => {
    const collectionId = (await uniqueHelper.nft.mintCollection(alice, {name: 'to nest', description: 'collection with nesting', tokenPrefix: 'tn'})).collectionId;
    await uniqueHelper.collection.enableNesting(alice, collectionId, {tokenOwner: true});

    const [firstToken, secondToken, thirdToken] = (await uniqueHelper.nft.mintMultipleTokens(alice, collectionId, [
      {owner: {substrate: alice.address}}, {owner: {Substrate: alice.address}}, {owner: {Substrate: alice.address}}
    ])).map(x => x.tokenId);

    const rootAddress = {ethereum: uniqueHelper.util.getNestingTokenAddress(collectionId, firstToken).toLocaleLowerCase()};

    // Nest token #3 to token #1
    let result = await uniqueHelper.nft.nestToken(alice, {collectionId, tokenId: thirdToken}, {collectionId, tokenId: firstToken});
    expect(result).to.be.true;
    expect((await uniqueHelper.nft.getToken(collectionId, thirdToken)).normalizedOwner).to.deep.eq(rootAddress);
    expect(await uniqueHelper.nft.getTokenChildren(collectionId, firstToken)).to.deep.eq([{collection: collectionId, token: thirdToken}]);

    // The topmost owner of the token #3 is still Alice
    expect(await uniqueHelper.nft.getTokenTopmostOwner(collectionId, thirdToken)).to.deep.eq({Substrate: alice.address});

    // Nest token #2 to token #3
    const thirdTokenAddress = {ethereum: uniqueHelper.util.getNestingTokenAddress(collectionId, thirdToken).toLocaleLowerCase()};
    result = await uniqueHelper.nft.nestToken(alice, {collectionId, tokenId: secondToken}, {collectionId, tokenId: thirdToken});
    expect(result).to.be.true;
    expect((await uniqueHelper.nft.getToken(collectionId, secondToken)).normalizedOwner).to.deep.eq(thirdTokenAddress);
    expect(await uniqueHelper.nft.getTokenChildren(collectionId, thirdToken)).to.deep.eq([{collection: collectionId, token: secondToken}]);

    // The topmost owner of the token #2 is still Alice
    expect(await uniqueHelper.nft.getTokenTopmostOwner(collectionId, secondToken)).to.deep.eq({Substrate: alice.address});

    const bob = testSeed('//Bob');
    await uniqueHelper.balance.transferToSubstrate(alice, bob.address, 10n * await uniqueHelper.balance.getOneTokenNominal());

    // Transfer token #1 (Our root) to Bob
    result = await uniqueHelper.nft.transferToken(alice, collectionId, firstToken, {Substrate: bob.address});
    expect(result).to.be.true;

    // Bob now root-owns Token #2 and #3
    expect(await uniqueHelper.nft.getTokenTopmostOwner(collectionId, secondToken)).to.deep.eq({Substrate: bob.address});
    expect(await uniqueHelper.nft.getTokenTopmostOwner(collectionId, thirdToken)).to.deep.eq({Substrate: bob.address});

    // Now Bob able to unnest any element from nesting tree (Token #2 for example)
    expect((await uniqueHelper.nft.getToken(collectionId, secondToken)).normalizedOwner).to.deep.eq(thirdTokenAddress);
    result = await uniqueHelper.nft.unnestToken(bob, {collectionId, tokenId: secondToken}, {collectionId, tokenId: thirdToken}, {Substrate: bob.address});
    expect(result).to.be.true;
    expect((await uniqueHelper.nft.getToken(collectionId, secondToken)).normalizedOwner).to.deep.eq({substrate: bob.address});
    expect(await uniqueHelper.nft.getTokenChildren(collectionId, thirdToken)).to.deep.eq([])
  });
});
