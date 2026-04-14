import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── format colour map ────────────────────────────────────────────────────────
const FORMAT_COLORS = {
  maven2:  'bg-orange-100 text-orange-700',
  npm:     'bg-red-100    text-red-700',
  docker:  'bg-blue-100   text-blue-700',
  pypi:    'bg-yellow-100 text-yellow-700',
  nuget:   'bg-purple-100 text-purple-700',
  helm:    'bg-indigo-100 text-indigo-700',
  yum:     'bg-green-100  text-green-700',
  apt:     'bg-teal-100   text-teal-700',
  raw:     'bg-slate-100  text-slate-600',
  r:       'bg-cyan-100   text-cyan-700',
  rubygems:'bg-rose-100   text-rose-700',
};

const KNOWN_FORMATS = ['maven2','npm','docker','pypi','nuget','helm','yum','apt','raw'];

function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024)              return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function fileIcon(path) {
  const ext = (path || '').split('.').pop().toLowerCase();
  const map = {
    jar: 'data_object', war: 'web', ear: 'web', zip: 'folder_zip',
    tgz: 'archive', gz: 'archive', tar: 'archive', 'tar.gz': 'archive',
    deb: 'package_2', rpm: 'package_2', nupkg: 'package_2',
    whl: 'settings', egg: 'settings',
    tgz2: 'archive', pom: 'description', xml: 'code',
    json: 'data_object', yaml: 'code', yml: 'code',
    md: 'description', txt: 'description',
    sha1: 'lock', sha256: 'lock', sha512: 'lock', md5: 'lock',
    png: 'image', jpg: 'image', jpeg: 'image', svg: 'image',
  };
  return map[ext] || 'draft';
}

