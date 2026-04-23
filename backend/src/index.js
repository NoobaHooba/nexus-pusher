require('dotenv').config();
const { createApp } = require('./app/createApp');
const { getConfig } = require('./app/config');

const app = createApp();
const config = getConfig();

app.listen(config.port, () => {
  console.log(`Nexus Pusher backend running on port ${config.port}`);
});
