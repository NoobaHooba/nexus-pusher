import React from 'react';
import { useAnimatedNumber } from '../../../shared/hooks/useAnimatedNumber';

function formatSize(bytes) {
  // FIX 3: Guard against NaN/Infinity that caused "NaN B" to flash on first
  // render before the spring settled, and on edge-case empty queue states.
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${sizes[i]}`;
}

function formatTime(seconds) {
  // FIX 3: Guard against NaN — useAnimatedNumber passes floats during
  // interpolation; formatTime must handle any non-finite value gracefully.
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function AnimatedStat({ label, value, formatter, accent = false }) {
  const animated = useAnimatedNumber(typeof value === 'number' && Number.isFinite(value) ? value : 0, {
    stiffness: 90,
    damping: 16,
    precision: typeof value === 'number' && value > 1_000_000 ? 1000 : 0.5,
  });

  const displayed = formatter(animated);

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-dark-text-faint mb-2">
        {label}
      </p>
      <p
        className={`text-2xl font-extrabold tabular-nums transition-all duration-150
          ${ accent ? 'text-accent dark:text-dark-accent' : 'text-primary dark:text-dark-text' }
          animate-[stat-pop_150ms_ease-out]
        `}
      >
        {displayed}
      </p>
    </div>
  );
}

export default function UploadSummary({ totalSize, estimatedTime, activeFormat }) {
  return (
    <div>
      <style>{`
        @keyframes stat-pop {
          0%   { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>

      <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint mb-4">
        Upload Summary
      </h5>

      <div className="grid grid-cols-3 gap-8 bg-white dark:bg-dark-surface p-8 rounded-3xl border border-slate-50 dark:border-dark-border shadow-sm">
        <AnimatedStat
          label="Review + Queue"
          value={totalSize}
          formatter={formatSize}
        />
        <AnimatedStat
          label="Estimated Time"
          value={estimatedTime}
          formatter={formatTime}
        />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-dark-text-faint mb-2">
            Active Format
          </p>
          <p className="text-2xl font-extrabold text-accent dark:text-dark-accent">{activeFormat}</p>
        </div>
      </div>
    </div>
  );
}
