# UniqueHelper auxiliary classes (minting scripts) and UniqueSchemaHelper (collection schema utilities)

## UniqueHelper methods

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

### connect

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

### disconnect

```typescript
async disconnect(): void
```

A method for disconnecting from the chain's WebSocket interface.

### getChainProperties

```typescript
async getChainProperties(): Promise<{
  ss58Format: string,
  tokenDecimals: string[] | null,
  tokenSymbol: string[] | null
}>
```

The method returns the ss58 address format for the chain, the number of decimals of each chain token (default is 18), as well as the short abbreviation of the token (for example, QTZ for Quartz).

Example (for Quartz):
```javascript
await uniqueHelper.getChainProperties(); // {ss58Format: "255", "tokenDecimals": ["18"], "tokenSymbol": ["QTZ"]}
```


### getOneTokenNominal

```typescript
async getOneTokenNominal(): Promise<bigint>
```

The method returns nominal for one chain token, based on tokenDecimals (For example, 1 QTZ = 1_000_000_000_000_000_000)

Example (for Quartz):
```javascript
await uniqueHelper.getOneTokenNominal(); // 1_000_000_000_000_000_000n
```

### normalizeSubstrateAddressToChainFormat

```typescript
async normalizeSubstrateAddressToChainFormat(address: string): Promise<string>
```

The method normalizes the address according to the ss58 format of the selected chain.

Example (for Quartz):
```javascript
await uniqueHelper.normalizeSubstrateAddressToChainFormat('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'); // yGHXkYLYqxijLKKfd9Q2CB9shRVu8rPNBS53wvwGTutYg4zTg
```


### getSubstrateAccountBalance

```typescript
async getSubstrateAccountBalance(address: string): Promise<bigint>
```

Returns the balance of the passed Substrate account.

Example:
```javascript
await uniqueHelper.getSubstrateAccountBalance('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```

### getEthereumAccountBalance

```typescript
async getEthereumAccountBalance(address: string): Promise<bigint>
```

Returns the balance of the passed Ethereum account.

Example:
```javascript
await uniqueHelper.getEthereumAccountBalance('0xd43593c715Fdd31c61141ABd04a99FD6822c8558');
```


### transferBalanceToSubstrateAccount
```typescript
async transferBalanceToSubstrateAccount(signer: IKeyringPair, address: string, amount: string | bigint): Promise<boolean>
```

Transfers amount of balance from signer to substrate address. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.transferBalanceToSubstrateAccount(signer, '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', 500_000_000_000_000_000); // Transfer 0.5 QTZ from Alice to Bob
```




### getCollectionObject
```typescript
getCollectionObject(collectionId: Number): UniqueNFTCollection
```

The call will return an initialized UniqueNFTCollection object containing a simplified interface for calling methods of a specific collection. Allows you to pass fewer arguments later without passing `collectionId` every time.

Example:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
```

### getCollection
```typescript
async getCollection(collectionId: Number): Promise<{
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
await uniqueHelper.getCollection(1); // {id: 1, name: 'SubstraPunks', description: 'First NFT collection in polkadot space', tokensCount: 10000, admins: [], normalizedOwner: '5H684Wa69GpbgwQ7w9nZyzVpDmEDCTexhRNmZ7mkqM1Rt7dH', raw: ...}
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getData();
```


### getCollectionAdmins

```typescript
async getCollectionAdmins(collectionId: Number): Promise<({Substrate?: string, Ethereum?: string})[]>
```

Returns the normalized addresses of the collection's administrators

Example:
```javascript
await uniqueHelper.getCollectionAdmins(1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
await collection.getAdmins();
```


### getCollectionLastTokenId
```typescript
async getCollectionLastTokenId(collectionId: Number): Promise<Number>
```

Returns the total number of minted tokens in the collection, including burned ones.

Example (for Quartz):
```javascript
await uniqueHelper.getCollectionLastTokenId(1); // 10000
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
await collection.getLastTokenId(); // 10000
```


