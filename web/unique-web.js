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
    const sign = callback => {
      if(typeof sender === 'string') return transaction.signAndSend(sender, {signer: this.injector.signer}, callback);
      return transaction.signAndSend(sender, callback);
    }
    return new Promise(async (resolve, reject) => {
      try {
        let unsub = await sign(result => {
          const status = this.getTransactionStatus(result);

          if (status === this.transactionStatus.SUCCESS) {
            this.logger.log(`${label} successful`);
            unsub();
            resolve({result, status});
          } else if (status === this.transactionStatus.FAIL) {
            this.logger.log(`Something went wrong with ${label}. Status: ${status}`, this.logger.level.ERROR);
            unsub();
            reject({result, status});
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
