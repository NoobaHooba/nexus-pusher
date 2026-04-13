const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const router  = express.Router();

const mavenUploader  = require('../uploaders/maven');
const npmUploader    = require('../uploaders/npm');
const nugetUploader  = require('../uploaders/nuget');
const pypiUploader   = require('../uploaders/pypi');
const dockerUploader = require('../uploaders/docker');
const yumUploader    = require('../uploaders/yum');
const aptUploader    = require('../uploaders/apt');
const helmUploader   = require('../uploaders/helm');
const rawUploader    = require('../uploaders/raw');

const UPLOAD_DIR = '/tmp/nexus-pusher-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// 1 GB hard cap — prevents OOM on the backend, especially for npm uploads
// which must hold the entire tarball in memory as base64.
const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 * 1024 },
});

const uploaderMap = {
  maven:  mavenUploader,
  npm:    npmUploader,
  nuget:  nugetUploader,
  pypi:   pypiUploader,
  docker: dockerUploader,
  yum:    yumUploader,
  apt:    aptUploader,
  helm:   helmUploader,
  raw:    rawUploader,
};

router.post('/:type', upload.array('files'), async (req, res) => {
  const { type } = req.params;
  const uploader = uploaderMap[type];
  if (!uploader) {
    return res.status(400).json({ error: `Unsupported repository type: ${type}` });
  }

  const { nexusUrl, repo, username, password, ...extra } = req.body;

  if (!nexusUrl) {
    return res.status(400).json({ error: 'Nexus URL is not configured — open Settings and enter your Nexus URL.' });
  }
  if (!repo) {
    return res.status(400).json({ error: 'Repository name is required — enter the repository name in the repo name field below the type selector.' });
  }

  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const results = [];
  for (const file of files) {
    try {
      const result = await uploader.upload({ file, nexusUrl, repo, username, password, extra });
      results.push({ file: file.originalname, status: 'success', result });
    } catch (err) {
      results.push({
        file: file.originalname,
        status: err.isDuplicate ? 'warning' : 'error',
        error: err.message,
      });
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

  // Only return 422 if there are real errors (not warnings/duplicates)
  const hasRealErrors = results.some(r => r.status === 'error');
  if (hasRealErrors && results.every(r => r.status !== 'success')) {
    return res.status(422).json({ error: results.find(r => r.status === 'error').error, results });
  }

  res.json({ results });
});

// Return a clean 400 when multer rejects an oversized file
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large — maximum upload size is 1 GB' });
  }
  next(err);
});

module.exports = router;
