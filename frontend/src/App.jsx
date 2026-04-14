import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RepoSelector from './components/RepoSelector';
import UploadZone from './components/UploadZone';
import UploadQueue from './components/UploadQueue';
import UploadSummary from './components/UploadSummary';
import SettingsModal from './components/SettingsModal';
import LdapPage from './components/LdapPage';
import HistoryPage from './components/HistoryPage';
import { useUpload } from './hooks/useUpload';

const NEXUS_LOGO = 'https://lh3.googleusercontent.com/aida/ADBb0uhJAgGgzva0ScflAODe8l4LMeZezCQyPlBcHfUAH-CAxD_MYx7wvT5O-ITn9Abyf95i_KO-P8Bncj9y9pRJ23POSAynBfpNXXiBJGDd9Z5h9G1ApNqrk7ui-cSUcJeebjx_V-WcR0LuUhaiFKy4Kw0IyjBU0lTYciWLKOpJJrgl2YrNM_jWcLJaDgIyMbsCsproxqG7eN_j4owNPpSb2t9u3IuRwR4tVYZOCiy6RdLlYI3uuhzHUK0yeYOt7-aWN5NOTGHDCCBs4Q';

const SETTINGS_KEY = 'nexus-pusher-settings';
const REPO_NAMES_KEY = 'nexus-pusher-repo-names';

function loadFromStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

export default function App() {
  const [activePage, setActivePage]   = useState('upload');
  const [activeRepo, setActiveRepo]   = useState('npm');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() =>
    loadFromStorage(SETTINGS_KEY, { nexusUrl: '', username: '', password: '' })
  );
  const [repoNames, setRepoNames] = useState(() =>
    loadFromStorage(REPO_NAMES_KEY, {})
  );
  const [extraFields, setExtraFields] = useState({});

  const repoName = repoNames[activeRepo] || '';
  const { queue, addFiles, clearCompleted, retryItem, totalSize, estimatedTime } =
    useUpload(settings, activeRepo, repoName, extraFields);

  useEffect(() => {
    if (!settings.nexusUrl) setShowSettings(true);
  }, []);

  const handleSaveSettings = (s) => {
    setSettings(s);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    setShowSettings(false);
  };

  const handleRepoNameChange = (type, name) => {
    const updated = { ...repoNames, [type]: name };
    setRepoNames(updated);
    localStorage.setItem(REPO_NAMES_KEY, JSON.stringify(updated));
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen selection:bg-accent selection:text-white">
      <Sidebar
        nexusLogo={NEXUS_LOGO}
        onOpenSettings={() => setShowSettings(true)}
        activePage={activePage}
        onNavigate={setActivePage}
      />
      <main className="ml-64 p-10 flex flex-col gap-12 max-w-[1400px]">

        {activePage === 'upload' && (
          <>
            <section>
              <h2 className="text-5xl font-extrabold tracking-tight text-primary mb-4">Upload Assets</h2>
              <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
                Push repository builds, container images, and binary artifacts to the Nexus network.
                Select your target repository type and monitor deployment status.
              </p>
            </section>

            <RepoSelector
              active={activeRepo}
              onChange={setActiveRepo}
              repoNames={repoNames}
              onRepoNameChange={handleRepoNameChange}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-7 flex flex-col gap-10">
                <UploadZone
                  onFiles={addFiles}
                  repoType={activeRepo}
                  extraFields={extraFields}
                  onExtraChange={setExtraFields}
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
                />
              </div>
            </div>
          </>
        )}

        {activePage === 'history' && <HistoryPage />}

        {activePage === 'ldap' && <LdapPage settings={settings} />}

        <footer className="mt-auto py-10 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={NEXUS_LOGO} alt="" className="w-5 h-5 grayscale opacity-20" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
              &copy; {new Date().getFullYear()} Nexus Pusher. Architectural Precision.
            </p>
          </div>
          <div className="flex gap-10">
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-accent transition-colors">Security</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-accent transition-colors">Privacy</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">System Status</a>
          </div>
        </footer>
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
