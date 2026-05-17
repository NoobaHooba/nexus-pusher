export const INPUT_LIMITS = {
  username: 128,
  password: 512,
  repository: 160,
  search: 240,
  packageField: 160,
  path: 512,
  version: 160,
  extension: 32,
  classifier: 160,
  directory: 512,
  number: 20,
};

const DANGEROUS_CHARS = /[<>"'`]/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function sanitizeText(value, maxLength = INPUT_LIMITS.search) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(DANGEROUS_CHARS, '')
    .slice(0, maxLength);
}

export function sanitizeControlText(value, maxLength = INPUT_LIMITS.search) {
  return String(value ?? '').replace(CONTROL_CHARS, '').slice(0, maxLength);
}

export function sanitizeTrimmed(value, maxLength) {
  return sanitizeText(value, maxLength).trim();
}

export function sanitizeRepositoryName(value) {
  return sanitizeText(value, INPUT_LIMITS.repository)
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9._/-]/g, '')
    .replace(/^\/+/, '');
}

export function sanitizePackageField(value, maxLength = INPUT_LIMITS.packageField) {
  return sanitizeText(value, maxLength).replace(/\s+/g, '');
}

export function sanitizePath(value) {
  return sanitizeText(value, INPUT_LIMITS.path).replace(/\\/g, '/');
}

export function sanitizeNumberText(value) {
  return String(value ?? '').replace(/[^\d]/g, '').slice(0, INPUT_LIMITS.number);
}

export function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value));
}
