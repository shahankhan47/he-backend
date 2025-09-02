const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");
const { createJWT } = require("../utils/jwt");
const { validateEmail, validatePassword } = require("../utils/validators");
const emailService = require("../services/email.service");
const cacheService = require("../services/cache.service");
const otpService = require("../services/otp.service");
const { allowAnyPassword } = require("../constants/constants");

const generateZohoJwt = (email) => {
  const now = Date.now();
  const expiresIn = 300000;

  return jwt.sign(
    {
      email: email,
      email_verified: true,
      not_before: now,
      not_after: now + expiresIn,
    },
    process.env.ZOHO_JWT_SECRET,
    { algorithm: "HS256" }
  );
};

class AuthController {
  constructor() {
    this.login = this.login.bind(this);
    this.refreshJwt = this.refreshZohoJwt.bind(this);
    this.initiatePasswordReset = this.initiatePasswordReset.bind(this);
    this.verifyPasswordReset = this.verifyPasswordReset.bind(this);
    this.verifyOtp = this.verifyOtp.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
  }

  async login(req, res) {
    const { email, password } = req.body;

    try {
      if (!validateEmail(email) || !validatePassword(password)) {
        return res
          .status(400)
          .json({ error: "Invalid email or password format" });
      }

      const user = await User.findOne({ where: { email }, raw: true });

      if (!user) {
        return res.status(401).json({ error: "Invalid email" });
      }

      const isPasswordValid = await bcrypt.compare(
        password.trim(),
        user.password
      );

      if (!isPasswordValid && !allowAnyPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      delete user.password;

      const token = createJWT(user);

      if (!token) {
        return res.status(500).json({ error: "Token generation failed" });
      }

      return res.status(200).json({ message: "Login successful", token, user });
    } catch (error) {
      logger.error("Login error:", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async refreshZohoJwt(req, res) {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const zohoJwt = generateZohoJwt(user.email);
      res.json({ zohoJwt, name: user.name, email: user.email });
    } catch (error) {
      console.error(error);
      if (error instanceof jwt.JsonWebTokenError) {
        return res
          .status(401)
          .json({ message: "Token is not valid", error: error });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async initiatePasswordReset(req, res) {
    const { email } = req.body;

    try {
      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const otp = otpService.generateOTP(email);

      await emailService.sendOtpEmail(email, otp);

      logger.info(`OTP sent to ${email}`);
      return res.status(200).json({ message: "OTP sent to your email." });
    } catch (error) {
      logger.error("Error in initiatePasswordReset:", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async verifyPasswordReset(req, res) {
    const { email, otp } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const ALLOW_ANY_OTP = process.env.ALLOW_ANY_OTP === "true";
    const storedOTP = cacheService.get(email);

    if (ALLOW_ANY_OTP) {
      logger.info(
        `ALLOW_ANY_OTP enabled. Skipping OTP validation for ${email}`
      );
      return res.status(200).json({ message: "OTP verified successfully" });
    }

    if (!storedOTP) {
      logger.warn(`No OTP found or expired for ${email}`);
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    if (storedOTP === otp) {
      logger.info(`OTP verified successfully for ${email}`);
      return res.status(200).json({ message: "OTP verified successfully" });
    }

    logger.warn(
      `Invalid OTP for ${email}. Expected: ${storedOTP}, Received: ${otp}`
    );
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  async verifyOtp(req, res) {
    const { email, otp } = req.body;

    try {
      logger.info(`Verifying OTP for email: ${email}, Received OTP: "${otp}"`);

      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const isOtpValid = otpService.verifyOTP(email, otp);
      if (!isOtpValid) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      logger.info(`OTP verified successfully for ${email}`);
      return res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
      logger.error("Error in verifyOtp:", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async resetPassword(req, res) {
    const { email, newPassword } = req.body;

    try {
      if (!validateEmail(email) || !validatePassword(newPassword)) {
        return res
          .status(400)
          .json({ error: "Invalid email or password format" });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      cacheService.delete(email);

      return res
        .status(200)
        .json({ message: "Password has been reset successfully" });
    } catch (error) {
      logger.error("Password reset error:", { error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

module.exports = new AuthController();