### getToken
```typescript
async getToken(collectionId: Number, tokenId: Number): Promise<{
  constData: string,
  varibaleData: string,
  owner: {Substrate?: string, Ethereum?: string},
  normalizedOwner: {substrate?: string, ethereum?: string}
}>
```

Returns information on a token of a specific collection.

Example (for Quartz):
```javascript
await uniqueHelpers.getToken(1, 1); // {constData: '0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020311', variableData: '', owner: {Substrate: 'yGGET5XvAHJ53vCeHvGgGfweZ711v89dKaEx6yDKV8xHnyyTY'}, normalizedOwner: { substrate: '5FZeTmbZQZsJcyEevjGVK1HHkcKfWBYxWpbgEffQ2M1SqAnP'}}
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
await collection.getToken(1);
```


### transferNFTToken
```typescript
async transferNFTToken(signer: IKeyringPair, collectionId: Number, tokenId: Number, addressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Transfers NFT token from signer to given address (Substrate or Ethereum). Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.transferNFTToken(signer, 1, 1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}); // Transfers NFT token #1 from Alice to Bob
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.transferToken(signer, 1, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```


### transferNFTTokenFrom
```typescript
async transferNFTTokenFrom(signer: IKeyringPair, collectionId: Number, tokenId: Number, fromAddressObj: {Substrate?: string, Ethereum?: string}, toAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Transfers NFT token from given address (Substrate or Ethereum) to given address (Substrate or Ethereum). Signer must have right to do this. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.transferNFTTokenFrom(signer, 1, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}); // Transfers NFT token #1 from Alice to Bob
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.transferTokenFrom(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'});
```


### mintNFTCollection
```typescript
async mintNFTCollection(
  signer: IKeyringPair,
  collectionOptions: {
    name: string,
    description: string,
    tokenPrefix: string,
    offchainSchema?: string,
    schemaVersion?: "Unique" | "ImageURL",
    variableOnChainSchema?: string,
    constOnChainSchema?: string,
    access?: "AllowList" | "Normal",
    pendingSponsor?: string,
    limits?: ChainLimits,
    metaUpdatePermission?: "Admin" | "ItemOwner"
  }
): Promise<UniqueNFTCollection>
```

Mints a new collection to the chain. The signer must have sufficient funds to create the collection. Returns a `UniqueNFTCollection` object from the created collection.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let collection = await uniqueHelper.mintNFTCollection(signer, {name: 'test', description: 'test description', tokenPrefix: 'tst'});
await collection.getData(); // ...
```

### burnNFTCollection
```typescript
async burnNFTCollection(signer: IKeyringPair, collectionId: Number): Promise<boolean>
```

Burns the collection if the signer has sufficient permissions. The result is the `common` event.

CollectionDestroyed

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.burnNFTCollection(signer, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.burn(signer);
```


### setNFTCollectionSchemaVersion
```typescript
async setNFTCollectionSchemaVersion(signer: IKeyringPair, collectionId: Number, schemaVersion: "Unique" | "ImageURL"): Promise<boolean>
```

Sets the schema for the collection. There are currently only two options available. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.setNFTCollectionSchemaVersion(signer, 1, 'Unique');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setSchemaVersion(signer, 'Unique');
```


### setNFTCollectionOffchainSchema
```typescript
async setNFTCollectionOffchainSchema(signer: IKeyringPair, collectionId: Number, offchainSchema: string): Promise<boolean>
```

Sets the `offchainSchema` property of the collection. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.setNFTCollectionOffchainSchema(signer, 1, 'https://ipfs.unique.network/ipns/QmaMtDqE9nhMX9RQLTpaCboqg7bqkb6Gi67iCKMe8NDpCE/images/punks/image{id}.png');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setOffchainSchema(signer, 'https://ipfs.unique.network/ipns/QmaMtDqE9nhMX9RQLTpaCboqg7bqkb6Gi67iCKMe8NDpCE/images/punks/image{id}.png');
```


