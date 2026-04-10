const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const mavenUploader   = require('../uploaders/maven');
const npmUploader     = require('../uploaders/npm');
const nugetUploader   = require('../uploaders/nuget');
const pypiUploader    = require('../uploaders/pypi');
const dockerUploader  = require('../uploaders/docker');
const yumUploader     = require('../uploaders/yum');
const aptUploader     = require('../uploaders/apt');
const helmUploader    = require('../uploaders/helm');
const rawUploader     = require('../uploaders/raw');

const UPLOAD_DIR = '/tmp/nexus-pusher-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

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
      results.push({ file: file.originalname, status: 'error', error: err.message });
    } finally {
      // Clean up temp file regardless of outcome
      fs.unlink(file.path, () => {});
    }
  }

  // If every file errored, return 422 so the frontend axios call rejects
  const allFailed = results.every(r => r.status === 'error');
  if (allFailed) {
    return res.status(422).json({ error: results[0].error, results });
  }

  res.json({ results });
});

module.exports = router;
