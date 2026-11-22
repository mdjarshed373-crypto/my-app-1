import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/common/Navbar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { FloatingSupportWidget } from './components/common/FloatingSupportWidget';
import { WelcomeNoticeModal } from './components/common/WelcomeNoticeModal';
import { AnnouncementPopupModal } from './components/common/AnnouncementPopupModal';
import { SplashScreen } from './components/common/SplashScreen';
import { AuthModal } from './components/common/AuthModal';
import { KbdAuthScreen } from './components/auth/KbdAuthScreen';
import { PreLoginInstallScreen } from './components/auth/PreLoginInstallScreen';
import { JoinTournamentModal } from './components/tournament/JoinTournamentModal';
import { ToastNotification } from './components/common/ToastNotification';
import { FullscreenBreakoutBar } from './components/common/FullscreenBreakoutBar';
import { PWAInstallProvider, usePWAInstall } from './context/PWAInstallContext';
import { PWAInstallModal } from './components/common/PWAInstallModal';
import { forceResetBodyScroll } from './utils/scrollLock';
import { InstallPage } from './pages/InstallPage';
import { Home } from './pages/Home';
import { TournamentsList } from './pages/TournamentsList';
import { TournamentDetails } from './pages/TournamentDetails';
import { PlayerDashboard } from './pages/PlayerDashboard';
import { MyMatches } from './pages/MyMatches';
import { TeamManagement } from './pages/TeamManagement';
import { WalletPage } from './pages/WalletPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SupportCenter } from './pages/SupportCenter';
import { RulesPage } from './pages/RulesPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { ManageAdminsPage } from './pages/admin/ManageAdminsPage';
import { RoomManagerPage } from './pages/admin/RoomManagerPage';
import { BanManagementPage } from './pages/admin/BanManagementPage';
import { WinnerPayoutListPage } from './pages/admin/WinnerPayoutListPage';
import { ReferAndEarnPage } from './pages/ReferAndEarnPage';
import { checkAndSeedInitialData } from './services/seedService';
import { isUserCurrentlyBanned, getBanErrorMessage } from './services/banService';
import { capturePendingReferCodeFromUrl } from './services/referralService';
import {
  subscribeAuthBackgroundErrors,
  subscribeAuthBackgroundNotices,
} from './services/playerAuthService';
import {
  isJoinLockedOrJoined,
  subscribeOptimisticJoinErrors,
} from './services/optimisticJoinStore';
import {
  subscribeOptimisticTournamentErrors,
  subscribeOptimisticTournamentSuccess,
} from './services/optimisticTournamentStore';
import { Tournament } from './types';

const ADMIN_ONLY_PAGES = new Set([
  'admin',
  'adminDashboard',
  'manageAdmins',
  'roomManager',
  'banManagement',
  'winnerPayoutList',
]);

interface DeepLinkTarget {
  page: string;
  tournamentId?: string;
  focusRoom?: boolean;
}

function parseLinkTarget(rawUrl?: string): DeepLinkTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = rawUrl
      ? new URL(rawUrl, window.location.origin)
      : new URL(window.location.href);
    const searchParams = parsed.searchParams;
    const view = (searchParams.get('view') || '').toLowerCase();
    const id = searchParams.get('id') || '';
    const tab = (searchParams.get('tab') || '').toLowerCase();

    if (view === 'tournament' && id) {
      return {
        page: 'tournamentDetails',
        tournamentId: id,
        focusRoom: tab === 'room',
      };
    }

    const path = parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const hash = parsed.hash.toLowerCase();

    if (path === '/admin-login' || hash === '#admin-login') {
      return { page: 'adminLogin' };
    }
    if (
      path === '/admin' ||
      path === '/admin-panel' ||
      path === '/admin-dashboard' ||
      hash === '#admin' ||
      hash === '#admin-panel' ||
      hash === '#admin-dashboard'
    ) {
      return { page: 'admin' };
    }
    if (path === '/manage-admins' || hash === '#manage-admins') {
      return { page: 'manageAdmins' };
    }
    if (path === '/room-manager' || hash === '#room-manager') {
      return { page: 'roomManager' };
    }
    if (path === '/ban-management' || hash === '#ban-management') {
      return { page: 'banManagement' };
    }
    if (path === '/winner-payout-list' || hash === '#winner-payout-list') {
      return { page: 'winnerPayoutList' };
    }
    if (path === '/refer-earn' || hash === '#refer-earn') {
      return { page: 'referAndEarn' };
    }
    if (path === '/install' || hash === '#install') {
      return { page: 'install' };
    }
    if (path === '/app' || hash === '#app' || view === 'app') {
      return { page: 'home' };
    }
  } catch {
    return null;
  }
  return null;
}

