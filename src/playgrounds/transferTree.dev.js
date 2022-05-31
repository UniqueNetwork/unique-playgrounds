const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

var archy = require('archy');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you send an entire bundle to another user
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
  const childTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    children[1].tokenId
  );

  const grandchildren = [
    await mintSampleToken(user, {Ethereum: childTokenAddress}, collection.collectionId, uniqueHelper),
    await mintSampleToken(user, {Ethereum: childTokenAddress}, collection.collectionId, uniqueHelper),
  ];

  // 6) Render the tree
  let rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);

  // Let's check who owns the parentToken
  await logTokenTopmostOwner('parent', parentToken);

  // Let's check one of the tree leafs
  await logTokenTopmostOwner('grandchild', grandchildren[0]);

  // 7) Transfer the tree (NFT bundle) to another user (Bob)
  const bobAddress = uniqueHelper.util.fromSeed('//Bob').address;

  await uniqueHelper.transferNFTToken(
    user,
    collection.collectionId,
    parentToken.tokenId,
    {Substrate: bobAddress}
  );

  console.log(`
    Bob address: ${bobAddress}
  `);

  // 8) Render the tree, check if we have the exact same tree
  rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);

  // Let's check who owns the parentToken
  await logTokenTopmostOwner('parent', parentToken);

  // Let's check one of the tree leafs
  await logTokenTopmostOwner('grandchild', grandchildren[0]);
}

const createSampleCollection = async (signer, uniqueHelper) => {
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SIMPLE',

    // We need to enable nesting. It is disabled by default.
    permissions: {
      nesting: "Owner"
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

  const tokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collectionId,
    token.tokenId
  );

  const children = (await uniqueHelper.getCollectionTokensByAddress(
    collectionId, {Ethereum: tokenAddress}
  )).map(childId => uniqueHelper.getCollectionTokenObject(collectionId, childId));

  const tokenLabel = `<token: collection=${collectionId}, id=${token.tokenId}>`;

  if (children.length === 0) {
    return tokenLabel;
  } else {
    return {
      label: tokenLabel,
      nodes: await Promise.all(
        children.map(async (childToken) => await renderNftTreeImpl(childToken, uniqueHelper))
      )
    };
  }
}

const logTokenTopmostOwner = async (label, token) => {
  const tokenId = token.tokenId;
  const owner = await token.getTopmostOwner();

  const ownerStr = JSON.stringify(owner);

  console.log(`
    ${label} tokenId = ${tokenId},
    topmost owner = ${ownerStr}
  `);
}

module.exports = {
  main,
  description: 'Playground to show how to transfer an NFT tree to another user',
  help: getUsage('npm run -- playground simpleNesting.dev', {
    help: 'Playground to show how to transfer an NFT tree to another user'
  })
}
