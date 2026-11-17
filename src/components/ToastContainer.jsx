import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-emerald-600" size={18} />,
  error: <XCircle className="text-rose-600" size={18} />,
  warning: <AlertTriangle className="text-amber-600" size={18} />,
  info: <Info className="text-[#0071E3]" size={18} />
};

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 w-80 bg-white border border-[#D2D2D7] text-[#1D1D1F] rounded-xl shadow-md p-3.5 animate-fade-in"
        >
          <div className="shrink-0 mt-0.5">{icons[toast.type] || icons.info}</div>
          <div className="flex-1 text-xs font-medium leading-snug pt-0.5">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-[#6E6E73] hover:text-[#1D1D1F] transition-colors p-0.5 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
