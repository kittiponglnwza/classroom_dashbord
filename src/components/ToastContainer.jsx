import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-emerald-500" size={20} />,
  error: <XCircle className="text-rose-500" size={20} />,
  warning: <AlertTriangle className="text-amber-500" size={20} />,
  info: <Info className="text-brand-500" size={20} />
};

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 w-80 shadow-lg p-4 animate-fade-in"
          style={{ 
            backgroundColor: 'var(--card)', 
            borderColor: 'var(--border)', 
            color: 'var(--text)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '0.75rem'
          }}
        >
          <div className="shrink-0">{icons[toast.type] || icons.info}</div>
          <div className="flex-1 text-sm font-medium leading-tight pt-0.5">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-gray-400 hover:text-white transition-colors p-0.5"
            style={{ color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
