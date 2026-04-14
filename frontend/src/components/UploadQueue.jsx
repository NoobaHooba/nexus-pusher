import React, { useRef, useState } from 'react';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bgClass: 'bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted', iconBg: 'bg-slate-50 dark:bg-dark-surface-2 text-slate-400 dark:text-dark-text-faint', icon: 'description',  cardClass: 'border-slate-50 dark:border-dark-border' },
  uploading: { label: 'Uploading', bgClass: 'bg-accent text-white',                                                           iconBg: 'bg-accent-dim dark:bg-dark-accent-dim text-accent dark:text-dark-accent',      icon: 'sync',          cardClass: 'border-accent/10 shadow-lg shadow-accent/5' },
  done:      { label: 'Done',      bgClass: 'bg-green-50 dark:bg-green-900/20 text-accent dark:text-dark-accent',             iconBg: 'bg-green-50 dark:bg-green-900/20 text-accent dark:text-dark-accent',           icon: 'check_circle',  cardClass: 'border-slate-50 dark:border-dark-border opacity-80' },
  warning:   { label: 'Duplicate', bgClass: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',           iconBg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400',          icon: 'info',          cardClass: 'border-amber-100 dark:border-amber-800/40' },
  error:     { label: 'Failed',    bgClass: 'bg-red-50 dark:bg-red-900/20 text-red-500',                                      iconBg: 'bg-red-50 dark:bg-red-900/20 text-red-500',                                  icon: 'report',        cardClass: 'border-slate-50 dark:border-dark-border' },
};

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function UploadQueue({ queue, onClearCompleted, onRetry, onReorder }) {
  const dragItemId = useRef(null);
  const [overItemId, setOverItemId] = useState(null);

  const handleDragStart = (e, id) => { dragItemId.current = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)); };
  const handleDragOver  = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (id !== dragItemId.current) setOverItemId(id); };
  const handleDrop      = (e, toId) => { e.preventDefault(); if (dragItemId.current !== null && dragItemId.current !== toId) onReorder?.(dragItemId.current, toId); dragItemId.current = null; setOverItemId(null); };
  const handleDragEnd   = () => { dragItemId.current = null; setOverItemId(null); };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">Live Process Queue</h5>
          {queue.some(i => i.status === 'pending') && (
            <span className="text-[10px] text-slate-400 dark:text-dark-text-faint font-medium">(drag to reorder)</span>
          )}
        </div>
        <button onClick={onClearCompleted} className="text-[11px] font-bold text-accent dark:text-dark-accent hover:underline uppercase tracking-wider">Clear Completed</button>
      </div>

      {queue.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-dark-text-faint">
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
          const isPending   = item.status === 'pending';
          const isDragOver  = overItemId === item.id;
          return (
            <div
              key={item.id}
              draggable={isPending}
              onDragStart={isPending ? (e) => handleDragStart(e, item.id) : undefined}
              onDragOver={isPending  ? (e) => handleDragOver(e, item.id)  : undefined}
              onDrop={isPending      ? (e) => handleDrop(e, item.id)      : undefined}
              onDragEnd={isPending   ? handleDragEnd                       : undefined}
              onDragLeave={isPending ? () => setOverItemId(null)           : undefined}
              className={`flex flex-col gap-4 p-5 bg-white dark:bg-dark-surface rounded-2xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden
                ${cfg.cardClass}
                ${isDragOver ? 'ring-2 ring-accent/40 scale-[1.015] shadow-md' : ''}
                ${isPending ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
            >
              {isUploading && <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />}
              {isWarning   && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />}
              {isDone      && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-400" />}

              <div className="flex items-center gap-5">
                {isPending && (
                  <div className="flex-shrink-0 flex flex-col gap-[3px] opacity-30 hover:opacity-60 transition-opacity cursor-grab select-none">
                    {[0,1,2].map(r => (
                      <div key={r} className="flex gap-[3px]">
                        <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-dark-text-faint" />
                        <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-dark-text-faint" />
                      </div>
                    ))}
                  </div>
                )}

                <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl ${cfg.iconBg}`}>
                  <span className={`material-symbols-outlined text-2xl ${isUploading ? 'animate-spin' : ''}`} style={isUploading ? { animationDuration: '3s' } : {}}>{cfg.icon}</span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate text-primary dark:text-dark-text">{item.name}</p>
                  <p className={`text-[10px] font-semibold uppercase tracking-tight mt-0.5 ${
                    isUploading ? 'text-accent dark:text-dark-accent' : isError ? 'text-red-400' : isWarning ? 'text-amber-500' : 'text-on-surface-variant dark:text-dark-text-muted'
                  }`}>
                    {formatSize(item.size)}{item.speed ? ` • ${item.speed}` : ''}{item.statusText ? ` • ${item.statusText}` : ''}
                  </p>
                  {isDone && item.nexusUiUrl && (
                    <a href={item.nexusUiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-accent dark:text-dark-accent hover:underline">
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                      View in Nexus
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isError && (
                    <button onClick={() => onRetry(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors">
                      <span className="material-symbols-outlined text-slate-400 dark:text-dark-text-faint text-lg">refresh</span>
                    </button>
                  )}
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase ${cfg.bgClass}`}>{cfg.label}</span>
                </div>
              </div>

              {isUploading && item.progress != null && (
                <div className="w-full bg-slate-100 dark:bg-dark-surface-2 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-accent h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {isWarning && item.statusText && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">{item.statusText}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
