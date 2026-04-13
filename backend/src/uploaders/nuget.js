const fs = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('nuget.asset', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/octet-stream',
  });

  const url = `${nexusUrl}/service/rest/v1/components?repository=${encodeURIComponent(repo)}`;
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
