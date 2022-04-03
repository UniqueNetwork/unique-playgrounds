const fs = require('fs');

const { Command } = require('../lib/cli');
const { UniqueHelper, UniqueSchemaHelper } = require('../lib/unique');
const { UniqueExporter } = require('../helpers/export');
const { UniqueImporter } = require('../helpers/import');
const { Logger, SilentLogger } = require('../lib/logger');


class Import extends Command {
  POSITIONAL = [
    {key: 'collection_ids', isArray: true, help: 'Exported collection ids to import'}
  ]
  OPTIONAL = [
    {key: 'ws-endpoint', help: 'Unique WS endpoint'},
    {key: 'signer-seed', help: 'Seed of minter account'},
    {key: 'input-dir', help: 'Path to input dir (With exported collections)'},
    {key: 'output-dir', help: 'Path to output dir (For import state)'},
    {key: 'refresh', isBool: true, help: 'Refresh data if already exists'},
    {key: 'silent', isBool: true, help: 'Disable logging'}
  ]
  HELP = 'Command to import collections and tokens from Unique Network chains'

  async run(optional, positional) {
    const wsEndpoint = optional['ws-endpoint'] || 'wss://opal.unique.network';
    const collectionIds = positional['collection_ids'].map((x) => Number(x.trim())).filter((x) => !isNaN(x) && x > 0 && x !== Infinity);
    const outputDir = optional['output-dir'] || './data';
    const inputDir = optional['input-dir'] || './data';
    const signerSeed = optional['signer-seed'];
    let signer;

    let logger = new (optional.silent ? SilentLogger : Logger)(false);
    if(!optional.silent) {
      logger.log([`${logger.fmt('WS Endpoint', 'fg.yellow')}:`, wsEndpoint], logger.level.NONE);
      logger.log([`${logger.fmt('Collections to import', 'fg.yellow')}:`, collectionIds.join(', ')], logger.level.NONE);
      logger.log([`${logger.fmt('Input dir', 'fg.yellow')}:`, inputDir], logger.level.NONE);
      logger.log([`${logger.fmt('Output dir', 'fg.yellow')}:`, outputDir], logger.level.NONE);
    }
    if(collectionIds.length < 1) {
      logger.log(logger.fmt('No collection_ids provided, exit', 'fg.red'), logger.level.NONE);
      return;
    }
    const exportLogger = new (optional.silent ? SilentLogger : Logger)();
    const uniqueHelper = new UniqueHelper(exportLogger);
    await uniqueHelper.connect(wsEndpoint);
    try {
      signer = uniqueHelper.util.fromSeed(signerSeed);
    }
    catch(e) {
      logger.log(logger.fmt('Invalid --signer-seed option, exit', 'fg.red'), logger.level.NONE);
      return;
    }
    if(!optional.silent) {
      logger.log([`${logger.fmt('Signer address (normalized):', 'fg.yellow')}:`, signer.address], logger.level.NONE);
    }
    const schemaHelper = new UniqueSchemaHelper(exportLogger);
    const exporter = new UniqueExporter(uniqueHelper, schemaHelper, inputDir, exportLogger);
    const importer = new UniqueImporter(signer, uniqueHelper, outputDir, exportLogger);
    for(let collectionId of collectionIds) {
      let collectionFile = exporter.getCollectionFilename(collectionId);
      let tokensFile = exporter.getTokensFilename(collectionId);
      if(!fs.existsSync(collectionFile)) {
        logger.log(logger.fmt(`No collection file (${collectionFile}), skip collection #${collectionId}`));
        continue;
      }
      if(!fs.existsSync(tokensFile)) {
        logger.log(logger.fmt(`No tokens file (${tokensFile}), skip collection #${collectionId}`));
        continue;
      }

      await importer.import(JSON.parse(fs.readFileSync(collectionFile).toString()), JSON.parse(fs.readFileSync(tokensFile).toString()));
    }
  }
}

module.exports = {
  CommandCls: Import
}
