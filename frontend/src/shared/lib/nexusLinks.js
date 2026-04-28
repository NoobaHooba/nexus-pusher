function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getFileName(path = '') {
  const normalized = String(path || '').replace(/^\/+/, '');
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function normalizeBrowsePath(path = '', meta = {}) {
  const rawPath = String(path || '');
  const trimmedPath = rawPath.replace(/^\/+/, '');
  const format = String(meta.format || meta.type || '').toLowerCase();
  const name = meta.name || meta.package_name || meta.packageName || meta.artifact_id || meta.artifactId || meta.chartName || '';
  const version = meta.version || '';

  if (!trimmedPath) return '';
  if (trimmedPath.includes('/')) return trimmedPath;

  if (name && version && ['helm', 'pypi', 'nuget'].includes(format)) {
    return `${name}/${version}/${trimmedPath}`;
  }

  return trimmedPath;
}

function buildFormatAwareBrowsePath(path = '', meta = {}) {
  const format = String(meta.format || meta.type || '').toLowerCase();
  const name = meta.name || meta.package_name || meta.packageName || meta.artifact_id || meta.artifactId || meta.chartName || '';
  const version = meta.version || '';
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  const fileName = getFileName(normalizedPath);

  if (format === 'npm') {
    if (normalizedPath.includes('/-/')) {
      return normalizedPath.replace('/-/', '/');
    }
    if (name) {
      return String(name).replace(/^\/+/, '');
    }
  }

  if (format === 'docker') {
    const manifestMatch = normalizedPath.match(/^(v2\/.+)\/manifests\/([^/]+)$/);
    if (manifestMatch) {
      return `${manifestMatch[1]}/tags/${manifestMatch[2]}`;
    }
    return normalizedPath;
  }

  if (format === 'helm') {
    if (name && version && fileName) {
      return `${name}/${version}/${fileName}`;
    }
    return normalizedPath;
  }

  if (format === 'nuget') {
    if (name && version && fileName) {
      return `${name}/${version}/${fileName}`;
    }
    if (name && version) {
      return `${name}/${version}`;
    }
    return normalizedPath;
  }

  if (format === 'pypi') {
    if (name && version && fileName) {
      return `${name}/${version}/${fileName}`;
    }
    return normalizedPath;
  }

  if (format === 'yum') {
    return fileName || normalizedPath;
  }

  if (format === 'apt') {
    return '';
  }

  return normalizeBrowsePath(path, meta);
}

export function getNexusBrowserBaseUrl(settings) {
  const explicit = trimTrailingSlash(settings?.nexusBrowserUrl || '');
  if (explicit) return explicit;

  const configured = trimTrailingSlash(settings?.nexusUrl || '');
  if (!configured) return '';

  try {
    const url = new URL(configured);
    if (typeof window !== 'undefined' && (url.hostname === 'nexus' || url.hostname === 'nexus-backend')) {
      const browserHost = window.location.hostname || 'localhost';
      const browserPort = url.port || '8081';
      return `${url.protocol}//${browserHost}:${browserPort}`;
    }
  } catch (_) {
    return configured;
  }

  return configured;
}

export function buildNexusBrowseUrl(settings, repo, path = '', meta = {}) {
  const base = getNexusBrowserBaseUrl(settings);
  if (!base || !repo) return '';
  const browsePath = buildFormatAwareBrowsePath(path, meta);
  const normalizedBrowsePath = browsePath ? String(browsePath).replace(/^\/+/, '') : '';
  const finalBrowsePath = normalizedBrowsePath ? encodeURIComponent(normalizedBrowsePath) : '';
  return `${base}/#browse/browse:${repo}${finalBrowsePath ? `:${finalBrowsePath}` : ''}`;
}

export function resolveNexusEntryUrl(settings, repo, path = '', meta = {}, rawUrl = '') {
  return buildNexusBrowseUrl(settings, repo, path, meta) || rewriteNexusUrl(settings, rawUrl);
}

export function rewriteNexusUrl(settings, rawUrl) {
  if (!rawUrl) return rawUrl;

  const browserBase = getNexusBrowserBaseUrl(settings);
  if (!browserBase) return rawUrl;

  try {
    const raw = new URL(rawUrl);
    const base = new URL(browserBase);
    return `${base.origin}${raw.pathname}${raw.search}${raw.hash}`;
  } catch (_) {
    return rawUrl;
  }
}

export function rewriteNexusAssetUrls(settings, asset) {
  if (!asset || typeof asset !== 'object') return asset;
  return {
    ...asset,
    downloadUrl: rewriteNexusUrl(settings, asset.downloadUrl),
    nexusUiUrl: rewriteNexusUrl(settings, asset.nexusUiUrl),
    browseUrl: resolveNexusEntryUrl(settings, asset.repository, asset.path, asset, asset.nexusUiUrl),
  };
}
