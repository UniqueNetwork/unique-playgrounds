const path = require('path');

module.exports = (request, options) => {
  let modulePath;
  try {
    modulePath = options.defaultResolver(request, options);
  }
  catch (e) {
    return;
  }
  if(!modulePath) return;
  if(request.indexOf('@polkadot') > -1) {
    if(modulePath.indexOf('cjs') < 0) {
      let newpath = [], isPolka = false;
      for(let part of modulePath.split(path.sep)) {
        if(isPolka) {
          newpath.push(part);
          newpath.push('cjs');
          isPolka = false;
          continue;
        }
        if(part === '@polkadot') isPolka = true;
        newpath.push(part);
      }
      return newpath.join(path.sep);
    }
  }
  return modulePath;
};
