const { Command } = require('../lib/cli');
const { Logger } = require('../lib/logger');
const { UniqueHelper } = require('../lib/unique');
const { getRemoteMarketplaceSettings, sellTokenToContract, getContract, connectWeb3 } = require('../helpers/marketplace');


class SellTokenToMarketplace extends Command {
  POSITIONAL = [
    {key: 'marketplace_api_url', help: 'URL for marketplace api domain with protocol (Example: https://api.unqnft.io)'}
  ]
  OPTIONAL = [
    {key: 'signer-seed', help: 'Seed of minter account'},
    {key: 'token-id', help: 'Token ID to sell'},
    {key: 'collection-id', help: 'Collection ID to sell. Collection must be allowed on marketplace'},
    {key: 'price', help: 'Token price. 1 KSM = 1000000000000'}
  ]
  HELP = 'Sell token on remote unique marketplace installation'

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
    const collectionId = parseInt(optional['collection-id']);
    const tokenId = parseInt(optional['token-id']);
    const signerSeed = optional['signer-seed'];
    let price;
    try {
      price = BigInt(optional['price']);
    }
    catch(e) {
      logger.log('Invalid --price param', logger.level.ERROR);
      return;
    }
    if(price < 1_000_000n) {
      logger.log('Price too low. Need at least 1000000', logger.level.ERROR);
      return;
    }
    let signer;

    if(collectionIds.indexOf(collectionId) === -1) {
      logger.log('Your collection not allowed for this marketplace', logger.level.ERROR);
      return;
    }

    if(isNaN(tokenId) || tokenId < 1) {
      logger.log('Invalid --token-id param', logger.level.ERROR);
      return;
    }


    logger.log([`${logger.fmt('WS Endpoint', 'fg.cyan')}:`, wsEndpoint], logger.level.NONE);
    logger.log([`${logger.fmt('Contract address', 'fg.cyan')}:`, contractAddress], logger.level.NONE);
    logger.log([`${logger.fmt('Collection', 'fg.cyan')}:`, collectionId.toString()], logger.level.NONE);
    logger.log([`${logger.fmt('Token', 'fg.cyan')}:`, tokenId.toString()], logger.level.NONE);
    logger.log([`${logger.fmt('Price', 'fg.cyan')}:`, price.toString()], logger.level.NONE);

    const uniqueHelper = new UniqueHelper(logger);
    await uniqueHelper.connect(wsEndpoint);

    try {
      signer = uniqueHelper.util.fromSeed(signerSeed);
    }
    catch(e) {
      logger.log(logger.fmt('Invalid --signer-seed argument, exit', 'fg.red'), logger.level.NONE);
      await uniqueHelper.disconnect();
      return;
    }

    let tokenOwner = (await uniqueHelper.getToken(collectionId, tokenId)).normalizedOwner;

    if(tokenOwner.substrate !== uniqueHelper.util.normalizeSubstrateAddress(signer.address)) {
      logger.log(logger.fmt('Account from --signer-seed argument does not own this token', 'fg.red'), logger.level.NONE);
      await uniqueHelper.disconnect();
      return;
    }

    const {web3, provider} = connectWeb3(wsEndpoint);

    try{
      await sellTokenToContract(signer, collectionId, tokenId, price, getContract(web3, contractAddress), uniqueHelper, web3);
    }
    catch(e) {
      logger.log([logger.fmt('Error while selling token', 'fg.red'), e.toString()], logger.level.NONE);
      provider.connection.close();
      await uniqueHelper.disconnect();
      return;
    }
    logger.log(logger.fmt('Token successfully sent to market', 'fg.green'), logger.level.NONE);

    provider.connection.close();
    await uniqueHelper.disconnect();
  }
}

module.exports = {
  CommandCls: SellTokenToMarketplace
}
