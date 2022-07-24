const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { encodeAddress, decodeAddress, keccakAsHex, evmToAddress, addressToEvm} = require('@polkadot/util-crypto');


const nesting = {
  toChecksumAddress(address) {
    if (typeof address === 'undefined') return '';

    if(!/^(0x)?[0-9a-f]{40}$/i.test(address)) throw new Error(`Given address "${address}" is not a valid Ethereum address.`);

    address = address.toLowerCase().replace(/^0x/i,'');
    const addressHash = keccakAsHex(address).replace(/^0x/i,''); // only here changed
    let checksumAddress = ['0x'];

    for (let i = 0; i < address.length; i++ ) {
      // If ith character is 8 to f then make it uppercase
      if (parseInt(addressHash[i], 16) > 7) {
        checksumAddress.push(address[i].toUpperCase());
      } else {
        checksumAddress.push(address[i]);
      }
    }
    return checksumAddress.join('');
  },
  tokenIdToAddress(collectionId, tokenId) {
    return this.toChecksumAddress(
      `0xf8238ccfff8ed887463fd5e0${collectionId.toString(16).padStart(8, '0')}${tokenId.toString(16).padStart(8, '0')}`
    );
  }
};


class UniqueUtil {
  static transactionStatus = {
    NOT_READY: 'NotReady',
    FAIL: 'Fail',
    SUCCESS: 'Success'
  }

