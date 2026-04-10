const fs = require('fs');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const directory = extra.directory ? `/${extra.directory.replace(/^\//, '')}` : '';
  const url = `${nexusUrl}/repository/${repo}${directory}/${file.originalname}`;

  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: fs.createReadStream(file.path),
    headers: { 'Content-Type': 'application/octet-stream' },
    auth: username ? { username, password } : undefined,
  });

  return { url, status: response.status };
}

module.exports = { upload };
