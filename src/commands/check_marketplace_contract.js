const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { UniqueHelper } = require('../lib/unique');
const { getBalanceString } = require('../helpers/marketplace');


class CheckMarketplaceContract extends Command {
  POSITIONAL = [
    {key: 'contract_address', help: 'Address of marketplace evm contract'}
  ]
  OPTIONAL = [
    {key: 'ws-endpoint', help: 'Unique WS endpoint'}
  ]
  HELP = 'Check contract settings for unique marketplace'

  static async checkContract(uniqueHelper, contractAddress) {
    let balanceString = await getBalanceString(uniqueHelper);
    let checkResult = [];
    const fail = msg => {
      checkResult.push({status: 'fail', msg});
    }
    const success = msg => {
      checkResult.push({status: 'success', msg});
    }

    let code = '';
    try {
      code = await uniqueHelper.api.rpc.eth.getCode(contractAddress);
    } catch (e) {
      code = '';
    }
    const validContract = code.length > 0;

    if (validContract) {
      let address = contractAddress;
      success(`Contract address valid: ${address}`);
      const balance = await uniqueHelper.getEthereumAccountBalance(address);
      if (balance === 0n) {
        fail(`Contract balance is zero, transactions will be failed via insufficient balance error`);
      } else {
        success(`Contract balance is ${balanceString(balance)}`);
      }
      if (!(await uniqueHelper.api.query.evmContractHelpers.selfSponsoring(address)).toJSON()) {
        fail(`Contract self-sponsoring is not enabled. You should call toggleSelfSponsoring first`);
      } else {
        success(`Contract self-sponsoring is enabled`);
      }
      const rateLimit = (await uniqueHelper.api.query.evmContractHelpers.sponsoringRateLimit(address)).toJSON();
      if (rateLimit !== 0) {
        fail(`Rate limit is not zero, users should wait ${rateLimit} blocks between calling sponsoring`);
      } else {
        success(`Rate limit is zero blocks`);
      }
    }
    else if (contractAddress) {
      fail(`Contract address invalid: ${contractAddress}`);
    }
    let owner = await uniqueHelper.api.query.evmContractHelpers.owner(contractAddress);
    checkResult.push({msg: `Contract owner address: ${owner}`, status: 'none'});
    let balance = await uniqueHelper.getEthereumAccountBalance(owner);
    checkResult.push({msg: `Contract owner balance is ${balanceString(balance)}`, status: 'none'});
    return checkResult;
  }

  async run(optional, positional) {
    let logger = new Logger(false);
    const wsEndpoint = optional['ws-endpoint'] || 'wss://opal.unique.network';
    const contractAddress = positional['contract_address'];
    logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint], logger.level.NONE);
    logger.log([`${logger.fmt('Contract address to check', 'fg.cyan')}:`, contractAddress], logger.level.NONE);
    if(!contractAddress) {
      logger.log(logger.fmt('No contract_address provided, exit', 'fg.red'), logger.level.NONE);
      return;
    }
    const uniqueHelper = new UniqueHelper(logger);
    await uniqueHelper.connect(wsEndpoint);
    let check = await this.constructor.checkContract(uniqueHelper, contractAddress);
    logger.log(`\nContract ${contractAddress}`, logger.level.NONE);
    for(let msg of check) {
      let symbol = msg.status === 'fail' ? logger.fmt('[x]', 'fg.red'): (msg.status === 'success' ? logger.fmt('[v]', 'fg.green') : '');
      if(symbol) symbol = `${symbol} `;
      logger.log(`${symbol}${msg.msg}`, logger.level.NONE);
    }
    await uniqueHelper.disconnect();
  }
}

module.exports = {
  CommandCls: CheckMarketplaceContract
}
