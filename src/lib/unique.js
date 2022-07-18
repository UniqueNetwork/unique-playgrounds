const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { encodeAddress, decodeAddress, keccakAsHex, evmToAddress } = require('@polkadot/util-crypto');


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
}


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


class UniqueHelper extends ChainHelperBase {
  async getCollectionTokenNextSponsored(collectionId, tokenId, addressObj) {
    return (await this.callRpc('api.rpc.unique.nextSponsored', [collectionId, addressObj, tokenId])).toJSON();
  }

  async getChainProperties() {
    const properties = (await this.api.registry.getChainProperties()).toJSON();
    return {
      ss58Format: properties.ss58Format.toJSON(),
      tokenDecimals: properties.tokenDecimals.toJSON(),
      tokenSymbol: properties.tokenSymbol.toJSON()
    };
  }

  async getLatestBlockNumber() {
    return (await this.callRpc('api.rpc.chain.getHeader')).number.toNumber();
  }

  async getBlockHashByNumber(blockNumber) {
    const blockHash = (await this.callRpc('api.rpc.chain.getBlockHash', [blockNumber])).toJSON();
    if(blockHash === '0x0000000000000000000000000000000000000000000000000000000000000000') return null;
    return blockHash;
  }

  async getOneTokenNominal() {
    const chainProperties = await this.getChainProperties();
    return 10n ** BigInt((chainProperties.tokenDecimals || [18])[0]);
  }

  async normalizeSubstrateAddressToChainFormat(address) {
    let info = await this.getChainProperties();
    return encodeAddress(decodeAddress(address), info.ss58Format);
  }

  async ethAddressToSubstrate(ethAddress, toChainFormat=false) {
    if(!toChainFormat) return evmToAddress(ethAddress);
    let info = await this.getChainProperties();
    return evmToAddress(ethAddress, info.ss58Format);
  }

  async getSubstrateAccountBalance(address) {
    return (await this.callRpc('api.query.system.account', [address])).data.free.toBigInt();
  }

  async getEthereumAccountBalance(address) {
    return (await this.callRpc('api.rpc.eth.getBalance', [address])).toBigInt();
  }

  async transferBalanceToSubstrateAccount(signer, address, amount) {
    const result = await this.executeExtrinsic(signer, 'api.tx.balances.transfer', [address, amount], true, `Unable to transfer balance from ${this.getSignerAddress(signer)} to ${address}`);

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
    let isSuccess = this.util.normalizeSubstrateAddress(typeof signer === 'string' ? signer : signer.address) === transfer.from;
    isSuccess = isSuccess && this.util.normalizeSubstrateAddress(address) === transfer.to;
    isSuccess = isSuccess && BigInt(amount) === transfer.amount;
    return isSuccess;
  }

  async getTotalCollectionsCount() {
    return (await this.callRpc('api.rpc.unique.collectionStats')).created.toNumber();
  }

  async getCollection(collectionId) {
    const collection = await this.callRpc('api.rpc.unique.collectionById', [collectionId]);
    let humanCollection = collection.toHuman(), collectionData = {
      id: collectionId, name: null, description: null, tokensCount: 0, admins: [],
      raw: humanCollection
    }, jsonCollection = collection.toJSON();
    if (humanCollection === null) return null;
    collectionData.raw.limits = jsonCollection.limits;
    collectionData.raw.permissions = jsonCollection.permissions;
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
    for(let admin of (await this.callRpc('api.rpc.unique.adminlist', [collectionId])).toHuman()) {
      if(admin.Substrate) normalized.push({Substrate: this.util.normalizeSubstrateAddress(admin.Substrate)});
      else normalized.push(admin);
    }
    return normalized;
  }

  async getCollectionTokensByAddress(collectionId, addressObj) {
    return (await this.callRpc('api.rpc.unique.accountTokens', [collectionId, addressObj])).toJSON()
  }

  async getCollectionEffectiveLimits(collectionId) {
    return (await this.callRpc('api.rpc.unique.effectiveCollectionLimits', [collectionId])).toJSON();
  }

  async isCollectionTokenExists(collectionId, tokenId) {
    return (await this.callRpc('api.rpc.unique.tokenExists', [collectionId, tokenId])).toJSON()
  }

  async getCollectionLastTokenId(collectionId) {
    return (await this.callRpc('api.rpc.unique.lastTokenId', [collectionId])).toNumber();
  }

