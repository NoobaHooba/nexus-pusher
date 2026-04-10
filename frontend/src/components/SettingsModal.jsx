import React, { useState } from 'react';

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ nexusUrl: '', repo: '', username: '', password: '', ...settings });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-primary">Nexus Connection</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">Configure your local Nexus server. These settings will be saved and pre-filled for all uploads.</p>
        <div className="flex flex-col gap-4">
          {[
            { key: 'nexusUrl',  label: 'Nexus URL',        placeholder: 'http://localhost:8081', type: 'text' },
            { key: 'repo',      label: 'Default Repo Name', placeholder: 'my-repo',              type: 'text' },
            { key: 'username',  label: 'Username',          placeholder: 'admin',                type: 'text' },
            { key: 'password',  label: 'Password',          placeholder: '••••••••',             type: 'password' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-black transition-colors">Save Settings</button>
        </div>
      </div>
    </div>
  );
}
