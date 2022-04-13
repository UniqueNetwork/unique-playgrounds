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

module.exports = {
  TMPDir
}
