import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiUrl } from '../../shared/lib/backendApi';
import { createHttpError, createNetworkError, formatUserError } from '../../shared/lib/errorMessages';
import { INPUT_LIMITS, sanitizeText } from '../../shared/lib/inputValidation';

const FORMAT_COLORS = {
  maven2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  npm: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  docker: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cargo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  conan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  swift: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  terraform: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  pypi: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  nuget: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  helm: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  yum: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  apt: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  raw: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const TYPE_ICONS = { hosted: 'storage', proxy: 'cloud', group: 'workspaces' };

function Badge({ label, color = 'bg-accent-dim/60 text-primary dark:bg-dark-accent-dim dark:text-dark-accent' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl p-5 border border-slate-100 dark:border-dark-border shadow-sm dark:shadow-black/20 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent-dim/50 dark:bg-dark-accent-dim flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-accent dark:text-dark-accent text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-primary dark:text-dark-text leading-none">{value}</p>
        <p className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted mt-1">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 dark:text-dark-text-faint mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-dark-surface-2" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-slate-200 dark:text-dark-border text-[56px] mb-3">{icon}</span>
      <p className="font-bold text-on-surface-variant dark:text-dark-text-muted">{title}</p>
      {sub && <p className="text-sm text-slate-400 dark:text-dark-text-faint mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function matchesSearch(values, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(q));
}

function dedupeStrings(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportCsv(filename, headers, rows) {
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function UserPills({ userIds, userMap, limit = 8 }) {
  if (!userIds?.length) return <span className="text-xs text-slate-300 dark:text-dark-text-faint">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {userIds.slice(0, limit).map((userId) => {
        const user = userMap.get(userId);
        return (
          <span key={userId} title={user?.email || userId} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-surface-2 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-dark-text-muted">
            {user?.isAdmin && <span className="material-symbols-outlined text-[11px] text-amber-500">shield</span>}
            {user?.displayName || userId}
          </span>
        );
      })}
      {userIds.length > limit && (
        <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{userIds.length - limit}</span>
      )}
    </div>
  );
}

function PrivilegePills({ privilegeIds, limit = 8 }) {
  if (!privilegeIds?.length) return <span className="text-xs text-slate-300 dark:text-dark-text-faint">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {privilegeIds.slice(0, limit).map((privilegeId) => (
        <span key={privilegeId} className="inline-flex items-center gap-1 rounded-lg border border-slate-100 dark:border-dark-border bg-slate-50 dark:bg-dark-surface-2 px-2 py-0.5 text-[10px] font-mono text-on-surface-variant dark:text-dark-text-muted">
          <span className="material-symbols-outlined text-[10px] text-accent dark:text-dark-accent">key</span>
          {privilegeId}
        </span>
      ))}
      {privilegeIds.length > limit && (
        <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{privilegeIds.length - limit}</span>
      )}
    </div>
  );
}

function RolePills({ roleIds, limit = 8 }) {
  if (!roleIds?.length) return <span className="text-xs text-slate-300 dark:text-dark-text-faint">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roleIds.slice(0, limit).map((roleId) => (
        <span key={roleId} className="rounded-full bg-accent-dim/50 dark:bg-dark-accent-dim px-2 py-0.5 text-[10px] font-bold text-accent dark:text-dark-accent">
          {roleId}
        </span>
      ))}
      {roleIds.length > limit && (
        <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{roleIds.length - limit}</span>
      )}
    </div>
  );
}

function ActionPills({ actions, limit = 8 }) {
  if (!actions?.length) return <span className="text-xs text-slate-300 dark:text-dark-text-faint">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.slice(0, limit).map((action) => (
        <span key={action} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          ['*', 'delete'].includes(String(action).toLowerCase())
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            : ['add', 'edit'].includes(String(action).toLowerCase())
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}>
          {action}
        </span>
      ))}
      {actions.length > limit && (
        <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{actions.length - limit}</span>
      )}
    </div>
  );
}

function hasWriteAction(actions = []) {
  return (actions || []).some((action) => ['*', 'add', 'edit', 'delete'].includes(String(action).toLowerCase()));
}

