const fs = require('fs');
const path = require('path');

const { Logger } = require('../lib/logger');


class ImportState {
  constructor(importer, collectionId=null, autoload=true) {
    this.importer = importer;
    this.state = null;

    if(collectionId !== null) this.setCollectionId(collectionId, autoload);
  }

  setCollectionId(collectionId, autoload=true) {
    this.filename = this.importer.getStateFilename(collectionId);
    this.state = null;
    if(autoload) this.load();
  }

  getNewState() {
    return {
      id: null,
      is_burned: false,
      is_created: false,
      has_properties: false,
      has_token_property_permissions: false,
      has_limits: false,
      has_sponsorship: false,
      changed_ownership: false,
      created_tokens: []
    }
  }

  load() {
    if(!fs.existsSync(this.filename)) {
      this.state = this.getNewState();
    }
    else {
      this.state = JSON.parse(fs.readFileSync(this.filename).toString());
    }
  }

  updateState(props, save=true) {
    this.state = {...this.state, ...props};
    if(save) this.save();
  }

  save() {
    fs.writeFileSync(this.filename, JSON.stringify(this.state, null, 2));
  }

}

class UniqueImporter {
  constructor(signer, uniqueHelper, importPath, logger) {
    this.signer = signer;
    this.uniqueHelper = uniqueHelper;
    if(typeof logger === 'undefined') logger = new Logger();
    this.logger = logger;
    if(typeof importPath === 'undefined') importPath = '.';
    this.importPath = importPath;
  }

  getStateFilename(collectionId) {
    return path.join(this.importPath, `import_state_collection_${collectionId}.json`)
  }

  async createTokens(exportedCollection, exportedTokensList) {
    const exportCollectionId = exportedCollection.id;
    let importState = new ImportState(this, exportCollectionId),
      collectionId = importState.state.id,
      exportedTokens = {};
    exportedTokensList.forEach(t => exportedTokens[t.tokenId] = t);
    if(!collectionId) {
      this.logger.log(`You must create new collection for exported collection #${exportCollectionId} first`);
      return;
    }

    let firstToken = importState.state.created_tokens.reduce((a, b) => a > b ? a : b, 0) + 1;
    let tokensToCreate = [], tokenId = firstToken, tokensLimit = 100;
    const mintTokens = async () => {
      if(!tokensToCreate.length) return;
      const expectedFirstTokenId = (await this.uniqueHelper.getCollectionLastTokenId(collectionId)) + 1;
      if(expectedFirstTokenId !== tokensToCreate[0].tokenId) throw Error(`Expected first token to mint #${expectedFirstTokenId}, got #${tokensToCreate[0].tokenId}`);
      let data = [];
      for(let expToken of tokensToCreate) {
        data.push({
          owner: expToken.owner,
          properties: expToken.properties
        });
      }
      const tokensToStr = arr => arr.map(x => `${x.tokenId}`).join(', ');
      let newTokens = await this.uniqueHelper.mintMultipleNFTTokens(this.signer, collectionId, data, `Collection #${collectionId} (Tokens #${tokensToStr(tokensToCreate)})`);
      if (!newTokens.success) throw Error(`Unable to create tokens ${tokensToStr(tokensToCreate)}`);
      if (tokensToStr(tokensToCreate) !== tokensToStr(newTokens.tokens)) throw Error(`Token has unexpected tokenId (${tokensToStr(newTokens.tokens)} instead of ${tokensToStr(tokensToCreate)})`);
      this.logger.log(`Created tokens #${tokensToStr(newTokens.tokens)}`);
      for(let token of newTokens.tokens) {
        importState.state.created_tokens.push(token.tokenId);
      }
      importState.save();
      tokensToCreate = [];
    }
    while (true) {
      let needBreak = tokenId > exportedCollection.tokensCount;
      let expToken = exportedTokens[tokenId];
      if(tokensToCreate.length >= tokensLimit || needBreak || !expToken) await mintTokens();
      if(needBreak) break;
      if(!expToken) {
        let toBurn = await this.uniqueHelper.mintNFTToken(
          this.signer, {collectionId, owner: this.signer.address.toString()},
          `Collection #${collectionId} (Token #${tokenId})`
        );
        if(!toBurn.success) throw Error(`Unable to mint token #${tokenId} for collection #${collectionId}`);
        toBurn = toBurn.token;
        let burned = await this.uniqueHelper.burnNFTToken(this.signer, toBurn.collectionId, toBurn.tokenId);
        if(!burned) throw Error(`Unable to burn token #${toBurn.tokenId} for collection #${toBurn.collectionId}`);
        this.logger.log(`Burned token #${toBurn.tokenId}`);
        importState.state.created_tokens.push(toBurn.tokenId);
        importState.save();
      }
      else {
        tokensToCreate.push(expToken);
      }
      tokenId++;
    }
  }

