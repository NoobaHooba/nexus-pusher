import React from 'react';

const AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAR4cM_t9l5XA2S_Jr5-owJQNjx0r47TukcnTlalnRPBIt_Fg45Vzi5bo39hQMIVZbZ_Fzdk8Sk12ktdB4Uk1xH8G4MJDsLJ8EopUlU2mrIigzKQvWWE5E_qhNyqw3BVHUi1VNkRJgZbE94Dy2cMyrz83A17IRYYQgUQJlo4Lrhg674Nm3RieS2lIQWKy2LeaO6Eyj-AqaQR6e0_MVVf68dSZshfkgHnma9FmM_pz2S32RfDjYEFrFVhI91wMiHdO7Hc6_ElahZ7Ls';

export default function AppHeader({ onOpenSettings }) {
  return (
    <header className="w-[calc(100%-16rem)] ml-64 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
      <div className="flex justify-between items-center px-10 py-4">
        <div className="flex items-center gap-10">
          <span className="text-xl font-extrabold tracking-tight text-primary">Nexus Pusher</span>
          <nav className="flex gap-8">
            <a href="#" className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Dashboard</a>
            <a href="#" className="text-sm font-bold text-primary relative after:content-[''] after:absolute after:-bottom-5 after:left-0 after:w-full after:h-0.5 after:bg-accent">Analytics</a>
            <a href="#" className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Logs</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpenSettings(); }} className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">Settings</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white">
            <img src={AVATAR} alt="User avatar" />
          </div>
        </div>
      </div>
    </header>
  );
}
