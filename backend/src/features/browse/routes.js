const express = require('express');
const router = express.Router();
const { fetchRepositories, makeHeaders, normalizeBaseUrl, searchAssets } = require('../../shared/nexus/client');
const { enrichAssetsWithUploader, findLatestUploadForAsset } = require('../../shared/persistence/db');

function buildSearchQuery(query = {}, continuationToken = '') {
  const params = {
    pageSize: '50',
  };
  const normalized = query && typeof query === 'object' ? query : {};
  const maven = normalized.maven && typeof normalized.maven === 'object' ? normalized.maven : {};
  const keywordTerms = [
    String(normalized.keyword || '').trim(),
    String(normalized.name || '').trim(),
    String(normalized.group || '').trim(),
    String(normalized.version || '').trim(),
    String(maven.groupId || '').trim(),
    String(maven.artifactId || '').trim(),
    String(maven.baseVersion || '').trim(),
    String(maven.classifier || '').trim(),
    String(maven.extension || '').trim(),
  ].filter(Boolean);

  const mappings = [
    ['repository', 'repository'],
    ['format', 'format'],
  ];

  if (keywordTerms.length > 0) {
    params.q = keywordTerms.join(' ');
  }

  mappings.forEach(([sourceKey, targetKey]) => {
    const value = String(normalized[sourceKey] || '').trim();
    if (value) params[targetKey] = value;
  });

  if (continuationToken) {
    params.continuationToken = continuationToken;
  }

  return params;
}

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
 * Body: { nexusUrl, username, password, continuationToken, query }
 * Uses Nexus Search Assets API for richer asset-level filtering.
 */
router.post('/search', async (req, res) => {
  const { nexusUrl, username, password, continuationToken, query } = req.body || {};
  if (!nexusUrl) return res.status(400).json({ error: 'nexusUrl is required' });

  try {
    const data = await searchAssets({
      nexusUrl,
      username,
      password,
      query: buildSearchQuery(query, continuationToken),
    });
    return res.json({
      continuationToken: data?.continuationToken || null,
      items: enrichAssetsWithUploader(Array.isArray(data?.items) ? data.items : []),
    });
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
    const uploadInfo = findLatestUploadForAsset({
      repo: data?.repository,
      path: data?.path,
      filename: data?.path?.split('/').pop() || data?.name,
    });
    return res.json(uploadInfo ? { ...data, ...uploadInfo } : data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
