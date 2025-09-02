const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/auth.middlewares');
const router = express.Router();

router.post('/login', authController.login);
router.post('/refresh-zoho-jwt', authenticate, authController.refreshZohoJwt);
router.post('/send-otp', authController.initiatePasswordReset);
router.post('/verify-otp', authController.verifyPasswordReset);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
