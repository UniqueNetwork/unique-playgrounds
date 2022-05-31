const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

var archy = require('archy');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you restructure deeply nested NFTs
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

  // THE RIGHT WAY
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

  // THE WRONG WAY
  // const firstChildTokenAddress = uniqueHelper.util.getNestingTokenAddress(
  //   collection.collectionId,
  //   children[0].tokenId
  // );

  // // The following call will fail.
  // // The reason is the blockchain has to check that the user
  // // indeed owns both tokens:
  // //  * the token you trying to unnest (`grandchildren[1]`)
  // //  * the target token (the address of `children[0]`)
  // //
  // // To do so, the blockchain will walk up the tree twice starting from each of those tokens.
  // // The maximum number of steps that the blockchain can do is limited by the depth limit.
  // //
  // // In our case we have:
  // // User
  // //   |-- parentToken
  // //   |        |-- children[0]
  // //   |        |-- children[1]
  // //   |        |       |-- grandchildren[0]
  // //   |        |       |-- grandchildren[1] <<= we want to move this to `children[0]`
  // //   |        |
  // //   |        |-- children[2]
  // //
  // // Let's look at the steps that blockchain will take:
  // //  * limit = 5, check if owner of `grandchildren[1]` is User. The owner is a token, go to the owner.
  // //  * limit = 4, check if owner of `children[0]` is User. The owner is a token, go to the owner.
  // //  * limit = 3, check if owner of `parentToken` is User. The owner is a token, go to the owner.
  // //  * limit = 2, [OK] the owner is User.
  // //  * limit = 1, check if owner of `children[0]` is User. The owner is a token, go to the owner.
  // //  * limit = 0, check if owner of `parentToken` is User. The owner is a token, go to the owner.
  // //  * [ERROR] the limit is exhausted.
  // await uniqueHelper.transferNFTTokenFrom(
  //     user,
  //     collection.collectionId,
  //     grandchildren[1].tokenId,
  //     {Ethereum: secondChildTokenAddress},
  //     {Ethereum: firstChildTokenAddress},
  // );

  // 8) Render the tree again
  rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);
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

module.exports = {
  main,
  description: 'Playground to show how to restructure deeply nested NFTs',
  help: getUsage('npm run -- playground restructDepthLimit.dev', {
    help: 'Playground to show how to restructure deeply nested NFTs'
  })
}
