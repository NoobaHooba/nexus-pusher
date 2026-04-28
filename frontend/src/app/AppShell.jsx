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
    denseMode,
    toggleTheme,
    effectiveSettings,
    repoNames,
    updateRepoName,
    showSettings,
    setShowSettings,
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
    const credentialsChanged = (
      (nextSettings.username || '') !== (effectiveSettings.username || '') ||
      (nextSettings.password || '') !== (effectiveSettings.password || '')
    );
    toast.success(credentialsChanged ? 'Login saved & connection verified' : 'Settings saved');
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
    <div className={`bg-surface dark:bg-dark-bg text-on-surface dark:text-dark-text min-h-screen selection:bg-accent selection:text-white ${denseMode ? 'dense-ui' : ''}`}>
      <Sidebar
        nexusLogo={NEXUS_LOGO}
        activePage={activePage}
        onNavigate={setActivePage}
        settings={effectiveSettings}
        theme={theme}
        denseMode={denseMode}
        onToggleTheme={toggleTheme}
        onOpenLogin={() => setShowSettings(true)}
        onLogout={handleLogout}
      />

      <main className={`ml-64 flex flex-col max-w-[1400px] ${denseMode ? 'p-5 gap-6' : 'p-10 gap-12'}`}>
        {activePage === 'upload' && (
          <>
            <section>
              <h2 className={`font-extrabold tracking-tight text-primary dark:text-dark-text ${denseMode ? 'text-[2rem] mb-2' : 'text-5xl mb-4'}`}>Upload Assets</h2>
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

            <div className={`grid grid-cols-1 lg:grid-cols-12 ${denseMode ? 'gap-6' : 'gap-12'}`}>
              <div className={`lg:col-span-7 flex flex-col ${denseMode ? 'gap-5' : 'gap-10'}`}>
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
          denseMode={denseMode}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <ToastContainer />
    </div>
  );
}