function resolvePageFromLocation(): string | null {
  return parseLinkTarget()?.page || null;
}

function MainApp() {
  const { currentUser, userProfile, isAdmin, isSuperAdmin, loading: authLoading, banAlertMessage, clearBanAlert } = useAuth();
  const { isStandalone } = usePWAInstall();
  const { language } = useLanguage();
  const [continueToLogin, setContinueToLogin] = useState(false);

  const [currentPage, setCurrentPage] = useState<string>(() => {
    const urlPage = resolvePageFromLocation();
    if (urlPage && urlPage !== 'landing') {
      return urlPage;
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('tx_current_page');
        if (saved && saved !== 'landing') {
          return saved;
        }
      } catch {}
    }
    return 'home';
  });
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(() => {
    return parseLinkTarget()?.tournamentId || null;
  });
  const [focusRoomSection, setFocusRoomSection] = useState<boolean>(() => {
    return Boolean(parseLinkTarget()?.focusRoom);
  });
  const [walletTab, setWalletTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');
  const [adminInitialTab, setAdminInitialTab] = useState<string | undefined>(undefined);
  const [unauthorizedNotice, setUnauthorizedNotice] = useState<string | null>(null);
  const [authGateError, setAuthGateError] = useState<string | null>(null);
  const [joinToastMessage, setJoinToastMessage] = useState<string | null>(null);

  // Join Tournament Modal state
  const [activeJoinTournament, setActiveJoinTournament] = useState<Tournament | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem('tx_splash_shown') === 'true') {
          return false;
        }
      } catch {}
    }
    return true;
  });
  const [showWelcomeNotice, setShowWelcomeNotice] = useState<boolean>(() => {
    const initialTarget = parseLinkTarget();
    if (initialTarget?.page === 'tournamentDetails') {
      return false;
    }
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem('tx_welcome_shown') === 'true') {
          return false;
        }
      } catch {}
    }
    return true;
  });

  const handleSplashComplete = useCallback(() => {
    try {
      sessionStorage.setItem('tx_splash_shown', 'true');
    } catch {}
    setShowSplash(false);
    forceResetBodyScroll();
    setCurrentPage((prev) => (prev === 'adminLogin' ? prev : prev === 'landing' || !prev ? 'home' : prev));
  }, []);

  const handleLogoutToLogin = useCallback(() => {
    try {
      sessionStorage.setItem('tx_welcome_shown', 'true');
    } catch {}
    setContinueToLogin(true);
    setShowWelcomeNotice(false);
    setAuthModalOpen(false);
    setAuthGateError(null);
    setCurrentPage('home');
  }, []);

  useEffect(() => {
    // Check and seed initial tournament presets if empty
    checkAndSeedInitialData();
    capturePendingReferCodeFromUrl();
  }, []);

  // Route protection: block normal / unauthenticated users from directly accessing Admin Panel URLs
  useEffect(() => {
    if (authLoading) return;
    if (currentPage === 'manageAdmins' && !isSuperAdmin) {
      setUnauthorizedNotice(
        isAdmin ? 'Only Main Admin can access Manage Admins' : 'You are not authorized'
      );
      const fallbackPage = isAdmin ? 'admin' : 'home';
      const fallbackUrl = isAdmin ? '/admin' : '/app';
      setCurrentPage(fallbackPage);
      try {
        sessionStorage.setItem('tx_current_page', fallbackPage);
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', fallbackUrl);
        }
      } catch {}
      return;
    }
    if (ADMIN_ONLY_PAGES.has(currentPage) && !isAdmin) {
      setUnauthorizedNotice(
        currentPage === 'winnerPayoutList'
          ? 'Only Admin — Access Denied'
          : currentPage === 'banManagement'
          ? 'Access Denied - Admin Only'
          : 'You are not authorized'
      );
      setCurrentPage('home');
      try {
        sessionStorage.setItem('tx_current_page', 'home');
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', '/app');
        }
      } catch {}
    }
  }, [authLoading, currentPage, isAdmin, isSuperAdmin]);

  // Auto-dismiss unauthorized banner after a few seconds
  useEffect(() => {
    if (!unauthorizedNotice) return;
    const timer = setTimeout(() => setUnauthorizedNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [unauthorizedNotice]);

  // Handle browser back/forward or manual URL/hash navigation
  useEffect(() => {
    const syncFromLocation = () => {
      const target = parseLinkTarget();
      if (!target) return;
      if (target.page === 'manageAdmins' && !authLoading && !isSuperAdmin) {
        setUnauthorizedNotice(
          isAdmin ? 'Only Main Admin can access Manage Admins' : 'You are not authorized'
        );
        const fallbackPage = isAdmin ? 'admin' : 'home';
        const fallbackUrl = isAdmin ? '/admin' : '/app';
        setCurrentPage(fallbackPage);
        try {
          sessionStorage.setItem('tx_current_page', fallbackPage);
          window.history.replaceState(null, '', fallbackUrl);
        } catch {}
        return;
      }
      if (ADMIN_ONLY_PAGES.has(target.page) && !authLoading && !isAdmin) {
        setUnauthorizedNotice(
          target.page === 'winnerPayoutList'
            ? 'Only Admin — Access Denied'
            : target.page === 'banManagement'
            ? 'Access Denied - Admin Only'
            : 'You are not authorized'
        );
        setCurrentPage('home');
        try {
          sessionStorage.setItem('tx_current_page', 'home');
          window.history.replaceState(null, '', '/app');
        } catch {}
        return;
      }
      if (target.page === 'tournamentDetails' && target.tournamentId) {
        setSelectedTournamentId(target.tournamentId);
        setFocusRoomSection(Boolean(target.focusRoom));
      }
      setCurrentPage(target.page);
    };

    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      window.removeEventListener('hashchange', syncFromLocation);
    };
  }, [authLoading, isAdmin, isSuperAdmin]);

  const handleNavigate = useCallback((page: string, params?: any) => {
    const targetPage = page === 'adminDashboard' ? 'admin' : page;

    // Main Admin only guard for manageAdmins
    if (targetPage === 'manageAdmins' && !isSuperAdmin) {
      setUnauthorizedNotice(
        isAdmin ? 'Only Main Admin can access Manage Admins' : 'You are not authorized'
      );
      const fallbackPage = isAdmin ? 'admin' : 'home';
      const fallbackUrl = isAdmin ? '/admin' : '/app';
      try {
        sessionStorage.setItem('tx_current_page', fallbackPage);
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', fallbackUrl);
        }
      } catch {}
      setCurrentPage(fallbackPage);
      return;
    }

    // Security guard on programmatic navigation to Admin Panel pages
    if (ADMIN_ONLY_PAGES.has(targetPage) && !isAdmin) {
      setUnauthorizedNotice(
        targetPage === 'winnerPayoutList'
          ? 'Only Admin — Access Denied'
          : targetPage === 'banManagement'
          ? 'Access Denied - Admin Only'
          : 'You are not authorized'
      );
      try {
        sessionStorage.setItem('tx_current_page', 'home');
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', '/app');
        }
      } catch {}
      setCurrentPage('home');
      return;
    }

    try {
      const scrollEl = document.getElementById('main-scroll-container');
      if (scrollEl) {
        scrollEl.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      if (typeof window !== 'undefined' && window.history?.pushState) {
        if (targetPage === 'install') {
          window.history.pushState(null, '', '/install');
        } else if (targetPage === 'home') {
          window.history.pushState(null, '', '/app');
        } else if (targetPage === 'landing') {
          window.history.pushState(null, '', '/');
        } else if (targetPage === 'admin') {
          window.history.pushState(null, '', '/admin');
        } else if (targetPage === 'manageAdmins') {
          window.history.pushState(null, '', '/manage-admins');
        } else if (targetPage === 'roomManager') {
          window.history.pushState(null, '', '/room-manager');
        } else if (targetPage === 'banManagement') {
          window.history.pushState(null, '', '/ban-management');
        } else if (targetPage === 'winnerPayoutList') {
          window.history.pushState(null, '', '/winner-payout-list');
        } else if (targetPage === 'referAndEarn') {
          window.history.pushState(null, '', '/refer-earn');
        } else if (targetPage === 'adminLogin') {
          window.history.pushState(null, '', '/admin-login');
        } else if (targetPage === 'tournamentDetails' && params?.id) {
          const qs = params.focusRoom
            ? `/app?view=tournament&id=${params.id}&tab=room`
            : `/app?view=tournament&id=${params.id}`;
          window.history.pushState(null, '', qs);
        }
      }
    } catch {}
    try {
      sessionStorage.setItem('tx_current_page', targetPage);
    } catch {}
    if (targetPage === 'tournamentDetails' && params?.id) {
      setSelectedTournamentId(params.id);
      setFocusRoomSection(Boolean(params?.focusRoom));
    } else if (targetPage !== 'tournamentDetails') {
      setFocusRoomSection(false);
    }
    if (targetPage === 'roomManager' && params?.id) {
      setSelectedTournamentId(params.id);
    }
    if (targetPage === 'wallet' && params?.tab) {
      setWalletTab(params.tab);
    }
    if (targetPage === 'admin') {
      setAdminInitialTab(params?.tab || undefined);
    }
    setCurrentPage(targetPage);
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    const handleSecretAdminEntry = () => {
      setAuthModalOpen(false);
      setShowWelcomeNotice(false);
      handleNavigate('adminLogin');
    };
    window.addEventListener('tx:secret-admin-entry', handleSecretAdminEntry);
    return () => {
      window.removeEventListener('tx:secret-admin-entry', handleSecretAdminEntry);
    };
  }, [handleNavigate]);

  const handleNavigateLink = useCallback(
    (url: string) => {
      const target = parseLinkTarget(url);
      if (target) {
        handleNavigate(target.page, {
          id: target.tournamentId,
          focusRoom: target.focusRoom,
        });
      }
    },
    [handleNavigate]
  );

  // Listen for Service Worker notification click deep-links
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TX_NOTIFICATION_NAVIGATE' && event.data?.url) {
        handleNavigateLink(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [handleNavigateLink]);

  useEffect(() => {
    const unsubJoinErr = subscribeOptimisticJoinErrors((msg) => {
      setUnauthorizedNotice(msg);
    });
    const unsubTourErr = subscribeOptimisticTournamentErrors((msg) => {
      setUnauthorizedNotice(msg);
    });
    const unsubTourSuccess = subscribeOptimisticTournamentSuccess((msg) => {
      setJoinToastMessage(msg);
    });
    const unsubAuthErr = subscribeAuthBackgroundErrors((msg) => {
      setUnauthorizedNotice(msg);
      setAuthGateError(msg);
      setAuthModalOpen(true);
    });
    const unsubAuthNotice = subscribeAuthBackgroundNotices((msg) => {
      setJoinToastMessage(msg);
    });
    return () => {
      unsubJoinErr();
      unsubTourErr();
      unsubTourSuccess();
      unsubAuthErr();
      unsubAuthNotice();
    };
  }, []);

  const handleJoinClick = (tournament: Tournament) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (isUserCurrentlyBanned(userProfile)) {
      setUnauthorizedNotice(getBanErrorMessage(userProfile));
      return;
    }
    if (isJoinLockedOrJoined(currentUser.uid, tournament.id)) {
      setJoinToastMessage('আপনি ইতিমধ্যে এই ম্যাচে জয়েন করেছেন!');
      return;
    }
    setActiveJoinTournament(tournament);
  };

  const handleJoinSuccess = (_regId: string, playerName?: string) => {
    setActiveJoinTournament(null);
    setJoinToastMessage(
      playerName
        ? `JOINED! ${playerName} নামে স্লট বুক হয়েছে!`
        : 'JOINED! আপনার স্লট কনফার্ম হয়েছে!'
    );
  };

  const handleDepositRedirect = () => {
    setActiveJoinTournament(null);
    handleNavigate('wallet', { tab: 'deposit' });
  };

  if (authLoading) {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-[#070B18] text-white">
        {showSplash ? (
          <SplashScreen onComplete={handleSplashComplete} />
        ) : (
          <div className="text-xs font-gaming tracking-widest uppercase text-slate-400">
            Loading TX TOUR BD...
          </div>
        )}
      </div>
    );
  }

  if (!currentUser) {
    const showPreLoginInstall = !isStandalone && !continueToLogin && currentPage !== 'adminLogin';

    return (
      <div className="w-full h-[100dvh] flex flex-col bg-[#050914] overflow-hidden relative select-none">
        {currentPage === 'adminLogin' ? (
          <div className="flex-1 w-full overflow-y-auto bg-[#070B18]">
            <AdminLoginPage
              onSuccess={() => handleNavigate('admin')}
              onBack={() => handleNavigate('home')}
            />
          </div>
        ) : showPreLoginInstall ? (
          <PreLoginInstallScreen
            onContinueToLogin={() => setContinueToLogin(true)}
            onSecretAdminEntry={() => handleNavigate('adminLogin')}
          />
        ) : (
          <KbdAuthScreen
            externalError={authGateError}
            onClearExternalError={() => setAuthGateError(null)}
            onLoginSuccess={() => handleNavigate('home')}
            onSecretAdminEntry={() => handleNavigate('adminLogin')}
          />
        )}

        <PWAInstallModal />

        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

        {banAlertMessage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-3xl bg-[#0D1428] border-2 border-red-500/70 p-6 text-center space-y-4 shadow-2xl shadow-red-600/25"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/15 border-2 border-red-500/60 text-red-500 flex items-center justify-center mx-auto text-2xl font-black">
                🚫
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-black font-gaming uppercase text-red-400">
                  Account Banned
                </h2>
                <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                  {banAlertMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={clearBanAlert}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black font-gaming text-xs uppercase tracking-wider cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#070B18] text-[#F8FAFC] overflow-hidden relative select-none">
      {/* Standalone Fullscreen Breakout Bar (removes AI Studio top bar & chat when embedded) */}
      <FullscreenBreakoutBar />

      {/* Unauthorized Access Banner */}
      {unauthorizedNotice && (
        <div
          role="alert"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[calc(100%-2rem)] px-4 py-3 rounded-2xl bg-red-950/95 border border-red-500/60 text-red-100 shadow-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-3"
        >
          <span>🚫 {unauthorizedNotice}</span>
          <button
            type="button"
            onClick={() => setUnauthorizedNotice(null)}
            className="text-red-300 hover:text-white text-xs font-extrabold px-2 py-0.5 rounded bg-red-900/60 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Navigation (Only on in-app pages) - Fixed at top with 100% width and border-box */}
      {currentPage !== 'landing' && (
        <div
          className="shrink-0 z-40 w-full max-w-full overflow-x-hidden"
          style={{ width: '100%', boxSizing: 'border-box' }}
        >
          <Navbar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            onNavigateLink={handleNavigateLink}
          />
        </div>
      )}

      {/* Main Page Content - Only scrollable area, normal vertical scrolling */}
      <main
        id="main-scroll-container"
        className={`flex-1 w-full normal-scroll-container ${currentPage === 'landing' ? 'pb-16' : 'pb-[100px]'}`}
      >
        {currentPage === 'install' && (
          <InstallPage onNavigate={handleNavigate} />
        )}

        {(currentPage === 'home' || currentPage === 'landing') && (
          <Home
            onNavigate={handleNavigate}
            onJoinClick={handleJoinClick}
            onNavigateLink={handleNavigateLink}
          />
        )}

        {currentPage === 'tournaments' && (
          <TournamentsList
            onSelectTournament={(tour) =>
              handleNavigate('tournamentDetails', { id: tour.id })
            }
            onJoinTournament={handleJoinClick}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'tournamentDetails' && selectedTournamentId && (
          <TournamentDetails
            tournamentId={selectedTournamentId}
            focusRoom={focusRoomSection}
            onBack={() => handleNavigate('tournaments')}
            onJoinClick={handleJoinClick}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'roomManager' &&
          (authLoading ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400 font-gaming">
              Checking authorization...
            </div>
          ) : isAdmin ? (
            <RoomManagerPage
              onNavigate={handleNavigate}
              onBack={() => {
                if (selectedTournamentId) {
                  handleNavigate('tournamentDetails', { id: selectedTournamentId });
                } else {
                  handleNavigate('tournaments');
                }
              }}
              initialTournamentId={selectedTournamentId || undefined}
            />
          ) : null)}

        {currentPage === 'dashboard' && (
          <PlayerDashboard onNavigate={handleNavigate} />
        )}

        {currentPage === 'myMatches' && (
          <MyMatches onNavigate={handleNavigate} />
        )}

        {currentPage === 'myTeam' && <TeamManagement />}

        {currentPage === 'wallet' && (
          <WalletPage
            initialTab={walletTab}
            onNavigate={handleNavigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentPage === 'leaderboard' && <LeaderboardPage />}

        {currentPage === 'profile' && (
          <ProfilePage
            onNavigate={handleNavigate}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogoutSuccess={handleLogoutToLogin}
          />
        )}

        {currentPage === 'support' && <SupportCenter />}

        {currentPage === 'rules' && <RulesPage />}

        {currentPage === 'referAndEarn' && (
          <ReferAndEarnPage
            onNavigate={handleNavigate}
            onBack={() => handleNavigate('profile')}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentPage === 'admin' &&
          (authLoading ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400 font-gaming">
              Checking authorization...
            </div>
          ) : isAdmin ? (
            <AdminDashboard onNavigate={handleNavigate} initialTab={adminInitialTab} />
          ) : null)}

        {currentPage === 'adminLogin' && (
          <AdminLoginPage
            onSuccess={() => handleNavigate('admin')}
            onBack={() => handleNavigate('home')}
          />
        )}

        {currentPage === 'manageAdmins' &&
          (authLoading ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400 font-gaming">
              Checking authorization...
            </div>
          ) : isAdmin && isSuperAdmin ? (
            <ManageAdminsPage onNavigate={handleNavigate} />
          ) : null)}

        {currentPage === 'banManagement' &&
          (authLoading ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400 font-gaming">
              Checking authorization...
            </div>
          ) : isAdmin ? (
            <BanManagementPage
              onNavigate={handleNavigate}
              onBack={() => handleNavigate('profile')}
            />
          ) : (
            <div className="min-h-screen bg-[#070B18] p-8 text-center text-white flex flex-col items-center justify-center gap-3">
              <h2 className="text-xl font-bold font-gaming text-red-400">
                Access Denied - Admin Only
              </h2>
            </div>
          ))}

        {currentPage === 'winnerPayoutList' &&
          (authLoading ? (
            <div className="min-h-screen flex items-center justify-center text-xs text-slate-400 font-gaming">
              Checking authorization...
            </div>
          ) : isAdmin ? (
            <WinnerPayoutListPage
              onNavigate={handleNavigate}
              onBack={() => handleNavigate('profile')}
            />
          ) : (
            <div className="min-h-screen bg-[#070B18] p-8 text-center text-white flex flex-col items-center justify-center gap-3">
              <h2 className="text-xl font-bold font-gaming text-red-400">
                Only Admin — Access Denied
              </h2>
            </div>
          ))}
      </main>

      {/* Mobile Sticky Bottom Navigation */}
      <MobileBottomNav currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Floating Support Button on Home, Tournaments, and My Matches */}
      {(currentPage === 'home' ||
        currentPage === 'tournaments' ||
        currentPage === 'myMatches') && <FloatingSupportWidget />}

      {/* Global Modals */}
      <JoinTournamentModal
        tournament={activeJoinTournament}
        isOpen={!!activeJoinTournament}
        onClose={() => setActiveJoinTournament(null)}
        onSuccess={handleJoinSuccess}
        onDepositRedirect={handleDepositRedirect}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        onLoginSuccess={() => handleNavigate('home')}
        onSecretAdminEntry={() => handleNavigate('adminLogin')}
      />

      <WelcomeNoticeModal
        isOpen={!showSplash && showWelcomeNotice && currentPage !== 'landing' && currentPage !== 'install'}
        onAccept={() => {
          try {
            sessionStorage.setItem('tx_welcome_shown', 'true');
          } catch {}
          setShowWelcomeNotice(false);
          setCurrentPage((prev) => (prev === 'landing' ? 'home' : prev));
        }}
      />

      {!showSplash && currentPage !== 'landing' && <AnnouncementPopupModal currentPage={currentPage} />}

      <PWAInstallModal />

      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {joinToastMessage && (
        <ToastNotification
          message={joinToastMessage}
          onClose={() => setJoinToastMessage(null)}
        />
      )}

      {/* Banned Account Alert Modal */}
      {banAlertMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-[#0D1428] border-2 border-red-500/70 p-6 text-center space-y-4 shadow-2xl shadow-red-600/25"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/15 border-2 border-red-500/60 text-red-500 flex items-center justify-center mx-auto text-2xl font-black">
              🚫
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black font-gaming uppercase text-red-400">
                Account Banned
              </h2>
              <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                {banAlertMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={clearBanAlert}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black font-gaming text-xs uppercase tracking-wider cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <PWAInstallProvider>
            <MainApp />
          </PWAInstallProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
