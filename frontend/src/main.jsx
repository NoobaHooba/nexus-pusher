import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/manrope';
import '@fontsource/material-symbols-outlined';
import App from './App';
import { getInitialTheme } from './app/storage';
import './index.css';

// Apply dark class before first render to avoid flash
(function () {
  try {
    if (getInitialTheme() === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
