import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

let idCounter = 0;
const genId = () => ++idCounter;

export function useUpload(settings, repoType, extraFields) {
  const [queue, setQueue] = useState([]);
  const activeRef = useRef(false);

  const totalSize = queue.reduce((acc, i) => acc + (i.size || 0), 0);
  // Assume ~5 MB/s upload speed for estimation
  const pendingSize = queue.filter(i => i.status === 'pending').reduce((acc, i) => acc + (i.size || 0), 0);
  const estimatedTime = pendingSize > 0 ? pendingSize / (5 * 1024 * 1024) : 0;

  const updateItem = (id, patch) =>
    setQueue(q => q.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const processQueue = useCallback(async (newQueue) => {
    if (activeRef.current) return;
    activeRef.current = true;

    let current = newQueue;
    for (const item of current) {
      if (item.status !== 'pending') continue;

      updateItem(item.id, { status: 'uploading', progress: 0 });

      const formData = new FormData();
      formData.append('files', item.file);
      formData.append('nexusUrl', settings.nexusUrl || '');
      formData.append('repo', settings.repo || '');
      formData.append('username', settings.username || '');
      formData.append('password', settings.password || '');
      Object.entries(extraFields || {}).forEach(([k, v]) => formData.append(k, v));

      try {
        await axios.post(`/api/upload/${repoType}`, formData, {
          onUploadProgress: (e) => {
            if (e.total) {
              updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
            }
          },
        });
        updateItem(item.id, { status: 'done', progress: 100, statusText: 'Successful' });
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        updateItem(item.id, { status: 'error', statusText: msg });
      }
    }

    activeRef.current = false;
  }, [settings, repoType, extraFields]);

  const addFiles = useCallback((files) => {
    const newItems = files.map(f => ({
      id: genId(),
      file: f,
      name: f.name,
      size: f.size,
      status: 'pending',
      progress: 0,
      statusText: 'Waiting',
    }));
    setQueue(q => {
      const updated = [...q, ...newItems];
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  }, [processQueue]);

  const clearCompleted = useCallback(() => {
    setQueue(q => q.filter(i => i.status !== 'done'));
  }, []);

  const retryItem = useCallback((id) => {
    setQueue(q => {
      const updated = q.map(i => i.id === id ? { ...i, status: 'pending', statusText: 'Waiting', progress: 0 } : i);
      setTimeout(() => processQueue(updated), 0);
      return updated;
    });
  }, [processQueue]);

  return { queue, addFiles, clearCompleted, retryItem, totalSize, estimatedTime };
}
