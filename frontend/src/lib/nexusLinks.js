function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
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

export function buildNexusBrowseUrl(settings, repo, path = '') {
  const base = getNexusBrowserBaseUrl(settings);
  if (!base || !repo) return '';
  return `${base}/#browse/browse:${repo}${path ? `:${encodeURIComponent(path)}` : ''}`;
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
    browseUrl: buildNexusBrowseUrl(settings, asset.repository, asset.path),
  };
}