  async createAndBurnCollection(exportCollectionId)  {
    let collectionId = (await this.uniqueHelper.mintNFTCollection(this.signer, {name: 'to burn', description: 'to burn', tokenPrefix: 'brn'})).collectionId;
    await this.uniqueHelper.burnNFTCollection(this.signer, collectionId);
    let importState = new ImportState(this, exportCollectionId);
    importState.updateState({id: collectionId, is_created: true, is_burned: true});
    return collectionId;
  }

  async changeOwnership(exportedCollection) {
    let importState = new ImportState(this, exportedCollection.id), collectionId = importState.state.id;
    if(!collectionId) {
      this.logger.log(`You must create new collection for exported collection #${exportedCollection.id} first`);
      return;
    }

    if(importState.changed_ownership) {
      this.logger.log(`Ownership for exported collection #${exportedCollection.id} already changed, nothing to do`, this.logger.level.WARNING);
      return;
    }

    for(let admin of exportedCollection.admins) {
      await this.uniqueHelper.addNFTCollectionAdmin(this.signer, collectionId, admin);
    }

    let result = await this.uniqueHelper.changeNFTCollectionOwner(this.signer, collectionId, exportedCollection.normalizedOwner);
    importState.updateState({changed_ownership: result});
  }

  async createCollection(exportedCollection) {
    const exportCollectionId = exportedCollection.id;
    let importState = new ImportState(this, exportedCollection.id);

    if(importState.state.is_burned) {
      this.logger.log(`Collection #${exportCollectionId} already imported and burned, nothing to do`, this.logger.level.ERROR);
      return importState.state.id;
    }

    let collectionId = importState.state.id;

    if(collectionId) {
      let existedCollection = await this.uniqueHelper.getCollection(collectionId);
      if(existedCollection === null) {
        this.logger.log('No collection with id from state, state cleared', this.logger.level.WARNING);
        importState.state = importState.getNewState();
        collectionId = importState.state.id;
      }
    }

    if(!importState.state.is_created) {
      let collectionOptions = {
        mode: {nft: null},
        name: exportedCollection.raw.name.map(x => x.split(',').join('')),
        description: exportedCollection.raw.description.map(x => x.split(',').join('')),
        tokenPrefix: exportedCollection.raw.tokenPrefix,
        properties: exportedCollection.raw.properties,
        tokenPropertyPermissions: exportedCollection.raw.tokenPropertyPermissions
      };

      if(exportedCollection.raw.sponsorship && exportedCollection.raw.sponsorship !== 'Disabled' && exportedCollection.raw.sponsorship.Confirmed) {
        collectionOptions.pendingSponsor = exportedCollection.raw.sponsorship.Confirmed;
      }

      {
        let limits = {};
        for(let option of Object.keys(exportedCollection.raw.limits)) {
          if(exportedCollection.raw.limits[option] !== null) limits[option] = exportedCollection.raw.limits[option];
        }
        if(Object.keys(limits).length > 0) collectionOptions.limits = limits;
      }

      collectionId = (await this.uniqueHelper.mintNFTCollection(this.signer, collectionOptions, `exported collection #${exportCollectionId}`)).collectionId;
      importState.updateState({
        is_created: true, id: collectionId,
        has_properties: true, has_token_property_permissions: true,
        has_sponsorship: true, has_limits: true
      });
    }

    this.logger.log(`Exported collection #${exportCollectionId} now #${collectionId}`);

    // TODO: add set properties and token_property_permissions

    if(!importState.state.has_sponsorship) {
      if(!exportedCollection.raw.sponsorship || exportedCollection.raw.sponsorship === 'Disabled' || !exportedCollection.raw.sponsorship.Confirmed) {
        this.logger.log(`No confirmed sponsorship, nothing to do, ${JSON.stringify(exportedCollection.raw.sponsorship)}`);
      }
      else {
        let result = await this.uniqueHelper.setNFTCollectionSponsor(this.signer, collectionId, exportedCollection.raw.sponsorship.Confirmed);
        importState.updateState({has_sponsorship: result});
      }
    }

    if(!importState.state.has_limits && false) {
      let limits = {};
      for(let option of Object.keys(exportedCollection.raw.limits)) {
        if(exportedCollection.raw.limits[option] !== null) limits[option] = exportedCollection.raw.limits[option];
      }
      let result = true;
      if(Object.keys(limits).length > 0) {
        result = await this.uniqueHelper.setNFTCollectionLimits(this.signer, collectionId, limits);
      }
      importState.updateState({has_limits: result});
    }
    return collectionId;
  }

  async import(exportedCollection, exportedTokensList) {
    await this.createCollection(exportedCollection);
    await this.createTokens(exportedCollection, exportedTokensList);
    await this.changeOwnership(exportedCollection);
  }
}

module.exports = {
  UniqueImporter
}
