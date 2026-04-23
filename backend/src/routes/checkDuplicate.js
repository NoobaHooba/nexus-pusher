const express = require('express');
const router  = express.Router();
const { runDuplicateCheck } = require('../lib/preflight');

router.post('/', async (req, res) => {
  const { nexusUrl, username, password, repo, type = 'raw', name, version, path } = req.body || {};

  if (!nexusUrl || !repo || !name) {
    return res.status(400).json({ error: 'nexusUrl, repo, and name are required' });
  }

  try {
    const result = await runDuplicateCheck({
      nexusUrl,
      username,
      password,
      type,
      repo,
      detected: {
        name,
        version,
        coordinates: {
          packageName: name,
          version,
        },
      },
      path,
    });
    return res.json({
      exists: result.exists,
      components: result.matches,
      warning: result.warning,
    });
  } catch (err) {
    return res.json({ exists: false, components: [], warning: err.message });
  }
});

module.exports = router;
