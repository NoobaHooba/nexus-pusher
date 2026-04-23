import { DEFAULT_SORT, MAX_SEARCH_HISTORY, SORT_FIELDS } from './browserState';

const SEARCH_HISTORY_KEY = 'nexus-pusher-browser-search-history';
const BROWSER_STATE_KEY = 'nexus-pusher-browser-state';

export function loadSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(history) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
  } catch (_) {
    // ignore storage failures
  }
}

export function loadBrowserState() {
  try {
    const stored = JSON.parse(localStorage.getItem(BROWSER_STATE_KEY) || '{}');
    const sortField = SORT_FIELDS.includes(stored?.sortState?.field) ? stored.sortState.field : DEFAULT_SORT.field;
    const sortDirection = stored?.sortState?.direction === 'asc' ? 'asc' : 'desc';
    return {
      selectedRepo: stored?.selectedRepo || '',
      selectedFormat: stored?.selectedFormat || '',
      inputValue: stored?.inputValue || '',
      keyword: stored?.keyword || stored?.inputValue || '',
      sortState: { field: sortField, direction: sortDirection },
    };
  } catch {
    return {
      selectedRepo: '',
      selectedFormat: '',
      inputValue: '',
      keyword: '',
      sortState: DEFAULT_SORT,
    };
  }
}

export function saveBrowserState(state) {
  try {
    localStorage.setItem(BROWSER_STATE_KEY, JSON.stringify(state));
  } catch (_) {
    // ignore storage failures
  }
}
