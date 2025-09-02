const logger = require("../utils/logger");

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

function validateName(name) {
  const nameRegex = /^[a-zA-Z ]{3,}$/;
  const isValid = nameRegex.test(name);
  if (!isValid) logger.warn("Invalid name format:", name);
  return isValid;
}

function validateOTP(otp) {
  const otpRegex = /^\d{6}$/;
  const isValid = otpRegex.test(otp);
  if (!isValid) logger.warn("Invalid OTP format:", otp);
  return isValid;
}

function validateUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isValid = uuidRegex.test(uuid);
  if (!isValid) logger.warn("Invalid UUID format:", uuid);
  return isValid;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateOTP,
  validateUUID,
};
