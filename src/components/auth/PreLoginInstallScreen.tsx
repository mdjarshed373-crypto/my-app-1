import React, { useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { usePWAInstall } from '../../context/PWAInstallContext';
import { TXLogo } from '../common/TXLogo';

interface PreLoginInstallScreenProps {
  onContinueToLogin: () => void;
  onSecretAdminEntry?: () => void;
}

export const PreLoginInstallScreen: React.FC<PreLoginInstallScreenProps> = ({
  onContinueToLogin,
  onSecretAdminEntry,
}) => {
  const { triggerInstall, isInstalled } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      const outcome = await triggerInstall();
      if (outcome === 'accepted') {
        setJustAccepted(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="keep-dark-surface min-h-[100dvh] w-full overflow-y-auto flex flex-col items-center justify-center px-5 py-10 relative"
      style={{
        backgroundColor: '#050914',
        backgroundImage:
          'radial-gradient(circle at 50% 18%, rgba(22, 163, 74, 0.14), transparent 55%), radial-gradient(circle at 50% 82%, rgba(37, 99, 235, 0.14), transparent 55%)',
      }}
    >
      <div className="w-full max-w-[410px] rounded-3xl bg-[#0B1224] border border-slate-800/90 px-6 py-8 sm:px-8 sm:py-10 shadow-[0_24px_60px_rgba(0,0,0,0.65)] text-center flex flex-col items-center">
        {/* TX TOUR BD Logo & Emblem */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-[#070B18] border-2 border-amber-400/50 shadow-[0_12px_32px_rgba(245,158,11,0.22)] flex items-center justify-center">
            <img
              src="/pwa-icon-192x192.png?v=20261119b"
              alt="TX TOUR BD Logo"
              loading="eager"
              decoding="sync"
              className="w-full h-full object-cover"
            />
          </div>

          <TXLogo
            size="lg"
            showSubtitle={false}
            onSecretAdminEntry={onSecretAdminEntry}
          />
        </div>

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl font-extrabold font-bangla text-white leading-snug tracking-tight mb-2.5">
          বাংলাদেশের সেরা ফ্রি ফায়ার টুর্নামেন্ট অ্যাপ
        </h1>

        {/* Subtitle Text */}
        <p className="text-sm sm:text-base font-bangla font-medium text-amber-300/95 mb-7">
          প্রতিদিন নতুন টুর্নামেন্ট, বিশাল পুরস্কার
        </p>

        {/* Just Installed Feedback */}
        {justAccepted && (
          <div
            role="status"
            className="w-full mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-bangla flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              অ্যাপ ইনস্টল সম্পন্ন হচ্ছে! হোম স্ক্রিন আইকন থেকে ওপেন করুন অথবা নিচে লগইন করুন।
            </span>
          </div>
        )}

        {/* Big Green Install Button */}
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="w-full min-h-[56px] px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#16A34A] via-[#22C55E] to-[#15803D] hover:from-[#22C55E] hover:to-[#16A34A] active:scale-[0.98] text-white font-extrabold font-bangla text-base sm:text-[17px] shadow-[0_12px_28px_rgba(22,163,74,0.38)] border border-emerald-300/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
        >
          <span aria-hidden="true">⬇️</span>
          <span>
            {installing
              ? 'Installing...'
              : 'Install App / অ্যাপ ইনস্টল করুন'}
          </span>
        </button>

        {/* Small Helper Text */}
        <p className="mt-3.5 text-xs sm:text-sm font-bangla text-slate-400">
          Install করলে হোম স্ক্রিনে আইকন আসবে
        </p>

        {/* Secondary Continue to Login option (highlighted after install, subtle before install) */}
        <div className="w-full mt-7 pt-5 border-t border-slate-800/80">
          {justAccepted || isInstalled ? (
            <button
              type="button"
              onClick={onContinueToLogin}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold font-bangla text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>লগইন পেজে যান (Open Login)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinueToLogin}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bangla font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>ইতিমধ্যে ইনস্টল করা আছে? Login করুন</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
