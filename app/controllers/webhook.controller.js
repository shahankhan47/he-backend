const webhookService = require("../services/webhook.service");
const FormData = require("form-data");

class WebhookController {
  async handleGithubWebhook(req, res) {
    try {
      const signature = req.headers["x-hub-signature-256"];
      const event = req.headers["x-github-event"];
      const webhookId = req.headers["x-github-hook-id"];
      const payload = req.body;

      await webhookService.handleGithubWebhook({
        webhookId,
        payload,
        signature,
        event,
      });

      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async setupGithubWebhook(req, res) {
    try {
      const { projectId, repositoryUrl, branch } = req.body;
      const result = await webhookService.setupGithubWebhook(
        projectId,
        repositoryUrl,
        branch,
        req.user
      );
      res.status(200).json(result);
    } catch (error) {
      console.error("Webhook setup error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async setupExistingWebhook(req, res) {
    try {
      const { projectId, repositoryUrl, branch } = req.body;

      // Get project details
      const project = await require("../models/project.model").findByPk(
        projectId
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Use provided repositoryUrl or fall back to stored one
      const finalRepositoryUrl = repositoryUrl || project.repositoryUrl;
      const finalBranch = branch || project.branchName || "main";

      if (!finalRepositoryUrl) {
        return res.status(400).json({
          error:
            "Project has no repository URL. Please provide repositoryUrl in the request body.",
          projectDetails: {
            id: project.id,
            projectName: project.projectName,
            source: project.source,
            repositoryUrl: project.repositoryUrl,
            branchName: project.branchName,
          },
        });
      }

      console.log(
        `[WebhookController] Manually setting up webhook for project: ${projectId}`
      );
      console.log(
        `[WebhookController] Using repository: ${finalRepositoryUrl}, branch: ${finalBranch}`
      );

      const result = await webhookService.setupGithubWebhook(
        projectId,
        finalRepositoryUrl,
        finalBranch,
        req.user
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Manual webhook setup error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new WebhookController();