  static chainLogType = {
    EXTRINSIC: 'extrinsic',
    RPC: 'rpc'
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
      if(typeof address === 'string') return address;
      let obj = {}
      Object.keys(address).forEach(k => {
        obj[k.toLocaleLowerCase()] = address[k];
      });
      if(obj.substrate) return {Substrate: this.normalizeSubstrateAddress(obj.substrate)};
      if(obj.ethereum) return {Ethereum: obj.ethereum.toLocaleLowerCase()};
      return address;
    }
    let transfer = {collectionId: null, tokenId: null, from: null, to: null, amount: 1};
    events.forEach(({event: {data, method, section}}) => {
      if ((section === 'common') && (method === 'Transfer')) {
        let hData = data.toJSON();
        transfer = {
          collectionId: hData[0],
          tokenId: hData[1],
          from: normalizeAddress(hData[2]),
          to: normalizeAddress(hData[3]),
          amount: hData[4]
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


class ChainHelperBase {
  transactionStatus = UniqueUtil.transactionStatus;
  chainLogType = UniqueUtil.chainLogType;

  constructor(logger) {
    this.util = UniqueUtil;
    if (typeof logger == 'undefined') logger = this.util.getDefaultLogger();
    this.logger = logger;
    this.api = null;
    this.forcedNetwork = null;
    this.network = null;
    this.chainLog = [];
  }

  clearChainLog() {
    this.chainLog = [];
  }

  forceNetwork(value) {
    this.forcedNetwork = value;
  }

  async connect(wsEndpoint, listeners) {
    if (this.api !== null) throw Error('Already connected');
    const { api, network } = await this.constructor.createConnection(wsEndpoint, listeners, this.forcedNetwork);
    this.api = api;
    this.network = network;
  }

  async disconnect() {
    if (this.api === null) return;
    await this.api.disconnect();
    this.api = null;
    this.network = null;
  }

  static async detectNetwork(api) {
    let spec = (await api.query.system.lastRuntimeUpgrade()).toJSON();
    if(['quartz', 'unique'].indexOf(spec.specName) > -1) return spec.specName;
    return 'opal';
  }

  static async detectNetworkByWsEndpoint(wsEndpoint) {
    let api = new ApiPromise({provider: new WsProvider(wsEndpoint)});
    await api.isReady;

    const network = await this.detectNetwork(api);

    await api.disconnect();

    return network;
  }

  static async createConnection(wsEndpoint, listeners, network) {
    const supportedRPC = {
      opal: {
        unique: require('@unique-nft/opal-testnet-types/definitions').unique.rpc
      },
      quartz: {
        unique: require('@unique-nft/quartz-mainnet-types/definitions').unique.rpc
      },
      unique: {
        unique: require('@unique-nft/unique-mainnet-types/definitions').unique.rpc
      }
    }
    if(!supportedRPC.hasOwnProperty(network)) network = await this.detectNetworkByWsEndpoint(wsEndpoint);
    const rpc = supportedRPC[network];

    // TODO: investigate how to replace rpc in runtime
    // api._rpcCore.addUserInterfaces(rpc);

    const api = new ApiPromise({provider: new WsProvider(wsEndpoint), rpc});

    await api.isReady;

    if (typeof listeners === 'undefined') listeners = {};
    for (let event of ['connected', 'disconnected', 'error', 'ready', 'decorated']) {
      if (!listeners.hasOwnProperty(event)) continue;
      api.on(event, listeners[event]);
    }


    return {api, network};
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
            unsub();
            resolve({result, status});
          } else if (status === this.transactionStatus.FAIL) {
            let moduleError = null;

            if (result.hasOwnProperty('dispatchError')) {
              const dispatchError = result['dispatchError'];

              if (dispatchError.isModule) {
                const modErr = dispatchError.asModule;
                const errorMeta = dispatchError.registry.findMetaError(modErr);

                moduleError = `${errorMeta.section}.${errorMeta.name}`;
              }
            }

            this.logger.log(`Something went wrong with ${label}. Status: ${status}`, this.logger.level.ERROR);
            unsub();
            reject({status, moduleError, result});
          }
        });
      } catch (e) {
        this.logger.log(e, this.logger.level.ERROR);
        reject(e);
      }
    });
  }

  constructApiCall(apiCall, params) {
    if(!apiCall.startsWith('api.')) throw Error(`Invalid api call: ${apiCall}`);
    let call = this.api;
    for(let part of apiCall.slice(4).split('.')) {
      call = call[part];
    }
    return call(...params);
  }

  async executeExtrinsic(sender, extrinsic, params, expectSuccess=false, failureMessage='expected success') {
    if(this.api === null) throw Error('API not initialized');
    if(!extrinsic.startsWith('api.tx.')) throw Error(`${extrinsic} is not transaction`);

    const startTime = (new Date()).getTime();
    let result;
    try {
      result = await this.signTransaction(sender, this.constructApiCall(extrinsic, params), extrinsic);
    }
    catch(e) {
      if(!e.hasOwnProperty('status')) throw e;
      result = e;
    }

    const endTime = (new Date()).getTime();

    let log = {
      executedAt: endTime,
      executionTime: endTime - startTime,
      type: this.chainLogType.EXTRINSIC,
      status: result.status,
      call: extrinsic,
      params
    };

    if(result.status !== this.transactionStatus.SUCCESS && result.moduleError) log.moduleError = result.moduleError;

    this.chainLog.push(log);

    if(expectSuccess && result.status !== this.transactionStatus.SUCCESS) throw Error(failureMessage);
    return result;
  }

  async callRpc(rpc, params) {
    if(typeof params === 'undefined') params = [];
    if(this.api === null) throw Error('API not initialized');
    if(!rpc.startsWith('api.rpc.') && !rpc.startsWith('api.query.')) throw Error(`${rpc} is not RPC call`);

    const startTime = (new Date()).getTime();
    let result, log = {
      type: this.chainLogType.RPC,
      call: rpc,
      params
    }, error = null;

    try {
      result = await this.constructApiCall(rpc, params);
    }
    catch(e) {
      error = e;
    }

    const endTime = (new Date()).getTime();

    log.executedAt = endTime;
    log.status = error === null ? this.transactionStatus.SUCCESS : this.transactionStatus.FAIL;
    log.executionTime = endTime - startTime;

    this.chainLog.push(log);

    if(error !== null) throw error;

    return result;
  }

  getSignerAddress(signer) {
    if(typeof signer === 'string') return signer;
    return signer.address;
  }
}


class HelperGroup {
  constructor(uniqueHelper) {
    this.helper = uniqueHelper;
  }
}


class CollectionGroup extends HelperGroup {
  async getTokenNextSponsored(collectionId, tokenId, addressObj) {
    return (await this.helper.callRpc('api.rpc.unique.nextSponsored', [collectionId, addressObj, tokenId])).toJSON();
  }

  async getTotalCount() {
    return (await this.callRpc('api.rpc.unique.collectionStats')).created.toNumber();
  }

