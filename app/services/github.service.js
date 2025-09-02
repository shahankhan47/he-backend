const { default: axios } = require('axios');

class GithubService {
  async downloadRepository(repositoryUrl, branch, githubToken) {
    try {
      console.log(`[GithubService] Starting repository download - URL: ${repositoryUrl}, Branch: ${branch}`);

      let downloadUrl = repositoryUrl
        .replace(/\.git$/, '')
        .replace(/\/$/, '')
        .replace('github.com', 'codeload.github.com');
      downloadUrl = `${downloadUrl}/zip/refs/heads/${branch}`;

      console.log(`[GithubService] Generated download URL: ${downloadUrl}`);

      const response = await axios.get(downloadUrl, {
        headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : undefined,
        responseType: 'arraybuffer',
      });

      if (!response.data || response.data.length === 0) {
        console.error('[GithubService] Received empty or invalid zip data');
        throw new Error('Received empty or invalid zip data');
      }

      console.log(`[GithubService] Successfully downloaded repository - Size: ${response.data.length} bytes`);
      return response.data;
    } catch (error) {
      console.error(`[GithubService] Download failed: ${error.message}`, {
        repositoryUrl,
        branch,
        error: error.response?.data || error.message,
      });
      throw new Error(`GitHub download failed: ${error.message}`);
    }
  }
}

module.exports = new GithubService();
