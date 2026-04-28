const fs = require('fs');
const zlib = require('zlib');
const tar = require('tar-stream');
const AdmZip = require('adm-zip');
const {
  getExtension,
  parseNameVersion,
  stripKnownExtension,
} = require('./paths');

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readZipEntry(filePath, predicate) {
  try {
    const zip = new AdmZip(filePath);
    const entry = zip.getEntries().find((item) => predicate(item.entryName));
    return entry ? zip.readAsText(entry) : null;
  } catch (_) {
    return null;
  }
}

function readTarGzEntry(filePath, predicate) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const extract = tar.extract();
    const input = fs.createReadStream(filePath);
    const gunzip = zlib.createGunzip();

    const finishWith = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    extract.on('entry', (header, stream, next) => {
      const match = predicate(header.name);
      if (!match || resolved) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        finishWith(Buffer.concat(chunks).toString('utf8'));
        next();
      });
    });
    extract.on('finish', () => finishWith(null));
    extract.on('error', reject);
    gunzip.on('error', reject);
    input.on('error', reject);

    input.pipe(gunzip).pipe(extract);
  });
}

function readTarEntry(filePath, predicate) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const extract = tar.extract();
    const input = fs.createReadStream(filePath);

    const finishWith = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    extract.on('entry', (header, stream, next) => {
      const match = predicate(header.name);
      if (!match || resolved) {
        stream.resume();
        stream.on('end', next);
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        finishWith(Buffer.concat(chunks).toString('utf8'));
        next();
      });
    });
    extract.on('finish', () => finishWith(null));
    extract.on('error', reject);
    input.on('error', reject);

    input.pipe(extract);
  });
}

function readArchiveEntry(filePath, originalName, predicate) {
  const lower = String(originalName || '').toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    return readTarGzEntry(filePath, predicate);
  }
  return readTarEntry(filePath, predicate);
}

