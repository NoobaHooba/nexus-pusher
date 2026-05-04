const express = require('express');
const router = express.Router();

function makeHeaders(username, password) {
  const headers = { 'Content-Type': 'application/json' };
  if (username) {
    const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }
  return headers;
}

async function nexusFetch(base, path, headers) {
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function displayName(user = {}) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.userId || '';
}

function dedupeSorted(values) {
  return [...new Set(normalizeList(values).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function idList(values) {
  return dedupeSorted(normalizeList(values).map((value) => (
    typeof value === 'string' ? value : value?.id || value?.name || ''
  )));
}

function roleIdsForUser(user = {}) {
  return idList(user.roles || []);
}

function isWildcardPrivilege(privilegeId) {
  const value = String(privilegeId || '').toLowerCase();
  return value === 'nx-all' || value === 'nexus:*' || value.includes('*');
}

function parseRepositoryPrivilege(privilegeId) {
  const match = String(privilegeId || '').match(/^nx-repository-(view|admin)-([^-]+)-(.+)-([^-]+)$/);
  if (!match) return null;
  return {
    scope: match[1],
    format: match[2],
    repository: match[3],
    action: match[4],
  };
}

function normalizePrivilege(rawPrivilege, privilegeId) {
  const id = rawPrivilege?.id || rawPrivilege?.name || privilegeId;
  const repositoryAccess = parseRepositoryPrivilege(id);
  const actions = normalizeList(rawPrivilege?.actions || rawPrivilege?.properties?.actions);
  return {
    id,
    name: rawPrivilege?.name || id,
    description: rawPrivilege?.description || '',
    type: rawPrivilege?.type || (repositoryAccess ? 'repository' : isWildcardPrivilege(id) ? 'wildcard' : 'application'),
    permission: rawPrivilege?.permission || id,
    actions: actions.length > 0 ? actions : repositoryAccess?.action ? [repositoryAccess.action] : [],
    format: rawPrivilege?.format || rawPrivilege?.properties?.format || repositoryAccess?.format || '',
    repository: rawPrivilege?.repository || rawPrivilege?.properties?.repository || repositoryAccess?.repository || '',
    isWildcard: isWildcardPrivilege(id),
  };
}

function buildPermissionAudit({ users, roles, privileges }) {
  const warnings = [];
  const normalizedUsers = normalizeList(users);
  const normalizedRoles = normalizeList(roles);
  const normalizedPrivileges = normalizeList(privileges);
  const roleMap = new Map(normalizedRoles.map((role) => [role.id, {
    id: role.id,
    name: role.name || role.id,
    description: role.description || '',
    directPrivileges: idList(role.privileges || []),
    inheritedRoles: idList(role.roles || []),
  }]));
  const rawPrivilegeMap = new Map(normalizedPrivileges.map((privilege) => [privilege.id || privilege.name, privilege]));
  const privilegeIds = new Set(normalizedPrivileges.map((privilege) => privilege.id || privilege.name).filter(Boolean));

  for (const role of roleMap.values()) {
    role.directPrivileges.forEach((privilegeId) => privilegeIds.add(privilegeId));
  }

  const effectiveRoleCache = new Map();
  const resolveEffectiveRoles = (roleId, stack = []) => {
    if (effectiveRoleCache.has(roleId)) return effectiveRoleCache.get(roleId);
    if (stack.includes(roleId)) {
      warnings.push(`Role inheritance cycle ignored: ${[...stack, roleId].join(' -> ')}`);
      return new Set();
    }

    const role = roleMap.get(roleId);
    const resolved = new Set([roleId]);
    if (!role) {
      warnings.push(`Missing inherited role reference: ${roleId}`);
      effectiveRoleCache.set(roleId, resolved);
      return resolved;
    }

    for (const inheritedRoleId of role.inheritedRoles) {
      for (const nestedRoleId of resolveEffectiveRoles(inheritedRoleId, [...stack, roleId])) {
        resolved.add(nestedRoleId);
      }
    }

    effectiveRoleCache.set(roleId, resolved);
    return resolved;
  };

  const effectivePrivilegesForRoles = (roleIds) => {
    const effectiveRoles = new Set();
    const effectivePrivileges = new Set();
    for (const roleId of roleIds) {
      for (const effectiveRoleId of resolveEffectiveRoles(roleId)) {
        effectiveRoles.add(effectiveRoleId);
        const role = roleMap.get(effectiveRoleId);
        if (role) role.directPrivileges.forEach((privilegeId) => effectivePrivileges.add(privilegeId));
      }
    }
    return {
      effectiveRoles: dedupeSorted([...effectiveRoles]),
      effectivePrivileges: dedupeSorted([...effectivePrivileges]),
    };
  };

  const usersById = normalizedUsers.map((user) => {
    const directRoles = roleIdsForUser(user);
    const resolved = effectivePrivilegesForRoles(directRoles);
    const isAdmin = resolved.effectiveRoles.includes('nx-admin')
      || resolved.effectivePrivileges.some((privilegeId) => isWildcardPrivilege(privilegeId));

    return {
      userId: user.userId || '',
      displayName: displayName(user),
      email: user.email || '',
      source: user.source || 'default',
      status: user.status || 'unknown',
      directRoles,
      effectiveRoles: resolved.effectiveRoles,
      effectivePrivileges: resolved.effectivePrivileges,
      isAdmin,
    };
  });

  const rolesById = [...roleMap.values()].map((role) => {
    const resolved = effectivePrivilegesForRoles([role.id]);
    const directUsers = usersById.filter((user) => user.directRoles.includes(role.id));
    const effectiveUsers = usersById.filter((user) => user.effectiveRoles.includes(role.id));
    const isAdminRole = role.id === 'nx-admin' || resolved.effectivePrivileges.some((privilegeId) => isWildcardPrivilege(privilegeId));

    return {
      ...role,
      effectivePrivileges: resolved.effectivePrivileges,
      directUsers: directUsers.map((user) => user.userId),
      effectiveUsers: effectiveUsers.map((user) => user.userId),
      isAdminRole,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const privilegesById = [...privilegeIds].map((privilegeId) => {
    const privilege = normalizePrivilege(rawPrivilegeMap.get(privilegeId), privilegeId);
    const directRoles = rolesById.filter((role) => role.directPrivileges.includes(privilege.id)).map((role) => role.id);
    const effectiveRoles = rolesById.filter((role) => role.effectivePrivileges.includes(privilege.id)).map((role) => role.id);
    const usersWithPrivilege = usersById.filter((user) => user.effectivePrivileges.includes(privilege.id));

    return {
      ...privilege,
      directRoles,
      effectiveRoles,
      users: usersWithPrivilege.map((user) => user.userId),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  return {
    generatedAt: new Date().toISOString(),
    complete: true,
    warnings: dedupeSorted(warnings),
    stats: {
      users: usersById.length,
      roles: rolesById.length,
      privileges: privilegesById.length,
      adminUsers: usersById.filter((user) => user.isAdmin).length,
    },
    users: usersById,
    roles: rolesById,
    privileges: privilegesById,
  };
}

/**
 * POST /api/ldap/info
 * Body: { nexusUrl, username, password }
 * Returns: { user, roles, repositories, roleMatrix, permissionAudit }
 */
router.post('/info', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};

  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });

  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);

  try {
    // Fetch in parallel: repos, users/roles/privileges (admin only)
    const [reposRaw, usersRaw, rolesRaw, privilegesRaw] = await Promise.allSettled([
      nexusFetch(base, '/service/rest/v1/repositories', headers),
      nexusFetch(base, '/service/rest/v1/security/users', headers),
      nexusFetch(base, '/service/rest/v1/security/roles', headers),
      nexusFetch(base, '/service/rest/v1/security/privileges', headers),
    ]);

    const repositories = reposRaw.status === 'fulfilled' ? reposRaw.value : [];
    const allUsers     = usersRaw.status === 'fulfilled' ? usersRaw.value : null;
    const allRoles     = rolesRaw.status === 'fulfilled' ? rolesRaw.value : null;
    const allPrivileges = privilegesRaw.status === 'fulfilled' ? privilegesRaw.value : null;

    const permissionAudit = allUsers && allRoles
      ? buildPermissionAudit({
          users: allUsers,
          roles: allRoles,
          privileges: allPrivileges || [],
        })
      : null;
    if (permissionAudit && allPrivileges === null) {
      permissionAudit.complete = false;
      permissionAudit.warnings = dedupeSorted([
        ...permissionAudit.warnings,
        'Privilege catalog endpoint unavailable; privilege details are inferred from role references.',
      ]);
    }
    if (permissionAudit && allUsers.length >= 100) {
      permissionAudit.warnings = dedupeSorted([
        ...permissionAudit.warnings,
        'Nexus may cap LDAP/external realm user listings at 100 users; mappings may be incomplete.',
      ]);
    }

    // Find current user's record in the users list
    const currentUser = allUsers?.find(u => u.userId === username) || null;
    const userRoles   = currentUser?.roles || [];

    // Build role → privileges map from allRoles
    const roleMap = {};
    if (allRoles) {
      for (const role of allRoles) {
        roleMap[role.id] = role;
      }
    }

    // Resolve privileges for this user's roles (one level deep)
    const resolvedRoles = userRoles.map(rid => roleMap[rid] || { id: rid, name: rid, description: '', privileges: [] });

    // Determine which repos the user can access by scanning privilege names
    // Nexus privilege naming: nx-repository-view-{format}-{repo}-{action}
    const accessibleRepoNames = new Set();
    for (const role of resolvedRoles) {
      for (const priv of (role.privileges || [])) {
        const m = priv.match(/^nx-repository-(?:view|admin)-[^-]+-(.+)-(?:read|browse|edit|add|delete|\*)$/);
        if (m && m[1] !== '*') accessibleRepoNames.add(m[1]);
      }
    }
    // If admin role or wildcard privilege, mark all repos accessible
    const isAdmin = userRoles.includes('nx-admin') || resolvedRoles.some(r =>
      (r.privileges || []).some(p => p.includes('*') || p === 'nx-all')
    );
    const accessibleRepos = isAdmin
      ? repositories
      : repositories.filter(r => accessibleRepoNames.has(r.name));

    // Build role-to-repo matrix (role × repo → true/false)
    const roleMatrix = resolvedRoles.map(role => ({
      roleId: role.id,
      roleName: role.name || role.id,
      repos: repositories.map(repo => ({
        repoName: repo.name,
        hasAccess: isAdmin || (role.privileges || []).some(p => p.includes(repo.name) || p.includes('*')),
      })),
    }));

    return res.json({
      user: currentUser || { userId: username, firstName: username, lastName: '', email: '', status: 'unknown', roles: userRoles },
      roles: resolvedRoles,
      repositories,
      accessibleRepos,
      allUsers: allUsers || [],
      roleMatrix,
      permissionAudit,
      isAdmin,
      canReadUsers:  allUsers  !== null,
      canReadRoles:  allRoles  !== null,
      canReadPrivileges: allPrivileges !== null,
    });
  } catch (err) {
    const status = err.status === 401 ? 401 : err.status === 403 ? 403 : 500;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/ldap/users
 * Body: { nexusUrl, username, password }
 * Returns full user list (admin-only endpoint)
 */
router.post('/users', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};
  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });
  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);
  try {
    const users = await nexusFetch(base, '/service/rest/v1/security/users', headers);
    return res.json(users);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports._private = {
  buildPermissionAudit,
  parseRepositoryPrivilege,
};
