import { apiUrl } from './backendApi';

function stripProtocol(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function trimBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildDockerRegistryTarget({ nexusUrl, repo, settings }) {
  const selectedRepo = String(repo || '').trim().replace(/^\/+|\/+$/g, '');
  const browserHost = stripProtocol(settings?.nexusBrowserUrl || nexusUrl || '');
  const configuredRegistry = stripProtocol(settings?.dockerRegistry || '');
  const registryPrefix = configuredRegistry || (browserHost ? `${browserHost}/repository` : '');
  const normalizedPrefix = registryPrefix.replace(/\/+$/, '');
  const prefixAlreadyIncludesRepo = selectedRepo && normalizedPrefix.endsWith(`/${selectedRepo}`);
  const registry = selectedRepo && !prefixAlreadyIncludesRepo
    ? `${normalizedPrefix}/${selectedRepo}`
    : normalizedPrefix;
  const registryHost = (configuredRegistry || browserHost).split('/')[0] || '';

  return { registry, registryHost };
}

function buildRepositoryTarget({ nexusUrl, repo, settings }) {
  const selectedRepo = String(repo || '').trim().replace(/^\/+|\/+$/g, '') || '<repository>';
  const baseUrl = trimBaseUrl(settings?.nexusBrowserUrl || nexusUrl || 'https://nexus.example.com');
  return {
    selectedRepo,
    repositoryUrl: `${baseUrl}/repository/${selectedRepo}/`,
  };
}

export async function fetchRepositories({ nexusUrl, username, password, settings }) {
  const res = await fetch(apiUrl(settings, '/api/browse/repos'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nexusUrl, username, password }),
  });

  const json = await res.json().catch(() => []);
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return Array.isArray(json) ? json : [];
}

export async function runPreflight({ type, nexusUrl, repo, username, password, file, extra = {}, settings, preferences, defaultRepo }) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('nexusUrl', nexusUrl || '');
  fd.append('repo', repo || '');
  fd.append('username', username || '');
  fd.append('password', password || '');
  fd.append('defaultRepo', defaultRepo || '');
  if (preferences) fd.append('preferences', JSON.stringify(preferences));
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) fd.append(key, value);
  });

  const res = await fetch(apiUrl(settings, `/api/preflight/${type}`), {
    method: 'POST',
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function backendUpload({ type, nexusUrl, repo, username, password, file, extra, onProgress, settings }) {
  const fd = new FormData();
  fd.append('files', file, file.name);
  fd.append('nexusUrl', nexusUrl || '');
  fd.append('repo', repo || '');
  fd.append('username', username || '');
  fd.append('password', password || '');
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, v);
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(settings, `/api/upload/${type}`));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch (_) { body = {}; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body?.results?.[0] || body);
      } else {
        reject(new Error(body.error || `Backend returned HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error(
      'Cannot reach the backend — is the backend container running?'
    ));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 0;
    xhr.send(fd);
  });
}

export function uploadMaven({ nexusUrl, repo, username, password, file, extra, onProgress, settings }) {
  return backendUpload({ type: 'maven', nexusUrl, repo, username, password, file, extra, onProgress, settings });
}
export function uploadNpm({ nexusUrl, repo, username, password, file, onProgress, settings }) {
  return backendUpload({ type: 'npm', nexusUrl, repo, username, password, file, extra: {}, onProgress, settings });
}
export function uploadNuget({ nexusUrl, repo, username, password, file, onProgress, settings }) {
  return backendUpload({ type: 'nuget', nexusUrl, repo, username, password, file, extra: {}, onProgress, settings });
}
export function uploadPypi({ nexusUrl, repo, username, password, file, onProgress, settings }) {
  return backendUpload({ type: 'pypi', nexusUrl, repo, username, password, file, extra: {}, onProgress, settings });
}
export function uploadDocker({ nexusUrl, repo, username, password, file, extra, onProgress, settings }) {
  const { registry, registryHost } = buildDockerRegistryTarget({ nexusUrl, repo, settings });
  return backendUpload({
    type: 'docker',
    nexusUrl,
    repo,
    username,
    password,
    file,
    extra: {
      ...(extra || {}),
      registry,
      registryHost,
    },
    onProgress,
    settings,
  });
}
export function uploadCargo({ nexusUrl, repo, settings }) {
  const { selectedRepo, repositoryUrl } = buildRepositoryTarget({ nexusUrl, repo, settings });
  return Promise.reject(new Error(
    `Cargo repositories must be published with the Cargo client. Configure ${selectedRepo} with index = "sparse+${repositoryUrl}" and run cargo publish --registry ${selectedRepo}.`
  ));
}
export function uploadConan({ nexusUrl, repo, settings }) {
  const { selectedRepo, repositoryUrl } = buildRepositoryTarget({ nexusUrl, repo, settings });
  return Promise.reject(new Error(
    `Conan repositories must be uploaded with the Conan client. Add remote ${selectedRepo} at ${repositoryUrl} and run conan upload against that remote.`
  ));
}
export function uploadYum({ nexusUrl, repo, username, password, file, extra, onProgress, settings }) {
  return backendUpload({ type: 'yum', nexusUrl, repo, username, password, file, extra, onProgress, settings });
}
export function uploadApt({ nexusUrl, repo, username, password, file, onProgress, settings }) {
  return backendUpload({ type: 'apt', nexusUrl, repo, username, password, file, extra: {}, onProgress, settings });
}
export function uploadHelm({ nexusUrl, repo, username, password, file, onProgress, settings }) {
  return backendUpload({ type: 'helm', nexusUrl, repo, username, password, file, extra: {}, onProgress, settings });
}
export function uploadRaw({ nexusUrl, repo, username, password, file, extra, onProgress, settings }) {
  return backendUpload({ type: 'raw', nexusUrl, repo, username, password, file, extra, onProgress, settings });
}

export const UPLOADERS = {
  maven:  uploadMaven,
  npm:    uploadNpm,
  nuget:  uploadNuget,
  pypi:   uploadPypi,
  docker: uploadDocker,
  cargo:  uploadCargo,
  conan:  uploadConan,
  yum:    uploadYum,
  apt:    uploadApt,
  helm:   uploadHelm,
  raw:    uploadRaw,
};
