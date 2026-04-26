import { useCallback, useEffect, useRef, useState } from 'react';
import { UPLOADERS, runPreflight } from '../../../shared/lib/nexusApi';
import { rewriteNexusUrl } from '../../../shared/lib/nexusLinks';
import {
  BASE_RETRY_DELAY,
  MAX_AUTO_RETRIES,
  MAX_HISTORY,
  MAX_RECENT_ACTIVITY,
  OPTIONAL_FIELDS,
} from '../constants';
import {
  loadUploadPrefs,
  saveUploadHistory,
  saveUploadPrefs,
} from '../storage';

function isTransientError(message) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('econnrefused') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('fetch') ||
    m.includes('backend') ||
    /http 5\d\d/.test(m)
  );
}

function buildReviewStatus(item) {
  if (item.inspecting) return 'inspecting';
  if (!item.selectedRepo) return 'needs-input';
  if ((item.missingFields || []).length > 0) return 'needs-input';
  return item.duplicateCheck?.exists ? 'warning' : 'ready';
}

function buildEditableFields(repoType, missingFields = []) {
  const keys = new Set([...(missingFields || []), ...(OPTIONAL_FIELDS[repoType] || [])]);
  return [...keys];
}

function mergeRecent(list, value) {
  return [value, ...list.filter((item) => item !== value)].slice(0, 5);
}

function mergeDetectedExtra(repoType, extraFields = {}, detected = {}) {
  if (repoType !== 'maven') return { ...extraFields };
  const coordinates = detected?.coordinates || {};
  return {
    groupId: coordinates.groupId || extraFields.groupId || '',
    artifactId: coordinates.artifactId || extraFields.artifactId || '',
    version: coordinates.version || extraFields.version || '',
    extension: coordinates.extension || extraFields.extension || detected?.extension || '',
    classifier: coordinates.classifier || extraFields.classifier || '',
  };
}

let idCounter = 0;
const genId = () => ++idCounter;

