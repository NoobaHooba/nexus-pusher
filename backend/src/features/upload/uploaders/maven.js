const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { nexusRequest } = require('../../../shared/nexus/request');

async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const { groupId, artifactId, version, extension, classifier } = extra;
  if (!groupId || !artifactId || !version) {
    throw new Error('Maven upload requires groupId, artifactId, and version');
  }

  const base = nexusUrl.replace(/\/$/, '');
  const ext = (extension || path.extname(file.originalname).replace('.', '') || 'jar').trim().replace(/^\./, '');
  const normalizedClassifier = (classifier || '').trim();
  const url = `${base}/service/rest/v1/components?repository=${encodeURIComponent(repo)}`;

  const form = new FormData();
  form.append('maven2.groupId', groupId.trim());
  form.append('maven2.artifactId', artifactId.trim());
  form.append('maven2.version', version.trim());
  form.append('maven2.asset1', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: ext === 'pom' ? 'application/xml' : 'application/octet-stream',
    knownLength: file.size,
  });
  form.append('maven2.asset1.extension', ext);

  if (normalizedClassifier) {
    form.append('maven2.asset1.classifier', normalizedClassifier);
  }

  // Generate a minimal POM for binary-only uploads so a plain JAR push works.
  if (ext !== 'pom') {
    form.append('maven2.generate-pom', 'true');
  }

  const response = await nexusRequest({
    method: 'POST',
    url,
    data: form,
    headers: form.getHeaders(),
    auth: username ? { username, password: password || '' } : undefined,
  });

  const groupPath = groupId.trim().replace(/\./g, '/');
  const classifierSuffix = normalizedClassifier ? `-${normalizedClassifier}` : '';
  const uploadPath = `${groupPath}/${artifactId.trim()}/${version.trim()}/${artifactId.trim()}-${version.trim()}${classifierSuffix}.${ext}`;
  const nexusUiUrl = `${base}/#browse/browse:${repo}:${encodeURIComponent(uploadPath)}`;
  return {
    url,
    path: uploadPath,
    downloadUrl: `${base}/repository/${repo}/${uploadPath}`,
    nexusUiUrl,
    status: response.status,
  };
}

module.exports = { upload };
