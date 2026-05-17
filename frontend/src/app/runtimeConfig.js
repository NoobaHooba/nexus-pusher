import { apiUrl } from '../shared/lib/backendApi';
import { createHttpError, createNetworkError } from '../shared/lib/errorMessages';

export const DEFAULT_RUNTIME_CONFIG = {
  nexusUrl: '',
  nexusBrowserUrl: '',
  dockerRegistry: '',
  dockerUploadUrl: '',
  uploadMaxBytes: 1024 ** 3,
  preflightMaxBytes: 512 * 1024 ** 2,
  tempUploadMaxAgeMs: 24 * 60 * 60 * 1000,
};

export async function fetchRuntimeConfig() {
  let res;
  try {
    res = await fetch(apiUrl({}, '/api/runtime-config'));
  } catch (_) {
    throw createNetworkError({ action: 'loading deployment settings' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw createHttpError(res.status, data.error, { action: 'loading deployment settings' });
  return { ...DEFAULT_RUNTIME_CONFIG, ...(data || {}) };
}
