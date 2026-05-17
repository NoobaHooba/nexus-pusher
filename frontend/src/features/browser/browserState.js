import { INPUT_LIMITS, sanitizeNumberText, sanitizeText } from '../../shared/lib/inputValidation';

export const MAX_SEARCH_HISTORY = 6;
export const MAX_SUGGESTIONS = 8;
export const DEFAULT_SORT = { field: 'lastModified', direction: 'desc' };
export const SORT_FIELDS = ['asset', 'version', 'uploader', 'repository', 'format', 'size', 'lastModified'];

export const DEFAULT_SEARCH_STATE = {
  keyword: '',
  repository: '',
  format: '',
  name: '',
  group: '',
  version: '',
  mavenGroupId: '',
  mavenArtifactId: '',
  mavenBaseVersion: '',
  classifier: '',
  extension: '',
  path: '',
  uploadedBy: '',
  sizeMin: '',
  sizeMax: '',
  modifiedFrom: '',
  modifiedTo: '',
  sort: '',
  dir: '',
};

const BROWSER_QUERY_KEYS = [
  'q',
  'repo',
  'format',
  'name',
  'group',
  'version',
  'mavenGroupId',
  'mavenArtifactId',
  'mavenBaseVersion',
  'classifier',
  'extension',
  'path',
  'uploadedBy',
  'sizeMin',
  'sizeMax',
  'modifiedFrom',
  'modifiedTo',
  'sort',
  'dir',
];

const LABELS = {
  keyword: 'Keyword',
  repository: 'Repository',
  format: 'Format',
  name: 'Package',
  group: 'Group',
  version: 'Version',
  mavenGroupId: 'Maven Group ID',
  mavenArtifactId: 'Maven Artifact ID',
  mavenBaseVersion: 'Base Version',
  classifier: 'Classifier',
  extension: 'Extension',
  path: 'Path Contains',
  uploadedBy: 'Uploaded By',
  sizeMin: 'Min Size',
  sizeMax: 'Max Size',
  modifiedFrom: 'Modified From',
  modifiedTo: 'Modified To',
};

function normalizeText(value) {
  return sanitizeText(value, INPUT_LIMITS.search).trim();
}

function normalizeNumberText(value) {
  const text = sanitizeNumberText(value);
  if (!text) return '';
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? String(number) : '';
}

