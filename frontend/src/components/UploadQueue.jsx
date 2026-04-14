import React from 'react';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',    bgClass: 'bg-slate-100 text-slate-500',      iconBg: 'bg-slate-50 text-slate-400',       icon: 'description',   cardClass: 'border-slate-50' },
  uploading: { label: 'Uploading',  bgClass: 'bg-accent text-white',             iconBg: 'bg-accent-dim text-accent',        icon: 'sync',          cardClass: 'border-accent/10 shadow-lg shadow-accent/5' },
  done:      { label: 'Done',       bgClass: 'bg-green-50 text-accent',          iconBg: 'bg-green-50 text-accent',          icon: 'check_circle',  cardClass: 'border-slate-50 opacity-80' },
  warning:   { label: 'Duplicate',  bgClass: 'bg-amber-50 text-amber-600',       iconBg: 'bg-amber-50 text-amber-500',       icon: 'info',          cardClass: 'border-amber-100' },
  error:     { label: 'Failed',     bgClass: 'bg-red-50 text-red-500',           iconBg: 'bg-red-50 text-red-500',           icon: 'report',        cardClass: 'border-slate-50' },
};

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function UploadQueue({ queue, onClearCompleted, onRetry }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Live Process Queue</h5>
        <button onClick={onClearCompleted} className="text-[11px] font-bold text-accent hover:underline uppercase tracking-wider">Clear Completed</button>
      </div>

      {queue.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <span className="material-symbols-outlined text-5xl mb-3">inbox</span>
          <p className="text-sm font-semibold">No uploads yet</p>
        </div>
      )}

      <div className="flex flex-col gap-3 custom-scrollbar overflow-y-auto max-h-[600px] pr-2">
        {queue.map((item) => {
          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          const isUploading = item.status === 'uploading';
          const isError     = item.status === 'error';
          const isWarning   = item.status === 'warning';
          const isDone      = item.status === 'done';
          return (
            <div key={item.id} className={`flex flex-col gap-4 p-5 bg-white rounded-2xl border shadow-sm transition-shadow hover:shadow-md relative overflow-hidden ${cfg.cardClass}`}>
              {isUploading && <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />}
              {isWarning   && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />}
              {isDone      && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-400" />}
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl ${cfg.iconBg}`}>
                  <span className={`material-symbols-outlined text-2xl ${isUploading ? 'animate-spin' : ''}`} style={isUploading ? { animationDuration: '3s' } : {}}>{cfg.icon}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate text-primary">{item.name}</p>
                  <p className={`text-[10px] font-semibold uppercase tracking-tight mt-0.5 ${
                    isUploading ? 'text-accent' : isError ? 'text-red-400' : isWarning ? 'text-amber-500' : 'text-on-surface-variant'
                  }`}>
                    {formatSize(item.size)}{item.speed ? ` • ${item.speed}` : ''}{item.statusText ? ` • ${item.statusText}` : ''}
                  </p>
                  {/* Nexus deep-link — shown on done items */}
                  {isDone && item.nexusUiUrl && (
                    <a
                      href={item.nexusUiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-accent hover:underline"
                    >
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                      View in Nexus
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isError && (
                    <button onClick={() => onRetry(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors">
                      <span className="material-symbols-outlined text-slate-400 text-lg">refresh</span>
                    </button>
                  )}
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase ${cfg.bgClass}`}>{cfg.label}</span>
                </div>
              </div>
              {isUploading && item.progress != null && (
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-accent h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {isWarning && item.statusText && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{item.statusText}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
