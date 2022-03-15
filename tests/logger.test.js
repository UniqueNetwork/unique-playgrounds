const { Logger } = require('../src/lib/logger');

describe('Logger tests', () => {
  it('String format', () => {
    const logger = new Logger();
    const iYellowString = logger.fmt('yellow', 'fg.yellow');
    const sYellowString = Logger.formatString('yellow', 'fg.yellow');
    expect(sYellowString === iYellowString).toBe(true);
    expect(sYellowString).toEqual('\x1b[33myellow\x1b[0m');
  });

  it('constructLog', () => {
    const logger = new Logger(false, Logger.LEVEL.INFO);
    const logMessages = logger.constructLog('test', logger.level.INFO), defaultMessages = logger.constructLog('test');
    expect(logMessages).toEqual(defaultMessages);
    expect(logMessages).toEqual(['\x1b[32mINFO\x1b[0m:', 'test']);
    const errorMessages = logger.constructLog('error', logger.level.ERROR);
    expect(errorMessages).toEqual(['\x1b[31mERROR\x1b[0m:', 'error']);
    let exceptionMessage;
    try {
      throw Error('test');
    } catch(e) {
      exceptionMessage = logger.constructLog(e, logger.level.ERROR);
    }
    expect(exceptionMessage.length).toEqual(2);
    expect(exceptionMessage[0]).toEqual('\x1b[31mERROR\x1b[0m:');
    expect(exceptionMessage[1].indexOf('Error: test\n')).toEqual(0);
  })
});
