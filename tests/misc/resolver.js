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
    if(modulePath.endsWith('.js')) return `${modulePath.slice(0, -3)}.cjs`;
  }
  return modulePath;
};
