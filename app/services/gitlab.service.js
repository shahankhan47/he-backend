const { default: axios } = require('axios');

class GitlabService {
  constructor() {
    this.baseUrl = 'https://gitlab.com';
    this.apiVersion = 'v4';
  }

  async downloadRepository(repositoryUrl, branch, gitlabToken) {
    try {
      console.log(`[GitlabService] Starting repository download - URL: ${repositoryUrl}, Branch: ${branch}`);

      // Extract project ID from repository URL
      const projectId = await this.getProjectIdFromUrl(repositoryUrl, gitlabToken);

      if (!projectId) {
        throw new Error('Could not find project ID for the repository URL');
      }

      // Build download URL for GitLab API
      const downloadUrl = `${this.baseUrl}/api/${this.apiVersion}/projects/${projectId}/repository/archive.zip`;

      console.log(`[GitlabService] Generated download URL: ${downloadUrl}`);

      const response = await axios.get(downloadUrl, {
        headers: gitlabToken
          ? {
              Authorization: `Bearer ${gitlabToken}`,
              Accept: 'application/zip',
            }
          : undefined,
        params: {
          ref: branch || 'main',
        },
        responseType: 'arraybuffer',
      });

      if (!response.data || response.data.length === 0) {
        console.error('[GitlabService] Received empty or invalid zip data');
        throw new Error('Received empty or invalid zip data');
      }

      console.log(`[GitlabService] Successfully downloaded repository - Size: ${response.data.length} bytes`);
      return response.data;
    } catch (error) {
      console.error(`[GitlabService] Download failed: ${error.message}`, {
        repositoryUrl,
        branch,
        error: error.response?.data || error.message,
      });
      throw new Error(`GitLab download failed: ${error.message}`);
    }
  }

  async getProjectIdFromUrl(repositoryUrl, gitlabToken) {
    try {
      // Remove .git suffix and trailing slash
      let cleanUrl = repositoryUrl.replace(/\.git$/, '').replace(/\/$/, '');

      // Extract path from URL (e.g., "group/project" from "https://gitlab.com/group/project")
      const urlParts = cleanUrl.split('/');
      const path = urlParts.slice(-2).join('/'); // Get last two parts as group/project

      // Encode the path for API call
      const encodedPath = encodeURIComponent(path);

      const response = await axios.get(`${this.baseUrl}/api/${this.apiVersion}/projects/${encodedPath}`, {
        headers: gitlabToken
          ? {
              Authorization: `Bearer ${gitlabToken}`,
              Accept: 'application/json',
            }
          : undefined,
      });

      return response.data.id;
    } catch (error) {
      console.error('[GitlabService] Error getting project ID:', error.response?.data || error.message);
      throw new Error('Failed to get project ID from repository URL');
    }
  }

  async validateToken(token) {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'Token is required',
        };
      }

      const response = await axios.get(`${this.baseUrl}/api/${this.apiVersion}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.status === 200 && response.data) {
        return {
          isValid: true,
          user: response.data,
        };
      } else {
        return {
          isValid: false,
          error: 'Invalid response from GitLab API',
        };
      }
    } catch (error) {
      console.error('[GitlabService] Token validation failed:', error.response?.data || error.message);

      // Handle different types of errors
      if (error.response?.status === 401) {
        return {
          isValid: false,
          error: 'Invalid or expired token',
        };
      } else if (error.response?.status === 403) {
        return {
          isValid: false,
          error: 'Insufficient permissions',
        };
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          isValid: false,
          error: 'Request timeout - GitLab service unavailable',
        };
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          isValid: false,
          error: 'Cannot connect to GitLab service',
        };
      } else {
        return {
          isValid: false,
          error: error.response?.data?.message || error.message || 'Unknown error occurred',
        };
      }
    }
  }

  async getRepositories(token) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/${this.apiVersion}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        params: {
          membership: true,
          per_page: 100,
          order_by: 'name',
          sort: 'asc',
        },
      });

      return response.data.map((project) => ({
        id: project.id,
        name: project.name,
        full_name: project.path_with_namespace,
        html_url: project.web_url,
        private: project.visibility === 'private',
        default_branch: project.default_branch,
        description: project.description,
        created_at: project.created_at,
        updated_at: project.last_activity_at,
      }));
    } catch (error) {
      console.error('[GitlabService] Error fetching repositories:', error.response?.data || error.message);
      throw new Error('Failed to fetch GitLab repositories');
    }
  }
}

module.exports = new GitlabService();
