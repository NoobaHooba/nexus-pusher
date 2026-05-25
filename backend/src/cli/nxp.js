#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { buildArtifactPath, normalizeArtifactPath } = require('../shared/artifacts/paths');
const { detectArtifact } = require('../shared/artifacts/metadata');
const { deriveUserId } = require('../shared/auth/userContext');
const { fetchRepositories } = require('../shared/nexus/client');
const { buildPreflight, getRepoFormat, normalizeRepoList } = require('../features/preflight/service');
const { runDuplicateCheck } = require('../features/preflight/service');
const { uploadArtifacts, buildResultCoordinates, buildUploadExtra } = require('../features/upload/service');
const { isSupportedUploadType } = require('../features/upload/uploaders');
const {
  getConfigPath,
  loadConfig,
  resolveRuntimeConfig,
  saveConfig,
  setConfigValue,
  unsetConfigValue,
} = require('./config');
const {
  renderPreflight,
  renderUploadPreflight,
  renderUploadResults,
  writeError,
  writeJson,
} = require('./output');

const EXIT = {
  OK: 0,
  VALIDATION: 1,
  UPLOAD_FAILURE: 2,
  DUPLICATE: 3,
  PARTIAL: 4,
  INTERRUPTED: 130,
};

function createCliError(message, exitCode = EXIT.VALIDATION) {
  const err = new Error(message);
  err.exitCode = exitCode;
  return err;
}

function readPasswordFromStdin() {
  const value = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!value) {
    throw createCliError('--password-stdin was provided but stdin was empty');
  }
  return value;
}

function toCamelOptions(options) {
  return {
    ...options,
    nexusUrl: options.nexusUrl,
    groupId: options.groupId,
    artifactId: options.artifactId,
    sourceTag: options.sourceTag,
  };
}

function buildExtra(type, options, runtime) {
  const extra = {};
  for (const key of ['groupId', 'artifactId', 'version', 'classifier', 'extension', 'directory']) {
    if (options[key]) extra[key] = options[key];
  }
  if (type === 'docker') {
    const registry = options.registry || runtime.dockerRegistry;
    if (!registry) {
      throw createCliError('Docker registry is required. Use --registry, NXP_DOCKER_REGISTRY, nxp config set docker-registry, or DOCKER_REGISTRY.');
    }
    extra.registry = registry;
    extra.registryUrl = registry;
    if (options.image) extra.imageName = options.image;
    if (options.tag || options.version) extra.imageTag = options.tag || options.version;
    if (options.sourceTag) extra.sourceTag = options.sourceTag;
  }
  return extra;
}

function validateType(type) {
  if (!type) throw createCliError('Repository type is required');
  if (!isSupportedUploadType(type)) throw createCliError(`Unsupported repository type: ${type}`);
}

function resolveType(positionalType, options) {
  return options.type || positionalType || '';
}

function readCliConfig(json) {
  try {
    return loadConfig();
  } catch (err) {
    err.exitCode = EXIT.VALIDATION;
    if (json) err.json = true;
    throw err;
  }
}

function localFileFromPath(filePath) {
  const resolved = path.resolve(filePath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (err) {
    throw createCliError(`File not found: ${filePath}`);
  }
  if (!stat.isFile()) {
    throw createCliError(`Path is not a file: ${filePath}`);
  }
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
  } catch (_) {
    throw createCliError(`File is not readable: ${filePath}`);
  }
  return {
    path: resolved,
    originalname: path.basename(filePath),
    size: stat.size,
  };
}

async function buildLocalPreflight({ type, file, nexusUrl, username, password, repo, extra }) {
  const detectedResult = await detectArtifact(type, file, extra);
  const coordinates = buildResultCoordinates(type, detectedResult.detected, extra);
  const uploadExtra = buildUploadExtra(type, detectedResult.detected, extra);
  const artifactPath = normalizeArtifactPath(type, buildArtifactPath(type, file.originalname, uploadExtra, {
    ...detectedResult.detected,
    coordinates,
  }), {
    name: detectedResult.detected.name,
    version: detectedResult.detected.version,
    coordinates,
  });
  const duplicateCheck = nexusUrl && repo
    ? await runDuplicateCheck({
        nexusUrl,
        username,
        password,
        type,
        repo,
        detected: { ...detectedResult.detected, coordinates },
        path: artifactPath,
      })
    : null;

  return {
    type,
    file: file.originalname,
    repo,
    detected: {
      ...detectedResult.detected,
      coordinates,
      path: artifactPath,
    },
    missingFields: detectedResult.missingFields || [],
    repoSuggestions: [],
    availableRepos: [],
    duplicateCheck,
    warnings: detectedResult.warnings || [],
    selectedRepo: repo,
    canUpload: (detectedResult.missingFields || []).length === 0 || type !== 'maven',
  };
}

