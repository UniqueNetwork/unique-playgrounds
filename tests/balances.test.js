const { expect } = require('chai');

const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');
const { clearChainLog, testSeedGenerator, getTestAliceSeed } = require('./misc/util');

describe('Balances tests',  () => {
  let uniqueHelper;
  let alice;
  let testSeed;

  before(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    testSeed = testSeedGenerator(uniqueHelper, __filename);
    alice = uniqueHelper.util.fromSeed(getTestAliceSeed(__filename));
  });

  after(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test transferBalanceToSubstrateAccount', async () => {
    const bob = testSeed('//Bob');
    const oneToken = await uniqueHelper.balance.getOneTokenNominal();

    let aliceBalance = {before: await uniqueHelper.balance.getSubstrate(alice.address)};
    let bobBalance = {before: await uniqueHelper.balance.getSubstrate(bob.address)};

    console.log('alice');

    let result = await uniqueHelper.balance.transferToSubstrate(alice, bob.address, oneToken);
    expect(result).to.be.true;
    console.log('after alice');

    bobBalance.after = await uniqueHelper.balance.getSubstrate(bob.address);
    aliceBalance.after = await uniqueHelper.balance.getSubstrate(alice.address)

    expect(bobBalance.after).to.eq(bobBalance.before + oneToken);
    expect((aliceBalance.before - aliceBalance.after) >= oneToken).to.be.true;

    expect(clearChainLog(uniqueHelper.chainLog)).to.deep.eq([
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: [alice.address]},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: [bob.address]},
      {type: 'extrinsic', status: 'Success', call: 'api.tx.balances.transfer', params: [bob.address, oneToken]},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: [bob.address]},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: [alice.address]}
    ])
  });
});
