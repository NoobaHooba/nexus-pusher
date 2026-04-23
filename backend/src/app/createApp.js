const express = require('express');
const cors = require('cors');
const uploadRoutes = require('../features/upload/routes');
const validateRoutes = require('../features/validate/routes');
const ldapRoutes = require('../features/ldap/routes');
const browseRoutes = require('../features/browse/routes');
const healthRoutes = require('../features/health/routes');
const historyRoutes = require('../features/history/routes');
const preflightRoutes = require('../features/preflight/routes');
const runtimeConfigRoutes = require('../features/runtime-config/routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/upload', uploadRoutes);
  app.use('/api/validate', validateRoutes);
  app.use('/api/ldap', ldapRoutes);
  app.use('/api/browse', browseRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/preflight', preflightRoutes);
  app.use('/api/runtime-config', runtimeConfigRoutes);

  return app;
}

module.exports = {
  createApp,
};
