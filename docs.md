# UniqueHelper auxiliary class (minting scripts and utils)

## Constructor

UniqueHelper is a class to simplify interaction with the Polkadot API for UniqueNetwork chains. In addition to direct calls, it checks the status of performed transactions, returns identifiers of created objects and normalizes addresses.

```typescript
constructor(
  logger: {
    log: (msg: string | array, level: string): void,
    level: {ERROR: "ERROR", WARNING: "WARNING", INFO: "INFO", DEBUG: "DEBUG", NONE: "NONE"}
  }
)
```

Example:
```javascript
const Logger = require('./lib/logger');
const uniqueHelper = new UniqueHelper(new Logger());
await uniqueHelper.connect('wss://quartz.unique.network');
```

More usage examples can be found in the `tests` folder, please refer to the `tests/mint.test.js` and `tests/collection.test.js` files.

## get polkadot logs

You can get logs of `@polkadot/api` calls for transactions using `uniqueHelper.chainLog` array. RPC calls also logged.


## connect

```typescript
async connect(
  wsEndpoint: string,
  listeners?: {
    connected?: () => void,
    disconnected?: () => void,
    error?: () => void,
    ready?: () => void,
    decorated?: () => void
  }
): void
```

A method for connecting to the chain's WebSocket interface. Must be called before starting work with chain.

Example:
```javascript
await uniqueHelper.connect('wss://quartz.unique.network', {error: () => proccess.exit(1)});
```


## disconnect

```typescript
async disconnect(): void
```

A method for disconnecting from the chain's WebSocket interface.

## Chain group

### chain.getChainProperties

```typescript
async getChainProperties(): Promise<{
  ss58Format: Number,
  tokenDecimals: Number[] | null,
  tokenSymbol: string[] | null
}>
```

The method returns the ss58 address format for the chain, the number of decimals of each chain token (default is 18), as well as the short abbreviation of the token (for example, QTZ for Quartz).

Example (for Quartz):
```javascript
await uniqueHelper.chain.getChainProperties(); // {ss58Format: 255, tokenDecimals: [18], tokenSymbol: ['QTZ']}
```


### getLatestBlockNumber
```typescript
async getLatestBlockNumber(): Promise<Number>
```

The method returns number of last generated block.

Example:
```javascript
let latestBlock = await uniqueHelper.chain.getLatestBlockNumber();
```


### getBlockHashByNumber
```typescript
async getBlockHashByNumber(blockNumber: Number): Promise<string | null>
```

The method returns hash of block by its number if block exists.

Example:
```javascript
let firstBlockHash = await uniqueHelper.chain.getBlockHashByNumber(1);
```


## Address group

### normalizeSubstrateToChainFormat

```typescript
async normalizeSubstrateToChainFormat(address: string): Promise<string>
```

The method normalizes the address according to the ss58 format of the selected chain.

Example (for Quartz):
```javascript
await uniqueHelper.address.normalizeSubstrateToChainFormat('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'); // yGHXkYLYqxijLKKfd9Q2CB9shRVu8rPNBS53wvwGTutYg4zTg
```

### normalizeSubstrate
```typescript
normalizeSubstrate(address: string): string
```

Normalizes the given Substrate address from the chain format to the default ss58 format (42)

