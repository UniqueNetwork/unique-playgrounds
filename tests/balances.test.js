const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');
const { clearChainLog } = require('./misc/util');

describe('Balances tests',  () => {
  jest.setTimeout(60 * 60 * 1000);

  let uniqueHelper;
  let alice;

  beforeAll(async () => {
    const config = getConfig();
    const loggerCls = config.silentLogger ? SilentLogger : Logger;
    uniqueHelper = new UniqueHelper(new loggerCls());
    if(config.forcedNetwork) uniqueHelper.forceNetwork(config.forcedNetwork);
    await uniqueHelper.connect(config.wsEndpoint);
    alice = uniqueHelper.util.fromSeed(config.mainSeed);
  });

  afterAll(async () => {
    await uniqueHelper.disconnect();
  });

  it('Test transferBalanceToSubstrateAccount', async () => {
    const bob = uniqueHelper.util.fromSeed('//Bob');
    const oneToken = await uniqueHelper.getOneTokenNominal();

    let aliceBalance = {before: await uniqueHelper.getSubstrateAccountBalance(alice.address)};
    let bobBalance = {before: await uniqueHelper.getSubstrateAccountBalance(bob.address)};

    let result = await uniqueHelper.transferBalanceToSubstrateAccount(alice, bob.address, oneToken);
    await expect(result).toBe(true);

    bobBalance.after = await uniqueHelper.getSubstrateAccountBalance(bob.address);
    aliceBalance.after = await uniqueHelper.getSubstrateAccountBalance(alice.address)

    await expect(bobBalance.after).toEqual(bobBalance.before + oneToken);
    await expect(aliceBalance.before - aliceBalance.after).toBeGreaterThanOrEqual(oneToken);

    await expect(clearChainLog(uniqueHelper.chainLog)).toEqual([
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY']},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty']},
      {type: 'extrinsic', status: 'Success', call: 'api.tx.balances.transfer', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', oneToken]},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty']},
      {type: 'rpc', status: 'Success', call: 'api.query.system.account', params: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY']}
    ])
  });
});
