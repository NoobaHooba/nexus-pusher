import React, { useState, useEffect, useCallback } from 'react';

const HISTORY_KEY = 'nexus-pusher-history';

const STATUS_STYLES = {
  done:    { badge: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  error:   { badge: 'bg-rose-100 text-rose-700',     icon: 'report' },
  warning: { badge: 'bg-amber-100 text-amber-700',   icon: 'info' },
};

const FORMAT_COLORS = {
  maven2: 'bg-orange-100 text-orange-700',
  maven:  'bg-orange-100 text-orange-700',
  npm:    'bg-red-100 text-red-700',
  docker: 'bg-blue-100 text-blue-700',
  pypi:   'bg-yellow-100 text-yellow-700',
  nuget:  'bg-purple-100 text-purple-700',
  helm:   'bg-indigo-100 text-indigo-700',
  yum:    'bg-green-100 text-green-700',
  apt:    'bg-teal-100 text-teal-700',
  raw:    'bg-slate-100 text-slate-600',
};

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function exportCsv(entries) {
  const header = ['Timestamp', 'File', 'Size', 'Repo Type', 'Repo Name', 'Status', 'Message', 'Nexus URL'];
  const rows = entries.map(e => [
    formatDate(e.timestamp),
    e.name,
    formatSize(e.size),
    e.repoType,
    e.repoName,
    e.status,
    e.statusText || '',
    e.nexusUiUrl || e.directUrl || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-pusher-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function HistoryPage() {
  const [history, setHistory]   = useState(loadHistory);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType]     = useState('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Reload from storage whenever the tab becomes visible
  useEffect(() => {
    const handler = () => setHistory(loadHistory());
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const refresh = useCallback(() => setHistory(loadHistory()), []);

  const clearAll = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    setShowClearConfirm(false);
  };

  const allTypes = [...new Set(history.map(e => e.repoType).filter(Boolean))].sort();

  const filtered = history.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.name?.toLowerCase().includes(q) ||
      e.repoName?.toLowerCase().includes(q) ||
      e.statusText?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchType   = filterType === 'all'   || e.repoType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  // Summary stats
  const totalUploaded = history.filter(e => e.status === 'done').length;
  const totalFailed   = history.filter(e => e.status === 'error').length;
  const totalBytes    = history.filter(e => e.status === 'done').reduce((a, e) => a + (e.size || 0), 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">Upload History</h2>
          <p className="text-on-surface-variant mt-1">Every upload this browser has made, stored locally.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-on-surface-variant hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
          <button
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-on-surface-variant hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-sm font-semibold text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            Clear All
          </button>
        </div>
      </div>

      {/* Confirm clear dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-5">
            <h3 className="text-lg font-extrabold text-primary">Clear all history?</h3>
            <p className="text-sm text-on-surface-variant">This permanently removes all {history.length} records from your browser. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50">Cancel</button>
              <button onClick={clearAll} className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600">Yes, clear all</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary leading-none">{totalUploaded}</p>
            <p className="text-xs font-semibold text-on-surface-variant mt-0.5">Successful uploads</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-rose-400 text-[20px]">report</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary leading-none">{totalFailed}</p>
            <p className="text-xs font-semibold text-on-surface-variant mt-0.5">Failed uploads</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-dim/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-accent text-[20px]">storage</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary leading-none">{formatSize(totalBytes)}</p>
            <p className="text-xs font-semibold text-on-surface-variant mt-0.5">Total pushed</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename, repo, or message…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          {['all','done','error','warning'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                filterStatus === s ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All statuses' : s}
            </button>
          ))}
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
        >
          <option value="all">All formats</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-slate-200 text-[56px] mb-3">history</span>
          <p className="font-bold text-on-surface-variant">No upload history yet</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">Every upload you make will be recorded here automatically.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">File</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Size</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Format</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Repository</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Time</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-on-surface-variant text-sm">No records match your filters.</td>
                </tr>
              ) : filtered.map((entry, i) => {
                const s = STATUS_STYLES[entry.status] || STATUS_STYLES.error;
                return (
                  <tr key={entry.id ?? i} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-300 text-[16px]">description</span>
                        <span className="font-semibold text-primary truncate max-w-[200px]" title={entry.name}>{entry.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant tabular-nums">{formatSize(entry.size)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FORMAT_COLORS[entry.repoType] || 'bg-slate-100 text-slate-600'}`}>
                        {entry.repoType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant font-mono text-xs">{entry.repoName || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.badge}`}>
                        <span className="material-symbols-outlined text-[12px]">{s.icon}</span>
                        {entry.status === 'done' ? 'Success' : entry.status === 'error' ? 'Failed' : 'Duplicate'}
                      </span>
                      {entry.statusText && entry.status !== 'done' && (
                        <p className="text-[10px] text-slate-400 mt-0.5 max-w-[180px] truncate" title={entry.statusText}>{entry.statusText}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-on-surface-variant whitespace-nowrap">{formatDate(entry.timestamp)}</td>
                    <td className="px-5 py-3">
                      {entry.nexusUiUrl ? (
                        <a
                          href={entry.nexusUiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                        >
                          <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                          View
                        </a>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-50 text-xs text-slate-400 font-medium">
              Showing {filtered.length} of {history.length} records
            </div>
          )}
        </div>
      )}
    </div>
  );
}
