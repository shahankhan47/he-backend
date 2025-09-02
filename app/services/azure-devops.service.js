const axios = require('axios');

class AzureDevOpsService {
  async validatePAT(pat, organization) {
    try {
      // Validate PAT by making a test request to get user profile
      const response = await axios.get(`https://dev.azure.com/${organization}/_apis/projects?api-version=7.2-preview.4`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        },
      });

      if (response.status === 200) {
        return {
          isValid: true,
        };
      }
      return { isValid: false };
    } catch (error) {
      console.error('[AzureDevOpsService] Error validating PAT:', error.response?.data || error.message);
      return { isValid: false };
    }
  }

  async getProjects(pat, organization) {
    try {
      console.info('[AzureDevOpsService] Getting projects:', {
        organization,
      });
      const response = await axios.get(`https://dev.azure.com/${organization}/_apis/projects`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        },
        params: {
          'api-version': '6.0',
        },
      });
      console.info('projects', response.data.value);
      return response.data.value;
    } catch (error) {
      console.error('[AzureDevOpsService] Error fetching projects:', error.response?.data || error.message);
      throw new Error('Failed to fetch projects');
    }
  }

  async getRepositories(pat, organization, projectId) {
    try {
      const response = await axios.get(`https://dev.azure.com/${organization}/${projectId}/_apis/git/repositories`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        },
        params: {
          'api-version': '6.0',
        },
      });
      return response.data.value;
    } catch (error) {
      console.error('[AzureDevOpsService] Error fetching repositories:', error.response?.data || error.message);
      throw new Error('Failed to fetch repositories');
    }
  }

  async downloadRepository(pat, organization, projectId, repositoryId, branch = 'main') {
    try {
      console.info('[AzureDevOpsService] Downloading repository:', {
        organization,
        projectId,
        repositoryId,
        branch,
      });

      const response = await axios.get(`https://dev.azure.com/${organization}/${projectId}/_apis/git/repositories/${repositoryId}/items`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        },
        params: {
          'api-version': '7.2-preview.1',
          scopePath: '/',
          download: true,
          $format: 'zip',
          recursionLevel: 'full',
          includeContentMetadata: true,
          'versionDescriptor.version': branch,
          'versionDescriptor.versionType': 'branch',
        },
        responseType: 'arraybuffer',
        validateStatus: function (status) {
          return status >= 200 && status < 300; // Only accept 2xx status codes
        },
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('Received empty or invalid zip data');
      }

      return response.data;
    } catch (error) {
      console.error('[AzureDevOpsService] Error downloading repository:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data ? Buffer.from(error.response.data).toString('utf8') : undefined,
        message: error.message,
        config: {
          url: error.config?.url,
          params: error.config?.params,
        },
      });

      if (error.response?.status === 404) {
        throw new Error(`Repository not found. Please verify the repository ID (${repositoryId}) and project ID (${projectId}) are correct.`);
      }

      if (error.response?.data) {
        try {
          const errorData = JSON.parse(Buffer.from(error.response.data).toString('utf8'));
          throw new Error(errorData.message || 'Failed to download repository');
        } catch (e) {
          throw new Error('Failed to download repository');
        }
      }

      throw new Error('Failed to download repository');
    }
  }

  async getBranches(pat, organization, projectId, repositoryId) {
    try {
      const response = await axios.get(`https://dev.azure.com/${organization}/${projectId}/_apis/git/repositories/${repositoryId}/refs`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        },
        params: {
          'api-version': '6.0',
          filter: 'heads/',
        },
      });
      return response.data.value.map((branch) => ({
        name: branch.name.replace('refs/heads/', ''),
        objectId: branch.objectId,
      }));
    } catch (error) {
      console.error('[AzureDevOpsService] Error fetching branches:', error.response?.data || error.message);
      throw new Error('Failed to fetch branches');
    }
  }
}

module.exports = new AzureDevOpsService();
