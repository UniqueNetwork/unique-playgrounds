const runPlayground = async (args) => {
  let playground;
  try {
    playground = require(`./src/playgrounds/${args[1]}`);
  }
  catch(e) {
    console.log(`Playground ${args[1]} could not be loaded: [ERROR]`, e.message.split('\n')[0]);
    return;
  }
  if(args.indexOf('--help') > -1) {
    console.log(playground.help);
    return;
  }
  return await playground.main(args.slice(2));
}

const runCommand = async (args) => {
  let command;
  try {
    const { CommandCls } = require(`./src/commands/${args[1]}`);
    command = new CommandCls();
  }
  catch(e) {
    console.log(`Command ${args[1]} not found`);
    return;
  }
  return await command.execute(args.slice(2), `npm run -- command ${args[1]}`);
}

const main = async () => {
  let args = process.argv.slice(2);
  if(!args.length) return;
  if(args[0] === 'run_playground' && args.length >= 2) {
    return await runPlayground(args);
  }
  if(args[0] === 'run_command' && args.length >= 2) {
    return await runCommand(args);
  }
}
main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
