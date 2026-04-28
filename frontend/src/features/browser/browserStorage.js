import { getScopedStorageKey } from '../../app/storage';
import { DEFAULT_SORT, MAX_SEARCH_HISTORY, SORT_FIELDS } from './browserState';

const SEARCH_HISTORY_KEY = 'nexus-pusher-browser-search-history';
const BROWSER_UI_KEY = 'nexus-pusher-browser-ui';

function normalizeSortState(sortState = {}) {
  const field = SORT_FIELDS.includes(sortState?.field) ? sortState.field : DEFAULT_SORT.field;
  const direction = sortState?.direction === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

export function loadSearchHistory(settings) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getScopedStorageKey(SEARCH_HISTORY_KEY, settings)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(history, settings) {
  try {
    localStorage.setItem(
      getScopedStorageKey(SEARCH_HISTORY_KEY, settings),
      JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY))
    );
  } catch (_) {
    // ignore storage failures
  }
}

export function loadBrowserUiPrefs(settings) {
  try {
    const stored = JSON.parse(localStorage.getItem(getScopedStorageKey(BROWSER_UI_KEY, settings)) || '{}');
    return {
      filtersOpen: stored?.filtersOpen ?? stored?.advancedFiltersOpen !== false,
      localFiltersOpen: stored?.localFiltersOpen === true,
      sortState: normalizeSortState(stored?.sortState),
    };
  } catch {
    return {
      filtersOpen: true,
      localFiltersOpen: false,
      sortState: DEFAULT_SORT,
    };
  }
}

export function saveBrowserUiPrefs(prefs, settings) {
  try {
    localStorage.setItem(getScopedStorageKey(BROWSER_UI_KEY, settings), JSON.stringify({
      filtersOpen: prefs?.filtersOpen !== false,
      localFiltersOpen: prefs?.localFiltersOpen === true,
      sortState: normalizeSortState(prefs?.sortState),
    }));
  } catch (_) {
    // ignore storage failures
  }
}
