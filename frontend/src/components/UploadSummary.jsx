import React from 'react';

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function UploadSummary({ totalSize, estimatedTime, activeFormat }) {
  return (
    <div>
      <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Upload Summary</h5>
      <div className="grid grid-cols-3 gap-8 bg-white p-8 rounded-3xl border border-slate-50 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Queue Size</p>
          <p className="text-2xl font-extrabold text-primary">{formatSize(totalSize)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Estimated Time</p>
          <p className="text-2xl font-extrabold text-primary">{formatTime(estimatedTime)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Active Format</p>
          <p className="text-2xl font-extrabold text-accent">{activeFormat}</p>
        </div>
      </div>
    </div>
  );
}
