const fs     = require('fs');
const crypto = require('crypto');
const path   = require('path');
const FormData = require('form-data');
const { nexusRequest } = require('../lib/nexusRequest');

/**
 * Nexus 3 PyPI upload via REST API v1 /service/rest/v1/components
 *
 * This is the officially documented Nexus 3 upload path and is more
 * reliable than the legacy twine/warehouse endpoint.
 *
 * multipart fields:
 *   pypi.asset          — the .whl / .tar.gz file stream
 *   pypi.asset.extension — file extension without the leading dot  (e.g. "whl")
 *
 * Docs: https://help.sonatype.com/en/uploading-components.html
 */

function extension(filename) {
  // .tar.gz needs special handling
  if (filename.endsWith('.tar.gz')) return 'tar.gz';
  return path.extname(filename).replace(/^\./, ''); // strip leading dot
}

async function upload({ file, nexusUrl, repo, username, password }) {
  const filename = file.originalname;
  const ext      = extension(filename);

  const form = new FormData();
  form.append('pypi.asset', fs.createReadStream(file.path), {
    filename,
    contentType: ext === 'whl' ? 'application/zip' : 'application/octet-stream',
  });
  form.append('pypi.asset.extension', ext);

  const base = nexusUrl.replace(/\/$/, '');
  const url  = `${base}/service/rest/v1/components?repository=${encodeURIComponent(repo)}`;

  const response = await nexusRequest({
    method:  'POST',
    url,
    data:    form,
    headers: form.getHeaders(),
    auth:    username ? { username, password: password || '' } : undefined,
  });

  const nexusUiUrl = `${base}/#browse/browse:${repo}`;
  return { url, nexusUiUrl, status: response.status };
}

module.exports = { upload };