  async getToken(collectionId, tokenId, blockHashAt, propertyKeys) {
    let tokenData;
    if(typeof blockHashAt === 'undefined') {
      tokenData = await this.callRpc('api.rpc.unique.tokenData', [collectionId, tokenId]);
    }
    else {
      if(typeof propertyKeys === 'undefined') {
        let collection = (await this.callRpc('api.rpc.unique.collectionById', [collectionId])).toHuman();
        if(!collection) return null;
        propertyKeys = collection.tokenPropertyPermissions.map(x => x.key);
      }
      tokenData = await this.callRpc('api.rpc.unique.tokenData', [collectionId, tokenId, propertyKeys, blockHashAt]);
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

  async getTokenTopmostOwner(collectionId, tokenId, blockHashAt) {
    let owner;
    if (typeof blockHashAt === 'undefined') {
      owner = await this.callRpc('api.rpc.unique.topmostTokenOwner', [collectionId, tokenId]);
    } else {
      owner = await this.callRpc('api.rpc.unique.topmostTokenOwner', [collectionId, tokenId, blockHashAt]);
    }

    if (owner === null) return null;

    owner = owner.toHuman();

    return owner.Substrate ? {Substrate: this.util.normalizeSubstrateAddress(owner.Substrate)} : owner;
  }

  async getTokenChildren(collectionId, tokenId, blockHashAt) {
    let children;
    if(typeof blockHashAt === 'undefined') {
      children = await this.callRpc('api.rpc.unique.tokenChildren', [collectionId, tokenId]);
    } else {
      children = await this.callRpc('api.rpc.unique.tokenChildren', [collectionId, tokenId, blockHashAt]);
    }

    return children.toJSON();
  }

  async transferNFTToken(signer, collectionId, tokenId, addressObj) {
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.transfer', [addressObj, collectionId, tokenId, 1],
      true, `Unable to transfer NFT token #${tokenId} from collection #${collectionId}`
    );

    return this.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, {Substrate: typeof signer === 'string' ? signer : signer.address}, addressObj);
  }

  async transferNFTTokenFrom(signer, collectionId, tokenId, fromAddressObj, toAddressObj) {
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.transferFrom', [fromAddressObj, toAddressObj, collectionId, tokenId, 1],
      true, `Unable to transfer NFT token #${tokenId} from collection #${collectionId}`
    );
    return this.util.isTokenTransferSuccess(result.result.events, collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async mintNFTCollection(signer, collectionOptions, label = 'new collection') {
    collectionOptions = JSON.parse(JSON.stringify(collectionOptions)); // Clone object
    collectionOptions.mode = {nft: null}; // this is NFT collection
    for (let key of ['name', 'description', 'tokenPrefix']) {
      if (typeof collectionOptions[key] === 'string') collectionOptions[key] = this.util.str2vec(collectionOptions[key]);
    }
    const creationResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.createCollectionEx', [collectionOptions],
      true, `Unable to mint NFT collection for ${label}`
    );
    return this.getCollectionObject(this.util.extractCollectionIdFromCreationResult(creationResult, label));
  }

  async burnNFTCollection(signer, collectionId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.destroyCollection', [collectionId],
      true, `Unable to burn collection for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionDestroyed', label);
  }

  async setNFTCollectionSponsor(signer, collectionId, sponsorAddress, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionSponsor', [collectionId, sponsorAddress],
      true, `Unable to set collection sponsor for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionSponsorSet', label);
  }

  async confirmNFTCollectionSponsorship(signer, collectionId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.confirmSponsorship', [collectionId],
      true, `Unable to confirm collection sponsorship for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'SponsorshipConfirmed', label);
  }

  async setNFTCollectionLimits(signer, collectionId, limits, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionLimits', [collectionId, limits],
      true, `Unable to set collection limits for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionLimitSet', label);
  }

  async changeNFTCollectionOwner(signer, collectionId, ownerAddress, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.changeCollectionOwner', [collectionId, ownerAddress],
      true, `Unable to change collection owner for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionOwnedChanged', label);
  }

  async addNFTCollectionAdmin(signer, collectionId, adminAddressObj, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.addCollectionAdmin', [collectionId, adminAddressObj],
      true, `Unable to add collection admin for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminAdded', label);
  }

