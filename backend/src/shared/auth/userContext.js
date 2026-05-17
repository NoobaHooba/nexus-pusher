const crypto = require('crypto');

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNexusUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function deriveUserId({ username, nexusUrl } = {}) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedNexusUrl = normalizeNexusUrl(nexusUrl);
  if (!normalizedUsername || !normalizedNexusUrl) return '';
  return crypto
    .createHash('sha256')
    .update(`${normalizedNexusUrl}\n${normalizedUsername}`)
    .digest('hex');
}

function getRequestUserContext(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  const headers = req.headers || {};
  const nexusUrl = body.nexusUrl || body.nexus_url || query.nexusUrl || query.nexus_url || headers['x-nexus-url'] || '';
  const username = body.username || query.username || headers['x-nexus-username'] || '';

  return {
    username: String(username || '').trim(),
    nexusUrl: String(nexusUrl || '').trim(),
    userId: deriveUserId({ username, nexusUrl }),
  };
}

module.exports = {
  deriveUserId,
  getRequestUserContext,
  hasUserContext: (context) => Boolean(context?.userId),
  normalizeNexusUrl,
  normalizeUsername,
};