function extractXmlTag(xml, tags) {
  for (const tag of tags) {
    const match = String(xml || '').match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'));
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractParentPomTag(xml, tagName) {
  const match = String(xml || '').match(new RegExp(`<parent>[\\s\\S]*?<${tagName}>([^<]+)</${tagName}>[\\s\\S]*?</parent>`, 'i'));
  return match?.[1]?.trim() || '';
}

function parseSimpleProperties(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

function parseSimpleYamlValue(text, key) {
  const match = String(text || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim()?.replace(/^['"]|['"]$/g, '') || '';
}

function detectMavenFromFilename(filename) {
  const base = stripKnownExtension(filename);
  const match = base.match(/^(?<artifactId>.+)-(?<version>\d[\w.+-]*?)(?:-(?<classifier>[^-]+))?$/);
  if (!match?.groups) {
    return {
      artifactId: base,
      version: '',
      classifier: '',
    };
  }
  return {
    artifactId: match.groups.artifactId || base,
    version: match.groups.version || '',
    classifier: match.groups.classifier || '',
  };
}

async function detectMaven(file) {
  const extension = getExtension(file.originalname) || 'jar';
  let groupId = '';
  let artifactId = '';
  let version = '';
  let classifier = '';
  const warnings = [];

  if (extension === 'pom') {
    try {
      const xml = readTextFile(file.path);
      groupId = extractXmlTag(xml, ['groupId']) || extractParentPomTag(xml, 'groupId');
      artifactId = extractXmlTag(xml, ['artifactId']);
      version = extractXmlTag(xml, ['version']) || extractParentPomTag(xml, 'version');
    } catch (_) {
      warnings.push('Could not read pom.xml metadata');
    }
  } else {
    const propsText = readZipEntry(file.path, (entryName) => /META-INF\/maven\/.+\/pom\.properties$/i.test(entryName));
    if (propsText) {
      const props = parseSimpleProperties(propsText);
      groupId = props.groupId || '';
      artifactId = props.artifactId || '';
      version = props.version || '';
    }
  }

  if (!artifactId || !version) {
    const fallback = detectMavenFromFilename(file.originalname);
    artifactId ||= fallback.artifactId;
    version ||= fallback.version;
    classifier ||= fallback.classifier;
  }

  return {
    detected: {
      name: artifactId || file.originalname,
      version,
      extension,
      coordinates: {
        groupId,
        artifactId,
        version,
        classifier,
        extension,
      },
    },
    missingFields: ['groupId', 'artifactId', 'version'].filter((key) => !({
      groupId,
      artifactId,
      version,
    })[key]),
    warnings,
  };
}

async function detectNpm(file) {
  const warnings = [];
  let pkg = null;

  try {
    const packageJson = await readTarGzEntry(file.path, (entryName) => /(^|\/)package\/package\.json$/i.test(entryName));
    if (packageJson) pkg = JSON.parse(packageJson);
  } catch (_) {
    warnings.push('Could not inspect package/package.json inside tarball');
  }

  const fallback = parseNameVersion(file.originalname.replace(/\.tgz$/i, ''));
  const name = pkg?.name || fallback.name || file.originalname;
  const version = pkg?.version || fallback.version || '';

  return {
    detected: {
      name,
      version,
      extension: getExtension(file.originalname),
      coordinates: {
        packageName: name,
        version,
      },
    },
    missingFields: ['packageName', 'version'].filter((key) => !({
      packageName: name,
      version,
    })[key]),
    warnings,
  };
}

async function detectNuget(file) {
  const warnings = [];
  let nuspec = null;
  try {
    nuspec = readZipEntry(file.path, (entryName) => /\.nuspec$/i.test(entryName));
  } catch (_) {
    warnings.push('Could not inspect .nuspec metadata');
  }

  const fallback = parseNameVersion(file.originalname);
  const packageName = extractXmlTag(nuspec, ['id']) || fallback.name;
  const version = extractXmlTag(nuspec, ['version']) || fallback.version;

  return {
    detected: {
      name: packageName || file.originalname,
      version,
      extension: getExtension(file.originalname),
      coordinates: {
        packageName,
        version,
      },
    },
    missingFields: ['packageName', 'version'].filter((key) => !({
      packageName,
      version,
    })[key]),
    warnings,
  };
}

async function detectHelm(file) {
  const warnings = [];
  let chartYaml = null;
  try {
    chartYaml = await readTarGzEntry(file.path, (entryName) => /(^|\/)Chart\.ya?ml$/i.test(entryName));
  } catch (_) {
    warnings.push('Could not inspect Chart.yaml inside chart archive');
  }

  const fallback = parseNameVersion(file.originalname.replace(/\.tgz$/i, ''));
  const packageName = parseSimpleYamlValue(chartYaml, 'name') || fallback.name;
  const version = parseSimpleYamlValue(chartYaml, 'version') || fallback.version;

  return {
    detected: {
      name: packageName || file.originalname,
      version,
      extension: getExtension(file.originalname),
      coordinates: {
        chartName: packageName,
        version,
      },
    },
    missingFields: ['chartName', 'version'].filter((key) => !({
      chartName: packageName,
      version,
    })[key]),
    warnings,
  };
}

async function detectPypi(file) {
  const filename = file.originalname;
  let packageName = '';
  let version = '';
  let distribution = '';

  const wheel = filename.match(/^(?<name>.+)-(?<version>\d[^-]*)-[^-]+-[^-]+-[^-]+\.whl$/i);
  const sdist = filename.match(/^(?<name>.+)-(?<version>\d[\w.+-]*)\.(?:tar\.gz|zip|egg)$/i);

  if (wheel?.groups) {
    packageName = wheel.groups.name;
    version = wheel.groups.version;
    distribution = 'wheel';
  } else if (sdist?.groups) {
    packageName = sdist.groups.name;
    version = sdist.groups.version;
    distribution = 'sdist';
  } else {
    const fallback = parseNameVersion(filename);
    packageName = fallback.name;
    version = fallback.version;
  }

  return {
    detected: {
      name: packageName || filename,
      version,
      extension: getExtension(filename),
      coordinates: {
        packageName,
        version,
        distribution,
      },
    },
    missingFields: ['packageName', 'version'].filter((key) => !({
      packageName,
      version,
    })[key]),
    warnings: [],
  };
}

async function detectSimplePackage(file, fieldName) {
  const parsed = parseNameVersion(file.originalname);
  return {
    detected: {
      name: parsed.name || file.originalname,
      version: parsed.version || '',
      extension: getExtension(file.originalname),
      coordinates: {
        [fieldName]: parsed.name || file.originalname,
        version: parsed.version || '',
      },
    },
    missingFields: [],
    warnings: [],
  };
}

function parseDockerReference(reference) {
  const value = String(reference || '').trim();
  if (!value) {
    return { imageName: '', imageTag: '', sourceTag: '' };
  }

  const lastSlash = value.lastIndexOf('/');
  const lastColon = value.lastIndexOf(':');
  const hasExplicitTag = lastColon > lastSlash;
  const taglessReference = hasExplicitTag ? value.slice(0, lastColon) : value;
  const segments = taglessReference.split('/');
  const firstSegment = segments[0] || '';
  const hasRegistryPrefix = segments.length > 1
    && (firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost');

  return {
    imageName: hasRegistryPrefix ? segments.slice(1).join('/') : taglessReference,
    imageTag: hasExplicitTag ? value.slice(lastColon + 1) : 'latest',
    sourceTag: hasExplicitTag ? value : `${value}:latest`,
  };
}

async function detectDocker(file, extra = {}) {
  const warnings = [];
  let sourceTag = String(extra.sourceTag || '').trim();

  try {
    const manifestText = await readArchiveEntry(
      file.path,
      file.originalname,
      (entryName) => /(^|\/)manifest\.json$/i.test(entryName)
    );

    if (manifestText) {
      const manifest = JSON.parse(manifestText);
      const firstImage = Array.isArray(manifest) ? manifest.find((entry) => Array.isArray(entry?.RepoTags) && entry.RepoTags.length > 0) || manifest[0] : null;
      sourceTag = sourceTag || firstImage?.RepoTags?.[0] || '';
      if (!sourceTag) {
        warnings.push('Docker archive metadata does not include a tagged image. Enter the image name and tag before uploading.');
      }
    } else {
      warnings.push('Could not find manifest.json in the Docker archive. Enter the image name and tag before uploading.');
    }
  } catch (_) {
    warnings.push('Could not inspect Docker archive metadata. Enter the image name and tag before uploading.');
  }

  const parsed = parseDockerReference(sourceTag);
  const imageName = String(extra.imageName || '').trim() || parsed.imageName;
  const imageTag = String(extra.imageTag || '').trim() || parsed.imageTag;

  return {
    detected: {
      name: imageName || file.originalname,
      version: imageTag,
      extension: getExtension(file.originalname),
      coordinates: {
        imageName,
        imageTag,
        sourceTag: parsed.sourceTag || sourceTag,
      },
    },
    missingFields: ['imageName', 'imageTag'].filter((key) => !({
      imageName,
      imageTag,
    })[key]),
    warnings,
  };
}

async function detectArtifact(type, file, extra = {}) {
  switch (type) {
    case 'maven':
      return detectMaven(file);
    case 'npm':
      return detectNpm(file);
    case 'nuget':
      return detectNuget(file);
    case 'helm':
      return detectHelm(file);
    case 'pypi':
      return detectPypi(file);
    case 'docker':
      return detectDocker(file, extra);
    case 'apt':
      return detectSimplePackage(file, 'packageName');
    case 'yum':
      return detectSimplePackage(file, 'packageName');
    case 'raw':
      return {
        detected: {
          name: file.originalname,
          version: '',
          extension: getExtension(file.originalname),
          coordinates: {},
        },
        missingFields: [],
        warnings: [],
      };
    default:
      return {
        detected: {
          name: file.originalname,
          version: '',
          extension: getExtension(file.originalname),
          coordinates: {},
        },
        missingFields: [],
        warnings: [],
      };
  }
}

module.exports = {
  detectArtifact,
};
