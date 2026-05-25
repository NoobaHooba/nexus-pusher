export const OPTIONAL_FIELDS = {
  maven: ['classifier', 'extension'],
  yum: ['directory'],
  swift: ['directory'],
  terraform: ['directory'],
  raw: ['directory'],
};

export const MAX_HISTORY = 500;
export const MAX_RECENT_ACTIVITY = 5;
export const MAX_AUTO_RETRIES = 2;
export const BASE_RETRY_DELAY = 2000;
