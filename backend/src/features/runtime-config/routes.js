const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    nexusUrl: process.env.NEXUS_URL || '',
    nexusBrowserUrl: process.env.NEXUS_BROWSER_URL || '',
    dockerRegistry: process.env.DOCKER_REGISTRY || '',
  });
});

module.exports = router;
