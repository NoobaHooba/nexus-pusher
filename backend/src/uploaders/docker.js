const { execSync } = require('child_process');
const path = require('path');

/**
 * Loads a Docker image tarball and pushes it to a Nexus Docker-hosted registry.
 * Requires Docker to be installed on the server running the backend.
 * Expects extra: { imageName, imageTag }
 */
async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const registryUrl = new URL(nexusUrl);
  const registry = `${registryUrl.hostname}:${extra.dockerPort || 8082}`;
  const imageName = extra.imageName || path.basename(file.originalname, '.tar');
  const imageTag = extra.imageTag || 'latest';
  const fullTag = `${registry}/${imageName}:${imageTag}`;

  // Load the image tarball
  execSync(`docker load -i "${file.path}"`);

  // Tag it
  execSync(`docker tag ${imageName}:${imageTag} ${fullTag}`);

  // Login
  if (username) {
    execSync(`echo "${password}" | docker login ${registry} -u ${username} --password-stdin`);
  }

  // Push
  execSync(`docker push ${fullTag}`);

  return { registry, fullTag };
}

module.exports = { upload };