async function runPreflightForFile({ type, file, runtime, extra, defaultRepo = '' }) {
  if (runtime.nexusUrl) {
    const result = await buildPreflight({
      type,
      file,
      nexusUrl: runtime.nexusUrl,
      username: runtime.username,
      password: runtime.password,
      extra,
      repo: runtime.repo,
      defaultRepo,
    });
    return {
      ...result,
      type,
      file: file.originalname,
      repo: runtime.repo || result.selectedRepo,
    };
  }
  return buildLocalPreflight({
    type,
    file,
    nexusUrl: runtime.nexusUrl,
    username: runtime.username,
    password: runtime.password,
    repo: runtime.repo,
    extra,
  });
}

function getUploadExitCode(results) {
  const successes = results.filter((result) => result.status === 'success').length;
  const errors = results.filter((result) => result.status === 'error').length;
  if (errors > 0 && successes > 0) return EXIT.PARTIAL;
  if (errors > 0) return EXIT.UPLOAD_FAILURE;
  return EXIT.OK;
}

async function handleUpload(positionalType, files, rawOptions) {
  const options = toCamelOptions(rawOptions);
  const type = resolveType(positionalType, options);
  const fileArgs = options.type && positionalType ? [positionalType, ...(files || [])] : files;
  validateType(type);
  const config = readCliConfig(options.json);
  if (options.passwordStdin) options.password = readPasswordFromStdin();
  const runtime = resolveRuntimeConfig({ options, type, config });
  if (!runtime.nexusUrl && !options.dryRun) throw createCliError('Nexus URL is required. Use --nexus-url, NXP_NEXUS_URL, or nxp config set nexus-url.');
  if (!runtime.repo) throw createCliError('Repository name is required. Use --repo, NXP_REPO, or nxp config set repo.<type>.');
  if (!Array.isArray(fileArgs) || fileArgs.length === 0) throw createCliError('At least one file is required');

  const extra = buildExtra(type, options, runtime);
  const localFiles = fileArgs.map(localFileFromPath);
  const preflights = [];

  if (!options.skipPreflight || options.dryRun) {
    for (const file of localFiles) {
      const preflight = await runPreflightForFile({ type, file, runtime, extra });
      preflights.push(preflight);
      renderUploadPreflight(preflight, { json: options.json });
      if (preflight.duplicateCheck?.exists && options.failOnDuplicate) {
        const payload = { error: 'Duplicate artifact found', preflight };
        if (options.json) writeJson(payload);
        else process.stderr.write('Error: duplicate artifact found\n');
        process.exitCode = EXIT.DUPLICATE;
        return;
      }
    }
  }

  if (options.dryRun) {
    renderUploadResults({ preflights, results: [] }, { json: options.json, dryRun: true });
    process.exitCode = EXIT.OK;
    return;
  }

  const payload = await uploadArtifacts({
    type,
    files: localFiles,
    nexusUrl: runtime.nexusUrl,
    repo: runtime.repo,
    username: runtime.username,
    password: runtime.password,
    extra,
    userContext: {
      username: runtime.username,
      nexusUrl: runtime.nexusUrl,
      userId: deriveUserId({ username: runtime.username, nexusUrl: runtime.nexusUrl }),
    },
    recordHistory: options.history !== false,
    unlinkFiles: false,
  });

  renderUploadResults(payload, { json: options.json });
  process.exitCode = getUploadExitCode(payload.results);
}

async function handlePreflight(type, filePath, rawOptions) {
  const options = toCamelOptions(rawOptions);
  validateType(type);
  const config = readCliConfig(options.json);
  if (options.passwordStdin) options.password = readPasswordFromStdin();
  const runtime = resolveRuntimeConfig({ options, type, config });
  const extra = buildExtra(type, options, runtime);
  const file = localFileFromPath(filePath);
  const result = await runPreflightForFile({ type, file, runtime, extra });
  renderPreflight(result, { json: options.json });
}

