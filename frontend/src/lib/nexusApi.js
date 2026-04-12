/**
 * nexusApi.js
 *
 * All Nexus requests go through the Express backend at localhost:3001.
 * The backend uses axios with a proper Authorization header server-side —
 * no CORS, no base64 encoding tricks, no nginx proxy needed.
 */

const BACKEND = 'http://localhost:3001';

/**
 * Upload a file via the backend.
 * The backend route is POST /api/upload/:type
 * It accepts multipart/form-data with:
 *   - files[]      — the file(s)
 *   - nexusUrl     — Nexus base URL (e.g. http://nexus:8081)
 *   - repo         — repository name
 *   - username     — Nexus username
 *   - password     — Nexus password
 *   - ...extra     — type-specific fields (groupId, artifactId, etc.)
 */
async function backendUpload({ type, nexusUrl, repo, username, password, file, extra, onProgress }) {
  const fd = new FormData();
  fd.append('files', file, file.name);
  fd.append('nexusUrl', nexusUrl || '');
  fd.append('repo', repo || '');
  fd.append('username', username || '');
  fd.append('password', password || '');
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND}/api/upload/${type}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch (_) { body = {}; }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject(new Error(body.error || `Backend returned HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error(
      'Cannot reach the backend — is the backend container running on port 3001?'
    ));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 0;
    xhr.send(fd);
  });
}

export function uploadMaven({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  return backendUpload({ type: 'maven', nexusUrl, repo, username, password, file, extra, onProgress });
}

export function uploadNpm({ nexusUrl, repo, username, password, file, onProgress }) {
  return backendUpload({ type: 'npm', nexusUrl, repo, username, password, file, extra: {}, onProgress });
}

export function uploadNuget({ nexusUrl, repo, username, password, file, onProgress }) {
  return backendUpload({ type: 'nuget', nexusUrl, repo, username, password, file, extra: {}, onProgress });
}

export function uploadPypi({ nexusUrl, repo, username, password, file, onProgress }) {
  return backendUpload({ type: 'pypi', nexusUrl, repo, username, password, file, extra: {}, onProgress });
}

export function uploadDocker() {
  return Promise.reject(new Error(
    'Docker images cannot be uploaded via the browser API. ' +
    'Use: docker tag <image> <nexus-host>:<port>/<name>:<tag> && docker push <nexus-host>:<port>/<name>:<tag>'
  ));
}

export function uploadYum({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  return backendUpload({ type: 'yum', nexusUrl, repo, username, password, file, extra, onProgress });
}

export function uploadApt({ nexusUrl, repo, username, password, file, onProgress }) {
  return backendUpload({ type: 'apt', nexusUrl, repo, username, password, file, extra: {}, onProgress });
}

export function uploadHelm({ nexusUrl, repo, username, password, file, onProgress }) {
  return backendUpload({ type: 'helm', nexusUrl, repo, username, password, file, extra: {}, onProgress });
}

export function uploadRaw({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  return backendUpload({ type: 'raw', nexusUrl, repo, username, password, file, extra, onProgress });
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
