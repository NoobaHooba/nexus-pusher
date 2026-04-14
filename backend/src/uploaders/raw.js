const fs = require('fs');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const raw = (extra.directory || '').replace(/^\/+|\/+$/g, '');
  const dir = raw ? `/${raw}/` : '/';
  const filePath = `${dir}${file.originalname}`.replace(/^\//, '');
  const url = `${nexusUrl}/repository/${repo}/${filePath}`;

  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: fs.createReadStream(file.path),
    headers: { 'Content-Type': 'application/octet-stream' },
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${nexusUrl}/#browse/browse:${repo}:${encodeURIComponent(filePath)}`;
  return { url, nexusUiUrl, status: response.status };
}

module.exports = { upload };
