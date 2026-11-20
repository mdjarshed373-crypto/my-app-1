import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastNotificationProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  onClose,
  duration = 3500,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#0D1428] border border-emerald-500/50 text-white shadow-2xl shadow-emerald-500/20 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
        <CheckCircle className="w-5 h-5" />
      </div>
      <div className="flex flex-col pr-2">
        <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
          সফল (Success)
        </span>
        <span className="text-sm font-semibold text-slate-100">
          {message}
        </span>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
