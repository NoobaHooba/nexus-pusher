/**
 * nexusApi.js
 * Calls the Nexus Repository Manager REST API v1 directly from the browser.
 * Endpoint: POST /service/rest/v1/components?repository=<repo>
 *
 * All formats use multipart/form-data with format-specific field names
 * as documented at:
 * https://help.sonatype.com/repomanager3/integrations/rest-and-integration-api/components-api
 *
 * CORS: Nexus must have "Allow CORS" enabled.
 * Admin UI → System → Capabilities → Create → CORS → set Allowed Origins to * or your frontend URL.
 */

const BASE = (nexusUrl) => `${nexusUrl.replace(/\/$/, '')}/service/rest/v1/components`;

/**
 * Core upload function using XHR (fetch does not support upload progress events).
 * Throws with a human-readable message on any non-2xx response.
 */
async function nexusUpload({ nexusUrl, repo, username, password, formData, onProgress }) {
  const url = `${BASE(nexusUrl)}?repository=${encodeURIComponent(repo)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    if (username) {
      xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${username}:${password}`));
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status, statusText: xhr.statusText });
      } else {
        reject(new Error(parseNexusError(xhr)));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — cannot reach Nexus. Check the URL and that CORS is enabled.'));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 0; // no timeout for large files

    xhr.send(formData);
  });
}

function parseNexusError(xhr) {
  const { status } = xhr;
  if (status === 401) return 'Authentication failed — check username/password in Settings';
  if (status === 403) return 'Permission denied — user does not have deploy rights on this repository';
  if (status === 404) return 'Repository not found — check the repository name';
  if (status === 0)   return 'No response — Nexus may be unreachable or CORS is not enabled';

  const body = xhr.responseText || '';
  try {
    const json = JSON.parse(body);
    if (json.message) return `Nexus: ${json.message}`;
    if (Array.isArray(json.errors)) return `Nexus: ${json.errors.map(e => e.message).join('; ')}`;
  } catch (_) {}
  const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return `Nexus: ${titleMatch[1].trim()}`;
  return `Nexus returned HTTP ${status}`;
}

// ---------------------------------------------------------------------------
// Format-specific uploaders
// Field names are exactly what the Nexus REST API v1 expects per format.
// ---------------------------------------------------------------------------

export async function uploadMaven({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  const { groupId, artifactId, version, extension } = extra;
  if (!groupId || !artifactId || !version) throw new Error('Maven requires groupId, artifactId, and version');
  const ext = extension || file.name.split('.').pop() || 'jar';

  const fd = new FormData();
  fd.append('maven2.groupId', groupId);
  fd.append('maven2.artifactId', artifactId);
  fd.append('maven2.version', version);
  fd.append('maven2.asset1', file, file.name);
  fd.append('maven2.asset1.extension', ext);

  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadNpm({ nexusUrl, repo, username, password, file, onProgress }) {
  const fd = new FormData();
  fd.append('npm.asset', file, file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadNuget({ nexusUrl, repo, username, password, file, onProgress }) {
  const fd = new FormData();
  fd.append('nuget.asset', file, file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadPypi({ nexusUrl, repo, username, password, file, onProgress }) {
  const fd = new FormData();
  fd.append('pypi.asset', file, file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

/**
 * Docker images cannot be uploaded via the browser REST API.
 * They must be pushed using the Docker registry protocol.
 */
export async function uploadDocker() {
  throw new Error(
    'Docker images cannot be uploaded via the browser API. ' +
    'Use: docker tag <image> <nexus-host>:<port>/<name>:<tag> && docker push <nexus-host>:<port>/<name>:<tag>'
  );
}

export async function uploadYum({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  const fd = new FormData();
  fd.append('yum.asset', file, file.name);
  if (extra.directory) fd.append('yum.directory', extra.directory);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadApt({ nexusUrl, repo, username, password, file, onProgress }) {
  const fd = new FormData();
  fd.append('apt.asset', file, file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadHelm({ nexusUrl, repo, username, password, file, onProgress }) {
  const fd = new FormData();
  fd.append('helm.asset', file, file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
}

export async function uploadRaw({ nexusUrl, repo, username, password, file, extra, onProgress }) {
  const directory = extra.directory || '/';
  const fd = new FormData();
  fd.append('raw.directory', directory);
  fd.append('raw.asset1', file, file.name);
  fd.append('raw.asset1.filename', file.name);
  return nexusUpload({ nexusUrl, repo, username, password, formData: fd, onProgress });
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
