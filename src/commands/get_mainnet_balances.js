const { validateAddress } = require('@polkadot/util-crypto');

const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { UniqueHelper } = require('../lib/unique');
const { getBalanceString } = require('../helpers/util');

class GetMainnetBalances extends Command {
  POSITIONAL = [
    {key: 'addresses', isArray: true, help: 'List of addresses to check'}
  ]
  HELP = 'Show balances on mainnets (unique and quartz)'

  async run(optional, positional) {
    let logger = new Logger(false);
    const validAddresses = positional.addresses.filter(x => {
      let isValid = false;
      try {
        isValid = validateAddress(x);
      }
      catch (e) {}
      if(!isValid) {
        logger.log(logger.fmt(`${x} is not valid substrate address`, 'fg.red'), logger.level.NONE);
      }
      return isValid;
    });
    if(validAddresses.length < 1) return;

    for(const [wsEndpoint, network] of [['wss://ws.unique.network', 'Unique'], ['wss://ws-quartz.unique.network', 'Quartz']]) {
      const uniqueHelper = new UniqueHelper(logger);
      await uniqueHelper.connect(wsEndpoint);
      const balanceString = await getBalanceString(uniqueHelper);
      logger.log([`${logger.fmt(`${network} mainnet`, 'fg.green')}:`, wsEndpoint], logger.level.NONE);
      for(let address of validAddresses) {
        logger.log('\n', logger.level.NONE);
        logger.log([`${logger.fmt('Substrate address', 'fg.cyan')}:`, address], logger.level.NONE);
        logger.log([`${logger.fmt('Address balance', 'fg.cyan')}:`, logger.fmt(balanceString(await uniqueHelper.getSubstrateAccountBalance(address)), 'fg.yellow')], logger.level.NONE);
      }

      await uniqueHelper.disconnect();
    }
  }
}

module.exports = {
  CommandCls: GetMainnetBalances
}
