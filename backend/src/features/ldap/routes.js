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

/**
 * POST /api/ldap/info
 * Body: { nexusUrl, username, password }
 * Returns: { user, roles, repositories, roleMatrix }
 */
router.post('/info', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};

  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });

  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);

  try {
    // Fetch in parallel: repos, users (admin only), roles (admin only)
    const [reposRaw, usersRaw, rolesRaw] = await Promise.allSettled([
      nexusFetch(base, '/service/rest/v1/repositories', headers),
      nexusFetch(base, '/service/rest/v1/security/users', headers),
      nexusFetch(base, '/service/rest/v1/security/roles', headers),
    ]);

    const repositories = reposRaw.status === 'fulfilled' ? reposRaw.value : [];
    const allUsers     = usersRaw.status === 'fulfilled' ? usersRaw.value : null;
    const allRoles     = rolesRaw.status === 'fulfilled' ? rolesRaw.value : null;

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
      isAdmin,
      canReadUsers:  allUsers  !== null,
      canReadRoles:  allRoles  !== null,
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
