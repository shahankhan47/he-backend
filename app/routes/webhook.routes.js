const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.controller");
const authMiddleware = require("../middlewares/auth.middlewares");

// Public endpoint for GitHub webhooks
router.post("/github", webhookController.handleGithubWebhook);

// Protected endpoint for setting up webhooks
router.post("/setup", authMiddleware, webhookController.setupGithubWebhook);

// Manual webhook setup for existing projects (useful for debugging)
router.post(
  "/setup-existing",
  authMiddleware,
  webhookController.setupExistingWebhook
);

module.exports = router;
