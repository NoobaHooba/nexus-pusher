import { getScopedStorageKey } from '../../app/storage';

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

export function loadUploadPrefs(settings) {
  return loadUploadJson(getScopedStorageKey(PREFS_KEY, settings), getDefaultUploadPrefs());
}

export function saveUploadPrefs(prefs, settings) {
  saveUploadJson(getScopedStorageKey(PREFS_KEY, settings), prefs);
}

export function saveUploadHistory(item, maxEntries, settings) {
  const storageKey = getScopedStorageKey(HISTORY_KEY, settings);
  const existing = loadUploadJson(storageKey, []);
  saveUploadJson(storageKey, [extractSummary(item), ...existing].slice(0, maxEntries));
}
