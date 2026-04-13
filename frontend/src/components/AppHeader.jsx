import React from 'react';

export default function AppHeader({ onOpenSettings }) {
  return (
    <header className="w-[calc(100%-16rem)] ml-64 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
      <nav className="flex items-center gap-8 px-10 h-12">
        <a href="#" className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Dashboard</a>
        <a href="#" className="text-sm font-bold text-primary relative after:content-[''] after:absolute after:-bottom-[1px] after:left-0 after:w-full after:h-0.5 after:bg-accent">Analytics</a>
        <a href="#" className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Logs</a>
        <a href="#" onClick={(e) => { e.preventDefault(); onOpenSettings(); }} className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Settings</a>
      </nav>
    </header>
  );
}
