const path = require('path');
const fs = require('fs');

const { getUsage } = require('../lib/cli');
const { Logger } = require('../lib/logger');

const { UniqueHelper} = require('../lib/unique');
const { UniqueExporter } = require('../helpers/export');
const { UniqueImporter } = require('../helpers/import');


const getMaxCollectionId = inputDir => {
  let toCollectionId = 1;
  for(let file of fs.readdirSync(inputDir)) {
    if(!file.startsWith('export_collection_')) continue;
    let collectionId = parseInt(file.split('export_collection_')[1].split('.json')[0]);
    if(collectionId > toCollectionId) toCollectionId = collectionId;
  }
  return toCollectionId;
}


const main = async (args) => {
  const logger = new Logger(false, Logger.LEVEL.NONE);
  const signerSeed = args[0];
  const wsEndpoint = args[1];
  let inputDir = args[2];
  if(typeof inputDir === 'undefined') inputDir = path.join('.', 'data', 'export_all');
  if(!fs.existsSync(inputDir)) {
    logger.log(logger.fmt('Invalid input_dir argument, exit'));
    return;
  }
  const toCollectionId = getMaxCollectionId(inputDir);

  logger.log([`${logger.fmt('Input dir', 'fg.cyan')}:`, inputDir]);
  logger.log([`${logger.fmt('End on collection', 'fg.cyan')}:`, toCollectionId]);
  logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint]);

  const uniqueHelper = new UniqueHelper(logger);
  await uniqueHelper.connect(wsEndpoint);

  let signer;
  try {
    signer = uniqueHelper.util.fromSeed(signerSeed);
  }
  catch(e) {
    logger.log(logger.fmt('Invalid signer_seed argument, exit', 'fg.red'), logger.level.NONE);
    return;
  }
  const importLogger = new Logger();
  const exporter = new UniqueExporter(uniqueHelper, inputDir, importLogger);
  const importer = new UniqueImporter(signer, uniqueHelper, inputDir, importLogger);

  let fromCollection = await uniqueHelper.getTotalCollectionsCount() + 1;

  let collectionsToImport = [];
  for (let collectionId = fromCollection; collectionId <= toCollectionId; collectionId++) {
    let collectionExists = fs.existsSync(exporter.getCollectionFilename(collectionId));
    collectionsToImport.push({id: collectionId, mode: collectionExists ? 'import': 'burn'});
  }

  for(let collection of collectionsToImport) {
    importLogger.log(`Collection #${collection.id}: ${collection.mode}`);

    if(collection.mode === 'burn') {
      await importer.createAndBurnCollection(collection.id);
    }
    if(collection.mode === 'import') {
      await importer.import(
        JSON.parse(fs.readFileSync(exporter.getCollectionFilename(collection.id)).toString()),
        JSON.parse(fs.readFileSync(exporter.getTokensFilename(collection.id)).toString())
      );
    }
  }

  await uniqueHelper.disconnect();
}


module.exports = {
  main,
  description: 'Import all collections playground',
  help: getUsage('npm run -- playground export_all', {
    positional: [
      {key: 'signer_seed', help: 'seed of user, who create collections'},
      {key: 'ws_endpoint', help: 'wsEndpoint for unique chain to import'},
      {key: 'input_dir', help: 'directory for exported collections (default: ./data/export_all)'}
    ],
    help: 'Command to import all collections to chain (useful for local nodes)'
  })
}
