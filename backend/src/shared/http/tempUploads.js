const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = process.env.UPLOAD_TEMP_DIR || '/tmp/nexus-pusher-uploads';
const PREFLIGHT_UPLOAD_DIR = process.env.PREFLIGHT_TEMP_DIR || '/tmp/nexus-pusher-preflight';
const TEMP_UPLOAD_DIRS = [UPLOAD_DIR, PREFLIGHT_UPLOAD_DIR];

function ensureUploadTempDirs() {
  for (const dir of TEMP_UPLOAD_DIRS) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

async function cleanupDirectory(dir, maxAgeMs, now) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch((err) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });

  await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(dir, entry.name);
    if (!entry.isFile()) return;

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat || now - stat.mtimeMs < maxAgeMs) return;

    await fs.promises.unlink(filePath).catch(() => {});
  }));
}

async function cleanupOldTempUploads(maxAgeMs) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return;
  ensureUploadTempDirs();
  const now = Date.now();
  await Promise.all(TEMP_UPLOAD_DIRS.map((dir) => cleanupDirectory(dir, maxAgeMs, now)));
}

module.exports = {
  PREFLIGHT_UPLOAD_DIR,
  TEMP_UPLOAD_DIRS,
  UPLOAD_DIR,
  cleanupOldTempUploads,
  ensureUploadTempDirs,
};
