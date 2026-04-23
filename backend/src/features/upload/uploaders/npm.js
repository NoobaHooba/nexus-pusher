const fs = require('fs');
const { nexusRequest } = require('../../../shared/nexus/request');
const { detectArtifact } = require('../../../shared/artifacts/metadata');

async function upload({ file, nexusUrl, repo, username, password }) {
  const tarball = fs.readFileSync(file.path);
  const b64 = tarball.toString('base64');

  const detected = await detectArtifact('npm', file, {});
  const name = detected.detected.coordinates.packageName || detected.detected.name || file.originalname.replace(/\.tgz$/i, '');
  const version = detected.detected.coordinates.version || detected.detected.version || '1.0.0';
  const encodedName = encodeURIComponent(name);
  const tarballName = `${name.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`;
  const baseUrl = `${nexusUrl.replace(/\/$/, '')}/repository/${repo}`;

  const body = {
    _id: name,
    name,
    versions: {
      [version]: {
        name,
        version,
        dist: { tarball: `${baseUrl}/${name}/-/${tarballName}` },
      },
    },
    _attachments: {
      [tarballName]: {
        content_type: 'application/octet-stream',
        data: b64,
        length: tarball.length,
      },
    },
  };

  const url = `${baseUrl}/${encodedName}`;
  const response = await nexusRequest({
    method: 'PUT',
    url,
    data: body,
    headers: { 'Content-Type': 'application/json' },
    auth: username ? { username, password } : undefined,
  });

  const nexusUiUrl = `${nexusUrl.replace(/\/$/, '')}/#browse/browse:${repo}:${encodeURIComponent(name)}`;
  return {
    url,
    downloadUrl: `${baseUrl}/${name}/-/${tarballName}`,
    path: `${name}/-/${tarballName}`,
    nexusUiUrl,
    status: response.status,
  };
}

module.exports = { upload };
