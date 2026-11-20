import React, { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useLockBodyScroll } from '../../utils/scrollLock';

interface DeleteTournamentModalProps {
  isOpen: boolean;
  tournamentTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteTournamentModal: React.FC<DeleteTournamentModalProps> = ({
  isOpen,
  tournamentTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  useLockBodyScroll(isOpen);
  const confirmClickedRef = useRef(false);
  const [localLocked, setLocalLocked] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      confirmClickedRef.current = false;
      setLocalLocked(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = isDeleting || localLocked;

  const handleConfirmClick = () => {
    if (confirmClickedRef.current || isLocked) return;
    confirmClickedRef.current = true;
    setLocalLocked(true);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-[#0D1428] border border-red-500/40 rounded-2xl p-6 shadow-2xl shadow-red-500/10 text-center animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isLocked}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 mb-4 shadow-inner">
          <Trash2 className="w-8 h-8" />
        </div>

        {/* Header Question - Exact user required text */}
        <h3 className="text-xl font-bold font-gaming text-white tracking-wide mb-2">
          আপনি কি এই টুর্নামেন্ট ডিলিট করতে চান?
        </h3>

        {/* Tournament name badge */}
        {tournamentTitle && (
          <div className="my-3 px-3 py-1.5 rounded-lg bg-[#111D35] border border-slate-700/80 text-sky-300 text-xs font-semibold inline-block max-w-full truncate">
            {tournamentTitle}
          </div>
        )}

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          এই টুর্নামেন্টটি স্থায়ীভাবে মুছে ফেলা হবে এবং এর সম্পর্কিত সকল রুম ডাটা ও রেজিস্ট্রেশন বাতিল হয়ে যাবে।
        </p>

        {/* Action Buttons: হ্যাঁ / না */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLocked}
            className="flex-1 py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
          >
            না
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLocked}
            className="flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-bold font-gaming text-sm shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>হ্যাঁ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