function normalizeDateText(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function sanitizeFormat(value) {
  return normalizeText(value);
}

function hasMavenContext(state) {
  return state.format === 'maven2'
    || ['mavenGroupId', 'mavenArtifactId', 'mavenBaseVersion', 'classifier', 'extension']
      .some((key) => normalizeText(state[key]));
}

function normalizeSort(field, dir, fallbackSort = DEFAULT_SORT) {
  const normalizedField = SORT_FIELDS.includes(field) ? field : '';
  if (!normalizedField) return { sort: '', dir: '' };
  const fallbackDirection = fallbackSort?.field === normalizedField
    ? fallbackSort.direction
    : (normalizedField === 'lastModified' ? 'desc' : 'asc');
  return {
    sort: normalizedField,
    dir: dir === 'asc' || dir === 'desc' ? dir : fallbackDirection,
  };
}

export function normalizeSearchState(input = {}, options = {}) {
  const fallbackSort = options.fallbackSort || DEFAULT_SORT;
  const base = { ...DEFAULT_SEARCH_STATE, ...(input || {}) };
  const next = {
    keyword: normalizeText(base.keyword),
    repository: normalizeText(base.repository),
    format: sanitizeFormat(base.format),
    name: normalizeText(base.name),
    group: normalizeText(base.group),
    version: normalizeText(base.version),
    mavenGroupId: normalizeText(base.mavenGroupId),
    mavenArtifactId: normalizeText(base.mavenArtifactId),
    mavenBaseVersion: normalizeText(base.mavenBaseVersion),
    classifier: normalizeText(base.classifier),
    extension: normalizeText(base.extension),
    path: normalizeText(base.path),
    uploadedBy: normalizeText(base.uploadedBy),
    sizeMin: normalizeNumberText(base.sizeMin),
    sizeMax: normalizeNumberText(base.sizeMax),
    modifiedFrom: normalizeDateText(base.modifiedFrom),
    modifiedTo: normalizeDateText(base.modifiedTo),
    ...normalizeSort(base.sort, base.dir, fallbackSort),
  };

  if (next.format && next.format !== 'maven2') {
    next.mavenGroupId = '';
    next.mavenArtifactId = '';
    next.mavenBaseVersion = '';
    next.classifier = '';
    next.extension = '';
  } else if (!hasMavenContext(next)) {
    next.mavenGroupId = '';
    next.mavenArtifactId = '';
    next.mavenBaseVersion = '';
    next.classifier = '';
    next.extension = '';
  }

  return next;
}

function getSearchParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

export function hasBrowserQueryParams() {
  const params = getSearchParams();
  return BROWSER_QUERY_KEYS.some((key) => params.has(key));
}

export function loadBrowserSearchState({ fallbackSort = DEFAULT_SORT } = {}) {
  const params = getSearchParams();
  return normalizeSearchState({
    keyword: params.get('q') || '',
    repository: params.get('repo') || '',
    format: params.get('format') || '',
    name: params.get('name') || '',
    group: params.get('group') || '',
    version: params.get('version') || '',
    mavenGroupId: params.get('mavenGroupId') || '',
    mavenArtifactId: params.get('mavenArtifactId') || '',
    mavenBaseVersion: params.get('mavenBaseVersion') || '',
    classifier: params.get('classifier') || '',
    extension: params.get('extension') || '',
    path: params.get('path') || '',
    uploadedBy: params.get('uploadedBy') || '',
    sizeMin: params.get('sizeMin') || '',
    sizeMax: params.get('sizeMax') || '',
    modifiedFrom: params.get('modifiedFrom') || '',
    modifiedTo: params.get('modifiedTo') || '',
    sort: params.get('sort') || '',
    dir: params.get('dir') || '',
  }, { fallbackSort });
}

export function saveBrowserSearchStateToUrl(state, mode = 'replace') {
  try {
    const url = new URL(window.location.href);
    const normalized = normalizeSearchState(state);
    const mappings = [
      ['keyword', 'q'],
      ['repository', 'repo'],
      ['format', 'format'],
      ['name', 'name'],
      ['group', 'group'],
      ['version', 'version'],
      ['mavenGroupId', 'mavenGroupId'],
      ['mavenArtifactId', 'mavenArtifactId'],
      ['mavenBaseVersion', 'mavenBaseVersion'],
      ['classifier', 'classifier'],
      ['extension', 'extension'],
      ['path', 'path'],
      ['uploadedBy', 'uploadedBy'],
      ['sizeMin', 'sizeMin'],
      ['sizeMax', 'sizeMax'],
      ['modifiedFrom', 'modifiedFrom'],
      ['modifiedTo', 'modifiedTo'],
      ['sort', 'sort'],
      ['dir', 'dir'],
    ];

    mappings.forEach(([sourceKey, paramKey]) => {
      if (normalized[sourceKey]) url.searchParams.set(paramKey, normalized[sourceKey]);
      else url.searchParams.delete(paramKey);
    });

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    window.history[method](window.history.state, '', nextUrl);
  } catch (_) {
    // ignore URL sync failures
  }
}

export function buildServerQuery(state) {
  const normalized = normalizeSearchState(state);
  return {
    keyword: normalized.keyword,
    repository: normalized.repository,
    format: normalized.format,
    name: normalized.name,
    group: normalized.group,
    version: normalized.version,
    maven: {
      groupId: normalized.mavenGroupId,
      artifactId: normalized.mavenArtifactId,
      baseVersion: normalized.mavenBaseVersion,
      classifier: normalized.classifier,
      extension: normalized.extension,
    },
  };
}

export function getLocalRefinements(state) {
  const normalized = normalizeSearchState(state);
  return {
    path: normalized.path,
    uploadedBy: normalized.uploadedBy,
    sizeMin: normalized.sizeMin,
    sizeMax: normalized.sizeMax,
    modifiedFrom: normalized.modifiedFrom,
    modifiedTo: normalized.modifiedTo,
  };
}

function matchesPackageHint(asset, value) {
  return includesNormalized([
    getAssetName(asset),
    asset?.artifactId,
    asset?.packageName,
    asset?.maven2?.artifactId,
  ], value);
}

function getAssetExtension(asset) {
  const path = String(asset?.path || '');
  const fileName = getAssetFileName(asset);
  const candidate = fileName || path;
  const index = candidate.lastIndexOf('.');
  return index >= 0 ? candidate.slice(index + 1).toLowerCase() : '';
}

function includesNormalized(candidates, value) {
  const query = normalizeText(value).toLowerCase();
  if (!query) return true;
  return candidates
    .map((candidate) => String(candidate || '').toLowerCase())
    .filter(Boolean)
    .some((candidate) => candidate.includes(query));
}

function matchesKeyword(asset, value) {
  const tokens = normalizeText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const candidates = [
    getAssetName(asset),
    getAssetFileName(asset),
    asset?.path,
    asset?.group,
    asset?.version,
    asset?.repository,
    asset?.format,
    getAssetUploader(asset),
  ]
    .map((candidate) => String(candidate || '').toLowerCase())
    .filter(Boolean);

  return tokens.every((token) => candidates.some((candidate) => candidate.includes(token)));
}

function matchesGroup(asset, value) {
  return includesNormalized([
    asset?.group,
    asset?.maven2?.groupId,
  ], value);
}

function matchesVersion(asset, value) {
  return includesNormalized([
    getAssetVersion(asset),
    asset?.maven2?.baseVersion,
    asset?.maven2?.version,
  ], value);
}

function matchesMavenGroupId(asset, value) {
  return includesNormalized([
    asset?.maven2?.groupId,
    asset?.group,
  ], value);
}

function matchesMavenArtifactId(asset, value) {
  return includesNormalized([
    asset?.maven2?.artifactId,
    asset?.artifactId,
  ], value);
}

function matchesMavenBaseVersion(asset, value) {
  return includesNormalized([
    asset?.maven2?.baseVersion,
    asset?.version,
  ], value);
}

function matchesClassifier(asset, value) {
  return includesNormalized([
    asset?.maven2?.classifier,
    getAssetFileName(asset),
    asset?.path,
  ], value);
}

function matchesExtension(asset, value) {
  return includesNormalized([
    asset?.maven2?.extension,
    getAssetExtension(asset),
    getAssetFileName(asset),
    asset?.path,
  ], value);
}

function parseDateFloor(value) {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseDateCeil(value) {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T23:59:59.999`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getAssetTimestamp(asset) {
  const timestamp = Date.parse(asset?.lastModified || asset?.blobCreated || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function applyLocalRefinements(assets = [], refinements = {}) {
  const path = normalizeText(refinements.path).toLowerCase();
  const uploadedBy = normalizeText(refinements.uploadedBy).toLowerCase();
  const sizeMin = refinements.sizeMin === '' ? null : Number(refinements.sizeMin);
  const sizeMax = refinements.sizeMax === '' ? null : Number(refinements.sizeMax);
  const modifiedFrom = parseDateFloor(refinements.modifiedFrom);
  const modifiedTo = parseDateCeil(refinements.modifiedTo);

  return assets.filter((asset) => {
    const assetPath = String(asset?.path || '').toLowerCase();
    const assetUploader = getAssetUploader(asset).toLowerCase();
    const assetSize = Number(asset?.fileSize || 0);
    const assetTimestamp = getAssetTimestamp(asset);

    if (path && !assetPath.includes(path)) return false;
    if (uploadedBy && !assetUploader.includes(uploadedBy)) return false;
    if (sizeMin !== null && assetSize < sizeMin) return false;
    if (sizeMax !== null && assetSize > sizeMax) return false;
    if (modifiedFrom !== null && (assetTimestamp === null || assetTimestamp < modifiedFrom)) return false;
    if (modifiedTo !== null && (assetTimestamp === null || assetTimestamp > modifiedTo)) return false;
    return true;
  });
}

export function applyPackageSearchRefinement(assets = [], state = {}) {
  const normalized = normalizeSearchState(state);
  if (!normalized.name) return assets;
  return assets.filter((asset) => matchesPackageHint(asset, normalized.name));
}

export function applyServerSearchRefinements(assets = [], state = {}) {
  const normalized = normalizeSearchState(state);

  return assets.filter((asset) => (
    matchesKeyword(asset, normalized.keyword)
    && matchesPackageHint(asset, normalized.name)
    && matchesGroup(asset, normalized.group)
    && matchesVersion(asset, normalized.version)
    && matchesMavenGroupId(asset, normalized.mavenGroupId)
    && matchesMavenArtifactId(asset, normalized.mavenArtifactId)
    && matchesMavenBaseVersion(asset, normalized.mavenBaseVersion)
    && matchesClassifier(asset, normalized.classifier)
    && matchesExtension(asset, normalized.extension)
  ));
}

export function hasLocalRefinements(state) {
  const refinements = getLocalRefinements(state);
  return Object.values(refinements).some((value) => normalizeText(value));
}

export function getActiveFilterChips(state) {
  const normalized = normalizeSearchState(state);
  const serverKeys = [
    'keyword',
    'repository',
    'format',
    'name',
    'group',
    'version',
    'mavenGroupId',
    'mavenArtifactId',
    'mavenBaseVersion',
    'classifier',
    'extension',
  ];
  const localKeys = ['path', 'uploadedBy', 'sizeMin', 'sizeMax', 'modifiedFrom', 'modifiedTo'];

  return [...serverKeys, ...localKeys]
    .filter((key) => normalized[key])
    .map((key) => ({
      key,
      label: LABELS[key] || key,
      value: normalized[key],
      scope: localKeys.includes(key) ? 'local' : 'server',
    }));
}

export function getEffectiveSortState(state, fallbackSort = DEFAULT_SORT) {
  const normalized = normalizeSearchState(state, { fallbackSort });
  if (SORT_FIELDS.includes(normalized.sort)) {
    return { field: normalized.sort, direction: normalized.dir || 'asc', mode: 'explicit' };
  }
  if (normalized.keyword) {
    return { field: 'relevance', direction: 'desc', mode: 'default' };
  }
  return { field: fallbackSort.field, direction: fallbackSort.direction, mode: 'default' };
}

export function getAssetFileName(asset) {
  return asset?.path?.split('/').pop() || asset?.name || asset?.id || '';
}

function getAssetFormat(asset) {
  return String(asset?.format || asset?.type || '').toLowerCase();
}

function getNormalizedAssetPath(asset) {
  return String(asset?.path || '').replace(/^\/+/, '');
}

function deriveDockerCoordinates(asset) {
  const path = getNormalizedAssetPath(asset);
  const manifestMatch = path.match(/^v2\/(.+)\/manifests\/([^/]+)$/i);
  if (manifestMatch) {
    return {
      name: manifestMatch[1],
      version: manifestMatch[2],
    };
  }

  const blobMatch = path.match(/^v2\/(.+)\/blobs\/sha256:/i);
  if (blobMatch) {
    return {
      name: blobMatch[1],
      version: '',
    };
  }

  return { name: '', version: '' };
}

function derivePackageCoordinates(asset) {
  const format = getAssetFormat(asset);
  const path = getNormalizedAssetPath(asset);
  const segments = path.split('/').filter(Boolean);

  if (format === 'pypi' && segments[0] === 'packages' && segments.length >= 3) {
    return {
      name: segments[1],
      version: segments[2],
    };
  }

  if (['nuget', 'helm', 'pypi'].includes(format) && segments.length >= 2) {
    return {
      name: segments[0],
      version: segments[1],
    };
  }

  return { name: '', version: '' };
}

export function getAssetName(asset) {
  const format = getAssetFormat(asset);
  if (format === 'docker') {
    const dockerName = deriveDockerCoordinates(asset).name;
    if (dockerName) return dockerName;
  }

  if (['helm', 'pypi', 'nuget'].includes(format)) {
    const packageName = derivePackageCoordinates(asset).name;
    if (packageName) return packageName;
  }

  return asset?.artifactId || asset?.packageName || asset?.name || getAssetFileName(asset);
}

export function getAssetUploader(asset) {
  return asset?.uploader || asset?.blobCreatedBy || asset?.createdBy || '';
}

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
    const baseName = getAssetFileName(asset);
    pushSuggestion(getAssetName(asset), asset.group || asset.path || asset.repository || '', 'asset');
    pushSuggestion(asset.group, 'Group', 'group');
    if (baseName && baseName !== asset.name) {
      pushSuggestion(baseName, asset.path || asset.repository || '', 'file');
    }
  });

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

export function getAssetDisplayName(asset) {
  return getAssetName(asset) || getAssetFileName(asset);
}

export function getAssetVersion(asset) {
  const format = getAssetFormat(asset);
  if (format === 'docker') {
    const dockerVersion = deriveDockerCoordinates(asset).version;
    if (dockerVersion) return dockerVersion;
  }

  if (['helm', 'pypi', 'nuget'].includes(format)) {
    const packageVersion = derivePackageCoordinates(asset).version;
    if (packageVersion) return packageVersion;
  }

  return asset?.version
    || asset?.maven2?.baseVersion
    || asset?.maven2?.version
    || '';
}

export function getSortValue(asset, field) {
  switch (field) {
    case 'asset':
      return getAssetDisplayName(asset).toLowerCase();
    case 'version':
      return getAssetVersion(asset).toLowerCase();
    case 'uploader':
      return getAssetUploader(asset).toLowerCase();
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
