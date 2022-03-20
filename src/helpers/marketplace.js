const { addressToEvm } = require('@polkadot/util-crypto');
const Web3 = require('web3');

const subToEthLowercase = eth => {
  const bytes = addressToEvm(eth);
  return '0x' + Buffer.from(bytes).toString('hex');
}

const subToEth = eth => {
  return Web3.utils.toChecksumAddress(subToEthLowercase(eth));
}

const getBalanceString = async (uniqueHelper) => {
  const chainProperties = await uniqueHelper.getChainProperties();
  return balance => {
    return `${balance / (10n ** BigInt(chainProperties.tokenDecimals || '18'))} ${chainProperties.tokenSymbol || 'tokens'} (${balance})`
  };
}

module.exports = {
  subToEth, getBalanceString
}
