const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

router.get('/', (req, res) => {
  if (!fs.existsSync(SETTINGS_PATH)) return res.json({});
  const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  res.json(data);
});

router.post('/', (req, res) => {
  const settings = req.body;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ saved: true });
});

module.exports = router;
