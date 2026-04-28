import React from 'react';

export const REPO_TYPES = [
  { id: 'maven',  label: 'Maven',  icon: 'account_tree',  placeholder: 'e.g. maven-releases' },
  { id: 'npm',    label: 'NPM',    icon: 'javascript',    placeholder: 'e.g. npm-internal' },
  { id: 'nuget',  label: 'NuGet',  icon: 'grid_view',     placeholder: 'e.g. nuget-hosted' },
  { id: 'pypi',   label: 'PyPI',   icon: 'code',          placeholder: 'e.g. pypi-internal' },
  { id: 'docker', label: 'Docker', icon: 'dock',          placeholder: 'e.g. docker-hosted' },
  { id: 'cargo',  label: 'Cargo',  icon: 'package_2',     placeholder: 'e.g. cargo-hosted' },
  { id: 'conan',  label: 'Conan',  icon: 'deployed_code', placeholder: 'e.g. conan-hosted' },
  { id: 'yum',    label: 'Yum',    icon: 'inventory_2',   placeholder: 'e.g. yum-hosted' },
  { id: 'apt',    label: 'Apt',    icon: 'terminal',      placeholder: 'e.g. apt-hosted' },
  { id: 'helm',   label: 'Helm',   icon: 'sailing',       placeholder: 'e.g. helm-charts' },
  { id: 'raw',    label: 'Raw',    icon: 'folder_zip',    placeholder: 'e.g. raw-assets' },
];

const FORMAT_ALIASES = {
  maven: 'maven2',
};

function getRepoFormat(type) {
  return FORMAT_ALIASES[type] || type;
}

export default function RepoSelector({
  active,
  onChange,
  repoNames,
  onRepoNameChange,
  availableRepos = [],
  reposLoading = false,
  reposError = '',
  preferences = {},
  defaultRepo = '',
  onToggleFavorite,
}) {
  const filteredRepos = active
    ? availableRepos
        .filter(repo => repo?.format === getRepoFormat(active) && repo?.type === 'hosted' && repo?.name)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const selectedRepoName = repoNames[active] || '';
  const favorites = preferences?.favoritesByFormat?.[active] || [];
  const recents = preferences?.recentReposByFormat?.[active] || [];
  const rankedRepos = [...filteredRepos].sort((a, b) => {
    const score = (repoName) => {
      let value = 0;
      if (repoName === defaultRepo) value += 4;
      if (favorites.includes(repoName)) value += 3;
      const recentIndex = recents.indexOf(repoName);
      if (recentIndex !== -1) value += Math.max(1, 3 - recentIndex);
      return value;
    };
    return score(b.name) - score(a.name) || a.name.localeCompare(b.name);
  });
  const suggestedRepos = rankedRepos.slice(0, 3);

  return (
    <section>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold tracking-tight text-primary dark:text-dark-text">Target Repositories</h3>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">11 Available Types</span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-11 gap-6">
        {REPO_TYPES.map(({ id, label, icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white dark:bg-dark-surface transition-all duration-300 ${
                isActive
                  ? 'border-2 border-accent shadow-xl shadow-accent/5'
                  : 'border border-transparent dark:border-dark-border hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                isActive ? 'bg-accent-dim dark:bg-dark-accent-dim' : 'bg-slate-50 dark:bg-dark-surface-2 group-hover:bg-accent-dim dark:group-hover:bg-dark-accent-dim'
              }`}>
                <span className={`material-symbols-outlined transition-colors ${
                  isActive ? 'text-accent dark:text-dark-accent' : 'text-primary dark:text-dark-text-muted group-hover:text-accent dark:group-hover:text-dark-accent'
                }`}>{icon}</span>
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-primary dark:text-dark-text' : 'text-on-surface-variant dark:text-dark-text-muted group-hover:text-primary dark:group-hover:text-dark-text'
              }`}>{label}</span>
            </button>
          );
        })}
      </div>

      {active && (() => {
        const type = REPO_TYPES.find(r => r.id === active);
        return (
          <div className="mt-6 flex items-start gap-4 bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-2xl px-6 py-4 shadow-sm">
            <span className="material-symbols-outlined text-accent dark:text-dark-accent text-[20px]">dns</span>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-dark-text-faint">
                {type.label} Repository
              </label>
              {suggestedRepos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {suggestedRepos.map((repo) => (
                    <button
                      key={repo.name}
                      onClick={() => onRepoNameChange(active, repo.name)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                        selectedRepoName === repo.name
                          ? 'bg-accent-dim/50 dark:bg-dark-accent-dim text-accent dark:text-dark-accent'
                          : 'bg-slate-100 dark:bg-dark-surface-2 text-slate-500 dark:text-dark-text-muted'
                      }`}
                    >
                      {repo.name}
                    </button>
                  ))}
                </div>
              )}
              {filteredRepos.length > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedRepoName}
                      onChange={e => onRepoNameChange(active, e.target.value)}
                      className="text-sm font-semibold text-primary dark:text-dark-text bg-transparent border-none outline-none w-full pr-8"
                    >
                      <option value="">Select a {type.label} repository</option>
                      {rankedRepos.map((repo) => (
                        <option key={repo.name} value={repo.name}>
                          {repo.name}
                        </option>
                      ))}
                    </select>
                    {selectedRepoName && (
                      <button
                        onClick={() => onToggleFavorite?.(active, selectedRepoName)}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                          favorites.includes(selectedRepoName)
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-dark-surface-2 text-slate-400 dark:text-dark-text-faint'
                        }`}
                        title={favorites.includes(selectedRepoName) ? 'Unpin repo' : 'Pin repo'}
                      >
                        <span className="material-symbols-outlined text-[18px]">{favorites.includes(selectedRepoName) ? 'star' : 'star_outline'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-dark-text-faint mt-1">
                    Showing hosted {type.label.toLowerCase()} repositories from Nexus. Favorites, recents, and the default repo are ranked first.
                  </p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={selectedRepoName}
                    onChange={e => onRepoNameChange(active, e.target.value)}
                    placeholder={type.placeholder}
                    className="text-sm font-semibold text-primary dark:text-dark-text bg-transparent border-none outline-none placeholder:text-slate-300 dark:placeholder:text-dark-text-faint w-full"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-dark-text-faint mt-1">
                    {reposLoading
                      ? 'Loading repositories from Nexus…'
                      : reposError
                        ? 'Repository list unavailable. Enter the repo name manually.'
                        : `No hosted ${type.label.toLowerCase()} repositories found. Enter the repo name manually.`}
                  </p>
                </>
              )}
            </div>
            <span className="text-[10px] font-medium text-slate-300 dark:text-dark-text-faint whitespace-nowrap">
              {filteredRepos.length > 0 ? `${filteredRepos.length} available` : 'Manual fallback'}
            </span>
          </div>
        );
      })()}
    </section>
  );
}
