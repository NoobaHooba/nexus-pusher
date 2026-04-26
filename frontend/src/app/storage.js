const SETTINGS_KEY = 'nexus-pusher-settings';
const REPO_NAMES_KEY = 'nexus-pusher-repo-names';
const USER_UI_PREFS_KEY = 'nexus-pusher-user-ui-prefs';
const THEME_KEY = 'nexus-pusher-theme';
const APP_UI_KEY = 'nexus-pusher-app-ui';

export const VALID_PAGES = ['upload', 'browser', 'history', 'ldap'];
export const DEFAULT_REPO = 'npm';

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // ignore storage failures
  }
}

function normalizeScopeValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function getSettingsStorageScope(settings = {}) {
  const normalizedUrl = normalizeScopeValue(settings?.nexusUrl)
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const normalizedUser = normalizeScopeValue(settings?.username) || 'anonymous';
  return `${normalizedUser}@${normalizedUrl || 'local'}`;
}

export function getScopedStorageKey(key, settings) {
  return `${key}:${getSettingsStorageScope(settings)}`;
}

export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {
    // ignore storage failures
  }
}

export function getInitialAppUi(validRepoIds = []) {
  const stored = loadJson(APP_UI_KEY, {});
  return {
    activePage: VALID_PAGES.includes(stored?.activePage) ? stored.activePage : 'upload',
    activeRepo: validRepoIds.includes(stored?.activeRepo) ? stored.activeRepo : DEFAULT_REPO,
  };
}

export function saveAppUi(state) {
  saveJson(APP_UI_KEY, state);
}

export function loadLoginSettings() {
  return loadJson(SETTINGS_KEY, { username: '', password: '' });
}

export function saveLoginSettings(settings) {
  saveJson(SETTINGS_KEY, settings);
}

export function clearLoginSettings() {
  saveJson(SETTINGS_KEY, { username: '', password: '' });
}

export function loadRepoNames() {
  return loadJson(REPO_NAMES_KEY, {});
}

export function loadScopedRepoNames(settings) {
  return loadJson(getScopedStorageKey(REPO_NAMES_KEY, settings), {});
}

export function saveScopedRepoNames(repoNames, settings) {
  saveJson(getScopedStorageKey(REPO_NAMES_KEY, settings), repoNames);
}

export function getDefaultScopedUserUiPrefs() {
  return {
    denseMode: false,
  };
}

export function normalizeScopedUserUiPrefs(stored = {}) {
  return {
    denseMode: stored?.denseMode === true,
  };
}

export function loadScopedUserUiPrefs(settings) {
  return normalizeScopedUserUiPrefs(
    loadJson(getScopedStorageKey(USER_UI_PREFS_KEY, settings), getDefaultScopedUserUiPrefs())
  );
}

export function saveScopedUserUiPrefs(prefs, settings) {
  saveJson(
    getScopedStorageKey(USER_UI_PREFS_KEY, settings),
    normalizeScopedUserUiPrefs(prefs)
  );
}
