import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import RepoSelector from './components/RepoSelector';
import UploadZone from './components/UploadZone';
import UploadQueue from './components/UploadQueue';
import UploadSummary from './components/UploadSummary';
import SettingsModal from './components/SettingsModal';
import { useUpload } from './hooks/useUpload';

const NEXUS_LOGO = 'https://lh3.googleusercontent.com/aida/ADBb0uhJAgGgzva0ScflAODe8l4LMeZezCQyPlBcHfUAH-CAxD_MYx7wvT5O-ITn9Abyf95i_KO-P8Bncj9y9pRJ23POSAynBfpNXXiBJGDd9Z5h9G1ApNqrk7ui-cSUcJeebjx_V-WcR0LuUhaiFKy4Kw0IyjBU0lTYciWLKOpJJrgl2YrNM_jWcLJaDgIyMbsCsproxqG7eN_j4owNPpSb2t9u3IuRwR4tVYZOCiy6RdLlYI3uuhzHUK0yeYOt7-aWN5NOTGHDCCBs4Q';

export default function App() {
  const [activeRepo, setActiveRepo] = useState('npm');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ nexusUrl: '', repo: '', username: '', password: '' });
  const [extraFields, setExtraFields] = useState({});
  const { queue, addFiles, clearCompleted, retryItem, totalSize, estimatedTime } = useUpload(settings, activeRepo, extraFields);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data.nexusUrl) setSettings(data); })
      .catch(() => {});
  }, []);

  const handleSaveSettings = async (s) => {
    setSettings(s);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setShowSettings(false);
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen selection:bg-accent selection:text-white">
      <Sidebar nexusLogo={NEXUS_LOGO} onOpenSettings={() => setShowSettings(true)} />
      <AppHeader onOpenSettings={() => setShowSettings(true)} />
      <main className="ml-64 p-10 flex flex-col gap-12 max-w-[1400px]">
        <section>
          <h2 className="text-5xl font-extrabold tracking-tight text-primary mb-4">Upload Assets</h2>
          <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
            Push repository builds, container images, and binary artifacts to the Nexus network.
            Select your target repository type and monitor deployment status.
          </p>
        </section>

        <RepoSelector active={activeRepo} onChange={setActiveRepo} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 flex flex-col gap-10">
            <UploadZone onFiles={addFiles} repoType={activeRepo} extraFields={extraFields} onExtraChange={setExtraFields} />
            <UploadSummary totalSize={totalSize} estimatedTime={estimatedTime} activeFormat={activeRepo.toUpperCase()} />
          </div>
          <div className="lg:col-span-5">
            <UploadQueue queue={queue} onClearCompleted={clearCompleted} onRetry={retryItem} />
          </div>
        </div>

        <footer className="mt-auto py-10 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={NEXUS_LOGO} alt="Footer Logo" className="w-5 h-5 grayscale opacity-20" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300">&copy; {new Date().getFullYear()} Nexus Pusher. Architectural Precision.</p>
          </div>
          <div className="flex gap-10">
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-accent transition-colors">Security</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-accent transition-colors">Privacy</a>
            <a href="#" className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">System Status</a>
          </div>
        </footer>
      </main>

      {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
