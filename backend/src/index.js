require('dotenv').config();
const express = require('express');
const cors = require('cors');
const uploadRoutes         = require('./routes/upload');
const settingsRoutes       = require('./routes/settings');
const validateRoutes       = require('./routes/validate');
const ldapRoutes           = require('./routes/ldap');
const browseRoutes         = require('./routes/browse');
const checkDuplicateRoutes = require('./routes/checkDuplicate');
const healthRoutes         = require('./routes/health');
const historyRoutes        = require('./routes/history');
const preflightRoutes      = require('./routes/preflight');
const runtimeConfigRoutes  = require('./routes/runtimeConfig');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/upload',          uploadRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/validate',        validateRoutes);
app.use('/api/ldap',            ldapRoutes);
app.use('/api/browse',          browseRoutes);
app.use('/api/check-duplicate', checkDuplicateRoutes);
app.use('/api/health',          healthRoutes);
app.use('/api/history',         historyRoutes);
app.use('/api/preflight',       preflightRoutes);
app.use('/api/runtime-config',  runtimeConfigRoutes);

app.listen(PORT, () => {
  console.log(`Nexus Pusher backend running on port ${PORT}`);
});
