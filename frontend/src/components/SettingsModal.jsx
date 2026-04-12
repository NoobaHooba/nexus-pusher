import React, { useState } from 'react';

function makeAuthHeader(username, password) {
  if (!username) return null;
  return 'Basic ' + btoa(unescape(encodeURIComponent(`${username}:${password || ''}`)));
}

async function validateCredentials({ nexusUrl, username, password }) {
  const base = (nexusUrl || 'http://localhost:8080').replace(/\/$/, '');
  const url = `${base}/service/rest/v1/repositories`;
  const auth = makeAuthHeader(username, password);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    if (auth) xhr.setRequestHeader('Authorization', auth);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, message: 'Connection successful — credentials verified' });
      } else if (xhr.status === 401) {
        resolve({ ok: false, message: 'Authentication failed — username or password is incorrect' });
      } else if (xhr.status === 403) {
        resolve({ ok: false, message: 'Connected, but this user does not have permission to query Nexus' });
      } else if (xhr.status === 404) {
        resolve({ ok: false, message: 'Reached the proxy but Nexus REST API was not found — is Nexus running?' });
      } else {
        resolve({ ok: false, message: `Connection failed — HTTP ${xhr.status}` });
      }
    };

    xhr.onerror = () => resolve({
      ok: false,
      message: 'CORS or network error — is the proxy container running on port 8080?',
    });
    xhr.ontimeout = () => resolve({ ok: false, message: 'Connection test timed out after 10 s' });
    xhr.timeout = 10000;
    xhr.send();
  });
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ nexusUrl: '', username: '', password: '', defaultRepo: '', ...settings });
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setStatus(null);
    if (!form.nexusUrl?.trim()) {
      setStatus({ ok: false, message: 'Proxy URL is required' });
      return;
    }
    setTesting(true);
    const result = await validateCredentials(form);
    setTesting(false);
    setStatus(result);
    if (result.ok) onSave(form);
  };

  const fields = [
    {
      key: 'nexusUrl',
      label: 'Proxy URL',
      placeholder: 'http://localhost:8080',
      type: 'text',
      hint: 'The nginx proxy address — default: http://localhost:8080',
    },
    { key: 'username',    label: 'Username',           placeholder: 'admin',          type: 'text' },
    { key: 'password',    label: 'Password',           placeholder: '••••••••',       type: 'password' },
    { key: 'defaultRepo', label: 'Default Repository', placeholder: 'maven-releases', type: 'text' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-primary">Nexus Connection</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">
          Configure your proxy URL and credentials. Credentials are tested against Nexus before saving.
        </p>
        <div className="flex flex-col gap-4">
          {fields.map(({ key, label, placeholder, type, hint }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
              <input
                type={type}
                value={form[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
              />
              {hint && <p className="text-xs text-slate-400">{hint}</p>}
            </div>
          ))}
        </div>

        {status && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            status.ok
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {status.message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={testing} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {testing ? 'Testing...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
