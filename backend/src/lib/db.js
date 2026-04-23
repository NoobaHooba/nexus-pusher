/**
 * Lightweight SQLite audit log using better-sqlite3.
 *
 * The DB file lives at DATA_DIR/history.db — mount a named volume at
 * DATA_DIR (/app/data) so records survive container restarts.
 *
 * Schema (append-only, never update/delete rows):
 *   uploads(
 *     id        INTEGER PRIMARY KEY AUTOINCREMENT,
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

const DEFAULT_DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/data'
  : path.join(__dirname, '../../data');

const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'history.db'));

// WAL mode: readers never block writers, safe for concurrent requests
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
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
  CREATE INDEX IF NOT EXISTS idx_uploads_username ON uploads(username);
  CREATE INDEX IF NOT EXISTS idx_uploads_repo     ON uploads(repo);
  CREATE INDEX IF NOT EXISTS idx_uploads_status   ON uploads(status);
`);

const existingColumns = new Set(
  db.prepare(`PRAGMA table_info(uploads)`).all().map((column) => column.name)
);

for (const [name, ddl] of [
  ['path', 'ALTER TABLE uploads ADD COLUMN path TEXT'],
  ['version', 'ALTER TABLE uploads ADD COLUMN version TEXT'],
  ['package_name', 'ALTER TABLE uploads ADD COLUMN package_name TEXT'],
  ['artifact_id', 'ALTER TABLE uploads ADD COLUMN artifact_id TEXT'],
  ['result_url', 'ALTER TABLE uploads ADD COLUMN result_url TEXT'],
]) {
  if (!existingColumns.has(name)) db.exec(ddl);
}

const insertStmt = db.prepare(`
  INSERT INTO uploads (ts, username, nexus_url, repo, type, filename, size, status, error, path, version, package_name, artifact_id, result_url)
  VALUES (@ts, @username, @nexus_url, @repo, @type, @filename, @size, @status, @error, @path, @version, @package_name, @artifact_id, @result_url)
`);

/**
 * Record one upload result.
 * @param {object} p
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
 * @param {string}  [opts.username]  — filter by exact username
 * @param {string}  [opts.repo]      — filter by exact repo name
 * @param {string}  [opts.type]      — filter by format type
 * @param {string}  [opts.status]    — filter by status
 * @param {string}  [opts.search]    — substring match on filename
 * @param {number}  [opts.limit=200] — max rows returned (hard-capped at 1000)
 * @param {number}  [opts.offset=0]
 * @returns {{ rows: object[], total: number }}
 */
function query({ username, repo, type, status, search, limit = 200, offset = 0 } = {}) {
  const conditions = [];
  const params     = {};

  if (username) { conditions.push('username = @username'); params.username = username; }
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
 * Delete all history rows for a given username (or all rows if username is '*').
 */
function clearHistory(username) {
  if (username === '*') {
    return db.prepare('DELETE FROM uploads').run().changes;
  }
  return db.prepare('DELETE FROM uploads WHERE username = ?').run(username || '').changes;
}

module.exports = { record, query, clearHistory };
