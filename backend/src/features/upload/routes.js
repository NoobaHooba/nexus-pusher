const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { formatByteSize, getConfig } = require('../../app/config');
const { getRequestUserContext } = require('../../shared/auth/userContext');
const { safeUploadFilename } = require('../../shared/http/uploadFilename');
const { UPLOAD_DIR, ensureUploadTempDirs } = require('../../shared/http/tempUploads');
const { uploadArtifacts } = require('./service');

const config = getConfig();
ensureUploadTempDirs();

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, safeUploadFilename(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: config.uploadMaxBytes },
});

router.post('/:type', upload.array('files'), async (req, res) => {
  const { type } = req.params;
  const { nexusUrl, repo, username, password, ...extra } = req.body;
  const userContext = getRequestUserContext(req);

  let results;
  try {
    ({ results } = await uploadArtifacts({
      type,
      files: req.files,
      nexusUrl,
      repo,
      username,
      password,
      extra,
      userContext,
      unlinkFiles: true,
    }));
  } catch (err) {
    const status = err.isValidationError ? err.status || 400 : 500;
    return res.status(status).json({ error: err.message });
  }

  const hasRealErrors = results.some(r => r.status === 'error');
  if (hasRealErrors && results.every(r => r.status !== 'success')) {
    return res.status(422).json({ error: results.find(r => r.status === 'error').error, results });
  }

  res.json({ results });
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large — maximum upload size is ${formatByteSize(config.uploadMaxBytes)}` });
  }
  next(err);
});

module.exports = router;
