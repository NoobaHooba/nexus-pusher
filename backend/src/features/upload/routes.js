const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const router  = express.Router();
const { record } = require('../../shared/persistence/db');
const { buildArtifactPath, normalizeArtifactPath } = require('../../shared/artifacts/paths');
const { detectArtifact } = require('../../shared/artifacts/metadata');

const mavenUploader  = require('./uploaders/maven');
const npmUploader    = require('./uploaders/npm');
const nugetUploader  = require('./uploaders/nuget');
const pypiUploader   = require('./uploaders/pypi');
const dockerUploader = require('./uploaders/docker');
const yumUploader    = require('./uploaders/yum');
const aptUploader    = require('./uploaders/apt');
const helmUploader   = require('./uploaders/helm');
const rawUploader    = require('./uploaders/raw');

const UPLOAD_DIR = '/tmp/nexus-pusher-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

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

function buildBrowseUrl(nexusUrl, repo, path) {
  const base = String(nexusUrl || '').replace(/\/+$/, '');
  if (!base || !repo) return null;
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${base}/#browse/browse:${repo}${normalizedPath ? `:${normalizedPath}` : ''}`;
}

function buildResultCoordinates(type, detected, extra) {
  const base = detected?.coordinates || {};
  if (type === 'maven') {
    return {
      groupId: base.groupId || extra.groupId || '',
      artifactId: base.artifactId || extra.artifactId || '',
      version: base.version || extra.version || '',
      classifier: base.classifier || extra.classifier || '',
      extension: base.extension || extra.extension || detected?.extension || '',
    };
  }
  return base;
}

function buildUploadExtra(type, detected, extra) {
  if (type === 'maven') {
    const coordinates = buildResultCoordinates(type, detected, extra);
    return {
      ...extra,
      groupId: coordinates.groupId,
      artifactId: coordinates.artifactId,
      version: coordinates.version,
      extension: coordinates.extension,
      classifier: coordinates.classifier,
    };
  }
  return extra;
}

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
    let uploadStatus = 'error';
    let uploadError  = null;
    let uploadPath = '';
    let version = '';
    let packageName = '';
    let artifactId = '';
    let resultUrl = '';
    try {
      const detectedResult = await detectArtifact(type, file, extra);
      const coordinates = buildResultCoordinates(type, detectedResult.detected, extra);
      const uploadExtra = buildUploadExtra(type, detectedResult.detected, extra);
      uploadPath = normalizeArtifactPath(type, buildArtifactPath(type, file.originalname, uploadExtra, {
        ...detectedResult.detected,
        coordinates,
      }), {
        name: detectedResult.detected.name,
        version: detectedResult.detected.version,
        coordinates,
      });
      version = coordinates.version || detectedResult.detected.version || '';
      packageName = coordinates.packageName || coordinates.chartName || detectedResult.detected.name || '';
      artifactId = coordinates.artifactId || '';

      const result = await uploader.upload({ file, nexusUrl, repo, username, password, extra: uploadExtra });
      const normalizedPath = result?.path ? String(result.path).replace(/^\/+/, '') : uploadPath;
      const normalizedBrowseUrl = result?.nexusUiUrl && normalizedPath
        ? buildBrowseUrl(nexusUrl, repo, normalizedPath)
        : (result?.nexusUiUrl || buildBrowseUrl(nexusUrl, repo, normalizedPath));
      uploadStatus = 'success';
      resultUrl = result?.downloadUrl || result?.url || normalizedBrowseUrl || result?.nexusUiUrl || '';
      results.push({
        file: file.originalname,
        status: 'success',
        repo,
        coordinates,
        path: normalizedPath,
        nexusUiUrl: normalizedBrowseUrl,
        downloadUrl: result?.downloadUrl || result?.url || null,
      });
    } catch (err) {
      uploadStatus = err.isDuplicate ? 'warning' : 'error';
      uploadError  = err.message;
      results.push({
        file: file.originalname,
        status: uploadStatus,
        error: uploadError,
      });
    } finally {
      // Persist to audit log regardless of success/failure
      record({
        username:  username  || '',
        nexus_url: nexusUrl  || '',
        repo:      repo      || '',
        type,
        filename:  file.originalname,
        size:      file.size,
        status:    uploadStatus,
        error:     uploadError,
        path:         uploadPath,
        version,
        package_name: packageName,
        artifact_id:  artifactId,
        result_url:   resultUrl,
      });
      fs.unlink(file.path, () => {});
    }
  }

  const hasRealErrors = results.some(r => r.status === 'error');
  if (hasRealErrors && results.every(r => r.status !== 'success')) {
    return res.status(422).json({ error: results.find(r => r.status === 'error').error, results });
  }

  res.json({ results });
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large — maximum upload size is 1 GB' });
  }
  next(err);
});

module.exports = router;
