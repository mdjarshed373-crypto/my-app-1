import React from 'react';
import { usePWAInstall } from '../../context/PWAInstallContext';
import { Smartphone, MoreVertical, PlusSquare, CheckCircle, X, Download } from 'lucide-react';
import { useLockBodyScroll, forceResetBodyScroll } from '../../utils/scrollLock';

export const PWAInstallModal: React.FC = () => {
  const { isModalOpen, closeInstallModal, isInstalled, isInstallable, triggerInstall } = usePWAInstall();

  useLockBodyScroll(isModalOpen);

  if (!isModalOpen) return null;

  const handleClose = () => {
    forceResetBodyScroll();
    closeInstallModal();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        className="keep-dark-surface w-full max-w-md rounded-3xl bg-[#0D1428] border-2 border-amber-500/50 shadow-2xl overflow-hidden p-6 text-white space-y-5 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <Download className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3
                id="install-modal-title"
                className="text-lg sm:text-xl font-black font-gaming uppercase tracking-wide text-white"
              >
                Install TX TOUR BD App
              </h3>
              <p className="text-xs text-amber-400 font-bangla font-semibold">
                {isInstalled
                  ? 'অ্যাপটি ইতিমধ্যে আপনার ডিভাইসে ইনস্টল করা আছে'
                  : 'সরাসরি মোবাইলে বা কম্পিউটারে ইনস্টল করে খেলুন'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-[#111D35] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* One-tap Direct Chrome Install CTA if native prompt is ready */}
        {isInstallable && !isInstalled && (
          <button
            type="button"
            onClick={async () => {
              await triggerInstall();
              handleClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.98] text-white font-black font-gaming text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-300/40"
          >
            <Download className="w-5 h-5 stroke-[2.5]" />
            <span>এখনই ইনস্টল করুন (1-Tap Install)</span>
          </button>
        )}

        {/* 3 Steps Guide Box */}
        <div className="space-y-3">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl bg-[#070B18] border border-slate-800/90 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 font-black font-gaming text-sm flex items-center justify-center shrink-0">
              1
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white font-gaming">
                <span>Step 1: Tap the 3 dots on top right of Chrome</span>
                <MoreVertical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 font-bangla mt-0.5">
                Chrome ব্রাউজারের উপরে ডানদিকের ৩টি ডটে (⋮) ট্যাপ করুন
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl bg-[#070B18] border border-slate-800/90 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black font-gaming text-sm flex items-center justify-center shrink-0">
              2
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white font-gaming">
                <span>Step 2: Tap &quot;Install and create shortcut&quot;</span>
                <PlusSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 font-bangla mt-0.5">
                মেনু থেকে &quot;Install app&quot; অথবা &quot;Install and create shortcut&quot; এ চাপুন
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl bg-[#070B18] border border-slate-800/90 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 font-black font-gaming text-sm flex items-center justify-center shrink-0">
              3
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white font-gaming">
                <span>Step 3: Tap &quot;Install&quot;</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-slate-400 font-bangla mt-0.5">
                এরপর &quot;Install&quot; বাটনে ট্যাপ করলেই অ্যাপ হোম স্ক্রিনে চলে আসবে
              </p>
            </div>
          </div>
        </div>

        {/* iPhone / Safari Tip */}
        <p className="text-[11px] text-slate-400 font-bangla text-center">
          💡 iPhone/iPad ব্যবহারকারীরা Safari-এর <b className="text-slate-300">Share</b> বাটনে চাপ দিয়ে <b className="text-amber-400">&quot;Add to Home Screen&quot;</b> নির্বাচন করুন।
        </p>

        {/* Button: "Got it" */}
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#EA580C] to-[#F59E0B] hover:from-[#EF4444] hover:via-[#F97316] hover:to-[#FBBF24] active:scale-[0.98] text-white font-black font-gaming text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300/40"
        >
          <CheckCircle className="w-5 h-5 stroke-[2.5]" />
          <span>বুঝেছি (Got it)</span>
        </button>
      </div>
    </div>
  );
};
