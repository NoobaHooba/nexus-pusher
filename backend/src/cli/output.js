function writeJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeError(error, { json = false } = {}) {
  if (json) {
    writeJson({ error: error.message || String(error) }, process.stderr);
    return;
  }
  process.stderr.write(`Error: ${error.message || String(error)}\n`);
}

function renderPreflight(result, { json = false } = {}) {
  if (json) {
    writeJson(result);
    return;
  }

  const detected = result.detected || {};
  process.stdout.write(`Type: ${result.type}\n`);
  process.stdout.write(`File: ${result.file}\n`);
  if (result.repo) process.stdout.write(`Repo: ${result.repo}\n`);
  if (detected.name) process.stdout.write(`Name: ${detected.name}\n`);
  if (detected.version) process.stdout.write(`Version: ${detected.version}\n`);
  if (detected.path) process.stdout.write(`Path: ${detected.path}\n`);
  if (detected.coordinates && Object.keys(detected.coordinates).length > 0) {
    process.stdout.write(`Coordinates: ${JSON.stringify(detected.coordinates)}\n`);
  }
  if (Array.isArray(result.missingFields) && result.missingFields.length > 0) {
    process.stdout.write(`Missing: ${result.missingFields.join(', ')}\n`);
  }
  if (result.duplicateCheck?.exists) {
    process.stdout.write('Duplicate: yes\n');
  } else if (result.duplicateCheck) {
    process.stdout.write('Duplicate: no\n');
  }
  if (Array.isArray(result.repoSuggestions) && result.repoSuggestions.length > 0) {
    process.stdout.write(`Repo suggestions: ${result.repoSuggestions.map((repo) => repo.name).join(', ')}\n`);
  }
  if (Array.isArray(result.warnings)) {
    for (const warning of result.warnings) {
      process.stdout.write(`Warning: ${warning}\n`);
    }
  }
}

function renderUploadPreflight(result, { json = false } = {}) {
  if (json) return;
  const path = result.detected?.path || '';
  process.stdout.write(`Inspecting ${result.file}\n`);
  process.stdout.write(`Type: ${result.type}\n`);
  process.stdout.write(`Repo: ${result.repo || result.selectedRepo || ''}\n`);
  if (path) process.stdout.write(`Path: ${path}\n`);
  if (result.duplicateCheck?.exists) process.stdout.write('Warning: duplicate artifact found\n');
  process.stdout.write('\n');
}

function renderUploadResults(payload, { json = false, dryRun = false } = {}) {
  if (json) {
    writeJson(payload);
    return;
  }

  if (dryRun) {
    process.stdout.write('Dry run complete. No files uploaded.\n');
    return;
  }

  for (const result of payload.results || []) {
    if (result.status === 'success') {
      process.stdout.write(`Uploaded ${result.file}\n`);
      if (result.nexusUiUrl) process.stdout.write(`Browse: ${result.nexusUiUrl}\n`);
      if (result.downloadUrl) process.stdout.write(`Download: ${result.downloadUrl}\n`);
    } else {
      process.stdout.write(`${result.status === 'warning' ? 'Warning' : 'Failed'} ${result.file}: ${result.error || 'unknown error'}\n`);
    }
    process.stdout.write('\n');
  }
}

module.exports = {
  renderPreflight,
  renderUploadPreflight,
  renderUploadResults,
  writeError,
  writeJson,
};
