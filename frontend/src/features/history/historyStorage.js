import { getScopedStorageKey } from '../../app/storage';
import { normalizeHistoryState } from './historyState';

const HISTORY_STATE_KEY = 'nexus-pusher-history-state';

export function loadHistoryState(settings) {
  try {
    return normalizeHistoryState(JSON.parse(localStorage.getItem(getScopedStorageKey(HISTORY_STATE_KEY, settings)) || '{}'));
  } catch {
    return normalizeHistoryState();
  }
}

export function saveHistoryState(state, settings) {
  try {
    localStorage.setItem(getScopedStorageKey(HISTORY_STATE_KEY, settings), JSON.stringify(state));
  } catch (_) {
    // ignore storage failures
  }
}