  async removeNFTCollectionAdmin(signer, collectionId, adminAddressObj, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.removeCollectionAdmin', [collectionId, adminAddressObj],
      true, `Unable to remove collection admin for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionAdminRemoved', label);
  }

  async mintNFTCollectionWithDefaults(signer, { name, description, tokenPrefix }, label = 'new collection', transactionLabel = 'api.tx.unique.createCollection') {
    const creationResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.createCollection',[this.util.str2vec(name), this.util.str2vec(description), this.util.str2vec(tokenPrefix), {nft: null}],
      true, `Unable to mint NFT collection for ${label}`
    );
    return this.getCollectionObject(this.util.extractCollectionIdFromCreationResult(creationResult, label));
  }

  async mintNFTToken(signer, { collectionId, owner, properties }, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const creationResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.createItem', [collectionId, (owner.Substrate || owner.Ethereum) ? owner : {Substrate: owner}, {
        nft: {
          properties
        }
      }],
      true, `Unable to mint NFT token for ${label}`
    );
    const createdTokens = this.util.extractTokensFromCreationResult(creationResult, label);
    if (createdTokens.tokens.length > 1) throw Error('Minted multiple tokens');
    return createdTokens.tokens.length > 0 ? this.getCollectionTokenObject(collectionId, createdTokens.tokens[0].tokenId) : null;
  }

  async mintMultipleNFTTokens(signer, collectionId, tokens, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const creationResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.createMultipleItemsEx', [collectionId, {NFT: tokens}],
      true, `Unable to mint NFT tokens for ${label}`
    );
    const collection = this.getCollectionObject(collectionId);
    return this.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async mintMultipleNFTTokensWithOneOwner(signer, collectionId, owner, tokens, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    let rawTokens = [];
    for (let token of tokens) {
      let raw = {NFT: {properties: token.properties}};
      rawTokens.push(raw);
    }
    const creationResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.createMultipleItems', [collectionId, {Substrate: owner}, rawTokens],
      `Unable to mint NFT tokens for ${label}`
    );
    const collection = this.getCollectionObject(collectionId);
    return this.util.extractTokensFromCreationResult(creationResult, label).tokens.map(x => collection.getTokenObject(x.tokenId));
  }

  async burnNFTToken(signer, collectionId, tokenId, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const burnResult = await this.executeExtrinsic(
      signer,
      'api.tx.unique.burnItem', [collectionId, tokenId, 1],
      true, `Unable to burn NFT tokens for ${label}`
    );
    const burnedTokens = this.util.extractTokensFromBurnResult(burnResult, label);
    if (burnedTokens.tokens.length > 1) throw Error('Burned multiple tokens');
    return {success: burnedTokens.success, token: burnedTokens.tokens.length > 0 ? burnedTokens.tokens[0] : null};
  }

  async setCollectionProperties(signer, collectionId, properties, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionProperties', [collectionId, properties],
      true, `Unable to set collection properties for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionPropertySet', label);
  }

