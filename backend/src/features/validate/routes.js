const express = require('express');
const router = express.Router();
const { describeFetchError } = require('../../shared/http/describeFetchError');

// How long to wait for Nexus before giving up (ms).
// Nexus containers can be slow on first hit; 10 s is generous but won't hang forever.
const TIMEOUT_MS = 10_000;

/**
 * POST /api/validate
 * Body: { nexusUrl, username, password }
 *
 * Strategy:
 *  1. Try GET /service/rest/v1/status  — public, no-auth, always accessible.
 *     A 200 here means Nexus is UP.
 *  2. If credentials were supplied, ALSO try GET /service/rest/v1/repositories
 *     to verify auth works. A 401/403 means Nexus is up but creds are wrong/limited.
 *
 * This two-step approach avoids false "down" reports caused by:
 *  - Privilege restrictions on /repositories for read-only users
 *  - Nexus redirecting /repositories when anonymous access is off
 *  - No timeout causing the socket to hang until Node's default (~2 min)
 */
router.post('/', async (req, res) => {
  const { nexusUrl, username, password } = req.body || {};

  if (!nexusUrl) {
    return res.status(400).json({ ok: false, message: 'Nexus URL is required' });
  }

  const base = nexusUrl.replace(/\/$/, '');

  // ── Step 1: public health check ─────────────────────────────────────────────
  // /service/rest/v1/status returns 200 { edition, version, ... } with NO auth.
  // It is available on every Nexus 3 instance from v3.15+.
  try {
    const statusRes = await fetch(`${base}/service/rest/v1/status`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!statusRes.ok) {
      // Nexus responded but with an error — still reachable, just misconfigured.
      // Don't stop here; fall through to credential check which will give a
      // better error message if auth is configured.
      if (!username) {
        return res.json({
          ok: false,
          message: `Nexus responded with HTTP ${statusRes.status} — check the URL`,
        });
      }
    }
  } catch (err) {
    // AbortError = timeout; TypeError = DNS / connection refused.
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    console.error('[validate] Nexus reachability check failed:', describeFetchError(err));
    return res.json({
      ok: false,
      message: isTimeout
        ? `Nexus did not respond within ${TIMEOUT_MS / 1000} s — is the URL correct and the container running?`
        : `Cannot reach Nexus — ${describeFetchError(err)}`,
    });
  }

  // ── Step 2: credential check (only when username supplied) ──────────────────
  if (!username) {
    // No creds — status check passed, that's good enough.
    return res.json({ ok: true, message: 'Nexus is reachable (no credentials supplied)' });
  }

  const token = Buffer.from(`${username}:${password || ''}`).toString('base64');

  try {
    const authRes = await fetch(`${base}/service/rest/v1/repositories`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${token}`,
      },
    });

    if (authRes.ok) {
      let repoCount = '';
      try {
        const repos = await authRes.json();
        if (Array.isArray(repos) && repos.length > 0) {
          repoCount = ` — ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'} accessible`;
        }
      } catch (_) { /* ignore parse error, success is still success */ }
      return res.json({ ok: true, message: `Connection successful${repoCount}` });
    }

    if (authRes.status === 401) {
      return res.json({ ok: false, message: 'Nexus is up, but the username or password is incorrect' });
    }
    if (authRes.status === 403) {
      // Nexus IS up and auth succeeded — the user just lacks the nx-repository-view privilege.
      // Treat as OK so uploads can still work.
      return res.json({ ok: true, message: 'Connected — this user has limited privileges (no repository list access), but uploads may still work' });
    }
    if (authRes.status === 404) {
      return res.json({ ok: false, message: 'Nexus is up, but the REST API path was not found — is the Nexus URL correct?' });
    }

    return res.json({ ok: false, message: `Nexus is up, but returned HTTP ${authRes.status} for the credential check` });
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    console.error('[validate] Nexus credential check failed:', describeFetchError(err));
    return res.json({
      ok: false,
      message: isTimeout
        ? `Nexus credential check timed out after ${TIMEOUT_MS / 1000} s`
        : `Credential check failed — ${describeFetchError(err)}`,
    });
  }
});

module.exports = router;
