import { useState, useCallback, useRef } from 'react';
import { UPLOADERS, checkDuplicate } from '../lib/nexusApi';

const HISTORY_KEY = 'nexus-pusher-history';
const MAX_HISTORY = 500;

// ── Retry configuration ───────────────────────────────────────────────────────
// Max 3 automatic attempts (1 initial + 2 retries) with exponential back-off.
// Delay sequence: 2 s → 4 s → (give up).
// Only transient errors are retried — 4xx responses are permanent failures.
const MAX_AUTO_RETRIES  = 2;           // retries after the first attempt
const BASE_RETRY_DELAY  = 2000;        // ms — doubles each attempt

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
    // HTTP 5xx
    /http 5\d\d/.test(m)
  );
}

let idCounter = 0;
const genId = () => ++idCounter;

function saveToHistory(item) {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const entry = {
      id:         item.id,
      name:       item.name,
      size:       item.size,
      repoType:   item.repoType,
      repoName:   item.repoName,
      status:     item.status,
      statusText: item.statusText,
      nexusUiUrl: item.nexusUiUrl || null,
      directUrl:  item.directUrl  || null,
      timestamp:  Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (_) { /* storage full — silently skip */ }
}

export function useUpload(settings, repoType, repoName, extraFields, toast) {
  const [staged, setStaged] = useState([]);
  const [queue,  setQueue]  = useState([]);
  const processingRef       = useRef(false);
  const toastRef            = useRef(toast);
  toastRef.current = toast;

  const stagedSize    = staged.reduce((a, i) => a + (i.size || 0), 0);
  const totalSize     = queue.reduce((a, i) => a + (i.size || 0), 0);
  const pendingSize   = queue
    .filter(i => i.status === 'pending')
    .reduce((a, i) => a + (i.size || 0), 0);
  const estimatedTime = pendingSize > 0 ? pendingSize / (5 * 1024 * 1024) : 0;

  const updateItem = useCallback((id, patch) =>
    setQueue(q => q.map(i => (i.id === id ? { ...i, ...patch } : i))),
  []);

  const processNext = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    setQueue(currentQueue => {
      const item = currentQueue.find(i => i.status === 'pending');

      if (!item) {
        processingRef.current = false;
        return currentQueue;
      }

      if (!item.settings.nexusUrl) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: 'Nexus URL not set — open Settings' };
        saveToHistory({ ...item, ...patch });
        toastRef.current?.error('Nexus URL not configured', { title: item.name });
        setTimeout(processNext, 0);
        return currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
      }

      if (!item.repoName) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: 'Repository name not set' };
        saveToHistory({ ...item, ...patch });
        toastRef.current?.error('Repository name not set', { title: item.name });
        setTimeout(processNext, 0);
        return currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
      }

      const uploader = UPLOADERS[item.repoType];
      if (!uploader) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: `Unknown repo type: ${item.repoType}` };
        saveToHistory({ ...item, ...patch });
        toastRef.current?.error(`Unknown repo type: ${item.repoType}`, { title: item.name });
        setTimeout(processNext, 0);
        return currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
      }

      // Mark as uploading immediately (optimistic UI)
      setTimeout(async () => {
        // ── Feature 9: Pre-upload duplicate detection ─────────────────────────
        // Only run the check if the item isn't already a confirmed overwrite
        // (i.e. user hasn't explicitly said "push anyway" via retryItem).
        // Skip the check for docker — it has no search-friendly artifact name.
        if (!item.skipDuplicateCheck && item.repoType !== 'docker') {
          try {
            const dupResult = await checkDuplicate({
              nexusUrl: item.settings.nexusUrl,
              username: item.settings.username,
              password: item.settings.password,
              repo:     item.repoName,
              name:     item.name,
            });

            if (dupResult.exists) {
              // Pause and surface a warning — don't auto-push over an existing artifact.
              // The user can hit "Push Anyway" (retryItem with skipDuplicateCheck=true)
              // or remove the item from the queue.
              const existing  = dupResult.components[0];
              const statusText = existing?.version
                ? `Already exists in ${item.repoName} (v${existing.version}) — push anyway to overwrite`
                : `Already exists in ${item.repoName} — push anyway to overwrite`;
              const patch = { status: 'warning', statusText, dupComponents: dupResult.components };
              updateItem(item.id, patch);
              toastRef.current?.warning(`Duplicate detected: ${item.name}`, {
                title: 'Already in Nexus',
                duration: 8000,
              });
              processingRef.current = false;
              processNext(); // continue with remaining queue items
              return;
            }
          } catch (_) {
            // Duplicate check failure is non-fatal — proceed with the upload
          }
        }

        // ── Feature 8: Upload with exponential-backoff auto-retry ─────────────
        const maxAttempts = MAX_AUTO_RETRIES + 1;
        let   attempt     = item.retryCount || 0; // how many auto-retries already done
        let   lastError   = null;

        while (attempt < maxAttempts) {
          if (attempt > 0) {
            // Exponential back-off delay before each retry attempt
            const delayMs = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
            updateItem(item.id, {
              status:     'pending',
              statusText: `Retrying in ${delayMs / 1000}s… (attempt ${attempt + 1}/${maxAttempts})`,
              retryCount: attempt,
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
            // Re-mark as uploading after the delay
            updateItem(item.id, {
              status:     'uploading',
              progress:   0,
              statusText: `Attempt ${attempt + 1} of ${maxAttempts}`,
              retryCount: attempt,
            });
          }

          try {
            const result = await uploader({
              nexusUrl:   item.settings.nexusUrl,
              repo:       item.repoName,
              username:   item.settings.username,
              password:   item.settings.password,
              file:       item.file,
              extra:      item.extraFields,
              onProgress: (pct) => updateItem(item.id, { progress: pct }),
            });

            const nexusUiUrl = result?.nexusUiUrl || null;
            const directUrl  = result?.url         || null;
            const patch = {
              status: 'done', progress: 100, statusText: 'Successful',
              nexusUiUrl, directUrl,
              retryCount: attempt,  // record final attempt count for history
            };
            updateItem(item.id, patch);
            saveToHistory({ ...item, ...patch });

            const retriedLabel = attempt > 0 ? ` (succeeded on attempt ${attempt + 1})` : '';
            toastRef.current?.success(`Pushed to ${item.repoName}${retriedLabel}`, {
              title: item.name,
              ...(nexusUiUrl ? { action: { label: 'View in Nexus', onClick: () => window.open(nexusUiUrl, '_blank') } } : {}),
            });

            lastError = null;
            break; // success — exit the retry loop

          } catch (err) {
            lastError = err;

            // If the error is permanent (e.g. 400 Bad Request, 401, 409 Conflict)
            // don't waste retries — bail immediately.
            if (!isTransientError(err.message)) break;

            attempt++;
          }
        }

        // If we exited the loop with an error, mark as failed
        if (lastError) {
          const exhausted = attempt >= maxAttempts && isTransientError(lastError.message);
          const statusText = exhausted
            ? `Failed after ${maxAttempts} attempt${maxAttempts !== 1 ? 's' : ''}: ${lastError.message}`
            : lastError.message;
          const patch = { status: 'error', statusText, retryCount: attempt };
          updateItem(item.id, patch);
          saveToHistory({ ...item, ...patch });
          toastRef.current?.error(statusText, { title: item.name, duration: 7000 });
        }

        processingRef.current = false;
        processNext();
      }, 0);

      return currentQueue.map(i =>
        i.id === item.id ? { ...i, status: 'uploading', progress: 0, retryCount: i.retryCount || 0 } : i
      );
    });
  }, [updateItem]);

  const stageFiles = useCallback((files) => {
    const newItems = files.map(f => ({
      id:   genId(),
      file: f,
      name: f.name,
      size: f.size,
    }));
    setStaged(s => [...s, ...newItems]);
  }, []);

  const removeStaged = useCallback((id) => {
    setStaged(s => s.filter(i => i.id !== id));
  }, []);

  const cancelStaged = useCallback(() => {
    setStaged([]);
  }, []);

  const pushStaged = useCallback(() => {
    setStaged(currentStaged => {
      if (currentStaged.length === 0) return currentStaged;
      const newItems = currentStaged.map(s => ({
        ...s,
        status:             'pending',
        progress:           0,
        statusText:         'Waiting',
        retryCount:         0,
        skipDuplicateCheck: false,
        repoType,
        repoName,
        settings:    { ...settings },
        extraFields: { ...extraFields },
      }));
      setQueue(q => [...q, ...newItems]);
      setTimeout(processNext, 0);
      toastRef.current?.info(`Queued ${currentStaged.length} file${currentStaged.length !== 1 ? 's' : ''} for upload`);
      return [];
    });
  }, [processNext, repoType, repoName, settings, extraFields]);

  const clearCompleted = useCallback(() => {
    setQueue(q => q.filter(i => i.status !== 'done'));
  }, []);

  // Manual retry — always skips the duplicate check so "Push Anyway" works
  const retryItem = useCallback((id, { skipDuplicateCheck = true } = {}) => {
    setQueue(q => q.map(i =>
      i.id === id
        ? { ...i, status: 'pending', statusText: 'Waiting', progress: 0, retryCount: 0, skipDuplicateCheck }
        : i
    ));
    setTimeout(processNext, 0);
  }, [processNext]);

  const retryAllFailed = useCallback(() => {
    setQueue(q => {
      const failedCount = q.filter(i => i.status === 'error').length;
      if (failedCount === 0) return q;
      toastRef.current?.info(`Retrying ${failedCount} failed file${failedCount !== 1 ? 's' : ''}…`);
      return q.map(i =>
        i.status === 'error'
          ? { ...i, status: 'pending', statusText: 'Waiting', progress: 0, retryCount: 0, skipDuplicateCheck: true }
          : i
      );
    });
    setTimeout(processNext, 0);
  }, [processNext]);

  const reorderQueue = useCallback((fromId, toId) => {
    setQueue(q => {
      if (fromId === toId) return q;
      const fromIdx = q.findIndex(i => i.id === fromId);
      const toIdx   = q.findIndex(i => i.id === toId);
      if (fromIdx === -1 || toIdx === -1) return q;
      if (q[fromIdx].status !== 'pending' || q[toIdx].status !== 'pending') return q;
      const next = [...q];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  return {
    staged, stagedSize, stageFiles, removeStaged, cancelStaged, pushStaged,
    queue, totalSize, estimatedTime, clearCompleted, retryItem, retryAllFailed, reorderQueue,
  };
}
