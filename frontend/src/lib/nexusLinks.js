function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
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
  const browsePath = normalizeBrowsePath(path, meta);
  return `${base}/#browse/browse:${repo}${browsePath ? `:${encodeURIComponent(browsePath)}` : ''}`;
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
    browseUrl: buildNexusBrowseUrl(settings, asset.repository, asset.path, asset),
  };
}
