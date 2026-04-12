const fs = require('fs');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  // Normalize directory: strip leading/trailing slashes, then wrap with slashes
  // so the final URL is always: /repository/<repo>/<dir>/<filename>
  const raw = (extra.directory || '').replace(/^\/+|\/+$/g, '');
  const dir = raw ? `/${raw}/` : '/';
  const url = `${nexusUrl}/repository/${repo}${dir}${file.originalname}`;

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
