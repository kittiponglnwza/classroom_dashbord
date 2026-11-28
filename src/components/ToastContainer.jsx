import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-emerald-400" size={18} strokeWidth={1.5} />,
  error: <XCircle className="text-rose-400" size={18} strokeWidth={1.5} />,
  warning: <AlertTriangle className="text-amber-400" size={18} strokeWidth={1.5} />,
  info: <Info className="text-[var(--primary-bright)]" size={18} strokeWidth={1.5} />
};

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 w-80 max-w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-xl p-3.5 animate-fade-in"
        >
          <div className="shrink-0 mt-0.5">{icons[toast.type] || icons.info}</div>
          <div className="flex-1 text-xs font-medium leading-snug pt-0.5">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 w-9 h-9 -mr-1.5 -mt-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X aria-hidden="true" size={15} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
