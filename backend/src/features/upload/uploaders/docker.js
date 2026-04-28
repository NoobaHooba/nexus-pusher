const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const tar = require('tar-stream');
const axios = require('axios');
const { detectArtifact } = require('../../../shared/artifacts/metadata');
const { stripKnownExtension } = require('../../../shared/artifacts/paths');

const DOCKER_MANIFEST_MEDIA_TYPE = 'application/vnd.docker.distribution.manifest.v2+json';
const DOCKER_CONFIG_MEDIA_TYPE = 'application/vnd.docker.container.image.v1+json';
const DOCKER_LAYER_MEDIA_TYPE = 'application/vnd.docker.image.rootfs.diff.tar.gzip';

function extractRegistryHost(registry) {
  return String(registry || '').trim().split('/')[0] || '';
}

function parseJson(text, fallbackMessage) {
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(fallbackMessage);
  }
}

function normalizeRegistryUrl(value, nexusUrl) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Docker registry URL is missing for this upload. Configure DOCKER_REGISTRY or choose a Docker repository reachable from the backend.');
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const fallback = String(nexusUrl || '').trim();
  if (/^https?:\/\//i.test(fallback)) {
    return `${new URL(fallback).protocol}//${trimmed}`;
  }

  return `http://${trimmed}`;
}

function normalizeArchiveName(name) {
  return String(name || '').replace(/^\.?\//, '');
}

function encodeRepositoryName(name) {
  return String(name || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function sha256(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function buildRegistryError(response, method, url) {
  const status = response?.status || 0;
  const data = response?.data;
  let message = `Docker registry returned HTTP ${status} for ${method.toUpperCase()} ${url}`;

  if (status === 401) {
    message = 'Docker registry authentication failed — check username/password or repository deploy rights';
  } else if (status === 403) {
    message = 'Docker registry denied the push — user may not have deploy rights on this repository';
  } else if (status === 404) {
    message = 'Docker registry repository path was not found — check DOCKER_REGISTRY or the selected repository configuration';
  } else if (typeof data === 'string' && data.trim()) {
    message = `Docker registry: ${data.trim()}`;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      message = `Docker registry: ${data.errors.map((entry) => entry.message || entry.code || JSON.stringify(entry)).join('; ')}`;
    } else if (data.message) {
      message = `Docker registry: ${data.message}`;
    }
  }

  const error = new Error(message);
  error.status = status;
  return error;
}

async function registryRequest(client, config, { allowStatuses = [] } = {}) {
  const response = await client({
    ...config,
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if ((response.status >= 200 && response.status < 300) || allowStatuses.includes(response.status)) {
    return response;
  }

  throw buildRegistryError(response, config.method || 'get', config.url);
}

async function readArchiveTextEntry(filePath, originalName, predicate) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const extract = tar.extract();
    const input = fs.createReadStream(filePath);
    const gunzip = /\.(?:tar\.gz|tgz)$/i.test(String(originalName || '')) ? zlib.createGunzip() : null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    extract.on('entry', (header, stream, next) => {
      const matches = predicate(normalizeArchiveName(header.name));
      if (!matches || settled) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', fail);
      stream.on('end', () => {
        finish(Buffer.concat(chunks).toString('utf8'));
        next();
      });
    });
    extract.on('finish', () => finish(null));
    extract.on('error', fail);
    input.on('error', fail);
    if (gunzip) gunzip.on('error', fail);

    if (gunzip) input.pipe(gunzip).pipe(extract);
    else input.pipe(extract);
  });
}

async function processArchiveEntries(filePath, originalName, predicate, onMatch) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const extract = tar.extract();
    const input = fs.createReadStream(filePath);
    const gunzip = /\.(?:tar\.gz|tgz)$/i.test(String(originalName || '')) ? zlib.createGunzip() : null;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
      input.destroy(error);
      if (gunzip) gunzip.destroy(error);
      extract.destroy(error);
    };

    extract.on('entry', (header, stream, next) => {
      const entryName = normalizeArchiveName(header.name);
      if (!predicate(entryName) || settled) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', fail);
      stream.on('end', async () => {
        if (settled) return;
        try {
          await onMatch(entryName, Buffer.concat(chunks), header);
          next();
        } catch (error) {
          fail(error);
        }
      });
    });
    extract.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    extract.on('error', fail);
    input.on('error', fail);
    if (gunzip) gunzip.on('error', fail);

    if (gunzip) input.pipe(gunzip).pipe(extract);
    else input.pipe(extract);
  });
}

async function readDockerArchiveManifest(file) {
  const manifestText = await readArchiveTextEntry(
    file.path,
    file.originalname,
    (entryName) => /(^|\/)manifest\.json$/i.test(entryName)
  );

  if (!manifestText) {
    throw new Error('Could not find manifest.json in the Docker archive. Enter the image name and tag before uploading.');
  }

  const manifest = parseJson(manifestText, 'Docker archive manifest.json is not valid JSON');
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('Docker archive manifest.json does not contain any images');
  }

  return manifest;
}

function selectImageEntry(manifest, sourceTag) {
  const normalizedSourceTag = String(sourceTag || '').trim();
  if (normalizedSourceTag) {
    const matching = manifest.find((entry) => Array.isArray(entry?.RepoTags) && entry.RepoTags.includes(normalizedSourceTag));
    if (matching) return matching;
  }

  return manifest.find((entry) => Array.isArray(entry?.RepoTags) && entry.RepoTags.length > 0) || manifest[0];
}

