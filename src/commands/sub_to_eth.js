const { evmToAddress, validateAddress } = require('@polkadot/util-crypto');

const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { UniqueHelper } = require('../lib/unique');
const { subToEth, getBalanceString } = require('../helpers/marketplace');


class SubToEth extends Command {
  POSITIONAL = [
    {key: 'addresses', isArray: true, help: 'List of addresses to check'}
  ]
  OPTIONAL = [
    {key: 'ws-endpoint', help: 'Unique WS endpoint'}
  ]
  HELP = 'Show polka address eth and eth2sub mirrors'

  async run(optional, positional) {
    let logger = new Logger(false);
    const wsEndpoint = optional['ws-endpoint'] || 'wss://opal.unique.network';
    logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint], logger.level.NONE);

    const uniqueHelper = new UniqueHelper(logger);
    await uniqueHelper.connect(wsEndpoint);

    let balanceString = await getBalanceString(uniqueHelper);

    for(let address of positional.addresses) {
      logger.log('\n', logger.level.NONE);
      let isValid = false;
      try {
        isValid = validateAddress(address);
      }
      catch (e) {}
      if(!isValid) {
        logger.log(logger.fmt(`${address} is not valid substrate address`, 'fg.red'), logger.level.NONE);
        continue;
      }
      let ethAddress = subToEth(address), subMirrorAddress = evmToAddress(ethAddress);
      logger.log([`${logger.fmt('Substrate address', 'fg.cyan')}:`, address], logger.level.NONE);
      let subBalance = balanceString(await uniqueHelper.getSubstrateAccountBalance(address));
      logger.log([`${logger.fmt('Substrate address balance', 'fg.cyan')}:`, logger.fmt(subBalance, 'fg.yellow')], logger.level.NONE);
      logger.log([`${logger.fmt('Ethereum mirror', 'fg.cyan')}:`, ethAddress], logger.level.NONE);
      let ethBalance = balanceString(await uniqueHelper.getEthereumAccountBalance(ethAddress));
      logger.log([`${logger.fmt('Ethereum mirror balance', 'fg.cyan')}:`, logger.fmt(ethBalance, 'fg.yellow')], logger.level.NONE);
      logger.log([`${logger.fmt('Substrate mirror of ethereum mirror', 'fg.cyan')}:`, subMirrorAddress], logger.level.NONE);
      let subMirrorBalance = balanceString(await uniqueHelper.getSubstrateAccountBalance(subMirrorAddress));
      logger.log([`${logger.fmt('Substrate mirror of ethereum mirror balance', 'fg.cyan')}:`, logger.fmt(subMirrorBalance, 'fg.yellow')], logger.level.NONE);
    }

    await uniqueHelper.disconnect();
  }
}

module.exports = {
  CommandCls: SubToEth
}