async function handleRepos(rawOptions) {
  const options = toCamelOptions(rawOptions);
  const config = readCliConfig(options.json);
  if (options.passwordStdin) options.password = readPasswordFromStdin();
  const runtime = resolveRuntimeConfig({ options, type: options.type || '', config });
  if (!runtime.nexusUrl) throw createCliError('Nexus URL is required. Use --nexus-url, NXP_NEXUS_URL, or nxp config set nexus-url.');
  const repos = await fetchRepositories({
    nexusUrl: runtime.nexusUrl,
    username: runtime.username,
    password: runtime.password,
  });
  const filtered = options.type
    ? normalizeRepoList(repos, options.type)
    : repos.filter((repo) => repo?.name && repo?.type === 'hosted').sort((a, b) => a.name.localeCompare(b.name));
  if (options.json) {
    writeJson({ repositories: filtered });
    return;
  }
  for (const repo of filtered) {
    process.stdout.write(`${repo.name}\t${repo.format || getRepoFormat(options.type || '')}\t${repo.type}\n`);
  }
}

function handleConfigGet(options) {
  const config = readCliConfig(options.json);
  if (options.json) writeJson({ path: getConfigPath(), config });
  else {
    process.stdout.write(`Path: ${getConfigPath()}\n`);
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  }
}

function handleConfigSet(key, value, options) {
  const config = readCliConfig(options.json);
  const next = setConfigValue(config, key, value);
  const filePath = saveConfig(next);
  if (options.json) writeJson({ path: filePath, config: next });
  else process.stdout.write(`Updated ${filePath}\n`);
}

function handleConfigUnset(key, options) {
  const config = readCliConfig(options.json);
  const next = unsetConfigValue(config, key);
  const filePath = saveConfig(next);
  if (options.json) writeJson({ path: filePath, config: next });
  else process.stdout.write(`Updated ${filePath}\n`);
}

function commonOptions(command) {
  return command
    .option('--nexus-url <url>', 'Nexus base URL')
    .option('--repo <name>', 'Nexus repository name')
    .option('--username <name>', 'Nexus username')
    .option('--password <password>', 'Nexus password')
    .option('--password-stdin', 'Read Nexus password from stdin')
    .option('--json', 'Emit JSON output');
}

function uploadOptions(command) {
  return commonOptions(command)
    .option('--type <type>', 'Repository type, alternative to positional type')
    .option('--group-id <value>', 'Maven groupId')
    .option('--artifact-id <value>', 'Maven artifactId')
    .option('--version <value>', 'Maven version or Docker tag fallback')
    .option('--classifier <value>', 'Maven classifier')
    .option('--extension <value>', 'Maven extension')
    .option('--directory <path>', 'Directory for raw/yum/swift/terraform uploads')
    .option('--registry <host-or-url>', 'Docker registry host or URL')
    .option('--image <name>', 'Docker image name')
    .option('--tag <tag>', 'Docker image tag')
    .option('--source-tag <name:tag>', 'Docker archive source tag')
    .option('--dry-run', 'Inspect without uploading')
    .option('--no-history', 'Do not write upload history')
    .option('--fail-on-duplicate', 'Exit before upload when preflight finds a duplicate')
    .option('--skip-preflight', 'Skip preflight before upload');
}

function buildProgram() {
  const program = new Command();
  program
    .name('nxp')
    .description('Upload artifacts to Sonatype Nexus from the terminal')
    .version('1.0.0');

  uploadOptions(program.command('upload [type] [files...]')
    .description('Upload one or more artifacts'))
    .action((type, files, options) => runAction(() => handleUpload(type, files, options), options));

  uploadOptions(program.command('preflight <type> <file>')
    .description('Inspect an artifact without uploading'))
    .action((type, file, options) => runAction(() => handlePreflight(type, file, options), options));

  commonOptions(program.command('repos')
    .description('List hosted Nexus repositories'))
    .option('--type <type>', 'Filter by repository format')
    .action((options) => runAction(() => handleRepos(options), options));

  const config = program.command('config').description('Manage nxp config');
  config.command('get')
    .option('--json', 'Emit JSON output')
    .action((options) => runAction(() => handleConfigGet(options), options));
  config.command('set <key> <value>')
    .option('--json', 'Emit JSON output')
    .action((key, value, options) => runAction(() => handleConfigSet(key, value, options), options));
  config.command('unset <key>')
    .option('--json', 'Emit JSON output')
    .action((key, options) => runAction(() => handleConfigUnset(key, options), options));

  return program;
}

async function runAction(fn, options = {}) {
  try {
    await fn();
  } catch (err) {
    writeError(err, { json: options.json || err.json });
    process.exitCode = err.exitCode || EXIT.VALIDATION;
  }
}

process.on('SIGINT', () => {
  process.exitCode = EXIT.INTERRUPTED;
  process.exit();
});

if (require.main === module) {
  buildProgram().parseAsync(process.argv);
}

module.exports = {
  buildProgram,
  buildExtra,
  EXIT,
};
