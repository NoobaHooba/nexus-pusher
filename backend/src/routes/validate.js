const express = require('express');
const router = express.Router();

/**
 * POST /api/validate
 * Body: { nexusUrl, username, password }
 *
 * Makes a server-side fetch to Nexus /service/rest/v1/repositories with
 * the supplied credentials. Because this runs in Node.js there is no
 * browser Basic Auth cache that could override the Authorization header.
 */
router.post('/', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};

  if (!nexusUrl) {
    return res.status(400).json({ ok: false, message: 'nexusUrl is required' });
  }

  const base = nexusUrl.replace(/\/$/, '');
  const url = `${base}/service/rest/v1/repositories`;

  const headers = { 'Content-Type': 'application/json' };
  if (username) {
    const token = Buffer.from(`${username}:${password || ''}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.ok) {
      return res.json({ ok: true, message: 'Connection successful' });
    }
    if (response.status === 401) {
      return res.json({ ok: false, message: 'Authentication failed \u2014 username or password is incorrect' });
    }
    if (response.status === 403) {
      return res.json({ ok: false, message: 'Connected, but this user does not have permission to query Nexus' });
    }
    if (response.status === 404) {
      return res.json({ ok: false, message: 'Proxy reached, but Nexus REST API path was not found' });
    }
    return res.json({ ok: false, message: `Connection failed \u2014 HTTP ${response.status}` });
  } catch (err) {
    return res.json({
      ok: false,
      message: `Cannot reach Nexus \u2014 ${err.message}`,
    });
  }
});

module.exports = router;
