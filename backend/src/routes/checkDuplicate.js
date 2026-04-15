/**
 * POST /api/check-duplicate
 * Body: { nexusUrl, username, password, repo, name, version? }
 *
 * Queries the Nexus search API and returns whether an artifact with the
 * given name (and optional version) already exists in the target repo.
 * Returns:
 *   { exists: boolean, components: Array<{ name, version, format, downloadUrl }> }
 *
 * Uses Node 18+ built-in global fetch — no node-fetch dependency needed.
 */
const express = require('express');
const router  = express.Router();

router.post('/', async (req, res) => {
  const { nexusUrl, username, password, repo, name, version } = req.body;

  if (!nexusUrl || !repo || !name) {
    return res.status(400).json({ error: 'nexusUrl, repo, and name are required' });
  }

  try {
    const basicAuth = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
    const params = new URLSearchParams({ repository: repo, name });
    if (version) params.set('version', version);

    // Nexus REST v1 search — returns up to 50 results for exact-name match
    const url = `${nexusUrl.replace(/\/$/, '')}/service/rest/v1/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
      },
      // 8-second timeout — search should be fast
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // 401/403 → treat as "cannot check" rather than crashing the upload
      return res.json({ exists: false, components: [], warning: `Search returned HTTP ${response.status}` });
    }

    const data = await response.json();
    const items = (data.items || []).map(c => ({
      name:        c.name,
      version:     c.version,
      format:      c.format,
      downloadUrl: c.assets?.[0]?.downloadUrl || null,
    }));

    return res.json({ exists: items.length > 0, components: items });
  } catch (err) {
    // Network error or timeout — let the upload proceed rather than blocking it
    return res.json({ exists: false, components: [], warning: err.message });
  }
});

module.exports = router;
