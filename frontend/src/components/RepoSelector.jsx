import React from 'react';

const REPO_TYPES = [
  { id: 'maven',  label: 'Maven',  icon: 'account_tree' },
  { id: 'npm',    label: 'NPM',    icon: 'javascript' },
  { id: 'nuget',  label: 'NuGet',  icon: 'grid_view' },
  { id: 'pypi',   label: 'PyPI',   icon: 'code' },
  { id: 'docker', label: 'Docker', icon: 'dock' },
  { id: 'yum',    label: 'Yum',    icon: 'inventory_2' },
  { id: 'apt',    label: 'Apt',    icon: 'terminal' },
  { id: 'helm',   label: 'Helm',   icon: 'sailing' },
  { id: 'raw',    label: 'Raw',    icon: 'folder_zip' },
];

export default function RepoSelector({ active, onChange }) {
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
    </section>
  );
}
