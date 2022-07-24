const path = require('path');
const fs = require('fs').promises;

const { getTestAliceSeed } = require('./util');
const { UniqueHelper } = require('../../src/lib/unique');
const { getConfig } = require('../config');

async function* getFiles(rootPath) {
  const files = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of files) {
    const res = path.resolve(rootPath, entry.name);
    if (entry.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

const main = async () => {
  const config = getConfig();
  const uniqueHelper = new UniqueHelper();
  await uniqueHelper.connect(config.wsEndpoint);
  const oneToken = await uniqueHelper.balance.getOneTokenNominal();
  const mainAlice = uniqueHelper.util.fromSeed(config.mainSeed);
  console.log('Main alice address', mainAlice.address, 'balance', await uniqueHelper.balance.getSubstrate(mainAlice.address));
  let nonce = await uniqueHelper.chain.getNonce(mainAlice.address);
  let tx = [];

  for await (const f of getFiles(path.resolve(__dirname, '..'))) {
    if(!f.endsWith('.test.js')) continue;
    let alice = uniqueHelper.util.fromSeed(getTestAliceSeed(f))
    let aliceBalance = await uniqueHelper.balance.getSubstrate(alice.address);
    console.log(path.basename(f), 'Alice address', alice.address, 'balance', aliceBalance);
    if(aliceBalance < 500n * oneToken) {
      console.log('Balance too low, send 1000 tokens to', alice.address);
      tx.push(
        uniqueHelper.signTransaction(
          mainAlice, 
          uniqueHelper.api.tx.balances.transfer(alice.address, 1000n * oneToken), 
          'api.tx.balances.transfer', 
          {nonce}
        )
      );
      nonce++;
    }
  }

  if(tx.length > 0) await Promise.all(tx);
  
  await uniqueHelper.disconnect();
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});