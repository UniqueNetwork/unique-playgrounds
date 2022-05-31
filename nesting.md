# Unique Nesting Description
Let us have a couple of tokens: `Token A1` and `Token A2` in a `collection A`. You can nest one token into another.
To do that we need to transfer one token to address of another token. Let’s send `Token A2` to `Token A1`’s address.
To obtain a token address you can use `tokenIdToAddress` function:

```javascript
const Web3 = require('web3');

const encodeIntBE = v => {
    if (v >= 0xffffffff || v < 0) throw new Error('id overflow');
    return [
        v >> 24,
        (v >> 16) & 0xff,
        (v >> 8) & 0xff,
        v & 0xff,
    ];
}
const tokenIdToAddress = (collectionId, tokenId) => {
    const buf = Buffer.from([
        0xf8, 0x23, 0x8c, 0xcf, 0xff, 0x8e, 0xd8, 0x87, 0x46, 0x3f, 0xd5, 0xe0,
        ...encodeIntBE(collectionId),
        ...encodeIntBE(tokenId),
    ]);
    return Web3.utils.toChecksumAddress('0x' + buf.toString('hex'));
}
```

Then, to nest the token, you can do just a regular transfer to Ethereum token address:
```javascript
api.tx.unique.transfer({
    Ethereum: tokenIdToAddress(
        ACollectionId,
        A1TokenId
    )
}, ACollectionId, A2TokenId, 1)
```

At the moment of an NFT bundle creation, both tokens should be owned by the same account.
To unnest a token, you can use the transfer transaction once again. The only difference here is that you should use `tranferFrom` method because you are transferring on behalf of another address (the token address).
You should be the topmost owner of the NFT you trying to unnest.
```javascript
api.tx.unique.transferFrom({
    Ethereum: tokenIdToAddress(
        ACollectionId,
        A1TokenId
    )
}, {Substrate: newOwnerAddress}, ACollectionId, A2TokenId, 1)
```

You can transfer an entire NFT bundle to another user, it can be done by transferring the root NFT.
When you transfer a token to an already existing bundle, you should own both the token you send and the root NFT of the bundle.
The maximum depth level of NFT bundles is 5.

## Nesting permissions

Each collection is in charge of how to deal with nesting. A collection owner can set nesting permissions either on a collection creation or can update them later. By default, no one is allowed to nest into the collection’s tokens.
There are 3 nesting rules:
 * Disabled, the default one – no one can nest anything into NFTs inside this collection
 * Owner, only an NFT owner can nest into it
 * OwnerRestricted, an NFT owner can nest into a token only from some defined set of collections

Here’s how you can set nesting rules:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: 'Owner'
});
```

After calling the `setCollectionPermissions` method like above, owners of tokens that belong to `collection A` can nest any token from any collection to owned tokens of `collection A`.

A collection owner can restrict the set of collections from which owners are allowed to nest their tokens:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: {
    OwnerRestricted: [BCollectionId, DCollectionId]
  }
});
```
Now, owners can nest tokens only from `collection B` or `collection D`.

Finally, a collection owner can disable nesting at any time by issuing the `setCollectionPermissions` transaction like this:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: 'Disabled'
});
```

When a collection owner disables nesting, all existing bundles remain, a token owner can unnest nested tokens from any bundle owned by him. But token owners now are not allowed to create new bundles.

The nesting rules can be changed at any time, the existing bundles won’t be affected.

## Additional info
 * You can’t burn NFT bundles, you have to destruct them first (unnest or burn the nested tokens). When the root NFT has no
   children (i.e., it became a regular NFT), you can burn it as well.
 * You can’t burn non-empty collections.

## Playgrounds to get started
 * [src/playgrounds/simpleNesting.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/simpleNesting.dev.js)
this playground shows you how to connect to the endpoint, create a user object from a seed, create a collection and how mint and nest tokens.
 * [src/playgrounds/explicitSimpleNesting.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/explicitSimpleNesting.dev.js)
pretty much the same playground as the first one, but it shows how nesting works under the hood. You can use regular transfer to nest one token into another.
 * [src/playgrounds/listAccountTokens.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/listAccountTokens.dev.js)
this playground shows you how you can get all owned tokens of a specific account inside a given collection. This is the point where you can get to know how to traverse an NFT bundle.
 * [src/playgrounds/renderNftTree.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/renderNftTree.dev.js)
this playground displays an NFT tree in the console. It uses tricks from previous playgrounds to make a more complicated example.
