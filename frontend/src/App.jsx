import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RepoSelector from './components/RepoSelector';
import UploadZone from './components/UploadZone';
import UploadQueue from './components/UploadQueue';
import UploadSummary from './components/UploadSummary';
import SettingsModal from './components/SettingsModal';
import PreflightReview from './components/PreflightReview';
import RecentActivity from './components/RecentActivity';
import LdapPage from './components/LdapPage';
import HistoryPage from './components/HistoryPage';
import BrowserPage from './components/BrowserPage';
import ToastContainer from './components/ToastContainer';
import { ToastProvider, useToast } from './hooks/useToast';
import { useUpload } from './hooks/useUpload';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { fetchRepositories } from './lib/nexusApi';
import { apiUrl } from './lib/backendApi';

const NEXUS_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2301696f'/%3E%3Cpath d='M9 22 L16 10 L23 22' stroke='white' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3Cpath d='M12 18 L16 10 L20 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='white' fill-opacity='0.25'/%3E%3C/svg%3E";

const SETTINGS_KEY   = 'nexus-pusher-settings';
const REPO_NAMES_KEY = 'nexus-pusher-repo-names';
const THEME_KEY      = 'nexus-pusher-theme';

function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
}

function AppInner() {
  const toast = useToast();
  const [activePage, setActivePage]     = useState('upload');
  const [activeRepo, setActiveRepo]     = useState('npm');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [theme, setTheme]               = useState(getInitialTheme);
  const [runtimeConfig, setRuntimeConfig] = useState({ nexusUrl: '', nexusBrowserUrl: '', dockerRegistry: '' });
  const [settings, setSettings] = useState(() =>
    loadFromStorage(SETTINGS_KEY, { username: '', password: '' })
  );
  const [repoNames, setRepoNames] = useState(() =>
    loadFromStorage(REPO_NAMES_KEY, {})
  );
  const [availableRepos, setAvailableRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState('');

  const effectiveSettings = { ...runtimeConfig, ...settings };
  const repoName = repoNames[activeRepo] || '';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const {
    staged, stagedSize, stageFiles, removeStaged, cancelStaged, pushStaged,
    updateStagedRepo, updateStagedExtraFields, applyRepoToAll,
    queue, totalSize, estimatedTime, clearCompleted, retryItem, retryAllFailed, reorderQueue,
    preferences, toggleFavoriteRepo, recentActivity, reuseRecentActivity, buildEditableFields,
  } = useUpload(effectiveSettings, activeRepo, repoName, toast);

  // ── Reactive document title ————————————————————————————─
  useDocumentTitle(activePage, {
    uploading: queue.filter(i => i.status === 'uploading').length,
    pending:   queue.filter(i => i.status === 'pending').length,
    failed:    queue.filter(i => i.status === 'error').length,
  });

  useEffect(() => {
    fetch(apiUrl({}, '/api/runtime-config'))
      .then((res) => res.json())
      .then((data) => setRuntimeConfig(data || {}))
      .catch(() => setRuntimeConfig({ nexusUrl: '', nexusBrowserUrl: '', dockerRegistry: '' }));
  }, []);

  useEffect(() => {
    if (runtimeConfig.nexusUrl && !settings.username) setShowSettings(true);
  }, [runtimeConfig.nexusUrl, settings.username]);

  useEffect(() => {
    const { nexusUrl, username, password } = effectiveSettings || {};
    if (!nexusUrl) {
      setAvailableRepos([]);
      setReposError('');
      setReposLoading(false);
      return;
    }

    let cancelled = false;
    setReposLoading(true);

    fetchRepositories({ nexusUrl, username, password, settings: effectiveSettings })
      .then((repos) => {
        if (cancelled) return;
        setAvailableRepos(repos);
        setReposError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailableRepos([]);
        setReposError(err.message || 'Could not load repositories');
      })
      .finally(() => {
        if (!cancelled) setReposLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveSettings]);

  const handleSaveSettings = (s) => {
    const next = { username: s.username || '', password: s.password || '' };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setShowSettings(false);
    setShowUserMenu(false);
    toast.success('Login saved & connection verified');
  };

  const handleLogout = () => {
    const next = { username: '', password: '' };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setShowUserMenu(false);
    toast.info('Logged out locally');
  };

  const handleRepoNameChange = (type, name) => {
    const updated = { ...repoNames, [type]: name };
    setRepoNames(updated);
    localStorage.setItem(REPO_NAMES_KEY, JSON.stringify(updated));
  };

  const handleReuseActivity = (activity) => {
    if (!activity) return;
    setActiveRepo(activity.repoType);
    handleRepoNameChange(activity.repoType, activity.repoName);
    reuseRecentActivity(activity);
    toast.info(`Reusing ${activity.repoType.toUpperCase()} context from ${activity.repoName}`);
  };

  return (
    <div className="bg-surface dark:bg-dark-bg text-on-surface dark:text-dark-text min-h-screen selection:bg-accent selection:text-white">
      <Sidebar
        nexusLogo={NEXUS_LOGO}
        activePage={activePage}
        onNavigate={setActivePage}
        settings={effectiveSettings}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="ml-64 p-10 flex flex-col gap-12 max-w-[1400px]">
        <div className="flex justify-end relative">
          <button
            onClick={() => setShowUserMenu((open) => !open)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm font-bold text-primary dark:text-dark-text"
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            {effectiveSettings.username || 'Login'}
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </button>
          {showUserMenu && (
            <div className="absolute top-14 right-0 w-52 rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl z-20 p-2 flex flex-col">
              <button
                onClick={() => { setShowSettings(true); setShowUserMenu(false); }}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-primary dark:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-surface-2"
              >
                {effectiveSettings.username ? 'Edit Login' : 'Login'}
              </button>
              {effectiveSettings.username && (
                <button
                  onClick={handleLogout}
                  className="text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  Log Out
                </button>
              )}
            </div>
          )}
        </div>

        {activePage === 'upload' && (
          <>
            <section>
              <h2 className="text-5xl font-extrabold tracking-tight text-primary dark:text-dark-text mb-4">Upload Assets</h2>
              <p className="text-on-surface-variant dark:text-dark-text-muted text-lg max-w-2xl leading-relaxed">
                Push repository builds, container images, and binary artifacts to the Nexus network.
                Select your target repository type and monitor deployment status.
              </p>
            </section>

            <RepoSelector
              active={activeRepo}
              onChange={setActiveRepo}
              repoNames={repoNames}
              onRepoNameChange={handleRepoNameChange}
              availableRepos={availableRepos}
              reposLoading={reposLoading}
              reposError={reposError}
              preferences={preferences}
              defaultRepo={effectiveSettings.defaultRepo || ''}
              onToggleFavorite={toggleFavoriteRepo}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 flex flex-col gap-10">
                <UploadZone
                  onFiles={stageFiles}
                  repoType={activeRepo}
                  stagedCount={staged.length}
                  settings={settings}
                />
                <PreflightReview
                  items={staged}
                  repoType={activeRepo}
                  onRemove={removeStaged}
                  onClear={cancelStaged}
                  onUpload={pushStaged}
                  onRepoChange={updateStagedRepo}
                  onExtraFieldsChange={updateStagedExtraFields}
                  onToggleFavorite={toggleFavoriteRepo}
                  onApplyRepoToAll={applyRepoToAll}
                  preferences={preferences}
                  buildEditableFields={buildEditableFields}
                />
                <UploadSummary
                  totalSize={totalSize + stagedSize}
                  estimatedTime={estimatedTime}
                  activeFormat={activeRepo.toUpperCase()}
                />
                <RecentActivity items={recentActivity} onReuse={handleReuseActivity} />
              </div>
              <div className="lg:col-span-5">
                <UploadQueue
                  queue={queue}
                  onClearCompleted={clearCompleted}
                  onRetry={retryItem}
                  onRetryAllFailed={retryAllFailed}
                  onReorder={reorderQueue}
                  settings={effectiveSettings}
                />
              </div>
            </div>
          </>
        )}

        {activePage === 'browser' && <BrowserPage settings={effectiveSettings} />}
        {activePage === 'history' && <HistoryPage settings={effectiveSettings} />}
        {activePage === 'ldap'    && <LdapPage settings={effectiveSettings} />}

        <footer className="mt-auto py-10 border-t border-slate-100 dark:border-dark-border flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={NEXUS_LOGO} alt="" className="w-5 h-5 grayscale opacity-20" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 dark:text-dark-text-faint">
              &copy; {new Date().getFullYear()} Nexus Pusher. Architectural Precision.
            </p>
          </div>
          <div className="flex gap-10">
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-dark-text-faint hover:text-accent transition-colors">Security</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-dark-text-faint hover:text-accent transition-colors">Privacy</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-dark-text-faint hover:text-accent">System Status</a>
          </div>
        </footer>
      </main>

      {showSettings && (
        <SettingsModal
          settings={effectiveSettings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
