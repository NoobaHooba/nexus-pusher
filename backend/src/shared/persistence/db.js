/**
 * Lightweight SQLite audit log using better-sqlite3.
 *
 * The DB file lives at DATA_DIR/history.db — mount a named volume at
 * DATA_DIR (/app/data) so records survive container restarts.
 *
 * Schema (append-only, never update/delete rows):
 *   uploads(
 *     id        INTEGER PRIMARY KEY AUTOINCREMENT,
 *     user_id   TEXT    NOT NULL,   -- derived from Nexus auth context
 *     ts        TEXT    NOT NULL,   -- ISO-8601 UTC
 *     username  TEXT    NOT NULL,   -- Nexus username (empty string if anon)
 *     nexus_url TEXT    NOT NULL,
 *     repo      TEXT    NOT NULL,
 *     type      TEXT    NOT NULL,   -- maven|npm|pypi|…
 *     filename  TEXT    NOT NULL,
 *     size      INTEGER,            -- bytes, may be NULL
 *     status    TEXT    NOT NULL,   -- success|error|warning
 *     error     TEXT                -- NULL on success
 *   )
 */

const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');
const { deriveUserId } = require('../auth/userContext');

const DEFAULT_DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/data'
  : path.join(__dirname, '../../../data');

const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'history.db'));

// WAL mode: readers never block writers, safe for concurrent requests
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// SQLite has no native row-level security, so ownership is enforced by
// mandatory user_id predicates in application queries plus insert constraints.

db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT    NOT NULL DEFAULT '',
    ts        TEXT    NOT NULL,
    username  TEXT    NOT NULL DEFAULT '',
    nexus_url TEXT    NOT NULL DEFAULT '',
    repo      TEXT    NOT NULL,
    type      TEXT    NOT NULL,
    filename  TEXT    NOT NULL,
    size      INTEGER,
    status    TEXT    NOT NULL,
    error     TEXT,
    path      TEXT,
    version   TEXT,
    package_name TEXT,
    artifact_id  TEXT,
    result_url   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_uploads_ts       ON uploads(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_uploads_user_ts  ON uploads(user_id, ts DESC);
  CREATE INDEX IF NOT EXISTS idx_uploads_username ON uploads(username);
  CREATE INDEX IF NOT EXISTS idx_uploads_repo     ON uploads(repo);
  CREATE INDEX IF NOT EXISTS idx_uploads_status   ON uploads(status);
  CREATE TRIGGER IF NOT EXISTS uploads_require_user_id_insert
  BEFORE INSERT ON uploads
  FOR EACH ROW
  WHEN NEW.user_id IS NULL OR NEW.user_id = ''
  BEGIN
    SELECT RAISE(ABORT, 'user_id is required');
  END;
  CREATE TRIGGER IF NOT EXISTS uploads_block_update
  BEFORE UPDATE ON uploads
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'uploads rows are append-only');
  END;
`);

const existingColumns = new Set(
  db.prepare(`PRAGMA table_info(uploads)`).all().map((column) => column.name)
);

for (const [name, ddl] of [
  ['user_id', 'ALTER TABLE uploads ADD COLUMN user_id TEXT NOT NULL DEFAULT \'\''],
  ['path', 'ALTER TABLE uploads ADD COLUMN path TEXT'],
  ['version', 'ALTER TABLE uploads ADD COLUMN version TEXT'],
  ['package_name', 'ALTER TABLE uploads ADD COLUMN package_name TEXT'],
  ['artifact_id', 'ALTER TABLE uploads ADD COLUMN artifact_id TEXT'],
  ['result_url', 'ALTER TABLE uploads ADD COLUMN result_url TEXT'],
]) {
  if (!existingColumns.has(name)) db.exec(ddl);
}

const backfillUserIdStmt = db.prepare(`
  UPDATE uploads
  SET user_id = @user_id
  WHERE id = @id
`);

db.prepare(`
  SELECT id, username, nexus_url
  FROM uploads
  WHERE user_id IS NULL OR user_id = ''
`).all().forEach((row) => {
  backfillUserIdStmt.run({
    id: row.id,
    user_id: deriveUserId({ username: row.username, nexusUrl: row.nexus_url }),
  });
});

const insertStmt = db.prepare(`
  INSERT INTO uploads (user_id, ts, username, nexus_url, repo, type, filename, size, status, error, path, version, package_name, artifact_id, result_url)
  VALUES (@user_id, @ts, @username, @nexus_url, @repo, @type, @filename, @size, @status, @error, @path, @version, @package_name, @artifact_id, @result_url)
`);
const latestUploadByPathStmt = db.prepare(`
  SELECT username, ts, filename, path
  FROM uploads
  WHERE user_id = ? AND status = 'success' AND repo = ? AND path = ?
  ORDER BY ts DESC
  LIMIT 1
