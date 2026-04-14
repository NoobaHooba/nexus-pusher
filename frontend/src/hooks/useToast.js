import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createElement } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    // Mark as leaving so the exit animation plays
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 350);
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    const id       = ++toastIdCounter;
    const duration = opts.duration ?? (type === 'error' ? 6000 : 4000);
    setToasts(t => [{ id, type, message, duration, leaving: false, ...opts }, ...t]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, opts) => push('success', msg, opts),
    error:   (msg, opts) => push('error',   msg, opts),
    info:    (msg, opts) => push('info',    msg, opts),
    warning: (msg, opts) => push('warning', msg, opts),
    dismiss,
  };

  return createElement(ToastContext.Provider, { value: { toasts, toast } }, children);
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside <ToastProvider>');
  return ctx.toasts;
}
