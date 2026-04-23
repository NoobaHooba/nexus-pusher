import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RepoSelector from './components/RepoSelector';
import UploadZone from './components/UploadZone';
import UploadQueue from './components/UploadQueue';
import UploadSummary from './components/UploadSummary';
import SettingsModal from './components/SettingsModal';
import StagingBar from './components/StagingBar';
import LdapPage from './components/LdapPage';
import HistoryPage from './components/HistoryPage';
import BrowserPage from './components/BrowserPage';
import ToastContainer from './components/ToastContainer';
import { ToastProvider, useToast } from './hooks/useToast';
import { useUpload } from './hooks/useUpload';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { fetchRepositories } from './lib/nexusApi';

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
  const [theme, setTheme]               = useState(getInitialTheme);
  const [settings, setSettings] = useState(() =>
    loadFromStorage(SETTINGS_KEY, { nexusUrl: '', username: '', password: '' })
  );
  const [repoNames, setRepoNames] = useState(() =>
    loadFromStorage(REPO_NAMES_KEY, {})
  );
  const [extraFields, setExtraFields] = useState({});
  const [availableRepos, setAvailableRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState('');

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
    queue, totalSize, estimatedTime, clearCompleted, retryItem, retryAllFailed, reorderQueue,
  } = useUpload(settings, activeRepo, repoName, extraFields, toast);

  // ── Reactive document title ————————————————————————————─
  useDocumentTitle(activePage, {
    uploading: queue.filter(i => i.status === 'uploading').length,
    pending:   queue.filter(i => i.status === 'pending').length,
    failed:    queue.filter(i => i.status === 'error').length,
  });

  useEffect(() => {
    if (!settings.nexusUrl) setShowSettings(true);
  }, []);

  useEffect(() => {
    const { nexusUrl, username, password } = settings || {};
    if (!nexusUrl) {
      setAvailableRepos([]);
      setReposError('');
      setReposLoading(false);
      return;
    }

    let cancelled = false;
    setReposLoading(true);

    fetchRepositories({ nexusUrl, username, password, settings })
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
  }, [settings]);

  const handleSaveSettings = (s) => {
    setSettings(s);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    setShowSettings(false);
    toast.success('Settings saved & connection verified');
  };

  const handleRepoNameChange = (type, name) => {
    const updated = { ...repoNames, [type]: name };
    setRepoNames(updated);
    localStorage.setItem(REPO_NAMES_KEY, JSON.stringify(updated));
  };

  return (
    <div className="bg-surface dark:bg-dark-bg text-on-surface dark:text-dark-text min-h-screen selection:bg-accent selection:text-white">
      <Sidebar
        nexusLogo={NEXUS_LOGO}
        onOpenSettings={() => setShowSettings(true)}
        activePage={activePage}
        onNavigate={setActivePage}
        settings={settings}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="ml-64 p-10 flex flex-col gap-12 max-w-[1400px]">

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
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 flex flex-col gap-10">
                <UploadZone
                  onFiles={stageFiles}
                  repoType={activeRepo}
                  extraFields={extraFields}
                  onExtraChange={setExtraFields}
                  stagedCount={staged.length}
                />
                <UploadSummary
                  totalSize={totalSize}
                  estimatedTime={estimatedTime}
                  activeFormat={activeRepo.toUpperCase()}
                />
              </div>
              <div className="lg:col-span-5">
                <UploadQueue
                  queue={queue}
                  onClearCompleted={clearCompleted}
                  onRetry={retryItem}
                  onRetryAllFailed={retryAllFailed}
                  onReorder={reorderQueue}
                />
              </div>
            </div>
          </>
        )}

        {activePage === 'browser' && <BrowserPage settings={settings} />}
        {activePage === 'history' && <HistoryPage settings={settings} />}
        {activePage === 'ldap'    && <LdapPage settings={settings} />}

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

      <StagingBar
        staged={staged}
        stagedSize={stagedSize}
        onPush={pushStaged}
        onCancel={cancelStaged}
        onRemove={removeStaged}
        repoName={repoName}
      />

      {showSettings && (
        <SettingsModal
          settings={settings}
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
