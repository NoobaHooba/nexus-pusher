import { useState, useCallback, useRef } from 'react';
import { UPLOADERS } from '../lib/nexusApi';

const HISTORY_KEY = 'nexus-pusher-history';
const MAX_HISTORY = 500;

let idCounter = 0;
const genId = () => ++idCounter;

function saveToHistory(item) {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const entry = {
      id:          item.id,
      name:        item.name,
      size:        item.size,
      repoType:    item.repoType,
      repoName:    item.repoName,
      status:      item.status,
      statusText:  item.statusText,
      nexusUiUrl:  item.nexusUiUrl || null,
      directUrl:   item.directUrl || null,
      timestamp:   Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (_) { /* storage full — silently skip */ }
}

export function useUpload(settings, repoType, repoName, extraFields) {
  const [queue, setQueue] = useState([]);
  const processingRef = useRef(false);

  const totalSize = queue.reduce((acc, i) => acc + (i.size || 0), 0);
  const pendingSize = queue
    .filter(i => i.status === 'pending')
    .reduce((acc, i) => acc + (i.size || 0), 0);
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
        const next = currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
        setTimeout(processNext, 0);
        return next;
      }

      if (!item.repoName) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: 'Repository name not set — enter it below the type selector' };
        saveToHistory({ ...item, ...patch });
        const next = currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
        setTimeout(processNext, 0);
        return next;
      }

      const uploader = UPLOADERS[item.repoType];
      if (!uploader) {
        processingRef.current = false;
        const patch = { status: 'error', statusText: `Unknown repo type: ${item.repoType}` };
        saveToHistory({ ...item, ...patch });
        const next = currentQueue.map(i => i.id === item.id ? { ...i, ...patch } : i);
        setTimeout(processNext, 0);
        return next;
      }

      setTimeout(async () => {
        try {
          const result = await uploader({
            nexusUrl:  item.settings.nexusUrl,
            repo:      item.repoName,
            username:  item.settings.username,
            password:  item.settings.password,
            file:      item.file,
            extra:     item.extraFields,
            onProgress: (pct) => updateItem(item.id, { progress: pct }),
          });
          // result may contain { nexusUiUrl, url } from the backend
          const nexusUiUrl = result?.nexusUiUrl || null;
          const directUrl  = result?.url || null;
          const patch = { status: 'done', progress: 100, statusText: 'Successful', nexusUiUrl, directUrl };
          updateItem(item.id, patch);
          saveToHistory({ ...item, ...patch });
        } catch (err) {
          const patch = { status: 'error', statusText: err.message };
          updateItem(item.id, patch);
          saveToHistory({ ...item, ...patch });
        } finally {
          processingRef.current = false;
          processNext();
        }
      }, 0);

      return currentQueue.map(i =>
        i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i
      );
    });
  }, [updateItem]);

  const addFiles = useCallback((files) => {
    const newItems = files.map(f => ({
      id:          genId(),
      file:        f,
      name:        f.name,
      size:        f.size,
      status:      'pending',
      progress:    0,
      statusText:  'Waiting',
      repoType,
      repoName,
      settings:    { ...settings },
      extraFields: { ...extraFields },
    }));
    setQueue(q => [...q, ...newItems]);
    setTimeout(processNext, 0);
  }, [processNext, repoType, repoName, settings, extraFields]);

  const clearCompleted = useCallback(() => {
    setQueue(q => q.filter(i => i.status !== 'done'));
  }, []);

  const retryItem = useCallback((id) => {
    setQueue(q => q.map(i =>
      i.id === id ? { ...i, status: 'pending', statusText: 'Waiting', progress: 0 } : i
    ));
    setTimeout(processNext, 0);
  }, [processNext]);

  return { queue, addFiles, clearCompleted, retryItem, totalSize, estimatedTime };
}
