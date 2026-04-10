const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Uploads an RPM package to a Nexus Yum-hosted repo.
 */
async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const directory = extra.directory || '/';
  const filename = file.originalname;
  const url = `${nexusUrl}/repository/${repo}${directory}${filename}`;
  const auth = username ? { username, password } : undefined;

  const fileStream = fs.createReadStream(file.path);
  const response = await axios.put(url, fileStream, {
    headers: { 'Content-Type': 'application/x-rpm' },
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
