const path = require('path');

const KNOWN_DOUBLE_EXTENSIONS = ['.tar.gz', '.tar.bz2'];

function stripKnownExtension(filename) {
  const lower = String(filename || '').toLowerCase();
  const doubleExt = KNOWN_DOUBLE_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (doubleExt) return filename.slice(0, -doubleExt.length);
  return String(filename || '').replace(/\.[^.]+$/, '');
}

function getExtension(filename) {
  const lower = String(filename || '').toLowerCase();
  const doubleExt = KNOWN_DOUBLE_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (doubleExt) return doubleExt.replace(/^\./, '');
  return path.extname(String(filename || '')).replace(/^\./, '');
}

function parseNameVersion(filename) {
  const base = stripKnownExtension(filename);
  const match = base.match(/^(?<name>.+)-(?<version>\d[\w.+-]*)$/);
  if (!match?.groups) {
    return { name: base, version: '' };
  }
  return {
    name: match.groups.name,
    version: match.groups.version,
  };
}

function buildArtifactPath(type, fileName, extra = {}, detected = {}) {
  const extension = detected.extension || getExtension(fileName);
  const coordinates = detected.coordinates || {};

  if (type === 'maven') {
    const groupId = coordinates.groupId || extra.groupId || '';
    const artifactId = coordinates.artifactId || extra.artifactId || stripKnownExtension(fileName);
    const version = coordinates.version || extra.version || '';
    const classifier = coordinates.classifier || extra.classifier || '';
    const ext = coordinates.extension || extra.extension || extension || 'jar';
    if (!groupId || !artifactId || !version) return '';
    const groupPath = groupId.replace(/\./g, '/');
    const classifierSuffix = classifier ? `-${classifier}` : '';
    return `${groupPath}/${artifactId}/${version}/${artifactId}-${version}${classifierSuffix}.${ext}`;
  }

  if (type === 'raw' || type === 'yum') {
    const rawDir = String(extra.directory || '').replace(/^\/+|\/+$/g, '');
    return [rawDir, fileName].filter(Boolean).join('/');
  }

  if (type === 'apt') {
    return fileName;
  }

  if (type === 'docker') {
    return '';
  }

  if (type === 'npm') {
    const packageName = detected.coordinates?.packageName || detected.name || stripKnownExtension(fileName);
    const version = detected.coordinates?.version || detected.version || '';
    const tarballName = `${packageName.replace(/^@/, '').replace(/\//g, '-')}-${version || 'latest'}.tgz`;
    return `${packageName}/-/${tarballName}`;
  }

  if (type === 'helm' || type === 'pypi' || type === 'nuget') {
    const packageName = detected.coordinates?.chartName
      || detected.coordinates?.packageName
      || detected.name
      || stripKnownExtension(fileName);
    const version = detected.coordinates?.version || detected.version || '';
    if (!packageName || !version) return fileName;
    return `${packageName}/${version}/${fileName}`;
  }

  return fileName;
}

function normalizeArtifactPath(type, pathValue = '', meta = {}) {
  const trimmedPath = String(pathValue || '').replace(/^\/+/, '');
  const name = meta.name || meta.package_name || meta.packageName || meta.artifact_id || meta.artifactId || meta.chartName || meta.coordinates?.chartName || meta.coordinates?.packageName || '';
  const version = meta.version || meta.coordinates?.version || '';

  if (!trimmedPath) return '';
  if (trimmedPath.includes('/')) return trimmedPath;

  if (name && version && ['helm', 'pypi', 'nuget'].includes(String(type || '').toLowerCase())) {
    return `${name}/${version}/${trimmedPath}`;
  }

  return trimmedPath;
}

module.exports = {
  KNOWN_DOUBLE_EXTENSIONS,
  stripKnownExtension,
  getExtension,
  parseNameVersion,
  buildArtifactPath,
  normalizeArtifactPath,
};
