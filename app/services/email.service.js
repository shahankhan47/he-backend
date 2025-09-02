const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const otpService = require('./otp.service');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.DEV_SMTP_HOST,
      port: process.env.DEV_SMTP_PORT,
      auth: {
        user: process.env.DEV_SMTP_USER,
        pass: process.env.DEV_SMTP_PASSWORD,
      },
    });
    logger.info('Email service initialized (using env SMTP)');
  }

  async sendOtpEmail(email) {
    try {
      const otp = otpService.generateOTP(email);

      if (process.env.ALLOW_ANY_OTP === 'true') {
        logger.debug(`ALLOW_ANY_OTP is true, allowing any OTP for ${email}, skipping email sending . OTP: ${otp}`);
        return { success: true };
      }

      const mailOptions = {
        from: '"Harmony Engine Support" <support@harmonyengine.ai>',
        to: email,
        subject: '🔐 Your One-Time Password (OTP) for Secure Access',
        text: `Hello,
      
      We received a request that requires OTP verification.
      
      Your One-Time Password (OTP) is: ${otp}
      
      For security reasons, this OTP will expire in 5 minutes. Please enter it soon to complete your request.
      
      If you did not initiate this request, you can safely ignore this email.
      
      Best regards,  
      The Harmony Engine Team
      `,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px; text-align: center;">
            <h2 style="color: #333;">🔐 OTP Verification Required</h2>
            <p style="color: #555;">To proceed with your request, please use the OTP below:</p>
            <div style="font-size: 22px; font-weight: bold; color: #2c3e50; background: #e8f0fe; padding: 10px 20px; display: inline-block; border-radius: 5px; letter-spacing: 2px;">
              ${otp}
            </div>
            <p style="margin-top: 15px; color: #555;">This OTP will expire in <strong>5 minutes</strong>, so please use it promptly.</p>
            <p style="color: #999; font-size: 14px;">If you didn’t request this, you can safely ignore this email.</p>
            
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #777;">Need help? Contact our support team at <a href="mailto:support@harmonyengine.ai" style="color: #007BFF;">support@harmonyengine.ai</a></p>
            
            <p style="font-size: 12px; color: #aaa;">Harmony Engine • Your AI-powered assistant</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info('OTP email sent successfully', { email });

      return { success: true };
    } catch (error) {
      logger.error('Error sending OTP email:', { error, email });
      throw error;
    }
  }
}

module.exports = new EmailService();
