export const PAGE_SIZE = 50;
export const ALLOWED_HISTORY_STATUS = ['all', 'success', 'error', 'warning'];
export const ALLOWED_HISTORY_TYPES = ['all', 'maven', 'npm', 'pypi', 'docker', 'cargo', 'conan', 'swift', 'terraform', 'nuget', 'helm', 'yum', 'apt', 'raw'];

export function normalizeHistoryState(stored = {}) {
  return {
    search: stored?.search || '',
    filterStatus: ALLOWED_HISTORY_STATUS.includes(stored?.filterStatus) ? stored.filterStatus : 'all',
    filterType: ALLOWED_HISTORY_TYPES.includes(stored?.filterType) ? stored.filterType : 'all',
    offset: Number.isFinite(Number(stored?.offset)) ? Math.max(0, Number(stored.offset)) : 0,
  };
}
