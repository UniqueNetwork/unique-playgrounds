const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { CommandCls: CheckCollection } = require('./check_marketplace_collection')
const { CommandCls: CheckContract } = require('./check_marketplace_contract');
const { UniqueHelper } = require('../lib/unique');
const { getBalanceString, getRemoteMarketplaceSettings } = require('../helpers/marketplace');


class CheckMarketplaceConfig extends Command {
  POSITIONAL = [
    {key: 'marketplace_api_url', help: 'URL for marketplace api domain with protocol (Example: https://api.unqnft.io)'}
  ]
  HELP = 'Check settings for unique marketplace installation'

  async run(optional, positional) {
    let logger = new Logger(false);
    const marketplaceSettingsUrl = `${positional['marketplace_api_url']}/api/settings`;

    logger.log([`${logger.fmt('Settings url', 'fg.cyan')}:`, marketplaceSettingsUrl], logger.level.NONE);

    let settings;

    try {
      settings = await getRemoteMarketplaceSettings(marketplaceSettingsUrl);
    }
    catch(e) {
      logger.log('Unable to get marketplace settings. Are marketplace_api_url correct?', logger.level.ERROR);
      return;
    }
    const wsEndpoint = settings.blockchain.unique.wsEndpoint;
    const collectionIds = settings.blockchain.unique.collectionIds;
    const contractAddress = settings.blockchain.unique.contractAddress;
    const escrowAddress = settings.blockchain.escrowAddress;


    logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint], logger.level.NONE);
    logger.log([`${logger.fmt('Escrow address', 'fg.cyan')}:`, escrowAddress], logger.level.NONE);
    logger.log([`${logger.fmt('Contract address to check', 'fg.cyan')}:`, contractAddress], logger.level.NONE);
    logger.log([`${logger.fmt('Collections to check', 'fg.cyan')}:`, collectionIds.join(', ')], logger.level.NONE);

    const uniqueHelper = new UniqueHelper(logger);
    await uniqueHelper.connect(wsEndpoint);
    let balanceString = await getBalanceString(uniqueHelper);
    logger.log(`Escrow balance: ${balanceString(await uniqueHelper.getSubstrateAccountBalance(escrowAddress))}`, logger.level.NONE);
    logger.log(`\nContract ${contractAddress}`, logger.level.NONE);
    for(let msg of (await CheckContract.checkContract(uniqueHelper, contractAddress))) {
      let symbol = msg.status === 'fail' ? logger.fmt('[x]', 'fg.red'): (msg.status === 'success' ? logger.fmt('[v]', 'fg.green') : '');
      if(symbol) symbol = `${symbol} `;
      logger.log(`${symbol}${msg.msg}`, logger.level.NONE);
    }
    for(let collectionId of collectionIds) {
      let check = await CheckCollection.checkCollection(uniqueHelper, collectionId);
      logger.log(`\nCollection #${collectionId}`, logger.level.NONE);
      for(let msg of check) {
        let symbol = msg.status === 'fail' ? logger.fmt('[x]', 'fg.red'): logger.fmt('[v]', 'fg.green');
        logger.log(`  ${symbol} ${msg.msg}`, logger.level.NONE);
      }
    }
    await uniqueHelper.disconnect();
  }
}

module.exports = {
  CommandCls: CheckMarketplaceConfig
}
