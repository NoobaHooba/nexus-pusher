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

  const updateItem = useCallback((id, patch) =>
    setQueue(q => q.map(i => (i.id === id ? { ...i, ...patch } : i))),
  []);

  // processNext picks the first pending item from the latest queue state,
  // processes it, then schedules itself again. The ref only prevents two
  // concurrent calls from both thinking they should start — it is ALWAYS
  // cleared in a finally block so it can never get permanently stuck.
  const processNext = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    // Read the latest queue from state to find the next pending item
    setQueue(currentQueue => {
      const item = currentQueue.find(i => i.status === 'pending');

      if (!item) {
        // Nothing left to do
        processingRef.current = false;
        return currentQueue;
      }

      // Validate before uploading — fail fast with a clear message
      if (!item.settings.nexusUrl) {
        processingRef.current = false;
        // Mark this item as error, then immediately schedule next
        const next = currentQueue.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', statusText: 'Nexus URL not set — open Settings' }
            : i
        );
        setTimeout(processNext, 0);
        return next;
      }

      if (!item.repoName) {
        processingRef.current = false;
        const next = currentQueue.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', statusText: 'Repository name not set — enter it below the type selector' }
            : i
        );
        setTimeout(processNext, 0);
        return next;
      }

      const uploader = UPLOADERS[item.repoType];
      if (!uploader) {
        processingRef.current = false;
        const next = currentQueue.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', statusText: `Unknown repo type: ${item.repoType}` }
            : i
        );
        setTimeout(processNext, 0);
        return next;
      }

      // Mark as uploading, then kick off the async work outside setQueue
      setTimeout(async () => {
        try {
          await uploader({
            nexusUrl:  item.settings.nexusUrl,
            repo:      item.repoName,
            username:  item.settings.username,
            password:  item.settings.password,
            file:      item.file,
            extra:     item.extraFields,
            onProgress: (pct) => updateItem(item.id, { progress: pct }),
          });
          updateItem(item.id, { status: 'done', progress: 100, statusText: 'Successful' });
        } catch (err) {
          updateItem(item.id, { status: 'error', statusText: err.message });
        } finally {
          // Always release the lock and schedule the next item
          processingRef.current = false;
          processNext();
        }
      }, 0);

      // Mark the item as uploading in state synchronously
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
