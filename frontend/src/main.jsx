import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/manrope';
import '@fontsource/material-symbols-outlined';
import App from './App';
import './index.css';

// Apply dark class before first render to avoid flash
(function () {
  try {
    const stored = localStorage.getItem('nexus-pusher-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
