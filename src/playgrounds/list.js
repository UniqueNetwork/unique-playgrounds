const fs = require('fs');

const { getUsage } = require('../lib/cli');

const DESCRIPTION = 'Get list of all available playgrounds';

const main = async (args) => {
  console.log('Available playgrounds:')
  for(let file of fs.readdirSync(__dirname)) {
    if(file.endsWith('.js')) {
      let playgroundName = file.slice(0, -3);
      try {
        let playground = require(`./${playgroundName}`);
        console.log(`  ${playgroundName} - ${playground.description || ''}`);
      }
      catch(e) {}
    }
  }
  console.log('Run npm run -- playground <playground_name> --help to see <playground_name> help');
}

module.exports = {
  main,
  description: DESCRIPTION,
  help: getUsage('npm run -- playground list', {help: DESCRIPTION})
}
