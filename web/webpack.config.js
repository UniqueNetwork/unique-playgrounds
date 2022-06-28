const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'unique-web.js'),
  target: 'web',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'unique-web.js',
    chunkFormat: 'array-push',

    library: {
      name: 'uniqueWeb',
      type: 'var',
    }
  },
  optimization: {
    minimize: true
  }
};
