const axios = require('axios');

/**
 * Shared axios wrapper for all Nexus uploads.
 * - validateStatus: throws on anything that is not 2xx
 * - Extracts a human-readable error message from Nexus HTML/JSON responses
 */
async function nexusRequest(config) {
  try {
    const response = await axios({
      ...config,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Treat anything outside 200-299 as an error
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response;
  } catch (err) {
    // axios attaches the response when the server replied with a non-2xx
    if (err.response) {
      const { status, data } = err.response;
      let message = `Nexus returned HTTP ${status}`;

      if (typeof data === 'string') {
        // Nexus HTML error pages contain a <title> like "404 - Not Found"
        const titleMatch = data.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          message = `Nexus: ${titleMatch[1].trim()}`;
        } else if (data.length < 300) {
          // Short plain-text error body — show it directly
          message = `Nexus: ${data.trim()}`;
        }
      } else if (data && typeof data === 'object') {
        // Nexus REST API JSON errors
        if (data.message) message = `Nexus: ${data.message}`;
        else if (Array.isArray(data.errors) && data.errors.length > 0) {
          message = `Nexus: ${data.errors.map(e => e.message || JSON.stringify(e)).join('; ')}`;
        }
      }

      if (status === 401) message = 'Nexus: Authentication failed — check username/password';
      if (status === 403) message = 'Nexus: Permission denied — user may not have deploy rights on this repository';
      if (status === 404) message = 'Nexus: Repository not found — check the repository name';

      throw new Error(message);
    }

    // Network error (no response received at all)
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Nexus at the given URL — is the server running?`);
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`Nexus URL could not be resolved — check the URL`);
    }

    throw err;
  }
}

module.exports = { nexusRequest };
