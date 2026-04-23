/**
 * nexusApi.js
 *
 * All Nexus requests go through the Express backend.
 * By default we use plain relative /api paths. When the frontend is served
 * from an external nginx with no proxying, settings.backendUrl (or
 * VITE_BACKEND_URL at build time) can point directly to the backend route.
 */
import { apiUrl } from './backendApi';

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
export function uploadDocker({ nexusUrl, repo, settings }) {
  const registry = repo ? `${repo}` : (settings?.dockerRegistry || 'your Nexus Docker registry');
  return Promise.reject(new Error(
    `Docker images are pushed with the Docker CLI to ${registry}. Use docker login, docker tag, and docker push against your Nexus registry.`
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
  yum:    uploadYum,
  apt:    uploadApt,
  helm:   uploadHelm,
  raw:    uploadRaw,
};

/**
 * checkDuplicate — asks the backend to search Nexus for an existing component
 * with the same filename in the target repo before uploading.
 *
 * @param {object} opts
 * @param {string} opts.nexusUrl
 * @param {string} opts.username
 * @param {string} opts.password
 * @param {string} opts.repo       — repository name
 * @param {string} opts.name       — artifact name / filename to search for
 * @param {string} [opts.version]  — optional version string
 * @returns {Promise<{ exists: boolean, components: Array, warning?: string }>}
 */
export async function checkDuplicate({ nexusUrl, username, password, repo, name, version, type, path, settings }) {
  try {
    const res = await fetch(apiUrl(settings, '/api/check-duplicate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nexusUrl, username, password, repo, name, version, type, path }),
    });
    if (!res.ok) return { exists: false, components: [] };
    return await res.json();
  } catch (_) {
    // Never block an upload because the duplicate check failed
    return { exists: false, components: [] };
  }
}
