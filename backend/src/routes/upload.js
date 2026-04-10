const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const mavenUploader = require('../uploaders/maven');
const npmUploader = require('../uploaders/npm');
const nugetUploader = require('../uploaders/nuget');
const pypiUploader = require('../uploaders/pypi');
const dockerUploader = require('../uploaders/docker');
const yumUploader = require('../uploaders/yum');
const aptUploader = require('../uploaders/apt');
const helmUploader = require('../uploaders/helm');
const rawUploader = require('../uploaders/raw');

const storage = multer.diskStorage({
  destination: '/tmp/nexus-pusher-uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const uploaderMap = {
  maven: mavenUploader,
  npm: npmUploader,
  nuget: nugetUploader,
  pypi: pypiUploader,
  docker: dockerUploader,
  yum: yumUploader,
  apt: aptUploader,
  helm: helmUploader,
  raw: rawUploader,
};

// POST /api/upload/:type
// Body: multipart/form-data with files[] + nexusUrl, repo, username, password, (type-specific fields)
router.post('/:type', upload.array('files'), async (req, res) => {
  const { type } = req.params;
  const uploader = uploaderMap[type];
  if (!uploader) {
    return res.status(400).json({ error: `Unsupported repository type: ${type}` });
  }

  const { nexusUrl, repo, username, password, ...extra } = req.body;
  if (!nexusUrl || !repo) {
    return res.status(400).json({ error: 'nexusUrl and repo are required' });
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
    }
  }

  res.json({ results });
});

module.exports = router;
