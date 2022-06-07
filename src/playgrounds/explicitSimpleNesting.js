const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you nest one NFT into another
// using the `UniqueHelper` class to get rid of much boilerplate as possible.
// But instead of using `nest/unnest` methods, we will use `transferFrom` transaction explicitly.
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');

  // 3) Collection create info
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SMPL',

    // We need to enable the nesting. It is disabled by default.
    permissions: {
      nesting: "Owner"
    }
  };

  // 4) Create new collection and mint a couple of tokens

  // `mintNFTCollection` takes care of all
  // the boilerplate regarding the collection creation.
  // It will take care of creating, signing and submitting the transaction.
  // Also, it will fetch the created collection object.
  const collection = await uniqueHelper.mintNFTCollection(user, collectionInfo);

  // As the previous method, the `mintNFTToken` also delivers us from the boilerplate.
  // It returns the minted token object.
  const parentToken = await uniqueHelper.mintNFTToken(user, {
    collectionId: collection.collectionId,
    owner: user.address,
    properties: [],
  });
  const childToken = await uniqueHelper.mintNFTToken(user, {
    collectionId: collection.collectionId,
    owner: user.address,
    properties: []
  });

  // We'll show what address does our user have
  console.log(`
    User address: ${user.address}
  `);

  // What's our collection id?
  console.log(`
    Collection Id: ${collection.collectionId}
  `);

  // Let's check who owns the minted tokens
  // We should see the following ownership structure:
  //
  // User
  //   |-- parentToken
  //   |-- childToken
  await logTokenOwner('parent', parentToken);
  await logTokenOwner('child', childToken);

  // 5) Obtain the target token address
  const parentTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    parentToken.tokenId
  );

  console.log(`
    parentTokenAddress: ${parentTokenAddress}
  `);

  // 6) Nest child token into parent token (explicitly using transfer)
  await uniqueHelper.transferNFTToken(
    user,
    collection.collectionId,
    childToken.tokenId,
    {Ethereum: parentTokenAddress}
 );

  // Now `parentToken` owns the `childToken`
  // We should see the following:
  //
  // User
  //   |-- parentToken
  //   |      |-- childToken
  await logTokenOwner('parent', parentToken);
  await logTokenOwner('child', childToken);
  await logTokenTopmostOwner('child', childToken);

  // 7) Unnest the `childToken`
  // We just issuing the transfer transaction once again.
  // But we should use transferFrom since
  // we'll transfer the child token on behalf of the parent token.
  await uniqueHelper.transferNFTTokenFrom(
    user,
    collection.collectionId,
    childToken.tokenId,
    {Ethereum: parentTokenAddress},
    {Substrate: user.address}
  );

  // We returned to the initial state
  //
  // User
  //   |-- parentToken
  //   |-- childToken
  await logTokenOwner('parent', parentToken);
  await logTokenOwner('child', childToken);
}

const logTokenOwner = async (label, token) => {
  const tokenId = token.tokenId;
  const tokenData = await token.getData();

  const ownerStr = JSON.stringify(tokenData.owner);

  console.log(`
    ${label} tokenId = ${tokenId},
    owner = ${ownerStr}
  `);
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
  description: 'Playground to show simple NFT nesting scenario (using tranfer/tranferFrom)',
  help: getUsage('npm run -- playground explicitSimpleNesting.dev', {
    help: 'Playground to show simple NFT nesting scenario (using tranfer/tranferFrom)'
  })
}
