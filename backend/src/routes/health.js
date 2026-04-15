/**
 * GET /api/health
 * Returns backend status plus an optional Nexus reachability check.
 *
 * Query params:
 *   nexusUrl  — if supplied, the backend also pings Nexus /service/rest/v1/status
 *               and returns { nexus: true/false, nexusMs: <latency> }
 *
 * This keeps the Nexus check server-side so Docker-internal hostnames
 * (e.g. http://nexus:8081) are reachable even though the browser can't see them.
 */
const express = require('express');
const router  = express.Router();

const TIMEOUT_MS = 6_000;

router.get('/', async (req, res) => {
  const { nexusUrl } = req.query;

  const response = { status: 'ok', nexus: null, nexusMs: null };

  if (nexusUrl) {
    const t0 = Date.now();
    try {
      const r = await fetch(
        `${nexusUrl.replace(/\/$/, '')}/service/rest/v1/status`,
        {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        }
      );
      response.nexus   = r.ok || r.status === 401 || r.status === 403; // any HTTP reply = up
      response.nexusMs = Date.now() - t0;
    } catch (_) {
      response.nexus   = false;
      response.nexusMs = Date.now() - t0;
    }
  }

  res.json(response);
});

module.exports = router;
