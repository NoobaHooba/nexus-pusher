const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const test = require('node:test');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-history-'));

const { query } = require('../src/shared/persistence/db');
const { deriveUserId } = require('../src/shared/auth/userContext');
const { buildResultCoordinates, uploadArtifacts } = require('../src/features/upload/service');

function makeTempFile(name, contents = 'hello') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-upload-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents);
  return {
    path: filePath,
    originalname: name,
    size: fs.statSync(filePath).size,
  };
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

test('uploadArtifacts rejects validation errors before uploading', async () => {
  await assert.rejects(
    () => uploadArtifacts({ type: 'missing', files: [], nexusUrl: 'http://nexus', repo: 'raw' }),
    /Unsupported repository type/
  );
  await assert.rejects(
    () => uploadArtifacts({ type: 'raw', files: [], nexusUrl: '', repo: 'raw' }),
    /Nexus URL/
  );
  await assert.rejects(
    () => uploadArtifacts({ type: 'raw', files: [], nexusUrl: 'http://nexus', repo: 'raw' }),
    /No files provided/
  );
});

test('uploadArtifacts uploads raw files, records history, and preserves CLI files', async () => {
  const seen = [];
  const { server, url } = await startServer((req, res) => {
    seen.push(req.url);
    req.resume();
    res.statusCode = 201;
    res.end('ok');
  });
  const file = makeTempFile('sample.txt');
  const userId = deriveUserId({ username: 'alice', nexusUrl: url });

  try {
    const result = await uploadArtifacts({
      type: 'raw',
      files: [file],
      nexusUrl: url,
      repo: 'raw-hosted',
      username: 'alice',
      password: 'pw',
      extra: { directory: 'cli-test' },
      recordHistory: true,
      unlinkFiles: false,
    });

    assert.equal(result.results[0].status, 'success');
    assert.equal(result.results[0].path, 'cli-test/sample.txt');
    assert.equal(fs.existsSync(file.path), true);
    assert.deepEqual(seen, ['/repository/raw-hosted/cli-test/sample.txt']);
    const history = query({ userId, repo: 'raw-hosted' });
    assert.equal(history.total, 1);
    assert.equal(history.rows[0].filename, 'sample.txt');
  } finally {
    server.close();
  }
});

test('uploadArtifacts returns partial success without deleting CLI files', async () => {
  const { server, url } = await startServer((req, res) => {
    req.resume();
    if (req.url.includes('bad.txt')) {
      res.statusCode = 500;
      res.end('failed');
      return;
    }
    res.statusCode = 201;
    res.end('ok');
  });
  const good = makeTempFile('good.txt');
  const bad = makeTempFile('bad.txt');

  try {
    const result = await uploadArtifacts({
      type: 'raw',
      files: [good, bad],
      nexusUrl: url,
      repo: 'raw-hosted',
      extra: {},
      recordHistory: false,
      unlinkFiles: false,
    });

    assert.equal(result.results[0].status, 'success');
    assert.equal(result.results[1].status, 'error');
    assert.equal(fs.existsSync(good.path), true);
    assert.equal(fs.existsSync(bad.path), true);
  } finally {
    server.close();
  }
});

test('buildResultCoordinates merges Maven detected values with overrides', () => {
  const coordinates = buildResultCoordinates(
    'maven',
    {
      extension: 'jar',
      coordinates: {
        artifactId: 'detected-artifact',
        version: '1.0.0',
      },
    },
    {
      groupId: 'com.example',
      artifactId: 'override-artifact',
      classifier: 'sources',
    }
  );

  assert.deepEqual(coordinates, {
    groupId: 'com.example',
    artifactId: 'detected-artifact',
    version: '1.0.0',
    classifier: 'sources',
    extension: 'jar',
  });
});
