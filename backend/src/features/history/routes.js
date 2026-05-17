const express = require('express');
const { query, clearHistory } = require('../../shared/persistence/db');
const { getRequestUserContext, hasUserContext } = require('../../shared/auth/userContext');

const router = express.Router();

/**
 * GET /api/history
 * Query params: nexusUrl, username, repo, type, status, search, limit, offset
 *
 * Returns:
 *   { rows: Upload[], total: number }
 */
router.get('/', (req, res) => {
  try {
    const userContext = getRequestUserContext(req);
    if (!hasUserContext(userContext)) {
      return res.status(400).json({ error: 'History requests require a signed-in Nexus user and Nexus URL.' });
    }
    const result = query({
      ...(req.query || {}),
      userId: userContext.userId,
    });
    res.json(result);
  } catch (err) {
    console.error('[history] query error:', err);
    res.status(500).json({ error: 'Failed to query history' });
  }
});

/**
 * DELETE /api/history
 * Body: { nexusUrl, username }
 */
router.delete('/', (req, res) => {
  try {
    const userContext = getRequestUserContext(req);
    if (!hasUserContext(userContext)) {
      return res.status(400).json({ error: 'History deletion requires a signed-in Nexus user and Nexus URL.' });
    }
    const deleted = clearHistory(userContext.userId);
    res.json({ deleted });
  } catch (err) {
    console.error('[history] clear error:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
