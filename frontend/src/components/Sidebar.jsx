import React, { useState, useEffect, useRef } from 'react';

const NAV_ITEMS = [
  { id: 'upload',  icon: 'rocket_launch', label: 'Pushes' },
  { id: 'browser', icon: 'manage_search',  label: 'Browse' },
  { id: 'history', icon: 'history',        label: 'History' },
  { id: 'ldap',    icon: 'group',          label: 'LDAP & Access' },
];

async function runHealthChecks(nexusUrl) {
  const results = { backend: false, nexus: false };
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    results.backend = r.ok;
  } catch (_) {}
  if (nexusUrl) {
    try {
      await fetch(`${nexusUrl.replace(/\/$/, '')}/service/rest/v1/status`, { cache: 'no-store', mode: 'no-cors' });
      results.nexus = true;
    } catch (_) {}
  }
  return results;
}

export default function Sidebar({ nexusLogo, onOpenSettings, activePage, onNavigate, settings, theme, onToggleTheme }) {
  const [health, setHealth]     = useState({ backend: null, nexus: null });
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);
  const nexusUrl    = settings?.nexusUrl || '';

  const check = async () => {
    setChecking(true);
    const r = await runHealthChecks(nexusUrl);
    setHealth(r);
    setChecking(false);
  };

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nexusUrl]);

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
    <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-white dark:bg-dark-surface border-r border-slate-100 dark:border-dark-border flex flex-col p-6 gap-2">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <img src={nexusLogo} alt="Nexus Logo" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <h1 className="text-primary dark:text-dark-text font-bold text-lg leading-none">Nexus Pusher</h1>
          <p className="font-manrope text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-dark-text-faint mt-1">Repository Core</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map(({ id, icon, label }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all rounded-lg w-full text-left ${
                active
                  ? 'text-primary dark:text-dark-text font-bold bg-accent-dim/50 dark:bg-dark-accent-dim'
                  : 'text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${active ? 'text-accent dark:text-dark-accent' : ''}`}>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className="border-t border-slate-100 dark:border-dark-border pt-4 pb-2">
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

      {/* Footer links + theme toggle */}
      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-dark-border pt-4">
        <button onClick={onOpenSettings} className="flex items-center gap-3 px-4 py-2 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors">
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span>Settings</span>
        </button>
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors">
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span>Support</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors">
          <span className="material-symbols-outlined text-[18px]">description</span>
          <span>Documentation</span>
        </a>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="mt-1 flex items-center gap-3 px-4 py-2 text-on-surface-variant dark:text-dark-text-muted text-sm font-medium hover:text-primary dark:hover:text-dark-text transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="material-symbols-outlined text-[18px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
}
