const fs = require('fs');

const { getUsage } = require('../lib/cli');

const DESCRIPTION = 'Get list of all available playgrounds';

const main = async (args) => {
  const unavailablePlaygrounds = []

  console.log('Available playgrounds:')
  for(let file of fs.readdirSync(__dirname)) {
    if(file.endsWith('.js')) {
      let playgroundName = file.slice(0, -3);
      try {
        let playground = require(`./${playgroundName}`);
        if(!(typeof playground.main !== 'function' || !playground.help)) {
          console.log(`  ${playgroundName} - ${playground.description || ''}`);
        } else {
          unavailablePlaygrounds.push({
            playgroundName,
            message: `Not a playground - main function or help have not been provided`
          })
        }
      } catch (error) {
        unavailablePlaygrounds.push({
          playgroundName,
          message: '[ERROR] could not load playground file:' + error.message.split('\n')[0]
        })
      }
    }
  }

  if (unavailablePlaygrounds.length) {
    console.log('\nUnavailable playgrounds:')
    for (let {playgroundName, message} of unavailablePlaygrounds) {
      console.log(`  ${playgroundName} - ${message}`)
    }
  }

  console.log('\nRun npm run -- playground <playground_name> --help to see <playground_name> help');
}

module.exports = {
  main,
  description: DESCRIPTION,
  help: getUsage('npm run -- playground list', {help: DESCRIPTION})
}
