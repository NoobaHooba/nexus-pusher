const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

/**
 * Uploads a Python package (.whl or .tar.gz) to a Nexus PyPI-hosted repo.
 */
async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append(':action', 'file_upload');
  form.append('protocol_version', '1');
  form.append('content', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/octet-stream',
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
