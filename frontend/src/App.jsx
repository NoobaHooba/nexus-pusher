import React from 'react';
import AppShell from './app/AppShell';
import { ToastProvider } from './shared/hooks/useToast';

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
