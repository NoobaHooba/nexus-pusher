const express = require('express');
const router = express.Router();

function makeHeaders(username, password) {
  const h = { 'Content-Type': 'application/json' };
  if (username) {
    const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
    h['Authorization'] = `Basic ${token}`;
  }
  return h;
}

async function nexusFetch(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

/**
 * POST /api/browse/repos
 * Returns all repositories
 */
router.post('/repos', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};
  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });
  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);
  try {
    const repos = await nexusFetch(`${base}/service/rest/v1/repositories`, headers);
    return res.json(repos);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/browse/search
 * Body: { nexusUrl, username, password, keyword, repository, format, continuationToken }
 * Uses Nexus Search Assets API: /service/rest/v1/search/assets
 */
router.post('/search', async (req, res) => {
  const { nexusUrl, username, password, keyword, repository, format, continuationToken } = req.body || {};
  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });
  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);

  const params = new URLSearchParams();
  if (keyword)           params.set('q',                   keyword);
  if (repository)        params.set('repository',          repository);
  if (format)            params.set('format',              format);
  if (continuationToken) params.set('continuationToken',   continuationToken);
  // Page size — keep it reasonable for the UI
  params.set('pageSize', '50');

  try {
    const url = `${base}/service/rest/v1/search/assets?${params.toString()}`;
    const data = await nexusFetch(url, headers);
    return res.json(data); // { items: [...], continuationToken }
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/browse/asset
 * Body: { nexusUrl, username, password, id }
 * Returns single asset detail
 */
router.post('/asset', async (req, res) => {
  const { nexusUrl, username, password, id } = req.body || {};
  if (!nexusUrl || !id) return res.status(400).json({ error: 'nexusUrl and id are required' });
  const base = nexusUrl.replace(/\/$/, '');
  const headers = makeHeaders(username, password);
  try {
    const data = await nexusFetch(`${base}/service/rest/v1/assets/${id}`, headers);
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
