import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiUrl } from '../lib/backendApi';
import { buildNexusBrowseUrl, rewriteNexusUrl } from '../lib/nexusLinks';

const STATUS_STYLES = {
  success: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: 'check_circle', label: 'Success' },
  error:   { badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', icon: 'report', label: 'Failed' },
  warning: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: 'info', label: 'Duplicate' },
  // legacy localStorage statuses
  done:    { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: 'check_circle', label: 'Success' },
};

const FORMAT_COLORS = {
  maven2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  maven:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  npm:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  docker: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pypi:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  nuget:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  helm:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  yum:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  apt:    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  raw:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const STAT_CARDS = [
  {
    key: 'success',
    icon: 'check_circle',
    label: 'Successful (this page)',
    iconWrapClass: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconClass: 'text-emerald-500 dark:text-emerald-300',
  },
  {
    key: 'error',
    icon: 'report',
    label: 'Failed (this page)',
    iconWrapClass: 'bg-rose-50 dark:bg-rose-900/20',
    iconClass: 'text-rose-500 dark:text-rose-300',
  },
  {
    key: 'bytes',
    icon: 'storage',
    label: 'Pushed (this page)',
    iconWrapClass: 'bg-accent-dim dark:bg-dark-accent-dim',
    iconClass: 'text-accent dark:text-dark-accent',
  },
];

const PAGE_SIZE = 50;

function formatSize(bytes) {
  if (bytes == null || bytes === '') return '\u2014';
  bytes = Number(bytes);
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(ts) {
  if (!ts) return '\u2014';
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function exportCsv(rows, settings) {
  const header = ['Timestamp', 'User', 'File', 'Size', 'Format', 'Repository', 'Version', 'Path', 'Status', 'Error', 'Nexus URL'];
  const lines = rows.map(r => [
    formatDate(r.ts || r.timestamp),
    r.username || '',
    r.filename || r.name || '',
    formatSize(r.size),
    r.type || r.repoType || '',
    r.repo || r.repoName || '',
    r.version || '',
    r.path || '',
    r.status,
    r.error || '',
    buildNexusBrowseUrl(settings, r.repo || r.repoName, r.path, r) || rewriteNexusUrl(settings, r.nexus_url || r.nexusUiUrl || ''),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv  = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `nexus-pusher-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function HistoryPage({ settings }) {
  const [rows,   setRows]   = useState([]);
  const [total,  setTotal]  = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState(null);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType,   setFilterType]   = useState('all');
  const [offset,       setOffset]       = useState(0);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing,         setClearing]         = useState(false);

  // debounce search input
  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch)         params.set('search', debouncedSearch);
      if (filterStatus !== 'all')  params.set('status', filterStatus);
      if (filterType   !== 'all')  params.set('type',   filterType);
      // scope by current Nexus username so each user sees their own uploads
      if (settings?.username)      params.set('username', settings.username);
      params.set('limit',  PAGE_SIZE);
      params.set('offset', offset);

      const res  = await fetch(apiUrl(settings, `/api/history?${params}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows  ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterStatus, filterType, offset, settings]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // re-fetch when the tab becomes visible (user switched away during an upload)
  useEffect(() => {
    const handler = () => { if (!document.hidden) fetchHistory(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchHistory]);

  const clearAll = async () => {
    setClearing(true);
    try {
      await fetch(apiUrl(settings, '/api/history'), {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: settings?.username || '*' }),
      });
      setRows([]);
      setTotal(0);
      setOffset(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  const totalPages   = Math.ceil(total / PAGE_SIZE);
  const currentPage  = Math.floor(offset / PAGE_SIZE) + 1;

  const successCount = rows.filter(r => r.status === 'success' || r.status === 'done').length;
  const errorCount   = rows.filter(r => r.status === 'error').length;
  const totalBytes   = rows.filter(r => r.status === 'success' || r.status === 'done')
                           .reduce((a, r) => a + (r.size || 0), 0);

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-primary dark:text-dark-text">Upload History</h2>
          <p className="text-on-surface-variant dark:text-dark-text-muted mt-1">
            {settings?.username
              ? <>Uploads by <span className="font-semibold text-primary dark:text-dark-text">{settings.username}</span> — persisted on the server.</>
              : 'All uploads — persisted on the server.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setOffset(0); fetchHistory(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-semibold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
          <button
            onClick={() => exportCsv(rows, settings)}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-semibold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 text-sm font-semibold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            Clear
          </button>
        </div>
      </div>

      {/* Confirm clear */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl dark:shadow-black/40 p-8 max-w-sm w-full flex flex-col gap-5">
            <h3 className="text-lg font-extrabold text-primary dark:text-dark-text">Clear history?</h3>
            <p className="text-sm text-on-surface-variant dark:text-dark-text-muted">
              This permanently removes {settings?.username ? `all records for ${settings.username}` : 'all records'} from the server database.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2">
                Cancel
              </button>
              <button onClick={clearAll} disabled={clearing} className="flex-1 py-3 rounded-xl bg-rose-500 dark:bg-rose-600 text-white text-sm font-bold hover:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60">
                {clearing ? 'Clearing…' : 'Yes, clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {STAT_CARDS.map(({ key, icon, label, iconWrapClass, iconClass }) => {
          const value = key === 'success' ? successCount : key === 'error' ? errorCount : formatSize(totalBytes);
          return (
            <div key={label} className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${iconWrapClass} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${iconClass} text-[20px]`}>{icon}</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-primary dark:text-dark-text leading-none">{value}</p>
                <p className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted mt-0.5">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 bg-white dark:bg-dark-surface placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
          {['all', 'success', 'error', 'warning'].map(s => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setOffset(0); }}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                filterStatus === s
                  ? 'bg-primary dark:bg-dark-accent text-white dark:text-dark-bg'
                  : 'bg-white dark:bg-dark-surface text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setOffset(0); }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white dark:bg-dark-surface"
        >
          <option value="all">All formats</option>
          {['maven', 'npm', 'pypi', 'docker', 'nuget', 'helm', 'yum', 'apt', 'raw'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {total > 0 && (
          <span className="ml-auto text-xs text-slate-400 dark:text-dark-text-faint font-medium">
            {total.toLocaleString()} total record{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-sm text-rose-700 dark:text-rose-300">
          <span className="material-symbols-outlined text-[18px]">error</span>
          Failed to load history: {error}
          <button onClick={fetchHistory} className="ml-auto text-xs font-bold underline">Retry</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-dark-surface-2 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-slate-200 dark:text-dark-border text-[56px] mb-3">history</span>
          <p className="font-bold text-on-surface-variant dark:text-dark-text-muted">No upload history yet</p>
          <p className="text-sm text-slate-400 dark:text-dark-text-faint mt-1 max-w-xs">Every upload you make will be recorded here automatically.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-dark-border">
                {['File', 'Size', 'Format', 'Repository', 'User', 'Status', 'Time'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const s        = STATUS_STYLES[row.status] || STATUS_STYLES.error;
                const filename = row.filename || row.name || '\u2014';
                const repoType = row.type     || row.repoType || '';
                const repoName = row.repo     || row.repoName || '\u2014';
                const ts       = row.ts       || row.timestamp;
                const nexusUrl = buildNexusBrowseUrl(settings, row.repo || row.repoName, row.path, row) || rewriteNexusUrl(settings, row.nexus_url || row.nexusUiUrl || '');
                return (
                  <tr key={row.id ?? i} className={`border-b border-slate-50 dark:border-dark-border hover:bg-slate-50/60 dark:hover:bg-dark-surface-2/70 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-300 dark:text-dark-text-faint text-[16px]">description</span>
                        <span className="font-semibold text-primary dark:text-dark-text truncate max-w-[200px]" title={filename}>{filename}</span>
                        {nexusUrl && (
                          <a href={nexusUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/70">
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                        )}
                      </div>
                      {(row.path || row.version) && (
                        <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-dark-text-faint truncate max-w-[260px]" title={row.path || row.version}>
                          {row.path || `v${row.version}`}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant dark:text-dark-text-muted tabular-nums">{formatSize(row.size)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FORMAT_COLORS[repoType] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {repoType || '\u2014'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant dark:text-dark-text-muted font-mono text-xs">{repoName}</td>
                    <td className="px-5 py-3 text-on-surface-variant dark:text-dark-text-muted text-xs">{row.username || '\u2014'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.badge}`}>
                        <span className="material-symbols-outlined text-[12px]">{s.icon}</span>
                        {s.label}
                      </span>
                      {row.error && (
                        <p className="text-[10px] text-slate-400 dark:text-dark-text-faint mt-0.5 max-w-[180px] truncate" title={row.error}>{row.error}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant dark:text-dark-text-muted whitespace-nowrap">{formatDate(ts)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-50 dark:border-dark-border flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-dark-text-faint font-medium">
                Page {currentPage} of {totalPages} — {total.toLocaleString()} records
              </span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-border text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setOffset(o => o + PAGE_SIZE)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-border text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {totalPages <= 1 && rows.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-50 dark:border-dark-border text-xs text-slate-400 dark:text-dark-text-faint font-medium">
              Showing {rows.length} of {total} records
            </div>
          )}
        </div>
      )}
    </div>
  );
}
