const express = require('express');
const { getConfig } = require('../../app/config');

const router = express.Router();

router.get('/', (req, res) => {
  const config = getConfig();
  res.json({
    nexusUrl: process.env.NEXUS_URL || '',
    nexusBrowserUrl: process.env.NEXUS_BROWSER_URL || '',
    dockerRegistry: process.env.DOCKER_REGISTRY || '',
    dockerUploadUrl: process.env.DOCKER_UPLOAD_URL || process.env.DOCKER_UPLOAD_PORTAL_URL || '',
    uploadMaxBytes: config.uploadMaxBytes,
    preflightMaxBytes: config.preflightMaxBytes,
    tempUploadMaxAgeMs: config.tempUploadMaxAgeMs,
  });
});

module.exports = router;