  async getData(collectionId) {
    const collection = await this.helper.callRpc('api.rpc.unique.collectionById', [collectionId]);
    let humanCollection = collection.toHuman(), collectionData = {
      id: collectionId, name: null, description: null, tokensCount: 0, admins: [],
      raw: humanCollection
    }, jsonCollection = collection.toJSON();
    if (humanCollection === null) return null;
    collectionData.raw.limits = jsonCollection.limits;
    collectionData.raw.permissions = jsonCollection.permissions;
    collectionData.normalizedOwner = this.helper.address.normalizeSubstrate(collectionData.raw.owner);
    for (let key of ['name', 'description']) {
      collectionData[key] = this.helper.util.vec2str(humanCollection[key]);
    }

    collectionData.tokensCount = (['RFT', 'NFT'].includes(humanCollection.mode)) ? await this.helper[humanCollection.mode.toLocaleLowerCase()].getLastTokenId(collectionId) : 0;
    collectionData.admins = await this.getAdmins(collectionId);

    return collectionData;
  }

  async getAdmins(collectionId) {
    let normalized = [];
    for(let admin of (await this.helper.callRpc('api.rpc.unique.adminlist', [collectionId])).toHuman()) {
      if(admin.Substrate) normalized.push({Substrate: this.helper.address.normalizeSubstrate(admin.Substrate)});
      else normalized.push(admin);
    }
    return normalized;
  }

  async getEffectiveLimits(collectionId) {
    return (await this.helper.callRpc('api.rpc.unique.effectiveCollectionLimits', [collectionId])).toJSON();
  }

  async burn(signer, collectionId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.destroyCollection', [collectionId],
      true, `Unable to burn collection for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionDestroyed', label);
  }

  async setSponsor(signer, collectionId, sponsorAddress, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionSponsor', [collectionId, sponsorAddress],
      true, `Unable to set collection sponsor for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionSponsorSet', label);
  }

  async confirmSponsorship(signer, collectionId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.confirmSponsorship', [collectionId],
      true, `Unable to confirm collection sponsorship for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'SponsorshipConfirmed', label);
  }

  async setLimits(signer, collectionId, limits, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionLimits', [collectionId, limits],
      true, `Unable to set collection limits for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionLimitSet', label);
  }

  async changeOwner(signer, collectionId, ownerAddress, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.changeCollectionOwner', [collectionId, ownerAddress],
      true, `Unable to change collection owner for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionOwnedChanged', label);
  }

  async addAdmin(signer, collectionId, adminAddressObj, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.addCollectionAdmin', [collectionId, adminAddressObj],
      true, `Unable to add collection admin for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminAdded', label);
  }

  async removeAdmin(signer, collectionId, adminAddressObj, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.removeCollectionAdmin', [collectionId, adminAddressObj],
      true, `Unable to remove collection admin for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminRemoved', label);
  }

  async setPermissions(signer, collectionId, permissions, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionPermissions', [collectionId, permissions],
      `Unable to set collection permissions for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionPermissionSet', label);
  }

  async enableNesting(signer, collectionId, permissions, label) {
    return await this.setPermissions(signer, collectionId, {nesting: permissions}, label);
  }

  async disableNesting(signer, collectionId, label) {
    return await this.setPermissions(signer, collectionId, {nesting: {tokenOwner: false, collectionAdmin: false}}, label);
  }

  async setProperties(signer, collectionId, properties, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionProperties', [collectionId, properties],
      true, `Unable to set collection properties for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionPropertySet', label);
  }

  async deleteProperties(signer, collectionId, propertyKeys, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.deleteCollectionProperties', [collectionId, propertyKeys],
      true, `Unable to delete collection properties for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionPropertyDeleted', label);
  }
}

class NFTnRFT extends CollectionGroup {
  async getTokensByAddress(collectionId, addressObj) {
    return (await this.helper.callRpc('api.rpc.unique.accountTokens', [collectionId, addressObj])).toJSON()
  }

