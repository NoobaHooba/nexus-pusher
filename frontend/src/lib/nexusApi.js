/**
 * nexusApi.js
 * Calls nginx (which proxies to Nexus) using the REST API v1 components endpoint.
 * Endpoint: POST /service/rest/v1/components?repository=<repo>
 */

const BASE = (nexusUrl) => `${nexusUrl.replace(/\/$/, '')}/service/rest/v1/components`;

/**
 * UTF-8 safe base64 encode for Basic Auth.
 * Plain btoa() throws on passwords that contain non-ASCII characters.
 */
function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Core upload via XHR (fetch has no upload progress API).
 *
 * withCredentials is intentionally NOT set. The nginx proxy uses
 * Access-Control-Allow-Origin: * (no Allow-Credentials), so the browser
 * never caches a Basic Auth session for this origin. The Authorization
 * header set below is always the only one Nexus sees.
 */
async function nexusUpload({ nexusUrl, repo, username, password, formData, onProgress }) {
  const url = `${BASE(nexusUrl)}?repository=${encodeURIComponent(repo)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    if (username) {
      xhr.setRequestHeader('Authorization', 'Basic ' + toBase64(`${username}:${password || ''}`));
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

    xhr.onerror = () => reject(new Error(
      'Network error — cannot reach the proxy. Check the nginx URL in Settings and that the container is running.'
    ));
    xhr.ontimeout = () => reject(new Error('Request timed out'));
    xhr.timeout = 0;

    xhr.send(formData);
  });
}

function parseNexusError(xhr) {
  const { status } = xhr;
  if (status === 401) return 'Authentication failed — check username/password in Settings';
  if (status === 403) return 'Permission denied — user does not have deploy rights on this repository';
  if (status === 404) return 'Repository not found — check the repository name';
  if (status === 0)   return 'No response — nginx proxy may be unreachable or CORS is misconfigured';

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
