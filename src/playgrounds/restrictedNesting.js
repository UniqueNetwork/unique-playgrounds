const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you nest one NFT into another
// with respect to the nesting permissions defined on a collection
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');

  const collectionA = await createSampleCollection(user, uniqueHelper);
  const collectionB = await createSampleCollection(user, uniqueHelper);
  const collectionC = await createSampleCollection(user, uniqueHelper);

  const tokensA = [
    await mintSampleToken(user, user.address, collectionA.collectionId, uniqueHelper),
    await mintSampleToken(user, user.address, collectionA.collectionId, uniqueHelper),
  ];

  const tokensB = [
    await mintSampleToken(user, user.address, collectionB.collectionId, uniqueHelper),
    await mintSampleToken(user, user.address, collectionB.collectionId, uniqueHelper),
  ];

  const tokensC = [
    await mintSampleToken(user, user.address, collectionC.collectionId, uniqueHelper),
    await mintSampleToken(user, user.address, collectionC.collectionId, uniqueHelper),
  ];

  // [WILL NOT WORK] Nesting is disabled by default
  // You'll get `common.NestingIsDisabled` error.
  //
  // await uniqueHelper.nestCollectionToken(user, /* child */ tokensA[1], /* parent */ tokensA[0]);

  // 3) Allow tokens from collection A and collection B
  // to be nested into tokens from collection A
  await uniqueHelper.setCollectionPermissions(
    user,
    collectionA.collectionId,
    {
        nesting: {
            OwnerRestricted: [
                collectionA.collectionId,
                collectionB.collectionId
            ]
        }
    }
  );

  // [OK]
  await uniqueHelper.nestCollectionToken(user, /* child */ tokensA[1], /* parent */ tokensA[0]);
  await uniqueHelper.nestCollectionToken(user, /* child */ tokensB[0], /* parent */ tokensA[0]);

  // [WILL NOT WORK] only tokens from collection A and B can be used here
  // You'll get `common.SourceCollectionIsNotAllowedToNest` error.
  //
  // await uniqueHelper.nestCollectionToken(user, /* child */ tokensC[0], /* parent */ tokensA[0]);

  // You can change the nesting rules at any time
  // await uniqueHelper.setCollectionPermissions(
  //   user,
  //   collectionA.collectionId,
  //   { nesting: "Owner" }
  // );

  // Now it works
  // await uniqueHelper.nestCollectionToken(user, /* child */ tokensC[0], /* parent */ tokensA[0]);

  console.log('[OK]')
}

const createSampleCollection = async (signer, uniqueHelper) => {
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SMPL',
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

module.exports = {
  main,
  description: 'Playground to show restricted NFT nesting scenario',
  help: getUsage('npm run -- playground restrictedNesting', {
    help: 'Playground to show restricted NFT nesting scenario'
  })
}
