const fs     = require('fs');
const FormData = require('form-data');
const { nexusRequest } = require('../lib/nexusRequest');

/**
 * Nexus 3 PyPI upload via REST API v1:
 *   POST /service/rest/v1/components?repository=<repo>
 *
 * The ONLY field Nexus accepts for PyPI assets is "pypi.asset".
 * Extension / filetype are inferred from the filename automatically.
 * Any extra field (e.g. pypi.asset.extension) causes a 400.
 */
async function upload({ file, nexusUrl, repo, username, password }) {
  const filename = file.originalname;

  const form = new FormData();
  form.append('pypi.asset', fs.createReadStream(file.path), {
    filename,
    contentType: filename.endsWith('.whl')
      ? 'application/zip'
      : 'application/octet-stream',
  });

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
