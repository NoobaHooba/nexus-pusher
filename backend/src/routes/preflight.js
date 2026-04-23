const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { buildPreflight } = require('../lib/preflight');

const router = express.Router();

const UPLOAD_DIR = '/tmp/nexus-pusher-preflight';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 512 * 1024 * 1024 },
});

router.post('/:type', upload.single('file'), async (req, res) => {
  const { type } = req.params;
  const file = req.file;
  const {
    nexusUrl,
    username,
    password,
    repo,
    defaultRepo,
    preferences,
    ...extra
  } = req.body || {};

  if (!file) {
    return res.status(400).json({ error: 'A file is required for preflight inspection' });
  }

  if (!nexusUrl) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({ error: 'Nexus URL is required' });
  }

  let parsedPreferences = {};
  if (typeof preferences === 'string' && preferences.trim()) {
    try {
      parsedPreferences = JSON.parse(preferences);
    } catch (_) {
      parsedPreferences = {};
    }
  } else if (preferences && typeof preferences === 'object') {
    parsedPreferences = preferences;
  }

  try {
    const result = await buildPreflight({
      type,
      file,
      nexusUrl,
      username,
      password,
      extra,
      preferences: parsedPreferences,
      repo,
      defaultRepo,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to inspect artifact' });
  } finally {
    fs.unlink(file.path, () => {});
  }
});

module.exports = router;