export function useUpload(settings, repoType, repoName, toast) {
  const [staged, setStaged] = useState([]);
  const [queue, setQueue] = useState([]);
  const [prefs, setPrefs] = useState(() => loadUploadPrefs(settings));
  const processingRef = useRef(false);
  const skipPersistPrefsRef = useRef(true);
  const toastRef = useRef(toast);
  const previousRepoType = useRef(repoType);
  toastRef.current = toast;

  useEffect(() => {
    skipPersistPrefsRef.current = true;
    setPrefs(loadUploadPrefs(settings));
  }, [settings?.nexusUrl, settings?.username]);

  useEffect(() => {
    if (skipPersistPrefsRef.current) {
      skipPersistPrefsRef.current = false;
      return;
    }
    saveUploadPrefs(prefs, settings);
  }, [prefs, settings?.nexusUrl, settings?.username]);

  useEffect(() => {
    if (previousRepoType.current !== repoType) {
      previousRepoType.current = repoType;
      setStaged([]);
    }
  }, [repoType]);

  const stagedSize = staged.reduce((acc, item) => acc + (item.size || 0), 0);
  const totalSize = queue.reduce((acc, item) => acc + (item.size || 0), 0);
  const pendingSize = queue
    .filter((item) => item.status === 'pending' || item.status === 'uploading')
    .reduce((acc, item) => acc + (item.size || 0), 0);
  const estimatedTime = pendingSize > 0 ? pendingSize / (5 * 1024 * 1024) : 0;

  const persistSuccessfulContext = useCallback((item) => {
    setPrefs((current) => {
      const next = { ...current };
      next.recentReposByFormat = {
        ...next.recentReposByFormat,
        [item.repoType]: mergeRecent(next.recentReposByFormat[item.repoType] || [], item.repoName),
      };
      next.lastExtraFieldsByFormat = {
        ...next.lastExtraFieldsByFormat,
        [item.repoType]: { ...(item.extraFields || {}) },
      };
      next.recentActivity = [
        {
          id: `${item.repoType}-${item.repoName}-${item.name}-${Date.now()}`,
          repoType: item.repoType,
          repoName: item.repoName,
          fileName: item.name,
          path: item.path || '',
          coordinates: item.coordinates || {},
          extraFields: { ...(item.extraFields || {}) },
          timestamp: Date.now(),
          nexusUiUrl: item.nexusUiUrl || null,
        },
        ...(current.recentActivity || []).filter((entry) => !(entry.repoType === item.repoType && entry.repoName === item.repoName && entry.fileName === item.name)),
      ].slice(0, MAX_RECENT_ACTIVITY);
      if (item.repoType === 'docker' && item.repoName) {
        next.lastDockerRegistry = item.repoName;
      }
      return next;
    });
  }, []);

  const inspectStagedItem = useCallback(async (item, overrides = {}) => {
    const selectedRepo = overrides.selectedRepo ?? item.selectedRepo ?? repoName ?? '';
    const extraFields = { ...(item.extraFields || {}), ...(overrides.extraFields || {}) };

    setStaged((current) => current.map((entry) => (
      entry.id === item.id
        ? { ...entry, inspecting: true, inspectError: '', selectedRepo, extraFields }
        : entry
    )));

    try {
      const response = await runPreflight({
        type: repoType,
        nexusUrl: settings?.nexusUrl,
        repo: selectedRepo,
        username: settings?.username,
        password: settings?.password,
        file: item.file,
        extra: extraFields,
        settings,
        preferences: prefs,
        defaultRepo: repoName || settings?.defaultRepo || '',
      });

      setStaged((current) => current.map((entry) => {
        if (entry.id !== item.id) return entry;
        const mergedExtraFields = mergeDetectedExtra(repoType, extraFields, response.detected);
        const next = {
          ...entry,
          inspecting: false,
          inspectError: '',
          detected: response.detected || {},
          warnings: response.warnings || [],
          missingFields: response.missingFields || [],
          availableRepos: response.availableRepos || [],
          repoSuggestions: response.repoSuggestions || [],
          duplicateCheck: response.duplicateCheck || { exists: false, matches: [] },
          selectedRepo: response.selectedRepo || selectedRepo || '',
          extraFields: mergedExtraFields,
        };
        return { ...next, reviewStatus: buildReviewStatus(next) };
      }));
    } catch (err) {
      setStaged((current) => current.map((entry) => {
        if (entry.id !== item.id) return entry;
        const next = {
          ...entry,
          inspecting: false,
          inspectError: err.message || 'Preflight failed',
          warnings: err.message ? [err.message] : [],
          selectedRepo,
          extraFields,
        };
        return { ...next, reviewStatus: buildReviewStatus(next) };
      }));
    }
  }, [prefs, repoName, repoType, settings]);

  const stageFiles = useCallback((files) => {
    const defaults = prefs.lastExtraFieldsByFormat[repoType] || {};
    const newItems = files.map((file) => ({
      id: genId(),
      file,
      name: file.name,
      size: file.size,
      repoType,
      selectedRepo: repoName || settings?.defaultRepo || '',
      extraFields: { ...defaults },
      missingFields: [],
      warnings: [],
      repoSuggestions: [],
      availableRepos: [],
      duplicateCheck: { exists: false, matches: [] },
      inspecting: true,
      inspectError: '',
      reviewStatus: 'inspecting',
    }));

    setStaged((current) => [...current, ...newItems]);
    newItems.forEach((item) => { inspectStagedItem(item); });
  }, [inspectStagedItem, prefs.lastExtraFieldsByFormat, repoName, repoType, settings?.defaultRepo]);

  const removeStaged = useCallback((id) => {
    setStaged((current) => current.filter((item) => item.id !== id));
  }, []);

  const cancelStaged = useCallback(() => {
    setStaged([]);
  }, []);

  const updateStagedRepo = useCallback((id, selectedRepo) => {
    const item = staged.find((entry) => entry.id === id);
    if (!item) return;
    inspectStagedItem({ ...item, selectedRepo }, { selectedRepo });
  }, [inspectStagedItem, staged]);

  const updateStagedExtraFields = useCallback((id, nextExtraFields) => {
    const item = staged.find((entry) => entry.id === id);
    if (!item) return;
    inspectStagedItem({ ...item, extraFields: nextExtraFields }, { extraFields: nextExtraFields });
  }, [inspectStagedItem, staged]);

  useEffect(() => {
    if (!repoName || staged.length === 0) return;
    staged.forEach((item) => {
      if (item.inspecting || item.selectedRepo === repoName) return;
      inspectStagedItem({ ...item, selectedRepo: repoName }, { selectedRepo: repoName });
    });
  }, [inspectStagedItem, repoName]); // intentionally not depending on staged to avoid loops

  const applyRepoToAll = useCallback((selectedRepo) => {
    staged.forEach((item) => {
      if (item.selectedRepo === selectedRepo) return;
      inspectStagedItem({ ...item, selectedRepo }, { selectedRepo });
    });
  }, [inspectStagedItem, staged]);

  const toggleFavoriteRepo = useCallback((format, selectedRepo) => {
    if (!selectedRepo) return;
    setPrefs((current) => {
      const currentList = current.favoritesByFormat[format] || [];
      const exists = currentList.includes(selectedRepo);
      return {
        ...current,
        favoritesByFormat: {
          ...current.favoritesByFormat,
          [format]: exists
            ? currentList.filter((name) => name !== selectedRepo)
            : [...currentList, selectedRepo].sort(),
        },
      };
    });
  }, []);

  const reuseRecentActivity = useCallback((activity) => {
    if (!activity) return;
    setPrefs((current) => ({
      ...current,
      lastExtraFieldsByFormat: {
        ...current.lastExtraFieldsByFormat,
        [activity.repoType]: { ...(activity.extraFields || {}) },
      },
    }));
  }, []);

  const updateQueueItem = useCallback((id, patch) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processNext = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    setQueue((currentQueue) => {
      const item = currentQueue.find((entry) => entry.status === 'pending');
      if (!item) {
        processingRef.current = false;
        return currentQueue;
      }

      const uploader = UPLOADERS[item.repoType];
      if (!uploader) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: `Unknown repo type: ${item.repoType}` };
        saveUploadHistory({ ...item, ...patch }, MAX_HISTORY, item.settings);
        return currentQueue.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry));
      }

      setTimeout(async () => {
        const maxAttempts = MAX_AUTO_RETRIES + 1;
        let attempt = item.retryCount || 0;
        let lastError = null;

        while (attempt < maxAttempts) {
          if (attempt > 0) {
            const delayMs = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
            updateQueueItem(item.id, {
              status: 'pending',
              statusText: `Retrying in ${delayMs / 1000}s… (attempt ${attempt + 1}/${maxAttempts})`,
              retryCount: attempt,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          updateQueueItem(item.id, {
            status: 'uploading',
            progress: 0,
            statusText: `Attempt ${attempt + 1} of ${maxAttempts}`,
            retryCount: attempt,
          });

          try {
            const result = await uploader({
              nexusUrl: item.settings.nexusUrl,
              repo: item.repoName,
              username: item.settings.username,
              password: item.settings.password,
              file: item.file,
              extra: mergeDetectedExtra(item.repoType, item.extraFields, { coordinates: item.coordinates }),
              settings: item.settings,
              onProgress: (pct) => updateQueueItem(item.id, { progress: pct }),
            });

            const patch = {
              status: 'done',
              progress: 100,
              statusText: result?.path || 'Successful',
              retryCount: attempt,
              nexusUiUrl: result?.nexusUiUrl || null,
              directUrl: result?.downloadUrl || result?.url || null,
              path: result?.path || '',
              coordinates: result?.coordinates || item.coordinates || {},
            };
            updateQueueItem(item.id, patch);
            saveUploadHistory({ ...item, ...patch }, MAX_HISTORY, item.settings);
            persistSuccessfulContext({ ...item, ...patch });

            toastRef.current?.success(`Pushed to ${item.repoName}${attempt > 0 ? ` on attempt ${attempt + 1}` : ''}`, {
              title: item.name,
              ...(patch.nexusUiUrl
                ? { action: { label: 'Open in Nexus', onClick: () => window.open(rewriteNexusUrl(item.settings, patch.nexusUiUrl), '_blank') } }
                : {}),
            });

            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            if (!isTransientError(err.message)) break;
            attempt++;
          }
        }

        if (lastError) {
          const exhausted = attempt >= maxAttempts && isTransientError(lastError.message);
          const patch = {
            status: 'error',
            statusText: exhausted
              ? `Failed after ${maxAttempts} attempts: ${lastError.message}`
              : lastError.message,
            retryCount: attempt,
          };
          updateQueueItem(item.id, patch);
          saveUploadHistory({ ...item, ...patch }, MAX_HISTORY, item.settings);
          toastRef.current?.error(patch.statusText, { title: item.name, duration: 7000 });
        }

        processingRef.current = false;
        processNext();
      }, 0);

      return currentQueue.map((entry) => (
        entry.id === item.id
          ? { ...entry, status: 'uploading', progress: 0, retryCount: entry.retryCount || 0 }
          : entry
      ));
    });
  }, [persistSuccessfulContext, updateQueueItem]);

  const pushStaged = useCallback(() => {
    setStaged((current) => {
      const readyItems = current.filter((item) => ['ready', 'warning'].includes(item.reviewStatus));
      const blockedItems = current.filter((item) => !['ready', 'warning'].includes(item.reviewStatus));

      if (readyItems.length === 0) {
        toastRef.current?.warning('No reviewed files are ready for upload');
        return current;
      }

      const newQueueItems = readyItems.map((item) => ({
        ...item,
        status: 'pending',
        progress: 0,
        statusText: item.duplicateCheck?.exists ? 'Uploading with existing match in Nexus' : 'Waiting',
        retryCount: 0,
        repoName: item.selectedRepo,
        settings: { ...settings },
        coordinates: item.detected?.coordinates || {},
        extraFields: mergeDetectedExtra(item.repoType, item.extraFields, item.detected),
        path: item.detected?.path || '',
      }));

      setQueue((existing) => [...existing, ...newQueueItems]);
      setTimeout(processNext, 0);
      toastRef.current?.info(`Queued ${readyItems.length} reviewed file${readyItems.length !== 1 ? 's' : ''} for upload`);
      return blockedItems;
    });
  }, [processNext, settings]);

  const clearCompleted = useCallback(() => {
    setQueue((current) => current.filter((item) => item.status !== 'done'));
  }, []);

  const retryItem = useCallback((id) => {
    setQueue((current) => current.map((item) => (
      item.id === id
        ? { ...item, status: 'pending', statusText: 'Waiting', progress: 0, retryCount: 0 }
        : item
    )));
    setTimeout(processNext, 0);
  }, [processNext]);

  const retryAllFailed = useCallback(() => {
    setQueue((current) => {
      const failedCount = current.filter((item) => item.status === 'error').length;
      if (failedCount === 0) return current;
      toastRef.current?.info(`Retrying ${failedCount} failed file${failedCount !== 1 ? 's' : ''}…`);
      return current.map((item) => (
        item.status === 'error'
          ? { ...item, status: 'pending', statusText: 'Waiting', progress: 0, retryCount: 0 }
          : item
      ));
    });
    setTimeout(processNext, 0);
  }, [processNext]);

  const reorderQueue = useCallback((fromId, toId) => {
    setQueue((current) => {
      if (fromId === toId) return current;
      const fromIdx = current.findIndex((item) => item.id === fromId);
      const toIdx = current.findIndex((item) => item.id === toId);
      if (fromIdx === -1 || toIdx === -1) return current;
      if (current[fromIdx].status !== 'pending' || current[toIdx].status !== 'pending') return current;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  return {
    staged,
    stagedSize,
    stageFiles,
    removeStaged,
    cancelStaged,
    pushStaged,
    updateStagedRepo,
    updateStagedExtraFields,
    applyRepoToAll,
    queue,
    totalSize,
    estimatedTime,
    clearCompleted,
    retryItem,
    retryAllFailed,
    reorderQueue,
    preferences: prefs,
    toggleFavoriteRepo,
    recentActivity: prefs.recentActivity || [],
    reuseRecentActivity,
    buildEditableFields,
  };
}
