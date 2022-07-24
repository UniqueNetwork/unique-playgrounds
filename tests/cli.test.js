const { expect } = require('chai');
const { getUsage, parseArgs, Command } = require('../src/lib/cli');

describe('Cli lib tests', () => {
  it('Command class', async () => {
    class TestCommand extends Command {
      POSITIONAL = [{key: 'first', help: 'First int argument'}, {key: 'second', help: 'Second int argument'}]
      HELP = 'Command to sum two int numbers'

      async run(optional, positional) {
        return parseInt(positional.first || 0) + parseInt(positional.second || 0);
      }
    }
    const cmd = new TestCommand();
    expect(cmd.getHelp()).to.eq('USAGE:\n\ncommand [options] [arguments]\n\nCommand to sum two int numbers\n\nArguments:\n  first    First int argument\n  second   Second int argument\n\nOptions:\n  --help   Print this page');
    expect(cmd.parse(['1', '5'])).to.deep.eq({
      parsed: {
        optional: {},
        positional: {
          first: '1',
          second: '5'
        }
      },
      errors: []
    });
    expect(await cmd.execute(['1', '5'])).to.eq(6);
  });

  it('parseArgs method', () => {
    const empty = parseArgs(['1', '2', '3'], {});
    expect(empty).to.deep.eq({
      parsed: {
        optional: {},
        positional: {}
      },
      errors: []
    });

    const onePosition = parseArgs(['one'], {
      positional: [{key: 'arg', help: 'Argument for command'}]
    });
    expect(onePosition).to.deep.eq({
      parsed: {
        optional: {},
        positional: {
          arg: 'one'
        }
      },
      errors: []
    });

    const onePositionWithoutArg = parseArgs([], {
      positional: [{key: 'arg', help: 'Argument for command'}]
    });
    expect(onePositionWithoutArg).to.deep.eq({
      parsed: {
        optional: {},
        positional: {
          arg: ({}).undefined
        }
      },
      errors: []
    });

    const onePositionMultiple = parseArgs(['one', 'two', 'three'], {
      positional: [{key: 'arg', help: 'Argument for command', isArray: true}]
    });
    expect(onePositionMultiple).to.deep.eq({
      parsed: {
        optional: {},
        positional: {
          arg: ['one', 'two', 'three']
        }
      },
      errors: []
    });

    const onePositionWithError = parseArgs(['one', 'two'], {
      positional: [
        {key: 'arg', help: 'Argument for command', isArray: true},
        {key: 'second_arg', help: 'Thia argument will be newer used'}
      ]
    });
    expect(onePositionWithError).to.deep.eq({
      parsed: {
        optional: {},
        positional: {
          arg: ['one', 'two'],
          second_arg: ({}).undefined
        }
      },
      errors: ['Argument arg is array, other arguments will be skipped']
    });

    const withOption = parseArgs(['--option', 'abc', 'arg'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', help: 'Option for command'}]
    });
    const withOptionAfterArg = parseArgs(['arg', '--option', 'abc'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', help: 'Option for command'}]
    });
    const withOptionExpected = {
      parsed: {
        optional: {
          option: 'abc'
        },
        positional: {
          arg: 'arg'
        }
      },
      errors: []
    }
    expect(withOption).to.deep.eq(withOptionExpected);
    expect(withOptionAfterArg).to.deep.eq(withOptionExpected);

    const withInvalidOption = parseArgs(['arg', '--option'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', help: 'Option for command'}]
    });
    expect(withInvalidOption).to.deep.eq({
      parsed: {
        optional: {
          option: ({}).undefined
        },
        positional: {
          arg: 'arg'
        }
      },
      errors: ['Option --option provided without value. This option will be skipped. See --help']
    });

    const withBoolOption = parseArgs(['--option', 'arg'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', isBool: true, help: 'Option for command'}]
    });
    const withBoolOptionAfterArg = parseArgs(['arg', '--option'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', isBool: true, help: 'Option for command'}]
    });
    const expectedWithBoolOption = {
      parsed: {
        optional: {
          option: true
        },
        positional: {
          arg: 'arg'
        }
      },
      errors: []
    };
    expect(withBoolOption).to.deep.eq(expectedWithBoolOption);
    expect(withBoolOptionAfterArg).to.deep.eq(expectedWithBoolOption);

    const withBoolOptionWithoutOption = parseArgs(['arg'], {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', isBool: true, help: 'Option for command'}]
    });
    expect(withBoolOptionWithoutOption).to.deep.eq({
      parsed: {
        optional: {
          option: false
        },
        positional: {
          arg: 'arg'
        }
      },
      errors: []
    })

    const withManyArgsAndOptions = parseArgs(['--prefix', 'prefix', 'one', '--email', 'local@loc', 'two', '--email', 'admin@loc', 'three', 'four'], {
      positional: [
        {key: 'one', help: 'First arg'},
        {key: 'two', help: 'Second arg'},
        {key: 'extra', isArray: true, help: 'Other args'}
      ],
      optional: [
        {key: 'prefix', help: 'Args prefix'},
        {key: 'lowercase', isBool: true, help: 'Lowercase result'},
        {key: 'email', isArray: true, help: 'Email addresses to send result'}
      ],
      help: 'Complicated command to prefix args and send them to email'
    });
    expect(withManyArgsAndOptions).to.deep.eq({
      parsed: {
        optional: {
          prefix: 'prefix',
          email: ['local@loc', 'admin@loc'],
          lowercase: false
        },
        positional: {
          one: 'one',
          two: 'two',
          extra: ['three', 'four']
        }
      },
      errors: []
    });
  });

  it('getUsage method', () => {
    const empty = getUsage('empty', {});
    expect(empty).to.eq('USAGE:\n\nempty [options]\n\nOptions:\n  --help Print this page');

    const onePosition = getUsage('one', {
      positional: [{key: 'arg', help: 'Argument for command'}]
    });
    expect(onePosition).to.eq('USAGE:\n\none [options] [arguments]\n\nArguments:\n  arg    Argument for command\n\nOptions:\n  --help Print this page');

    const onePositionMultiple = getUsage('one', {
      positional: [{key: 'arg', help: 'Argument for command', isArray: true}]
    });
    expect(onePositionMultiple).to.eq('USAGE:\n\none [options] [arguments]\n\nArguments:\n  arg    Argument for command [can be multiple]\n\nOptions:\n  --help Print this page');

    const onePositionWithHelp = getUsage('one', {
      positional: [{key: 'arg', help: 'Argument for command'}],
      help: 'Command with one argument'
    });
    expect(onePositionWithHelp).to.eq('USAGE:\n\none [options] [arguments]\n\nCommand with one argument\n\nArguments:\n  arg    Argument for command\n\nOptions:\n  --help Print this page')

    const withOption = getUsage('with_option', {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', help: 'Option for command'}]
    });
    expect(withOption).to.eq('USAGE:\n\nwith_option [options] [arguments]\n\nArguments:\n  arg              Argument for command\n\nOptions:\n  --option [value] Option for command\n  --help           Print this page');

    const withBoolOption = getUsage('with_option', {
      positional: [{key: 'arg', help: 'Argument for command'}],
      optional: [{key: 'option', isBool: true, help: 'Option for command'}]
    });
    expect(withBoolOption).to.eq('USAGE:\n\nwith_option [options] [arguments]\n\nArguments:\n  arg      Argument for command\n\nOptions:\n  --option Option for command\n  --help   Print this page');

    const withManyArgsAndOptions = getUsage('complicated_command', {
      positional: [
        {key: 'one', help: 'First arg'},
        {key: 'two', help: 'Second arg'},
        {key: 'extra', isArray: true, help: 'Other args'}
      ],
      optional: [
        {key: 'prefix', help: 'Args prefix'},
        {key: 'lowercase', isBool: true, help: 'Lowercase result'},
        {key: 'email', isArray: true, help: 'Email addresses to send result'}
      ],
      help: 'Complicated command to prefix args and send them to email'
    });
    expect(withManyArgsAndOptions).to.eq('USAGE:\n\ncomplicated_command [options] [arguments]\n\nComplicated command to prefix args and send them to email\n\nArguments:\n  one              First arg\n  two              Second arg\n  extra            Other args [can be multiple]\n\nOptions:\n  --prefix [value] Args prefix\n  --lowercase      Lowercase result\n  --email [value]  Email addresses to send result [can be multiple]\n  --help           Print this page');
  });
});
