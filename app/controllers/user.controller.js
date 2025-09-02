const User = require('../models/user.model');
const cacheService = require('../services/cache.service');
const emailService = require('../services/email.service');
const bcrypt = require('bcryptjs');
const { validateEmail, validatePassword, validateName } = require('../utils/validators');
const logger = require('../utils/logger');
const axios = require('axios');
const azureDevOpsService = require('../services/azure-devops.service');
const gitlabService = require('../services/gitlab.service');
require('dotenv').config(); // Ensure dotenv is configured

class UserController {
  async initiateUserCreation(req, res) {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        console.log('User already exists:', existingUser);
        return res.status(409).json({ error: 'Email already registered' });
      }

      let otpData;
      try {
        otpData = cacheService.store(email);
      } catch (error) {
        console.error('Error storing OTP data:', error);
        return res.status(500).json({ error: 'Error generating OTP' });
      }
      const { otp, uuid } = otpData;
      console.log('Generated OTP and UUID for email:', { email, otp, uuid });

      try {
        await emailService.sendOtpEmail(email, otp);
      } catch (error) {
        console.error('Error sending OTP email:', error);
        return res.status(500).json({ error: 'Failed to send OTP email' });
      }

      return res.status(200).json({
        message: 'OTP sent successfully',
        uuid,
      });
    } catch (error) {
      logger.error('Initiate user creation error:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  async verifyUserCreation(req, res) {
    try {
      const { name, email, password, otp } = req.body;

      if (!validateEmail(email) || !validatePassword(password) || !validateName(name)) {
        return res.status(400).json({ error: 'Invalid name, email, or password format' });
      }

      const ALLOW_ANY_OTP = process.env.ALLOW_ANY_OTP?.trim() === 'true';
      console.log('ALLOW_ANY_OTP is set to:', ALLOW_ANY_OTP);

      if (ALLOW_ANY_OTP) {
        console.log('ALLOW_ANY_OTP is true, accepting any OTP.');
        if (!otp || otp.length !== 6 || isNaN(otp)) {
          return res.status(400).json({ error: 'OTP must be a 6-digit number' });
        }
      } else {
        console.log('ALLOW_ANY_OTP is false, performing strict OTP validation.');
        const storedOTP = cacheService.get(email);
        console.log('Stored OTP:', storedOTP);
        console.log('Provided OTP:', otp);

        if (!storedOTP) {
          return res.status(400).json({ error: 'No OTP found for this email' });
        }

        if (storedOTP !== otp) {
          return res.status(400).json({ error: 'Invalid OTP' });
        }
        console.log('OTP validated successfully.');
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Hashed password before saving:', hashedPassword);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });

      console.log('User created with hashed password:', user.password);

      return res.status(201).json({
        message: 'User created successfully',
        userId: user.id,
      });
    } catch (error) {
      console.error('Error in verifyUserCreation:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async healthCheck(req, res) {
    try {
      const response = 'Harmony, running since 2024!';
      res.status(201).json(response);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getUserById(req, res) {
    try {
      const user = await userDAO.findUserById(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] },
      });
      return res.status(200).json(users);
    } catch (error) {
      logger.error('Error fetching users:', { error: error.message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateUser(req, res) {
    try {
      const user = await userDAO.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteUser(req, res) {
    try {
      await userDAO.deleteUser(req.params.id);
      res.status(204).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateGithubToken(req, res) {
    try {
      const email = req.user?.email;
      const { code } = req.body;

      if (!code || !email) {
        return res.status(400).json({ error: 'GitHub code and email are required' });
      }

      // Check if required environment variables are set
      if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        console.error('[UserController] Missing GitHub environment variables');
        return res.status(500).json({
          error: 'GitHub configuration is incomplete. Please check environment variables.',
          details: 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required',
        });
      }

      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      console.log('Token response:', tokenResponse.data);

      if (!tokenResponse.data.access_token) {
        return res.status(400).json({ error: 'Failed to get GitHub access token' });
      }

      await User.update({ githubToken: tokenResponse.data.access_token }, { where: { email } });

      return res.status(200).json({
        message: 'GitHub token updated successfully',
        token: tokenResponse.data.access_token,
      });
    } catch (error) {
      console.error('Update GitHub token error:', error);
      return res.status(500).json({
        error: 'Failed to update GitHub token',
        details: error.message,
      });
    }
  }

  async validateGithubToken(req, res) {
    try {
      const email = req.user?.email;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.githubToken) {
        return res.status(404).json({ error: 'No GitHub token found' });
      }

      try {
        await axios.get('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${user.githubToken}`,
          },
        });

        return res.status(200).json({
          message: 'GitHub token is valid',
          token: user.githubToken,
        });
      } catch (error) {
        console.error('[UserController] GitHub token validation error:', error);
        await User.update({ githubToken: null }, { where: { email } });
        return res.status(400).json({ error: 'GitHub token is invalid' });
      }
    } catch (error) {
      console.error('[UserController] Failed to validate GitHub token:', error);
      return res.status(500).json({
        error: 'Failed to validate GitHub token',
        details: error.message,
      });
    }
  }

  async getGithubRepositories(req, res) {
    try {
      const email = req.user?.email;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        console.error('User not found');
        return res.status(404).json({ error: 'User not found' });
      }

      const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
          Authorization: `Bearer ${user.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return res.status(200).json(response.data);
    } catch (error) {
      console.error('Get GitHub repositories error:', error.response?.data || error.message);
      return res.status(500).json({
        error: 'Failed to fetch GitHub repositories',
        details: error.response?.data || error.message,
      });
    }
  }

  async validateAzureDevOpsToken(req, res) {
    try {
      const email = req.user?.email;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.azureAccessToken || !user.defaultAzureOrganization) {
        return res.status(404).json({ error: 'No Azure DevOps credentials found' });
      }

      const validationResult = await azureDevOpsService.validatePAT(user.azureAccessToken, user.defaultAzureOrganization);

      if (!validationResult.isValid) {
        return res.status(400).json({ error: 'Invalid PAT or organization' });
      }

      return res.status(200).json({
        message: 'Azure DevOps token is valid',
        isValid: validationResult.isValid,
        organization: user.defaultAzureOrganization,
      });
    } catch (error) {
      console.error('[UserController] Failed to validate Azure DevOps token:', error);
      return res.status(500).json({
        error: 'Failed to validate Azure DevOps token',
        details: error.message,
      });
    }
  }

  async updateAzureDevOpsToken(req, res) {
    try {
      const email = req.user?.email;
      const { pat, organization } = req.body;

      if (!pat || !organization || !email) {
        return res.status(400).json({ error: 'PAT, organization, and email are required' });
      }

      const validationResult = await azureDevOpsService.validatePAT(pat, organization);

      if (!validationResult.isValid) {
        return res.status(400).json({ error: 'Invalid PAT or organization' });
      }

      await User.update(
        {
          azureAccessToken: pat,
          defaultAzureOrganization: organization,
        },
        { where: { email } }
      );

      return res.status(200).json({
        message: 'Azure DevOps credentials updated successfully',
        user: validationResult.user,
      });
    } catch (error) {
      console.error('[UserController] Update Azure DevOps credentials error:', error);
      return res.status(500).json({
        error: 'Failed to update Azure DevOps credentials',
        details: error.message,
      });
    }
  }

  async getAzureDevOpsProjects(req, res) {
    try {
      const email = req.user?.email;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.azureAccessToken || !user.defaultAzureOrganization) {
        return res.status(404).json({ error: 'No Azure DevOps credentials found' });
      }

      const projects = await azureDevOpsService.getProjects(user.azureAccessToken, user.defaultAzureOrganization);
      return res.status(200).json(projects);
    } catch (error) {
      console.error('[UserController] Failed to fetch Azure DevOps projects:', error);
      return res.status(500).json({
        error: 'Failed to fetch Azure DevOps projects',
        details: error.message,
      });
    }
  }

  async getAzureDevOpsRepositories(req, res) {
    try {
      const email = req.user?.email;
      const { projectId } = req.query;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.azureAccessToken || !user.defaultAzureOrganization) {
        return res.status(404).json({ error: 'No Azure DevOps credentials found' });
      }

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const repositories = await azureDevOpsService.getRepositories(user.azureAccessToken, user.defaultAzureOrganization, projectId);
      return res.status(200).json(repositories);
    } catch (error) {
      console.error('[UserController] Failed to fetch Azure DevOps repositories:', error);
      return res.status(500).json({
        error: 'Failed to fetch Azure DevOps repositories',
        details: error.message,
      });
    }
  }

  async getAzureDevOpsBranches(req, res) {
    try {
      const email = req.user?.email;
      const { projectId, repositoryId } = req.query;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.azureAccessToken || !user.defaultAzureOrganization) {
        return res.status(404).json({ error: 'No Azure DevOps credentials found' });
      }

      if (!projectId || !repositoryId) {
        return res.status(400).json({ error: 'Project ID and Repository ID are required' });
      }

      const branches = await azureDevOpsService.getBranches(user.azureAccessToken, user.defaultAzureOrganization, projectId, repositoryId);
      return res.status(200).json(branches);
    } catch (error) {
      console.error('[UserController] Failed to fetch Azure DevOps branches:', error);
      return res.status(500).json({
        error: 'Failed to fetch Azure DevOps branches',
        details: error.message,
      });
    }
  }

  async updateGitlabToken(req, res) {
    try {
      const email = req.user?.email;
      const { code } = req.body;

      console.log('[GitLab] Token update request:', { email, hasCode: !!code });

      if (!code || !email) {
        console.log('[GitLab] Missing required fields:', {
          hasCode: !!code,
          hasEmail: !!email,
        });
        return res.status(400).json({ error: 'GitLab code and email are required' });
      }

      // Check if required environment variables are set
      if (!process.env.GITLAB_CLIENT_ID || !process.env.GITLAB_CLIENT_SECRET) {
        console.error('[GitLab] Missing GitLab environment variables');
        return res.status(500).json({
          error: 'GitLab configuration is incomplete. Please check environment variables.',
          details: 'GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET are required',
        });
      }

      const tokenResponse = await axios.post(
        `https://gitlab.com/oauth/token`,
        {
          client_id: process.env.GITLAB_CLIENT_ID,
          client_secret: process.env.GITLAB_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.GITLAB_REDIRECT_URI}/projects`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('[GitLab] Token response status:', tokenResponse.status);
      console.log('[GitLab] Token response data:', tokenResponse.data);

      if (!tokenResponse.data.access_token) {
        console.error('[GitLab] No access token in response');
        return res.status(400).json({ error: 'Failed to get GitLab access token' });
      }

      console.log('[GitLab] Access token received, updating database');
      await User.update({ gitlabToken: tokenResponse.data.access_token }, { where: { email } });

      console.log('[GitLab] Database updated successfully');

      return res.status(200).json({
        message: 'GitLab token updated successfully',
        token: tokenResponse.data.access_token,
      });
    } catch (error) {
      console.error('[GitLab] Update GitLab token error:', error);
      console.error('[GitLab] Error response:', error.response?.data);
      return res.status(500).json({
        error: 'Failed to update GitLab token',
        details: error.message,
      });
    }
  }

  async validateGitlabToken(req, res) {
    try {
      const email = req.user?.email;

      console.log('[GitLab] Token validation request for email:', email);

      if (!email) {
        console.log('[GitLab] No email provided');
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await User.findOne({ where: { email } });

      if (!user) {
        console.log('[GitLab] User not found:', email);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('[GitLab] User found, checking for GitLab token');
      console.log('[GitLab] Has GitLab token:', !!user.gitlabToken);

      if (!user.gitlabToken) {
        console.log('[GitLab] No GitLab token found for user:', email);
        return res.status(404).json({ error: 'No GitLab token found' });
      }

      try {
        console.log('[GitLab] Validating token with GitLab service');
        const validationResult = await gitlabService.validateToken(user.gitlabToken);

        console.log('[GitLab] Validation result:', validationResult);

        if (!validationResult.isValid) {
          console.log('[GitLab] Token validation failed, clearing token');
          await User.update({ gitlabToken: null }, { where: { email } });
          return res.status(400).json({ error: 'GitLab token is invalid' });
        }

        console.log('[GitLab] Token validation successful');
        return res.status(200).json({
          message: 'GitLab token is valid',
          token: user.gitlabToken,
        });
      } catch (error) {
        console.error('[GitLab] Token validation error:', error);
        await User.update({ gitlabToken: null }, { where: { email } });
        return res.status(400).json({ error: 'GitLab token is invalid' });
      }
    } catch (error) {
      console.error('[GitLab] Failed to validate GitLab token:', error);
      return res.status(500).json({
        error: 'Failed to validate GitLab token',
        details: error.message,
      });
    }
  }

  async getGitlabRepositories(req, res) {
    try {
      const email = req.user?.email;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        console.error('User not found');
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.gitlabToken) {
        return res.status(404).json({ error: 'No GitLab token found' });
      }

      const repositories = await gitlabService.getRepositories(user.gitlabToken);
      return res.status(200).json(repositories);
    } catch (error) {
      console.error('Get GitLab repositories error:', error.response?.data || error.message);
      return res.status(500).json({
        error: 'Failed to fetch GitLab repositories',
        details: error.response?.data || error.message,
      });
    }
  }
}

module.exports = new UserController();
