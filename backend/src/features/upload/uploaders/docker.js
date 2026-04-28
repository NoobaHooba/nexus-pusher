const { execFileSync, spawnSync } = require('child_process');
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

function canExecute(binary) {
  const probe = spawnSync(binary, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 10 * 1000,
  });

  if (probe.error) {
    return false;
  }

  return probe.status === 0;
}

function resolveContainerCli() {
  const configured = String(process.env.DOCKER_BIN || process.env.CONTAINER_CLI || '').trim();
  const candidates = configured ? [configured] : ['docker', 'podman'];
  const cli = candidates.find(canExecute);

  if (!cli) {
    const detail = configured
      ? `Configured container CLI "${configured}" was not found or is not executable.`
      : 'Neither "docker" nor "podman" is available in the backend PATH.';
    throw new Error(`${detail} Install Docker or Podman on the backend host, or set DOCKER_BIN to an executable container CLI path.`);
  }

  return cli;
}

function runContainerCli(cli, args, options) {
  try {
    return execFileSync(cli, args, options);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Container CLI "${cli}" was not found while handling the Docker upload. Install Docker or Podman on the backend host, or set DOCKER_BIN to a valid executable path.`);
    }
    throw error;
  }
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
  const cli = resolveContainerCli();

  const loadOutput = runContainerCli(cli, ['load', '-i', file.path], opts);
  const { loadedRef, loadedId } = parseDockerLoadOutput(loadOutput);
  const sourceRef = sourceTag || loadedRef || loadedId;

  if (!sourceRef) {
    throw new Error('Docker image was loaded, but the backend could not determine its source tag. Enter the image name and tag before retrying.');
  }

  runContainerCli(cli, ['tag', sourceRef, fullTag], opts);

  if (username && registryHost) {
    runContainerCli(
      cli,
      ['login', registryHost, '-u', username, '--password-stdin'],
      { ...opts, input: password || '' }
    );
  }

  runContainerCli(cli, ['push', fullTag], opts);

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
