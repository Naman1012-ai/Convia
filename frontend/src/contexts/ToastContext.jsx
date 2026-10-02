import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2, X } from 'lucide-react';
import { NotificationService } from '../services/notificationService';
import { cn } from '../utils/cn';

export const ToastContext = createContext({
  showToast: (msg, type, duration) => NotificationService.show(msg, type, duration),
  toast: NotificationService,
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleRemoval = useCallback((id, duration) => {
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((action, payload) => {
      if (action === 'ADD_TOAST') {
        const { id, message, type, duration } = payload;
        setToasts((prev) => {
          // Extra guard against exact duplicate rendering
          if (prev.some((t) => t.id === id)) return prev;
          return [...prev, { id, message, type, duration }];
        });
        scheduleRemoval(id, duration);
      } else if (action === 'UPDATE_TOAST') {
        const { id, type, message, duration } = payload;
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, type, message, duration } : t))
        );
        scheduleRemoval(id, duration || 4000);
      } else if (action === 'REMOVE_TOAST') {
        removeToast(payload.id);
      }
    });

    return () => unsubscribe();
  }, [removeToast, scheduleRemoval]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-primary-500 shrink-0" />,
    loading: <Loader2 className="h-5 w-5 text-primary-500 animate-spin shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200 bg-emerald-50/95 text-emerald-950 shadow-emerald-500/10',
    warning: 'border-amber-200 bg-amber-50/95 text-amber-950 shadow-amber-500/10',
    error: 'border-rose-200 bg-rose-50/95 text-rose-950 shadow-rose-500/10',
    info: 'border-primary-200 bg-primary-50/95 text-primary-950 shadow-primary-500/10',
    loading: 'border-slate-200 bg-white/95 text-slate-900 shadow-slate-500/10',
  };

  return (
    <ToastContext.Provider
      value={{
        showToast: (msg, type, duration) => NotificationService.show(msg, type, duration),
        toast: NotificationService,
      }}
    >
      {children}

      {/* Global Single Toast Stack Container - Top Right */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-5 duration-200',
              borderColors[t.type] || borderColors.info
            )}
          >
            {icons[t.type] || icons.info}
            <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug break-words">
              {t.message}
            </p>
            {t.type !== 'loading' && (
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
