import React, { useRef, useState, useCallback } from 'react';
import ExtraFieldsForm from './ExtraFieldsForm';

const REPO_EXTENSIONS = {
  maven:  ['.jar', '.war', '.ear', '.pom', '.aar', '.zip'],
  npm:    ['.tgz', '.tar.gz', '.gz'],
  nuget:  ['.nupkg', '.snupkg'],
  pypi:   ['.whl', '.tar.gz', '.zip', '.egg'],
  docker: [],
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
  yum:    '.rpm',
  apt:    '.deb',
  helm:   '.tgz (helm package)',
  raw:    'any file',
};

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

export default function UploadZone({ onFiles, repoType, extraFields, onExtraChange, stagedCount }) {
  const inputRef       = useRef();
  const [dragging, setDragging]   = useState(false);
  const [warnings, setWarnings]   = useState([]);
  const [accepted, setAccepted]   = useState(0);
  const warningTimeout = useRef(null);

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

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const hint = REPO_HINTS[repoType];

  return (
    <div className="flex flex-col gap-6">
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
        className={`relative group border-2 border-dashed rounded-3xl p-16 bg-white dark:bg-dark-surface flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragging
            ? 'border-accent/60 bg-accent-dim/10 dark:bg-dark-accent-dim/20'
            : 'border-slate-200 dark:border-dark-border hover:border-accent/40'
        }`}
      >
        <div className={`w-20 h-20 bg-accent-dim dark:bg-dark-accent-dim rounded-2xl flex items-center justify-center mb-6 transition-transform ${
          dragging ? 'scale-110' : 'group-hover:scale-110'
        }`}>
          <span className="material-symbols-outlined text-4xl text-accent dark:text-dark-accent">upload_file</span>
        </div>

        <h4 className="text-2xl font-bold text-primary dark:text-dark-text mb-2">Drop artifacts or click to browse</h4>
        <p className="text-on-surface-variant dark:text-dark-text-muted max-w-sm mb-1">
          Files are staged before uploading — review and push when ready
        </p>
        {hint && <p className="text-xs text-slate-400 dark:text-dark-text-faint font-mono mb-4">{hint}</p>}

        {stagedCount > 0 && (
          <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-accent-dim/30 dark:bg-dark-accent-dim/40 rounded-full">
            <span className="material-symbols-outlined text-accent dark:text-dark-accent text-[16px]">inventory_2</span>
            <span className="text-xs font-bold text-accent dark:text-dark-accent">
              {stagedCount} file{stagedCount !== 1 ? 's' : ''} staged — see bar below to push
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
      <ExtraFieldsForm repoType={repoType} values={extraFields} onChange={onExtraChange} />
    </div>
  );
}
