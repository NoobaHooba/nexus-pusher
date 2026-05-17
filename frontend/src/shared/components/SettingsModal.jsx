import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl, getBackendBaseUrl } from '../lib/backendApi';
import { createHttpError, formatUserError } from '../lib/errorMessages';
import { INPUT_LIMITS, sanitizeControlText, sanitizeText, sanitizeTrimmed } from '../lib/inputValidation';

const VALIDATE_TIMEOUT_MS = 15_000;

async function validateCredentials({ nexusUrl, username, password, backendUrl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl({ backendUrl }, '/api/validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nexusUrl, username, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw createHttpError(res.status, data.error || data.message, { action: 'saving settings' });
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, message: `Validation timed out after ${VALIDATE_TIMEOUT_MS / 1000} seconds. Check the backend route and try again.` };
    }
    return { ok: false, message: formatUserError(err, { action: 'saving settings' }) };
  }
}

export default function SettingsModal({ settings, denseMode, onSave, onClose }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    denseMode: denseMode === true,
    backendUrl: getBackendBaseUrl(settings),
    ...settings,
  });
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const testingRef = useRef(false);
  const currentCredentials = useMemo(() => ({
    username: settings?.username || '',
    password: settings?.password || '',
  }), [settings?.username, settings?.password]);

  const set = (key, value) => {
    const nextValue = key === 'username'
      ? sanitizeText(value, INPUT_LIMITS.username)
      : key === 'password'
        ? sanitizeControlText(value, INPUT_LIMITS.password)
        : value;
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !testing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, testing]);

  const handleSave = async () => {
    if (testingRef.current) return;
    setStatus(null);
    const nextSettings = {
      username: sanitizeTrimmed(form.username, INPUT_LIMITS.username),
      password: sanitizeControlText(form.password, INPUT_LIMITS.password),
      denseMode: form.denseMode === true,
    };
    if (!nextSettings.username || !nextSettings.password) {
      setStatus({ ok: false, message: 'Username and password are required. Enter both values, then save settings again.' });
      return;
    }
    const credentialsChanged = (
      nextSettings.username !== currentCredentials.username ||
      nextSettings.password !== currentCredentials.password
    );

    if (!credentialsChanged) {
      onSave(nextSettings);
      return;
    }

    if (!settings?.nexusUrl?.trim()) {
      setStatus({ ok: false, message: 'Nexus is not configured for this deployment. Ask the deployer to set the backend runtime config.' });
      return;
    }
    testingRef.current = true;
    setTesting(true);
    const result = await validateCredentials({
      nexusUrl: settings.nexusUrl,
      username: form.username,
      password: form.password,
      backendUrl: form.backendUrl,
    });
    testingRef.current = false;
    setTesting(false);
    setStatus(result);
    if (result.ok) onSave(nextSettings);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !testing) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-primary dark:text-dark-text">Settings</h2>
          <button
            onClick={onClose}
            disabled={testing}
            aria-label="Close login"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-slate-400 dark:text-dark-text-muted">close</span>
          </button>
        </div>

        <p className="text-sm text-on-surface-variant dark:text-dark-text-muted">
          Manage your Nexus login and personal UI preferences. Repository endpoints are configured by the deployment, not by each user.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-username" className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted">Username</label>
            <input
              id="login-username"
              type="text"
              disabled={testing}
              required
              maxLength={INPUT_LIMITS.username}
              autoComplete="username"
              value={form.username || ''}
              onChange={(e) => set('username', e.target.value)}
              placeholder="admin"
              onKeyDown={(e) => { if (e.key === 'Enter' && !testing) handleSave(); }}
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted">Password</label>
            <input
              id="login-password"
              type="password"
              disabled={testing}
              required
              maxLength={INPUT_LIMITS.password}
              autoComplete="current-password"
              value={form.password || ''}
              onChange={(e) => set('password', e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter' && !testing) handleSave(); }}
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface-2 px-4 py-3">
            <label htmlFor="dense-mode" className="flex items-start justify-between gap-4 cursor-pointer">
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-primary dark:text-dark-text">Dense View</span>
                <span className="text-xs text-on-surface-variant dark:text-dark-text-muted">
                  Tighten spacing across browse, history, and the rest of the app for a denser layout.
                </span>
              </span>
              <span className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                form.denseMode ? 'bg-accent dark:bg-dark-accent' : 'bg-slate-300 dark:bg-slate-600'
              }`}>
                <input
                  id="dense-mode"
                  type="checkbox"
                  disabled={testing}
                  checked={form.denseMode === true}
                  onChange={(e) => set('denseMode', e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    form.denseMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </label>
          </div>
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

        <p className="text-[11px] text-slate-400 dark:text-dark-text-faint">
          Credentials are revalidated only when you change the username or password.
        </p>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={testing} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
          <button onClick={handleSave} disabled={testing} className="flex-1 py-3 rounded-xl bg-primary dark:bg-dark-accent dark:text-dark-bg text-white text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {testing ? <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Testing...</span> : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
