const { expect } = require('chai');

const { Logger } = require('../src/lib/logger');

describe('Logger tests', () => {
  it('String format', () => {
    const logger = new Logger();
    const iYellowString = logger.fmt('yellow', 'fg.yellow');
    const sYellowString = Logger.formatString('yellow', 'fg.yellow');
    expect(sYellowString === iYellowString).to.be.true;
    expect(sYellowString).to.eq('\x1b[33myellow\x1b[0m');
  });

  it('constructLog', () => {
    const logger = new Logger(false, Logger.LEVEL.INFO);
    const logMessages = logger.constructLog('test', logger.level.INFO), defaultMessages = logger.constructLog('test');
    expect(logMessages).to.deep.eq(defaultMessages);
    expect(logMessages).to.deep.eq(['\x1b[32mINFO\x1b[0m:', 'test']);
    const errorMessages = logger.constructLog('error', logger.level.ERROR);
    expect(errorMessages).to.deep.eq(['\x1b[31mERROR\x1b[0m:', 'error']);
    let exceptionMessage;
    try {
      throw Error('test');
    } catch(e) {
      exceptionMessage = logger.constructLog(e, logger.level.ERROR);
    }
    expect(exceptionMessage.length).to.eq(2);
    expect(exceptionMessage[0]).to.eq('\x1b[31mERROR\x1b[0m:');
    expect(exceptionMessage[1].indexOf('Error: test\n')).to.eq(0);
  })
});
