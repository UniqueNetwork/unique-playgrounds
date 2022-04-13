const fs = require('fs');
const path = require('path');

const { UniqueUtil } = require('../lib/unique');

const UNDEFINED = ({}).notdefined;

class UniqueExporter {
  constructor(uniqueHelper, schemaHelper, exportPath, logger, blockNumber) {
    if(typeof exportPath === 'undefined') exportPath = '.';
    if(typeof logger === 'undefined') logger = UniqueUtil.getDefaultLogger();
    this.exportPath = exportPath;
    this.uniqueHelper = uniqueHelper;
    this.schemaHelper = schemaHelper;
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

  async *genTokenData(collectionData, startToken=1) {
    let tokenId = startToken;

    const tokensCount = collectionData.tokensCount;
    let schema;
    try {
      schema = this.schemaHelper.decodeSchema(collectionData.raw.constOnChainSchema);
    }
    catch(e) {
      schema = null;
    }

    while (true) {
      const tokenData = await this.uniqueHelper.getToken(collectionData.id, tokenId, this.blockNumber);
      if(!tokenData) {
        if(tokenId >= tokensCount) break;
        tokenId++;
        continue;
      }
      let decodedConstData;
      try {
        decodedConstData = schema ? this.schemaHelper.decodeData(schema, tokenData.constData).data : null;
      }
      catch (e) {
        decodedConstData = null;
      }
      yield {tokenId, owner: tokenData.normalizedOwner, chainOwner: tokenData.owner, constData: tokenData.constData, variableData: tokenData.variableData, decodedConstData};
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
