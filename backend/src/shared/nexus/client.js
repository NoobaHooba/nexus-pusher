function normalizeBaseUrl(nexusUrl) {
  return String(nexusUrl || '').replace(/\/$/, '');
}

function makeHeaders(username, password, extraHeaders = {}) {
  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };

  if (username) {
    const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

async function nexusJson(nexusUrl, path, { username, password, params, signal, headers } = {}) {
  const base = normalizeBaseUrl(nexusUrl);
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`${base}${path}${qs}`, {
    headers: makeHeaders(username, password, headers),
    signal,
  });

  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }

  return res.json();
}

async function fetchRepositories({ nexusUrl, username, password, signal } = {}) {
  const repos = await nexusJson(nexusUrl, '/service/rest/v1/repositories', {
    username,
    password,
    signal,
  });

  return Array.isArray(repos)
    ? repos.map((repo) => ({
        name: repo.name,
        format: repo.format,
        type: repo.type,
        url: repo.url || '',
        online: repo.online !== false,
      }))
    : [];
}

async function searchComponents({ nexusUrl, username, password, query, signal } = {}) {
  return nexusJson(nexusUrl, '/service/rest/v1/search', {
    username,
    password,
    params: query,
    signal,
  });
}

async function searchAssets({ nexusUrl, username, password, query, signal } = {}) {
  return nexusJson(nexusUrl, '/service/rest/v1/search/assets', {
    username,
    password,
    params: query,
    signal,
  });
}

async function checkAssetUrlExists({ url, username, password, signal } = {}) {
  const headers = makeHeaders(username, password);

  for (const method of ['HEAD', 'GET']) {
    const res = await fetch(url, { method, headers, signal });
    if (res.status === 404) return false;
    if (res.ok) return true;
    if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    }
  }

  return false;
}

module.exports = {
  normalizeBaseUrl,
  makeHeaders,
  nexusJson,
  fetchRepositories,
  searchComponents,
  searchAssets,
  checkAssetUrlExists,
};
