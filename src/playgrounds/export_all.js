const path = require('path');
const fs = require('fs');

const { getUsage } = require('../lib/cli');
const { Logger } = require('../lib/logger');

const { UniqueHelper } = require('../lib/unique');
const { CommandCls } = require('../commands/export');


const prepareOutputDir = outputDir => {
  let fromCollectionId = 1;
  if(fs.existsSync(outputDir)) {
    for(let file of fs.readdirSync(outputDir)) {
      if(!file.startsWith('export_collection_')) continue;
      let collectionId = parseInt(file.split('export_collection_')[1].split('.json')[0]);
      if(collectionId > fromCollectionId) fromCollectionId = collectionId;
    }
  }
  else {
    fs.mkdirSync(outputDir, {recursive: true});
  }
  return fromCollectionId;
}


const main = async (args) => {
  const logger = new Logger(false, Logger.LEVEL.NONE);
  const wsEndpoint = args[0];
  let outputDir = args[1];
  if(typeof outputDir === 'undefined') outputDir = path.join('.', 'data', 'export_all');
  const fromCollectionId = prepareOutputDir(outputDir);

  logger.log([`${logger.fmt('Output dir', 'fg.cyan')}:`, outputDir]);
  logger.log([`${logger.fmt('Start from collection', 'fg.cyan')}:`, fromCollectionId]);
  logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint]);


  const uniqueHelper = new UniqueHelper(logger);
  await uniqueHelper.connect(wsEndpoint);
  let totalCollections = await uniqueHelper.getTotalCollectionsCount();

  let collectionToExport = [];
  for (let collectionId = fromCollectionId; collectionId <= totalCollections; collectionId++) {
    let collectionExists = (await uniqueHelper.getCollection(collectionId)) !== null;
    if(!collectionExists) continue;
    collectionToExport.push(collectionId);
  }
  await uniqueHelper.disconnect();

  const command = new CommandCls();
  await command.run({'ws-endpoint': wsEndpoint, 'output-dir': outputDir}, {'collection_ids': collectionToExport.map(x => `${x}`)});
}


module.exports = {
  main,
  description: 'Export all collections playground',
  help: getUsage('npm run -- playground export_all', {
    positional: [
      {key: 'ws_endpoint', help: 'wsEndpoint for unique chain to export'},
      {key: 'output_dir', help: 'directory for exported collections (default: ./data/export_all)'}
    ],
    help: 'Command to export all collections from chain (useful for local nodes)'
  })
}
