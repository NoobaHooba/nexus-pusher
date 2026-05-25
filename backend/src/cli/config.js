const fs = require('fs');
const os = require('os');
const path = require('path');

function getConfigPath(env = process.env) {
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'nexus-pusher', 'nxp.json');
}

function sanitizeConfig(config = {}) {
  const { password, ...safeConfig } = config || {};
  if (password) {
    // Passwords are intentionally never persisted.
  }
  return {
    ...safeConfig,
    repos: safeConfig.repos && typeof safeConfig.repos === 'object' ? safeConfig.repos : {},
  };
}

function loadConfig(env = process.env) {
  const filePath = getConfigPath(env);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    const error = new Error(`Invalid nxp config at ${filePath}: ${err.message}`);
    error.code = 'INVALID_CONFIG';
    throw error;
  }

  return sanitizeConfig(parsed);
}

function saveConfig(config, env = process.env) {
  const filePath = getConfigPath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(sanitizeConfig(config), null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
  return filePath;
}

function setConfigValue(config, key, value) {
  const next = sanitizeConfig(config);
  if (key === 'password') {
    throw new Error('Passwords are not stored in nxp config. Use NXP_PASSWORD, --password, or --password-stdin.');
  }
  if (key === 'nexus-url') {
    next.nexusUrl = value;
    return next;
  }
  if (key === 'username') {
    next.username = value;
    return next;
  }
  if (key === 'docker-registry') {
    next.dockerRegistry = value;
    return next;
  }
  if (key.startsWith('repo.')) {
    const type = key.slice('repo.'.length);
    if (!type) throw new Error('Repository config key must include a type, for example repo.maven');
    next.repos = { ...(next.repos || {}), [type]: value };
    return next;
  }
  throw new Error(`Unsupported config key: ${key}`);
}

function unsetConfigValue(config, key) {
  const next = sanitizeConfig(config);
  if (key === 'nexus-url') delete next.nexusUrl;
  else if (key === 'username') delete next.username;
  else if (key === 'docker-registry') delete next.dockerRegistry;
  else if (key.startsWith('repo.')) {
    const type = key.slice('repo.'.length);
    next.repos = { ...(next.repos || {}) };
    delete next.repos[type];
  } else {
    throw new Error(`Unsupported config key: ${key}`);
  }
  return next;
}

function resolveRuntimeConfig({ options = {}, type = '', config = {}, env = process.env } = {}) {
  const repos = config.repos || {};
  const repoFromConfig = type ? repos[type] : '';
  return {
    nexusUrl: options.nexusUrl || env.NXP_NEXUS_URL || config.nexusUrl || '',
    username: options.username || env.NXP_USERNAME || config.username || '',
    password: options.password || env.NXP_PASSWORD || '',
    repo: options.repo || env.NXP_REPO || repoFromConfig || '',
    dockerRegistry: options.registry || env.NXP_DOCKER_REGISTRY || config.dockerRegistry || process.env.DOCKER_REGISTRY || '',
  };
}

module.exports = {
  getConfigPath,
  loadConfig,
  resolveRuntimeConfig,
  sanitizeConfig,
  saveConfig,
  setConfigValue,
  unsetConfigValue,
};
