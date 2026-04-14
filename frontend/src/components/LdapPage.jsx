import React, { useState, useEffect, useCallback } from 'react';

const FORMAT_COLORS = {
  maven2: 'bg-orange-100 text-orange-700',
  npm: 'bg-red-100 text-red-700',
  docker: 'bg-blue-100 text-blue-700',
  pypi: 'bg-yellow-100 text-yellow-700',
  nuget: 'bg-purple-100 text-purple-700',
  helm: 'bg-indigo-100 text-indigo-700',
  yum: 'bg-green-100 text-green-700',
  apt: 'bg-teal-100 text-teal-700',
  raw: 'bg-slate-100 text-slate-600',
};

const TYPE_ICONS = { hosted: 'storage', proxy: 'cloud', group: 'workspaces' };

function Badge({ label, color = 'bg-accent-dim/60 text-primary' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent-dim/50 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-accent text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-primary leading-none">{value}</p>
        <p className="text-xs font-semibold text-on-surface-variant mt-1">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => (
        <div key={i} className="h-14 rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-slate-200 text-[56px] mb-3">{icon}</span>
      <p className="font-bold text-on-surface-variant">{title}</p>
      {sub && <p className="text-sm text-slate-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

export default function LdapPage({ settings }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('overview');
  const [repoSearch, setRepoSearch]   = useState('');
  const [repoFilter, setRepoFilter]   = useState('all');
  const [userSearch, setUserSearch]   = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [copied, setCopied]   = useState(null);

  const fetchData = useCallback(async () => {
    if (!settings?.nexusUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ldap/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nexusUrl: settings.nexusUrl,
          username: settings.username,
          password: settings.password,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const TABS = [
    { id: 'overview',   label: 'Overview',    icon: 'person' },
    { id: 'repos',      label: 'Repositories', icon: 'inventory_2' },
    { id: 'roles',      label: 'Roles',        icon: 'badge' },
    { id: 'matrix',     label: 'Access Matrix',icon: 'grid_view' },
    { id: 'users',      label: 'All Users',    icon: 'group', adminOnly: true },
  ];

  if (!settings?.nexusUrl) {
    return (
      <EmptyState
        icon="link_off"
        title="No connection configured"
        sub="Open Settings and enter your Nexus URL and credentials to get started."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">LDAP & Access</h2>
          <p className="text-on-surface-variant mt-1 max-w-xl">
            Inspect your Nexus user profile, roles, repository access, and team members.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
            {loading ? 'progress_activity' : 'refresh'}
          </span>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 pb-0">
        {TABS.filter(t => !t.adminOnly || data?.canReadUsers).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent text-accent bg-accent-dim/30'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && !data && <Skeleton />}

      {data && (
        <>
          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-8">
              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white text-2xl font-extrabold shrink-0">
                  {(data.user.firstName?.[0] || data.user.userId?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-extrabold text-primary">
                      {data.user.firstName} {data.user.lastName}
                    </h3>
                    <Badge
                      label={data.user.status || 'active'}
                      color={data.user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}
                    />
                    {data.isAdmin && <Badge label="Administrator" color="bg-amber-100 text-amber-700" />}
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{data.user.userId}</p>
                  {data.user.email && (
                    <p className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      {data.user.email}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {data.user.roles?.map(r => (
                      <Badge key={r} label={r} color="bg-accent-dim/60 text-primary" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="inventory_2" label="Accessible Repos" value={data.accessibleRepos.length} sub={`of ${data.repositories.length} total`} />
                <StatCard icon="badge" label="Assigned Roles" value={data.roles.length} />
                <StatCard icon="group" label="Total Users" value={data.canReadUsers ? data.allUsers.length : '—'} sub={data.canReadUsers ? undefined : 'Admin only'} />
                <StatCard icon="shield" label="Access Level" value={data.isAdmin ? 'Admin' : 'User'} />
              </div>

              {/* Quick access repos */}
              <div>
                <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3">Quick Access — Your Repositories</h4>
                {data.accessibleRepos.length === 0
                  ? <EmptyState icon="inventory_2" title="No accessible repositories" sub="Your roles may not grant repository-level access." />
                  : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.accessibleRepos.slice(0, 6).map(repo => (
                        <div key={repo.name} className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-primary truncate">{repo.name}</span>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-600'}`}>{repo.format}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-300 text-[15px]">{TYPE_ICONS[repo.type] || 'storage'}</span>
                            <span className="text-xs text-on-surface-variant capitalize">{repo.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                {data.accessibleRepos.length > 6 && (
                  <button onClick={() => setTab('repos')} className="mt-3 text-sm text-accent font-semibold hover:underline">
                    View all {data.accessibleRepos.length} repositories →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* REPOS TAB */}
          {tab === 'repos' && (
            <div className="flex flex-col gap-6">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    placeholder="Search repositories…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40"
                  />
                </div>
                <select
                  value={repoFilter}
                  onChange={e => setRepoFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                >
                  <option value="all">All formats</option>
                  {[...new Set(data.repositories.map(r => r.format))].sort().map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  value={repoFilter === 'all' ? 'all' : repoFilter}
                  onChange={() => {}}
                  className="hidden"
                />
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  {['all','hosted','proxy','group'].map(t => (
                    <button
                      key={t}
                      onClick={() => setRepoFilter(f => f === t ? 'all' : t)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        repoFilter === t ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-slate-50'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repo table */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Repository</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Format</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">URL</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.repositories
                      .filter(r => {
                        const matchSearch = r.name.toLowerCase().includes(repoSearch.toLowerCase());
                        const matchFormat = repoFilter === 'all' || r.format === repoFilter || r.type === repoFilter;
                        return matchSearch && matchFormat;
                      })
                      .map((repo, i) => {
                        const hasAccess = data.isAdmin || data.accessibleRepos.some(a => a.name === repo.name);
                        const urlKey = `repo-${repo.name}`;
                        return (
                          <tr key={repo.name} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${
                            i % 2 === 0 ? '' : 'bg-slate-50/30'
                          }`}>
                            <td className="px-5 py-3 font-semibold text-primary">{repo.name}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-600'}`}>
                                {repo.format}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-1 text-on-surface-variant">
                                <span className="material-symbols-outlined text-[15px]">{TYPE_ICONS[repo.type] || 'storage'}</span>
                                <span className="capitalize">{repo.type}</span>
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {repo.url ? (
                                <div className="flex items-center gap-1.5 max-w-[260px]">
                                  <span className="text-xs text-on-surface-variant truncate font-mono">{repo.url}</span>
                                  <button
                                    onClick={() => copyToClipboard(repo.url, urlKey)}
                                    className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-accent transition-colors"
                                    title="Copy URL"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">{copied === urlKey ? 'check' : 'content_copy'}</span>
                                  </button>
                                </div>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              {hasAccess
                                ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><span className="material-symbols-outlined text-[14px]">check_circle</span>Accessible</span>
                                : <span className="flex items-center gap-1 text-slate-400 text-xs font-bold"><span className="material-symbols-outlined text-[14px]">block</span>No access</span>
                              }
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
                {data.repositories.filter(r =>
                  r.name.toLowerCase().includes(repoSearch.toLowerCase()) &&
                  (repoFilter === 'all' || r.format === repoFilter || r.type === repoFilter)
                ).length === 0 && (
                  <EmptyState icon="search_off" title="No repositories match" sub="Try a different search or filter." />
                )}
              </div>
            </div>
          )}

          {/* ROLES TAB */}
          {tab === 'roles' && (
            <div className="flex flex-col gap-6">
              {data.roles.length === 0
                ? <EmptyState icon="badge" title="No roles assigned" sub="Your user has no roles in Nexus, or the API requires admin permissions." />
                : data.roles.map(role => (
                  <div key={role.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-extrabold text-primary text-base">{role.name || role.id}</h4>
                        {role.description && <p className="text-sm text-on-surface-variant mt-0.5">{role.description}</p>}
                        <Badge label={role.id} color="bg-accent-dim/50 text-primary" />
                      </div>
                      <span className="shrink-0 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                        {(role.privileges || []).length} privileges
                      </span>
                    </div>
                    {(role.privileges || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {role.privileges.map(p => (
                          <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-mono text-on-surface-variant">
                            <span className="material-symbols-outlined text-[11px] text-accent">key</span>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {(role.roles || []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-on-surface-variant mb-1.5">Inherits from:</p>
                        <div className="flex flex-wrap gap-2">
                          {role.roles.map(r => <Badge key={r} label={r} />)}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          {/* ACCESS MATRIX TAB */}
          {tab === 'matrix' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-on-surface-variant">Cross-reference of your roles against every repository in Nexus.</p>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  value={matrixSearch}
                  onChange={e => setMatrixSearch(e.target.value)}
                  placeholder="Filter repositories in matrix…"
                  className="w-full max-w-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              {data.roleMatrix.length === 0
                ? <EmptyState icon="grid_view" title="No matrix data" sub="No roles are assigned to your user." />
                : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                    <table className="text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="sticky left-0 bg-white px-4 py-3 text-left font-bold text-on-surface-variant uppercase tracking-wider border-r border-slate-100 z-10 min-w-[160px]">
                            Role \ Repo
                          </th>
                          {data.repositories
                            .filter(r => r.name.toLowerCase().includes(matrixSearch.toLowerCase()))
                            .map(r => (
                              <th key={r.name} className="px-3 py-3 font-semibold text-on-surface-variant max-w-[100px]">
                                <span className="block truncate max-w-[90px]" title={r.name}>{r.name}</span>
                              </th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {data.roleMatrix.map((row, i) => (
                          <tr key={row.roleId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                            <td className="sticky left-0 bg-inherit px-4 py-2.5 font-bold text-primary border-r border-slate-100 z-10">
                              {row.roleName}
                            </td>
                            {data.repositories
                              .filter(r => r.name.toLowerCase().includes(matrixSearch.toLowerCase()))
                              .map(repo => {
                                const cell = row.repos.find(r => r.repoName === repo.name);
                                return (
                                  <td key={repo.name} className="px-3 py-2.5 text-center">
                                    {cell?.hasAccess
                                      ? <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                                      : <span className="material-symbols-outlined text-slate-200 text-[16px]">radio_button_unchecked</span>
                                    }
                                  </td>
                                );
                              })
                            }
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {/* ALL USERS TAB */}
          {tab === 'users' && data.canReadUsers && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users by name, ID, or email…"
                  className="w-full max-w-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">User</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Source</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Roles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.allUsers
                      .filter(u => {
                        const q = userSearch.toLowerCase();
                        return !q || u.userId?.toLowerCase().includes(q) ||
                          u.firstName?.toLowerCase().includes(q) ||
                          u.lastName?.toLowerCase().includes(q) ||
                          u.email?.toLowerCase().includes(q);
                      })
                      .map((u, i) => (
                        <tr key={u.userId} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${
                          u.userId === settings.username ? 'bg-accent-dim/20' : i % 2 === 0 ? '' : 'bg-slate-50/30'
                        }`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent-dim/60 flex items-center justify-center text-xs font-extrabold text-primary shrink-0">
                                {(u.firstName?.[0] || u.userId?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-primary">{u.firstName} {u.lastName}</p>
                                <p className="text-xs text-on-surface-variant">{u.userId}</p>
                              </div>
                              {u.userId === settings.username && (
                                <Badge label="You" color="bg-accent-dim/60 text-accent" />
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-on-surface-variant text-xs">{u.email || '—'}</td>
                          <td className="px-5 py-3 text-xs capitalize text-on-surface-variant">{u.source || 'default'}</td>
                          <td className="px-5 py-3">
                            <Badge
                              label={u.status || 'active'}
                              color={u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(u.roles || []).slice(0, 3).map(r => (
                                <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{r}</span>
                              ))}
                              {(u.roles || []).length > 3 && (
                                <span className="text-[10px] text-slate-400">+{u.roles.length - 3}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
                {data.allUsers.filter(u => {
                  const q = userSearch.toLowerCase();
                  return !q || u.userId?.toLowerCase().includes(q) ||
                    u.firstName?.toLowerCase().includes(q) ||
                    u.lastName?.toLowerCase().includes(q) ||
                    u.email?.toLowerCase().includes(q);
                }).length === 0 && (
                  <EmptyState icon="person_search" title="No users match" sub="Try a different search term." />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
