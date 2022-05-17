const protobuf = require('protobufjs')
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { hexToU8a } = require('@polkadot/util');
const { encodeAddress, decodeAddress } = require('@polkadot/util-crypto');


class UniqueUtil {
  static transactionStatus = {
    NOT_READY: 'NotReady',
    FAIL: 'Fail',
    SUCCESS: 'Success'
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


class UniqueSchemaHelper {
  constructor(logger) {
    this.util = UniqueUtil;
    if (typeof logger == 'undefined') logger = this.util.getDefaultLogger();
    this.logger = logger;
  }

  decodeSchema(schema) {
    const protoJson = typeof schema === 'string' ? JSON.parse(schema) : schema;
    const root = protobuf.Root.fromJSON(protoJson);

    let data = {json: protoJson, NFTMeta: null}

    try {
      data.NFTMeta = root.lookupType('onChainMetaData.NFTMeta');
    } catch (e) {
    }

    return data;
  }

  decodeData(schema, data) {
    if (typeof schema === 'string') schema = this.decodeSchema(schema);
    if (schema.NFTMeta === null) return {data: data, human: null};

    let tokenDataBuffer;
    try {
      tokenDataBuffer = hexToU8a(data);
    } catch (e) {
      this.logger.log(e, this.logger.level.WARNING)
      return {data: data, human: null}
    }

    let message = schema.NFTMeta.decode(tokenDataBuffer), humanObj = message.toJSON();

    let obj = schema.NFTMeta.toObject(message, {
      longs: String,  // longs as strings (requires long.js)
      bytes: String,  // bytes as base64 encoded strings
      defaults: true, // includes default values
      arrays: true,   // populates empty arrays (repeated fields) even if defaults=false
      objects: true,  // populates empty objects (map fields) even if defaults=false
      oneofs: true
    });

    return {data: obj, human: humanObj};
  }

  validateData(schema, payload) {
    if (typeof schema === 'string') schema = this.decodeSchema(schema);

    try {
      const NFTMeta = schema.NFTMeta;

      const errMsg = NFTMeta.verify(payload);

      if (errMsg) {
        return {success: false, error: Error(errMsg)};
      }
    }
    catch(e) {
      return {success: false, error: e};
    }
    return {success: true, error: null};
  }

  encodeDataBuffer(schema, payload) {
    if (typeof schema === 'string') schema = this.decodeSchema(schema);

    try {
      const NFTMeta = schema.NFTMeta;

      const errMsg = NFTMeta.verify(payload);

      if (errMsg) {
        throw Error(errMsg);
      }

      const message = NFTMeta.create(payload);

      return NFTMeta.encode(message).finish();
    } catch (e) {
      this.logger.log('encodeDataBuffer error', this.logger.level.WARNING);
      this.logger.log(e, this.logger.level.ERROR);
    }

    return new Uint8Array(0);
  }

  encodeData(schema, payload) {
    return '0x' + Buffer.from(this.encodeDataBuffer(schema, payload)).toString('hex');
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

  async getToken(collectionId, tokenId, blockHashAt) {
    const tokenData = (await (typeof blockHashAt === 'undefined' ? this.api.query.nonfungible.tokenData(collectionId, tokenId) : this.api.query.nonfungible.tokenData.at(blockHashAt, collectionId, tokenId))).toHuman();
    if (tokenData === null) return null;
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

  async setNFTCollectionSchemaVersion(signer, collectionId, schemaVersion, label='schema version', transactionLabel='api.tx.unique.setSchemaVersion') {
    let result;
    try {
      result = await this.signTransaction(
        signer,
        this.api.tx.unique.setSchemaVersion(collectionId, schemaVersion),
        transactionLabel
      );
    }
    catch(e) {
      if(e.toString().indexOf('Cannot map Enum JSON') > -1) throw Error(`Unable to set collection schema version for label ${label}: invalid schema version "${schemaVersion}"`);
    }
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection schema version for ${label}`);
    }

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'SchemaVersionSet', label);
  }

  async setNFTCollectionOffchainSchema(signer, collectionId, offchainSchema, label='offchain schema', transactionLabel='api.tx.unique.setOffchainSchema') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setOffchainSchema(collectionId, offchainSchema),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection offchain schema for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'OffchainSchemaSet', label);
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

  async setNFTCollectionConstOnChainSchema(signer, collectionId, schema, label='collection constOnChainSchema', transactionLabel='api.tx.unique.setConstOnChainSchema') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setConstOnChainSchema(collectionId, schema),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection constOnChainSchema for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'ConstOnChainSchemaSet', label);
  }

  async setNFTCollectionVariableOnChainSchema(signer, collectionId, schema, label='collection variableOnChainSchema', transactionLabel='api.tx.unique.setVariableOnChainSchema') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.setVariableOnChainSchema(collectionId, schema),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to set collection variableOnChainSchema for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'VariableOnChainSchemaSet', label);
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

  async mintNFTToken(signer, { collectionId, owner, constData, variableData }, label = 'new token', transactionLabel = 'api.tx.unique.createItem') {
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createItem(collectionId, (owner.Substrate || owner.Ethereum) ? owner : {Substrate: owner}, {
        nft: {
          const_data: constData,
          variable_data: variableData
        }
      }),
      transactionLabel
    );
    const createdTokens = this.util.extractTokensFromCreationResult(creationResult, label);
    if (createdTokens.tokens.length > 1) throw Error('Created multiple tokens');
    return {success: createdTokens.success, token: createdTokens.tokens.length > 0 ? createdTokens.tokens[0] : null}
  }

  async mintMultipleNFTTokens(signer, collectionId, tokens, label = 'new tokens', transactionLabel = 'api.tx.unique.createMultipleItemsEx') {
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createMultipleItemsEx(collectionId, {NFT: tokens}),
      transactionLabel
    );
    return this.util.extractTokensFromCreationResult(creationResult, label);
  }

  async mintMultipleNFTTokensWithOneOwner(signer, collectionId, owner, tokens, label = 'new tokens', transactionLabel = 'api.tx.unique.createMultipleItems') {
    let rawTokens = [];
    for (let token of tokens) {
      let raw = {NFT: {constData: token.constData}};
      if (token.variableData) raw.NFT.variableData = token.variableData;
      rawTokens.push(raw);
    }
    const creationResult = await this.signTransaction(
      signer,
      this.api.tx.unique.createMultipleItems(collectionId, {Substrate: owner}, rawTokens),
      transactionLabel
    );
    return this.util.extractTokensFromCreationResult(creationResult, label);
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

  async changeNFTTokenVariableData(signer, collectionId, tokenId, variableData, label='token with variableData', transactionLabel='api.tx.unique.setVariableMetaData') {
    const changeResult = await this.signTransaction(
      signer,
      this.api.tx.unique.setVariableMetaData(collectionId, tokenId, variableData),
      transactionLabel
    );
    return changeResult.status === this.transactionStatus.SUCCESS;
  }
}

class UniqueNFTCollection {
  constructor(collectionId, uniqueHelper) {
    this.collectionId = collectionId;
    this.uniqueHelper = uniqueHelper;
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

  async setSchemaVersion(signer, schemaVersion, label) {
    return await this.uniqueHelper.setNFTCollectionSchemaVersion(signer, this.collectionId, schemaVersion, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async setOffchainSchema(signer, offchainSchema, label) {
    return await this.uniqueHelper.setNFTCollectionOffchainSchema(signer, this.collectionId, offchainSchema, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
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

  async setConstOnChainSchema(signer, schema, label) {
    return await this.uniqueHelper.setNFTCollectionConstOnChainSchema(signer, this.collectionId, schema, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async setVariableOnChainSchema(signer, schema, label) {
    return await this.uniqueHelper.setNFTCollectionVariableOnChainSchema(signer, this.collectionId, schema, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
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

  async mintToken(signer, owner, constData, variableData, label) {
    return await this.uniqueHelper.mintNFTToken(signer, {collectionId: this.collectionId, owner, constData, variableData}, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async mintMultipleTokens(signer, tokens, label) {
    return await this.uniqueHelper.mintMultipleNFTTokens(signer, this.collectionId, tokens, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async burnToken(signer, tokenId, label) {
    return await this.uniqueHelper.burnNFTToken(signer, this.collectionId, tokenId, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async changeTokenVariableData(signer, tokenId, variableData, label) {
    return await this.uniqueHelper.changeNFTTokenVariableData(signer, this.collectionId, tokenId, variableData, typeof label === 'undefined' ? `collection #${this.collectionId}` : label);
  }

  async getTokenNextSponsored(tokenId, addressObj) {
    return await this.uniqueHelper.getCollectionTokenNextSponsored(this.collectionId, tokenId, addressObj);
  }
}

module.exports = {
  UniqueHelper, UniqueSchemaHelper, UniqueUtil
};