`);
const latestUploadByFilenameStmt = db.prepare(`
  SELECT username, ts, filename, path
  FROM uploads
  WHERE user_id = ? AND status = 'success' AND repo = ? AND filename = ?
  ORDER BY ts DESC
  LIMIT 1
`);

/**
 * Record one upload result.
 * @param {object} p
 * @param {string}  p.user_id
 * @param {string}  p.username
 * @param {string}  p.nexus_url
 * @param {string}  p.repo
 * @param {string}  p.type
 * @param {string}  p.filename
 * @param {number}  [p.size]
 * @param {'success'|'error'|'warning'} p.status
 * @param {string}  [p.error]
 */
function record(p) {
  try {
    insertStmt.run({
      user_id:   p.user_id   || deriveUserId({ username: p.username, nexusUrl: p.nexus_url }),
      ts:        new Date().toISOString(),
      username:  p.username  || '',
      nexus_url: p.nexus_url || '',
      repo:      p.repo      || '',
      type:      p.type      || '',
      filename:  p.filename  || '',
      size:      p.size      ?? null,
      status:    p.status,
      error:     p.error     || null,
      path:         p.path || null,
      version:      p.version || null,
      package_name: p.package_name || null,
      artifact_id:  p.artifact_id || null,
      result_url:   p.result_url || null,
    });
  } catch (err) {
    // Never crash the upload flow because of a logging failure
    console.error('[db] Failed to record upload:', err.message);
  }
}

/**
 * Query upload history with optional filters.
 * @param {object} opts
 * @param {string}  opts.userId      — required scope filter
 * @param {string}  [opts.repo]      — filter by exact repo name
 * @param {string}  [opts.type]      — filter by format type
 * @param {string}  [opts.status]    — filter by status
 * @param {string}  [opts.search]    — substring match on filename
 * @param {number}  [opts.limit=200] — max rows returned (hard-capped at 1000)
 * @param {number}  [opts.offset=0]
 * @returns {{ rows: object[], total: number }}
 */
function query(opts = {}) {
  const {
    userId,
    repo,
    type,
    status,
    search,
    limit = 200,
    offset = 0,
  } = opts;
  const conditions = [];
  const params     = {};

  if (!userId) throw new Error('userId is required for history queries');
  conditions.push('user_id = @user_id');
  params.user_id = userId;
  if (repo)     { conditions.push('repo = @repo');         params.repo     = repo;     }
  if (type)     { conditions.push('type = @type');         params.type     = type;     }
  if (status)   { conditions.push('status = @status');     params.status   = status;   }
  if (search)   { conditions.push('filename LIKE @search');params.search   = `%${search}%`; }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit  = Math.min(Number(limit)  || 200, 1000);
  const safeOffset = Math.max(Number(offset) || 0,   0);

  const rows  = db.prepare(`SELECT * FROM uploads ${where} ORDER BY ts DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`).all(params);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM uploads ${where}`).get(params).n;

  return { rows, total };
}

/**
 * Delete all history rows for the current user scope.
 */
function clearHistory(userId) {
  if (!userId) throw new Error('userId is required to clear history');
  return db.prepare('DELETE FROM uploads WHERE user_id = ?').run(userId).changes;
}

function normalizeAssetLookupValue(value) {
  return String(value || '').replace(/^\/+/, '').trim();
}

function findLatestUploadForAsset({ userId, repo, path, filename } = {}) {
  const normalizedRepo = String(repo || '').trim();
  const normalizedPath = normalizeAssetLookupValue(path);
  const normalizedFilename = normalizeAssetLookupValue(filename);

  if (!userId || !normalizedRepo) return null;

  const byPath = normalizedPath
    ? latestUploadByPathStmt.get(userId, normalizedRepo, normalizedPath)
    : null;

  if (byPath) {
    return {
      uploader: byPath.username || '',
      uploadedAt: byPath.ts || '',
      uploadedFilename: byPath.filename || '',
      uploadedPath: byPath.path || '',
    };
  }

  const byFilename = normalizedFilename
    ? latestUploadByFilenameStmt.get(userId, normalizedRepo, normalizedFilename)
    : null;

  if (!byFilename) return null;

  return {
    uploader: byFilename.username || '',
    uploadedAt: byFilename.ts || '',
    uploadedFilename: byFilename.filename || '',
    uploadedPath: byFilename.path || '',
  };
}

function enrichAssetsWithUploader(assets = [], userId) {
  return assets.map((asset) => {
    const uploadInfo = findLatestUploadForAsset({
      userId,
      repo: asset?.repository || asset?.repo,
      path: asset?.path,
      filename: asset?.path?.split('/').pop() || asset?.filename || asset?.name,
    });

    return uploadInfo ? { ...asset, ...uploadInfo } : asset;
  });
}

module.exports = { record, query, clearHistory, findLatestUploadForAsset, enrichAssetsWithUploader };
