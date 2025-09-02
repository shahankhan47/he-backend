const cacheService = require("./cache.service");
const logger = require("../utils/logger");

const otpService = {
  generateOTP(email) {
    const existingOTP = cacheService.get(email);
    if (existingOTP) {
      logger.info(`Existing OTP reused for ${email}: ${existingOTP}`);
      return existingOTP;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const success = cacheService.store(email, otp);
    if (!success) {
      logger.error(`Failed to store OTP for ${email}`);
      throw new Error("Failed to store OTP in cache");
    }
    logger.debug(`OTP generated successfully for ${email}: ${otp}`);
    return otp;
  },

  verifyOTP(email, otpToVerify) {
    const storedOTP = cacheService.get(email);

    if (!storedOTP) {
      logger.warn(`No OTP found or expired for ${email}`);
      return false;
    }

    if (storedOTP === otpToVerify) {
      logger.debug(`OTP verified successfully for ${email}`);
      return true;
    }

    logger.warn(
      `Invalid OTP for ${email}. Expected: ${storedOTP}, Received: ${otpToVerify}`
    );
    return false;
  },
};

module.exports = otpService;
