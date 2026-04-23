import React from 'react';

function formatWhen(timestamp) {
  try {
    return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export default function RecentActivity({ items, onReuse }) {
  return (
    <section className="bg-white dark:bg-dark-surface rounded-3xl border border-slate-100 dark:border-dark-border p-6 flex flex-col gap-4 shadow-sm">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">Stage 4 · Reuse Context</p>
        <h3 className="text-xl font-extrabold text-primary dark:text-dark-text mt-1">Recent Successful Pushes</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant dark:text-dark-text-muted">Successful uploads will appear here for one-click repo and metadata reuse.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 dark:bg-dark-surface-2 px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary dark:text-dark-text truncate">{item.fileName}</p>
                <p className="text-xs text-on-surface-variant dark:text-dark-text-muted truncate">
                  {item.repoType.toUpperCase()} · {item.repoName}
                  {item.path ? ` · ${item.path}` : ''}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-dark-text-faint">{formatWhen(item.timestamp)}</p>
              </div>
              <button
                onClick={() => onReuse(item)}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-dark-accent dark:text-dark-bg text-white text-sm font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                Reuse
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
