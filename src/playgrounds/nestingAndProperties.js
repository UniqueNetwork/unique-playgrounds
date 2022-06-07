const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

var archy = require('archy');

// const wsEndPoint = "wss://ws-rc.unique.network";
const wsEndPoint = "ws://localhost:9944";

// This playground demonstrates how can you render an NFT tree with properties
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a user from seed (use **your** seed here)
  const user = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');
  const parentOwner = user.address;

  // 3) Create new collection
  const collection = await createSampleCollection(
    user,
    [
      {
        key: 'name',
        permission: { mutable: false, collectionAdmin: true, tokenOwner: false }
      },
      {
        key: 'color',
        permission: { mutable: true, collectionAdmin: true, tokenOwner: false }
      },
    ],
    uniqueHelper
  );

  const parentToken = await mintSampleToken(
    user, parentOwner, collection.collectionId,
    [
      {
        key: 'name',
        value: 'John'
      }
    ],
    uniqueHelper
  );
  const parentTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    parentToken.tokenId
  );

  // 4) Create children already nested into the parentToken
  const children = [
    await mintSampleToken(
      user, {Ethereum: parentTokenAddress}, collection.collectionId,
      [
        {
          key: 'name',
          value: 'Alice'
        },
      ],
      uniqueHelper
    ),
    await mintSampleToken(
      user, {Ethereum: parentTokenAddress}, collection.collectionId,
      [
        {
          key: 'name',
          value: 'Bob'
        }
      ],
      uniqueHelper
    ),
    await mintSampleToken(
      user, {Ethereum: parentTokenAddress}, collection.collectionId,
      [
        {
          key: 'name',
          value: 'Charlie'
        }
      ],
      uniqueHelper
    ),
  ];

  // 5) Create grandchildren for the parentToken. Nest them into the child token #1.
  const childTokenAddress = uniqueHelper.util.getNestingTokenAddress(
    collection.collectionId,
    children[1].tokenId
  );

  const grandchildren = [
    await mintSampleToken(
      user, {Ethereum: childTokenAddress}, collection.collectionId,
      [
        {
          key: 'name',
          value: 'beautiful-sapphire'
        },
        {
          key: 'color',
          value: 'blue'
        }
      ],
      uniqueHelper
    ),
    await mintSampleToken(
      user, {Ethereum: childTokenAddress}, collection.collectionId,
      [
        {
          key: 'name',
          value: 'awesome-book'
        },
        {
          key: 'color',
          value: 'green'
        }
      ],
      uniqueHelper
    ),
  ];

  // 6) Render the tree
  let rendered = await renderNftTree(parentToken, uniqueHelper);
  console.log(rendered);
}

const createSampleCollection = async (signer, tokenPropertyPermissions, uniqueHelper) => {
  let collectionInfo = {
    name: 'nesting-example',
    description: 'A collection to demonstrate simple token nesting',
    tokenPrefix: 'SMPL',

    // We need to enable nesting. It is disabled by default.
    permissions: {
      nesting: "Owner"
    },

    tokenPropertyPermissions,
  };

  const collection = await uniqueHelper.mintNFTCollection(signer, collectionInfo);
  console.log(`collection #${collection.collectionId} is created`);

  return collection;
}

const mintSampleToken = async (signer, owner, collectionId, properties, uniqueHelper) => {
  const token = await uniqueHelper.mintNFTToken(signer, {
    collectionId,
    owner,
    properties,
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

  const tokenNodes = await Promise.all(
    children.map(async (childToken) => await renderNftTreeImpl(childToken, uniqueHelper))
  );

  const propertyNodes = (await token.getData()).properties
    .map(property => `${property.key}: ${property.value}`);

  const nodes = propertyNodes.concat(tokenNodes);

  if (nodes.length === 0) {
    return tokenLabel;
  } else {
    return {
      label: tokenLabel,
      nodes
    };
  }
}

module.exports = {
  main,
  description: 'Playground to show how to display an NFT tree with properties',
  help: getUsage('npm run -- playground nestingAndProperties', {
    help: 'Playground to show how to display an NFT tree  with properties'
  })
}
