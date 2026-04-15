import React, { useState, useEffect } from 'react';

// 15-second client-side timeout so the UI never hangs if the backend is slow.
const VALIDATE_TIMEOUT_MS = 15_000;

async function validateCredentials({ nexusUrl, username, password }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const res = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nexusUrl, username, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, message: `Validation timed out after ${VALIDATE_TIMEOUT_MS / 1000} s — backend may be unreachable` };
    }
    return { ok: false, message: 'Cannot reach the backend — is the backend container running?' };
  }
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm]       = useState({ nexusUrl: '', username: '', password: '', defaultRepo: '', ...settings });
  const [testing, setTesting] = useState(false);
  const [status, setStatus]   = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !testing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, testing]);

  const handleSave = async () => {
    setStatus(null);
    if (!form.nexusUrl?.trim()) { setStatus({ ok: false, message: 'Nexus URL is required' }); return; }
    setTesting(true);
    const result = await validateCredentials(form);
    setTesting(false);
    setStatus(result);
    if (result.ok) onSave(form);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !testing) onClose();
  };

  const fields = [
    { key: 'nexusUrl',    label: 'Nexus URL',         placeholder: 'http://nexus:8081',   type: 'text',     hint: 'Direct Nexus URL — the backend contacts it server-side, no proxy needed.' },
    { key: 'username',    label: 'Username',           placeholder: 'admin',               type: 'text' },
    { key: 'password',    label: 'Password',           placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', type: 'password' },
    { key: 'defaultRepo', label: 'Default Repository', placeholder: 'maven-releases',      type: 'text' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-primary dark:text-dark-text">Nexus Connection</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-dark-surface-2 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400 dark:text-dark-text-muted">close</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant dark:text-dark-text-muted">
          Credentials are sent to the backend and tested against Nexus server-side.
        </p>
        <div className="flex flex-col gap-4">
          {fields.map(({ key, label, placeholder, type, hint }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label htmlFor={`settings-${key}`} className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted">{label}</label>
              <input
                id={`settings-${key}`}
                type={type}
                value={form[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => { if (e.key === 'Enter' && !testing) handleSave(); }}
                className="px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
              />
              {hint && <p className="text-xs text-slate-400 dark:text-dark-text-faint">{hint}</p>}
            </div>
          ))}
        </div>

        {status && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            status.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
          }`}>
            {status.message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={testing} className="flex-1 py-3 rounded-xl bg-primary dark:bg-dark-accent dark:text-dark-bg text-white text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {testing ? 'Testing...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