// ─── api helpers ─────────────────────────────────────────────────────────────
async function apiFetch(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function BrowserPage({ settings }) {
  const { nexusUrl, username, password } = settings || {};

  // repos
  const [repos, setRepos]         = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError]     = useState(null);

  // filters
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [keyword, setKeyword]           = useState('');
  const [inputValue, setInputValue]     = useState('');
  const debounceRef = useRef(null);

  // results
  const [results, setResults]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [continuationToken, setContinuationToken] = useState(null);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [totalLoaded, setTotalLoaded]   = useState(0);

  // detail drawer
  const [detail, setDetail]             = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── load repos on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!nexusUrl) return;
    setReposLoading(true);
    apiFetch('/api/browse/repos', { nexusUrl, username, password })
      .then(data => { setRepos(Array.isArray(data) ? data : []); setReposError(null); })
      .catch(err => setReposError(err.message))
      .finally(() => setReposLoading(false));
  }, [nexusUrl, username, password]);

  // ── search ───────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (kw, repo, fmt, token, append) => {
    if (!nexusUrl) return;
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await apiFetch('/api/browse/search', {
        nexusUrl, username, password,
        keyword: kw, repository: repo, format: fmt,
        continuationToken: token || undefined,
      });
      const items = data.items || [];
      if (append) {
        setResults(r => [...r, ...items]);
        setTotalLoaded(t => t + items.length);
      } else {
        setResults(items);
        setTotalLoaded(items.length);
      }
      setContinuationToken(data.continuationToken || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [nexusUrl, username, password]);

  // initial + filter change search
  useEffect(() => {
    doSearch(keyword, selectedRepo, selectedFormat, null, false);
  }, [keyword, selectedRepo, selectedFormat, doSearch]);

  // debounce keyword input
  const handleInput = (val) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setKeyword(val), 400);
  };

  // load more
  const loadMore = () => {
    if (continuationToken && !loadingMore)
      doSearch(keyword, selectedRepo, selectedFormat, continuationToken, true);
  };

  // ── detail ────────────────────────────────────────────────────────────────
  const openDetail = async (asset) => {
    setDetail(asset);
    if (!asset.id) return;
    setDetailLoading(true);
    try {
      const full = await apiFetch('/api/browse/asset', { nexusUrl, username, password, id: asset.id });
      setDetail(full);
    } catch (_) { /* keep the partial asset */ }
    finally { setDetailLoading(false); }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const availableFormats = [...new Set(repos.map(r => r.format).filter(Boolean))].sort();

  if (!nexusUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
        <span className="material-symbols-outlined text-slate-200 text-[64px]">cloud_off</span>
        <p className="font-bold text-on-surface-variant">No Nexus URL configured</p>
        <p className="text-sm text-slate-400 max-w-xs">Open Settings and enter your Nexus instance URL to start browsing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h2 className="text-4xl font-extrabold tracking-tight text-primary">Repository Browser</h2>
        <p className="text-on-surface-variant mt-1">Search and explore artifacts across all your Nexus repositories.</p>
      </div>

      {/* Main layout: repo sidebar + content */}
      <div className="flex gap-6 items-start">

        {/* ── Repo sidebar ──────────────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Repositories</p>
          </div>
          {reposLoading && (
            <div className="flex flex-col gap-2 p-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton skeleton-text h-8 rounded-lg" />
              ))}
            </div>
          )}
          {reposError && (
            <p className="text-xs text-rose-400 p-4">{reposError}</p>
          )}
          {!reposLoading && !reposError && (
            <ul role="list" className="py-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              <li>
                <button
                  onClick={() => setSelectedRepo('')}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    selectedRepo === '' ? 'bg-accent-dim/40 text-accent font-bold' : 'text-on-surface-variant hover:bg-slate-50'
                  }`}
                >
                  All repositories
                </button>
              </li>
              {repos.map(repo => (
                <li key={repo.name}>
                  <button
                    onClick={() => setSelectedRepo(repo.name)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selectedRepo === repo.name
                        ? 'bg-accent-dim/40 text-accent font-bold'
                        : 'text-on-surface-variant hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] flex-shrink-0 opacity-50">database</span>
                      <span className="truncate">{repo.name}</span>
                    </div>
                    {repo.format && (
                      <span className={`ml-6 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-500'
                      }`}>
                        {repo.format}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ── Content area ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Search bar */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input
                value={inputValue}
                onChange={e => handleInput(e.target.value)}
                placeholder="Search artifacts by name, group, version…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 bg-white"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); setKeyword(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Format filter chips */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedFormat('')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  selectedFormat === '' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-slate-200 hover:border-slate-300'
                }`}
              >
                All
              </button>
              {(availableFormats.length > 0 ? availableFormats : KNOWN_FORMATS).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt === selectedFormat ? '' : fmt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    selectedFormat === fmt
                      ? 'bg-primary text-white border-primary'
                      : `${FORMAT_COLORS[fmt] || 'bg-slate-100 text-slate-600'} border-transparent hover:border-slate-300`
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          {!loading && (
            <p className="text-xs text-slate-400 font-medium">
              {results.length === 0 && !error ? 'No assets found' : `${totalLoaded} asset${totalLoaded !== 1 ? 's' : ''} loaded`}
              {continuationToken ? ' · more available' : ''}
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
              <span className="material-symbols-outlined text-rose-400">error</span>
              <p className="text-sm text-rose-600 font-medium">{error}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          )}

          {/* Results table */}
          {!loading && results.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Asset</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Repository</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Format</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Size</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Last Modified</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((asset, i) => {
                    const name = asset.path?.split('/').pop() || asset.id || '—';
                    const icon = fileIcon(asset.path || '');
                    const fmtColor = FORMAT_COLORS[asset.format] || 'bg-slate-100 text-slate-600';
                    return (
                      <tr
                        key={asset.id || i}
                        className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer"
                        onClick={() => openDetail(asset)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-slate-300 text-[18px] flex-shrink-0">{icon}</span>
                            <div className="min-w-0">
                              <p className="font-semibold text-primary truncate max-w-[280px]" title={name}>{name}</p>
                              {asset.path && (
                                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]" title={asset.path}>{asset.path}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-on-surface-variant">{asset.repository || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fmtColor}`}>{asset.format || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant tabular-nums">
                          {asset.fileSize != null ? formatSize(asset.fileSize) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                          {formatDate(asset.lastModified || asset.blobCreated)}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {asset.downloadUrl && (
                            <a
                              href={asset.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                              Open
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Load more */}
              {continuationToken && (
                <div className="px-4 py-4 border-t border-slate-50 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {loadingMore
                      ? <><span className="material-symbols-outlined text-[16px] animate-spin">refresh</span> Loading…</>
                      : <><span className="material-symbols-outlined text-[16px]">expand_more</span> Load more</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 text-center gap-3">
              <span className="material-symbols-outlined text-slate-200 text-[56px]">manage_search</span>
              <p className="font-bold text-on-surface-variant">No assets found</p>
              <p className="text-sm text-slate-400 max-w-xs">Try a different keyword, select a repository, or clear the format filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail drawer ───────────────────────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[22px] text-slate-400">{fileIcon(detail.path || '')}</span>
                <h3 className="font-bold text-primary truncate max-w-[300px]">
                  {detail.path?.split('/').pop() || detail.id || 'Asset'}
                </h3>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {detailLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton skeleton-text" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-6 p-6">
                {/* Action buttons */}
                <div className="flex gap-3">
                  {detail.downloadUrl && (
                    <a
                      href={detail.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-black transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Download
                    </a>
                  )}
                  {detail.downloadUrl && (
                    <button
                      onClick={() => navigator.clipboard.writeText(detail.downloadUrl)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      Copy URL
                    </button>
                  )}
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ['Path',          detail.path],
                    ['Repository',    detail.repository],
                    ['Format',        detail.format],
                    ['Size',          detail.fileSize != null ? formatSize(detail.fileSize) : null],
                    ['Content Type',  detail.contentType],
                    ['Last Modified', formatDate(detail.lastModified || detail.blobCreated)],
                    ['ID',            detail.id],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-primary break-all">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Checksums */}
                {detail.checksum && Object.keys(detail.checksum).length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Checksums</p>
                    {Object.entries(detail.checksum).map(([algo, val]) => (
                      <div key={algo} className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{algo}</p>
                        <p className="text-[11px] font-mono text-on-surface-variant break-all bg-slate-50 px-3 py-2 rounded-lg">{val}</p>
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
