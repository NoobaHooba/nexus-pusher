const fs = require('fs');
const { nexusRequest } = require('../../../shared/nexus/request');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const directory = (extra.directory || '').replace(/^\/+|\/+$/g, '');
  const dir = directory ? `/${directory}/` : '/';
  const base = nexusUrl.replace(/\/$/, '');
  const path = `${directory ? `${directory}/` : ''}${file.originalname}`;
  const url = `${base}/repository/${repo}${dir}${file.originalname}`;

  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: fs.createReadStream(file.path),
    headers: { 'Content-Type': 'application/octet-stream' },
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${base}/#browse/browse:${repo}`;
  return { url, downloadUrl: url, path, nexusUiUrl, status: response.status };
}

module.exports = { upload };
