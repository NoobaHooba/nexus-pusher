require('dotenv').config();
const { createApp } = require('./app/createApp');
const { getConfig } = require('./app/config');
const { cleanupOldTempUploads, ensureUploadTempDirs } = require('./shared/http/tempUploads');

const app = createApp();
const config = getConfig();

ensureUploadTempDirs();
cleanupOldTempUploads(config.tempUploadMaxAgeMs).catch((err) => {
  console.error('[temp] Failed to clean old upload temp files:', err.message);
});

app.listen(config.port, () => {
  console.log(`Nexus Pusher backend running on port ${config.port}`);
});
