import React from 'react';
import { useToast, useToasts } from '../hooks/useToast';

const CONFIGS = {
  success: {
    icon: 'check_circle',
    bar:  'bg-green-400 dark:bg-dark-accent',
    icon_cls: 'text-green-500 dark:text-dark-accent',
    border: 'border-green-100 dark:border-green-900/40',
  },
  error: {
    icon: 'error',
    bar:  'bg-red-400',
    icon_cls: 'text-red-500',
    border: 'border-red-100 dark:border-red-900/40',
  },
  warning: {
    icon: 'warning',
    bar:  'bg-amber-400',
    icon_cls: 'text-amber-500',
    border: 'border-amber-100 dark:border-amber-900/40',
  },
  info: {
    icon: 'info',
    bar:  'bg-blue-400',
    icon_cls: 'text-blue-500',
    border: 'border-blue-100 dark:border-blue-900/40',
  },
};

function Toast({ toast }) {
  const { dismiss } = useToast();
  const cfg = CONFIGS[toast.type] || CONFIGS.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        relative flex items-start gap-3 w-[340px] max-w-[calc(100vw-2rem)]
        bg-white dark:bg-dark-surface
        border ${cfg.border}
        rounded-2xl shadow-lg dark:shadow-black/40
        px-4 py-3.5 overflow-hidden
        transition-all duration-300 ease-out
        ${toast.leaving
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100'
        }
      `}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${cfg.bar}`} />

      {/* Icon */}
      <span className={`material-symbols-outlined text-[22px] flex-shrink-0 mt-0.5 ${cfg.icon_cls}`}>
        {cfg.icon}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-bold text-primary dark:text-dark-text leading-tight mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm text-on-surface-variant dark:text-dark-text-muted leading-snug">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => { toast.action.onClick(); dismiss(toast.id); }}
            className="mt-1.5 text-xs font-bold text-accent dark:text-dark-accent hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => dismiss(toast.id)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-dark-surface-2 transition-colors"
        aria-label="Dismiss"
      >
        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-dark-text-faint">close</span>
      </button>

      {/* Progress bar auto-dismiss */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-dark-surface-2 rounded-b-2xl overflow-hidden">
          <div
            className={`h-full ${cfg.bar} origin-left`}
            style={{
              animation: `toast-shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToasts();

  return (
    <>
      <style>{`
        @keyframes toast-shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
      <div
        aria-label="Notifications"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-3"
      >
        {toasts.map(t => <Toast key={t.id} toast={t} />)}
      </div>
    </>
  );
}
