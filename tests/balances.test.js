const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');
const { clearChainLog } = require('./misc/util');

describe('Balances tests',  () => {
  let uniqueHelper;
  let alice;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test transferBalanceToSubstrateAccount', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const oneToken = await uniqueHelper.balance.getOneTokenNominal();

    let aliceBalance = {before: await uniqueHelper.balance.getSubstrate(alice.address)};
    let bobBalance = {before: await uniqueHelper.balance.getSubstrate(bob.address)};

    let result = await uniqueHelper.balance.transferToSubstrate(alice, bob.address, oneToken);
    expect(result).to.be.true;

    bobBalance.after = await uniqueHelper.balance.getSubstrate(bob.address);
    aliceBalance.after = await uniqueHelper.balance.getSubstrate(alice.address)

    expect(bobBalance.after).to.eq(bobBalance.before + oneToken);
    expect((aliceBalance.before - aliceBalance.after) >= oneToken).to.be.true;

    expect(clearChainLog(uniqueHelper.chainLog)).to.deep.eq([
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY']},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty']},
      {type: 'extrinsic', status: 'Success', call: 'api.tx.balances.transfer', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', oneToken]},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty']},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY']}
    ])
  });
});