  async getToken(collectionId, tokenId, blockHashAt, propertyKeys) {
    let tokenData;
    if(typeof blockHashAt === 'undefined') {
      tokenData = await this.helper.callRpc('api.rpc.unique.tokenData', [collectionId, tokenId]);
    }
    else {
      if(typeof propertyKeys === 'undefined') {
        let collection = (await this.helper.callRpc('api.rpc.unique.collectionById', [collectionId])).toHuman();
        if(!collection) return null;
        propertyKeys = collection.tokenPropertyPermissions.map(x => x.key);
      }
      tokenData = await this.helper.callRpc('api.rpc.unique.tokenData', [collectionId, tokenId, propertyKeys, blockHashAt]);
    }
    tokenData = tokenData.toHuman();
    if (tokenData === null || tokenData.owner === null) return null;
    let owner = {};
    for (let key of Object.keys(tokenData.owner)) {
      owner[key.toLocaleLowerCase()] = key.toLocaleLowerCase() === 'substrate' ? this.helper.address.normalizeSubstrate(tokenData.owner[key]) : tokenData.owner[key];
    }
    tokenData.normalizedOwner = owner;
    return tokenData;
  }

  async isTokenExists(collectionId, tokenId) {
    return (await this.helper.callRpc('api.rpc.unique.tokenExists', [collectionId, tokenId])).toJSON()
  }

  async getLastTokenId(collectionId) {
    return (await this.helper.callRpc('api.rpc.unique.lastTokenId', [collectionId])).toNumber();
  }

  async setTokenPropertyPermissions(signer, collectionId, permissions, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setTokenPropertyPermissions', [collectionId, permissions],
      true, `Unable to set token property permissions for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'PropertyPermissionSet', label);
  }

  async setTokenProperties(signer, collectionId, tokenId, properties, label) {
    if(typeof label === 'undefined') label = `token #${tokenId} from collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.setTokenProperties', [collectionId, tokenId, properties],
      true, `Unable to set token properties for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertySet', label);
  }

  async deleteTokenProperties(signer, collectionId, tokenId, propertyKeys, label) {
    if(typeof label === 'undefined') label = `token #${tokenId} from collection #${collectionId}`;
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.deleteTokenProperties', [collectionId, tokenId, propertyKeys],
      true, `Unable to delete token properties for ${label}`
    );

    return this.helper.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertyDeleted', label);
  }
}


class NFTGroup extends NFTnRFT {
  getCollectionObject(collectionId) {
    return new UniqueNFTCollection(collectionId, this.helper);
  }

  getTokenObject(collectionId, tokenId) {
    return new UniqueNFTToken(tokenId, this.getCollectionObject(collectionId));
  }

  async transferToken(signer, collectionId, tokenId, addressObj) {
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.transfer', [addressObj, collectionId, tokenId, 1],
      true, `Unable to transfer NFT token #${tokenId} from collection #${collectionId}`
    );

