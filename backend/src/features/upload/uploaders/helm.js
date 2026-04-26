const fs = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../../../shared/nexus/request');

async function upload({ file, nexusUrl, repo, username, password }) {
  const form = new FormData();
  const filename = file.originalname;
  const contentType = filename.endsWith('.tgz') || filename.endsWith('.tar.gz')
    ? 'application/gzip'
    : 'application/octet-stream';

  form.append('helm.asset', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType,
  });

  const base = nexusUrl.replace(/\/$/, '');
  const url = `${base}/service/rest/v1/components?repository=${encodeURIComponent(repo)}`;
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
    downloadUrl: `${base}/repository/${repo}/${filename}`,
    path: filename,
    nexusUiUrl,
    status: response.status,
  };
}

module.exports = { upload };
