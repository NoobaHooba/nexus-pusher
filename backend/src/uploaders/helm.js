const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

/**
 * Uploads a Helm chart (.tgz) to a Nexus Helm-hosted repo.
 */
async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('chart', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/gzip',
  });

  const url = `${nexusUrl}/repository/${repo}/`;
  const auth = username ? { username, password } : undefined;

  const response = await axios.post(url, form, {
    headers: form.getHeaders(),
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
