import { useState, useCallback, useRef } from 'react';
import { UPLOADERS } from '../lib/nexusApi';

let idCounter = 0;
const genId = () => ++idCounter;

export function useUpload(settings, repoType, repoName, extraFields) {
  const [queue, setQueue] = useState([]);
  const processingRef = useRef(false);

  const totalSize = queue.reduce((acc, i) => acc + (i.size || 0), 0);
  const pendingSize = queue
    .filter(i => i.status === 'pending')
    .reduce((acc, i) => acc + (i.size || 0), 0);
  const estimatedTime = pendingSize > 0 ? pendingSize / (5 * 1024 * 1024) : 0;

  const updateItem = (id, patch) =>
    setQueue(q => q.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const processQueue = useCallback(async (currentQueue) => {
    if (processingRef.current) return;
    processingRef.current = true;

    for (const item of currentQueue) {
      if (item.status !== 'pending') continue;

      // Guard: require nexusUrl and repoName before trying
      if (!item.settings.nexusUrl) {
        updateItem(item.id, { status: 'error', statusText: 'Nexus URL not set — open Settings' });
        continue;
      }
      if (!item.repoName) {
        updateItem(item.id, { status: 'error', statusText: 'Repository name not set — enter it below the type selector' });
        continue;
      }

      updateItem(item.id, { status: 'uploading', progress: 0 });

      const uploader = UPLOADERS[item.repoType];
      if (!uploader) {
        updateItem(item.id, { status: 'error', statusText: `Unknown repo type: ${item.repoType}` });
        continue;
      }

      try {
        await uploader({
          nexusUrl: item.settings.nexusUrl,
          repo: item.repoName,
          username: item.settings.username,
          password: item.settings.password,
          file: item.file,
          extra: item.extraFields,
          onProgress: (pct) => updateItem(item.id, { progress: pct }),
        });
        updateItem(item.id, { status: 'done', progress: 100, statusText: 'Successful' });
      } catch (err) {
        updateItem(item.id, { status: 'error', statusText: err.message });
      }
    }

    processingRef.current = false;
  }, []);

  const addFiles = useCallback((files) => {
    const newItems = files.map(f => ({
      id: genId(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
      progress: 0,
      statusText: 'Waiting',
      repoType,
      repoName,
      settings: { ...settings },
      extraFields: { ...extraFields },
    }));
    setQueue(q => {
      const updated = [...q, ...newItems];
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  }, [processQueue, repoType, repoName, settings, extraFields]);

  const clearCompleted = useCallback(() => {
    setQueue(q => q.filter(i => i.status !== 'done'));
  }, []);

  const retryItem = useCallback((id) => {
    setQueue(q => {
      const updated = q.map(i =>
        i.id === id ? { ...i, status: 'pending', statusText: 'Waiting', progress: 0 } : i
      );
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  }, [processQueue]);

  return { queue, addFiles, clearCompleted, retryItem, totalSize, estimatedTime };
}
