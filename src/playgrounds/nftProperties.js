const { getUsage } = require('../lib/cli');
const { UniqueHelper } = require('../lib/unique');
const { Logger } = require('../lib/logger');

// const wsEndPoint = "wss://ws-rc.unique.network";
const wsEndPoint = "ws://localhost:9944";

// This playground shows how to work with NFT properties
const main = async () => {
  // 1) Init Unique helper, connect to the endpoint
  const uniqueHelper = new UniqueHelper(new Logger());
  await uniqueHelper.connect(wsEndPoint);

  // 2) Make a collection owner and a token owner from seeds (use **your** seeds here)
  const collectionOwner = uniqueHelper.util.fromSeed('stool about amazing erode cotton popular cage half toss squeeze milk traffic');
  const tokenOwner = uniqueHelper.util.fromSeed('//Bob');

  // 3) Create a collection with token properties permissions set
  let collectionInfo = {
    name: 'nft-properties-example',
    description: 'A collection to demonstrate NFT properties',
    tokenPrefix: 'SMPL',

    // List what properties the collection tokens can have
    // and what restrictions are hold on them
    tokenPropertyPermissions: [
      {
        key: 'immutable-key',
        permission: {
          mutable: false,        // Can be added, but no one can change/delete the property
          collectionAdmin: true, // A collection admin **can** manage the property
          tokenOwner: false,     // A token owner **can't** manage the property
        }
      },
      {
        key: 'mutable-key',
        permission: {
          mutable: true,          // The property can be added/modified/deleted
          collectionAdmin: false, // A collection admin **can't** manage the property
          tokenOwner: true,       // A token owner **can** manage the property
        }
      }
    ]
  };

  const collection = await uniqueHelper.mintNFTCollection(collectionOwner, collectionInfo);

  // 4) Mint a token with a property set
  const token = await uniqueHelper.mintNFTToken(collectionOwner, {
    collectionId: collection.collectionId,
    owner: tokenOwner.address,
    properties: [
      {
        key: 'immutable-key',
        value: 'I will live forever!'
      },

      // [WILL NOT WORK] The collection owner can manage this property
      // You will get `common.NoPermission` error.
      //
      // {
      //   key: 'mutable-key',
      //   value: 'MK Value 0'
      // },
    ]
  });

  console.log(`
    token properties: ${await getTokenPropertiesStr(token)}
  `);

  // // 5) Add new property
  // await uniqueHelper.setNFTTokenProperties(
  //   tokenOwner,
  //   collection.collectionId,
  //   token.tokenId,
  //   [
  //     {
  //       key: 'mutable-key',
  //       value: 'MK Initial Value'
  //     },
  //   ]
  // );

  // console.log(`
  //   updated token properties: ${await getTokenPropertiesStr(token)}
  // `);

  // // 5) Change the property
  // await uniqueHelper.setNFTTokenProperties(
  //   tokenOwner,
  //   collection.collectionId,
  //   token.tokenId,
  //   [
  //     {
  //       key: 'mutable-key',
  //       value: 'MK New Value'
  //     },
  //   ]
  // );

  // console.log(`
  //   updated token properties: ${await getTokenPropertiesStr(token)}
  // `);

  // // 6) Delete the property
  // await uniqueHelper.deleteNFTTokenProperties(
  //   tokenOwner,
  //   collection.collectionId,
  //   token.tokenId,
  //   ['mutable-key']
  // );

  // console.log(`
  //   updated token properties: ${await getTokenPropertiesStr(token)}
  // `);

  // // [WILL NOT WORK] No one can modify the immutable property
  // // You will get `common.NoPermission` error.
  // //
  // // await uniqueHelper.setNFTTokenProperties(
  // //   collectionOwner,
  // //   collection.collectionId,
  // //   token.tokenId,
  // //   [
  // //     {
  // //       key: 'immutable-key',
  // //       value: "I'm dead (no, actually)"
  // //     },
  // //   ]
  // // );

  // // [WILL NOT WORK] No one can delete the immutable property
  // // You will get `common.NoPermission` error.
  // //
  // // await uniqueHelper.deleteNFTTokenProperties(
  // //   collectionOwner,
  // //   collection.collectionId,
  // //   token.tokenId,
  // //   ['immutable-key']
  // // );
}

const getTokenPropertiesStr = async (token) => {
  const tokenData = await token.getData();
  const properties = tokenData.properties;

  return JSON.stringify(properties, null, 4);
}

module.exports = {
  main,
  description: 'This playground shows how to work with NFT properties',
  help: getUsage('npm run -- playground nftProperties', {
      help: 'This playground shows how to work with NFT properties'
  })
}
