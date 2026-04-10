const axios = require('axios');
const fs = require('fs');

/**
 * Uploads any file to a Nexus Raw-hosted repo.
 * Expects extra: { directory } — the path in the repo to store the file.
 */
async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const directory = extra.directory ? `/${extra.directory.replace(/^\//, '')}` : '';
  const url = `${nexusUrl}/repository/${repo}${directory}/${file.originalname}`;
  const auth = username ? { username, password } : undefined;

  const fileStream = fs.createReadStream(file.path);
  const response = await axios.put(url, fileStream, {
    headers: { 'Content-Type': 'application/octet-stream' },
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
