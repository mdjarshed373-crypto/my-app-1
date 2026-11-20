import React from 'react';
import { Home, Trophy, Gamepad2, Wallet, User } from 'lucide-react';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  onNavigate,
}) => {
  const items: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'myMatches', label: 'My Matches', icon: Gamepad2, isCenter: true },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const isTabActive = (tabId: string): boolean => {
    if (tabId === 'home') return currentPage === 'home';
    if (tabId === 'tournaments') {
      return currentPage === 'tournaments' || currentPage === 'tournamentDetails';
    }
    if (tabId === 'myMatches') return currentPage === 'myMatches';
    if (tabId === 'wallet') return currentPage === 'wallet';
    if (tabId === 'profile') {
      return currentPage === 'profile' || currentPage === 'dashboard';
    }
    return false;
  };

  if (currentPage === 'landing') {
    return null;
  }

  return (
    <nav
      aria-label="Bottom Navigation"
      className="keep-dark-surface fixed bottom-0 inset-x-0 z-40 bg-[#0A0A0A] border-t border-[#CFA84B]/60 shadow-[0_-4px_25px_rgba(0,0,0,0.9)] pb-safe select-none"
    >
      <div className="max-w-xl mx-auto px-2 pt-1 pb-1.5 flex items-end justify-between">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = isTabActive(item.id);
          const isCenter = !!item.isCenter;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center justify-end flex-1 py-0.5 cursor-pointer group focus:outline-none"
            >
              {/* Circle container around icon: Golden Black theme */}
              <div
                className={`rounded-full flex items-center justify-center transition-all duration-200 ${
                  isCenter
                    ? isActive
                      ? 'w-12 h-12 -mt-3.5 bg-[#0A0A0A] border-2 border-[#CFA84B] text-[#F4D77A] shadow-[0_0_18px_rgba(207,168,75,0.6)] scale-105'
                      : 'w-12 h-12 -mt-3.5 bg-[#0A0A0A] border border-[#CFA84B]/35 text-[#B8A06A] group-hover:border-[#CFA84B]/60 group-hover:text-[#F4D77A] shadow-md'
                    : isActive
                    ? 'w-10 h-10 bg-[#0A0A0A] border-2 border-[#CFA84B] text-[#F4D77A] shadow-[0_0_14px_rgba(207,168,75,0.55)] scale-105'
                    : 'w-10 h-10 bg-[#0A0A0A] border border-[#CFA84B]/25 text-[#B8A06A] group-hover:border-[#CFA84B]/50 group-hover:text-[#F4D77A] shadow-sm'
                }`}
              >
                <Icon
                  className={
                    isCenter
                      ? 'w-6 h-6 stroke-[2.3]'
                      : 'w-5 h-5 stroke-[2.2]'
                  }
                />
              </div>

              {/* Exact tab label below circle */}
              <span
                className={`text-[10px] sm:text-[11px] font-bold font-gaming tracking-tight mt-1 transition-colors ${
                  isActive
                    ? 'text-[#F4D77A] font-black'
                    : 'text-[#B8A06A] font-bold group-hover:text-[#F4D77A]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
