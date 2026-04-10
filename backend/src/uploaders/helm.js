const fs = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('chart', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/gzip',
  });

  const url = `${nexusUrl}/repository/${repo}/`;
  const response = await nexusRequest({
    method: 'POST',
    url,
    data: form,
    headers: form.getHeaders(),
    auth: username ? { username, password } : undefined,
  });

  return { url, status: response.status };
}

module.exports = { upload };
