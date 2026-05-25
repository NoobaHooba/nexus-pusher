const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const test = require('node:test');

const cliPath = path.join(__dirname, '../src/cli/nxp.js');

function tempEnv() {
  return {
    ...process.env,
    DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-cli-history-')),
    XDG_CONFIG_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-cli-config-')),
  };
}

function makeTempFile(name, contents = 'hello') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-cli-file-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: options.env || tempEnv(),
    input: options.input,
  });
}

function runCliAsync(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: options.env || tempEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    if (options.input) child.stdin.end(options.input);
    else child.stdin.end();
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function startServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

test('nxp --help prints command help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /upload artifacts/i);
  assert.match(result.stdout, /upload/);
});

test('nxp upload emits JSON validation errors', () => {
  const file = makeTempFile('sample.txt');
  const result = runCli(['upload', 'raw', file, '--repo', 'raw-hosted', '--json']);

  assert.equal(result.status, 1);
  assert.doesNotThrow(() => JSON.parse(result.stderr));
  assert.match(JSON.parse(result.stderr).error, /Nexus URL is required/);
});

test('nxp reads --password-stdin before validation', () => {
  const result = runCli(['repos', '--password-stdin', '--json'], { input: 'secret\n' });

  assert.equal(result.status, 1);
  assert.doesNotThrow(() => JSON.parse(result.stderr));
  assert.match(JSON.parse(result.stderr).error, /Nexus URL is required/);
});

test('nxp upload --fail-on-duplicate exits 3 during preflight', async () => {
  const file = makeTempFile('duplicate.txt');
  const { server, url } = await startServer((req, res) => {
    if (req.url === '/service/rest/v1/repositories') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([{ name: 'raw-hosted', format: 'raw', type: 'hosted', online: true }]));
      return;
    }
    if (req.url === '/repository/raw-hosted/duplicate.txt') {
      res.statusCode = 200;
      res.end('exists');
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const result = await runCliAsync([
      'upload',
      'raw',
      file,
      '--repo',
      'raw-hosted',
      '--nexus-url',
      url,
      '--fail-on-duplicate',
      '--json',
    ]);

    assert.equal(result.status, 3);
    assert.match(result.stdout, /Duplicate artifact found/);
  } finally {
    server.close();
  }
});
