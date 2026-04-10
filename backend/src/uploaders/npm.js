const fs = require('fs');
const path = require('path');
const { nexusRequest } = require('../lib/nexusRequest');

async function upload({ file, nexusUrl, repo, username, password }) {
  const tarball = fs.readFileSync(file.path);
  const b64 = tarball.toString('base64');

  const base = path.basename(file.originalname, '.tgz');
  const lastDash = base.lastIndexOf('-');
  const name = lastDash > 0 ? base.substring(0, lastDash) : base;
  const version = lastDash > 0 ? base.substring(lastDash + 1) : '1.0.0';

  const body = {
    _id: name,
    name,
    versions: {
      [version]: {
        name,
        version,
        dist: { tarball: `${nexusUrl}/repository/${repo}/${name}/-/${name}-${version}.tgz` },
      },
    },
    _attachments: {
      [`${name}-${version}.tgz`]: {
        content_type: 'application/octet-stream',
        data: b64,
        length: tarball.length,
      },
    },
  };

  const url = `${nexusUrl}/repository/${repo}/${name}`;
  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: body,
    headers: { 'Content-Type': 'application/json' },
    auth: username ? { username, password } : undefined,
  });

  return { url, status: response.status };
}

module.exports = { upload };
