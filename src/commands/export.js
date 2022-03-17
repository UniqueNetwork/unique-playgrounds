const { Command } = require('../lib/cli');
const { UniqueHelper, UniqueSchemaHelper } = require('../lib/unique');
const { UniqueExporter } = require('../helpers/export');
const { Logger, SilentLogger } = require('../lib/logger');


class Export extends Command {
  POSITIONAL = [
    {key: 'collection_ids', isArray: true, help: 'Collection ids to export'}
  ]
  OPTIONAL = [
    {key: 'ws-endpoint', help: 'Unique WS endpoint'},
    {key: 'output-dir', help: 'Path to output dir'},
    {key: 'refresh', isBool: true, help: 'Refresh data if already exists'},
    {key: 'silent', isBool: true, help: 'Disable logging'}
  ]
  HELP = 'Command to export collections and tokens from Unique Network chains'

  async run(optional, positional) {
    const wsEndpoint = optional['ws-endpoint'] || 'wss://opal.unique.network';
    const collectionIds = positional['collection_ids'].map((x) => Number(x.trim())).filter((x) => !isNaN(x) && x > 0 && x !== Infinity);
    const outputDir = optional['output-dir'] || './data';
    let logger = new (optional.silent ? SilentLogger : Logger)(false);
    if(!optional.silent) {
      logger.log([`${logger.fmt('WS Endpoint', 'fg.yellow')}:`, wsEndpoint], logger.level.NONE);
      logger.log([`${logger.fmt('Collections to export', 'fg.yellow')}:`, collectionIds.join(', ')], logger.level.NONE);
      logger.log([`${logger.fmt('Output dir', 'fg.yellow')}:`, outputDir], logger.level.NONE);
    }
    if(collectionIds.length < 1) {
      logger.log(logger.fmt('No collection_ids provided, exit', 'fg.red'), logger.level.NONE);
      return;
    }
    const exportLogger = new (optional.silent ? SilentLogger : Logger)();
    const uniqueHelper = new UniqueHelper(exportLogger);
    await uniqueHelper.connect(wsEndpoint);
    const schemaHelper = new UniqueSchemaHelper(exportLogger);
    const exporter = new UniqueExporter(uniqueHelper, schemaHelper, outputDir, exportLogger);
    for(let collectionId of collectionIds) {
      await exporter.export(collectionId, optional.refresh);
    }
  }
}

module.exports = {
  CommandCls: Export
}
