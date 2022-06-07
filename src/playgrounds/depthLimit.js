const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you reproduce the depth limit error
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');

  // 3) Create new collection and create `depthLimit`-level NFT bundle
  const depthLimit = 5; // If you change this to `6`, the playground will fail with `structure.DepthLimit`

  const collection = await createSampleCollection(user, uniqueHelper);
  const rootToken = await mintSampleToken(user, user.address, collection.collectionId, uniqueHelper);
  const rootTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    rootToken.tokenId
  );

  let owner = {Ethereum: rootTokenAddress};

  for (let i = 0; i < depthLimit; i++) {
    // Mint nested token
    const token = await mintSampleToken(user, owner, collection.collectionId, uniqueHelper);

    const tokenAddress = uniqueHelper.util.getNestingTokenAddress(
      collection.collectionId,
      token.tokenId
    );
    owner = {Ethereum: tokenAddress};
  }

  console.log(`[OK] The ${depthLimit}-level bundle is created`);
}

const createSampleCollection = async (signer, uniqueHelper) => {
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SMPL',

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

module.exports = {
  main,
  description: 'Playground to show how to reproduce the depth limit error',
  help: getUsage('npm run -- playground depthLimit.dev', {
    help: 'Playground to show how to reproduce the depth limit error'
  })
}
