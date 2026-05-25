const fs = require('fs');
const { buildArtifactPath, normalizeArtifactPath } = require('../../shared/artifacts/paths');
const { detectArtifact } = require('../../shared/artifacts/metadata');
const { deriveUserId } = require('../../shared/auth/userContext');
const { getUploader } = require('./uploaders');

function buildBrowseUrl(nexusUrl, repo, path) {
  const base = String(nexusUrl || '').replace(/\/+$/, '');
  if (!base || !repo) return null;
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${base}/#browse/browse:${repo}${normalizedPath ? `:${normalizedPath}` : ''}`;
}

function buildResultCoordinates(type, detected, extra = {}) {
  const base = detected?.coordinates || {};
  if (type === 'maven') {
    return {
      groupId: base.groupId || extra.groupId || '',
      artifactId: base.artifactId || extra.artifactId || '',
      version: base.version || extra.version || '',
      classifier: base.classifier || extra.classifier || '',
      extension: base.extension || extra.extension || detected?.extension || '',
    };
  }
  return base;
}

function buildUploadExtra(type, detected, extra = {}) {
  if (type === 'maven') {
    const coordinates = buildResultCoordinates(type, detected, extra);
    return {
      ...extra,
      groupId: coordinates.groupId,
      artifactId: coordinates.artifactId,
      version: coordinates.version,
      extension: coordinates.extension,
      classifier: coordinates.classifier,
    };
  }
  return extra;
}

function validationError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.isValidationError = true;
  return err;
}

function unlinkInputFiles(files) {
  if (!Array.isArray(files)) return;
  for (const file of files) {
    if (file?.path) fs.unlink(file.path, () => {});
  }
}

function throwValidation(message, files, unlinkFiles) {
  if (unlinkFiles) unlinkInputFiles(files);
  throw validationError(message);
}

function getHistoryUserId(userContext, username, nexusUrl) {
  return userContext?.userId || deriveUserId({ username, nexusUrl });
}

async function uploadArtifacts({
  type,
  files,
  nexusUrl,
  repo,
  username,
  password,
  extra = {},
  userContext,
  recordHistory = true,
  unlinkFiles = false,
} = {}) {
  const uploader = getUploader(type);
  if (!uploader) {
    throwValidation(`Unsupported repository type: ${type}`, files, unlinkFiles);
  }
  if (!nexusUrl) {
    throwValidation('Nexus URL is not configured — open Settings and enter your Nexus URL.', files, unlinkFiles);
  }
  if (!repo) {
    throwValidation('Repository name is required — enter the repository name in the repo name field below the type selector.', files, unlinkFiles);
  }
  if (!Array.isArray(files) || files.length === 0) {
    throwValidation('No files provided', files, unlinkFiles);
  }

  const results = [];
  for (const file of files) {
    let uploadStatus = 'error';
    let uploadError = null;
    let uploadPath = '';
    let version = '';
    let packageName = '';
    let artifactId = '';
    let resultUrl = '';

    try {
      const detectedResult = await detectArtifact(type, file, extra);
      const coordinates = buildResultCoordinates(type, detectedResult.detected, extra);
      const uploadExtra = buildUploadExtra(type, detectedResult.detected, extra);
      uploadPath = normalizeArtifactPath(type, buildArtifactPath(type, file.originalname, uploadExtra, {
        ...detectedResult.detected,
        coordinates,
      }), {
        name: detectedResult.detected.name,
        version: detectedResult.detected.version,
        coordinates,
      });
      version = coordinates.version || detectedResult.detected.version || '';
      packageName = coordinates.packageName || coordinates.chartName || detectedResult.detected.name || '';
      artifactId = coordinates.artifactId || '';

      const result = await uploader.upload({ file, nexusUrl, repo, username, password, extra: uploadExtra });
      const normalizedPath = result?.path ? String(result.path).replace(/^\/+/, '') : uploadPath;
      const normalizedBrowseUrl = result?.nexusUiUrl && normalizedPath
        ? buildBrowseUrl(nexusUrl, repo, normalizedPath)
        : (result?.nexusUiUrl || buildBrowseUrl(nexusUrl, repo, normalizedPath));
      uploadStatus = 'success';
      resultUrl = result?.downloadUrl || result?.url || normalizedBrowseUrl || result?.nexusUiUrl || '';
      results.push({
        file: file.originalname,
        status: 'success',
        repo,
        coordinates,
        path: normalizedPath,
        nexusUiUrl: normalizedBrowseUrl,
        downloadUrl: result?.downloadUrl || result?.url || null,
      });
    } catch (err) {
      uploadStatus = err.isDuplicate ? 'warning' : 'error';
      uploadError = err.message;
      results.push({
        file: file.originalname,
        status: uploadStatus,
        error: uploadError,
      });
    } finally {
      if (recordHistory) {
        const { record } = require('../../shared/persistence/db');
        record({
          user_id: getHistoryUserId(userContext, username, nexusUrl),
          username: username || '',
          nexus_url: nexusUrl || '',
          repo: repo || '',
          type,
          filename: file.originalname,
          size: file.size,
          status: uploadStatus,
          error: uploadError,
          path: uploadPath,
          version,
          package_name: packageName,
          artifact_id: artifactId,
          result_url: resultUrl,
        });
      }
      if (unlinkFiles) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  return { results };
}

module.exports = {
  buildBrowseUrl,
  buildResultCoordinates,
  buildUploadExtra,
  uploadArtifacts,
};
