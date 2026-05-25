const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  getConfigPath,
  loadConfig,
  resolveRuntimeConfig,
  saveConfig,
  setConfigValue,
} = require('../src/cli/config');

function tempEnv() {
  return {
    XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-config-')),
  };
}

test('saves and reads config with private permissions', () => {
  const env = tempEnv();
  const config = setConfigValue({}, 'nexus-url', 'http://nexus.example');
  const withRepo = setConfigValue(config, 'repo.maven', 'maven-releases');
  const filePath = saveConfig(withRepo, env);

  assert.equal(filePath, getConfigPath(env));
  assert.equal(fs.statSync(filePath).mode & 0o777, 0o600);
  assert.deepEqual(loadConfig(env), {
    nexusUrl: 'http://nexus.example',
    repos: { maven: 'maven-releases' },
  });
});

test('environment and flags override saved config', () => {
  const resolved = resolveRuntimeConfig({
    type: 'maven',
    options: { repo: 'flag-repo' },
    config: {
      nexusUrl: 'http://config.example',
      username: 'config-user',
      repos: { maven: 'config-repo' },
    },
    env: {
      NXP_NEXUS_URL: 'http://env.example',
      NXP_USERNAME: 'env-user',
      NXP_PASSWORD: 'env-password',
    },
  });

  assert.equal(resolved.nexusUrl, 'http://env.example');
  assert.equal(resolved.username, 'env-user');
  assert.equal(resolved.password, 'env-password');
  assert.equal(resolved.repo, 'flag-repo');
});

test('password is never persisted to config', () => {
  const env = tempEnv();
  const filePath = saveConfig({ nexusUrl: 'http://nexus.example', password: 'secret' }, env);
  const raw = fs.readFileSync(filePath, 'utf8');

  assert.equal(raw.includes('secret'), false);
  assert.equal(loadConfig(env).password, undefined);
});
