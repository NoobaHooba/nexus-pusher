export const MAX_SEARCH_HISTORY = 6;
export const MAX_SUGGESTIONS = 8;
export const DEFAULT_SORT = { field: 'lastModified', direction: 'desc' };
export const SORT_FIELDS = ['asset', 'repository', 'format', 'size', 'lastModified'];

export function rememberSearchTerm(currentHistory, term) {
  const normalized = String(term || '').trim();
  if (!normalized) return currentHistory;
  return [normalized, ...currentHistory.filter((item) => item.toLowerCase() !== normalized.toLowerCase())]
    .slice(0, MAX_SEARCH_HISTORY);
}

export function buildSearchSuggestions(inputValue, recentSearches, results) {
  const query = String(inputValue || '').trim().toLowerCase();
  const seen = new Set();
  const suggestions = [];

  const pushSuggestion = (value, hint, kind) => {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return;
    const key = normalizedValue.toLowerCase();
    if (seen.has(key)) return;
    if (query && !normalizedValue.toLowerCase().includes(query)) return;
    seen.add(key);
    suggestions.push({ value: normalizedValue, hint, kind });
  };

  recentSearches.forEach((term) => pushSuggestion(term, 'Recent', 'recent'));
  if (!query) return suggestions.slice(0, MAX_SUGGESTIONS);

  results.forEach((asset) => {
    const baseName = asset.path?.split('/').pop() || '';
    pushSuggestion(asset.name, asset.group || asset.path || asset.repository || '', 'asset');
    pushSuggestion(asset.group, 'Group', 'group');
    if (baseName && baseName !== asset.name) {
      pushSuggestion(baseName, asset.path || asset.repository || '', 'file');
    }
  });

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

export function getAssetDisplayName(asset) {
  return asset?.path?.split('/').pop() || asset?.name || asset?.id || '';
}

export function getSortValue(asset, field) {
  switch (field) {
    case 'asset':
      return getAssetDisplayName(asset).toLowerCase();
    case 'repository':
      return String(asset?.repository || '').toLowerCase();
    case 'format':
      return String(asset?.format || '').toLowerCase();
    case 'size':
      return Number(asset?.fileSize || 0);
    case 'lastModified':
      return new Date(asset?.lastModified || asset?.blobCreated || 0).getTime();
    default:
      return '';
  }
}

export function compareAssets(a, b, field, direction) {
  const left = getSortValue(a, field);
  const right = getSortValue(b, field);
  let result = 0;

  if (typeof left === 'number' && typeof right === 'number') {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  }

  if (result === 0) {
    result = getAssetDisplayName(a).localeCompare(getAssetDisplayName(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
}
