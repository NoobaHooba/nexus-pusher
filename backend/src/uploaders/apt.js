const axios = require('axios');
const fs = require('fs');

/**
 * Uploads a Debian package (.deb) to a Nexus Apt-hosted repo.
 */
async function upload({ file, nexusUrl, repo, username, password }) {
  const url = `${nexusUrl}/repository/${repo}/`;
  const auth = username ? { username, password } : undefined;

  const fileStream = fs.createReadStream(file.path);
  const response = await axios.post(url, fileStream, {
    headers: {
      'Content-Type': 'application/vnd.debian.binary-package',
      'Content-Disposition': `attachment; filename="${file.originalname}"`,
    },
    auth,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { url, status: response.status };
}

module.exports = { upload };
