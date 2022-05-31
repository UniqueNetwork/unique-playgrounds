const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

const wsEndPoint = "wss://ws-rc.unique.network";

// This playground demonstrates how can you list owned NFTs
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');
  const tokenOwner = {Substrate: user.address};

  // 3) Create new collection and mint tokens
  const collectionA = await createSampleCollection(user, uniqueHelper);
  const collectionB = await createSampleCollection(user, uniqueHelper);

  const firstToken = await mintSampleToken(user, tokenOwner, collectionA.collectionId, uniqueHelper);
  const secondToken = await mintSampleToken(user, tokenOwner, collectionA.collectionId, uniqueHelper);
  const thirdToken = await mintSampleToken(user, tokenOwner, collectionB.collectionId, uniqueHelper);

  // We'll show what address does our user have
  console.log(`
    User address: ${user.address}
  `);

  // What tokens on the user?
  let tokensInA = await uniqueHelper.getCollectionTokensByAddress(collectionA.collectionId, tokenOwner);
  let tokensInB = await uniqueHelper.getCollectionTokensByAddress(collectionB.collectionId, tokenOwner);

  console.log(`
    User tokens in collection A: ${tokensInA}
    User tokens in collection B: ${tokensInB}
  `);

  // What if we nest thirdToken into firstToken?
  // What will return `getCollectionTokensByAddress` for our user?
  await uniqueHelper.nestCollectionToken(user, thirdToken, firstToken);

  tokensInA = await uniqueHelper.getCollectionTokensByAddress(collectionA.collectionId, tokenOwner);

  // It will be empty because the user doesn't own any token in collection B directly
  tokensInB = await uniqueHelper.getCollectionTokensByAddress(collectionB.collectionId, tokenOwner);

  console.log(`
    User tokens in collection A: ${tokensInA}
    User tokens in collection B: ${tokensInB}
  `);

  // Let's fetch owned tokens for the firstToken (in the collection B)
  const firstTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    firstToken.collectionId,
    firstToken.tokenId
  );
  tokensInB = await uniqueHelper.getCollectionTokensByAddress(
    collectionB.collectionId,
    {Ethereum: firstTokenAddress}
  );

  console.log(`
    firstToken tokens in collection B: ${tokensInB}
  `);
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

module.exports = {
  main,
  description: 'List account tokens playground',
  help: getUsage('npm run -- playground simpleNesting.dev', {
    help: 'Playground to show how to get a list of owned tokens for a specific address inside a given collection'
  })
}
