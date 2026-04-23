const BUILD_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').trim();

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export function getBackendBaseUrl(settings) {
  const configured = (settings?.backendUrl || '').trim();
  if (configured) return trimTrailingSlash(configured);
  if (BUILD_BACKEND_URL) return trimTrailingSlash(BUILD_BACKEND_URL);
  return '';
}

export function apiUrl(settings, path) {
  const base = getBackendBaseUrl(settings);
  return base ? `${base}${path}` : path;
}
