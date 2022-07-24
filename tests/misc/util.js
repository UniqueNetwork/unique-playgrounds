const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');


class TMPDir {
  constructor() {
    this.path = path.join(os.tmpdir(), `tests-${(new Date()).getTime()}`);
    fs.mkdirSync(this.path);
  }
  remove() {
    fs.rmSync(this.path, {recursive: true});
    this.path = null;
  }
}

const clearChainLog = chainLog => {
  return chainLog.map(x => {
    let newLog = {};
    Object.keys(x).forEach(k => {
      if(['type', 'call', 'params', 'status'].indexOf(k) > -1) newLog[k] = x[k];
    });
    return newLog;
  });
}

const getTestHash = filename => {
  return crypto.createHash('md5').update(path.basename(filename)).digest('hex');
}

const getTestAliceSeed = filename => {
  return `//Alice+${getTestHash(filename)}`
}

const testSeedGenerator = (uniqueHelper, filename) => {
  let hash = getTestHash(filename);
  return seed => {
    return uniqueHelper.util.fromSeed(`${seed}+${hash}`);
  }
}

module.exports = {
  TMPDir, clearChainLog, getTestHash, testSeedGenerator, getTestAliceSeed
}
