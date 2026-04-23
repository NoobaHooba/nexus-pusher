const express = require('express');
const router = express.Router();
const { fetchRepositories, makeHeaders, normalizeBaseUrl, searchAssets } = require('../lib/nexusClient');

/**
 * POST /api/browse/repos
 * Returns all repositories
 */
router.post('/repos', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};
  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });
  try {
    const repos = await fetchRepositories({ nexusUrl, username, password });
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

  const params = new URLSearchParams();
  if (keyword)           params.set('q',                   keyword);
  if (repository)        params.set('repository',          repository);
  if (format)            params.set('format',              format);
  if (continuationToken) params.set('continuationToken',   continuationToken);
  // Page size — keep it reasonable for the UI
  params.set('pageSize', '50');

  try {
    const data = await searchAssets({
      nexusUrl,
      username,
      password,
      query: Object.fromEntries(params.entries()),
    });
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
  const base = normalizeBaseUrl(nexusUrl);
  const headers = makeHeaders(username, password);
  try {
    const resFetch = await fetch(`${base}/service/rest/v1/assets/${id}`, { headers });
    if (!resFetch.ok) throw Object.assign(new Error(`HTTP ${resFetch.status}`), { status: resFetch.status });
    const data = await resFetch.json();
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
