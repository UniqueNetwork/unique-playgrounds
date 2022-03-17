const parseArgs = (args, expected) => {
  expected = {optional : [], positional: [], ...expected};
  let expectedOptions = {};
  for(let opt of expected.optional) {
    expectedOptions[opt.key] = opt;
  }
  let optional = [], positional = [];
  let option = {key: null, value: null};
  for(let arg of args) {
    if(arg.startsWith('--')) {
      option.key = arg.slice(2);
      if(expectedOptions.hasOwnProperty(option.key) && expectedOptions[option.key].isBool) {
        option.value = true;
        optional.push(option);
        option = {key: null, value: null};
      }
      continue;
    }
    if(option.key !== null) {
      option.value = arg;
      optional.push(option);
      option = {key: null, value: null};
      continue;
    }
    positional.push(arg);
  }

  let parsed = {optional: {}, positional: {}}, errors = [];
  if(option.key !== null && option.value === null) {
    errors.push(`Option --${option.key} provided without value. This option will be skipped. See --help`);
  }

  for(let opt of optional) {
    if(!(opt.key in expectedOptions)) {
      errors.push(`Option --${opt.key} provided, but does not expected. See --help`);
      continue;
    }
    let option = expectedOptions[opt.key];
    if(option.isArray) {
      if(!parsed.optional[opt.key]) parsed.optional[opt.key] = [];
      parsed.optional[opt.key].push(opt.value);
    }
    else {
      parsed.optional[opt.key] = opt.value;
    }
  }
  for(let i = 0; i < expected.positional.length; i++) {
    let opt = expected.positional[i];
    if(opt.isArray) {
      parsed.positional[opt.key] = positional.slice(i);
      if(i !== (expected.positional.length - 1)) errors.push(`Argument ${opt.key} is array, other arguments will be skipped`);
      break;
    }
    parsed.positional[opt.key] = positional.slice(i, i + 1)[0];
  }
  for(let opt of expected.positional) {
    if(!parsed.positional.hasOwnProperty(opt.key)) parsed.positional[opt.key] = opt.isArray ? [] : ({}).undefined;
  }

  for(let opt of expected.optional) {
    if(!parsed.optional.hasOwnProperty(opt.key)) parsed.optional[opt.key] = opt.isArray ? [] : (opt.isBool ? false : ({}).undefined);
  }

  return {parsed, errors};
}


const makeSpaces = count => {
  let spaces = [];
  for(let i = 0; i < count; i++) spaces.push(' ');
  return spaces.join('');
}


const keyLength = (arr, hasValue=true) => {
  let len = 0;
  for(let o of arr) {
    let kl = o.key.length;
    if(hasValue && !o.isBool) kl += ' [value]'.length;
    if(kl > len) len = kl;
  }
  return len;
}


const getUsage = (cmd, expected) => {
  expected = {optional : [], positional: [], ...expected};
  let usage = [`USAGE:\n\n${cmd} [options]${expected.positional.length ? ' [arguments]' : ''}`, ''];
  let maxLength = keyLength(expected.optional);
  let maxPositionalLength = keyLength(expected.positional, false);
  if(maxPositionalLength > maxLength) maxLength = maxPositionalLength;
  if(maxLength < 'help'.length) maxLength = 'help'.length;
  if(expected.help) usage.push(`${expected.help}\n`);
  if(expected.positional.length > 0) {
    usage.push('Arguments:')
    for(let opt of expected.positional) {
        usage.push(`  ${opt.key}${makeSpaces(maxLength - opt.key.length + 2)} ${opt.help}${opt.isArray ? ' [can be multiple]' : ''}`)
    }
    usage.push('');
  }
  usage.push('Options:');
  expected.optional.push({key: 'help', help: 'Print this page', isBool: true});
  for(let opt of expected.optional) {
    usage.push(`  --${opt.key}${!opt.isBool ? ' [value]' : ''}${makeSpaces(maxLength - opt.key.length - (opt.isBool ? 0 : ' [value]'.length))} ${opt.help}${opt.isArray ? ' [can be multiple]' : ''}`);
  }
  return usage.join('\n');
}


class Command {
  POSITIONAL = [];
  OPTIONAL = [];
  HELP = 'Command';

  getExpectedArguments() {
    return JSON.parse(JSON.stringify({positional: this.POSITIONAL, optional: this.OPTIONAL, help: this.HELP}));
  }

  parse(args) {
    return parseArgs(args, this.getExpectedArguments());
  }

  getHelp(cmd='command') {
    return getUsage(cmd, this.getExpectedArguments());
  }

  async run(optional, positional) {
    throw Error('NotImplemented');
  }

  async execute(args, cmd='command') {
    if(args.indexOf('--help') > -1) {
      console.log(this.getHelp(cmd));
      return;
    }
    let parsed = this.parse(args);
    for(let error of parsed.errors) {
      console.warn(error);
    }
    return await this.run(parsed.parsed.optional, parsed.parsed.positional);
  }
}

module.exports = {
  parseArgs, getUsage, Command
}