async function blobExists(client, repositoryName, digest) {
  const repositoryPath = encodeRepositoryName(repositoryName);
  const response = await registryRequest(client, {
    method: 'head',
    url: `/v2/${repositoryPath}/blobs/${encodeURIComponent(digest)}`,
  }, { allowStatuses: [404] });
  return response.status === 200;
}

function resolveUploadLocation(baseUrl, location) {
  if (!location) {
    throw new Error('Docker registry did not return an upload location');
  }
  return new URL(location, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

async function uploadBlob(client, baseUrl, repositoryName, buffer) {
  const digest = sha256(buffer);
  const size = buffer.length;

  if (await blobExists(client, repositoryName, digest)) {
    return { digest, size };
  }

  const repositoryPath = encodeRepositoryName(repositoryName);
  const start = await registryRequest(client, {
    method: 'post',
    url: `/v2/${repositoryPath}/blobs/uploads/`,
    headers: {
      'Content-Length': '0',
    },
  });

  const uploadUrl = resolveUploadLocation(baseUrl, start.headers.location);
  const finishUrl = new URL(uploadUrl);
  finishUrl.searchParams.set('digest', digest);

  await registryRequest(client, {
    method: 'put',
    url: finishUrl.toString(),
    data: buffer,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(size),
    },
  });

  return { digest, size };
}

async function upload({ file, nexusUrl, repo, username, password, extra = {} }) {
  const detectedResult = await detectArtifact('docker', file, extra);
  const detectedCoordinates = detectedResult?.detected?.coordinates || {};
  const imageName = String(extra.imageName || detectedCoordinates.imageName || stripKnownExtension(file.originalname)).trim();
  const imageTag = String(extra.imageTag || detectedCoordinates.imageTag || 'latest').trim();
  const sourceTag = String(extra.sourceTag || detectedCoordinates.sourceTag || '').trim();
  const registryReference = String(extra.registry || repo || '').trim().replace(/\/+$/, '');
  const registryUrl = normalizeRegistryUrl(String(extra.registryUrl || extra.registry || '').trim(), nexusUrl);
  const fullTag = registryReference ? `${registryReference}/${imageName}:${imageTag}` : `${imageName}:${imageTag}`;

  if (!imageName || !imageTag) {
    throw new Error('Docker upload requires an image name and tag');
  }

  const manifestEntries = await readDockerArchiveManifest(file);
  const imageEntry = selectImageEntry(manifestEntries, sourceTag);
  const configPath = normalizeArchiveName(imageEntry?.Config || '');
  const layerPaths = Array.isArray(imageEntry?.Layers)
    ? imageEntry.Layers.map((entry) => normalizeArchiveName(entry)).filter(Boolean)
    : [];

  if (!configPath || layerPaths.length === 0) {
    throw new Error('Docker archive is missing config or layer entries required for push');
  }

  const client = axios.create({
    baseURL: registryUrl,
    auth: username ? { username, password: password || '' } : undefined,
    responseType: 'json',
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const wantedEntries = new Set([configPath, ...layerPaths]);
  const uploadedEntries = new Set();
  let configDescriptor = null;
  const layerDescriptors = new Map();

  await processArchiveEntries(
    file.path,
    file.originalname,
    (entryName) => wantedEntries.has(entryName),
    async (entryName, entryBuffer) => {
      uploadedEntries.add(entryName);

      if (entryName === configPath) {
        const parsedConfig = parseJson(entryBuffer.toString('utf8'), 'Docker config JSON is not valid');
        if (!parsedConfig || typeof parsedConfig !== 'object') {
          throw new Error('Docker config JSON is invalid');
        }

        const uploaded = await uploadBlob(client, registryUrl, imageName, entryBuffer);
        configDescriptor = {
          mediaType: DOCKER_CONFIG_MEDIA_TYPE,
          size: uploaded.size,
          digest: uploaded.digest,
        };
        return;
      }

      if (!layerPaths.includes(entryName)) return;

      const gzippedLayer = zlib.gzipSync(entryBuffer);
      const uploaded = await uploadBlob(client, registryUrl, imageName, gzippedLayer);
      layerDescriptors.set(entryName, {
        mediaType: DOCKER_LAYER_MEDIA_TYPE,
        size: uploaded.size,
        digest: uploaded.digest,
      });
    }
  );

  const missingEntries = [...wantedEntries].filter((entryName) => !uploadedEntries.has(entryName));
  if (missingEntries.length > 0) {
    throw new Error(`Docker archive is missing expected entries: ${missingEntries.join(', ')}`);
  }
  if (!configDescriptor) {
    throw new Error('Docker archive config could not be uploaded');
  }

  const manifestPayload = {
    schemaVersion: 2,
    mediaType: DOCKER_MANIFEST_MEDIA_TYPE,
    config: configDescriptor,
    layers: layerPaths.map((layerPath) => {
      const descriptor = layerDescriptors.get(layerPath);
      if (!descriptor) {
        throw new Error(`Docker archive layer could not be uploaded: ${layerPath}`);
      }
      return descriptor;
    }),
  };

  await registryRequest(client, {
    method: 'put',
    url: `/v2/${encodeRepositoryName(imageName)}/manifests/${encodeURIComponent(imageTag)}`,
    data: Buffer.from(JSON.stringify(manifestPayload)),
    headers: {
      'Content-Type': DOCKER_MANIFEST_MEDIA_TYPE,
    },
  });

  return {
    path: '',
    fullTag,
    coordinates: {
      imageName,
      imageTag,
      sourceTag: sourceTag || `${imageName}:${imageTag}`,
    },
  };
}

module.exports = { upload, extractRegistryHost };
