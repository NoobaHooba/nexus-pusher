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
    // Fixed bar pinned to bottom of the main content column (ml-64 matches sidebar width)
    <div className="fixed bottom-0 left-64 right-0 z-50">
      {/* Backdrop blur strip */}
      <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_32px_rgba(0,0,0,0.08)]">
        <div className="max-w-[1400px] mx-auto px-10 py-4 flex flex-col gap-3">

          {/* File chips row */}
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto custom-scrollbar">
            {staged.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-primary rounded-full pl-3 pr-1.5 py-1 text-xs font-semibold transition-colors group max-w-[220px]"
              >
                <span className="material-symbols-outlined text-[13px] text-slate-400 flex-shrink-0">description</span>
                <span className="truncate">{item.name}</span>
                {item.size && (
                  <span className="text-slate-400 flex-shrink-0">{formatSize(item.size)}</span>
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 hover:text-rose-500 text-slate-400 transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] text-accent">inventory_2</span>
              <span>
                <span className="font-extrabold text-primary">{staged.length}</span>
                {' '}{staged.length === 1 ? 'file' : 'files'} staged
                {stagedSize > 0 && (
                  <span className="ml-1 text-slate-400">· {formatSize(stagedSize)} total</span>
                )}
                {repoName && (
                  <span className="ml-1 text-slate-400">→ <span className="font-semibold text-primary font-mono">{repoName}</span></span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onPush}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-black transition-colors shadow-lg shadow-black/10"
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
