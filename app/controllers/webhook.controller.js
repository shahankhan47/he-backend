const webhookService = require('../services/webhook.service');
const FormData = require('form-data');

class WebhookController {
  async handleGithubWebhook(req, res) {
    try {
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      const webhookId = req.headers['x-github-hook-id'];
      const payload = req.body;

      await webhookService.handleGithubWebhook({ webhookId, payload, signature, event });

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async setupGithubWebhook(req, res) {
    try {
      const { projectId, repositoryUrl, branch } = req.body;
      const result = await webhookService.setupGithubWebhook(projectId, repositoryUrl, branch, req.user);
      res.status(200).json(result);
    } catch (error) {
      console.error('Webhook setup error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new WebhookController();
