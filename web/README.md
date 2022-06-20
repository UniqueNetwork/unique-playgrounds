# Web compatibility helper for UniqueHelper auxiliary class (minting scripts)

You can build your own web-compatible `unique.js` using webpack.

Just run `npm i && npm run build` inside this directory, your file will be generated to `dist/unique-web.js`.

You can modify `webpack.config.js` for your own purposes.

## Minimal usage example

```javascript
const availableExtensions = await uniqueWeb.PolkaExt.web3Enable('UniqueWeb example');
// Polkadot extension not installed
if(!availableExtensions.length) return;

// Get all available accounts from extension
const allAccounts = await uniqueWeb.PolkaExt.web3Accounts();

// No available accounts from polkadot extension
if(!allAccounts.length) return;

const firstAccountAddress = allAccounts[0].address; // Get address of first account from externsion

const injector = await uniqueWeb.PolkaExt.web3FromAddress(firstAccountAddress); // Get injector for account (by address) to sign transactions using polkadot extension ui

const helper = new uniqueWeb.Helper(injector); // For web variation of UniqueHelper you need to initialize it with injector of account

// Or you can set injector later
helper.setInjector(injector);

// Now we able to use full power of UniqueHelper class.
// For example we can transfer 0.01 token from our first account to Alice address (You simply pass string address instead of IKeyringPair for signer argument)
await helper.transferBalanceToSubstrateAccount(firstAccountAddress, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', 10_000_000_000_000_000n); // This will call polkadot extension ui for sign your transaction manually
```

See `example.html` for more usage examples of minting scripts for web. All documentation for UniqueHelper available inside [docs.md](/docs.md) file from root of repository.
