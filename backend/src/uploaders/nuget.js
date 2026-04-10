const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

/**
 * Uploads a NuGet package (.nupkg) to a Nexus NuGet-hosted repo.
 */
async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('package', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/octet-stream',
  });

  const url = `${nexusUrl}/repository/${repo}/`;
  const auth = username ? { username, password } : undefined;

  const response = await axios.put(url, form, {
    headers: {
      ...form.getHeaders(),
      'X-NuGet-ApiKey': password || 'APIKEY',
    },
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
