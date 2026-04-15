const fs       = require('fs');
const crypto   = require('crypto');
const FormData = require('form-data');
const path     = require('path');
const { nexusRequest } = require('../lib/nexusRequest');

/**
 * Nexus PyPI upload follows the legacy PEP 503 / Warehouse upload API:
 *   POST /repository/<repo>/
 *   Content-Type: multipart/form-data
 *
 * Required fields:
 *   :file      — the wheel / sdist file stream  (colon prefix is mandatory)
 *   filetype   — 'bdist_wheel' for .whl, 'sdist' for .tar.gz / .zip
 *   md5_digest — hex MD5 of the file contents
 *
 * Without :file (and the colon) Nexus returns 500.
 * Without md5_digest Nexus returns 400 "missing field".
 */

function detectFileType(filename) {
  if (filename.endsWith('.whl'))    return 'bdist_wheel';
  if (filename.endsWith('.tar.gz')) return 'sdist';
  if (filename.endsWith('.zip'))    return 'sdist';
  if (filename.endsWith('.egg'))    return 'bdist_egg';
  return 'sdist';
}

function md5File(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end',  ()    => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function upload({ file, nexusUrl, repo, username, password }) {
  const filename = file.originalname;
  const filetype = detectFileType(filename);
  const md5      = await md5File(file.path);

  const form = new FormData();

  // ":file" — the leading colon is part of the field name, not a typo.
  // Nexus and PyPI warehouse both require exactly this field name.
  form.append(':file', fs.createReadStream(file.path), {
    filename,
    contentType: filename.endsWith('.whl')
      ? 'application/zip'
      : 'application/gzip',
  });
  form.append('filetype',   filetype);
  form.append('md5_digest', md5);

  // The trailing slash on the repo URL is required by Nexus
  const url = `${nexusUrl.replace(/\/$/, '')}/repository/${repo}/`;

  const response = await nexusRequest({
    method:  'POST',
    url,
    data:    form,
    headers: form.getHeaders(),
    auth:    username ? { username, password: password || '' } : undefined,
  });

  const nexusUiUrl = `${nexusUrl.replace(/\/$/, '')}/#browse/browse:${repo}`;
  return { url, nexusUiUrl, status: response.status };
}

module.exports = { upload };
