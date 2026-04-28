const { execFileSync } = require('child_process');
const { detectArtifact } = require('../../../shared/artifacts/metadata');
const { stripKnownExtension } = require('../../../shared/artifacts/paths');

function extractRegistryHost(registry) {
  return String(registry || '').trim().split('/')[0] || '';
}

function parseDockerLoadOutput(output) {
  const text = String(output || '').trim();
  const loadedRef = text.match(/Loaded image:\s+(.+)$/im)?.[1]?.trim() || '';
  const loadedId = text.match(/Loaded image ID:\s+(.+)$/im)?.[1]?.trim() || '';
  return { loadedRef, loadedId };
}

async function upload({ file, repo, username, password, extra = {} }) {
  const detectedResult = await detectArtifact('docker', file, extra);
  const detectedCoordinates = detectedResult?.detected?.coordinates || {};
  const imageName = String(extra.imageName || detectedCoordinates.imageName || stripKnownExtension(file.originalname)).trim();
  const imageTag = String(extra.imageTag || detectedCoordinates.imageTag || 'latest').trim();
  const sourceTag = String(extra.sourceTag || detectedCoordinates.sourceTag || '').trim();
  const registry = String(extra.registry || repo || '').trim().replace(/\/+$/, '');
  const registryHost = String(extra.registryHost || extractRegistryHost(registry)).trim();
  const fullTag = registry ? `${registry}/${imageName}:${imageTag}` : `${imageName}:${imageTag}`;
  const opts = { timeout: 10 * 60 * 1000, stdio: 'pipe', encoding: 'utf8' };

  const loadOutput = execFileSync('docker', ['load', '-i', file.path], opts);
  const { loadedRef, loadedId } = parseDockerLoadOutput(loadOutput);
  const sourceRef = sourceTag || loadedRef || loadedId;

  if (!sourceRef) {
    throw new Error('Docker image was loaded, but the backend could not determine its source tag. Enter the image name and tag before retrying.');
  }

  execFileSync('docker', ['tag', sourceRef, fullTag], opts);

  if (username && registryHost) {
    execFileSync(
      'docker',
      ['login', registryHost, '-u', username, '--password-stdin'],
      { ...opts, input: password || '' }
    );
  }

  execFileSync('docker', ['push', fullTag], opts);

  return {
    path: '',
    fullTag,
    coordinates: {
      imageName,
      imageTag,
      sourceTag: sourceRef,
    },
  };
}

module.exports = { upload };
