const HISTORY_KEY = 'nexus-pusher-history';
const PREFS_KEY = 'nexus-pusher-user-prefs';

export function loadUploadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
}

export function saveUploadJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // ignore storage pressure
  }
}

export function getDefaultUploadPrefs() {
  return {
    favoritesByFormat: {},
    recentReposByFormat: {},
    lastExtraFieldsByFormat: {},
    recentActivity: [],
    lastDockerRegistry: '',
  };
}

function extractSummary(item) {
  return {
    id: item.id,
    name: item.name,
    size: item.size,
    repoType: item.repoType,
    repoName: item.repoName,
    status: item.status,
    statusText: item.statusText,
    nexusUiUrl: item.nexusUiUrl || null,
    directUrl: item.directUrl || null,
    path: item.path || '',
    coordinates: item.coordinates || {},
    timestamp: Date.now(),
  };
}

export function loadUploadPrefs() {
  return loadUploadJson(PREFS_KEY, getDefaultUploadPrefs());
}

export function saveUploadPrefs(prefs) {
  saveUploadJson(PREFS_KEY, prefs);
}

export function saveUploadHistory(item, maxEntries) {
  const existing = loadUploadJson(HISTORY_KEY, []);
  saveUploadJson(HISTORY_KEY, [extractSummary(item), ...existing].slice(0, maxEntries));
}
