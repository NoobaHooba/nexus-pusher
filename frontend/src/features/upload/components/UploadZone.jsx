import React, { useRef, useState, useCallback, useEffect } from 'react';

const REPO_EXTENSIONS = {
  maven:  ['.jar', '.war', '.ear', '.pom', '.aar', '.zip'],
  npm:    ['.tgz', '.tar.gz', '.gz'],
  nuget:  ['.nupkg', '.snupkg'],
  pypi:   ['.whl', '.tar.gz', '.zip', '.egg'],
  docker: ['.tar', '.tar.gz', '.tgz'],
  cargo:  ['.crate'],
  conan:  [],
  yum:    ['.rpm'],
  apt:    ['.deb'],
  helm:   ['.tgz', '.tar.gz', '.gz'],
  raw:    [],
};

const REPO_HINTS = {
  maven:  '.jar · .war · .ear · .pom · .aar',
  npm:    '.tgz (npm pack)',
  nuget:  '.nupkg · .snupkg',
  pypi:   '.whl · .tar.gz · .egg',
  docker: '.tar · .tar.gz',
  cargo:  '.crate',
  yum:    '.rpm',
  apt:    '.deb',
  helm:   '.tgz (helm package)',
  raw:    'any file',
};

function trimBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function buildClientTargets(settings, repoName) {
  const selectedRepo = String(repoName || '').trim().replace(/^\/+|\/+$/g, '') || '<repository>';
  const baseUrl = trimBaseUrl(settings?.nexusBrowserUrl || settings?.nexusUrl || 'https://nexus.example.com');
  const repositoryUrl = `${baseUrl}/repository/${selectedRepo}/`;
  const dockerRegistryBase = trimBaseUrl(settings?.dockerRegistry || '').replace(/^https?:\/\//i, '')
    || `${baseUrl.replace(/^https?:\/\//i, '')}/repository`;
  const dockerRegistry = `${dockerRegistryBase.replace(/\/+$/, '')}/${selectedRepo}`;
  const dockerHost = dockerRegistryBase.split('/')[0] || '<registry-host>';
  const dockerUploadUrl = trimBaseUrl(settings?.dockerUploadUrl || '');

  return {
    baseUrl,
    selectedRepo,
    repositoryUrl,
    cargoIndexUrl: `sparse+${repositoryUrl}`,
    conanRemoteUrl: repositoryUrl,
    dockerRegistry,
    dockerHost,
    dockerUploadUrl,
    username: settings?.username || '<username>',
  };
}

function buildClientCommands({ repoType, selectedRepo, cargoIndexUrl, conanRemoteUrl, dockerRegistry, dockerHost, username }) {
  if (repoType === 'cargo') {
    return [
      `[registries.${selectedRepo}]`,
      `index = "${cargoIndexUrl}"`,
      `cargo login --registry ${selectedRepo}`,
      `cargo publish --registry ${selectedRepo}`,
    ];
  }

  if (repoType === 'docker') {
    return [
      'docker load -i <archive.tar>',
      'docker image ls',
      `docker tag <loaded-image>:<tag> ${dockerRegistry}/<image>:<tag>`,
      `docker login ${dockerHost}`,
      `docker push ${dockerRegistry}/<image>:<tag>`,
    ];
  }

  return [
    `conan remote add ${selectedRepo} ${conanRemoteUrl}`,
    `conan remote login ${selectedRepo} ${username}`,
    `conan upload <name>/<version>@<user>/<channel> -r ${selectedRepo}`,
  ];
}

function CommandList({ commands }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyCommand = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1200);
    } catch (_) {
      setCopiedIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {commands.map((command, index) => (
        <div key={`${command}-${index}`} className="flex items-center gap-2 rounded-xl bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border px-3 py-2">
          <code className="flex-1 overflow-x-auto text-sm font-mono text-primary dark:text-dark-text whitespace-nowrap">
            {command}
          </code>
          <button
            type="button"
            onClick={() => copyCommand(command, index)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-dark-text-faint hover:text-accent dark:hover:text-dark-accent hover:bg-accent-dim/40 dark:hover:bg-dark-accent-dim transition-colors"
            title="Copy command"
          >
            <span className="material-symbols-outlined text-[17px]">{copiedIndex === index ? 'check' : 'content_copy'}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function ClientOnlyZone({ repoType, settings, repoName }) {
  const { selectedRepo, cargoIndexUrl, conanRemoteUrl, dockerRegistry, dockerHost, dockerUploadUrl, username } = buildClientTargets(settings, repoName);
  const isCargo = repoType === 'cargo';
  const isDocker = repoType === 'docker';
  const commands = buildClientCommands({
    repoType,
    selectedRepo,
    cargoIndexUrl,
    conanRemoteUrl,
    dockerRegistry,
    dockerHost,
    username,
  });
  const showDockerUploadLink = isDocker && isHttpUrl(dockerUploadUrl);

  return (
    <div className="upload-page-tight flex flex-col gap-6">
      <div className="upload-zone-tight bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-3xl p-10 flex flex-col gap-5">
        <div className="w-16 h-16 rounded-2xl bg-accent-dim dark:bg-dark-accent-dim flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-accent dark:text-dark-accent">
            {isCargo ? 'package_2' : isDocker ? 'inventory_2' : 'deployed_code'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-2xl font-bold text-primary dark:text-dark-text">
            {isCargo ? 'Cargo Uses cargo publish' : isDocker ? 'Docker Uses docker push' : 'Conan Uses conan upload'}
          </h4>
          <p className="text-on-surface-variant dark:text-dark-text-muted max-w-2xl">
            Nexus requires the native {isCargo ? 'Cargo' : isDocker ? 'Docker' : 'Conan'} client for this format, so this app guides the target repository and exact publish commands instead of uploading the package file directly.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-dark-surface-2 border border-slate-100 dark:border-dark-border px-5 py-4 flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-dark-text-faint">
            {isCargo ? 'Cargo Client Flow' : isDocker ? 'Docker Client Flow' : 'Conan Client Flow'}
          </p>
          <CommandList commands={commands} />
          {showDockerUploadLink && (
            <a
              href={dockerUploadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-primary dark:bg-dark-accent px-4 py-2.5 text-sm font-bold text-white dark:text-dark-bg hover:bg-black dark:hover:opacity-90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              Open Docker upload portal
            </a>
          )}
          {!repoName && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Select a {isCargo ? 'Cargo' : isDocker ? 'Docker' : 'Conan'} repository above to generate the exact target.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function validateFiles(files, repoType) {
  const allowed = REPO_EXTENSIONS[repoType];
  if (!allowed || allowed.length === 0) return { valid: files, warnings: [] };
  const valid = [], warnings = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    allowed.some(ext => name.endsWith(ext)) ? valid.push(file) : warnings.push(file.name);
  }
  return { valid, warnings };
}

export default function UploadZone({ onFiles, repoType, stagedCount, settings, repoName }) {
  const inputRef            = useRef();
  const [dragging, setDragging]   = useState(false);
  const [warnings, setWarnings]   = useState([]);
  const [accepted, setAccepted]   = useState(0);
  const [pasteFlash, setPasteFlash] = useState(false);
  const warningTimeout  = useRef(null);
  const pasteFlashTimer = useRef(null);

  const dismissWarning = useCallback(() => { setWarnings([]); setAccepted(0); }, []);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    const { valid, warnings: warnList } = validateFiles(Array.from(files), repoType);
    if (warnList.length > 0) {
      setWarnings(warnList);
      setAccepted(valid.length);
      if (warningTimeout.current) clearTimeout(warningTimeout.current);
      warningTimeout.current = setTimeout(dismissWarning, 6000);
    } else {
      setWarnings([]);
    }
    if (valid.length > 0) onFiles(valid);
  }, [repoType, onFiles, dismissWarning]);

  useEffect(() => {
    const onPaste = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter(Boolean);

      if (files.length === 0) return;

      setPasteFlash(true);
      if (pasteFlashTimer.current) clearTimeout(pasteFlashTimer.current);
      pasteFlashTimer.current = setTimeout(() => setPasteFlash(false), 600);

      handleFiles(files);
    };

    window.addEventListener('paste', onPaste);
    // FIX 4: The original cleanup only cancelled pasteFlashTimer but did NOT
    // call window.removeEventListener. Fixed: both listeners are now properly
    // removed and both timers cleared on unmount.
    return () => {
      window.removeEventListener('paste', onPaste);
      if (pasteFlashTimer.current) clearTimeout(pasteFlashTimer.current);
      if (warningTimeout.current)  clearTimeout(warningTimeout.current);
    };
  }, [handleFiles]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const hint = REPO_HINTS[repoType];

  if (repoType === 'cargo' || repoType === 'conan' || repoType === 'docker') {
    return <ClientOnlyZone repoType={repoType} settings={settings} repoName={repoName} />;
  }

  return (
    <div className="upload-page-tight flex flex-col gap-6">
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl">
          <span className="material-symbols-outlined text-amber-500 text-[22px] flex-shrink-0 mt-0.5">warning</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {warnings.length === 1
                ? `1 file skipped — wrong type for ${repoType.toUpperCase()}`
                : `${warnings.length} files skipped — wrong type for ${repoType.toUpperCase()}`}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Expected: <span className="font-mono font-semibold">{hint || 'matching format'}</span>
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {warnings.slice(0, 4).map(name => (
                <li key={name} className="text-[11px] font-mono text-amber-600 dark:text-amber-500 truncate">{name}</li>
              ))}
              {warnings.length > 4 && <li className="text-[11px] text-amber-500">…and {warnings.length - 4} more</li>}
            </ul>
            {accepted > 0 && <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 font-medium">✓ {accepted} valid file{accepted !== 1 ? 's' : ''} added to staging.</p>}
          </div>
          <button onClick={dismissWarning} className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
        className={`upload-zone-tight relative group border-2 border-dashed rounded-3xl p-16 bg-white dark:bg-dark-surface flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          pasteFlash
            ? 'border-accent bg-accent-dim/20 dark:bg-dark-accent-dim/30 scale-[1.01]'
            : dragging
            ? 'border-accent/60 bg-accent-dim/10 dark:bg-dark-accent-dim/20'
            : 'border-slate-200 dark:border-dark-border hover:border-accent/40'
        }`}
      >
        <div className={`w-20 h-20 bg-accent-dim dark:bg-dark-accent-dim rounded-2xl flex items-center justify-center mb-6 transition-transform ${
          pasteFlash || dragging ? 'scale-110' : 'group-hover:scale-110'
        }`}>
          <span className="material-symbols-outlined text-4xl text-accent dark:text-dark-accent">
            {pasteFlash ? 'content_paste' : 'upload_file'}
          </span>
        </div>

        <h4 className="text-2xl font-bold text-primary dark:text-dark-text mb-2">
          {pasteFlash ? 'Pasted!' : 'Drop artifacts or click to browse'}
        </h4>
        <p className="text-on-surface-variant dark:text-dark-text-muted max-w-sm mb-1">
          Files are staged before uploading — review and push when ready
        </p>
        {hint && <p className="text-xs text-slate-400 dark:text-dark-text-faint font-mono mb-1">{hint}</p>}

        <p className="text-[11px] text-slate-300 dark:text-dark-text-faint font-medium mb-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[13px]">content_paste</span>
          <span>or press</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted font-mono text-[10px] border border-slate-200 dark:border-dark-border">
            Ctrl+V
          </kbd>
          <span>/</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted font-mono text-[10px] border border-slate-200 dark:border-dark-border">
            ⌘V
          </kbd>
          <span>anywhere</span>
        </p>

        {stagedCount > 0 && (
          <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-accent-dim/30 dark:bg-dark-accent-dim/40 rounded-full">
            <span className="material-symbols-outlined text-accent dark:text-dark-accent text-[16px]">inventory_2</span>
            <span className="text-xs font-bold text-accent dark:text-dark-accent">
              {stagedCount} file{stagedCount !== 1 ? 's' : ''} in review — confirm details below, then upload
            </span>
          </div>
        )}

        <button
          type="button"
          className="bg-primary dark:bg-dark-surface-2 dark:border dark:border-dark-border text-white dark:text-dark-text px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black dark:hover:bg-dark-border transition-colors shadow-lg shadow-black/5"
          onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
        >
          <span className="material-symbols-outlined text-xl">add</span>
          {stagedCount > 0 ? 'Add More Files' : 'Select Local Assets'}
        </button>

        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}
