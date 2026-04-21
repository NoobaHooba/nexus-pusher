const { execFileSync } = require('child_process');
const path = require('path');

/**
 * Loads a Docker image tarball and pushes it to a Docker registry.
 * Requires Docker CLI to be available in the backend container.
 * extra: { imageName, imageTag, registry }
 *
 * Uses execFileSync (not execSync) to prevent shell injection — arguments are
 * passed as an array and never interpolated into a shell string.
 */
async function upload({ file, nexusUrl, repo, username, password, extra }) {
  const registry = (extra.registry || 'docker.io').trim();
  const imageName = extra.imageName || path.basename(file.originalname, '.tar');
  const imageTag  = extra.imageTag  || 'latest';
  const fullTag   = registry === 'docker.io'
    ? `${imageName}:${imageTag}`
    : `${registry}/${imageName}:${imageTag}`;

  const opts = { timeout: 10 * 60 * 1000, stdio: 'pipe' }; // 10-minute timeout

  // Load
  execFileSync('docker', ['load', '-i', file.path], opts);

  // Tag
  execFileSync('docker', ['tag', `${imageName}:${imageTag}`, fullTag], opts);

  // Login (password via stdin to avoid it appearing in process list)
  if (username) {
    execFileSync(
      'docker',
      ['login', registry, '-u', username, '--password-stdin'],
      { ...opts, input: password || '' }
    );
  }

  // Push
  execFileSync('docker', ['push', fullTag], opts);

  return { registry, fullTag };
}

module.exports = { upload };
