import React from 'react';
import { useLockBodyScroll, forceResetBodyScroll } from '../../utils/scrollLock';

interface WelcomeNoticeModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const WelcomeNoticeModal: React.FC<WelcomeNoticeModalProps> = ({
  isOpen,
  onAccept,
}) => {
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const handleOkay = () => {
    forceResetBodyScroll();
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-notice-title"
        className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="space-y-4">
          <h2
            id="welcome-notice-title"
            className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug text-center"
          >
            অ্যাপ এডমানি করলেই পাবেন বোনাস :-Admin inbox
          </h2>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
            <p>Deposit 100 Tk = 💸15 Tk Extra Bonus</p>
            <p>Deposit 199Tk = 💸30 Tk Extra Bonus</p>
            <p>Deposit 299 Tk = 💸50 Tk Extra Bonus</p>
            <p>Deposit 499 Tk = 💸100 Tk Extra Bonus</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOkay}
          className="w-full min-h-[46px] py-3 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base tracking-wide shadow-lg shadow-orange-500/30 transition-all cursor-pointer"
        >
          Okay
        </button>
      </div>
    </div>
  );
};
