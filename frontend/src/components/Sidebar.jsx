import React from 'react';

const NAV_ITEMS = [
  { id: 'upload', icon: 'rocket_launch', label: 'Pushes' },
  { id: 'ldap',   icon: 'group',         label: 'LDAP & Access' },
];

export default function Sidebar({ nexusLogo, onOpenSettings, activePage, onNavigate }) {
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-40 bg-white border-r border-slate-100 flex flex-col p-6 gap-2">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <img src={nexusLogo} alt="Nexus Logo" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <h1 className="text-primary font-bold text-lg leading-none">Nexus Pusher</h1>
          <p className="font-manrope text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mt-1">Repository Core</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-2">
        {NAV_ITEMS.map(({ id, icon, label }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all rounded-lg w-full text-left ${
                active
                  ? 'text-primary font-bold bg-accent-dim/50'
                  : 'text-on-surface-variant hover:bg-slate-50'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${active ? 'text-accent' : ''}`}>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-6">
        <button onClick={onOpenSettings} className="flex items-center gap-3 px-4 py-2 text-on-surface-variant text-sm font-medium hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span>Settings</span>
        </button>
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant text-sm font-medium hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span>Support</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant text-sm font-medium hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[18px]">description</span>
          <span>Documentation</span>
        </a>
      </div>
    </aside>
  );
}
