const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { formatByteSize, getConfig } = require('../../app/config');
const { buildPreflight } = require('./service');
const { safeUploadFilename } = require('../../shared/http/uploadFilename');
const { PREFLIGHT_UPLOAD_DIR, ensureUploadTempDirs } = require('../../shared/http/tempUploads');

const router = express.Router();

const config = getConfig();
ensureUploadTempDirs();

const storage = multer.diskStorage({
  destination: PREFLIGHT_UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, safeUploadFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: config.preflightMaxBytes },
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

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large for preflight — maximum inspection size is ${formatByteSize(config.preflightMaxBytes)}` });
  }
  next(err);
});

module.exports = router;
