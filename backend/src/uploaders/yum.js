const fs = require('fs');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const directory = (extra.directory || '').replace(/^\/+|\/+$/g, '');
  const dir = directory ? `/${directory}/` : '/';
  const url = `${nexusUrl}/repository/${repo}${dir}${file.originalname}`;

  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: fs.createReadStream(file.path),
    headers: { 'Content-Type': 'application/octet-stream' },
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${nexusUrl}/#browse/browse:${repo}`;
  return { url, nexusUiUrl, status: response.status };
}

module.exports = { upload };
