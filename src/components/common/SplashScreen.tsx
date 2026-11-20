import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const LOADING_DURATION_MS = 2800;
const START_PERCENT = 0;
const END_PERCENT = 100;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState<number>(START_PERCENT);

  useEffect(() => {
    let rafId: number;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, Math.max(0, elapsed / LOADING_DURATION_MS));
      const nextProgress =
        START_PERCENT + ratio * (END_PERCENT - START_PERCENT);

      setProgress(nextProgress);

      if (ratio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        finishTimer = setTimeout(() => {
          onComplete();
        }, 120);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (finishTimer) {
        clearTimeout(finishTimer);
      }
    };
  }, [onComplete]);

  const displayPercent = Math.min(
    END_PERCENT,
    Math.max(START_PERCENT, Math.round(progress))
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading TX TOUR BD ${displayPercent}%`}
      className="keep-dark-surface fixed inset-0 z-[100] w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-center px-6 select-none overflow-hidden bg-[#080D20] bg-[radial-gradient(circle_at_84%_96%,rgba(225,29,72,0.28)_0%,rgba(190,18,60,0.11)_26%,transparent_54%),radial-gradient(circle_at_15%_15%,rgba(30,41,89,0.42)_0%,transparent_55%)]"
    >
      {/* Subtle diagonal ambient sheen & bottom-right red glow accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(30,41,89,0.22)_0%,transparent_42%,rgba(225,29,72,0.08)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 right-6 w-52 h-52 rounded-full bg-rose-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-14 right-5 w-1.5 h-1.5 rounded-full bg-rose-400/70 blur-[0.5px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-28 right-12 w-1 h-1 rounded-full bg-rose-300/45"
      />

      {/* Top Centered WELCOME TO */}
      <p
        className="absolute top-[7.5%] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[11px] sm:text-xs font-normal uppercase tracking-[0.44em] [color:rgba(226,232,240,0.82)]"
      >
        WELCOME TO
      </p>

      {/* Center Brand Title, Thin Red-Pink Progress Bar & Status */}
      <div className="relative z-10 w-full max-w-[320px] sm:max-w-[360px] flex flex-col items-center text-center">
        <h1
          className="font-['Teko',sans-serif] font-bold text-[58px] sm:text-[72px] leading-[0.9] tracking-[0.04em] uppercase [color:#FFFFFF] [text-shadow:0_0_26px_rgba(255,255,255,0.42),0_0_8px_rgba(255,255,255,0.22)]"
        >
          TX TOUR BD
        </h1>

        {/* Thin Progress Bar Track */}
        <div className="w-full h-[7px] rounded-full mt-4 bg-[#060917]/80 border border-white/15 relative">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#F4274E_0%,#FA5E78_55%,#FFC6D2_100%)] shadow-[0_0_14px_rgba(244,63,94,0.65),0_0_4px_rgba(251,113,133,0.45)]"
            style={{ width: `${progress.toFixed(2)}%` }}
          />
        </div>

        {/* Status Text */}
        <p className="font-sans text-[11px] sm:text-xs font-medium uppercase tracking-[0.22em] mt-4 tabular-nums [color:#F2647D]">
          PREPARING BATTLE... {displayPercent}%
        </p>
      </div>
    </div>
  );
};
