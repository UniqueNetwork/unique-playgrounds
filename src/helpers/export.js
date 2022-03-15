const fs = require('fs');
const path = require('path');

const { UniqueUtil } = require('../lib/unique');


class UniqueExporter {
  constructor(uniqueHelper, schemaHelper, exportPath, logger) {
    if(typeof exportPath === 'undefined') exportPath = '.';
    if(typeof logger === 'undefined') logger = UniqueUtil.getDefaultLogger();
    this.exportPath = exportPath;
    this.uniqueHelper = uniqueHelper;
    this.schemaHelper = schemaHelper;
    this.logger = logger;
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
    return path.join(this.exportPath, `export_tokens_${collectionId}`);
  }

  getCollectionFilename(collectionId) {
    return path.join(this.exportPath, `export_collection_${collectionId}`);
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
      const tokenData = await this.uniqueHelper.getToken(collectionData.id, tokenId);
      if(!tokenData) {
        if(tokenId >= tokensCount) break;
        tokenId++;
        continue;
      }
      let currentOwner, realOwner, humanData;
      try {
        humanData = schema ? this.schemaHelper.decodeData(schema, tokenData.constData) : null;
      }
      catch (e) {
        humanData = null;
      }
      // TODO: filter market tokens
      realOwner = currentOwner = tokenData.owner;
      yield {tokenId, realOwner, currentOwner, constData: tokenData.constData, variableData: tokenData.variableData, humanData};
      tokenId++;
    }
  }

  async genCollectionData(collectionId) {
    return await this.uniqueHelper.getCollection(collectionId);
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
      if(base.endsWith('\n]')) base = '['; // force refresh
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
