const crypto = require('crypto');
const User = require('../models/user.model');
const Project = require('../models/project.model');
const FormData = require('form-data');
const githubService = require('./github.service');
const axios = require('../utils/axiosInterceptor');

class WebhookService {
  async setupGithubWebhook(projectId, repositoryUrl, branch, user) {
    try {
      console.log(`[WebhookService] Setting up GitHub webhook - Project: ${projectId}, URL: ${repositoryUrl}, Branch: ${branch}`);

      const userData = await User.findOne({
        where: { email: user.email },
        attributes: ['githubToken'],
      });

      if (!userData.githubToken) {
        console.error('[WebhookService] GitHub token not found for user:', user.email);
        return;
      }

      // Extract repository owner and name from URL
      const [owner, repo] = repositoryUrl.split('/').slice(-2);
      const repoName = repo.replace('.git', '');

      // Generate webhook secret
      const webhookSecret = crypto.randomBytes(20).toString('hex');
      console.log(`[WebhookService] Generated webhook secret for repository: ${owner}/${repoName}`);

      // Create webhook in GitHub
      const response = await axios.post(
        `https://api.github.com/repos/${owner}/${repoName}/hooks`,
        {
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: `${process.env.APP_URL}/api/webhook/github`,
            content_type: 'json',
            secret: webhookSecret,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${userData.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      console.log(`[WebhookService] GitHub webhook created successfully - ID: ${response.data.id}`);

      // Store webhook information in project
      await Project.update(
        {
          webhookId: response.data.id,
          webhookSecret: webhookSecret,
          repositoryUrl: repositoryUrl,
          branchName: branch,
        },
        { where: { id: projectId } }
      );

      console.log(`[WebhookService] Webhook information stored in project: ${projectId}`);
      return { message: 'Webhook set up successfully' };
    } catch (error) {
      console.error('[WebhookService] Webhook setup failed:', {
        projectId,
        repositoryUrl,
        branch,
        error: error.response?.data || error.message,
      });
    }
  }

  async handleGithubWebhook({ webhookId, payload, signature, event }) {
    try {
      console.log(`[WebhookService] Received GitHub webhook - ID: ${webhookId}, Event: ${event}`);

      if (!signature) {
        console.error('[WebhookService] No signature provided in webhook request');
        throw new Error('No signature provided');
      }

      // Find the project by repository URL
      const project = await Project.findOne({
        where: { webhookId: webhookId },
      });

      if (!project) {
        console.error('[WebhookService] Project not found for webhook ID:', webhookId);
        throw new Error('Project not found');
      }

      console.log(`[WebhookService] Found project: ${project.id}`);

      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', project.webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

      if (signature !== digest) {
        console.error('[WebhookService] Invalid webhook signature');
        throw new Error('Invalid signature');
      }

      console.log('[WebhookService] Webhook signature verified successfully');

      const user = await User.findByPk(project.createdBy);

      if (event === 'push') {
        const { ref, head_commit } = payload;
        const branch = ref.split('/').pop();

        console.log(`[WebhookService] Processing push event - Branch: ${branch}, Commit: ${head_commit?.id}`);

        if (branch === project.branchName) {
          // Update project with latest commit info
          await project.update({
            latestCommitHash: head_commit.id,
            latestCommitMessage: head_commit.message,
          });

          console.log(`[WebhookService] Updated project with latest commit info - Hash: ${head_commit.id}`);

          // Download the latest code from GitHub
          const zipData = await githubService.downloadRepository(project.repositoryUrl, branch, user.githubToken);

          // Prepare form data for Python API
          const formData = new FormData();
          formData.append('file', zipData, {
            filename: 'codebase.zip',
            contentType: 'application/zip',
          });

          console.log('[WebhookService] Sending codebase to Python API');

          // Send to Python API
          await axios.post(`${process.env.PYTHON_URL}/updatecodebase`, formData, {
            headers: {
              ...formData.getHeaders(),
            },
            params: {
              email: user.email,
              project_id: project.id,
              commit_id: head_commit.id,
              file_source: 'github',
            },
          });

          console.log('[WebhookService] Successfully processed webhook and updated codebase');
        } else {
          console.log(`[WebhookService] Push event ignored - Branch ${branch} does not match project branch ${project.branchName}`);
        }
      }

      return { project, user };
    } catch (error) {
      console.error('[WebhookService] Webhook processing failed:', {
        webhookId,
        event,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }
}

module.exports = new WebhookService();
