const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { encodeAddress, decodeAddress } = require('@polkadot/util-crypto');


const nesting = {
  web3: null,
  loadWeb3() {
    if(this.web3 !== null) return this.web3;
    try {
      this.web3 = require('web3');
    }
    catch (e) {
      throw Error('You need web3 installed to use nesting');
    }
    return this.web3;
  },
  encodeIntBE(v) {
    if (v >= 0xffffffff || v < 0) throw new Error('id overflow');
    return [
      v >> 24,
      (v >> 16) & 0xff,
      (v >> 8) & 0xff,
      v & 0xff,
    ];
  },
  tokenIdToAddress(collectionId, tokenId) {
    const buf = Buffer.from([
      0xf8, 0x23, 0x8c, 0xcf, 0xff, 0x8e, 0xd8, 0x87, 0x46, 0x3f, 0xd5, 0xe0,
      ...this.encodeIntBE(collectionId),
      ...this.encodeIntBE(tokenId),
    ]);
    return this.loadWeb3().utils.toChecksumAddress('0x' + buf.toString('hex'));
  }
}

class UniqueUtil {
  static transactionStatus = {
    NOT_READY: 'NotReady',
    FAIL: 'Fail',
    SUCCESS: 'Success'
  }

  static getNestingTokenAddress(collectionId, tokenId) {
    return nesting.tokenIdToAddress(collectionId, tokenId);
  }

  static getDefaultLogger() {
    return {
      log(msg, level = 'INFO') {
        console[level.toLocaleLowerCase() === 'error' ? 'error' : 'log'](...(Array.isArray(msg) ? msg : [msg]));
      },
      level: {
        ERROR: 'ERROR',
        WARNING: 'WARNING',
        INFO: 'INFO'
      }
    };
  }

  static vec2str(arr) {
    return arr.map(x => String.fromCharCode(parseInt(x))).join('');
  }

  static str2vec(string) {
    if (typeof string !== 'string') return string;
    return Array.from(string).map(x => x.charCodeAt(0));
  }

  static fromSeed(seed) {
    const keyring = new Keyring({type: 'sr25519'});
    return keyring.addFromUri(seed);
  }

  static normalizeSubstrateAddress(address) {
    return encodeAddress(decodeAddress(address));
  }

