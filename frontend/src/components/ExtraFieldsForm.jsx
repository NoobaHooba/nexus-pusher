import React from 'react';

const FIELD_MAP = {
  maven: [
    { key: 'groupId',    label: 'Group ID',    placeholder: 'com.example' },
    { key: 'artifactId', label: 'Artifact ID', placeholder: 'my-artifact' },
    { key: 'version',    label: 'Version',     placeholder: '1.0.0' },
    { key: 'extension',  label: 'Extension',   placeholder: 'jar' },
  ],
  docker: [
    { key: 'imageName',  label: 'Image Name', placeholder: 'my-image' },
    { key: 'imageTag',   label: 'Image Tag',  placeholder: 'latest' },
    { key: 'dockerPort', label: 'Docker Registry Port', placeholder: '8082' },
  ],
  yum: [
    { key: 'directory', label: 'Upload Directory', placeholder: '/7/x86_64/' },
  ],
  raw: [
    { key: 'directory', label: 'Upload Directory', placeholder: '/assets/v1/' },
  ],
};

export default function ExtraFieldsForm({ repoType, values, onChange }) {
  const fields = FIELD_MAP[repoType];
  if (!fields) return null;

  const handle = (key, val) => onChange({ ...values, [key]: val });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
      <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{repoType.toUpperCase()} Options</h5>
      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
            <input
              type="text"
              value={values[key] || ''}
              onChange={(e) => handle(key, e.target.value)}
              placeholder={placeholder}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
