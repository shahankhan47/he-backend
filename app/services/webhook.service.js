const crypto = require('crypto');
const User = require('../models/user.model');
const Project = require('../models/project.model');
const FormData = require('form-data');
const githubService = require('./github.service');
const axios = require('../utils/axiosInterceptor');
const { Op } = require('sequelize');
const { FILENAMES } = require('../constants/constants');

class WebhookService {
  async setupGithubWebhook(projectId, repositoryUrl, branch, user) {
    try {
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

      const webhookUrl = `${process.env.APP_URL}/api/webhook/github`;

      // Create webhook in GitHub
      const response = await axios.post(
        `https://api.github.com/repos/${owner}/${repoName}/hooks`,
        {
          name: 'web',
          active: true,
          events: ['pull_request', 'push'],
          config: {
            url: webhookUrl,
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

      return { message: 'Webhook set up successfully' };
    } catch (error) {
      console.error('[WebhookService] Webhook setup failed:', {
        projectId,
        repositoryUrl,
        branch,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  async handleGithubWebhook({ webhookId, payload, signature, event }) {
    try {
      if (!signature) {
        console.error('[WebhookService] No signature provided in webhook request');
        throw new Error('No signature provided');
      }
      const repoUrl = payload.repository.html_url + '.git';
      const repoUrlWithoutGit = payload.repository.html_url;

      const project = await Project.findOne({
        where: {
          [Op.or]: [{ webhookId: webhookId }, { repositoryUrl: [repoUrl, repoUrlWithoutGit] }],
        },
      });

      if (!project) {
        return;
      }

      if (!project?.webhookId) {
        await project.update({ webhookId: webhookId });
      }

      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', project.webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

      const user = await User.findByPk(project.createdBy);

      if (event === 'push') {
        const { ref, head_commit } = payload;
        const branch = ref.split('/').pop();

        if (branch === project.branchName) {
          // Update project with latest commit info
          await project.update({
            latestCommitHash: head_commit.id,
            latestCommitMessage: head_commit.message,
          });

          // Download the latest code from GitHub
          const zipData = await githubService.downloadRepository(project.repositoryUrl, branch, user.githubToken);

          // Prepare form data for Python API
          const formData = new FormData();
          formData.append('file', zipData, {
            filename: 'codebase.zip',
            contentType: 'application/zip',
          });

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
        }
      } else if (event === 'pull_request') {
        // Check if pull request is opened
        if (payload.action === 'opened' && payload.pull_request?.diff_url) {
          console.log(`Processing PR #${payload.pull_request.number} for ${payload.repository.full_name}`);
          try {
            const diffResponse = await axios.get(
              `https://api.github.com/repos/${payload.repository.full_name}/pulls/${payload.pull_request.number}`,
              {
                headers: {
                  Authorization: `Bearer ${user.githubToken}`,
                  Accept: 'application/vnd.github.v3.diff',
                  'User-Agent': 'Harmony-Webhook-Service',
                },
              }
            );

            const diffData = diffResponse.data;

            const agentPayload = {
              project_id: project.id,
              pr_id: payload.pull_request.number.toString(),
              deep_review: 'false',
              git_diff: diffData.replace(/\n/g, ' ').replace(/\r/g, ''),
            };
            // Send to Python API
            let reviewContent;
            try {
              const reviewResponse = await axios.post(`${process.env.PYTHON_URL}/pr_review_agent`, agentPayload);
              reviewContent = reviewResponse.data.review;
            } catch (apiError) {
              throw apiError; // Re-throw to see the full error
            }
            /**
             * {
  "review": "### .dockerignore\nA new ⁠ .dockerignore ⁠ file has been added to the project. This file specifies a list of patterns for files and directories that should be excluded from Docker builds. The patterns include common directories and files such as ⁠ __pycache__ ⁠, ⁠ .venv ⁠, ⁠ node_modules ⁠, and configuration files like ⁠ .gitignore ⁠, ⁠ Dockerfile* ⁠, and ⁠ docker-compose* ⁠, among others. Additionally, the ⁠ LICENSE ⁠ and ⁠ README.md ⁠ files are also specified to be ignored.\n\n### Dockerfile\nA new ⁠ Dockerfile ⁠ has been created for a Python application. The file is set to use the official Python 3.10-slim image as its base. It establishes a working directory ⁠ /app ⁠, installs necessary system dependencies, and cleans up to minimize the image size. The file stages the installation of Python dependencies from a ⁠ requirements.txt ⁠ file before copying the rest of the application code to take advantage of Docker caching. A non-root user is created to enhance security. The image is set to expose port 8000, and the application is configured to run with the ⁠ uvicorn ⁠ server, hosting a FastAPI app using four workers.\n\n### app.py\nThe changes in ⁠ app.py ⁠ involve several updates and deletions:\n\n1. *Imports:\n   - Added ⁠ base64 ⁠ and ⁠ pandas ⁠ modules.\n   - Removed the ⁠ transformers ⁠, ⁠ easyocr ⁠, ⁠ PIL ⁠, ⁠ torch ⁠, and ⁠ time ⁠ modules.\n\n2. **WebSocket Handler:\n   - Modified the ⁠ chat_pro_version ⁠ function by removing the ⁠ background_tasks ⁠ parameter.\n   - Updated how uploaded files are handled, converting them safely into a list, with better error handling.\n\n3. **Removed Global BLIP Configuration:\n   - Deleted the global initialization of ⁠ BlipProcessor ⁠, ⁠ BlipForConditionalGeneration ⁠, and ⁠ easyocr.Reader ⁠.\n\n4. **Upload File Endpoint:*\n   - Replaced the detailed ⁠ /upload_file ⁠ endpoint with a simpler test placeholder.\n   - Removed logic that processed uploaded files, including time logging and specific checks for image and Excel file types.\n\nThese modifications streamline the code, focusing on improving the file handling mechanism and potentially simplifying the upload functionality as a placeholder. The removal of certain imports and logic suggests a possible shift in how certain features are managed or a step towards refactoring."
}

             */
            // Add the review to the actual GitHub PR
            await axios.post(
              `https://api.github.com/repos/${payload.repository.full_name}/issues/${payload.pull_request.number}/comments`,
              {
                body: reviewContent,
              },
              {
                headers: {
                  Authorization: `Bearer ${user.githubToken}`,
                  Accept: 'application/vnd.github.v3.diff',
                  'User-Agent': 'Harmony-Webhook-Service',
                },
              }
            );
          } catch (diffError) {
            console.error('Failed to send data to PR REVIEW AGENT:', diffError.message);
          }
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
