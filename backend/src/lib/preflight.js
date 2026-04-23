const { buildArtifactPath, detectArtifact } = require('./artifactMetadata');
const {
  checkAssetUrlExists,
  fetchRepositories,
  normalizeBaseUrl,
  searchComponents,
} = require('./nexusClient');

const FORMAT_ALIASES = {
  maven: 'maven2',
};

function getRepoFormat(type) {
  return FORMAT_ALIASES[type] || type;
}

function normalizeRepoList(repos, type) {
  return repos
    .filter((repo) => repo?.name && repo?.type === 'hosted' && repo?.format === getRepoFormat(type))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scoreRepo({ repo, type, defaultRepo, recentRepos = [], favorites = [], detected }) {
  let score = 1;
  const reasonParts = [];
  const repoName = repo.name.toLowerCase();
  const version = String(detected?.version || '').toLowerCase();

  if (repo.name === defaultRepo) {
    score += 4;
    reasonParts.push('default repo');
  }

  const recentIndex = recentRepos.indexOf(repo.name);
  if (recentIndex !== -1) {
    score += Math.max(1, 3 - recentIndex);
    reasonParts.push('recently used');
  }

  if (favorites.includes(repo.name)) {
    score += 3;
    reasonParts.push('favorite');
  }

  if (type === 'maven' && version) {
    const isSnapshot = version.endsWith('-snapshot');
    if (isSnapshot && repoName.includes('snapshot')) {
      score += 3;
      reasonParts.push('snapshot version');
    }
    if (!isSnapshot && (repoName.includes('release') || repoName.includes('releases'))) {
      score += 2;
      reasonParts.push('release version');
    }
  }

  if (type === 'npm') {
    const packageName = String(detected?.coordinates?.packageName || detected?.name || '').toLowerCase();
    const scope = packageName.startsWith('@') ? packageName.split('/')[0].replace('@', '') : '';
    if (scope && repoName.includes(scope)) {
      score += 2;
      reasonParts.push('package scope');
    }
  }

  return {
    ...repo,
    confidence: Number(Math.min(0.99, 0.45 + score / 12).toFixed(2)),
    score,
    reason: reasonParts[0] || 'format match',
  };
}

async function runDuplicateCheck({ nexusUrl, username, password, type, repo, detected, path }) {
  if (!repo) {
    return { exists: false, matches: [], repo: '' };
  }

  try {
    if (type === 'raw' || type === 'yum' || type === 'apt') {
      if (!path) return { exists: false, matches: [], repo };
      const exists = await checkAssetUrlExists({
        url: `${normalizeBaseUrl(nexusUrl)}/repository/${repo}/${path.replace(/^\/+/, '')}`,
        username,
        password,
        signal: AbortSignal.timeout(8000),
      });
      return {
        exists,
        repo,
        matches: exists ? [{ repo, path }] : [],
      };
    }

    const coordinates = detected.coordinates || {};
    const params = { repository: repo };

    if (type === 'maven') {
      if (coordinates.groupId) params.group = coordinates.groupId;
      if (coordinates.artifactId) params.name = coordinates.artifactId;
      if (coordinates.version) params.version = coordinates.version;
    } else if (type === 'npm' || type === 'nuget' || type === 'pypi' || type === 'helm') {
      params.name = coordinates.packageName || coordinates.chartName || detected.name || '';
      if (detected.version) params.version = detected.version;
    } else {
      params.name = detected.name || '';
      if (detected.version) params.version = detected.version;
    }

    const result = await searchComponents({
      nexusUrl,
      username,
      password,
      query: params,
      signal: AbortSignal.timeout(8000),
    });

    const items = (result.items || []).map((item) => ({
      repo: item.repository || repo,
      name: item.name,
      version: item.version,
      format: item.format,
      path: item.assets?.[0]?.path || '',
      downloadUrl: item.assets?.[0]?.downloadUrl || '',
    }));

    return {
      exists: items.length > 0,
      repo,
      matches: items,
    };
  } catch (err) {
    return {
      exists: false,
      repo,
      matches: [],
      warning: err.message,
    };
  }
}

async function buildPreflight({
  type,
  file,
  nexusUrl,
  username,
  password,
  extra = {},
  preferences = {},
  repo: requestedRepo = '',
  defaultRepo = '',
}) {
  const { detected, missingFields, warnings } = await detectArtifact(type, file, extra);
  const path = buildArtifactPath(type, file.originalname, extra, detected);

  let repos = [];
  let repoWarning = '';
  try {
    repos = normalizeRepoList(
      await fetchRepositories({
        nexusUrl,
        username,
        password,
        signal: AbortSignal.timeout(8000),
      }),
      type
    );
  } catch (err) {
    repoWarning = err.message;
  }

  const favorites = preferences?.favoritesByFormat?.[type] || [];
  const recentRepos = preferences?.recentReposByFormat?.[type] || [];
  const scoredRepos = repos
    .map((repo) => scoreRepo({
      repo,
      type,
      defaultRepo,
      recentRepos,
      favorites,
      detected,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const selectedRepo = requestedRepo || scoredRepos[0]?.name || defaultRepo || '';
  const duplicateCheck = await runDuplicateCheck({
    nexusUrl,
    username,
    password,
    type,
    repo: selectedRepo,
    detected,
    path,
  });

  return {
    detected: {
      ...detected,
      path,
    },
    missingFields,
    repoSuggestions: scoredRepos.slice(0, 6).map(({ score, ...repo }) => repo),
    availableRepos: repos,
    duplicateCheck,
    warnings: [
      ...warnings,
      ...(repoWarning ? [`Repository suggestions unavailable: ${repoWarning}`] : []),
    ],
    canUpload: missingFields.length === 0 || type !== 'maven',
    selectedRepo,
  };
}

module.exports = {
  buildPreflight,
  runDuplicateCheck,
};
