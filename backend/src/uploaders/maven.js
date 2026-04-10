const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

/**
 * Uploads a Maven artifact (JAR/WAR/POM) to Nexus.
 * Expects extra: { groupId, artifactId, version, extension }
 */
async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const { groupId, artifactId, version, extension } = extra;
  if (!groupId || !artifactId || !version) {
    throw new Error('Maven upload requires groupId, artifactId, and version');
  }
  const ext = extension || path.extname(file.originalname).replace('.', '') || 'jar';
  const groupPath = groupId.replace(/\./g, '/');
  const uploadPath = `${groupPath}/${artifactId}/${version}/${artifactId}-${version}.${ext}`;
  const url = `${nexusUrl}/repository/${repo}/${uploadPath}`;

  const fileStream = fs.createReadStream(file.path);
  const auth = username ? { username, password } : undefined;

  const response = await axios.put(url, fileStream, {
    headers: { 'Content-Type': 'application/octet-stream' },
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
