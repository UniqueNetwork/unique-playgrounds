const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

var archy = require('archy');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you restructure NFT trees
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');
  const parentOwner = user.address;

  // 3) Create new collection and mint parentToken
  const collection = await createSampleCollection(user, uniqueHelper);

  const parentToken = await mintSampleToken(user, parentOwner, collection.collectionId, uniqueHelper);
  const parentTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    parentToken.tokenId
  );

  // 4) Create children already nested into the parentToken
  const children = [
    await mintSampleToken(user, {Ethereum: parentTokenAddress}, collection.collectionId, uniqueHelper),
    await mintSampleToken(user, {Ethereum: parentTokenAddress}, collection.collectionId, uniqueHelper),
    await mintSampleToken(user, {Ethereum: parentTokenAddress}, collection.collectionId, uniqueHelper),
  ];

  // 5) Create grandchildren for the parentToken. Nest them into the child token #1.
  const secondChildTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    children[1].tokenId
  );

  const grandchildren = [
    await mintSampleToken(user, {Ethereum: secondChildTokenAddress}, collection.collectionId, uniqueHelper),
    await mintSampleToken(user, {Ethereum: secondChildTokenAddress}, collection.collectionId, uniqueHelper),
  ];

  // 6) Render the tree
  let rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);

  // 7) Let's imagine we need to renest grandchild #1 into child #0
  await uniqueHelper.unnestCollectionToken(
    user,
    grandchildren[1],
    children[1],
    {Substrate: user.address}
  );
  await uniqueHelper.nestCollectionToken(
    user,
    grandchildren[1],
    children[0]
  );

  // 8) Render the tree again
  rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);
}

const createSampleCollection = async (signer, uniqueHelper) => {
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SMPL',

    // We need to enable nesting. It is disabled by default.
    permissions: {
      nesting: {
        tokenOwner: true
      }
    }
  };

  const collection = await uniqueHelper.mintNFTCollection(signer, collectionInfo);
  console.log(`collection #${collection.collectionId} is created`);

  return collection;
}

const mintSampleToken = async (signer, owner, collectionId, uniqueHelper) => {
  const token = await uniqueHelper.mintNFTToken(signer, {
    collectionId,
    owner,
    properties: [],
  });

  console.log(`Token #${token.tokenId} is created in collection #${collectionId}`);

  return token;
}

const renderNftTree = async (token, uniqueHelper) => {
  return archy(await renderNftTreeImpl(token, uniqueHelper));
}

const renderNftTreeImpl = async (token, uniqueHelper) => {
  const collectionId = token.collectionId;

  const tokenLabel = `<token: collection=${collectionId}, id=${token.tokenId}>`;

  const tokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collectionId,
    token.tokenId
    );

  const ownedTokens = await uniqueHelper.getCollectionTokensByAddress(
    collectionId, {Ethereum: tokenAddress}
  );

  if (ownedTokens.length === 0) {
    return tokenLabel;
  } else {
    return {
      label: tokenLabel,
      nodes: await Promise.all(
        ownedTokens.map(async (childTokenId) => {
          const childToken = uniqueHelper.getCollectionTokenObject(collectionId, childTokenId)
          return await renderNftTreeImpl(childToken, uniqueHelper);
        })
      )
    };
  }
}

module.exports = {
  main,
  description: 'Playground to show how to restructure NFT trees',
  help: getUsage('npm run -- playground restructTree', {
    help: 'Playground to show how to restructure NFT trees'
  })
}
