import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { TXLogo } from './TXLogo';
import { AuthModal } from './AuthModal';
import {
  Wallet,
  Bell,
  Plus,
  Download,
} from 'lucide-react';
import { AppNotification, PlatformAnnouncement } from '../../types';
import {
  markNotificationAsRead,
  subscribeUserNotifications,
} from '../../services/notificationService';
import {
  ensureWebPushSubscribed,
  triggerSystemPushNotification,
} from '../../services/pushNotificationService';
import {
  subscribeAnnouncements,
  getSeenAnnouncementIds,
  markAnnouncementsAsSeen,
} from '../../services/announcementService';
import { NoticeListModal } from './NoticeListModal';
import { getWalletBreakdown } from '../../services/walletService';
import { usePWAInstall } from '../../context/PWAInstallContext';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  onNavigateLink?: (url: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onNavigateLink,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { language, t, formatBDT } = useLanguage();
  const { triggerInstall, isInstalled } = usePWAInstall();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [seenAnnouncementIds, setSeenAnnouncementIds] = useState<Set<string>>(() =>
    getSeenAnnouncementIds(currentUser?.uid)
  );

  useEffect(() => {
    setSeenAnnouncementIds(getSeenAnnouncementIds(currentUser?.uid));
    if (!currentUser?.uid) {
      setNotifications([]);
      return;
    }

    ensureWebPushSubscribed(currentUser.uid).catch(() => {});

    const unsub = subscribeUserNotifications(currentUser.uid, (items) => {
      setNotifications(items);
      const unread = items.filter((n) => !n.read);
      unread.forEach((notif) => {
        triggerSystemPushNotification(notif, (url) => {
          if (onNavigateLink) {
            onNavigateLink(url);
          }
        }).catch(() => {});
      });
    });

    return () => unsub();
  }, [currentUser?.uid, onNavigateLink]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(setAnnouncements);
    const handleSeenSync = () => {
      setSeenAnnouncementIds(getSeenAnnouncementIds(currentUser?.uid));
    };
    window.addEventListener('tx:announcements-seen', handleSeenSync);
    return () => {
      unsub();
      window.removeEventListener('tx:announcements-seen', handleSeenSync);
    };
  }, [currentUser?.uid]);

  const unreadAnnouncementsCount = announcements.filter(
    (ann) => !seenAnnouncementIds.has(ann.id)
  ).length;
  const unreadPersonalCount = notifications.filter((n) => !n.read).length;
  const totalUnreadCount = unreadAnnouncementsCount + unreadPersonalCount;

  const handleOpenNoticeList = () => {
    setNoticeModalOpen(true);

    // Mark all admin notices as seen so the Bell badge number disappears
    const allAnnIds = announcements.map((a) => a.id);
    markAnnouncementsAsSeen(allAnnIds, currentUser?.uid);
    setSeenAnnouncementIds((prev) => {
      const next = new Set(prev);
      allAnnIds.forEach((id) => next.add(id));
      return next;
    });

    // Mark any unread personal notifications as read
    const unreadPersonal = notifications.filter((n) => !n.read);
    if (unreadPersonal.length > 0) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      Promise.all(unreadPersonal.map((n) => markNotificationAsRead(n.id))).catch(
        () => {}
      );
    }
  };

  const handleNotificationItemClick = (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id).catch(() => {});
    }
    setNoticeModalOpen(false);
    if (notif.link && onNavigateLink) {
      onNavigateLink(notif.link);
    }
  };

  const navLinks = [
    { id: 'home', label: t('nav.home') },
    { id: 'tournaments', label: t('nav.tournaments') },
    { id: 'install', label: 'Install App' },
    { id: 'leaderboard', label: t('nav.leaderboard') },
    { id: 'rules', label: t('nav.rules') },
    { id: 'support', label: t('nav.support') },
  ];

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full max-w-full bg-[#070B18]/95 backdrop-blur-md border-b border-sky-500/15"
        style={{ width: '100%', boxSizing: 'border-box' }}
      >
        <div
          className="w-full max-w-7xl mx-auto h-[68px] sm:h-[74px] pt-2 pb-1 flex items-center justify-between gap-2 sm:gap-4 pl-3 pr-2 sm:pl-6 sm:pr-4 lg:px-8"
          style={{
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Logo - Vertically centered slightly lower & aligned on the same line */}
          <div
            onClick={() => onNavigate('home')}
            className="shrink-0 cursor-pointer flex items-center translate-y-[1px]"
          >
            <TXLogo size="md" showSubtitle={false} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentPage === link.id
                    ? 'text-sky-400 bg-sky-950/40 border border-sky-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Action Icons & Auth Controls - slightly inward from right edge & gently lowered */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 ml-auto pr-2.5 sm:pr-3 translate-y-[3px]">

            {/* Small Install App Button next to Balance */}
            {!isInstalled && (
              <button
                type="button"
                onClick={triggerInstall}
                title="Install TX TOUR BD App"
                className="hidden xs:flex items-center gap-1 h-8 sm:h-9 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black font-gaming text-[11px] sm:text-xs tracking-wider uppercase shadow-md active:scale-95 transition-all cursor-pointer border border-amber-300/40 shrink-0"
              >
                <Download className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden sm:inline">
                  {language === 'bn' ? 'ইনস্টল অ্যাপ' : 'Install App'}
                </span>
                <span className="sm:hidden">
                  {language === 'bn' ? 'ইনস্টল' : 'Install'}
                </span>
              </button>
            )}

            {currentUser && userProfile ? (
              <>
                {/* Wallet Balance Chip */}
                <div
                  onClick={() => onNavigate('wallet')}
                  className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-950/80 to-[#111D35] border border-sky-500/30 hover:border-sky-400 text-white cursor-pointer transition-all shadow-sm shrink-0"
                >
                  <Wallet className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-xs font-bold font-gaming text-sky-300 whitespace-nowrap leading-none">
                    {formatBDT(getWalletBreakdown(userProfile).availableBalance)}
                  </span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('wallet', { tab: 'deposit' });
                    }}
                    title="Add Funds"
                    className="p-0.5 rounded bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-black transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                  </div>
                </div>

                {/* Notifications / Admin Notices Bell */}
                <div className="relative shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={handleOpenNoticeList}
                    aria-label="View Notices"
                    title="Notices & Notifications"
                    className={`relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl border transition-colors cursor-pointer ${
                      totalUnreadCount > 0
                        ? 'bg-red-950/60 hover:bg-red-900/70 border-red-500/60 text-red-300 hover:text-white'
                        : 'bg-[#111D35] hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="relative inline-flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                      {totalUnreadCount === 0 && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF2D2D] border border-white pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    {totalUnreadCount > 0 && (
                      <>
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping opacity-75 pointer-events-none" />
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-md shadow-red-600/50 leading-none border border-red-300/60">
                          {totalUnreadCount}
                        </span>
                      </>
                    )}
                  </button>
                </div>

              </>
            ) : (
              /* Logged Out Buttons - padding reduced, font-size 13px, gap 6px */
              <div className="flex items-center gap-[6px] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1A1408] border border-[#CFA84B]/50 text-[13px] font-bold text-[#F4D77A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {t('nav.login')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-[13px] font-extrabold text-black shadow-md shadow-[#CFA84B]/20 font-gaming tracking-wide transition-all cursor-pointer border border-[#F4D77A]/60 whitespace-nowrap"
                >
                  {t('nav.register')}
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Notice List Modal (rendered outside header so never clipped) */}
      <NoticeListModal
        isOpen={noticeModalOpen}
        onClose={() => setNoticeModalOpen(false)}
        announcements={announcements}
        notifications={notifications}
        language={language}
        userId={currentUser?.uid}
        onNotificationClick={handleNotificationItemClick}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onLoginSuccess={() => onNavigate('home')}
        onSecretAdminEntry={() => onNavigate('adminLogin')}
      />
    </>
  );
};
