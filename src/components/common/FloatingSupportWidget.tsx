import React, { useState, useEffect } from 'react';
import { Headphones, X, ChevronRight } from 'lucide-react';

const TELEGRAM_SUPPORT_URL = 'https://t.me/txtourbd';

export const FloatingSupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Fixed Bottom-Right 60x60 Round Circle Floating SUPPORT Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Contact Support"
        className="group fixed right-4 bottom-[76px] md:right-6 md:bottom-[76px] z-40 flex flex-col items-center gap-1 cursor-pointer select-none focus:outline-none"
      >
        <span className="keep-dark-surface relative w-[60px] h-[60px] rounded-full bg-gradient-to-br from-[#091026] via-[#181B54] to-[#341261] group-hover:from-[#0D1633] group-hover:via-[#1E2268] group-hover:to-[#401678] group-active:scale-95 border-2 border-cyan-400/90 group-hover:border-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.55),0_10px_24px_rgba(0,0,0,0.75),inset_0_0_16px_rgba(56,189,248,0.28)] group-hover:shadow-[0_0_30px_rgba(34,211,238,0.8),0_12px_28px_rgba(0,0,0,0.85),inset_0_0_20px_rgba(56,189,248,0.38)] flex items-center justify-center transition-all duration-200 overflow-hidden">
          {/* Subtle ambient cyan-purple aura */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 -right-3 w-10 h-10 rounded-full bg-cyan-400/25 blur-md group-hover:bg-cyan-300/35 transition-colors"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-purple-500/30 blur-md"
          />

          {/* White Headset Icon in Center with Neon Glow */}
          <Headphones className="relative w-7 h-7 text-white stroke-[2.2] drop-shadow-[0_0_12px_rgba(34,211,238,0.95)] group-hover:scale-105 transition-transform" />
        </span>

        {/* Small White SUPPORT Text Below Circle */}
        <span className="support-floating-label text-[10px] font-black font-gaming tracking-wider uppercase leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
          SUPPORT
        </span>
      </button>

      {/* CONTACT SUPPORT / 24/7 Live Help Popup Modal */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-support-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-[#0D1428] border border-cyan-400/35 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Modal Header with X Close Button */}
            <div className="px-5 py-4 bg-[#111D35] border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="contact-support-modal-title"
                    className="text-sm sm:text-base font-black font-gaming tracking-wider text-white uppercase leading-tight"
                  >
                    CONTACT SUPPORT
                  </h2>
                  <span className="text-[11px] font-semibold text-cyan-300 block">
                    24/7 Live Help
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#0D1428] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body — Single Telegram Support Option */}
            <div className="p-5">
              <a
                href={TELEGRAM_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full p-4 rounded-xl bg-[#111D35] hover:bg-[#162544] border border-sky-500/30 hover:border-cyan-400/70 flex items-center justify-between gap-3 transition-all duration-150 shadow-lg"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 shrink-0 group-hover:scale-105 transition-transform">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6"
                      aria-hidden="true"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-black font-gaming tracking-wide text-white group-hover:text-cyan-300 transition-colors block">
                      Telegram Support
                    </span>
                    <span className="text-xs font-semibold text-cyan-400 block mt-0.5">
                      Chat on Telegram
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
