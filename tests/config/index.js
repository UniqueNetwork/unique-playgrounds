const mergeDeep = (...objects) => {
  const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}


const getConfig = (mode) => {
  const config = require('./global');
  if (typeof mode === 'undefined') mode = process.env.RUN_MODE || 'dev';
  let localConfig;
  try {
    localConfig = require(`./${mode}`);
  } catch (e) {
    localConfig = {};
  }
  if (mode === 'test') localConfig.inTesting = true;
  return mergeDeep(config, localConfig);
};

module.exports.getConfig = getConfig;
