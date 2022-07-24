const { IgnorePlugin } = require('webpack');
const { UniqueHelper, UniqueUtil } = require('../src/lib/unique');

class UniqueHelperWeb extends UniqueHelper {
  constructor(injector, logger) {
    super(logger);
    this.injector = injector;
  }

  setInjector(injector) {
    this.injector = injector;
  }

  signTransaction(sender, transaction, label = 'transaction', options = null) {
    if(typeof sender === 'string') options = {...(options || {}), signer: this.injector.signer};
    return super.signTransaction(sender, transaction, label, options);
  }
}

module.exports = {
  Helper: UniqueHelperWeb,
  Util: UniqueUtil,
  PolkaExt: require('@polkadot/extension-dapp')
}
