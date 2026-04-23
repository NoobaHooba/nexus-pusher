const fs = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../../../shared/nexus/request');

async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  form.append('chart', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: 'application/octet-stream',
  });

  const base = nexusUrl.replace(/\/$/, '');
  const url = `${base}/repository/${repo}/`;
  const response = await nexusRequest({
    method: 'POST',
    url,
    data: form,
    headers: form.getHeaders(),
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${base}/#browse/browse:${repo}`;
  return {
    url,
    downloadUrl: `${base}/repository/${repo}/${file.originalname}`,
    path: file.originalname,
    nexusUiUrl,
    status: response.status,
  };
}

module.exports = { upload };
