const addLeadZero = (num) => {
  if (num < 10) return `0${num}`;
  return `${num}`;
};


class Logger {
  static FORMATS = {
    cmd: {reset: 0, bright: 1, dim: 2, underscore: 4, blink: 5, reverse: 7, hidden: 8},
    fg: {black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37, crimson: 38},
    bg: {black: 40, red: 41, green: 42, yellow: 43, blue: 44, magenta: 45, cyan: 46, white: 47, crimson: 48}
  };

  static LEVEL = {
    ERROR: 'ERROR',
    WARNING: 'WARNING',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
    NONE: 'NONE'
  };

  static LEVEL_COLOR = {
    ERROR: 'fg.red',
    WARNING: 'fg.yellow',
    INFO: 'fg.green'
  }

  static getFmt(fmt) {
    let format = this.FORMATS;
    for(let part of fmt.split('.')) {
      format = typeof format !== 'undefined' ? format[part] : format;
    }
    if(typeof format !== 'number') format = this.FORMATS.cmd.reset;
    return format;
  }

  static getFmtSymbol(code) {
    return `\x1b[${code}m`;
  }

  static getTimestamp() {
    let d = new Date(),
      year = d.getFullYear(), month = addLeadZero(d.getMonth() + 1), date = addLeadZero(d.getDate()),
      hour = addLeadZero(d.getHours()), min = addLeadZero(d.getMinutes()), sec = addLeadZero(d.getSeconds());
    return `${year}-${month}-${date} ${hour}:${min}:${sec}`;
  }

  static formatString(str, fmt) {
    const fmtSymbol = this.getFmtSymbol(this.getFmt(typeof fmt === 'undefined' ? '' : fmt));
    return `${fmtSymbol}${str}${this.getFmtSymbol(this.FORMATS.cmd.reset)}`;
  }

  constructor(includeTime=true, defaultLevel=Logger.LEVEL.INFO) {
    this.includeTime = includeTime;
    this.defaultLevel = defaultLevel;
    this.level = JSON.parse(JSON.stringify(this.constructor.LEVEL));
  }

  fmtSymbol(fmt) {
    return this.constructor.getFmtSymbol(this.constructor.getFmt(fmt));
  }

  fmt(str, fmt) {
    return this.constructor.formatString(str, fmt);
  }

  write(...messages) {
    console.log(...messages);
  }

  constructLog(message, level) {
    if(typeof level === 'undefined') level = this.defaultLevel;
    if (level === this.level.ERROR) {
      message = message?.stack || message;
    }

    let rawMsgs = Array.isArray(message) ? message : [message],
      msgs = level !== this.level.NONE ? [`${this.constructor.LEVEL_COLOR.hasOwnProperty(level) ? this.fmt(level, this.constructor.LEVEL_COLOR[level]) : level}:`] : [];
    for (let msg of rawMsgs) {
      try {
        if (typeof msg !== 'string') {
          msgs.push(JSON.stringify(msg));
        } else {
          msgs.push(msg);
        }
      } catch (e) {
        console.error(this.fmtSymbol('fg.red'), e, this.fmtSymbol('cmd.reset'));
      }
    }
    if(this.includeTime) msgs = [`[${this.fmt(this.constructor.getTimestamp(), 'fg.cyan')}]`, ...msgs];
    return msgs;
  }

  log(message, level) {
    this.write(...this.constructLog(message, level));
  }
}


class SilentLogger extends Logger {
  write(...messages) {
    return;
  }
}


module.exports = {
  Logger, SilentLogger
}
