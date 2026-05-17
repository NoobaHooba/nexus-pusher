import React from 'react';
import ExtraFieldsForm, { FIELD_MAP } from './ExtraFieldsForm';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusPill(item) {
  if (item.inspecting) return 'bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted';
  if (item.reviewStatus === 'warning') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400';
  if (item.reviewStatus === 'ready') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
  return 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400';
}

function buildFieldOverrides(repoType, editableKeys) {
  const fieldMap = FIELD_MAP[repoType] || [];
  return editableKeys
    .map((key) => fieldMap.find((field) => field.key === key) || {
      key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
      placeholder: '',
    });
}

function MetadataList({ coordinates, path }) {
  const rows = Object.entries(coordinates || {}).filter(([, value]) => value);
  if (!rows.length && !path) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      {rows.map(([key, value]) => (
        <div key={key} className="rounded-xl bg-slate-50 dark:bg-dark-surface-2 px-3 py-2">
          <p className="uppercase tracking-wider text-[10px] font-bold text-slate-400 dark:text-dark-text-faint">{key}</p>
          <p className="font-mono text-primary dark:text-dark-text break-all">{value}</p>
        </div>
      ))}
      {path && (
        <div className="rounded-xl bg-slate-50 dark:bg-dark-surface-2 px-3 py-2 md:col-span-2">
          <p className="uppercase tracking-wider text-[10px] font-bold text-slate-400 dark:text-dark-text-faint">path</p>
          <p className="font-mono text-primary dark:text-dark-text break-all">{path}</p>
        </div>
      )}
    </div>
  );
}

export default function PreflightReview({
  items,
  repoType,
  onRemove,
  onClear,
  onUpload,
  onRepoChange,
  onExtraFieldsChange,
  onToggleFavorite,
  onApplyRepoToAll,
  preferences,
  buildEditableFields,
}) {
  if (items.length === 0) return null;

  const readyCount = items.filter((item) => ['ready', 'warning'].includes(item.reviewStatus)).length;
  const inspectingCount = items.filter((item) => item.inspecting).length;

  return (
    <section className="preflight-tight flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">Stage 3 · Review & Confirm</p>
          <h3 className="text-2xl font-extrabold text-primary dark:text-dark-text mt-1">Preflight Review</h3>
          <p className="text-sm text-on-surface-variant dark:text-dark-text-muted mt-1">
            Metadata, duplicate checks, and repo suggestions are resolved before anything is pushed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
          >
            Clear Review
          </button>
          <button
            onClick={onUpload}
            disabled={readyCount === 0 || inspectingCount > 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary dark:bg-dark-accent dark:text-dark-bg text-white text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-[18px] ${inspectingCount > 0 ? 'animate-spin' : ''}`}>{inspectingCount > 0 ? 'progress_activity' : 'rocket_launch'}</span>
            {inspectingCount > 0 ? `Inspecting ${inspectingCount}` : `Upload ${readyCount} Reviewed ${readyCount === 1 ? 'File' : 'Files'}`}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const favorites = preferences?.favoritesByFormat?.[repoType] || [];
          const editableKeys = buildEditableFields(repoType, item.missingFields || []);
          const fieldOverrides = buildFieldOverrides(repoType, editableKeys);
          const selectedRepo = item.selectedRepo || '';
          const availableRepos = item.availableRepos || [];
          const suggestionNames = item.repoSuggestions || [];
          const favorite = selectedRepo && favorites.includes(selectedRepo);

          return (
            <article key={item.id} className="preflight-card-tight bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-3xl p-6 flex flex-col gap-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-lg font-extrabold text-primary dark:text-dark-text">{item.name}</h4>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${statusPill(item)}`}>
                      {item.inspecting ? 'Inspecting' : item.reviewStatus === 'warning' ? 'Duplicate Found' : item.reviewStatus === 'ready' ? 'Ready' : 'Needs Input'}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-dark-text-faint font-semibold">{formatSize(item.size)}</span>
                  </div>
                  {item.inspectError && (
                    <p className="text-sm text-rose-500 mt-2">{item.inspectError}</p>
                  )}
                </div>

                <button
                  onClick={() => onRemove(item.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <span className="material-symbols-outlined text-slate-400 dark:text-dark-text-faint">close</span>
                </button>
              </div>

              <MetadataList coordinates={item.detected?.coordinates} path={item.detected?.path} />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-dark-text-faint">Target Repository</p>
                  {selectedRepo && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleFavorite(repoType, selectedRepo)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                          favorite
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{favorite ? 'star' : 'star_outline'}</span>
                        {favorite ? 'Favorite' : 'Pin'}
                      </button>
                      <button
                        onClick={() => onApplyRepoToAll(selectedRepo)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted"
                      >
                        <span className="material-symbols-outlined text-[14px]">merge_type</span>
                        Apply To All
                      </button>
                    </div>
                  )}
                </div>

                {suggestionNames.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestionNames.slice(0, 3).map((repo) => (
                      <button
                        key={repo.name}
                        onClick={() => onRepoChange(item.id, repo.name)}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          selectedRepo === repo.name
                            ? 'bg-accent-dim/40 dark:bg-dark-accent-dim border-accent/30 text-accent dark:text-dark-accent'
                            : 'bg-slate-50 dark:bg-dark-surface-2 border-transparent text-on-surface-variant dark:text-dark-text-muted hover:border-accent/20'
                        }`}
                      >
                        {repo.name}
                        <span className="ml-2 text-[10px] opacity-70">{repo.reason}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={selectedRepo}
                    onChange={(e) => onRepoChange(item.id, e.target.value)}
                    className="min-w-[260px] px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-semibold text-primary dark:text-dark-text"
                  >
                    <option value="">Select a repository</option>
                    {availableRepos.map((repo) => (
                      <option key={repo.name} value={repo.name}>
                        {repo.name}
                      </option>
                    ))}
                  </select>
                  {selectedRepo && <p className="text-xs text-slate-400 dark:text-dark-text-faint">Selected for this file: {selectedRepo}</p>}
                </div>
              </div>

              {editableKeys.length > 0 && (
                <ExtraFieldsForm
                  repoType={repoType}
                  values={item.extraFields || {}}
                  onChange={(next) => onExtraFieldsChange(item.id, next)}
                  fieldsOverride={fieldOverrides}
                  title="Editable Fields"
                  compact
                />
              )}

              {(item.warnings?.length > 0 || item.duplicateCheck?.exists) && (
                <div className="flex flex-col gap-3">
                  {item.warnings?.map((warning) => (
                    <div key={warning} className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                      {warning}
                    </div>
                  ))}
                  {item.duplicateCheck?.exists && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 flex flex-col gap-2">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        Existing package detected in {item.duplicateCheck.repo || selectedRepo}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {item.duplicateCheck.matches?.slice(0, 4).map((match, index) => (
                          <span key={`${match.name || match.path}-${index}`} className="px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/10 font-mono text-amber-700 dark:text-amber-300">
                            {match.name || match.path}
                            {match.version ? `@${match.version}` : ''}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                        Upload is still allowed. Review the target carefully before pushing.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
