import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiUrl } from '../../shared/lib/backendApi';
import { createHttpError, createNetworkError, formatUserError } from '../../shared/lib/errorMessages';
import { buildNexusBrowseUrl, rewriteNexusAssetUrls, rewriteNexusUrl } from '../../shared/lib/nexusLinks';
import {
  applyLocalRefinements,
  applyServerSearchRefinements,
  buildSearchSuggestions,
  buildServerQuery,
  compareAssets,
  DEFAULT_SEARCH_STATE,
  getActiveFilterChips,
  getAssetFileName,
  getAssetName,
  getAssetUploader,
  getAssetVersion,
  getEffectiveSortState,
  getLocalRefinements,
  hasBrowserQueryParams,
  hasLocalRefinements,
  loadBrowserSearchState,
  normalizeSearchState,
  rememberSearchTerm,
  saveBrowserSearchStateToUrl,
  SORT_FIELDS,
} from './browserState';
import {
  loadBrowserUiPrefs,
  loadSearchHistory,
  saveBrowserUiPrefs,
  saveSearchHistory,
} from './browserStorage';

const FORMAT_COLORS = {
  maven2:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  npm:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  docker:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cargo:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  conan:   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  pypi:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  nuget:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  helm:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  yum:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  apt:     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  raw:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  r:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  rubygems:'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const KNOWN_FORMATS = ['maven2', 'npm', 'docker', 'cargo', 'conan', 'pypi', 'nuget', 'helm', 'yum', 'apt', 'raw'];

function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatUploader(asset) {
  const uploader = getAssetUploader(asset);
  return uploader || '—';
}

function fileIcon(path) {
  const ext = (path || '').split('.').pop().toLowerCase();
  const map = {
    jar: 'data_object', war: 'web', ear: 'web', zip: 'folder_zip',
    tgz: 'archive', gz: 'archive', tar: 'archive', 'tar.gz': 'archive',
    deb: 'package_2', rpm: 'package_2', nupkg: 'package_2',
    whl: 'settings', egg: 'settings',
    pom: 'description', xml: 'code', json: 'data_object',
    yaml: 'code', yml: 'code', md: 'description', txt: 'description',
    sha1: 'lock', sha256: 'lock', sha512: 'lock', md5: 'lock',
    png: 'image', jpg: 'image', jpeg: 'image', svg: 'image',
  };
  return map[ext] || 'draft';
}

async function apiFetch(settings, path, body) {
  let res;
  try {
    res = await fetch(apiUrl(settings, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (_) {
    throw createNetworkError({ action: 'again' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw createHttpError(res.status, json.error, { action: 'again' });
  return json;
}

function loadBrowserSession(settings) {
  const uiPrefs = loadBrowserUiPrefs(settings);
  let searchState = loadBrowserSearchState({ fallbackSort: uiPrefs.sortState });

  if (!hasBrowserQueryParams()) {
    searchState = normalizeSearchState({
      ...searchState,
      sort: uiPrefs.sortState.field,
      dir: uiPrefs.sortState.direction,
    }, { fallbackSort: uiPrefs.sortState });
  }

  return {
    uiPrefs,
    searchState,
    recentSearches: loadSearchHistory(settings),
  };
}

function FilterField({ label, value, onChange, placeholder, type = 'text', helperText, className = '', min, max }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-dark-text-faint">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-2.5 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
      />
      {helperText && <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">{helperText}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-dark-text-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-2.5 text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ chip, onRemove }) {
  const isLocal = chip.scope === 'local';
  return (
    <button
      onClick={() => onRemove(chip.key)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        isLocal
          ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/40 dark:bg-cyan-900/20 dark:text-cyan-300'
          : 'border-slate-200 bg-white text-primary dark:border-dark-border dark:bg-dark-surface dark:text-dark-text'
      }`}
      title={`Remove ${chip.label}`}
    >
      <span className="truncate max-w-[220px]">{chip.label}: {chip.value}</span>
      {isLocal && <span className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider dark:bg-cyan-900/30">Loaded</span>}
      <span className="material-symbols-outlined text-[14px]">close</span>
    </button>
  );
}

function MobileAssetCard({ asset, onOpen, settings }) {
  const fileName = getAssetFileName(asset) || '—';
  const assetName = getAssetName(asset) || fileName;
  const version = getAssetVersion(asset);
  const fmtColor = FORMAT_COLORS[asset.format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <article
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50/60 dark:border-dark-border dark:bg-dark-surface dark:hover:bg-dark-surface-2/70"
      onClick={() => onOpen(asset)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary dark:text-dark-text">{assetName}</p>
          {fileName !== assetName && (
            <p className="truncate text-xs text-on-surface-variant dark:text-dark-text-muted">{fileName}</p>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${fmtColor}`}>{asset.format || '—'}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Repository</p>
          <p className="font-mono text-on-surface-variant dark:text-dark-text-muted">{asset.repository || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Version</p>
          <p className="truncate text-on-surface-variant dark:text-dark-text-muted">{version || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Size</p>
          <p className="text-on-surface-variant dark:text-dark-text-muted">{asset.fileSize != null ? formatSize(asset.fileSize) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Uploader</p>
          <p className="truncate text-on-surface-variant dark:text-dark-text-muted">{formatUploader(asset)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Modified</p>
          <p className="text-on-surface-variant dark:text-dark-text-muted">{formatDate(asset.lastModified || asset.blobCreated)}</p>
        </div>
      </div>

      {asset.path && (
        <p className="mt-3 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-500 dark:bg-dark-surface-2 dark:text-dark-text-faint">
          {asset.path}
        </p>
      )}

      {buildNexusBrowseUrl(settings, asset.repository, asset.path, asset) && (
        <a
          href={buildNexusBrowseUrl(settings, asset.repository, asset.path, asset)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
        >
          <span className="material-symbols-outlined text-[13px]">open_in_new</span>
          Open in Nexus
        </a>
      )}
    </article>
  );
}

export default function BrowserPage({ settings }) {
  const { nexusUrl, username, password } = settings || {};
  const initialSession = useMemo(() => loadBrowserSession(settings), [settings?.nexusUrl, settings?.username]);

  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState(null);
  const [searchState, setSearchState] = useState(initialSession.searchState);
  const [keywordInput, setKeywordInput] = useState(initialSession.searchState.keyword);
  const [uiPrefs, setUiPrefs] = useState(initialSession.uiPrefs);
  const [recentSearches, setRecentSearches] = useState(initialSession.recentSearches);
  const [repoFilter, setRepoFilter] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [continuationToken, setContinuationToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const searchBoxRef = useRef(null);
  const keywordDebounceRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const searchRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const autoCollapsedFiltersRef = useRef(null);

  const updateSearchState = useCallback((updater) => {
    setSearchState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return normalizeSearchState(next);
    });
  }, []);

  useEffect(() => {
    const nextSession = loadBrowserSession(settings);
    setSearchState(nextSession.searchState);
    setKeywordInput(nextSession.searchState.keyword);
    setUiPrefs(nextSession.uiPrefs);
    setRecentSearches(nextSession.recentSearches);
    setRepoFilter('');
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
  }, [settings?.nexusUrl, settings?.username]);

  useEffect(() => {
    saveBrowserUiPrefs(uiPrefs, settings);
  }, [uiPrefs, settings?.nexusUrl, settings?.username]);

  useEffect(() => {
    saveBrowserSearchStateToUrl(searchState);
  }, [searchState]);

  useEffect(() => {
    if (!SORT_FIELDS.includes(searchState.sort)) return;
    setUiPrefs((current) => {
      if (current.sortState.field === searchState.sort && current.sortState.direction === searchState.dir) {
        return current;
      }
      return {
        ...current,
        sortState: {
          field: searchState.sort,
          direction: searchState.dir || 'asc',
        },
      };
    });
  }, [searchState.sort, searchState.dir]);

  useEffect(() => {
    if (!nexusUrl) return;
    let cancelled = false;
    setReposLoading(true);
    apiFetch(settings, '/api/browse/repos', { nexusUrl, username, password })
      .then((data) => {
        if (cancelled) return;
        setRepos(Array.isArray(data) ? data : []);
        setReposError(null);
      })
      .catch((err) => {
        if (!cancelled) setReposError(formatUserError(err, { action: 'loading repositories' }));
      })
      .finally(() => {
        if (!cancelled) setReposLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nexusUrl, username, password, settings]);

  const serverQuery = useMemo(() => buildServerQuery(searchState), [searchState]);
  const localRefinements = useMemo(() => getLocalRefinements(searchState), [searchState]);
  const activeChips = useMemo(() => getActiveFilterChips(searchState), [searchState]);
  const localRefinementsActive = useMemo(() => hasLocalRefinements(searchState), [searchState]);
  const effectiveSort = useMemo(() => getEffectiveSortState(searchState), [searchState]);

  const fetchSearchPage = useCallback(async (query, token = '') => {
    const data = await apiFetch(settings, '/api/browse/search', {
      nexusUrl,
      username,
      password,
      continuationToken: token || undefined,
      query,
    });

    return {
      continuationToken: data.continuationToken || null,
      items: (data.items || []).map((item) => rewriteNexusAssetUrls(settings, item)),
    };
  }, [nexusUrl, username, password, settings]);

  const doSearch = useCallback(async (query, token = '', append = false) => {
    if (!nexusUrl) return;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchSearchPage(query, token);
      if (requestId !== searchRequestRef.current) return;
      setResults((current) => (append ? [...current, ...data.items] : data.items));
      setContinuationToken(data.continuationToken);
    } catch (err) {
      if (requestId !== searchRequestRef.current) return;
      setError(formatUserError(err, { action: 'searching Nexus' }));
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setLoadingAll(false);
      }
    }
  }, [nexusUrl, fetchSearchPage]);

  useEffect(() => {
    if (!nexusUrl) return undefined;
    setContinuationToken(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      doSearch(serverQuery, '', false);
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [nexusUrl, doSearch, serverQuery]);

  useEffect(() => {
    if (keywordDebounceRef.current) clearTimeout(keywordDebounceRef.current);
    keywordDebounceRef.current = setTimeout(() => {
      updateSearchState((current) => ({ ...current, keyword: keywordInput }));
    }, 400);
    return () => {
      if (keywordDebounceRef.current) clearTimeout(keywordDebounceRef.current);
    };
  }, [keywordInput, updateSearchState]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!searchBoxRef.current?.contains(event.target)) {
        setShowSuggestions(false);
        setHighlightedSuggestion(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;

    const handleScroll = () => {
      const nextScrollY = window.scrollY;
      const scrollingDown = nextScrollY > lastScrollYRef.current;
      const scrollingUp = nextScrollY < lastScrollYRef.current;

      if (scrollingDown && nextScrollY > 40 && (uiPrefs.filtersOpen || uiPrefs.localFiltersOpen)) {
        autoCollapsedFiltersRef.current = {
          filtersOpen: uiPrefs.filtersOpen,
          localFiltersOpen: uiPrefs.localFiltersOpen,
        };
        setUiPrefs((current) => ((current.filtersOpen || current.localFiltersOpen)
          ? { ...current, filtersOpen: false, localFiltersOpen: false }
          : current));
      } else if (scrollingUp && autoCollapsedFiltersRef.current) {
        const restoreState = autoCollapsedFiltersRef.current;
        autoCollapsedFiltersRef.current = null;
        setUiPrefs((current) => (
          current.filtersOpen === restoreState.filtersOpen && current.localFiltersOpen === restoreState.localFiltersOpen
            ? current
            : { ...current, ...restoreState }
        ));
      }

      lastScrollYRef.current = nextScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [uiPrefs.filtersOpen]);

  const availableFormats = useMemo(() => [...new Set(repos.map((repo) => repo.format).filter(Boolean))].sort(), [repos]);

  const filteredRepos = useMemo(() => {
    const query = repoFilter.trim().toLowerCase();
    return repos
      .filter((repo) => {
        if (!repo?.name) return false;
        if (searchState.format && repo.format !== searchState.format) return false;
        if (!query) return true;
        return repo.name.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [repoFilter, repos, searchState.format]);

  const searchSuggestions = useMemo(
    () => buildSearchSuggestions(keywordInput, recentSearches, results),
    [keywordInput, recentSearches, results]
  );

  const displayedResults = useMemo(() => {
    const serverRefined = applyServerSearchRefinements(results, searchState);
    const refined = applyLocalRefinements(serverRefined, localRefinements);
    if (effectiveSort.field === 'relevance') return refined;
    return [...refined].sort((a, b) => compareAssets(a, b, effectiveSort.field, effectiveSort.direction));
  }, [results, searchState, localRefinements, effectiveSort]);

  const commitSearch = useCallback((value) => {
    const nextValue = String(value || '').trim();
    if (keywordDebounceRef.current) clearTimeout(keywordDebounceRef.current);
    setKeywordInput(nextValue);
    updateSearchState((current) => ({ ...current, keyword: nextValue }));
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
    if (!nextValue) return;
    setRecentSearches((current) => {
      const next = rememberSearchTerm(current, nextValue);
      saveSearchHistory(next, settings);
      return next;
    });
  }, [settings, updateSearchState]);

  const clearAllFilters = useCallback(() => {
    if (keywordDebounceRef.current) clearTimeout(keywordDebounceRef.current);
    setKeywordInput('');
    updateSearchState(DEFAULT_SEARCH_STATE);
    setShowSuggestions(false);
    setHighlightedSuggestion(-1);
  }, [updateSearchState]);

  const updateField = useCallback((key, value) => {
    updateSearchState((current) => ({ ...current, [key]: value }));
  }, [updateSearchState]);

  const selectedRepositoryMeta = useMemo(
    () => repos.find((repo) => repo?.name === searchState.repository) || null,
    [repos, searchState.repository]
  );

  const effectiveSearchFormat = selectedRepositoryMeta?.format || searchState.format || '';
  const showGroupFilter = effectiveSearchFormat === 'maven2' || Boolean(searchState.group);
  const searchPlaceholder = showGroupFilter
    ? 'Search Nexus by keyword, package, group, version...'
    : 'Search Nexus by keyword, package, version...';

  const updateRepository = useCallback((repository) => {
    const selected = repos.find((repo) => repo?.name === repository);
    updateSearchState((current) => ({
      ...current,
      repository,
      format: selected?.format || (repository ? current.format : current.format),
      group: selected?.format && selected.format !== 'maven2' ? '' : current.group,
    }));
  }, [repos, updateSearchState]);

  const updateFormat = useCallback((format) => {
    updateSearchState((current) => {
      const currentRepo = repos.find((repo) => repo?.name === current.repository);
      const shouldClearRepository = currentRepo && format && currentRepo.format !== format;
      return {
        ...current,
        format,
        repository: shouldClearRepository ? '' : current.repository,
        group: format && format !== 'maven2' ? '' : current.group,
      };
    });
  }, [repos, updateSearchState]);

  const removeChip = useCallback((key) => {
    if (key === 'keyword') {
      setKeywordInput('');
    }
    updateSearchState((current) => ({ ...current, [key]: '' }));
  }, [updateSearchState]);

  const loadMore = useCallback(() => {
    if (!continuationToken || loading || loadingMore || loadingAll) return;
    doSearch(serverQuery, continuationToken, true);
  }, [continuationToken, loading, loadingMore, loadingAll, doSearch, serverQuery]);

  const loadAll = useCallback(async () => {
    if (!continuationToken || loading || loadingMore || loadingAll) return;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setLoadingMore(true);
    setLoadingAll(true);
    setError(null);

    try {
      const collected = [];
      let nextToken = continuationToken;

      while (nextToken) {
        const page = await fetchSearchPage(serverQuery, nextToken);
        if (requestId !== searchRequestRef.current) return;
        collected.push(...page.items);
        nextToken = page.continuationToken;
      }

      if (requestId !== searchRequestRef.current) return;
      setResults((current) => [...current, ...collected]);
      setContinuationToken(null);
    } catch (err) {
      if (requestId !== searchRequestRef.current) return;
      setError(formatUserError(err, { action: 'loading all search results' }));
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoadingMore(false);
        setLoadingAll(false);
      }
    }
  }, [continuationToken, loading, loadingMore, loadingAll, fetchSearchPage, serverQuery]);

  const openDetail = useCallback(async (asset) => {
    if (detailLoading && detail?.id === asset.id) return;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetail(asset);
    if (!asset.id) return;
    setDetailLoading(true);
    try {
      const full = await apiFetch(settings, '/api/browse/asset', { nexusUrl, username, password, id: asset.id });
      if (requestId !== detailRequestRef.current) return;
      setDetail(rewriteNexusAssetUrls(settings, { ...asset, ...full }));
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setDetail((current) => (
        current?.id === asset.id
          ? { ...current, detailError: formatUserError(err, { action: 'loading asset details' }) }
          : current
      ));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [detail, detailLoading, nexusUrl, username, password, settings]);

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setDetailLoading(false);
    setDetail(null);
  }, []);

  const toggleSort = useCallback((field) => {
    updateSearchState((current) => {
      const currentEffective = getEffectiveSortState(current);
      if (currentEffective.field === field) {
        const nextDirection = currentEffective.direction === 'asc' ? 'desc' : 'asc';
        return { ...current, sort: field, dir: nextDirection };
      }
      return { ...current, sort: field, dir: field === 'lastModified' ? 'desc' : 'asc' };
    });
  }, [updateSearchState]);

  const renderSortHeader = useCallback((label, field) => {
    const isActive = effectiveSort.field === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1.5 transition-colors ${
          isActive
            ? 'text-primary dark:text-dark-text'
            : 'text-on-surface-variant dark:text-dark-text-muted hover:text-primary dark:hover:text-dark-text'
        }`}
      >
        <span>{label}</span>
        <span className="inline-flex flex-col leading-none">
          <span className={`material-symbols-outlined text-[14px] -mb-1 ${isActive && effectiveSort.direction === 'asc' ? 'text-accent dark:text-dark-accent' : 'text-slate-300 dark:text-dark-text-faint'}`}>
            arrow_drop_up
          </span>
          <span className={`material-symbols-outlined text-[14px] -mt-1 ${isActive && effectiveSort.direction === 'desc' ? 'text-accent dark:text-dark-accent' : 'text-slate-300 dark:text-dark-text-faint'}`}>
            arrow_drop_down
          </span>
        </span>
      </button>
    );
  }, [effectiveSort.field, effectiveSort.direction, toggleSort]);

  const resultSummary = useMemo(() => {
    if (results.length === 0) return 'No assets loaded yet';
    if (!localRefinementsActive) {
      return `${results.length} asset${results.length !== 1 ? 's' : ''} loaded${continuationToken ? ' · more available' : ''}`;
    }
    return `${results.length} fetched · ${displayedResults.length} shown after local refinements${continuationToken ? ' · more available from Nexus' : ''}`;
  }, [results.length, displayedResults.length, localRefinementsActive, continuationToken]);

  const copyText = useCallback(async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(successMessage);
      setTimeout(() => setCopyMessage(''), 1600);
    } catch (_) {
      setCopyMessage('Could not copy to the clipboard. Select the link and copy it manually.');
    }
  }, []);

  const shareSearchUrl = useCallback(() => {
    copyText(window.location.href, 'Search link copied.');
  }, [copyText]);

  const copyDetailLink = useCallback((asset) => {
    const url = buildNexusBrowseUrl(settings, asset.repository, asset.path, asset) || rewriteNexusUrl(settings, asset.downloadUrl);
    copyText(url, 'Nexus link copied.');
  }, [copyText, settings]);

  const formatOptions = useMemo(() => (
    (availableFormats.length > 0 ? availableFormats : KNOWN_FORMATS)
      .map((format) => ({ value: format, label: format }))
  ), [availableFormats]);

  useEffect(() => {
    if (!selectedRepositoryMeta) return;
    if (searchState.format === selectedRepositoryMeta.format) return;
    updateSearchState((current) => ({ ...current, format: selectedRepositoryMeta.format || '' }));
  }, [selectedRepositoryMeta, searchState.format, updateSearchState]);

  if (!nexusUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
        <span className="material-symbols-outlined text-slate-200 dark:text-dark-border text-[64px]">cloud_off</span>
        <p className="font-bold text-on-surface-variant dark:text-dark-text-muted">No Nexus URL configured</p>
        <p className="text-sm text-slate-400 dark:text-dark-text-faint max-w-xs">Open Settings and enter your Nexus instance URL to start browsing.</p>
      </div>
    );
  }

  return (
    <div className="browser-page density-page flex flex-col gap-6">
      <div>
        <h2 className="browser-title text-4xl font-extrabold tracking-tight text-primary dark:text-dark-text">Repository Browser</h2>
      </div>

      <div className="browser-layout flex flex-col gap-6 xl:flex-row xl:items-start">
        <aside className="browser-repo-sidebar w-full xl:w-64 xl:flex-shrink-0 bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-border space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Repositories</p>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
              <input
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                placeholder="Filter repos"
                className="w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface-2 py-2 pl-9 pr-3 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30"
              />
            </div>
          </div>

          {reposLoading && (
            <div className="flex flex-col gap-2 p-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-dark-surface-2 animate-pulse" />)}
            </div>
          )}

          {reposError && <p className="text-xs text-rose-500 dark:text-rose-400 p-4">{reposError}</p>}

          {!reposLoading && !reposError && (
            <ul role="list" className="py-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              <li>
                <button
                  onClick={() => updateRepository('')}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    searchState.repository === ''
                      ? 'bg-accent-dim/40 dark:bg-dark-accent-dim text-accent dark:text-dark-accent font-bold'
                      : 'text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                  }`}
                >
                  All repositories
                </button>
              </li>
              {filteredRepos.map((repo) => (
                <li key={repo.name}>
                  <button
                    onClick={() => updateRepository(repo.name)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      searchState.repository === repo.name
                        ? 'bg-accent-dim/40 dark:bg-dark-accent-dim text-accent dark:text-dark-accent font-bold'
                        : 'text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] flex-shrink-0 opacity-50 text-slate-400 dark:text-dark-text-faint">database</span>
                      <span className="truncate">{repo.name}</span>
                    </div>
                    {repo.format && (
                      <span className={`ml-6 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {repo.format}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {filteredRepos.length === 0 && (
                <li className="px-4 py-6 text-xs text-slate-400 dark:text-dark-text-faint">
                  {repoFilter
                    ? `No repositories match "${repoFilter}".`
                    : searchState.format
                      ? `No ${searchState.format} repositories available.`
                      : 'No repositories available.'}
                </li>
              )}
            </ul>
          )}
        </aside>

        <div className="min-w-0 flex-1 flex flex-col gap-4">
          <div className="sticky top-6 z-20">
            <div className="browser-search-shell rounded-3xl border border-slate-100 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-dark-border dark:bg-dark-surface/95">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div ref={searchBoxRef} className="relative flex-1 min-w-[260px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[20px]">search</span>
                    <input
                      value={keywordInput}
                      onChange={(e) => {
                        setKeywordInput(e.target.value);
                        setShowSuggestions(true);
                        setHighlightedSuggestion(-1);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          if (searchSuggestions.length === 0) return;
                          e.preventDefault();
                          setShowSuggestions(true);
                          setHighlightedSuggestion((current) => (current >= searchSuggestions.length - 1 ? 0 : current + 1));
                        } else if (e.key === 'ArrowUp') {
                          if (searchSuggestions.length === 0) return;
                          e.preventDefault();
                          setShowSuggestions(true);
                          setHighlightedSuggestion((current) => (current <= 0 ? searchSuggestions.length - 1 : current - 1));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const suggested = highlightedSuggestion >= 0 ? searchSuggestions[highlightedSuggestion] : null;
                          commitSearch(suggested?.value || keywordInput);
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                          setHighlightedSuggestion(-1);
                        }
                      }}
                      placeholder={searchPlaceholder}
                      className="w-full rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface pl-10 pr-10 py-3 text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
                    />
                    {keywordInput && (
                      <button
                        onClick={() => {
                          setKeywordInput('');
                          commitSearch('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint hover:text-slate-600 dark:hover:text-dark-text"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-20 overflow-hidden rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl dark:shadow-black/30">
                        <ul className="py-2">
                          {searchSuggestions.map((suggestion, index) => (
                            <li key={`${suggestion.kind}-${suggestion.value}`}>
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  commitSearch(suggestion.value);
                                }}
                                onMouseEnter={() => setHighlightedSuggestion(index)}
                                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                                  highlightedSuggestion === index
                                    ? 'bg-slate-50 dark:bg-dark-surface-2'
                                    : 'hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-primary dark:text-dark-text">
                                    {suggestion.value}
                                  </span>
                                  {suggestion.hint && (
                                    <span className="block truncate text-[11px] text-slate-400 dark:text-dark-text-faint">
                                      {suggestion.hint}
                                    </span>
                                  )}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  suggestion.kind === 'recent'
                                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-accent-dim/50 text-accent dark:bg-dark-accent-dim dark:text-dark-accent'
                                }`}>
                                  {suggestion.kind === 'recent' ? 'Recent' : 'Match'}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => commitSearch(keywordInput)}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-black dark:bg-dark-accent dark:text-dark-bg dark:hover:opacity-90"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                      Search
                    </button>
                    <button
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-slate-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-surface-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                      Clear All
                    </button>
                    <button
                      onClick={() => {
                        autoCollapsedFiltersRef.current = null;
                        setUiPrefs((current) => ({ ...current, filtersOpen: !current.filtersOpen }));
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-slate-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-surface-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      Filters
                      <span className="rounded-full bg-accent-dim/50 px-2 py-0.5 text-[10px] text-accent dark:bg-dark-accent-dim dark:text-dark-accent">
                        {activeChips.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setUiPrefs((current) => ({ ...current, localFiltersOpen: !current.localFiltersOpen }))}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-900/30 dark:bg-cyan-900/20 dark:text-cyan-300 dark:hover:bg-cyan-900/30"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      Advanced Filters
                      <span className="material-symbols-outlined text-[16px]">{uiPrefs.localFiltersOpen ? 'expand_less' : 'expand_more'}</span>
                    </button>
                  </div>
                </div>

                {activeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <FilterChip key={`${chip.scope}-${chip.key}`} chip={chip} onRemove={removeChip} />
                    ))}
                  </div>
                )}

                {uiPrefs.filtersOpen && (
                  <div className="flex flex-col gap-4">
                    <section className="browser-filter-section rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-dark-border dark:bg-dark-surface-2/70">
                      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-dark-text-faint">Search Nexus</p>
                        </div>
                        {selectedRepositoryMeta && (
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-dark-surface dark:text-dark-text-muted">
                            Repo locks format to {selectedRepositoryMeta.format}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 items-end">
                        <SelectField
                          label="Repository"
                          value={searchState.repository}
                          onChange={updateRepository}
                          placeholder="All repositories"
                          className="min-w-[200px] flex-1"
                          options={repos.filter((repo) => repo?.name).sort((a, b) => a.name.localeCompare(b.name)).map((repo) => ({
                            value: repo.name,
                            label: repo.name,
                          }))}
                        />
                        <SelectField
                          label="Format"
                          value={searchState.format}
                          onChange={updateFormat}
                          placeholder="All formats"
                          className="min-w-[180px] flex-1"
                          options={formatOptions}
                        />
                        <FilterField className="min-w-[180px] flex-1" label="Package Name" value={searchState.name} onChange={(value) => updateField('name', value)} placeholder="org.osgi.core" />
                        {showGroupFilter && (
                          <FilterField className="min-w-[180px] flex-1" label="Group" value={searchState.group} onChange={(value) => updateField('group', value)} placeholder="org.osgi" />
                        )}
                        <FilterField className="min-w-[160px] flex-1" label="Version" value={searchState.version} onChange={(value) => updateField('version', value)} placeholder="4.3.1" />
                        {(searchState.format === 'maven2'
                          || searchState.mavenGroupId
                          || searchState.mavenArtifactId
                          || searchState.mavenBaseVersion
                          || searchState.classifier
                          || searchState.extension) && (
                          <>
                            <FilterField className="min-w-[180px] flex-1" label="Group ID" value={searchState.mavenGroupId} onChange={(value) => updateField('mavenGroupId', value)} placeholder="org.osgi" />
                            <FilterField className="min-w-[180px] flex-1" label="Artifact ID" value={searchState.mavenArtifactId} onChange={(value) => updateField('mavenArtifactId', value)} placeholder="org.osgi.core" />
                            <FilterField className="min-w-[180px] flex-1" label="Base Version" value={searchState.mavenBaseVersion} onChange={(value) => updateField('mavenBaseVersion', value)} placeholder="1.2.3-SNAPSHOT" />
                            <FilterField className="min-w-[160px] flex-1" label="Classifier" value={searchState.classifier} onChange={(value) => updateField('classifier', value)} placeholder="sources" />
                            <FilterField className="min-w-[140px] flex-1" label="Extension" value={searchState.extension} onChange={(value) => updateField('extension', value)} placeholder="jar" />
                          </>
                        )}
                      </div>
                    </section>

                  </div>
                )}

                {uiPrefs.localFiltersOpen && (
                  <section className="browser-local-filter-section rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 dark:border-cyan-900/30 dark:bg-cyan-900/10">
                    <div className="mb-4 flex items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">Refine Loaded Results Only</p>
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">Local</span>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                      <FilterField className="min-w-[180px] flex-1" label="Path Contains" value={searchState.path} onChange={(value) => updateField('path', value)} placeholder="org/osgi/" />
                      <FilterField className="min-w-[180px] flex-1" label="Uploaded By" value={searchState.uploadedBy} onChange={(value) => updateField('uploadedBy', value)} placeholder="admin" />
                      <FilterField className="min-w-[150px] flex-1" label="Size Min" value={searchState.sizeMin} onChange={(value) => updateField('sizeMin', value)} placeholder="0" type="number" min="0" />
                      <FilterField className="min-w-[150px] flex-1" label="Size Max" value={searchState.sizeMax} onChange={(value) => updateField('sizeMax', value)} placeholder="1048576" type="number" min="0" />
                      <FilterField className="min-w-[170px] flex-1" label="Modified From" value={searchState.modifiedFrom} onChange={(value) => updateField('modifiedFrom', value)} type="date" />
                      <FilterField className="min-w-[170px] flex-1" label="Modified To" value={searchState.modifiedTo} onChange={(value) => updateField('modifiedTo', value)} type="date" />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-dark-text-faint">{resultSummary}</span>
              {localRefinementsActive && (
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                  Loaded results only
                </span>
              )}
              {effectiveSort.field === 'relevance' && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-dark-surface-2 dark:text-dark-text-muted">
                  Relevance
                </span>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => updateField('format', '')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  searchState.format === ''
                    ? 'bg-primary dark:bg-dark-accent text-white dark:text-dark-bg border-primary dark:border-dark-accent'
                    : 'bg-white dark:bg-dark-surface text-on-surface-variant dark:text-dark-text-muted border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                All
              </button>
              {(availableFormats.length > 0 ? availableFormats : KNOWN_FORMATS).map((format) => (
                <button
                  key={format}
                  onClick={() => updateField('format', searchState.format === format ? '' : format)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    searchState.format === format
                      ? 'bg-primary dark:bg-dark-accent text-white dark:text-dark-bg border-primary dark:border-dark-accent'
                      : `${FORMAT_COLORS[format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'} border-transparent hover:border-slate-300 dark:hover:border-slate-600`
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800/40 dark:bg-rose-900/20">
              <span className="material-symbols-outlined text-rose-400 dark:text-rose-300">error</span>
              <p className="text-sm text-rose-600 dark:text-rose-300 font-medium">{error}</p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-dark-surface-2 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && displayedResults.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 lg:hidden">
                {displayedResults.map((asset, index) => (
                  <MobileAssetCard
                    key={asset.id || `${asset.path}-${index}`}
                    asset={asset}
                    onOpen={openDetail}
                    settings={settings}
                  />
                ))}
              </div>

              <div className="browser-results-table hidden lg:block bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
                <table className="density-table table-fixed w-full text-sm">
                  <colgroup>
                    <col className="w-[33%]" />
                    <col className="w-[11%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[64px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-dark-border bg-slate-50/60 dark:bg-dark-surface-2">
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Asset', 'asset')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Version', 'version')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Uploader', 'uploader')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Repository', 'repository')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Format', 'format')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Size', 'size')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">{renderSortHeader('Last Modified', 'lastModified')}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedResults.map((asset, index) => {
                      const fileName = getAssetFileName(asset) || '—';
                      const assetName = getAssetName(asset) || fileName;
                      const version = getAssetVersion(asset);
                      const icon = fileIcon(asset.path || '');
                      const fmtColor = FORMAT_COLORS[asset.format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

                      return (
                        <tr
                          key={asset.id || `${asset.path}-${index}`}
                          className="border-b border-slate-50 dark:border-dark-border hover:bg-slate-50/60 dark:hover:bg-dark-surface-2/70 transition-colors cursor-pointer"
                          onClick={() => openDetail(asset)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 w-full items-center gap-2.5">
                              <span className="material-symbols-outlined text-slate-300 dark:text-dark-text-faint text-[18px] flex-shrink-0">{icon}</span>
                              <div className="min-w-0 w-full">
                                <p className="font-semibold text-primary dark:text-dark-text truncate" title={assetName}>{assetName}</p>
                                {fileName !== assetName && (
                                  <p className="text-[11px] text-on-surface-variant dark:text-dark-text-muted truncate" title={fileName}>
                                    File: {fileName}
                                  </p>
                                )}
                                {asset.path && (
                                  <p className="text-[10px] text-slate-400 dark:text-dark-text-faint font-mono truncate" title={asset.path}>{asset.path}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant dark:text-dark-text-muted tabular-nums">
                            <span className="block truncate" title={version || '—'}>{version || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs font-medium text-on-surface-variant dark:text-dark-text-muted">{formatUploader(asset)}</p>
                              {asset.uploadedAt && (
                                <p className="text-[10px] text-slate-400 dark:text-dark-text-faint whitespace-nowrap">
                                  {formatDate(asset.uploadedAt)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-on-surface-variant dark:text-dark-text-muted">{asset.repository || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fmtColor}`}>{asset.format || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant dark:text-dark-text-muted tabular-nums">
                            {asset.fileSize != null ? formatSize(asset.fileSize) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant dark:text-dark-text-muted whitespace-nowrap">
                            {formatDate(asset.lastModified || asset.blobCreated)}
                          </td>
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {buildNexusBrowseUrl(settings, asset.repository, asset.path, asset) && (
                              <a
                                href={buildNexusBrowseUrl(settings, asset.repository, asset.path, asset)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent-dim/30 dark:hover:bg-dark-accent-dim/30"
                                title="Open in Nexus"
                              >
                                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {continuationToken && (
                  <div className="px-4 py-4 border-t border-slate-50 dark:border-dark-border flex justify-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={loadMore}
                        disabled={loading || loadingMore || loadingAll}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-50"
                      >
                        {loadingMore && !loadingAll
                          ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading…</>
                          : <><span className="material-symbols-outlined text-[16px]">expand_more</span> Load More</>}
                      </button>
                      <button
                        onClick={loadAll}
                        disabled={loading || loadingMore || loadingAll}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-sm font-bold text-white transition-colors hover:bg-black dark:bg-dark-accent dark:text-dark-bg dark:hover:opacity-90 disabled:opacity-50"
                      >
                        {loadingAll
                          ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading All…</>
                          : <><span className="material-symbols-outlined text-[16px]">unfold_more</span> Load All</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {continuationToken && (
                <div className="lg:hidden flex justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={loadMore}
                      disabled={loading || loadingMore || loadingAll}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-50"
                    >
                      {loadingMore && !loadingAll
                        ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading…</>
                        : <><span className="material-symbols-outlined text-[16px]">expand_more</span> Load More</>}
                    </button>
                    <button
                      onClick={loadAll}
                      disabled={loading || loadingMore || loadingAll}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-sm font-bold text-white transition-colors hover:bg-black dark:bg-dark-accent dark:text-dark-bg dark:hover:opacity-90 disabled:opacity-50"
                    >
                      {loadingAll
                        ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading All…</>
                        : <><span className="material-symbols-outlined text-[16px]">unfold_more</span> Load All</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border text-center gap-3">
              <span className="material-symbols-outlined text-slate-200 dark:text-dark-border text-[56px]">manage_search</span>
              <p className="font-bold text-on-surface-variant dark:text-dark-text-muted">No assets found</p>
              <p className="text-sm text-slate-400 dark:text-dark-text-faint max-w-xs">Try a different keyword, adjust the Nexus filters, or broaden the repository/format scope.</p>
            </div>
          )}

          {!loading && !error && results.length > 0 && displayedResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-surface rounded-2xl border border-cyan-100 dark:border-cyan-900/30 text-center gap-3">
              <span className="material-symbols-outlined text-cyan-300 dark:text-cyan-500 text-[56px]">filter_alt</span>
              <p className="font-bold text-on-surface-variant dark:text-dark-text-muted">No matching loaded results</p>
              <p className="text-sm text-slate-400 dark:text-dark-text-faint max-w-xs">Nexus returned assets, but the local refinement layer filtered all currently loaded rows out.</p>
              {continuationToken && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={loadMore}
                    disabled={loading || loadingMore || loadingAll}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-surface-2"
                  >
                    {loadingMore && !loadingAll
                      ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading…</>
                      : <><span className="material-symbols-outlined text-[16px]">expand_more</span> Load More</>}
                  </button>
                  <button
                    onClick={loadAll}
                    disabled={loading || loadingMore || loadingAll}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-dark-accent dark:text-dark-bg dark:hover:opacity-90"
                  >
                    {loadingAll
                      ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading All…</>
                      : <><span className="material-symbols-outlined text-[16px]">unfold_more</span> Load All</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeDetail}>
          <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-dark-surface w-full max-w-lg h-full shadow-2xl dark:shadow-black/40 overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[22px] text-slate-400 dark:text-dark-text-faint">{fileIcon(detail.path || '')}</span>
                <h3 className="font-bold text-primary dark:text-dark-text truncate max-w-[300px]">
                  {getAssetName(detail) || getAssetFileName(detail) || detail.id || 'Asset'}
                </h3>
              </div>
              <button onClick={closeDetail} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-dark-surface-2">
                <span className="material-symbols-outlined text-slate-400 dark:text-dark-text-faint">close</span>
              </button>
            </div>

            {detailLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {[...Array(6)].map((_, i) => <div key={i} className="h-4 rounded bg-slate-100 dark:bg-dark-surface-2 animate-pulse" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-6 p-6">
                {detail.detailError && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>{detail.detailError}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {buildNexusBrowseUrl(settings, detail.repository, detail.path, detail) && (
                    <a
                      href={buildNexusBrowseUrl(settings, detail.repository, detail.path, detail)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary dark:bg-dark-accent text-white dark:text-dark-bg text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      View in Nexus
                    </a>
                  )}
                  {detail.downloadUrl && (
                    <a
                      href={detail.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Download
                    </a>
                  )}
                  {detail.downloadUrl && (
                    <button
                      onClick={() => copyDetailLink(detail)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      Copy Nexus Link
                    </button>
                  )}
                  <button
                    onClick={shareSearchUrl}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">share</span>
                    Share Search
                  </button>
                </div>
                {copyMessage && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    {copyMessage}
                  </p>
                )}

                {activeChips.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Active Filters</p>
                    <div className="flex flex-wrap gap-2">
                      {activeChips.map((chip) => (
                        <span
                          key={`${chip.scope}-${chip.key}`}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            chip.scope === 'local'
                              ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/40 dark:bg-cyan-900/20 dark:text-cyan-300'
                              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text-muted'
                          }`}
                        >
                          {chip.label}: {chip.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Asset Name', getAssetName(detail)],
                    ['File Name', getAssetFileName(detail)],
                    ['Uploaded By', formatUploader(detail)],
                    ['Uploaded At', detail.uploadedAt ? formatDate(detail.uploadedAt) : null],
                    ['Path', detail.path],
                    ['Repository', detail.repository],
                    ['Format', detail.format],
                    ['Version', getAssetVersion(detail)],
                    ['Size', detail.fileSize != null ? formatSize(detail.fileSize) : null],
                    ['Content Type', detail.contentType],
                    ['Last Modified', formatDate(detail.lastModified || detail.blobCreated)],
                    ['ID', detail.id],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">{label}</p>
                      <p className="text-sm font-medium text-primary dark:text-dark-text break-all">{value}</p>
                    </div>
                  ))}
                </div>

                {detail.checksum && Object.keys(detail.checksum).length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Checksums</p>
                    {Object.entries(detail.checksum).map(([algo, value]) => (
                      <div key={algo} className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-dark-text-faint">{algo}</p>
                        <p className="text-[11px] font-mono text-on-surface-variant dark:text-dark-text-muted break-all bg-slate-50 dark:bg-dark-surface-2 px-3 py-2 rounded-lg">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
