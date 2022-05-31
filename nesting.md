# Unique Nesting Description
Consider a case of two tokens, `Token A1` and `Token A2` being a part of `collection A`. You can nest one token into or rather 'under' another if we observe this action as a formation of a parent-child relational tree.
To do so we need to transfer one token (the child) to the address of another token (the parent). Let’s send `Token A2` to `Token A1`’s address, effectively making `Token A2` the child of `Token A1`.
To obtain a token's address you can use `tokenIdToAddress` function:

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

Currently there is a requirement that needs to be fulfilled regarding the ownership of the parent and child tokens: at the moment of an NFT bundle creation (the nested structure), both tokens should be owned by the same account.
To unnest a token, you can use the transfer transaction once again. The only difference being that this time around you should use `tranferFrom` method on the parent token address.
Again, there is a requirement that you should be the topmost owner of the NFT you trying to unnest.
```javascript
api.tx.unique.transferFrom({
    Ethereum: tokenIdToAddress(
        ACollectionId,
        A1TokenId
    )
}, {Substrate: newOwnerAddress}, ACollectionId, A2TokenId, 1)
```

You can transfer an entire NFT bundle to another user/address, it can be done by transferring the root NFT of te entire bundle.
As noted previously, when you transfer a token to an already existing bundle, you should own both the token you send and the root NFT of the bundle.
The maximum depth level of NFT bundles is 5.

## Nesting permissions

Nesting permissions are managed at the collection level. A collection owner can set nesting permissions either on a collection creation or can update them later. By default, no one is allowed to nest into the collection’s tokens.
There are 3 nesting permission states:
 * Disabled - the default, no nesting allowed in this collection
 * Owner -  only an NFT owner can nest
 * OwnerRestricted - an NFT owner can nest only from a declared set of collections

Here’s how you can set nesting rules:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: 'Owner'
});
```

As a consequence of calling `setCollectionPermissions` method as in the example above, owners of `collection A` tokens would be able to nest any token from any collection to any `collection A` token.

A collection owner can restrict the set of collections from which owners are allowed to nest their tokens by making a call to setCollectionPermissions:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: {
    OwnerRestricted: [BCollectionId, DCollectionId]
  }
});
```
As a result, the owners would be able to nest tokens only from `collection B` or `collection D`.

Finally, a collection owner can disable nesting at any time by issuing the `setCollectionPermissions` transaction:
```javascript
api.tx.unique.setCollectionPermissions(ACollectionId, {
  nesting: 'Disabled'
});
```

When a collection owner disables nesting, all existing bundles remain, a token owner can unnest nested tokens from any bundle owned by him. Creating new bundles, however, will not be possible.

The nesting rules can be changed at any time, the existing bundles won’t be affected.

## Additional info
 * You can’t burn NFT bundles (i.e. entire branches), you have to deconstruct them first (unnest or burn the nested tokens separately). Once the root NFT has no more children (i.e. when it reverts to a regular NFT) it can then be burned it as well.
 * You can’t burn non-empty collections.

## Playgrounds - get started
 * [src/playgrounds/simpleNesting.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/simpleNesting.dev.js)
this playground shows you how to connect to the endpoint, create a user object from a seed, create a collection and how mint and nest tokens.
 * [src/playgrounds/explicitSimpleNesting.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/explicitSimpleNesting.dev.js)
pretty much the same as above, but it shows how nesting works under the hood. You can use a regular transfer to nest one token into another.
 * [src/playgrounds/listAccountTokens.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/listAccountTokens.dev.js)
this playground shows you a way to list all owned tokens of a specific account within a given collection. This is all about traversing an NFT bundle.
 * [src/playgrounds/renderNftTree.dev.js](https://github.com/UniqueNetwork/unique-playgrounds/blob/angelhack-polkadot-2022/src/playgrounds/renderNftTree.dev.js)
this playground displays an NFT tree in the console. It uses tricks from previous playgrounds as the basis for a  more complex example.
