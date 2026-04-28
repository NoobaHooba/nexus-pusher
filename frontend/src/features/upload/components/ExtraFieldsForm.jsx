import React from 'react';

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

  const handle = (key, val) => onChange({ ...values, [key]: val });

  return (
    <div className={`bg-white dark:bg-dark-surface rounded-2xl border border-slate-100 dark:border-dark-border ${compact ? 'p-4' : 'p-6'} flex flex-col gap-4`}>
      <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-dark-text-faint">
        {title || `${repoType.toUpperCase()} Options`}
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant dark:text-dark-text-muted">{label}</label>
            <input
              type="text"
              value={values[key] || ''}
              onChange={(e) => handle(key, e.target.value)}
              placeholder={placeholder}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-medium text-primary dark:text-dark-text placeholder:text-slate-300 dark:placeholder:text-dark-text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