    return this.helper.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, {Substrate: typeof signer === 'string' ? signer : signer.address}, addressObj);
  }

  async transferTokenFrom(signer, collectionId, tokenId, fromAddressObj, toAddressObj) {
    const result = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.transferFrom', [fromAddressObj, toAddressObj, collectionId, tokenId, 1],
      true, `Unable to transfer NFT token #${tokenId} from collection #${collectionId}`
    );
    return this.helper.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async getTokenTopmostOwner(collectionId, tokenId, blockHashAt) {
    let owner;
    if (typeof blockHashAt === 'undefined') {
      owner = await this.helper.callRpc('api.rpc.unique.topmostTokenOwner', [collectionId, tokenId]);
    } else {
      owner = await this.helper.callRpc('api.rpc.unique.topmostTokenOwner', [collectionId, tokenId, blockHashAt]);
    }

    if (owner === null) return null;

    owner = owner.toHuman();

    return owner.Substrate ? {Substrate: this.helper.address.normalizeSubstrate(owner.Substrate)} : owner;
  }

  async getTokenChildren(collectionId, tokenId, blockHashAt) {
    let children;
    if(typeof blockHashAt === 'undefined') {
      children = await this.helper.callRpc('api.rpc.unique.tokenChildren', [collectionId, tokenId]);
    } else {
      children = await this.helper.callRpc('api.rpc.unique.tokenChildren', [collectionId, tokenId, blockHashAt]);
    }

    return children.toJSON();
  }

  async nestToken(signer, tokenObj, rootTokenObj, label='nest token') {
    const rootTokenAddress = {Ethereum: this.helper.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferToken(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress);
    if(!result) {
      throw Error(`Unable to nest token for ${label}`);
    }
    return result;
  }

  async unnestToken(signer, tokenObj, rootTokenObj, toAddressObj, label='unnest token') {
    const rootTokenAddress = {Ethereum: this.helper.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferTokenFrom(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress, toAddressObj);
    if(!result) {
      throw Error(`Unable to unnest token for ${label}`);
    }
    return result;
  }

  async mintCollection(signer, collectionOptions, label = 'new collection') {
    collectionOptions = JSON.parse(JSON.stringify(collectionOptions)); // Clone object
    collectionOptions.mode = {nft: null}; // this is NFT collection
    for (let key of ['name', 'description', 'tokenPrefix']) {
      if (typeof collectionOptions[key] === 'string') collectionOptions[key] = this.helper.util.str2vec(collectionOptions[key]);
    }
    const creationResult = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.createCollectionEx', [collectionOptions],
      true, `Unable to mint NFT collection for ${label}`
    );
    return this.getCollectionObject(this.helper.util.extractCollectionIdFromCreationResult(creationResult, label));
  }

  async mintToken(signer, { collectionId, owner, properties }, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const creationResult = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.createItem', [collectionId, (owner.Substrate || owner.Ethereum) ? owner : {Substrate: owner}, {
        nft: {
          properties
        }
      }],
      true, `Unable to mint NFT token for ${label}`
    );
    const createdTokens = this.helper.util.extractTokensFromCreationResult(creationResult, label);
    if (createdTokens.tokens.length > 1) throw Error('Minted multiple tokens');
    return createdTokens.tokens.length > 0 ? this.getTokenObject(collectionId, createdTokens.tokens[0].tokenId) : null;
  }

  async mintMultipleTokens(signer, collectionId, tokens, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const creationResult = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.createMultipleItemsEx', [collectionId, {NFT: tokens}],
      true, `Unable to mint NFT tokens for ${label}`
    );
    const collection = this.getCollectionObject(collectionId);
    return this.helper.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async mintMultipleTokensWithOneOwner(signer, collectionId, owner, tokens, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    let rawTokens = [];
    for (let token of tokens) {
      let raw = {NFT: {properties: token.properties}};
      rawTokens.push(raw);
    }
    const creationResult = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.createMultipleItems', [collectionId, {Substrate: owner}, rawTokens],
      `Unable to mint NFT tokens for ${label}`
    );
    const collection = this.getCollectionObject(collectionId);
    return this.helper.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async burnToken(signer, collectionId, tokenId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const burnResult = await this.helper.executeExtrinsic(
      signer,
      'api.tx.unique.burnItem', [collectionId, tokenId, 1],
      true, `Unable to burn NFT token for ${label}`
    );
    const burnedTokens = this.helper.util.extractTokensFromBurnResult(burnResult, label);
    if (burnedTokens.tokens.length > 1) throw Error('Burned multiple tokens');
    return {success: burnedTokens.success, token: burnedTokens.tokens.length > 0 ? burnedTokens.tokens[0] : null};
  }
}


class RFTGroup extends NFTnRFT {

}


class FTGroup extends CollectionGroup {

}


class ChainGroup extends HelperGroup {
  async getChainProperties() {
    const properties = (await this.helper.api.registry.getChainProperties()).toJSON();
    return {
      ss58Format: properties.ss58Format.toJSON(),
      tokenDecimals: properties.tokenDecimals.toJSON(),
      tokenSymbol: properties.tokenSymbol.toJSON()
    };
  }

  async getLatestBlockNumber() {
    return (await this.helper.callRpc('api.rpc.chain.getHeader')).number.toNumber();
  }

  async getBlockHashByNumber(blockNumber) {
    const blockHash = (await this.helper.callRpc('api.rpc.chain.getBlockHash', [blockNumber])).toJSON();
    if(blockHash === '0x0000000000000000000000000000000000000000000000000000000000000000') return null;
    return blockHash;
  }
}


class BalanceGroup extends HelperGroup {
  async getOneTokenNominal() {
    const chainProperties = await this.helper.chain.getChainProperties();
    return 10n ** BigInt((chainProperties.tokenDecimals || [18])[0]);
  }

