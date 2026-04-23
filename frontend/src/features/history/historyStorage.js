import { normalizeHistoryState } from './historyState';

const HISTORY_STATE_KEY = 'nexus-pusher-history-state';

export function loadHistoryState() {
  try {
    return normalizeHistoryState(JSON.parse(localStorage.getItem(HISTORY_STATE_KEY) || '{}'));
  } catch {
    return normalizeHistoryState();
  }
}

export function saveHistoryState(state) {
  try {
    localStorage.setItem(HISTORY_STATE_KEY, JSON.stringify(state));
  } catch (_) {
    // ignore storage failures
  }
}
