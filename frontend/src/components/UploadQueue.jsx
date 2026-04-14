import React, { useRef, useState } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

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

// ── Inline SVG empty-state illustration ──────────────────────────────────────
function EmptyStateIllustration() {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-40 h-32 mb-6"
      aria-hidden="true"
    >
      {/* Shadow ellipse */}
      <ellipse cx="80" cy="108" rx="44" ry="6" fill="currentColor" className="text-slate-100 dark:text-dark-border" />

      {/* Back box */}
      <rect x="52" y="34" width="62" height="52" rx="6" fill="currentColor" className="text-slate-100 dark:text-dark-surface-2" />
      <rect x="52" y="34" width="62" height="10" rx="6" fill="currentColor" className="text-slate-200 dark:text-dark-border" />
      <rect x="56" y="38" width="8" height="2" rx="1" fill="currentColor" className="text-slate-300 dark:text-dark-text-faint" />
      <rect x="68" y="38" width="12" height="2" rx="1" fill="currentColor" className="text-slate-300 dark:text-dark-text-faint" />

      {/* Front box */}
      <rect x="40" y="44" width="64" height="52" rx="6" fill="white" className="dark:text-dark-surface" stroke="currentColor" strokeWidth="1.5" style={{stroke: 'var(--tw-ring-color, #e2e8f0)'}} />
      <rect
        x="40" y="44" width="64" height="52" rx="6"
        fill="none"
        className="text-slate-200 dark:text-dark-border"
        stroke="currentColor" strokeWidth="1.5"
      />

      {/* Lines inside front box */}
      <rect x="50" y="60" width="28" height="3" rx="1.5" fill="currentColor" className="text-slate-200 dark:text-dark-border" />
      <rect x="50" y="67" width="20" height="3" rx="1.5" fill="currentColor" className="text-slate-200 dark:text-dark-border" />
      <rect x="50" y="74" width="24" height="3" rx="1.5" fill="currentColor" className="text-slate-200 dark:text-dark-border" />

      {/* Upload arrow — green accent */}
      <circle cx="110" cy="52" r="14" fill="currentColor" className="text-accent-dim dark:text-dark-accent-dim" />
      <path
        d="M110 59 L110 47 M106 51 L110 47 L114 51"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent dark:text-dark-accent"
      />

      {/* Dashed drop hint */}
      <rect
        x="40" y="44" width="64" height="52" rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        className="text-slate-200 dark:text-dark-border opacity-60"
      />
    </svg>
  );
}

// ── Animated file count badge in the queue header ────────────────────────────
function QueueCountBadge({ count }) {
  const animated = useAnimatedNumber(count, { stiffness: 200, damping: 22, precision: 0.5 });
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent/10 dark:bg-dark-accent/10 text-accent dark:text-dark-accent text-[10px] font-extrabold tabular-nums">
      {Math.round(animated)}
    </span>
  );
}

export default function UploadQueue({ queue, onClearCompleted, onRetry, onRetryAllFailed, onReorder }) {
  const dragItemId = useRef(null);
  const [overItemId, setOverItemId] = useState(null);

  const handleDragStart = (e, id) => { dragItemId.current = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(id)); };
  const handleDragOver  = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (id !== dragItemId.current) setOverItemId(id); };
  const handleDrop      = (e, toId) => { e.preventDefault(); if (dragItemId.current !== null && dragItemId.current !== toId) onReorder?.(dragItemId.current, toId); dragItemId.current = null; setOverItemId(null); };
  const handleDragEnd   = () => { dragItemId.current = null; setOverItemId(null); };

  const failedCount = queue.filter(i => i.status === 'error').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">
            Live Process Queue
          </h5>
          <QueueCountBadge count={queue.length} />
          {queue.some(i => i.status === 'pending') && (
            <span className="text-[10px] text-slate-400 dark:text-dark-text-faint font-medium">(drag to reorder)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {failedCount > 0 && (
            <button
              onClick={onRetryAllFailed}
              className="flex items-center gap-1.5 text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 uppercase tracking-wider transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Retry {failedCount} Failed
            </button>
          )}
          <button onClick={onClearCompleted} className="text-[11px] font-bold text-accent dark:text-dark-accent hover:underline uppercase tracking-wider">
            Clear Completed
          </button>
        </div>
      </div>

      {/* ── Empty state illustration ── */}
      {queue.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 select-none">
          <EmptyStateIllustration />
          <p className="text-sm font-bold text-slate-400 dark:text-dark-text-muted">Nothing in the queue</p>
          <p className="text-xs text-slate-300 dark:text-dark-text-faint mt-1 max-w-[200px] text-center leading-relaxed">
            Drop your first artifact into the zone to get started
          </p>
        </div>
      )}

      {/* Items */}
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
              {isError     && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400" />}

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
                  <span
                    className={`material-symbols-outlined text-2xl ${isUploading ? 'animate-spin' : ''}`}
                    style={isUploading ? { animationDuration: '3s' } : {}}
                  >
                    {cfg.icon}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-bold truncate text-primary dark:text-dark-text">{item.name}</p>
                  <p className={`text-[10px] font-semibold uppercase tracking-tight mt-0.5 ${
                    isUploading ? 'text-accent dark:text-dark-accent'
                    : isError   ? 'text-red-400'
                    : isWarning ? 'text-amber-500'
                    : 'text-on-surface-variant dark:text-dark-text-muted'
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
                    <button
                      onClick={() => onRetry(item.id)}
                      title="Retry this file"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                    >
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
              {isError && item.statusText && (
                <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 font-mono">{item.statusText}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