function hasDeleteAction(actions = []) {
  return (actions || []).some((action) => ['*', 'delete'].includes(String(action).toLowerCase()));
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
  const [permissionView, setPermissionView] = useState('repositories');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionRiskFilter, setPermissionRiskFilter] = useState('all');
  const [permissionTypeFilter, setPermissionTypeFilter] = useState('all');
  const [permissionSourceFilter, setPermissionSourceFilter] = useState('all');
  const [permissionStatusFilter, setPermissionStatusFilter] = useState('all');
  const [permissionAdminFilter, setPermissionAdminFilter] = useState('all');
  const [copied, setCopied]   = useState(null);
  const [copyError, setCopyError] = useState('');
  const fetchIdRef = useRef(0);
  const loadingKeyRef = useRef('');
  const autoSelectedAdminTabRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!settings?.nexusUrl) return;
    const fetchKey = `${settings.nexusUrl}|${settings.username || ''}`;
    if (loadingKeyRef.current === fetchKey) return;
    loadingKeyRef.current = fetchKey;
    const fetchId = fetchIdRef.current + 1;
    fetchIdRef.current = fetchId;
    setLoading(true);
    setError(null);
    try {
      let res;
      try {
        res = await fetch(apiUrl(settings, '/api/ldap/info'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nexusUrl: settings.nexusUrl,
            username: settings.username,
            password: settings.password,
          }),
        });
      } catch (_) {
        throw createNetworkError({ action: 'loading permissions' });
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw createHttpError(res.status, e.error, { action: 'loading permissions' });
      }
      const nextData = await res.json();
      if (fetchId === fetchIdRef.current) setData(nextData);
    } catch (e) {
      if (fetchId === fetchIdRef.current) setError(formatUserError(e, { action: 'loading permissions' }));
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
      if (loadingKeyRef.current === fetchKey) loadingKeyRef.current = '';
    }
  }, [settings]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!data?.permissionAudit || autoSelectedAdminTabRef.current) return;
    autoSelectedAdminTabRef.current = true;
    setTab('permissions');
  }, [data?.permissionAudit]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyError('');
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {
      setCopied(null);
      setCopyError('Could not copy to the clipboard. Select the value and copy it manually.');
    });
  };

  const TABS = [
    { id: 'overview',   label: 'Overview',    icon: 'person' },
    { id: 'repos',      label: 'Repositories', icon: 'inventory_2' },
    { id: 'roles',      label: 'Roles',        icon: 'badge' },
    { id: 'matrix',     label: 'Access Matrix',icon: 'grid_view' },
    { id: 'permissions', label: 'Permissions', icon: 'admin_panel_settings', adminOnly: true, auditOnly: true },
    { id: 'users',      label: 'All Users',    icon: 'group', adminOnly: true },
  ];

  const permissionAudit = data?.permissionAudit || null;
  const repositoryAccessAudit = data?.repositoryAccessAudit || null;
  const permissionUserMap = useMemo(() => new Map((permissionAudit?.users || []).map((user) => [user.userId, user])), [permissionAudit]);
  const filteredPermissionRepositories = useMemo(() => (
    (repositoryAccessAudit?.repositories || []).filter((repo) => {
      const matchRisk = permissionRiskFilter === 'all'
        || (permissionRiskFilter === 'wildcard' && repo.risk?.wildcard)
        || (permissionRiskFilter === 'write' && repo.risk?.writeCapableUsers > 0)
        || (permissionRiskFilter === 'delete' && repo.risk?.deleteCapableUsers > 0)
        || (permissionRiskFilter === 'inactive' && repo.risk?.inactiveUsers > 0);
      const matchAdmin = permissionAdminFilter === 'all'
        || (permissionAdminFilter === 'admin' ? repo.risk?.wildcard : !repo.risk?.wildcard);
      return matchRisk && matchAdmin && matchesSearch([
        repo.name,
        repo.format,
        repo.type,
        ...(repo.actions || []),
        ...(repo.roles || []),
        ...(repo.privileges || []),
        ...(repo.users || []).flatMap((user) => [user.userId, user.displayName, user.email, user.status, ...(user.actions || [])]),
      ], permissionSearch);
    })
  ), [permissionAdminFilter, permissionRiskFilter, permissionSearch, repositoryAccessAudit]);
  const permissionTypes = useMemo(() => dedupeStrings((permissionAudit?.privileges || []).map((privilege) => privilege.type || 'application')), [permissionAudit]);
  const permissionSources = useMemo(() => dedupeStrings((permissionAudit?.users || []).map((user) => user.source || 'default')), [permissionAudit]);
  const permissionStatuses = useMemo(() => dedupeStrings((permissionAudit?.users || []).map((user) => user.status || 'unknown')), [permissionAudit]);
  const filteredPermissionRoles = useMemo(() => (
    (permissionAudit?.roles || []).filter((role) => {
      const matchAdmin = permissionAdminFilter === 'all' || (permissionAdminFilter === 'admin' ? role.isAdminRole : !role.isAdminRole);
      return matchAdmin && matchesSearch([
        role.id,
        role.name,
        role.description,
        ...(role.effectiveUsers || []).map((userId) => permissionUserMap.get(userId)?.displayName || userId),
        ...(role.effectivePrivileges || []),
      ], permissionSearch);
    })
  ), [permissionAudit, permissionAdminFilter, permissionSearch, permissionUserMap]);
  const filteredPermissionPrivileges = useMemo(() => (
    (permissionAudit?.privileges || []).filter((privilege) => {
      const matchType = permissionTypeFilter === 'all' || (privilege.type || 'application') === permissionTypeFilter;
      const matchAdmin = permissionAdminFilter === 'all' || (permissionAdminFilter === 'admin' ? privilege.isWildcard : !privilege.isWildcard);
      return matchType && matchAdmin && matchesSearch([
        privilege.id,
        privilege.name,
        privilege.description,
        privilege.type,
        privilege.format,
        privilege.repository,
        ...(privilege.users || []).map((userId) => permissionUserMap.get(userId)?.displayName || userId),
        ...(privilege.effectiveRoles || []),
      ], permissionSearch);
    })
  ), [permissionAudit, permissionAdminFilter, permissionSearch, permissionTypeFilter, permissionUserMap]);
  const filteredPermissionUsers = useMemo(() => (
    (permissionAudit?.users || []).filter((user) => {
      const matchSource = permissionSourceFilter === 'all' || (user.source || 'default') === permissionSourceFilter;
      const matchStatus = permissionStatusFilter === 'all' || (user.status || 'unknown') === permissionStatusFilter;
      const matchAdmin = permissionAdminFilter === 'all' || (permissionAdminFilter === 'admin' ? user.isAdmin : !user.isAdmin);
      return matchSource && matchStatus && matchAdmin && matchesSearch([
        user.userId,
        user.displayName,
        user.email,
        user.source,
        user.status,
        ...(user.effectiveRoles || []),
        ...(user.effectivePrivileges || []),
      ], permissionSearch);
    })
  ), [permissionAdminFilter, permissionAudit, permissionSearch, permissionSourceFilter, permissionStatusFilter]);

  const exportPermissions = () => {
    const date = new Date().toISOString().slice(0, 10);
    if (permissionView === 'repositories') {
      exportCsv(
        `nexus-repository-access-${date}.csv`,
        ['Repository', 'Format', 'Type', 'User ID', 'Name', 'Email', 'Status', 'Admin', 'Actions', 'Roles', 'Privileges', 'Access Paths'],
        filteredPermissionRepositories.flatMap((repo) => (
          (repo.users || []).map((user) => [
            repo.name,
            repo.format,
            repo.type,
            user.userId,
            user.displayName,
            user.email,
            user.status,
            user.isAdmin ? 'yes' : 'no',
            (user.actions || []).join('; '),
            (user.roleIds || []).join('; '),
            (user.privilegeIds || []).join('; '),
            (user.accessPaths || []).map((path) => `${path.directRole}${path.inheritedRoles?.length ? ` > ${path.inheritedRoles.join(' > ')}` : ''} -> ${path.privilegeId} (${(path.actions || []).join('|')})`).join('; '),
          ])
        )),
      );
      return;
    }
    if (permissionView === 'privileges') {
      exportCsv(
        `nexus-privileges-users-${date}.csv`,
        ['Privilege', 'Type', 'Repository', 'Actions', 'Effective Roles', 'Users'],
        filteredPermissionPrivileges.map((privilege) => [
          privilege.id,
          privilege.type,
          privilege.repository,
          (privilege.actions || []).join('; '),
          (privilege.effectiveRoles || []).join('; '),
          (privilege.users || []).join('; '),
        ]),
      );
      return;
    }
    if (permissionView === 'users') {
      exportCsv(
        `nexus-users-permissions-${date}.csv`,
        ['User ID', 'Name', 'Email', 'Source', 'Status', 'Direct Roles', 'Effective Roles', 'Effective Privileges', 'Admin'],
        filteredPermissionUsers.map((user) => [
          user.userId,
          user.displayName,
          user.email,
          user.source,
          user.status,
          (user.directRoles || []).join('; '),
          (user.effectiveRoles || []).join('; '),
          (user.effectivePrivileges || []).join('; '),
          user.isAdmin ? 'yes' : 'no',
        ]),
      );
      return;
    }
    exportCsv(
      `nexus-roles-users-${date}.csv`,
      ['Role ID', 'Role Name', 'Direct Users', 'Effective Users', 'Inherited Roles', 'Effective Privileges', 'Admin Role'],
      filteredPermissionRoles.map((role) => [
        role.id,
        role.name,
        (role.directUsers || []).join('; '),
        (role.effectiveUsers || []).join('; '),
        (role.inheritedRoles || []).join('; '),
        (role.effectivePrivileges || []).join('; '),
        role.isAdminRole ? 'yes' : 'no',
      ]),
    );
  };

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
          <h2 className="text-4xl font-extrabold tracking-tight text-primary dark:text-dark-text">LDAP & Access</h2>
          <p className="text-on-surface-variant dark:text-dark-text-muted mt-1 max-w-xl">
            Inspect your Nexus user profile, roles, repository access, and team members.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary dark:bg-dark-accent text-white dark:text-dark-bg text-sm font-bold hover:bg-black dark:hover:opacity-90 transition-colors disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
            {loading ? 'progress_activity' : 'refresh'}
          </span>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}
      {copyError && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {copyError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 dark:border-dark-border pb-0">
        {TABS.filter(t => !t.adminOnly || (t.auditOnly ? data?.permissionAudit : data?.canReadUsers)).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent dark:border-dark-accent text-accent dark:text-dark-accent bg-accent-dim/30 dark:bg-dark-accent-dim'
                : 'border-transparent text-on-surface-variant dark:text-dark-text-muted hover:text-primary dark:hover:text-dark-text hover:bg-slate-50 dark:hover:bg-dark-surface-2'
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
              {repositoryAccessAudit && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard icon="inventory_2" label="Repos With Users" value={repositoryAccessAudit.stats?.repositoriesWithUsers || 0} sub={`of ${repositoryAccessAudit.stats?.repositories || 0}`} />
                  <StatCard icon="public" label="Wildcard Repos" value={repositoryAccessAudit.stats?.wildcardRepositories || 0} />
                  <StatCard icon="edit_square" label="Write Users" value={repositoryAccessAudit.stats?.writeCapableUsers || 0} />
                  <StatCard icon="delete" label="Delete Users" value={repositoryAccessAudit.stats?.deleteCapableUsers || 0} />
                  <StatCard icon="person_off" label="Inactive With Access" value={repositoryAccessAudit.stats?.inactiveUsersWithAccess || 0} />
                </div>
              )}

              {/* Profile card */}
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm dark:shadow-black/20 p-6 flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-accent-dim dark:bg-dark-accent-dim flex items-center justify-center text-accent dark:text-dark-accent text-2xl font-extrabold shrink-0">
                  {(data.user.firstName?.[0] || data.user.userId?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-extrabold text-primary dark:text-dark-text">
                      {data.user.firstName} {data.user.lastName}
                    </h3>
                    <Badge
                      label={data.user.status || 'active'}
                      color={data.user.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}
                    />
                    {data.isAdmin && <Badge label="Administrator" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                  </div>
                  <p className="text-sm text-on-surface-variant dark:text-dark-text-muted mt-1">{data.user.userId}</p>
                  {data.user.email && (
                    <p className="text-sm text-on-surface-variant dark:text-dark-text-muted mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      {data.user.email}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {data.user.roles?.map(r => (
                      <Badge key={r} label={r} color="bg-accent-dim/60 text-primary dark:bg-dark-accent-dim dark:text-dark-accent" />
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
                <h4 className="text-sm font-bold text-on-surface-variant dark:text-dark-text-muted uppercase tracking-wider mb-3">Quick Access — Your Repositories</h4>
                {data.accessibleRepos.length === 0
                  ? <EmptyState icon="inventory_2" title="No accessible repositories" sub="Your roles may not grant repository-level access." />
                  : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.accessibleRepos.slice(0, 6).map(repo => (
                        <div key={repo.name} className="bg-white dark:bg-dark-surface rounded-xl border border-slate-100 dark:border-dark-border p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-primary dark:text-dark-text truncate">{repo.name}</span>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{repo.format}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-300 dark:text-dark-text-faint text-[15px]">{TYPE_ICONS[repo.type] || 'storage'}</span>
                            <span className="text-xs text-on-surface-variant dark:text-dark-text-muted capitalize">{repo.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                {data.accessibleRepos.length > 6 && (
                  <button onClick={() => setTab('repos')} className="mt-3 text-sm text-accent dark:text-dark-accent font-semibold hover:underline">
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
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
                  <input
                    value={repoSearch}
                    onChange={e => setRepoSearch(sanitizeText(e.target.value, INPUT_LIMITS.search))}
                    maxLength={INPUT_LIMITS.search}
                    placeholder="Search repositories…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 bg-white dark:bg-dark-surface placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
                  />
                </div>
                <select
                  value={repoFilter}
                  onChange={e => setRepoFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white dark:bg-dark-surface"
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
                <div className="flex rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
                  {['all','hosted','proxy','group'].map(t => (
                    <button
                      key={t}
                      onClick={() => setRepoFilter(f => f === t ? 'all' : t)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        repoFilter === t
                          ? 'bg-primary dark:bg-dark-accent text-white dark:text-dark-bg'
                          : 'bg-white dark:bg-dark-surface text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repo table */}
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-dark-border">
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Repository</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Format</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">URL</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Access</th>
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
                          <tr key={repo.name} className={`border-b border-slate-50 dark:border-dark-border hover:bg-slate-50/60 dark:hover:bg-dark-surface-2/70 transition-colors ${
                            i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'
                          }`}>
                            <td className="px-5 py-3 font-semibold text-primary dark:text-dark-text">{repo.name}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {repo.format}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-1 text-on-surface-variant dark:text-dark-text-muted">
                                <span className="material-symbols-outlined text-[15px]">{TYPE_ICONS[repo.type] || 'storage'}</span>
                                <span className="capitalize">{repo.type}</span>
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {repo.url ? (
                                <div className="flex items-center gap-1.5 max-w-[260px]">
                                  <span className="text-xs text-on-surface-variant dark:text-dark-text-muted truncate font-mono">{repo.url}</span>
                                  <button
                                    onClick={() => copyToClipboard(repo.url, urlKey)}
                                    className="shrink-0 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-dark-surface-2 text-slate-400 dark:text-dark-text-faint hover:text-accent dark:hover:text-dark-accent transition-colors"
                                    title="Copy URL"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">{copied === urlKey ? 'check' : 'content_copy'}</span>
                                  </button>
                                </div>
                              ) : <span className="text-slate-300 dark:text-dark-text-faint text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              {hasAccess
                                ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold"><span className="material-symbols-outlined text-[14px]">check_circle</span>Accessible</span>
                                : <span className="flex items-center gap-1 text-slate-400 dark:text-dark-text-faint text-xs font-bold"><span className="material-symbols-outlined text-[14px]">block</span>No access</span>
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
                  <div key={role.id} className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border shadow-sm dark:shadow-black/20 p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-extrabold text-primary dark:text-dark-text text-base">{role.name || role.id}</h4>
                        {role.description && <p className="text-sm text-on-surface-variant dark:text-dark-text-muted mt-0.5">{role.description}</p>}
                        <Badge label={role.id} color="bg-accent-dim/50 text-primary dark:bg-dark-accent-dim dark:text-dark-accent" />
                      </div>
                      <span className="shrink-0 text-xs font-bold text-slate-400 dark:text-dark-text-faint bg-slate-100 dark:bg-dark-surface-2 px-3 py-1.5 rounded-full">
                        {(role.privileges || []).length} privileges
                      </span>
                    </div>
                    {(role.privileges || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {role.privileges.map(p => (
                          <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-dark-surface-2 border border-slate-100 dark:border-dark-border text-[11px] font-mono text-on-surface-variant dark:text-dark-text-muted">
                            <span className="material-symbols-outlined text-[11px] text-accent dark:text-dark-accent">key</span>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {(role.roles || []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted mb-1.5">Inherits from:</p>
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
              <p className="text-sm text-on-surface-variant dark:text-dark-text-muted">Cross-reference of your roles against every repository in Nexus.</p>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
                <input
                  value={matrixSearch}
                  onChange={e => setMatrixSearch(sanitizeText(e.target.value, INPUT_LIMITS.search))}
                  maxLength={INPUT_LIMITS.search}
                  placeholder="Filter repositories in matrix…"
                  className="w-full max-w-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white dark:bg-dark-surface placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
                />
              </div>
              {data.roleMatrix.length === 0
                ? <EmptyState icon="grid_view" title="No matrix data" sub="No roles are assigned to your user." />
                : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-dark-border bg-white dark:bg-dark-surface">
                    <table className="text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-dark-border">
                          <th className="sticky left-0 bg-white dark:bg-dark-surface px-4 py-3 text-left font-bold text-on-surface-variant dark:text-dark-text-muted uppercase tracking-wider border-r border-slate-100 dark:border-dark-border z-10 min-w-[160px]">
                            Role \ Repo
                          </th>
                          {data.repositories
                            .filter(r => r.name.toLowerCase().includes(matrixSearch.toLowerCase()))
                            .map(r => (
                              <th key={r.name} className="px-3 py-3 font-semibold text-on-surface-variant dark:text-dark-text-muted max-w-[100px]">
                                <span className="block truncate max-w-[90px]" title={r.name}>{r.name}</span>
                              </th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {data.roleMatrix.map((row, i) => (
                          <tr key={row.roleId} className={`border-b border-slate-50 dark:border-dark-border ${i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-dark-surface-2/40'}`}>
                            <td className="sticky left-0 bg-inherit px-4 py-2.5 font-bold text-primary dark:text-dark-text border-r border-slate-100 dark:border-dark-border z-10">
                              {row.roleName}
                            </td>
                            {data.repositories
                              .filter(r => r.name.toLowerCase().includes(matrixSearch.toLowerCase()))
                              .map(repo => {
                                const cell = row.repos.find(r => r.repoName === repo.name);
                                return (
                                  <td key={repo.name} className="px-3 py-2.5 text-center">
                                    {cell?.hasAccess
                                      ? <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-[16px]">check_circle</span>
                                      : <span className="material-symbols-outlined text-slate-200 dark:text-dark-border text-[16px]">radio_button_unchecked</span>
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

          {/* ADMIN PERMISSIONS TAB */}
          {tab === 'permissions' && permissionAudit && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="inventory_2" label="Repos With Users" value={repositoryAccessAudit?.stats?.repositoriesWithUsers || 0} sub={`of ${repositoryAccessAudit?.stats?.repositories || 0} repositories`} />
                <StatCard icon="edit_square" label="Write-Capable Users" value={repositoryAccessAudit?.stats?.writeCapableUsers || 0} />
                <StatCard icon="delete" label="Delete-Capable Users" value={repositoryAccessAudit?.stats?.deleteCapableUsers || 0} />
                <StatCard icon="person_off" label="Inactive With Access" value={repositoryAccessAudit?.stats?.inactiveUsersWithAccess || 0} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="group" label="Mapped Users" value={permissionAudit.stats?.users || 0} sub={`${permissionAudit.stats?.adminUsers || 0} admin`} />
                <StatCard icon="badge" label="Roles" value={permissionAudit.stats?.roles || 0} />
                <StatCard icon="key" label="Privileges" value={permissionAudit.stats?.privileges || 0} />
                <StatCard icon="verified_user" label="Mapping" value={permissionAudit.complete ? 'Full' : 'Partial'} />
              </div>

              {dedupeStrings([...(permissionAudit.warnings || []), ...(repositoryAccessAudit?.warnings || [])]).length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 font-medium flex flex-col gap-1">
                  {dedupeStrings([...(permissionAudit.warnings || []), ...(repositoryAccessAudit?.warnings || [])]).map((warning) => (
                    <div key={warning} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[17px] mt-0.5">warning</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex rounded-xl border border-slate-200 dark:border-dark-border overflow-hidden">
                  {[
                    ['repositories', 'By Repository', 'inventory_2'],
                    ['roles', 'By Role', 'badge'],
                    ['privileges', 'By Privilege', 'key'],
                    ['users', 'By User', 'person'],
                  ].map(([id, label, icon]) => (
                    <button
                      key={id}
                      onClick={() => setPermissionView(id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors ${
                        permissionView === id
                          ? 'bg-primary dark:bg-dark-accent text-white dark:text-dark-bg'
                          : 'bg-white dark:bg-dark-surface text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[260px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
                  <input
                    value={permissionSearch}
                    onChange={e => setPermissionSearch(sanitizeText(e.target.value, INPUT_LIMITS.search))}
                    maxLength={INPUT_LIMITS.search}
                    placeholder="Search users, roles, privileges, repositories…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white dark:bg-dark-surface placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
                  />
                </div>
                {permissionView === 'repositories' && (
                  <select
                    value={permissionRiskFilter}
                    onChange={e => setPermissionRiskFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text bg-white dark:bg-dark-surface"
                  >
                    <option value="all">All repository access</option>
                    <option value="wildcard">Wildcard/global</option>
                    <option value="write">Write-capable</option>
                    <option value="delete">Delete-capable</option>
                    <option value="inactive">Inactive users</option>
                  </select>
                )}
                {permissionView === 'privileges' && (
                  <select
                    value={permissionTypeFilter}
                    onChange={e => setPermissionTypeFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text bg-white dark:bg-dark-surface"
                  >
                    <option value="all">All privilege types</option>
                    {permissionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                )}
                {permissionView === 'users' && (
                  <>
                    <select
                      value={permissionSourceFilter}
                      onChange={e => setPermissionSourceFilter(e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text bg-white dark:bg-dark-surface"
                    >
                      <option value="all">All sources</option>
                      {permissionSources.map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                    <select
                      value={permissionStatusFilter}
                      onChange={e => setPermissionStatusFilter(e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text bg-white dark:bg-dark-surface"
                    >
                      <option value="all">All statuses</option>
                      {permissionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </>
                )}
                <select
                  value={permissionAdminFilter}
                  onChange={e => setPermissionAdminFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text bg-white dark:bg-dark-surface"
                >
                  <option value="all">All access levels</option>
                  <option value="admin">{permissionView === 'privileges' || permissionView === 'repositories' ? 'Wildcard/global only' : 'Admin/global only'}</option>
                  <option value="standard">Standard only</option>
                </select>
                <button
                  onClick={exportPermissions}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-bold text-on-surface-variant dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export CSV
                </button>
              </div>

              {permissionView === 'repositories' && (
                <div className="grid grid-cols-1 gap-4">
                  {filteredPermissionRepositories.map((repo) => (
                    <article key={repo.name} className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border p-5 flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-primary dark:text-dark-text">{repo.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${FORMAT_COLORS[repo.format] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{repo.format || 'unknown'}</span>
                            <Badge label={repo.type || 'repository'} />
                            {repo.risk?.wildcard && <Badge label="Wildcard / Global" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                          </div>
                          {repo.url && <p className="mt-1 max-w-2xl truncate text-xs font-mono text-slate-400 dark:text-dark-text-faint">{repo.url}</p>}
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-right">
                          <div>
                            <p className="text-xl font-extrabold text-primary dark:text-dark-text leading-none">{(repo.users || []).length}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">users</p>
                          </div>
                          <div>
                            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-300 leading-none">{repo.risk?.writeCapableUsers || 0}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">write</p>
                          </div>
                          <div>
                            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-300 leading-none">{repo.risk?.deleteCapableUsers || 0}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">delete</p>
                          </div>
                          <div>
                            <p className="text-xl font-extrabold text-slate-500 dark:text-dark-text-muted leading-none">{repo.risk?.inactiveUsers || 0}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">inactive</p>
                          </div>
                        </div>
                      </div>

                      {(repo.actions || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint mb-1.5">Effective Actions</p>
                          <ActionPills actions={repo.actions} />
                        </div>
                      )}

                      {(repo.users || []).length === 0 ? (
                        <EmptyState icon="lock" title="No mapped users" sub="No user-to-repository access path was found in the available Nexus role data." />
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-dark-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-dark-border">
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">User</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Actions</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Roles</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Why</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(repo.users || []).map((user, i) => (
                                <tr key={user.userId} className={`border-b border-slate-50 dark:border-dark-border align-top ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'}`}>
                                  <td className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                      <div className="w-9 h-9 rounded-full bg-accent-dim/60 dark:bg-dark-accent-dim flex items-center justify-center text-xs font-extrabold text-primary dark:text-dark-accent shrink-0">
                                        {(user.displayName?.[0] || user.userId?.[0] || '?').toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-bold text-primary dark:text-dark-text">{user.displayName || user.userId}</p>
                                          {user.isAdmin && <Badge label="Admin" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                                          {String(user.status || '').toLowerCase() !== 'active' && <Badge label={user.status || 'inactive'} color="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" />}
                                        </div>
                                        <p className="text-xs text-on-surface-variant dark:text-dark-text-muted">{user.userId}</p>
                                        {user.email && <p className="text-xs text-slate-400 dark:text-dark-text-faint truncate">{user.email}</p>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3"><ActionPills actions={user.actions || []} limit={6} /></td>
                                  <td className="px-4 py-3"><RolePills roleIds={user.roleIds || []} limit={6} /></td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1.5">
                                      {(user.accessPaths || []).slice(0, 4).map((pathEntry, index) => (
                                        <div key={`${user.userId}-${pathEntry.privilegeId}-${index}`} className="rounded-lg bg-slate-50 dark:bg-dark-surface-2 px-2.5 py-1.5 text-[11px] text-on-surface-variant dark:text-dark-text-muted">
                                          <span className="font-bold text-primary dark:text-dark-text">{pathEntry.directRole}</span>
                                          {(pathEntry.inheritedRoles || []).map((roleId) => (
                                            <React.Fragment key={roleId}> <span className="text-slate-300 dark:text-dark-text-faint">via</span> <span className="font-bold">{roleId}</span></React.Fragment>
                                          ))}
                                          <span className="text-slate-300 dark:text-dark-text-faint"> grants </span>
                                          <span className="font-mono">{pathEntry.privilegeId}</span>
                                          {pathEntry.wildcard && <span className="ml-1 text-amber-600 dark:text-amber-300">wildcard</span>}
                                        </div>
                                      ))}
                                      {(user.accessPaths || []).length > 4 && (
                                        <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{user.accessPaths.length - 4} more paths</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  ))}
                  {filteredPermissionRepositories.length === 0 && <EmptyState icon="inventory_2" title="No repositories match" sub="Try a different access search or risk filter." />}
                </div>
              )}

              {permissionView === 'roles' && (
                <div className="grid grid-cols-1 gap-3">
                  {filteredPermissionRoles.map((role) => (
                    <article key={role.id} className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-primary dark:text-dark-text">{role.name || role.id}</h4>
                            {role.isAdminRole && <Badge label="Admin / Global" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                          </div>
                          <p className="text-xs font-mono text-slate-400 dark:text-dark-text-faint mt-0.5">{role.id}</p>
                          {role.description && <p className="text-sm text-on-surface-variant dark:text-dark-text-muted mt-1">{role.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-extrabold text-primary dark:text-dark-text leading-none">{(role.effectiveUsers || []).length}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint">effective users</p>
                        </div>
                      </div>
                      {(role.inheritedRoles || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint mb-1.5">Inherits Roles</p>
                          <RolePills roleIds={role.inheritedRoles} />
                        </div>
                      )}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint mb-1.5">Direct Users</p>
                          <UserPills userIds={role.directUsers || []} userMap={permissionUserMap} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint mb-1.5">Effective Users</p>
                          <UserPills userIds={role.effectiveUsers || []} userMap={permissionUserMap} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-dark-text-faint mb-1.5">Effective Privileges</p>
                        <PrivilegePills privilegeIds={role.effectivePrivileges || []} limit={16} />
                      </div>
                    </article>
                  ))}
                  {filteredPermissionRoles.length === 0 && <EmptyState icon="badge" title="No roles match" sub="Try a different permission search." />}
                </div>
              )}

              {permissionView === 'privileges' && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-dark-border">
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Privilege</th>
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Scope</th>
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Roles</th>
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPermissionPrivileges.map((privilege, i) => (
                        <tr key={privilege.id} className={`border-b border-slate-50 dark:border-dark-border align-top ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-primary dark:text-dark-text">{privilege.id}</span>
                              {privilege.isWildcard && <Badge label="Wildcard" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                            </div>
                            {privilege.description && <p className="text-xs text-on-surface-variant dark:text-dark-text-muted mt-1">{privilege.description}</p>}
                          </td>
                          <td className="px-5 py-3 text-xs text-on-surface-variant dark:text-dark-text-muted">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold capitalize">{privilege.type || 'application'}</span>
                              {privilege.repository && <span className="font-mono">{privilege.format}/{privilege.repository}</span>}
                              {(privilege.actions || []).length > 0 && <span>{privilege.actions.join(', ')}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3"><RolePills roleIds={privilege.effectiveRoles || []} limit={6} /></td>
                          <td className="px-5 py-3"><UserPills userIds={privilege.users || []} userMap={permissionUserMap} limit={8} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPermissionPrivileges.length === 0 && <EmptyState icon="key_off" title="No privileges match" sub="Try a different permission search." />}
                </div>
              )}

              {permissionView === 'users' && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-dark-border">
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">User</th>
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Effective Roles</th>
                        <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Effective Privileges</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPermissionUsers.map((user, i) => (
                        <tr key={user.userId} className={`border-b border-slate-50 dark:border-dark-border align-top ${i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-accent-dim/60 dark:bg-dark-accent-dim flex items-center justify-center text-xs font-extrabold text-primary dark:text-dark-accent shrink-0">
                                {(user.displayName?.[0] || user.userId?.[0] || '?').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-primary dark:text-dark-text truncate">{user.displayName || user.userId}</p>
                                  {user.isAdmin && <Badge label="Admin" color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
                                </div>
                                <p className="text-xs text-on-surface-variant dark:text-dark-text-muted">{user.userId}</p>
                                {user.email && <p className="text-xs text-slate-400 dark:text-dark-text-faint truncate">{user.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <RolePills roleIds={user.effectiveRoles || []} limit={10} />
                          </td>
                          <td className="px-5 py-3">
                            <PrivilegePills privilegeIds={user.effectivePrivileges || []} limit={12} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPermissionUsers.length === 0 && <EmptyState icon="person_search" title="No users match" sub="Try a different permission search." />}
                </div>
              )}
            </div>
          )}

          {/* ALL USERS TAB */}
          {tab === 'users' && data.canReadUsers && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-text-faint text-[18px]">search</span>
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(sanitizeText(e.target.value, INPUT_LIMITS.search))}
                  maxLength={INPUT_LIMITS.search}
                  placeholder="Search users by name, ID, or email…"
                  className="w-full max-w-sm pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border text-sm font-medium text-primary dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white dark:bg-dark-surface placeholder:text-slate-300 dark:placeholder:text-dark-text-faint"
                />
              </div>
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-dark-border">
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">User</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Source</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-dark-text-muted">Roles</th>
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
                        <tr key={u.userId} className={`border-b border-slate-50 dark:border-dark-border hover:bg-slate-50/60 dark:hover:bg-dark-surface-2/70 transition-colors ${
                          u.userId === settings.username ? 'bg-accent-dim/20 dark:bg-dark-accent-dim/50' : i % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-dark-surface-2/30'
                        }`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent-dim/60 dark:bg-dark-accent-dim flex items-center justify-center text-xs font-extrabold text-primary dark:text-dark-accent shrink-0">
                                {(u.firstName?.[0] || u.userId?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-primary dark:text-dark-text">{u.firstName} {u.lastName}</p>
                                <p className="text-xs text-on-surface-variant dark:text-dark-text-muted">{u.userId}</p>
                              </div>
                              {u.userId === settings.username && (
                                <Badge label="You" color="bg-accent-dim/60 text-accent dark:bg-dark-accent-dim dark:text-dark-accent" />
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-on-surface-variant dark:text-dark-text-muted text-xs">{u.email || '—'}</td>
                          <td className="px-5 py-3 text-xs capitalize text-on-surface-variant dark:text-dark-text-muted">{u.source || 'default'}</td>
                          <td className="px-5 py-3">
                            <Badge
                              label={u.status || 'active'}
                              color={u.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(u.roles || []).slice(0, 3).map(r => (
                                <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{r}</span>
                              ))}
                              {(u.roles || []).length > 3 && (
                                <span className="text-[10px] text-slate-400 dark:text-dark-text-faint">+{u.roles.length - 3}</span>
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
