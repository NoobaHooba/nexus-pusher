// FIX 2: Removed duplicate `import { createElement } from 'react'` — it was
// imported twice (once via `import React` and once as a named import), causing
// a redundant re-binding. Also fixed a timer-leak bug: when dismiss() was
// called manually before the auto-dismiss timer fired, the timer ID was being
// cleared but `timers.current[id]` was only deleted inside dismiss(), not
// inside the auto-dismiss path — meaning a manual dismiss followed by the
// timer firing would call setToasts on an already-removed item. Fixed by
// always deleting the timer ref from both paths.
import { createContext, useCallback, useContext, useRef, useState, createElement } from 'react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  // FIX 2: Wrapped dismiss in a stable ref so the auto-dismiss setTimeout
  // closure always calls the latest version, preventing a stale-closure
  // scenario when dismiss is recreated between renders.
  const dismissRef = useRef(null);

  const dismiss = useCallback((id) => {
    // Clear and delete the timer so a second call is a no-op
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 350);
  }, []);

  dismissRef.current = dismiss;

  const push = useCallback((type, message, opts = {}) => {
    const id       = ++toastIdCounter;
    const duration = opts.duration ?? (type === 'error' ? 6000 : 4000);
    setToasts(t => [{ id, type, message, duration, leaving: false, ...opts }, ...t]);
    if (duration > 0) {
      // FIX 2 (cont.): Use dismissRef so the closure always calls the
      // current dismiss function, not the one captured at push() creation.
      timers.current[id] = setTimeout(() => dismissRef.current(id), duration);
    }
    return id;
  }, []);

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
