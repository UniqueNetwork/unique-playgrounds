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

  async getCollection(collectionId) {
    const collection = await this.api.query.common.collectionById(collectionId);
    let humanCollection = collection.toHuman(), collectionData = {
      id: collectionId, name: null, description: null, tokensCount: 0, admins: [],
      raw: humanCollection
    };
    if (humanCollection === null) return null;
    collectionData.raw.owner = this.util.normalizeSubstrateAddress(collectionData.raw.owner);
    for (let key of ['name', 'description']) {
      collectionData[key] = this.util.vec2str(humanCollection[key]);
    }
    collectionData['tokensCount'] = (await this.api.rpc.unique.lastTokenId(collectionId)).toJSON();
    collectionData['admins'] = (await this.api.rpc.unique.adminlist(collectionId)).toHuman();
    return collectionData;
  }

  async getToken(collectionId, tokenId) {
    const tokenData = (await this.api.query.nonfungible.tokenData(collectionId, tokenId)).toHuman();
    if (tokenData === null) return null;
    let owner = {};
    for (let key of Object.keys(tokenData.owner)) {
      owner[key.toLocaleLowerCase()] = key.toLocaleLowerCase() === 'substrate' ? this.util.normalizeSubstrateAddress(tokenData.owner[key]) : tokenData.owner[key];
    }
    tokenData.owner = owner;
    return tokenData;
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
    return this.util.extractCollectionIdFromCreationResult(creationResult, label);
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

  async addNFTCollectionAdmin(signer, collectionId, adminAddress, label='collection admin', transactionLabel='api.tx.unique.addCollectionAdmin') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.addCollectionAdmin(collectionId, adminAddress),
      transactionLabel
    );
    if (result.status !== this.transactionStatus.SUCCESS) {
      throw Error(`Unable to add collection admin for ${label}`);
    }
    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminAdded', label);
  }

  async removeNFTCollectionAdmin(signer, collectionId, adminAddress, label='collection admin', transactionLabel='api.tx.unique.removeCollectionAdmin') {
    const result = await this.signTransaction(
      signer,
      this.api.tx.unique.removeCollectionAdmin(collectionId, adminAddress),
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
    return this.util.extractCollectionIdFromCreationResult(creationResult, label);
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
}

module.exports = {
  UniqueHelper, UniqueSchemaHelper, UniqueUtil
};
