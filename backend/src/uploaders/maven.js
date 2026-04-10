const fs = require('fs');
const path = require('path');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const { groupId, artifactId, version, extension } = extra;
  if (!groupId || !artifactId || !version) {
    throw new Error('Maven upload requires groupId, artifactId, and version');
  }
  const ext = extension || path.extname(file.originalname).replace('.', '') || 'jar';
  const groupPath = groupId.replace(/\./g, '/');
  const uploadPath = `${groupPath}/${artifactId}/${version}/${artifactId}-${version}.${ext}`;
  const url = `${nexusUrl}/repository/${repo}/${uploadPath}`;

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
