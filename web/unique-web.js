const { UniqueHelper, UniqueUtil } = require('../src/lib/unique');

class UniqueHelperWeb extends UniqueHelper {
  constructor(injector, logger) {
    super(logger);
    this.injector = injector;
  }

  setInjector(injector) {
    this.injector = injector;
  }

  signTransaction(sender, transaction, label = 'transaction') {
    return new Promise(async (resolve, reject) => {
      try {
        let unsub = await transaction.signAndSend(sender, {signer: this.injector.signer}, result => {
          const status = this.getTransactionStatus(result);

          if (status === this.transactionStatus.SUCCESS) {
            this.logger.log(`${label} successful`);
            resolve({result, status});
            unsub();
          } else if (status === this.transactionStatus.FAIL) {
            this.logger.log(`Something went wrong with ${label}. Status: ${status}`, this.logger.level.ERROR);
            reject({result, status});
            unsub();
          }
        });
      } catch (e) {
        this.logger.log(e, this.logger.level.ERROR);
        reject(e);
      }
    });
  }
}

module.exports = {
  Helper: UniqueHelperWeb,
  Util: UniqueUtil,
  PolkaExt: require('@polkadot/extension-dapp')
}
