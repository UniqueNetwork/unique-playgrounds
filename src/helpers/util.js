const getBalanceString = async (uniqueHelper) => {
  const chainProperties = await uniqueHelper.getChainProperties();
  return balance => {
    return `${balance / (10n ** BigInt((chainProperties.tokenDecimals || ['18'])[0]))} ${(chainProperties.tokenSymbol || ['tokens'])[0]} (${balance})`
  };
}

module.exports = {
  getBalanceString
}