Example:
```javascript
let aliceNormalized = uniqueHelper.address.normalizeSubstrate('yGHXkYLYqxijLKKfd9Q2CB9shRVu8rPNBS53wvwGTutYg4zTg'); // 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

### substrateToEth
```typescript
substrateToEth(address: string): string
```

The method extracts eth mirror from given substrate address.

Example:
```javascript
uniqueHelper.address.substrateToEth('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'); // 0xd43593c715Fdd31c61141ABd04a99FD6822c8558
```

### ethToSubstrate
```typescript
async ethToSubstrate(address: string, toChainFormat: boolean = false): Promise<string>
```

The method extracts substrate mirror from given ethereum address.

Example
```javascript
await uniqueHelper.address.ethToSubstrate('0x5c03d3976Ad16F50451d95113728E0229C50cAB8'); // 5Gppc4U5bFnhXCo3GUshZfooP85nMKrAfKvqpprFf8rhviop
```


## Balance group

### getOneTokenNominal

```typescript
async getOneTokenNominal(): Promise<bigint>
```

The method returns nominal for one chain token, based on tokenDecimals (For example, 1 QTZ = 1_000_000_000_000_000_000)

Example (for Quartz):
```javascript
await uniqueHelper.balance.getOneTokenNominal(); // 1_000_000_000_000_000_000n
```


### getSubstrate

```typescript
async getSubstrate(address: string): Promise<bigint>
```

Returns the balance of the passed Substrate account.

Example:
```javascript
await uniqueHelper.balance.getSubstrate('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```


### getEthereum

```typescript
async getEthereum(address: string): Promise<bigint>
```

Returns the balance of the passed Ethereum account.

Example:
```javascript
await uniqueHelper.balance.getEthereum('0xd43593c715Fdd31c61141ABd04a99FD6822c8558');
```


### transferToSubstrate
```typescript
async transferToSubstrate(signer: IKeyringPair, address: string, amount: string | bigint): Promise<boolean>
```

Transfers amount of balance from signer to substrate address. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.balance.transferToSubstrate(signer, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 500_000_000_000_000_000); // Transfer 0.5 QTZ from Alice to Bob
```


## Collection group


### getTotalCount
```typescript
async getTotalCount(): Promise<Number>
```

Returns count of collections created on current chain

Example:
```javascript
let totalCollections = await uniqueHelper.collection.getTotalCount();
```

### getData
```typescript
async getData(collectionId: Number): Promise<{
  id: Number,
  name: string,
  description: string,
  tokensCount: number,
  admins: ({Substrate?: string, Ethereum?: string})[],
  normalizedOwner: string,
  raw: ChainCollectionInfo
}>
```

Returns information about the collection with additional data, including the number of tokens it contains, its administrators, the normalized address of the collection's owner, and decoded name and description.

Example (for Quartz):
```javascript
await uniqueHelper.collection.getData(1); // {id: 1, name: 'SubstraPunks', description: 'First NFT collection in polkadot space', tokensCount: 10000, admins: [], normalizedOwner: '5H684Wa69GpbgwQ7w9nZyzVpDmEDCTexhRNmZ7mkqM1Rt7dH', raw: ...}
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
await collection.getData();
```


### getAdmins

```typescript
async getAdmins(collectionId: Number): Promise<({Substrate?: string, Ethereum?: string})[]>
```

Returns the normalized addresses of the collection's administrators

Example:
```javascript
await uniqueHelper.collection.getAdmins(1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getAdmins();
```

### addAdmin
```typescript
async addAdmin(signer: IKeyringPair, collectionId: Number, adminAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Adds a collection administrator. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.addAdmin(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.addAdmin(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### removeAdmin
```typescript
async removeAdmin(signer: IKeyringPair, collectionId: Number, adminAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Removes a collection administrator. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.removeAdmin(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.removeAdmin(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### setSponsor
```typescript
async setSponsor(signer: IKeyringPair, collectionId: Number, sponsorAddress: string): Promise<boolean>
```

Sets the sponsor for the collection (Requires the Substrate address). Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.setSponsor(signer, 1, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setSponsor(signer, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```


### confirmSponsorship
```typescript
async confirmSponsorship(signer: IKeyringPair, collectionId: Number): Promise<boolean>
```

Confirms consent to sponsor the collection on behalf of the signer. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.confirmSponsorship(signer, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.confirmSponsorship(signer);
```

### getEffectiveLimits

```typescript
async getEffectiveLimits(collectionId: Number): Promise<{
  accountTokenOwnershipLimit?: Number,
  sponsoredDataSize?: Number,
  sponsoredDataRateLimit?: Number,
  tokenLimit?: Number,
  sponsorTransferTimeout?: Number,
  sponsorApproveTimeout?: Number,
  ownerCanTransfer?: boolean,
  ownerCanDestroy?: boolean,
  transfersEnabled?: boolean
}>
```

Return the effective limits of the collection instead of null for default values

Example:
```javascript
await uniqueHelper.collection.getEffectiveLimits(1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getEffectiveLimits();
```


### setLimits
```typescript
async setLimits(
  signer: IKeyringPair,
  collectionId: Number,
  limits: {
    accountTokenOwnershipLimit?: Number,
    sponsoredDataSize?: Number,
    sponsoredDataRateLimit?: Number,
    tokenLimit?: Number,
    sponsorTransferTimeout?: Number,
    sponsorApproveTimeout?: Number,
    ownerCanTransfer?: boolean,
    ownerCanDestroy?: boolean,
    transfersEnabled?: boolean
  }
): Promise<boolean>
```

Sets the limits of the collection. At least one limit must be specified for a correct call. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.setLimits(signer, 1, {transfersEnabled: false});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setLimits(signer, {transfersEnabled: false});
```


### changeOwner
```typescript
async changeOwner(signer: IKeyringPair, collectionId: Number, ownerAddress: string): Promise<boolean>
```

Changes the owner of the collection to the new Substrate address. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.changeOwner(signer, 1, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.changeOwner(signer, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```


### getTokenNextSponsored

```typescript
async getTokenNextSponsored(collectionId : Number, tokenId : Number, addressObj : {Substrate?: string, Ethereum?: string}): Promise<Number | null>
```

Get number of blocks when sponsored transaction is available. Returns null if sponsorship hasn't been set.

Example:

```javascript
let test = await uniqueHelper.collection.getTokenNextSponsored(1, 1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```

Alternative way via the UniqueNFTCollection:

```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getTokenNextSponsored(1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```

Alternative way via the UniqueNFTToken:

```javascript
let token = new UniqueNFTToken(1, 1, uniqueHelper);
await token.getNextSponsored({Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```

### setPermissions
```typescript
async setPermissions(signer: IKeyringPair, collectionId: Number, permissions: {
    access?: 'Normal' | 'AllowList',
    mintMode?: boolean,
    nesting?: {tokenOwner: boolean, collectionAdmin: boolean, restricted: null | Number[]}
}): Promise<boolean>
```

Sets onchain permissions for selected collection. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.collection.setPermissions(signer, 1, {mintMode: false});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.setPermissions(signer, {mintMode: false});
```


### enableNesting
```typescript
async enableNesting(signer: IKeyringPair, collectionId: Number, permissions: {tokenOwner: boolean, collectionAdmin: boolean, restricted: null | Number[]}): Promise<boolean>
```

Enables nesting for selected collection. If `restricted` set, you can nest only tokens from specified collections. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.collection.enableNesting(signer, 1, {tokenOwner: true, collectionAdmin: false});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.enableNesting({tokenOwner: true, collectionAdmin: false});
```


### disableNesting
```typescript
async disableNesting(signer: IKeyringPair, collectionId: Number): Promise<boolean>
```

Disables nesting for selected collection. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.collection.disableNesting(signer, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.disableNesting();
```

### setProperties
```typescript
async setProperties(signer: IKeyringPair, collectionId: Number, properties: ({key: string, value: string})[]): Promise<boolean>
```

Sets onchain properties to the collection. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.collection.setProperties(signer, 1, [{key: 'is_substrate', value: 'true'}]);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.setProperties(signer, [{key: 'is_substrate', value: 'true'}]);
```


### deleteProperties
```typescript
async deleteProperties(signer: IKeyringPair, collectionId: Number, propertyKeys: string[]): Promise<boolean>
```

Deletes onchain properties from the collection. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.deleteProperties(signer, 1, ['is_substrate']);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.deleteProperties(signer, ['is_substrate']);
```

### burn
```typescript
async burn(signer: IKeyringPair, collectionId: Number): Promise<boolean>
```

Burns the collection if the signer has sufficient permissions and collection is empty. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.collection.burn(signer, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.burn(signer);
```


## NFT group

### getCollectionObject
```typescript
getCollectionObject(collectionId: Number): UniqueNFTCollection
```

The call will return an initialized UniqueNFTCollection object containing a simplified interface for calling methods of a specific collection. Allows you to pass fewer arguments later without passing `collectionId` every time.

Example:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
```


### getTokenObject
```typescript
getTokenObject(collectionId: Number, tokenId: Number): UniqueNFTToken
```

The call will return an initialized UniqueNFTToken object containing a simplified interface for calling methods of a specific token. Allows you to pass fewer arguments later without passing `collectionId` and `tokenId` every time.

Example:
```javascript
let token = uniqueHelper.nft.getTokenObject(1, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let token = collection.getTokenObject(1);
```


### getTokensByAddress

```typescript
async getTokensByAddress(collectionId: Number, addressObj: {Substrate?: string, Ethereum?: string}): Promise<Number[]>
```

Returns array of token ids owned by address in the collection


Example:
```javascript
await uniqueHelper.nft.getTokensByAddress(1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
await collection.getTokensByAddress({Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### isTokenExists

```typescript
async isTokenExists(collectionId: Number, tokenId: Number): Promise<boolean>
```

Returns the existence status of token with this tokenId in the collection. Returns bool true on success.


Example:
```javascript
await uniqueHelper.nft.isTokenExists(1, 1); // true
await uniqueHelper.nft.isTokenExists(1, 99_999); // false
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
await collection.isTokenExists(1); // true
await collection.isTokenExists(99_999); // false
```


### getLastTokenId
```typescript
async getLastTokenId(collectionId: Number): Promise<Number>
```

Returns the total number of minted tokens in the collection, including burned ones.

Example (for Quartz):
```javascript
await uniqueHelper.nft.getLastTokenId(1); // 10000
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getLastTokenId(); // 10000
```


### getToken
```typescript
async getToken(collectionId: Number, tokenId: Number, blockHashAt?: string): Promise<{
  properties?: ({key: string, value: string})[],
  owner: {Substrate?: string, Ethereum?: string},
  normalizedOwner: {substrate?: string, ethereum?: string}
}>
```

Returns information on a token of a specific collection.

Example (for Quartz):
```javascript
await uniqueHelpers.nft.getToken(1, 1); // {properties: [{key: 'name', value: 'Alice'}], owner: {Substrate: 'yGGET5XvAHJ53vCeHvGgGfweZ711v89dKaEx6yDKV8xHnyyTY'}, normalizedOwner: { substrate: '5FZeTmbZQZsJcyEevjGVK1HHkcKfWBYxWpbgEffQ2M1SqAnP'}}
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
await collection.getToken(1);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
await token.getData();
```


### transferToken
```typescript
async transferToken(signer: IKeyringPair, collectionId: Number, tokenId: Number, addressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Transfers NFT token from signer to given address (Substrate or Ethereum). Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.nft.transferToken(signer, 1, 1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}); // Transfers NFT token #1 from Alice to Bob
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.transferToken(signer, 1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = token.transfer(signer, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```


### transferTokenFrom
```typescript
async transferTokenFrom(signer: IKeyringPair, collectionId: Number, tokenId: Number, fromAddressObj: {Substrate?: string, Ethereum?: string}, toAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Transfers NFT token from given address (Substrate or Ethereum) to given address (Substrate or Ethereum). Signer must have right to do this. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.nft.transferTokenFrom(signer, 1, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}); // Transfers NFT token #1 from Alice to Bob
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.transferTokenFrom(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = token.transferFrom(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```


### mintCollection
```typescript
async mintCollection(
  signer: IKeyringPair,
  collectionOptions: {
    name: string,
    description: string,
    tokenPrefix: string,
    pendingSponsor?: string,
    permissions: {
      access?: "AllowList" | "Normal",
      mintMode?: boolean,
      nesting: {collectionAdmin: boolean, tokenOwner: boolean, restricted: null | Number[]}
    },
    limits?: ChainLimits,
    properties?: ({key: string, value: string})[],
    tokenPropertyPermissions?: ({key: string, permission: {mutable?: boolean, collectionAdmin?: boolean, tokenOwner?: boolean}})[]
  }
): Promise<UniqueNFTCollection>
```

Mints a new collection to the chain. The signer must have sufficient funds to create the collection. Returns a `UniqueNFTCollection` object from the created collection.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let collection = await uniqueHelper.nft.mintCollection(signer, {name: 'test', description: 'test description', tokenPrefix: 'tst'});
await collection.getData(); // ...
```


### mintToken
```typescript
async mintToken(
  signer: IKeyringPair,
  {
    collectionId: Number,
    owner: string | {Substrate?: string, Ethereum?: string},
    properties?: ({key: string, value: string})[]
  }
): Promise<UniqueNFTToken>
```

Mints a single new token to the collection. All properties keys must be present in collection `tokenPropertyPermissions`. Returns an object with the transaction result.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.mintToken(signer, {collectionId: 1, owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, properties: [{key: 'name', value: 'Alice'}]});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.mintToken(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, [{key: 'name', value: 'Alice'}]);
```


### mintMultipleTokens
```typescript
async mintMultipleTokens(
  signer: IKeyringPair,
  collectionId: Number,
  tokens: ({
    owner: {Substrate?: string, Ethereum?: string},
    properties?: ({key: string, value: string})[]
  )[]
): Promise<UniqueNFTToken[]>
```

Mints several new tokens at once to the collection (up to a 100 at a time). All properties keys must be present in collection `tokenPropertyPermissions`. Returns an object with the transaction result.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.mintMultipleTokens(signer, 1, [
  { owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, properties: [{key: 'name', value: 'Alice'}]},
  { owner: {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}, properties: [{key: 'name', value: 'Bob'}]}
]);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.mintMultipleTokens(signer, [
  { owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, properties: [{key: 'name', value: 'Alice'}]},
  { owner: {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}, properties: [{key: 'name', value: 'Bob'}]}
]);
```


### burnToken
```typescript
async burnToken(signer: IKeyringPair, collectionId: Number, tokenId: Number): Promise<{
  success: boolean,
  token: {
    tokenId: Number,
    collectionId: Number,
    owner: {substrate?: string, ethereum?: string}
  }
}>
```

Burns one NFT token. Returns an object with the transaction result.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.burnToken(signer, 1, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.burnToken(signer, 1);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await token.burn(signer);
```


### setTokenPropertyPermissions
```typescript
async setTokenPropertyPermissions(signer: IKeyringPair, collectionId: Number, permissions: ({key: string, permission: {mutable: boolean, collectionAdmin: boolean, tokenOwner: boolean}})[]): Promise<boolean>
```

Sets permissions for token properties. Token can contain only properties with permissions. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.setTokenPropertyPermissions(signer, 1, [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.setTokenPropertyPermissions(signer,  [{key: 'name', permission: {mutable: true, collectionAdmin: true, tokenOwner: true}}]);
```


### setTokenProperties
```typescript
async setTokenProperties(signer: IKeyringPair, collectionId: Number, tokenId: Number, properties: ({key: string, value: string})[]): Promise<boolean>
```

Sets (create or overwrite) properties for NFT token. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.setTokenProperties(signer, 1, 1, [{key: 'name', value: 'Alice'}]);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.setTokenProperties(signer, 1, [{key: 'name', value: 'Alice'}]);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await token.setProperties(signer, [{key: 'name', value: 'Alice'}]);
```


### deleteTokenProperties
```typescript
async deleteTokenProperties(signer: IkeyringPair, collectionId: Number, tokenId: Number, propertyKeys: string[]): Promise<boolean>
```

Deletes properties from NFT token. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.deleteTokenProperties(signer, 1, 1, ['name']);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.deleteTokenProperties(signer, 1, ['name']);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await token.deleteProperties(signer, ['name']);
```


### nestToken
```typescript
async nestToken(signer, tokenObj: {tokenId: Number, collectionId: Number}, rootTokenObj: {tokenId: Number, collectionId: Number}): Promise<boolean>
```

Nest one token to another. Other token collection must have enabled nesting. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.nestToken(signer, {collectionId: 1, tokenId: 2}, {collectionId: 1, tokenId: 1});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.nestToken(signer, 2, {collectionId: 1, tokenId: 1});
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 2);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await token.nest(signer, {collectionId: 1, tokenId: 1});
```


### unnestToken
```typescript
async unnestToken(signer: IKeyringPair, tokenObj: {tokenId: Number, collectionId: Number}, rootTokenObj: {tokenId: Number, collectionId: Number}, toAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Unnest one token from another. You must own root token to do this. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.nft.unnestToken(signer, {collectionId: 1, tokenId: 2}, {collectionId: 1, tokenId: 1}, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.unnestToken(signer, 2, {collectionId: 1, tokenId: 1}, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 2);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await token.unnest(signer, {collectionId: 1, tokenId: 1}, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### getTokenTopmostOwner
```javascript
async getTokenTopmostOwner(collectionId: Number, tokenId: Number, blockHashAt?: string): Promise<{Substrate?: string, Ethereum?: string} | null>
```

Get topmost owner of a given token.

```javascript
let collectionId = 1;
let tokenId = 2;
let tokenTopmostOwner = await uniqueHelper.nft.getTokenTopmostOwner(collectionId, tokenId);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let tokenTopmostOwner = await collection.getTokenTopmostOwner(2);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 2);
let tokenTopmostOwner = await token.getTopmostOwner();
```


### getTokenChildren
```javascript
async getTokenChildren(collectionId: Number, tokenId: Number, blockHashAt?: string): Promise<({collection: Number, token: Number})[]>
```

Get children (tokens, nested to given token) of given token.

```javascript
let tokenChildren = await uniqueHelper.nft.getTokenChildren(1, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.nft.getCollectionObject(1);
let tokenChildren = await collection.getTokenChildren(1);
```

Alternative way via the UniqueNFTToken:
```javascript
let token = uniqueHelper.nft.getCollectionTokenObject(1, 1);
let tokenChildren = await token.getChildren();
```

## Util group

### fromSeed
```typescript
fromSeed(seed: string): IKeyringPair
```

Creates a pair in the Keyring based on the passed seed phrase. The pair can be used to sign transactions. All UniqueHelper methods accept a signer in this format.

Example:
```javascript
let alice = uniqueHelper.util.fromSeed('//Alice');
```


