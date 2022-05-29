const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Nesting tests', () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  afterAll(async () => {
    try {
      await uniqueHelper.disconnect();
    } catch (e) {}
  });

  it('Test nesting addresses', () => {
    const firstToken = uniqueHelper.util.getNestingTokenAddress(1, 1);
    expect(firstToken).toEqual('0xF8238ccFFF8ED887463Fd5e00000000100000001');
    const secondToken = uniqueHelper.util.getNestingTokenAddress(13, 17);
    expect(secondToken).toEqual('0xf8238cCFFf8Ed887463fD5E00000000D00000011');
  });

  it('Test change nesting permissions', async () => {
    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 'to nest', description: 'collection with nesting', tokenPrefix: 'tn'})).collectionId;

    // Nesting disabled by default
    let collection = await uniqueHelper.getCollection(collectionId);
    await expect(collection.raw.permissions.nesting).toEqual('Disabled');

    // Manually enable nesting
    let result = await uniqueHelper.enableCollectionNesting(alice, collectionId);
    await expect(result).toBe(true);

    collection = await uniqueHelper.getCollection(collectionId);
    await expect(collection.raw.permissions.nesting).toEqual('Owner');

    // Allow nesting only for this collection tokens
    result = await uniqueHelper.enableCollectionNesting(alice, collectionId, [collectionId]);
    await expect(result).toBe(true);

    collection = await uniqueHelper.getCollection(collectionId);
    await expect(collection.raw.permissions.nesting).toEqual({OwnerRestricted: [collectionId.toString()]});

    // Disable nesting back
    result = await uniqueHelper.disableCollectionNesting(alice, collectionId);
    await expect(result).toBe(true);

    collection = await uniqueHelper.getCollection(collectionId);
    await expect(collection.raw.permissions.nesting).toEqual('Disabled');
  });

  it('Test nest and unnest tokens', async () => {
    const collectionId = (await uniqueHelper.mintNFTCollection(alice, {name: 'to nest', description: 'collection with nesting', tokenPrefix: 'tn'})).collectionId;
    await uniqueHelper.enableCollectionNesting(alice, collectionId);

    const [firstToken, secondToken, thirdToken] = (await uniqueHelper.mintMultipleNFTTokens(alice, collectionId, [
      {owner: {substrate: alice.address}}, {owner: {Substrate: alice.address}}, {owner: {Substrate: alice.address}}
    ])).map(x => x.tokenId);

    const rootAddress = {ethereum: uniqueHelper.util.getNestingTokenAddress(collectionId, firstToken).toLocaleLowerCase()};

    // Nest token #3 to token #1
    let result = await uniqueHelper.nestCollectionToken(alice, {collectionId, tokenId: thirdToken}, {collectionId, tokenId: firstToken});
    await expect(result).toBe(true);
    await expect((await uniqueHelper.getToken(collectionId, thirdToken)).normalizedOwner).toEqual(rootAddress);

    // The topmost owner of the token #3 is still Alice
    await expect(await uniqueHelper.getTokenTopmostOwner(collectionId, thirdToken)).toEqual({Substrate: alice.address});

    // Nest token #2 to token #3
    const thirdTokenAddress = {ethereum: uniqueHelper.util.getNestingTokenAddress(collectionId, thirdToken).toLocaleLowerCase()};
    result = await uniqueHelper.nestCollectionToken(alice, {collectionId, tokenId: secondToken}, {collectionId, tokenId: thirdToken});
    await expect(result).toBe(true);
    await expect((await uniqueHelper.getToken(collectionId, secondToken)).normalizedOwner).toEqual(thirdTokenAddress);

    // The topmost owner of the token #2 is still Alice
    await expect(await uniqueHelper.getTokenTopmostOwner(collectionId, secondToken)).toEqual({Substrate: alice.address});

    const bob = uniqueHelper.util.fromSeed('//Bob');
    await uniqueHelper.transferBalanceToSubstrateAccount(alice, bob.address, 10n * await uniqueHelper.getOneTokenNominal());

    // Transfer token #1 (Our root) to Bob
    result = await uniqueHelper.transferNFTToken(alice, collectionId, firstToken, {Substrate: bob.address});
    await expect(result).toBe(true);

    // Bob now root-owns Token #2 and #3
    await expect(await uniqueHelper.getTokenTopmostOwner(collectionId, secondToken)).toEqual({Substrate: bob.address});
    await expect(await uniqueHelper.getTokenTopmostOwner(collectionId, thirdToken)).toEqual({Substrate: bob.address});

    // Now Bob able to unnest eny element from nesting tree (Token #2 for example)
    await expect((await uniqueHelper.getToken(collectionId, secondToken)).normalizedOwner).toEqual(thirdTokenAddress);
    result = await uniqueHelper.unnestCollectionToken(bob, {collectionId, tokenId: secondToken}, {collectionId, tokenId: thirdToken}, {Substrate: bob.address});
    await expect(result).toBe(true);
    await expect((await uniqueHelper.getToken(collectionId, secondToken)).normalizedOwner).toEqual({substrate: bob.address});
  });
});
