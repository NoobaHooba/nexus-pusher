import { apiUrl } from '../shared/lib/backendApi';

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
  try {
    const res = await fetch(apiUrl({}, '/api/runtime-config'));
    const data = await res.json().catch(() => ({}));
    return { ...DEFAULT_RUNTIME_CONFIG, ...(data || {}) };
  } catch {
    return { ...DEFAULT_RUNTIME_CONFIG };
  }
}
