const fs = require('fs');
const path = require('path');

const { UniqueUtil } = require('../lib/unique');

const UNDEFINED = ({}).notdefined;

class UniqueExporter {
  constructor(uniqueHelper, exportPath, logger, blockNumber) {
    if(typeof exportPath === 'undefined') exportPath = '.';
    if(typeof logger === 'undefined') logger = UniqueUtil.getDefaultLogger();
    this.exportPath = exportPath;
    this.uniqueHelper = uniqueHelper;
    this.logger = logger;
    this.blockNumber = blockNumber === null ? UNDEFINED : blockNumber;
  }

  getLastTokenId(text) {
    let lastId = 0;
    for(let line of text.split('\n').map(x => x.trim())) {
      if(line.endsWith(',')) line = line.slice(0, -1);
      try {
        line = JSON.parse(line);
      } catch (e) {
        continue;
      }
      if(line.tokenId && line.tokenId > lastId) lastId = line.tokenId;
    }
    return ++lastId;
  }

  getTokensFilename(collectionId) {
    return path.join(this.exportPath, `export_tokens_${collectionId}.json`);
  }

  getCollectionFilename(collectionId) {
    return path.join(this.exportPath, `export_collection_${collectionId}.json`);
  }

  async getTokenOld(collectionId, tokenId, blockHashAt) {
    // TODO: remove this, backwards compatibility
    let token = {};
    if(!blockHashAt) {
      token = await this.uniqueHelper.api.query.nonfungible.tokenData(collectionId, tokenId);
    }
    else {
      token = await this.uniqueHelper.api.query.nonfungible.tokenData(collectionId, tokenId, blockHashAt);
    }
    token = token.toHuman();
    let tokenData = {owner: token.owner, properties: [{key: '_old_constData', value: token.constData}]};
    console.log(tokenData);
    if (tokenData === null || tokenData.owner === null) return null;
    let owner = {};
    for (let key of Object.keys(tokenData.owner)) {
      owner[key.toLocaleLowerCase()] = key.toLocaleLowerCase() === 'substrate' ? this.uniqueHelper.util.normalizeSubstrateAddress(tokenData.owner[key]) : tokenData.owner[key];
    }
    tokenData.normalizedOwner = owner;
    return tokenData;
  }

  async *genTokenData(collectionData, startToken=1) {
    let tokenId = startToken;

    const tokensCount = collectionData.tokensCount;
    const isLegacy = !collectionData.raw.hasOwnProperty('tokenPropertyPermissions');
    const propertyKeys = isLegacy ? null : collectionData.raw.tokenPropertyPermissions.map(x => x.key);

    while (true) {
      const tokenData = await (isLegacy ? this.getTokenOld(collectionData.id, tokenId, this.blockNumber) : this.uniqueHelper.getToken(collectionData.id, tokenId, this.blockNumber, propertyKeys));
      if(!tokenData) {
        if(tokenId >= tokensCount) break;
        tokenId++;
        continue;
      }

      yield {tokenId, owner: tokenData.normalizedOwner, chainOwner: tokenData.owner, properties: tokenData.properties};
      tokenId++;
    }
  }

  async genCollectionData(collectionId) {
    return await this.uniqueHelper.getCollection(collectionId);
  }

  async getAllTokens(collectionData) {
    let tokens = [];
    const it = await this.genTokenData(collectionData, 1);
    while (true) {
      const i = await it.next();
      if (i.done) break;
      tokens.push(i.value);
    }
    return tokens;
  }

  async export(collectionId, refresh=false) {
    const filename = this.getTokensFilename(collectionId);
    const collectionData = await this.genCollectionData(collectionId);
    if(collectionData === null) {
      this.logger.log(`No collection #${collectionId}`, this.logger.level.WARNING);
      return;
    }
    fs.writeFileSync(this.getCollectionFilename(collectionId), JSON.stringify(collectionData, null, 2));
    let base = '[';
    if(fs.existsSync(filename) && !refresh) {
      base = fs.readFileSync(filename).toString();
      if(base.endsWith('\n]')) base = base.slice(0, -1);
    }
    const writeStream = fs.createWriteStream(filename, {flags: 'w'});
    writeStream.write(base);
    let tokenId = this.getLastTokenId(base), count = tokenId === 1 ? 0 : tokenId;
    const it = await this.genTokenData(collectionData, tokenId);
    while (true) {
      const i = await it.next();
      if(i.done) break;
      writeStream.write(`${(count === 0)?'\n  ':',\n  '}${JSON.stringify(i.value)}`);
      count++;
      this.logger.log(`[Collection ${collectionId}] Exported token #${tokenId++}`);
    }
    await (new Promise((resolve, reject) => {
      writeStream.end('\n]', () => {
        this.logger.log(`[Collection ${collectionId}] Export finished, file: ${filename}`);
        resolve(true);
      });
      writeStream.on('error', reject);
    }));
  }
}


module.exports = {
  UniqueExporter
}
