const express = require('express');
const { query, clearHistory } = require('../../shared/persistence/db');

const router = express.Router();

/**
 * GET /api/history
 * Query params: username, repo, type, status, search, limit, offset
 *
 * Returns:
 *   { rows: Upload[], total: number }
 */
router.get('/', (req, res) => {
  try {
    const result = query(req.query || {});
    res.json(result);
  } catch (err) {
    console.error('[history] query error:', err);
    res.status(500).json({ error: 'Failed to query history' });
  }
});

/**
 * DELETE /api/history
 * Body: { username } — pass '*' to wipe everything (admin use)
 */
router.delete('/', (req, res) => {
  try {
    const { username } = req.body || {};
    const deleted = clearHistory(username);
    res.json({ deleted });
  } catch (err) {
    console.error('[history] clear error:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
