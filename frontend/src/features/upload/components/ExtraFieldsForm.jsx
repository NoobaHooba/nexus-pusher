import React from 'react';
import { INPUT_LIMITS, sanitizePackageField, sanitizePath } from '../../../shared/lib/inputValidation';

export const FIELD_MAP = {
  docker: [
    { key: 'imageName', label: 'Image Name', placeholder: 'team/app' },
    { key: 'imageTag',  label: 'Image Tag',  placeholder: '1.0.0' },
  ],
  maven: [
    { key: 'groupId',    label: 'Group ID',    placeholder: 'com.example' },
    { key: 'artifactId', label: 'Artifact ID', placeholder: 'my-artifact' },
    { key: 'version',    label: 'Version',     placeholder: '1.0.0' },
    { key: 'extension',  label: 'Extension',   placeholder: 'jar' },
    { key: 'classifier', label: 'Classifier',  placeholder: 'sources (optional)' },
  ],
  yum: [
    { key: 'directory', label: 'Upload Directory', placeholder: '/7/x86_64/' },
  ],
  raw: [
    { key: 'directory', label: 'Upload Directory', placeholder: '/assets/v1/' },
  ],
};

const OPTIONAL_KEYS = new Set(['classifier']);

function getFieldLimit(key) {
  if (key === 'directory') return INPUT_LIMITS.directory;
  if (key === 'extension') return INPUT_LIMITS.extension;
  if (key === 'version' || key === 'imageTag') return INPUT_LIMITS.version;
  if (key === 'classifier') return INPUT_LIMITS.classifier;
  return INPUT_LIMITS.packageField;
}

function sanitizeExtraField(key, value) {
  if (key === 'directory') return sanitizePath(value);
  return sanitizePackageField(value, getFieldLimit(key));
}

export default function ExtraFieldsForm({
  repoType,
  values,
  onChange,
  fieldsOverride,
  title,
  compact = false,
}) {
  const fields = fieldsOverride || FIELD_MAP[repoType];
  if (!fields) return null;

  const handle = (key, val) => onChange({ ...values, [key]: sanitizeExtraField(key, val) });

  return (
    <div className={`bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border ${compact ? 'p-4' : 'p-6'} flex flex-col gap-4`}>
      <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">
        {title || `${repoType.toUpperCase()} Options`}
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, placeholder }) => {
          const required = !OPTIONAL_KEYS.has(key);
          const emptyRequired = required && !String(values[key] || '').trim();
          return (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted">{label}</label>
            <input
              type="text"
              required={required}
              aria-invalid={emptyRequired}
              maxLength={getFieldLimit(key)}
              value={values[key] || ''}
              onChange={(e) => handle(key, e.target.value)}
              placeholder={placeholder}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
            />
            {emptyRequired && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-300">Required for this package.</span>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
