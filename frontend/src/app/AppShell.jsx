import React, { useEffect, useState } from 'react';
import BrowserPage from '../features/browser/BrowserPage';
import HistoryPage from '../features/history/HistoryPage';
import LdapPage from '../features/ldap/LdapPage';
import PreflightReview from '../features/upload/components/PreflightReview';
import RecentActivity from '../features/upload/components/RecentActivity';
import RepoSelector from '../features/upload/components/RepoSelector';
import UploadQueue from '../features/upload/components/UploadQueue';
import UploadSummary from '../features/upload/components/UploadSummary';
import UploadZone from '../features/upload/components/UploadZone';
import { useUpload } from '../features/upload/hooks/useUpload';
import SettingsModal from '../shared/components/SettingsModal';
import Sidebar from '../shared/components/Sidebar';
import ToastContainer from '../shared/components/ToastContainer';
import { useDocumentTitle } from '../shared/hooks/useDocumentTitle';
import { useToast } from '../shared/hooks/useToast';
import { fetchRepositories } from '../shared/lib/nexusApi';
import { useAppShellState } from './appState';
import { getSettingsStorageScope } from './storage';

const NEXUS_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2301696f'/%3E%3Cpath d='M9 22 L16 10 L23 22' stroke='white' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3Cpath d='M12 18 L16 10 L20 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='white' fill-opacity='0.25'/%3E%3C/svg%3E";

export default function AppShell() {
  const toast = useToast();
  const {
    activePage,
    setActivePage,
    activeRepo,
    setActiveRepo,
    theme,
    toggleTheme,
    effectiveSettings,
    repoNames,
    updateRepoName,
    showSettings,
    setShowSettings,
    showUserMenu,
    setShowUserMenu,
    saveSettings,
    logout,
  } = useAppShellState();

  const [availableRepos, setAvailableRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState('');
  const repoName = repoNames[activeRepo] || '';
  const storageScope = getSettingsStorageScope(effectiveSettings);

  const {
    staged, stagedSize, stageFiles, removeStaged, cancelStaged, pushStaged,
    updateStagedRepo, updateStagedExtraFields, applyRepoToAll,
    queue, totalSize, estimatedTime, clearCompleted, retryItem, retryAllFailed, reorderQueue,
    preferences, toggleFavoriteRepo, recentActivity, reuseRecentActivity, buildEditableFields,
  } = useUpload(effectiveSettings, activeRepo, repoName, toast);

  useDocumentTitle(activePage, {
    uploading: queue.filter((item) => item.status === 'uploading').length,
    pending: queue.filter((item) => item.status === 'pending').length,
    failed: queue.filter((item) => item.status === 'error').length,
  });

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

  const handleSaveSettings = (nextSettings) => {
    saveSettings(nextSettings);
    toast.success('Login saved & connection verified');
  };

  const handleLogout = () => {
    logout();
    toast.info('Logged out locally');
  };

  const handleReuseActivity = (activity) => {
    if (!activity) return;
    setActiveRepo(activity.repoType);
    updateRepoName(activity.repoType, activity.repoName);
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
              onRepoNameChange={updateRepoName}
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
                  settings={effectiveSettings}
                  repoName={repoName}
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

        {activePage === 'browser' && <BrowserPage key={`browser:${storageScope}`} settings={effectiveSettings} />}
        {activePage === 'history' && <HistoryPage key={`history:${storageScope}`} settings={effectiveSettings} />}
        {activePage === 'ldap' && <LdapPage settings={effectiveSettings} />}

        <footer className="mt-auto pt-8 border-t border-slate-200/80 dark:border-dark-border/80">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={NEXUS_LOGO} alt="" className="w-5 h-5 opacity-70" />
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-tight text-on-surface-variant dark:text-dark-text-muted">
                  Built with love <span className="text-slate-400 dark:text-dark-text-faint">(and AI)</span> by Platform
                </p>
                <p className="text-xs text-slate-400 dark:text-dark-text-faint">
                  Making Nexus a little less annoying.
                </p>
              </div>
            </div>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100/80 via-orange-50 to-rose-100/80 text-lg dark:from-amber-900/30 dark:via-orange-900/20 dark:to-rose-900/30" aria-hidden="true">
              👋
            </div>
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
