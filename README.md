# Unique Network playgrounds

Helpers for Unique Network chain

## Minting utils

`src/lib/unique.js` contains all available minting utils for Unique Network chain.

You can copy this file into your project (It requires only `@polkadot/*` and `@unique-nft/types` packages, see their list in `package.json`)

You can see documentation in [docs.md](/docs.md) or see usages in tests (like `tests/mint.test.js` and `tests/collection.test.js`)

## Commands

You can show example usage by adding `--help` argument to your commands

### Export collection
You can export collection and tokens from chain by
```shell
npm run -- command export --ws-endpoint wss://quartz.unique.network --output-dir /tmp/punks-and-chels 1 2
```

### Import collection
You can import collection and tokens to chain by
```shell
npm run -- command import --ws-endpoint ws://localhost:9944 --signer-seed 'electric suit ...' 1 2
```

### Show eth mirror of substrate accounts
You can get mirrors of accounts and its balances by
```shell
npm run -- command sub_to_eth --ws-endpoint wss://quartz.unique.network 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
```

### Show mainnet balances
You can get balances of accounts on UniqueNetwork mainnets (Unique, Quartz)
```shell
npm run -- command get_mainnet_banaces 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY 5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
```


## Playgrounds

### Get list
You can get all available playgrounds by
```shell
npm run -- playground list
```

### Running playground
You can run playground by
```shell
npm run -- playground <playground_name>
```

### Custom playground
You can create your own playground by placing it to `src/playgrounds` folder.

For example, you can create `src/playgrouns/helloworld.dev.js` playground:

```javascript
const { getUsage } = require('../lib/cli');

const main = async (args) => {
  console.log('Hello world,', args[0]);
}

module.exports = {
  main,
  description: 'Hello world playground',
  help: getUsage('npm run -- playground helloworld.dev', {positional: [{key: 'name', help: 'User name to greet'}], help: 'Playground to say "Hello world" to user'})
}
```

Now you can run your own playground:
```shell
npm run -- playground helloworld.dev Bob
```

It will print:
```
Hello world, Bob
```
