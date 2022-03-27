const path = require('path');
const fs = require('fs');

const { evmToAddress } = require('@polkadot/util-crypto');

const { getContract } = require('../../../src/helpers/marketplace');


const contractBinPath = path.join(__dirname, 'contract.bin');
const contractHelpersAbiPath = path.join(__dirname, 'helpers.abi');
const gas = 2_500_000;

const SponsoringMode =  {
  Disabled: 0,
  Allowlisted: 1,
  Generous: 2
}

const deployContract = async (web3, uniqueHelper, donor) => {
  const oneToken = await uniqueHelper.getOneTokenNominal();

  const account = web3.eth.accounts.create();
  web3.eth.accounts.wallet.add(account.privateKey);
  await uniqueHelper.transferBalanceToSubstrateAccount(donor, evmToAddress(account.address), 10n * oneToken);

  const contractAbi = getContract(web3);
  const contract = await contractAbi.deploy({data: fs.readFileSync(contractBinPath).toString()}).send({from: account.address, gas: 5_000_000});
  await contract.methods.setEscrow(account.address, true).send({from: account.address, gas});

  const helpers = getContractHelpers(web3);

  await helpers.methods.setSponsoringMode(contract.options.address, SponsoringMode.Allowlisted).send({from: account.address, gas});
  await helpers.methods.setSponsoringRateLimit(contract.options.address, 0).send({from: account.address, gas});
  await uniqueHelper.transferBalanceToSubstrateAccount(donor, evmToAddress(contract.options.address), oneToken * 100n);

  return contract.options.address;
};

const getContractHelpers = web3 => {
  return new web3.eth.Contract(JSON.parse(fs.readFileSync(contractHelpersAbiPath).toString()), '0x842899ECF380553E8a4de75bF534cdf6fBF64049');
}

module.exports = {
  deployContract, getContractHelpers
}
