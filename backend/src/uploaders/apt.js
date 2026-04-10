const fs = require('fs');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password }) {
  const url = `${nexusUrl}/repository/${repo}/`;

  const response = await nexusRequest({
    method: 'POST',
    url,
    data: fs.createReadStream(file.path),
    headers: {
      'Content-Type': 'application/vnd.debian.binary-package',
      'Content-Disposition': `attachment; filename="${file.originalname}"`,
    },
    auth: username ? { username, password } : undefined,
  });

  return { url, status: response.status };
}

module.exports = { upload };
