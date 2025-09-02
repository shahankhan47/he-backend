const isProductionServer = process.env.NODE_ENV === 'production';

const allowAnyPassword = isProductionServer ? false : process.env.ALLOW_ANY_PASSWORD === 'true';

module.exports = {
  isProductionServer,
  allowAnyPassword,
};