### setNFTCollectionSponsor
```typescript
async setNFTCollectionSponsor(signer: IKeyringPair, collectionId: Number, sponsorAddress: string): Promise<boolean>
```

Sets the sponsor for the collection (Requires the Substrate address). Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.setNFTCollectionSponsor(signer, 1, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setSponsor(signer, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```


### confirmNFTCollectionSponsorship
```typescript
async confirmNFTCollectionSponsorship(signer: IKeyringPair, collectionId: Number): Promise<boolean>
```

Confirms consent to sponsor the collection on behalf of the signer. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.confirmNFTCollectionSponsorship(signer, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.confirmSponsorship(signer);
```


### setNFTCollectionLimits
```typescript
async setNFTCollectionLimits(
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
let success = await uniqueHelper.setNFTCollectionLimits(signer, 1, {transfersEnabled: false});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setLimits(signer, {transfersEnabled: false});
```


### setNFTCollectionConstOnChainSchema
```typescript
async setNFTCollectionConstOnChainSchema(signer: IKeyringPair, collectionId: Number, schema: string): Promise<boolean>
```

Sets the schema for immutable data (`constData`) of collection tokens. Returns bool true on success. Be careful using this method! It is impossible to change the constData in token, so we strongly recommend specify the schema correctly from the very beginning, even before minting the first token, and during minting, check the content through `UniqueSchemaHelper.validateData`.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.setNFTCollectionConstOnChainSchema(signer, 1, '{"nested":{"onChainMetaData":{"nested":{"NFTMeta":{"fields":{"ipfsJson":{"id":1,"rule":"required","type":"string"},"gender":{"id":2,"rule":"required","type":"Gender"},"traits":{"id":3,"rule":"repeated","type":"PunkTrait"}}},"Gender":{"options":{"Female":"{\"en\": \"Female\"}","Male":"{\"en\": \"Male\"}"},"values":{"Female":1,"Male":0}},"PunkTrait":{"options":{"SMILE":"{\"en\": \"Smile\"}","SUNGLASSES":"{\"en\": \"Sunglasses\"}","MUSTACHE":"{\"en\": \"Mustache\"}","BALD":"{\"en\": \"Bald\"}"},"values":{"SMILE":0,"SUNGLASSES":1,"MUSTACHE":2,"BALD":3}}}}}}');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setConstOnChainSchema(signer, '{"nested":{"onChainMetaData":{"nested":{"NFTMeta":{"fields":{"ipfsJson":{"id":1,"rule":"required","type":"string"},"gender":{"id":2,"rule":"required","type":"Gender"},"traits":{"id":3,"rule":"repeated","type":"PunkTrait"}}},"Gender":{"options":{"Female":"{\"en\": \"Female\"}","Male":"{\"en\": \"Male\"}"},"values":{"Female":1,"Male":0}},"PunkTrait":{"options":{"SMILE":"{\"en\": \"Smile\"}","SUNGLASSES":"{\"en\": \"Sunglasses\"}","MUSTACHE":"{\"en\": \"Mustache\"}","BALD":"{\"en\": \"Bald\"}"},"values":{"SMILE":0,"SUNGLASSES":1,"MUSTACHE":2,"BALD":3}}}}}}');
```


### setNFTCollectionVariableOnChainSchema
```typescript
async setNFTCollectionVariableOnChainSchema(signer: IKeyringPair, collectionId: Number, schema): Promise<boolean>
```
Sets the schema for the variable data of the collection tokens (`variableData` token field). Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.setNFTCollectionVariableOnChainSchema(signer, 1, 'abc');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.setVariableOnChainSchema(signer, 'abc');
```


### changeNFTCollectionOwner
```typescript
async changeNFTCollectionOwner(signer: IKeyringPair, collectionId: Number, ownerAddress: string): Promise<boolean>
```

Changes the owner of the collection to the new Substrate address. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.changeNFTCollectionOwner(signer, 1, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.changeOwner(signer, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
```


### addNFTCollectionAdmin
```typescript
async addNFTCollectionAdmin(signer: IKeyringPair, collectionId: Number, adminAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Adds a collection administrator. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.addNFTCollectionAdmin(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.addAdmin(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### removeNFTCollectionAdmin
```typescript
async removeNFTCollectionAdmin(signer: IKeyringPair, collectionId: Number, adminAddressObj: {Substrate?: string, Ethereum?: string}): Promise<boolean>
```

Removes a collection administrator. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await uniqueHelper.removeNFTCollectionAdmin(signer, 1, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let success = await collection.removeAdmin(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'});
```


### mintNFTToken
```typescript
async mintNFTToken(
  signer: IKeyringPair,
  {
    collectionId: Number,
    owner: string | {Substrate?: string, Ethereum?: string},
    constData?: string,
    variableData?: string
  }
): Promise<{
  success: boolean,
  token: {
    tokenId: Number,
    collectionId: Number,
    owner: {substrate?: string, ethereum?: string}
  }
}>
```

Mints a single new token to the collection. Take special note of the `constData` parameter because once the token is minted this parameter cannot be modified (it’s baked in). Returns an object with the transaction result.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.mintNFTToken(signer, {collectionId: 1, owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, constData: '0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020002'});
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.mintToken(signer, {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, '0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020002');
```


### mintMultipleNFTTokens
```typescript
async mintMultipleNFTTokens(
  signer: IKeyringPair,
  collectionId: Number,
  tokens: ({
    owner: {Substrate?: string, Ethereum?: string},
    constData?: string,
    variableData?: string}
  )[]
): Promise<{
  success: boolean,
  tokens: ({
    tokenId: Number,
    collectionId: Number,
    owner: {substrate?: string, ethereum?: string}
  })[]
}>
```

Mints several new tokens at once to the collection (up to a 100 at a time). Take special note of the `constData` parameter because once the token is minted this parameter cannot be modified (it’s baked in). Returns an object with the transaction result.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.mintMultipleNFTTokens(signer, 1, [
  { owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, variableData: 'alice token'},
  { owner: {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}, variableData: 'bob token'}
]);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await collection.mintMultipleTokens(signer, [
  { owner: {Substrate: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'}, variableData: 'alice token'},
  { owner: {Substrate: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'}, variableData: 'bob token'}
]);
```


### burnNFTToken
```typescript
async burnNFTToken(signer: IKeyringPair, collectionId: Number, tokenId: Number): Promise<{
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
let result = await uniqueHelper.burnNFTToken(signer, 1, 1);
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = uniqueHelper.getCollectionObject(1);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = collection.burnToken(signer, 1);
```


### changeNFTTokenVariableData
```typescript
async changeNFTTokenVariableData(signer: IKeyringPair, collectionId: Number, tokenId: Number): Promise<boolean>
```

Changes `variableData` of the token. Returns bool true on success.

Example:
```javascript
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = await uniqueHelper.changeNFTTokenVariableData(signer, 1, 1, 'alice token');
```

Alternative way via the UniqueNFTCollection:
```javascript
let collection = new UniqueNFTCollection(1, uniqueHelper);
let signer = uniqueHelper.util.fromSeed('//Alice');
let result = collection.changeTokenVariableData(signer, 1, 'alice token');
```


### util.fromSeed
```typescript
util.fromSeed(seed: string): IKeyringPair
```

Creates a pair in the Keyring based on the passed seed phrase. The pair can be used to sign transactions. All UniqueHelper methods accept a signer in this format.

Example:
```javascript
let alice = uniqueHelper.fromSeed('//Alice');
```


### util.normalizeSubstrateAddress
```typescript
util.normalizeSubstrateAddress(address: string): string
```

Normalizes the given Substrate address from the chain format to the default ss58 format (42)

Example:
```javascript
let aliceNormalized = uniqueHelper.util.normalizeSubstrateAddress('yGHXkYLYqxijLKKfd9Q2CB9shRVu8rPNBS53wvwGTutYg4zTg'); // 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

## UniqueSchemaHelper

A set of methods for working with collection schema in the Protobuf format. This type of schema is used in the Unique Network's own collections and projects.

```typescript
constructor(
  logger: {
    log: (msg: string | array, level: string): viod,
    level: {ERROR: "ERROR", WARNING: "WARNING", INFO: "INFO", DEBUG: "DEBUG", NONE: "NONE"}
  }
)
```

Example:
```javascript
const Logger = require('./lib/logger');
const schemaHelper = new UniqueSchemaHelper(new Logger());
```

### decodeSchema
```typescript
decodeSchema(schema: string | object): {json: object, NFTMeta: null | protobufjs.Type}
```

Decodes the schema in the Protobuf format. Returns the type that can be used to decode the data.

Example:
```javascript
let schema = schemaHelper.decodeSchema('{"nested":{"onChainMetaData":{"nested":{"NFTMeta":{"fields":{"ipfsJson":{"id":1,"rule":"required","type":"string"},"gender":{"id":2,"rule":"required","type":"Gender"},"traits":{"id":3,"rule":"repeated","type":"PunkTrait"}}},"Gender":{"options":{"Female":"{\"en\": \"Female\"}","Male":"{\"en\": \"Male\"}"},"values":{"Female":1,"Male":0}},"PunkTrait":{"options":{"SMILE":"{\"en\": \"Smile\"}","SUNGLASSES":"{\"en\": \"Sunglasses\"}","MUSTACHE":"{\"en\": \"Mustache\"}","BALD":"{\"en\": \"Bald\"}"},"values":{"SMILE":0,"SUNGLASSES":1,"MUSTACHE":2,"BALD":3}}}}}}');
```

### decodeData
```typescript
decodeData(schema: string | {json: object, NFTMeta: protobufjs.Type}, data: string): {data: string | object, human: null | object}
```

Decodes the given tokens according to the collection schema. Returns both the data itself and its human-readable format, with keys instead of constants.

Example:
```javascript
let data = schemaHelper.decodeData(schema, '0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020002');
//{
//  data: {
//    traits: [0,2],
//    ipfsJson: "{\"ipfs\":\"QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb\",\"type\":\"image\"}",
//    gender: 0
//  },
//  human: {
//    ipfsJson: "{\"ipfs\":\"QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb\",\"type\":\"image\"}",
//    gender: "Male",
//    traits: ["SMILE", "MUSTACHE"]
//  }
//}
```


### encodeData
```typescript
encodeData(schema: string | {json: object, NFTMeta: protobufjs.Type}, payload: object): string
```

Encodes the token data into the Protobuf format according to the passed collection schema. Returns the encoded string.

Example:
```javascript
let encodedData = schemaHelper.encodeData(schema, {
  traits: [0, 2],
  ipfsJson: "{\"ipfs\":\"QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb\",\"type\":\"image\"}",
  gender: 0
}); // 0x0a487b2269706673223a22516d533859586766474b6754556e6a4150744566337566356b345972464c503275446359754e79474c6e45694e62222c2274797065223a22696d616765227d10001a020002
```

### validateData
```typescript
validateData(schema: string | {json: object, NFTMeta: protobufjs.Type}, payload: object): {success: boolean, error: null | Error}
```

Checks that the given data matches the passed schema. Returns an object with the test result.

Example:
```javascript
let validData = schemaHelper.validateData(schema, {
  traits: [0, 2],
  ipfsJson: "{\"ipfs\":\"QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb\",\"type\":\"image\"}",
  gender: 0
}); // {success: true, error: null}

let invalidData = schemaHelper.validateData(schema, {
  traits: [5],
  ipfsJson: "{\"ipfs\":\"QmS8YXgfGKgTUnjAPtEf3uf5k4YrFLP2uDcYuNyGLnEiNb\",\"type\":\"image\"}",
  gender: 0
}); // {success: false, error: Error('traits: enum value[] expected')}
```