  async deleteCollectionProperties(signer, collectionId, propertyKeys, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.deleteCollectionProperties', [collectionId, propertyKeys],
      true, `Unable to delete collection properties for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'CollectionPropertyDeleted', label);
  }

  async setTokenPropertyPermissions(signer, collectionId, permissions, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setTokenPropertyPermissions', [collectionId, permissions],
      true, `Unable to set token property permissions for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'PropertyPermissionSet', label);
  }

  async setNFTTokenProperties(signer, collectionId, tokenId, properties, label) {
    if(typeof label === 'undefined') label = `token #${tokenId} from collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setTokenProperties', [collectionId, tokenId, properties],
      true, `Unable to set token properties for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertySet', label);
  }

  async deleteNFTTokenProperties(signer, collectionId, tokenId, propertyKeys, label) {
    if(typeof label === 'undefined') label = `token #${tokenId} from collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.deleteTokenProperties', [collectionId, tokenId, propertyKeys],
      true, `Unable to delete token properties for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'common', 'TokenPropertyDeleted', label);
  }

  async setCollectionPermissions(signer, collectionId, permissions, label) {
    if(typeof label === 'undefined') label = `collection #${collectionId}`;
    const result = await this.executeExtrinsic(
      signer,
      'api.tx.unique.setCollectionPermissions', [collectionId, permissions],
      `Unable to set collection permissions for ${label}`
    );

    return this.util.findCollectionInEvents(result.result.events, collectionId, 'unique', 'CollectionPermissionSet', label);
  }

  async enableCollectionNesting(signer, collectionId, permissions, label) {
    return await this.setCollectionPermissions(signer, collectionId, {nesting: permissions}, label);
  }

  async disableCollectionNesting(signer, collectionId, label) {
    return await this.setCollectionPermissions(signer, collectionId, {nesting: {tokenOwner: false, collectionAdmin: false}}, label);
  }

  async nestCollectionToken(signer, tokenObj, rootTokenObj, label='nest token') {
    const rootTokenAddress = {Ethereum: this.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferNFTToken(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress);
    if(!result) {
      throw Error(`Unable to nest token for ${label}`);
    }
    return result;
  }

  async unnestCollectionToken(signer, tokenObj, rootTokenObj, toAddressObj, label='unnest token') {
    const rootTokenAddress = {Ethereum: this.util.getNestingTokenAddress(rootTokenObj.collectionId, rootTokenObj.tokenId)};
    const result = await this.transferNFTTokenFrom(signer, tokenObj.collectionId, tokenObj.tokenId, rootTokenAddress, toAddressObj);
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

  async getTokenTopmostOwner(tokenId, blockHashAt) {
    return await this.uniqueHelper.getTokenTopmostOwner(this.collectionId, tokenId, blockHashAt);
  }

  async getTokenChildren(tokenId, blockHashAt) {
    return await this.uniqueHelper.getTokenChildren(this.collectionId, tokenId, blockHashAt);
  }

  async transferToken(signer, tokenId, addressObj) {
    return await this.uniqueHelper.transferNFTToken(signer, this.collectionId, tokenId, addressObj);
  }

  async transferTokenFrom(signer, tokenId, fromAddressObj, toAddressObj) {
    return await this.uniqueHelper.transferNFTTokenFrom(signer, this.collectionId, tokenId, fromAddressObj, toAddressObj);
  }

  async burn(signer, label) {
    return await this.uniqueHelper.burnNFTCollection(signer, this.collectionId, label);
  }

  async setSponsor(signer, sponsorAddress, label) {
    return await this.uniqueHelper.setNFTCollectionSponsor(signer, this.collectionId, sponsorAddress, label);
  }

  async confirmSponsorship(signer, label) {
    return await this.uniqueHelper.confirmNFTCollectionSponsorship(signer, this.collectionId, label);
  }

  async setLimits(signer, limits, label) {
    return await this.uniqueHelper.setNFTCollectionLimits(signer, this.collectionId, limits, label);
  }

  async changeOwner(signer, ownerAddress, label) {
    return await this.uniqueHelper.changeNFTCollectionOwner(signer, this.collectionId, ownerAddress, label);
  }

  async addAdmin(signer, adminAddressObj, label) {
    return await this.uniqueHelper.addNFTCollectionAdmin(signer, this.collectionId, adminAddressObj, label);
  }

  async removeAdmin(signer, adminAddressObj, label) {
    return await this.uniqueHelper.removeNFTCollectionAdmin(signer, this.collectionId, adminAddressObj, label);
  }

  async mintToken(signer, owner, properties, label) {
    return await this.uniqueHelper.mintNFTToken(signer, {collectionId: this.collectionId, owner, properties}, label);
  }

  async mintMultipleTokens(signer, tokens, label) {
    return await this.uniqueHelper.mintMultipleNFTTokens(signer, this.collectionId, tokens, label);
  }

  async burnToken(signer, tokenId, label) {
    return await this.uniqueHelper.burnNFTToken(signer, this.collectionId, tokenId, label);
  }

  async setProperties(signer, properties, label) {
    return await this.uniqueHelper.setCollectionProperties(signer, this.collectionId, properties, label);
  }

  async deleteProperties(signer, propertyKeys, label) {
    return await this.uniqueHelper.deleteCollectionProperties(signer, this.collectionId, propertyKeys, label);
  }

  async setTokenProperties(signer, tokenId, properties, label) {
    return await this.uniqueHelper.setNFTTokenProperties(signer, this.collectionId, tokenId, properties, label);
  }

  async deleteTokenProperties(signer, tokenId, propertyKeys, label) {
    return await this.uniqueHelper.deleteNFTTokenProperties(signer, this.collectionId, tokenId, propertyKeys, label);
  }

  async getTokenNextSponsored(tokenId, addressObj) {
    return await this.uniqueHelper.getCollectionTokenNextSponsored(this.collectionId, tokenId, addressObj);
  }

  async setPermissions(signer, permissions, label) {
    return await this.uniqueHelper.setCollectionPermissions(signer, this.collectionId, permissions, label);
  }

  async setTokenPropertyPermissions(signer, permissions, label) {
    return await this.uniqueHelper.setTokenPropertyPermissions(signer, this.collectionId, permissions, label);
  }

  async enableNesting(signer, permissions, label) {
    return await this.uniqueHelper.enableCollectionNesting(signer, this.collectionId, permissions, label);
  }

  async disableNesting(signer, label) {
    return await this.uniqueHelper.disableCollectionNesting(signer, this.collectionId, label);
  }

  async nestToken(signer, tokenId, toTokenObj, label) {
    return await this.uniqueHelper.nestCollectionToken(signer, {collectionId: this.collectionId, tokenId}, toTokenObj, label);
  }

  async unnestToken(signer, tokenId, fromTokenObj, toAddressObj, label) {
    return await this.uniqueHelper.unnestCollectionToken(signer, {collectionId: this.collectionId, tokenId}, fromTokenObj, toAddressObj, label);
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

  async getNextSponsored(addressObj) {
    return await this.collection.getTokenNextSponsored(this.tokenId, addressObj);
  }
}

module.exports = {
  UniqueHelper, UniqueUtil
};
