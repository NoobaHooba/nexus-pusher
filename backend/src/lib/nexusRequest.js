const axios = require('axios');

/**
 * Shared axios wrapper for all Nexus uploads.
 * - validateStatus: throws on anything that is not 2xx
 * - Extracts a human-readable error message from Nexus HTML/JSON responses
 * - Sets err.isDuplicate = true when Nexus reports a file already exists
 */
async function nexusRequest(config) {
  try {
    const response = await axios({
      ...config,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return response;
  } catch (err) {
    if (err.response) {
      const { status, data } = err.response;
      let message = `Nexus returned HTTP ${status}`;
      let isDuplicate = false;

      if (typeof data === 'string') {
        const titleMatch = data.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          message = `Nexus: ${titleMatch[1].trim()}`;
        } else if (data.length < 300) {
          message = `Nexus: ${data.trim()}`;
        }
        // Nexus plain-text 400 for duplicates
        if (status === 400 && /already exist|duplicate|conflict/i.test(data)) {
          isDuplicate = true;
          message = 'File already exists in repository';
        }
      } else if (data && typeof data === 'object') {
        if (data.message) message = `Nexus: ${data.message}`;
        else if (Array.isArray(data.errors) && data.errors.length > 0) {
          message = `Nexus: ${data.errors.map(e => e.message || JSON.stringify(e)).join('; ')}`;
        }
        // Nexus REST API JSON 400 for duplicates
        if (status === 400 && /already exist|duplicate|conflict/i.test(JSON.stringify(data))) {
          isDuplicate = true;
          message = 'File already exists in repository';
        }
      }

      if (status === 401) message = 'Nexus: Authentication failed — check username/password';
      if (status === 403) message = 'Nexus: Permission denied — user may not have deploy rights on this repository';
      if (status === 404) message = 'Nexus: Repository not found — check the repository name';

      const error = new Error(message);
      error.isDuplicate = isDuplicate;
      throw error;
    }

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
