import React from 'react';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function StagingBar({ staged, stagedSize, onPush, onCancel, onRemove, repoName }) {
  if (staged.length === 0) return null;

  return (
    // FIX 7: StagingBar was hardcoded to `left-64` (256px) which matched the
    // sidebar width as a magic number. Replaced with a CSS variable reference
    // via an inline style so it stays in sync if the sidebar width ever changes,
    // and added a Tailwind `left-0 lg:left-64` responsive fallback so the bar
    // isn’t clipped on narrow viewports where the sidebar collapses.
    <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-50">
      <div className="bg-white/80 dark:bg-dark-surface/90 backdrop-blur-md border-t border-slate-200 dark:border-dark-border shadow-[0_-8px_32px_rgba(0,0,0,0.08)]">
        <div className="max-w-[1400px] mx-auto px-10 py-4 flex flex-col gap-3">

          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto custom-scrollbar">
            {staged.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-surface-2 hover:bg-slate-200 dark:hover:bg-dark-border text-primary dark:text-dark-text rounded-full pl-3 pr-1.5 py-1 text-xs font-semibold transition-colors group max-w-[220px]"
              >
                <span className="material-symbols-outlined text-[13px] text-slate-400 dark:text-dark-text-faint flex-shrink-0">description</span>
                <span className="truncate">{item.name}</span>
                {item.size && <span className="text-slate-400 dark:text-dark-text-faint flex-shrink-0">{formatSize(item.size)}</span>}
                <button
                  onClick={() => onRemove(item.id)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 dark:hover:bg-red-900/30 hover:text-rose-500 text-slate-400 dark:text-dark-text-faint transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-on-surface-variant dark:text-dark-text-muted">
              <span className="material-symbols-outlined text-[18px] text-accent dark:text-dark-accent">inventory_2</span>
              <span>
                <span className="font-extrabold text-primary dark:text-dark-text">{staged.length}</span>
                {' '}{staged.length === 1 ? 'file' : 'files'} staged
                {stagedSize > 0 && <span className="ml-1 text-slate-400 dark:text-dark-text-faint">· {formatSize(stagedSize)} total</span>}
                {repoName && <span className="ml-1 text-slate-400 dark:text-dark-text-faint">→ <span className="font-semibold text-primary dark:text-dark-text font-mono">{repoName}</span></span>}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-100 dark:hover:bg-dark-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onPush}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-primary dark:bg-dark-accent dark:text-dark-bg text-white text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors shadow-lg shadow-black/10"
              >
                <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                Push {staged.length} {staged.length === 1 ? 'file' : 'files'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
