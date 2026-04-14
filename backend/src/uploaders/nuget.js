const fs = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('package', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/octet-stream',
  });

  const url = `${nexusUrl}/repository/${repo}/`;
  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: form,
    headers: form.getHeaders(),
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${nexusUrl}/#browse/browse:${repo}`;
  return { url, nexusUiUrl, status: response.status };
}

module.exports = { upload };
