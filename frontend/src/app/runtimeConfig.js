import { apiUrl } from '../shared/lib/backendApi';

export const DEFAULT_RUNTIME_CONFIG = {
  nexusUrl: '',
  nexusBrowserUrl: '',
  dockerRegistry: '',
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
