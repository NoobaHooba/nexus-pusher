import React, { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../lib/backendApi';

const NAV_ITEMS = [
  { id: 'upload',  icon: 'rocket_launch', label: 'Pushes' },
  { id: 'browser', icon: 'manage_search',  label: 'Browse' },
  { id: 'history', icon: 'history',        label: 'History' },
  { id: 'ldap',    icon: 'group',          label: 'LDAP & Access' },
];

/**
 * Ask the BACKEND to check Nexus reachability.
 * The browser cannot reach Docker-internal hostnames like http://nexus:8081
 * directly, but the backend container can. Passing nexusUrl as a query param
 * makes the backend do a server-side ping and return the result.
 */
async function runHealthChecks(settings) {
  const results = { backend: false, nexus: null, nexusMs: null };
  try {
    const nexusUrl = settings?.nexusUrl || '';
    const params = nexusUrl ? `?nexusUrl=${encodeURIComponent(nexusUrl)}` : '';
    const r = await fetch(apiUrl(settings, `/api/health${params}`), {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (r.ok) {
      results.backend = true;
      const data = await r.json();
      if (nexusUrl) {
        results.nexus   = data.nexus   ?? null;
        results.nexusMs = data.nexusMs ?? null;
      }
    }
  } catch (_) {
    // backend unreachable
  }
  return results;
}

export default function Sidebar({
  nexusLogo,
  activePage,
  onNavigate,
  settings,
  theme,
  denseMode,
  onToggleTheme,
  onOpenLogin,
  onLogout,
}) {
  const [health, setHealth]     = useState({ backend: null, nexus: null, nexusMs: null });
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);
  const nexusUrl    = settings?.nexusUrl || '';

  const check = async () => {
    setChecking(true);
    const r = await runHealthChecks(settings);
    setHealth(r);
    setChecking(false);
  };

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nexusUrl, settings]);

  const dot = (status) => {
    if (status === null) return 'bg-slate-300 dark:bg-slate-600 animate-pulse';
    return status ? 'bg-green-400' : 'bg-red-400';
  };

  const overallOk       = health.backend === true && (nexusUrl ? health.nexus === true : true);
  const overallChecking = health.backend === null;
  const statusLabel     = overallChecking ? 'Checking…' : overallOk ? 'All systems operational' : 'Degraded — check settings';
  const statusColor     = overallChecking
    ? 'text-slate-400 dark:text-dark-text-faint'
    : overallOk
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-500';

  const isDark = theme === 'dark';

  return (
    <aside className={`h-screen w-64 fixed left-0 top-0 z-40 bg-white dark:bg-dark-surface border-r border-slate-100 dark:border-dark-border flex flex-col ${denseMode ? 'p-2 gap-0.5' : 'p-6 gap-2'}`}>

      {/* Logo */}
      <div className={`flex items-center gap-2 ${denseMode ? 'mb-2' : 'mb-10'}`}>
        <div className={`${denseMode ? 'w-8 h-8' : 'w-10 h-10'} bg-primary rounded-xl flex items-center justify-center`}>
          <img src={nexusLogo} alt="Nexus Logo" className={`${denseMode ? 'w-5 h-5' : 'w-6 h-6'} object-contain`} />
        </div>
        <div>
          <h1 className={`text-primary dark:text-dark-text font-bold leading-none ${denseMode ? 'text-base' : 'text-lg'}`}>Nexus Pusher</h1>
          <p className={`font-manrope text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-dark-text-faint ${denseMode ? 'mt-0.5' : 'mt-1'}`}>Repository Core</p>
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 flex flex-col ${denseMode ? 'gap-0.5' : 'gap-2'}`}>
        {NAV_ITEMS.map(({ id, icon, label }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 font-medium text-sm transition-all rounded-lg w-full text-left ${
                active
                  ? 'text-primary dark:text-dark-text font-bold bg-accent-dim/50 dark:bg-dark-accent-dim'
                  : 'text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
              } ${denseMode ? 'px-2 py-1.5' : 'px-4 py-3'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${active ? 'text-accent dark:text-dark-accent' : ''}`}>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className={`border-t border-slate-100 dark:border-dark-border ${denseMode ? 'pt-2 pb-0.5' : 'pt-4 pb-2'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">Connection</p>
          <button
            onClick={check}
            disabled={checking}
            title="Re-check now"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-dark-text-faint hover:text-primary dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-surface-2 transition-colors disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-[14px] ${checking ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot(health.backend)}`} />
          <span className="text-xs text-on-surface-variant dark:text-dark-text-muted font-medium">Backend</span>
          <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${
            health.backend === null ? 'text-slate-400' : health.backend ? 'text-green-500 dark:text-green-400' : 'text-red-500'
          }`}>
            {health.backend === null ? '—' : health.backend ? 'OK' : 'DOWN'}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${nexusUrl ? dot(health.nexus) : 'bg-slate-200 dark:bg-dark-border'}`} />
          <span className="text-xs text-on-surface-variant dark:text-dark-text-muted font-medium">Nexus</span>
          {health.nexusMs !== null && health.nexus && (
            <span className="text-[9px] text-slate-300 dark:text-dark-text-faint font-mono">{health.nexusMs}ms</span>
          )}
          <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${
            !nexusUrl ? 'text-slate-300 dark:text-dark-text-faint' :
            health.nexus === null ? 'text-slate-400' :
            health.nexus ? 'text-green-500 dark:text-green-400' : 'text-red-500'
          }`}>
            {!nexusUrl ? 'Not set' : health.nexus === null ? '—' : health.nexus ? 'OK' : 'DOWN'}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${statusColor}`}>
          {!overallChecking && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${overallOk ? 'bg-green-400' : 'bg-red-400'}`} />}
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Footer controls */}
      <div className={`flex flex-col gap-0.5 border-t border-slate-100 dark:border-dark-border ${denseMode ? 'pt-2' : 'pt-4'}`}>
        <button
          onClick={onToggleTheme}
          className={`mt-1 flex items-center gap-3 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors ${denseMode ? 'px-2 py-0.5' : 'px-4 py-2'}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-outlined text-[18px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          onClick={onOpenLogin}
          className={`flex items-center gap-3 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors ${denseMode ? 'px-2 py-0.5' : 'px-4 py-2'}`}
        >
          <span className="material-symbols-outlined text-[18px]">account_circle</span>
          <span className="truncate">{settings?.username || 'Login'}</span>
        </button>
        {settings?.username && (
          <button
            onClick={onLogout}
            className={`flex items-center gap-3 text-sm font-medium text-rose-500 transition-colors hover:text-rose-600 dark:hover:text-rose-400 ${denseMode ? 'px-2 py-0.5' : 'px-4 py-2'}`}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Log Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
