const NodeCache = require("node-cache");
const logger = require("../utils/logger");

const otpCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 60 });

const cacheService = {
  store(email, otp) {
    const success = otpCache.set(email, otp);
    if (success) {
      logger.info(`Stored OTP for ${email}: ${otp}`);
    } else {
      logger.error(`Failed to store OTP for ${email}`);
    }
    return success;
  },

  get(email) {
    const otp = otpCache.get(email);
    if (otp) {
      logger.info(`Retrieved OTP for ${email}: ${otp}`);
      return otp;
    } else {
      logger.warn(`No OTP found for ${email}`);
      return null;
    }
  },

  delete(email) {
    otpCache.del(email);
    logger.info(`OTP cache cleared for ${email}`);
  },

  clear() {
    otpCache.flushAll();
    logger.info("All OTP caches cleared.");
  },
};

module.exports = cacheService;
