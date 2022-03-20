const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { UniqueHelper } = require('../lib/unique');
const { subToEth, getBalanceString } = require('../helpers/marketplace');


class CheckMarketplaceCollection extends Command {
  POSITIONAL = [
    {key: 'collection_ids', isArray: true, help: 'List of collections to check'}
  ]
  OPTIONAL = [
    {key: 'ws-endpoint', help: 'Unique WS endpoint'}
  ]
  HELP = 'Check collection settings for unique marketplace'

  static async checkCollection(uniqueHelper, collectionId) {
    let balanceString = await getBalanceString(uniqueHelper);
    let checkResult = [];
    const fail = msg => {
      checkResult.push({status: 'fail', msg});
    }
    const success = msg => {
      checkResult.push({status: 'success', msg});
    }
    let collection = (await uniqueHelper.getCollection(collectionId)).raw;
    if(collection === null) {
      fail('Collection does not exists');
      return checkResult;
    }
    let sponsorship = collection.sponsorship;
    if(typeof sponsorship !== 'string') {
      sponsorship = {}
      for(let key of Object.keys(collection.sponsorship)) {
        sponsorship[key.toLocaleLowerCase()] = collection.sponsorship[key];
      }
    }
    if ((typeof sponsorship === 'string' && sponsorship.toLocaleLowerCase() === 'disabled') || sponsorship.disabled) {
      fail(`Sponsoring is disabled`);
    }
    else if (sponsorship.pending) {
      fail(`Sponsoring is pending. ${sponsorship.pending} should confirm sponsoring via confirmSponsorship`);
    }
    else if (sponsorship.confirmed) {
      const address = sponsorship.confirmed;
      const evmAddress = subToEth(address);
      const normalizedAddress = uniqueHelper.util.normalizeSubstrateAddress(address)
      success(`Sponsor is confirmed, ${address}${address !== normalizedAddress ? ' (Normalized address: ' + normalizedAddress + ')' :''}`);
      {
        const balance = await uniqueHelper.getSubstrateAccountBalance(address);
        if (balance === 0n) {
          fail(`Substrate wallet of sponsor is empty. Transfer some funds to ${address}`);
        } else {
          success(`Sponsor has ${balanceString(balance)} on its substrate wallet`);
        }
      }
      {
        const balance = await uniqueHelper.getEthereumAccountBalance(evmAddress);
        if (balance === 0n) {
          fail(`Ethereum wallet of sponsor is empty. Transfer some funds to ${evmAddress}`);
        } else {
          success(`Sponsor has ${balanceString(balance)} on its ethereum wallet`);
        }
      }
    }
    else {
      fail(`Unknown sponsorship state: ${Object.keys(collection.sponsorship)[0]}`);
    }

    {
      const timeout = collection.limits.sponsorTransferTimeout;
      if(timeout === null || timeout.toString() !== '0') {
        fail(`Transfer timeout is ${timeout || 'not set (default, non-zero is used)'}`);
      } else {
        success(`Transfer timeout is zero blocks`);
      }
    }
    {
      const timeout = collection.limits.sponsorApproveTimeout;
      if(timeout === null || timeout.toString() !== '0') {
        fail(`Approve timeout is ${timeout || 'not set (default, non-zero is used)'}`);
      } else {
        success(`Approve timeout is zero blocks`);
      }
    }
    return checkResult
  }

  async run(optional, positional) {
    let logger = new Logger(false);
    const wsEndpoint = optional['ws-endpoint'] || 'wss://opal.unique.network';
    const collectionIds = positional['collection_ids'].map((x) => Number(x.trim())).filter((x) => !isNaN(x) && x > 0 && x !== Infinity);
    logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint], logger.level.NONE);
    logger.log([`${logger.fmt('Collections to check', 'fg.cyan')}:`, collectionIds.join(', ')], logger.level.NONE);
    if(collectionIds.length < 1) {
      logger.log(logger.fmt('No collection_ids provided, exit', 'fg.red'), logger.level.NONE);
      return;
    }
    const uniqueHelper = new UniqueHelper(logger);
    await uniqueHelper.connect(wsEndpoint);
    for(let collectionId of collectionIds) {
      let check = await this.constructor.checkCollection(uniqueHelper, collectionId);
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
  CommandCls: CheckMarketplaceCollection
}
