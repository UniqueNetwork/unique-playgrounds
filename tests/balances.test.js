const { UniqueHelper } = require('../src/lib/unique');
const { SilentLogger, Logger } = require('../src/lib/logger');
const { getConfig } = require('./config');

describe('Balances tests', () => {
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
  });
});