  async getSubstrate(address) {
    return (await this.helper.callRpc('api.query.system.account', [address])).data.free.toBigInt();
  }

  async getEthereum(address) {
    return (await this.helper.callRpc('api.rpc.eth.getBalance', [address])).toBigInt();
  }

  async transferToSubstrate(signer, address, amount) {
    const result = await this.helper.executeExtrinsic(signer, 'api.tx.balances.transfer', [address, amount], true, `Unable to transfer balance from ${this.helper.getSignerAddress(signer)} to ${address}`);

    let transfer = {from: null, to: null, amount: 0n};
    result.result.events.forEach(({event: {data, method, section}}) => {
      if ((section === 'balances') && (method === 'Transfer')) {
        transfer = {
          from: this.helper.address.normalizeSubstrate(data[0]),
          to: this.helper.address.normalizeSubstrate(data[1]),
          amount: BigInt(data[2])
        };
      }
    });
    let isSuccess = this.helper.address.normalizeSubstrate(typeof signer === 'string' ? signer : signer.address) === transfer.from;
    isSuccess = isSuccess && this.helper.address.normalizeSubstrate(address) === transfer.to;
    isSuccess = isSuccess && BigInt(amount) === transfer.amount;
    return isSuccess;
  }
}


class AddressGroup extends HelperGroup {
  normalizeSubstrate(address) {
    return this.helper.util.normalizeSubstrateAddress(address);
  }

  async normalizeSubstrateToChainFormat(address) {
    let info = await this.helper.chain.getChainProperties();
    return encodeAddress(decodeAddress(address), info.ss58Format);
  }

  async ethToSubstrate(ethAddress, toChainFormat=false) {
    if(!toChainFormat) return evmToAddress(ethAddress);
    let info = await this.helper.chain.getChainProperties();
    return evmToAddress(ethAddress, info.ss58Format);
  }

  substrateToEth(subAddress) {
    return nesting.toChecksumAddress('0x' + Array.from(addressToEvm(subAddress), i => i.toString(16).padStart(2, '0')).join(''));
  }
}


class UniqueHelper extends ChainHelperBase {
  constructor(logger) {
    super(logger);
    this.chain = new ChainGroup(this);
    this.balance = new BalanceGroup(this);
    this.address = new AddressGroup(this);
    this.collection = new CollectionGroup(this);
    this.nft = new NFTGroup(this);
    this.rft = new RFTGroup(this);
    this.ft = new FTGroup(this);
  }  
}


class UniqueCollectionBase {
  constructor(collectionId, uniqueHelper) {
    this.collectionId = collectionId;
    this.helper = uniqueHelper;
  }

  async getData() {
    return await this.helper.collection.getData(this.collectionId);
  }

  async getAdmins() {
    return await this.helper.collection.getAdmins(this.collectionId);
  }

  async getEffectiveLimits() {
    return await this.helper.collection.getEffectiveLimits(this.collectionId);
  }

  async setSponsor(signer, sponsorAddress, label) {
    return await this.helper.collection.setSponsor(signer, this.collectionId, sponsorAddress, label);
  }

  async confirmSponsorship(signer, label) {
    return await this.helper.collection.confirmSponsorship(signer, this.collectionId, label);
  }

  async setLimits(signer, limits, label) {
    return await this.helper.collection.setLimits(signer, this.collectionId, limits, label);
  }

  async changeOwner(signer, ownerAddress, label) {
    return await this.helper.collection.changeOwner(signer, this.collectionId, ownerAddress, label);
  }

  async addAdmin(signer, adminAddressObj, label) {
    return await this.helper.collection.addAdmin(signer, this.collectionId, adminAddressObj, label);
  }

  async removeAdmin(signer, adminAddressObj, label) {
    return await this.helper.collection.removeAdmin(signer, this.collectionId, adminAddressObj, label);
  }

  async setProperties(signer, properties, label) {
    return await this.helper.collection.setProperties(signer, this.collectionId, properties, label);
  }

  async deleteProperties(signer, propertyKeys, label) {
    return await this.helper.collection.deleteProperties(signer, this.collectionId, propertyKeys, label);
  }

