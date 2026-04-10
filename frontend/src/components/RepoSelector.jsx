import React from 'react';

export const REPO_TYPES = [
  { id: 'maven',  label: 'Maven',  icon: 'account_tree',  placeholder: 'e.g. maven-releases' },
  { id: 'npm',    label: 'NPM',    icon: 'javascript',    placeholder: 'e.g. npm-internal' },
  { id: 'nuget',  label: 'NuGet',  icon: 'grid_view',     placeholder: 'e.g. nuget-hosted' },
  { id: 'pypi',   label: 'PyPI',   icon: 'code',          placeholder: 'e.g. pypi-internal' },
  { id: 'docker', label: 'Docker', icon: 'dock',          placeholder: 'e.g. docker-private' },
  { id: 'yum',    label: 'Yum',    icon: 'inventory_2',   placeholder: 'e.g. yum-hosted' },
  { id: 'apt',    label: 'Apt',    icon: 'terminal',      placeholder: 'e.g. apt-hosted' },
  { id: 'helm',   label: 'Helm',   icon: 'sailing',       placeholder: 'e.g. helm-charts' },
  { id: 'raw',    label: 'Raw',    icon: 'folder_zip',    placeholder: 'e.g. raw-assets' },
];

export default function RepoSelector({ active, onChange, repoNames, onRepoNameChange }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold tracking-tight text-primary">Target Repositories</h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">9 Available Types</span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-6">
        {REPO_TYPES.map(({ id, label, icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white transition-all duration-300 ${
                isActive
                  ? 'border-2 border-accent shadow-xl shadow-accent/5'
                  : 'border border-transparent hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isActive ? 'bg-accent-dim' : 'bg-slate-50 group-hover:bg-accent-dim'
              }`}>
                <span className={`material-symbols-outlined transition-colors ${
                  isActive ? 'text-accent' : 'text-primary group-hover:text-accent'
                }`}>{icon}</span>
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'
              }`}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline repo name input — shown only for the active type */}
      {active && (() => {
        const type = REPO_TYPES.find(r => r.id === active);
        return (
          <div className="mt-6 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm">
            <span className="material-symbols-outlined text-accent text-[20px]">dns</span>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {type.label} Repository Name
              </label>
              <input
                type="text"
                value={repoNames[active] || ''}
                onChange={e => onRepoNameChange(active, e.target.value)}
                placeholder={type.placeholder}
                className="text-sm font-semibold text-primary bg-transparent border-none outline-none placeholder:text-slate-300 w-full"
              />
            </div>
            <span className="text-[10px] font-medium text-slate-300 whitespace-nowrap">
              Nexus repo name
            </span>
          </div>
        );
      })()}
    </section>
  );
}