  static extractCollectionIdFromCreationResult(creationResult, label = 'new collection') {
    if (creationResult.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to create collection for ${label}`);
    }

    let collectionId = null;
    creationResult.result.events.forEach(({event: {data, method, section}}) => {
      if ((section === 'common') && (method === 'CollectionCreated')) {
        collectionId = parseInt(data[0].toString(), 10);
      }
    });

    if (collectionId === null) {
      throw Error(`No CollectionCreated event for ${label}`)
    }

    return collectionId;
  }

  static extractTokensFromCreationResult(creationResult, label = 'new tokens') {
    if (creationResult.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to create tokens for ${label}`);
    }
    let success = false, tokens = [];
    creationResult.result.events.forEach(({event: {data, method, section}}) => {
      if (method === 'ExtrinsicSuccess') {
        success = true;
      } else if ((section === 'common') && (method === 'ItemCreated')) {
        tokens.push({
          collectionId: parseInt(data[0].toString(), 10),
          tokenId: parseInt(data[1].toString(), 10),
          owner: data[2].toJSON()
        });
      }
    });
    return {success, tokens};
  }

  static extractTokensFromBurnResult(burnResult, label = 'burned tokens') {
    if (burnResult.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to burn tokens for ${label}`);
    }
    let success = false, tokens = [];
    burnResult.result.events.forEach(({event: {data, method, section}}) => {
      if (method === 'ExtrinsicSuccess') {
        success = true;
      } else if ((section === 'common') && (method === 'ItemDestroyed')) {
        tokens.push({
          collectionId: parseInt(data[0].toString(), 10),
          tokenId: parseInt(data[1].toString(), 10),
          owner: data[2].toJSON()
        });
      }
    });
    return {success, tokens};
  }

  static findCollectionInEvents(events, collectionId, expectedSection, expectedMethod, label) {
    let eventId = null;
    events.forEach(({event: {data, method, section}}) => {
      if ((section === expectedSection) && (method === expectedMethod)) {
        eventId = parseInt(data[0].toString(), 10);
      }
    });

    if (eventId === null) {
      throw Error(`No ${expectedMethod} event for ${label}`);
    }
    return eventId === collectionId;
  }

  static isTokenTransferSuccess(events, collectionId, tokenId, fromAddressObj, toAddressObj) {
    const normalizeAddress = address => {
      if(address.Substrate) return {Substrate: this.normalizeSubstrateAddress(address.Substrate)};
      if(address.Ethereum) return {Ethereum: address.Ethereum.toLocaleLowerCase()};
      return address;
    }
    let transfer = {collectionId: null, tokenId: null, from: null, to: null, amount: 1};
    events.forEach(({event: {data, method, section}}) => {
      if ((section === 'common') && (method === 'Transfer')) {
        let hData = data.toHuman();
        transfer = {
          collectionId: parseInt(hData[0]),
          tokenId: parseInt(hData[1]),
          from: normalizeAddress(hData[2]),
          to: normalizeAddress(hData[3]),
          amount: parseInt(hData[4])
        };
      }
    });
    let isSuccess = parseInt(collectionId) === transfer.collectionId && parseInt(tokenId) === transfer.tokenId;
    isSuccess = isSuccess && JSON.stringify(normalizeAddress(fromAddressObj)) === JSON.stringify(transfer.from);
    isSuccess = isSuccess && JSON.stringify(normalizeAddress(toAddressObj)) === JSON.stringify(transfer.to);
    isSuccess = isSuccess && 1 === transfer.amount;
    return isSuccess;
  }
}


class UniqueHelper {
  transactionStatus = UniqueUtil.transactionStatus;

  constructor(logger) {
    this.util = UniqueUtil;
    if (typeof logger == 'undefined') logger = this.util.getDefaultLogger();
    this.logger = logger;
    this.api = null;
  }

  async connect(wsEndpoint, listeners) {
    if (this.api !== null) throw Error('Already connected');
    this.api = await this.constructor.createConnection(wsEndpoint, listeners);
  }

  async disconnect() {
    if (this.api === null) return;
    await this.api.disconnect();
    this.api = null;
  }

  static async createConnection(wsEndpoint, listeners) {
    const api = new ApiPromise({
      provider: new WsProvider(wsEndpoint),
      rpc: {
        unique: require('@unique-nft/types/definitions').unique.rpc
      }
    });
    if (typeof listeners === 'undefined') listeners = {};
    for (let event of ['connected', 'disconnected', 'error', 'ready', 'decorated']) {
      if (!listeners.hasOwnProperty(event)) continue;
      api.on(event, listeners[event]);
    }

    await api.isReady;

    return api;
  }

  getTransactionStatus({events, status}) {
    if (status.isReady) {
      return this.transactionStatus.NOT_READY;
    }
    if (status.isBroadcast) {
      return this.transactionStatus.NOT_READY;
    }
    if (status.isInBlock || status.isFinalized) {
      const errors = events.filter(e => e.event.data.method === 'ExtrinsicFailed');
      if (errors.length > 0) {
        return this.transactionStatus.FAIL;
      }
      if (events.filter(e => e.event.data.method === 'ExtrinsicSuccess').length > 0) {
        return this.transactionStatus.SUCCESS;
      }
    }

    return this.transactionStatus.FAIL;
  }

  signTransaction(sender, transaction, label = 'transaction') {
    return new Promise(async (resolve, reject) => {
      try {
        let unsub = await transaction.signAndSend(sender, result => {
          const status = this.getTransactionStatus(result);

          if (status === this.transactionStatus.SUCCESS) {
            this.logger.log(`${label} successful`);
            resolve({result, status});
            unsub();
          } else if (status === this.transactionStatus.FAIL) {
            this.logger.log(`Something went wrong with ${label}. Status: ${status}`, this.logger.level.ERROR);
            reject({result, status});
            unsub();
          }
        });
      } catch (e) {
        this.logger.log(e, this.logger.level.ERROR);
        reject(e);
      }
    });
  }

  async getCollectionTokenNextSponsored(collectionId, tokenId, addressObj) {
    return (await this.api.rpc.unique.nextSponsored(collectionId, addressObj, tokenId)).toJSON();
  }

  async getChainProperties() {
    return (await this.api.registry.getChainProperties()).toHuman();
  }

  async getLatestBlockNumber() {
    return (await this.api.rpc.chain.getHeader()).number.toNumber();
  }

  async getBlockHashByNumber(blockNumber) {
    const blockHash = (await this.api.rpc.chain.getBlockHash(blockNumber)).toJSON();
    if(blockHash === '0x0000000000000000000000000000000000000000000000000000000000000000') return null;
    return blockHash;
  }

  async getOneTokenNominal() {
    const chainProperties = await this.getChainProperties();
    return 10n ** BigInt((chainProperties.tokenDecimals || ['18'])[0]);
  }

  async normalizeSubstrateAddressToChainFormat(address) {
    let info = await this.getChainProperties();
    return encodeAddress(decodeAddress(address), parseInt(info.ss58Format));
  }

  async getSubstrateAccountBalance(address) {
    return (await this.api.query.system.account(address)).data.free.toBigInt();
  }

  async getEthereumAccountBalance(address) {
    return (await this.api.rpc.eth.getBalance(address)).toBigInt();
  }

  async transferBalanceToSubstrateAccount(signer, address, amount, transactionLabel='api.tx.balances.transfer') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.balances.transfer(address, amount),
      transactionLabel
    );
    let transfer = {from: null, to: null, amount: 0n};
    result.result.events.forEach(({event: {data, method, section}}) => {
      if ((section === 'balances') && (method === 'Transfer')) {
        transfer = {
          from: this.util.normalizeSubstrateAddress(data[0]),
          to: this.util.normalizeSubstrateAddress(data[1]),
          amount: BigInt(data[2])
        };
      }
    });
    let isSuccess = this.util.normalizeSubstrateAddress(signer.address) === transfer.from;
    isSuccess = isSuccess && this.util.normalizeSubstrateAddress(address) === transfer.to;
    isSuccess = isSuccess && BigInt(amount) === transfer.amount;
    return isSuccess;
  }

  async getTotalCollectionsCount() {
    return (await this.api.rpc.unique.collectionStats()).created.toNumber();
  }

  async getCollection(collectionId) {
    const collection = await this.api.rpc.unique.collectionById(collectionId);
    let humanCollection = collection.toHuman(), collectionData = {
      id: collectionId, name: null, description: null, tokensCount: 0, admins: [],
      raw: humanCollection
    };
    if (humanCollection === null) return null;
    collectionData.raw.limits = collection.toJSON().limits;
    collectionData.normalizedOwner = this.util.normalizeSubstrateAddress(collectionData.raw.owner);
    for (let key of ['name', 'description']) {
      collectionData[key] = this.util.vec2str(humanCollection[key]);
    }

    collectionData.tokensCount = await this.getCollectionLastTokenId(collectionId);
    collectionData.admins = await this.getCollectionAdmins(collectionId);

    return collectionData;
  }

  getCollectionObject(collectionId) {
    return new UniqueNFTCollection(collectionId, this);
  }

  getCollectionTokenObject(collectionId, tokenId) {
    return new UniqueNFTToken(tokenId, this.getCollectionObject(collectionId));
  }

  async getCollectionAdmins(collectionId) {
    let normalized = [];
    for(let admin of (await this.api.rpc.unique.adminlist(collectionId)).toHuman()) {
      if(admin.Substrate) normalized.push({Substrate: this.util.normalizeSubstrateAddress(admin.Substrate)});
      else normalized.push(admin);
    }
    return normalized;
  }

  async getCollectionTokensByAddress(collectionId, addressObj) {
    return (await this.api.rpc.unique.accountTokens(collectionId, addressObj)).toJSON()
  }

  async getCollectionEffectiveLimits(collectionId) {
    return (await this.api.rpc.unique.effectiveCollectionLimits(collectionId)).toJSON();
  }

  async isCollectionTokenExists(collectionId, tokenId) {
    return (await this.api.rpc.unique.tokenExists(collectionId, tokenId)).toJSON()
  }

  async getCollectionLastTokenId(collectionId) {
    return (await this.api.rpc.unique.lastTokenId(collectionId)).toNumber();
  }

  async getToken(collectionId, tokenId, blockHashAt, propertyKeys) {
    let tokenData;
    if(typeof blockHashAt === 'undefined') {
      tokenData = await this.api.rpc.unique.tokenData(collectionId, tokenId);
    }
    else {
      if(typeof propertyKeys === 'undefined') {
        let collection = (await this.api.rpc.unique.collectionById(collectionId)).toHuman();
        if(!collection) return null;
        propertyKeys = collection.tokenPropertyPermissions.map(x => x.key);
      }
      tokenData = await this.api.rpc.unique.tokenData(collectionId, tokenId, propertyKeys, blockHashAt);
    }
    tokenData = tokenData.toHuman();
    if (tokenData === null || tokenData.owner === null) return null;
    let owner = {};
    for (let key of Object.keys(tokenData.owner)) {
      owner[key.toLocaleLowerCase()] = key.toLocaleLowerCase() === 'substrate' ? this.util.normalizeSubstrateAddress(tokenData.owner[key]) : tokenData.owner[key];
    }
    tokenData.normalizedOwner = owner;
    return tokenData;
  }

  async transferNFTToken(signer, collectionId, tokenId, addressObj, transactionLabel='api.tx.unique.transfer') {
    let result = await this.signTransaction(
      signer,
      this.api.tx.unique.transfer(addressObj, collectionId, tokenId, 1),
      transactionLabel
    );
    return this.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, {Substrate: signer.address}, addressObj);
  }

  async transferNFTTokenFrom(signer, collectionId, tokenId, fromAddressObj, toAddressObj, transactionLabel='api.tx.unique.transferFrom') {
    let result = await this.signTransaction(
      signer,
      this.api.tx.unique.transferFrom(fromAddressObj, toAddressObj, collectionId, tokenId, 1),
      transactionLabel
    );
    return this.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async mintNFTCollection(signer, collectionOptions, label = 'new collection', transactionLabel = 'api.tx.unique.createCollectionEx') {
    collectionOptions = JSON.parse(JSON.stringify(collectionOptions)); // Clone object
    collectionOptions.mode = {nft: null}; // this is NFT collection
    for (let key of ['name', 'description', 'tokenPrefix']) {
      if (typeof collectionOptions[key] === 'string') collectionOptions[key] = this.util.str2vec(collectionOptions[key]);
    }
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createCollectionEx(collectionOptions),
      transactionLabel
    );
    return this.getCollectionObject(this.util.extractCollectionIdFromCreationResult(creationResult, label));
  }

  async burnNFTCollection(signer, collectionId, label='collection to burn', transactionLabel='api.tx.destroyCollection') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.destroyCollection(collectionId),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to burn collection for ${label}`);
    }

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionDestroyed', label);
  }

  async setNFTCollectionSponsor(signer, collectionId, sponsorAddress, label='sponsor', transactionLabel='api.tx.unique.setCollectionSponsor') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setCollectionSponsor(collectionId, sponsorAddress),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection sponsor for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionSponsorSet', label);
  }

  async confirmNFTCollectionSponsorship(signer, collectionId, label='confirm sponsorship', transactionLabel='api.tx.unique.confirmSponsorship') {
    let result;
    try {
      result = await this.signTransaction(
        signer,
        this.api.tx.unique.confirmSponsorship(collectionId),
        transactionLabel
      );
    }
    catch(e) {
      if(e.status === this.util.transactionStatus.FAIL) throw Error(`Unable to confirm collection sponsorship for ${label}`);
    }
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to confirm collection sponsorship for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'SponsorshipConfirmed', label);
  }

  async setNFTCollectionLimits(signer, collectionId, limits, label='collection limits', transactionLabel='api.tx.unique.setCollectionLimits') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setCollectionLimits(collectionId, limits),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection limits for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionLimitSet', label);
  }

  async changeNFTCollectionOwner(signer, collectionId, ownerAddress, label='collection owner', transactionLabel='api.tx.unique.changeCollectionOwner') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.changeCollectionOwner(collectionId, ownerAddress),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to change collection owner for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionOwnedChanged', label);
  }

  async addNFTCollectionAdmin(signer, collectionId, adminAddressObj, label='collection admin', transactionLabel='api.tx.unique.addCollectionAdmin') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.addCollectionAdmin(collectionId, adminAddressObj),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to add collection admin for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminAdded', label);
  }

  async removeNFTCollectionAdmin(signer, collectionId, adminAddressObj, label='collection admin', transactionLabel='api.tx.unique.removeCollectionAdmin') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.removeCollectionAdmin(collectionId, adminAddressObj),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to remove collection admin for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminRemoved', label);
  }

  async mintNFTCollectionWithDefaults(signer, { name, description, tokenPrefix }, label = 'new collection', transactionLabel = 'api.tx.unique.createCollection') {
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createCollection(this.util.str2vec(name), this.util.str2vec(description), this.util.str2vec(tokenPrefix), {nft: null}),
      transactionLabel
    );
    return this.getCollectionObject(this.util.extractCollectionIdFromCreationResult(creationResult, label));
  }

  async mintNFTToken(signer, { collectionId, owner, properties }, label = 'new token', transactionLabel = 'api.tx.unique.createItem') {
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createItem(collectionId, (owner.Substrate || owner.Ethereum) ? owner : {Substrate: owner}, {
        nft: {
          properties
        }
      }),
      transactionLabel
    );
    const createdTokens = this.util.extractTokensFromCreationResult(creationResult, label);
    if (createdTokens.tokens.length > 1) throw Error('Created multiple tokens');
    return createdTokens.tokens.length > 0 ? this.getCollectionTokenObject(collectionId, createdTokens.tokens[0].tokenId) : null;
  }

  async mintMultipleNFTTokens(signer, collectionId, tokens, label = 'new tokens', transactionLabel = 'api.tx.unique.createMultipleItemsEx') {
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createMultipleItemsEx(collectionId, {NFT: tokens}),
      transactionLabel
    );
    const collection = this.getCollectionObject(collectionId);
    return this.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async mintMultipleNFTTokensWithOneOwner(signer, collectionId, owner, tokens, label = 'new tokens', transactionLabel = 'api.tx.unique.createMultipleItems') {
    let rawTokens = [];
    for (let token of tokens) {
      let raw = {NFT: {properties: token.properties}};
      rawTokens.push(raw);
    }
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createMultipleItems(collectionId, {Substrate: owner}, rawTokens),
      transactionLabel
    );
    const collection = this.getCollectionObject(collectionId);
    return this.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async burnNFTToken(signer, collectionId, tokenId, label = 'burned token', transactionLabel = 'api.tx.unique.burnItem') {
    const burnResult = await this.signTransaction(
      signer,
      this.api.tx.unique.burnItem(collectionId, tokenId, 1),
      transactionLabel
    );
    const burnedTokens = this.util.extractTokensFromBurnResult(burnResult, label);
    if (burnedTokens.tokens.length > 1) throw Error('Created multiple tokens');
    return {success: burnedTokens.success, token: burnedTokens.tokens.length > 0 ? burnedTokens.tokens[0] : null};
  }

  async setNFTTokenProperties(signer, collectionId, tokenId, properties, label='set properties', transactionLabel='api.tx.unique.setTokenProperties') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setTokenProperties(collectionId, tokenId, properties),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set token properties for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertySet', label);
  }

  async deleteNFTTokenProperties(signer, collectionId, tokenId, propertyKeys, label='delete properties', transactionLabel='api.tx.unique.deleteTokenProperties') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.deleteTokenProperties(collectionId, tokenId, propertyKeys),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to delete token properties for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertyDeleted', label);
  }

  async enableCollectionNesting(signer, collectionId, restrictedCollectionIds, label='enable nesting', transactionLabel='api.tx.unique.setCollectionPermissions') {
    let nestingRule = 'Owner'
    if(typeof restrictedCollectionIds !== 'undefined') {
      nestingRule = {OwnerRestricted: restrictedCollectionIds}
    }
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setCollectionPermissions(collectionId, {nesting: nestingRule}),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to enable nesting for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionPermissionSet', label);
  }

  async disableCollectionNesting(signer, collectionId, label='disable nesting', transactionLabel='api.tx.unique.setCollectionPermissions') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setCollectionPermissions(collectionId, {nesting: 'Disabled'}),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to disable nesting for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionPermissionSet', label);
  }

  async nestCollectionToken(signer, tokenObj, rootTokenObj, label='nest token', transactionLabel='api.tx.unique.transfer') {
    const rootTokenAddress = {Ethereum: this.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferNFTToken(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress, transactionLabel);
    if(!result) {
      throw Error(`Unable to nest token for ${label}`);
    }
    return result;
  }

  async unnestCollectionToken(signer, tokenObj, rootTokenObj, toAddressObj, label='unnest token', transactionLabel='api.tx.unique.transferFrom') {
    const rootTokenAddress = {Ethereum: this.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferNFTTokenFrom(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress, toAddressObj, transactionLabel);
    if(!result) {
      throw Error(`Unable to unnest token for ${label}`);
    }
    return result;
  }
}

class UniqueNFTCollection {
  constructor(collectionId, uniqueHelper) {
    this.collectionId = collectionId;
    this.uniqueHelper = uniqueHelper;
  }

  getTokenObject(tokenId) {
    return new UniqueNFTToken(tokenId, this);
  }

  async getData() {
    return await this.uniqueHelper.getCollection(this.collectionId);
  }

  async getAdmins() {
    return await this.uniqueHelper.getCollectionAdmins(this.collectionId);
  }

  async getTokensByAddress(addressObj) {
    return await this.uniqueHelper.getCollectionTokensByAddress(this.collectionId, addressObj);
  }

  async getEffectiveLimits() {
    return await this.uniqueHelper.getCollectionEffectiveLimits(this.collectionId);
  }

  async isTokenExists(tokenId) {
    return await this.uniqueHelper.isCollectionTokenExists(this.collectionId, tokenId);
  }

  async getLastTokenId() {
    return await this.uniqueHelper.getCollectionLastTokenId(this.collectionId);
  }

  async getToken(tokenId, blockHashAt) {
    return await this.uniqueHelper.getToken(this.collectionId, tokenId, blockHashAt);
  }

  async transferToken(signer, tokenId, addressObj) {
    return await this.uniqueHelper.transferNFTToken(signer, this.collectionId, tokenId, addressObj);
  }

  async transferTokenFrom(signer, tokenId, fromAddressObj, toAddressObj) {
    return await this.uniqueHelper.transferNFTTokenFrom(signer, this.collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async burn(signer, label) {
    return await this.uniqueHelper.burnNFTCollection(signer, this.collectionId, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async setSponsor(signer, sponsorAddress, label) {
    return await this.uniqueHelper.setNFTCollectionSponsor(signer, this.collectionId, sponsorAddress, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async confirmSponsorship(signer, label) {
    return await this.uniqueHelper.confirmNFTCollectionSponsorship(signer, this.collectionId, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async setLimits(signer, limits, label) {
    return await this.uniqueHelper.setNFTCollectionLimits(signer, this.collectionId, limits, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async changeOwner(signer, ownerAddress, label) {
    return await this.uniqueHelper.changeNFTCollectionOwner(signer, this.collectionId, ownerAddress, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async addAdmin(signer, adminAddressObj, label) {
    return await this.uniqueHelper.addNFTCollectionAdmin(signer, this.collectionId, adminAddressObj, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async removeAdmin(signer, adminAddressObj, label) {
    return await this.uniqueHelper.removeNFTCollectionAdmin(signer, this.collectionId, adminAddressObj, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async mintToken(signer, owner, properties, label) {
    return await this.uniqueHelper.mintNFTToken(signer, {collectionId: this.collectionId, owner, properties}, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async mintMultipleTokens(signer, tokens, label) {
    return await this.uniqueHelper.mintMultipleNFTTokens(signer, this.collectionId, tokens, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async burnToken(signer, tokenId, label) {
    return await this.uniqueHelper.burnNFTToken(signer, this.collectionId, tokenId, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async setTokenProperties(signer, tokenId, properties, label) {
    return await this.uniqueHelper.setNFTTokenProperties(signer, this.collectionId, tokenId, properties, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async deleteTokenProperties(signer, tokenId, propertyKeys, label) {
    return await this.uniqueHelper.deleteNFTTokenProperties(signer, this.collectionId, tokenId, propertyKeys, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async getTokenNextSponsored(tokenId, addressObj) {
    return await this.uniqueHelper.getCollectionTokenNextSponsored(this.collectionId, tokenId, addressObj);
  }

  async enableNesting(signer, restrictedCollectionIds, label) {
    return await this.uniqueHelper.enableCollectionNesting(signer, this.collectionId, restrictedCollectionIds, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async disableNesting(signer, label) {
    return await this.uniqueHelper.disableCollectionNesting(signer, this.collectionId, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async nestToken(signer, tokenId, toTokenObj, label) {
    return await this.uniqueHelper.nestCollectionToken(signer, {collectionId: this.collectionId, tokenId}, toTokenObj, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async unnestToken(signer, tokenId, fromTokenObj, toAddressObj, label) {
    return await this.uniqueHelper.unnestCollectionToken(signer, {collectionId: this.collectionId, tokenId}, fromTokenObj, toAddressObj, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }
}


class UniqueNFTToken {
  constructor(tokenId, collection) {
    this.collection = collection;
    this.collectionId = collection.collectionId;
    this.tokenId = tokenId;
  }

  async getData(blockHashAt) {
    return await this.collection.getToken(this.tokenId, blockHashAt);
  }

  async nest(signer, toTokenObj, label) {
    return await this.collection.nestToken(signer, this.tokenId, toTokenObj, label);
  }

  async unnest(signer, fromTokenObj, toAddressObj, label) {
    return await this.collection.unnestToken(signer, this.tokenId, fromTokenObj, toAddressObj, label);
  }

  async setProperties(signer, properties, label) {
    return await this.collection.setTokenProperties(signer, this.tokenId, properties, label);
  }

  async deleteProperties(signer, propertyKeys, label) {
    return await this.collection.deleteTokenProperties(signer, this.tokenId, propertyKeys, label);
  }

  async transfer(signer, addressObj) {
    return await this.collection.transferToken(signer, this.tokenId, addressObj);
  }

  async transferFrom(signer, fromAddressObj, toAddressObj) {
    return await this.collection.transferTokenFrom(signer, this.tokenId, fromAddressObj, toAddressObj);
  }

  async burn(signer, label) {
    return await this.collection.burnToken(signer, this.tokenId, label);
  }
}

module.exports = {
  UniqueHelper, UniqueUtil
};