  async getTokenNextSponsored(tokenId, addressObj) {
    return await this.helper.collection.getTokenNextSponsored(this.collectionId, tokenId, addressObj);
  }

  async setPermissions(signer, permissions, label) {
    return await this.helper.collection.setPermissions(signer, this.collectionId, permissions, label);
  }

  async enableNesting(signer, permissions, label) {
    return await this.helper.collection.enableNesting(signer, this.collectionId, permissions, label);
  }

  async disableNesting(signer, label) {
    return await this.helper.collection.disableNesting(signer, this.collectionId, label);
  }

  async burn(signer, label) {
    return await this.helper.collection.burn(signer, this.collectionId, label);
  }
}


class UniqueNFTCollection extends UniqueCollectionBase {
  getTokenObject(tokenId) {
    return new UniqueNFTToken(tokenId, this);
  }

  async getTokensByAddress(addressObj) {
    return await this.helper.nft.getTokensByAddress(this.collectionId, addressObj);
  }

  async isTokenExists(tokenId) {
    return await this.helper.nft.isTokenExists(this.collectionId, tokenId);
  }

  async getLastTokenId() {
    return await this.helper.nft.getLastTokenId(this.collectionId);
  }

  async getToken(tokenId, blockHashAt) {
    return await this.helper.nft.getToken(this.collectionId, tokenId, blockHashAt);
  }

  async getTokenTopmostOwner(tokenId, blockHashAt) {
    return await this.helper.nft.getTokenTopmostOwner(this.collectionId, tokenId, blockHashAt);
  }

  async getTokenChildren(tokenId, blockHashAt) {
    return await this.helper.nft.getTokenChildren(this.collectionId, tokenId, blockHashAt);
  }

  async transferToken(signer, tokenId, addressObj) {
    return await this.helper.nft.transferToken(signer, this.collectionId, tokenId, addressObj);
  }

  async transferTokenFrom(signer, tokenId, fromAddressObj, toAddressObj) {
    return await this.helper.nft.transferTokenFrom(signer, this.collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async mintToken(signer, owner, properties, label) {
    return await this.helper.nft.mintToken(signer, {collectionId: this.collectionId, owner, properties}, label);
  }

  async mintMultipleTokens(signer, tokens, label) {
    return await this.helper.nft.mintMultipleTokens(signer, this.collectionId, tokens, label);
  }

  async burnToken(signer, tokenId, label) {
    return await this.helper.nft.burnToken(signer, this.collectionId, tokenId, label);
  }

  async setTokenProperties(signer, tokenId, properties, label) {
    return await this.helper.nft.setTokenProperties(signer, this.collectionId, tokenId, properties, label);
  }

  async deleteTokenProperties(signer, tokenId, propertyKeys, label) {
    return await this.helper.nft.deleteTokenProperties(signer, this.collectionId, tokenId, propertyKeys, label);
  }

  async setTokenPropertyPermissions(signer, permissions, label) {
    return await this.helper.nft.setTokenPropertyPermissions(signer, this.collectionId, permissions, label);
  }

  async nestToken(signer, tokenId, toTokenObj, label) {
    return await this.helper.nft.nestToken(signer, {collectionId: this.collectionId, tokenId}, toTokenObj, label);
  }

  async unnestToken(signer, tokenId, fromTokenObj, toAddressObj, label) {
    return await this.helper.nft.unnestToken(signer, {collectionId: this.collectionId, tokenId}, fromTokenObj, toAddressObj, label);
  }
}


class UniqueTokenBase {
  constructor(tokenId, collection) {
    this.collection = collection;
    this.collectionId = collection.collectionId;
    this.tokenId = tokenId;
  }

  async getNextSponsored(addressObj) {
    return await this.collection.getTokenNextSponsored(this.tokenId, addressObj);
  }
}


class UniqueNFTToken extends UniqueTokenBase {
  async getData(blockHashAt) {
    return await this.collection.getToken(this.tokenId, blockHashAt);
  }

  async getTopmostOwner(blockHashAt) {
    return await this.collection.getTokenTopmostOwner(this.tokenId, blockHashAt);
  }

  async getChildren(blockHashAt) {
    return await this.collection.getTokenChildren(this.tokenId, blockHashAt);
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
