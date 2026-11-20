import React from 'react';

interface TXLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onSecretAdminEntry?: () => void;
  disableSecretTap?: boolean;
}

export const TXLogo: React.FC<TXLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  onSecretAdminEntry,
  disableSecretTap = false,
}) => {
  const tapCountRef = React.useRef<number>(0);
  const lastTapTimeRef = React.useRef<number>(0);

  const handleLogoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableSecretTap) return;
    const now = Date.now();
    if (now - lastTapTimeRef.current > 2000) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      lastTapTimeRef.current = 0;
      e.stopPropagation();
      if (onSecretAdminEntry) {
        onSecretAdminEntry();
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tx:secret-admin-entry'));
      }
    }
  };

  const iconSizes = {
    sm: 'h-7 w-7 sm:h-9 sm:w-9',
    md: 'h-7 w-7 sm:h-10 sm:w-10',
    lg: 'h-11 w-11 sm:h-16 sm:w-16',
  };

  const titleSizes = {
    sm: 'text-[13px] sm:text-lg',
    md: 'text-[15px] sm:text-2xl',
    lg: 'text-xl sm:text-3xl',
  };

  const bdSizes = {
    sm: 'text-[9px] sm:text-[11px] px-1.5 py-0.5',
    md: 'text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5',
    lg: 'text-xs sm:text-sm px-2 sm:px-2.5 py-0.5 sm:py-1',
  };

  return (
    <div
      onClick={handleLogoTap}
      className={`inline-flex items-center gap-1.5 sm:gap-2.5 select-none cursor-pointer group shrink-0 ${className}`}
    >
      {/* Golden Crown TX TOUR BD Emblem */}
      <div
        className={`relative ${iconSizes[size]} aspect-square flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
      >
        <img
          src="/app-icon-192.png"
          alt="TX TOUR BD"
          loading="eager"
          decoding="sync"
          className="relative w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]"
        />
      </div>

      {/* 3D Stylish Gaming Wordmark: TX TOUR BD */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 sm:gap-1.5 leading-none whitespace-nowrap">
          {/* "TX" - Bold Skewed 3D Metallic Gold-Flame */}
          <span
            className={`font-black font-gaming italic tracking-wide bg-gradient-to-b from-white via-amber-300 to-orange-500 bg-clip-text text-transparent inline-block pr-0.5 ${titleSizes[size]}`}
            style={{
              filter:
                'drop-shadow(0 1px 0 #9a3412) drop-shadow(0 2px 0 #431407) drop-shadow(0 3px 4px rgba(245,158,11,0.45))',
            }}
          >
            TX
          </span>

          {/* "TOUR" - Bold Skewed 3D Electric Cyan-Blue */}
          <span
            className={`font-black font-gaming italic tracking-wide bg-gradient-to-b from-white via-cyan-300 to-blue-500 bg-clip-text text-transparent inline-block pr-0.5 ${titleSizes[size]}`}
            style={{
              filter:
                'drop-shadow(0 1px 0 #1e40af) drop-shadow(0 2px 0 #091534) drop-shadow(0 3px 4px rgba(56,189,248,0.45))',
            }}
          >
            TOUR
          </span>

          {/* "BD" - Angular 3D Crimson-Gold Esports Plate */}
          <span
            className={`inline-flex items-center justify-center font-black font-gaming italic tracking-wider text-white bg-gradient-to-b from-rose-500 via-red-600 to-red-700 border border-amber-300/70 border-b-2 border-b-red-950 rounded-md -skew-x-12 shadow-[0_2px_6px_rgba(239,68,68,0.55)] shrink-0 ${bdSizes[size]}`}
            style={{
              textShadow: '0 1px 0 #7f1d1d, 0 2px 2px rgba(0,0,0,0.8)',
            }}
          >
            <span className="skew-x-12">BD</span>
          </span>
        </div>

        {/* Tri-color sleek underline bar + optional subtitle */}
        <div className="mt-1 h-[2px] w-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-red-500 opacity-85" />

        {showSubtitle && (
          <span className="hidden sm:block text-[10px] tracking-[0.2em] text-sky-300/85 font-bold font-gaming uppercase mt-1 whitespace-nowrap">
            Free Fire Esports Arena
          </span>
        )}
      </div>
    </div>
  );
};
