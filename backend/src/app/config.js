const BYTE_UNITS = {
  b: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
};

const DURATION_UNITS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSizedValue(value, fallback, units, defaultUnit) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

  const match = String(value).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return fallback;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] || defaultUnit;
  const multiplier = units[unit];
  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) return fallback;
  return Math.floor(amount * multiplier);
}

function parseByteSize(value, fallback) {
  return parseSizedValue(value, fallback, BYTE_UNITS, 'b');
}

function parseDurationMs(value, fallback) {
  return parseSizedValue(value, fallback, DURATION_UNITS, 'ms');
}

function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / (1024 ** 2))} MB`;
  const value = bytes / (1024 ** 3);
  return `${Number.isInteger(value) ? value : value.toFixed(1)} GB`;
}

function getConfig() {
  const uploadMaxBytes = parseByteSize(
    process.env.UPLOAD_MAX_SIZE || process.env.UPLOAD_MAX_BYTES || process.env.NEXUS_PUSHER_UPLOAD_MAX_BYTES,
    1024 ** 3,
  );
  const preflightMaxBytes = parseByteSize(
    process.env.PREFLIGHT_MAX_SIZE || process.env.PREFLIGHT_MAX_BYTES || process.env.NEXUS_PUSHER_PREFLIGHT_MAX_BYTES,
    512 * 1024 ** 2,
  );

  return {
    port: parsePort(process.env.PORT, 3001),
    uploadMaxBytes,
    preflightMaxBytes,
    tempUploadMaxAgeMs: parseDurationMs(
      process.env.TEMP_UPLOAD_MAX_AGE || process.env.TEMP_UPLOAD_MAX_AGE_MS || process.env.NEXUS_PUSHER_TEMP_MAX_AGE_MS,
      24 * 60 * 60 * 1000,
    ),
  };
}

module.exports = {
  formatByteSize,
  getConfig,
  parseByteSize,
  parseDurationMs,
};
