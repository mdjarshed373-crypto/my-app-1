import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  AppNotification,
  Tournament,
  PlatformAnnouncement,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MatchCard } from '../components/tournament/MatchCard';
import { fetchTournaments, deleteTournamentInstant, fetchUserRegistrations } from '../services/tournamentService';
import {
  OptimisticJoinEntry,
  subscribeOptimisticJoins,
} from '../services/optimisticJoinStore';
import {
  OptimisticTournamentEntry,
  mergeOptimisticTournaments,
  subscribeOptimisticTournaments,
} from '../services/optimisticTournamentStore';
import { DeleteTournamentModal } from '../components/tournament/DeleteTournamentModal';
import { ToastNotification } from '../components/common/ToastNotification';
import { UserAvatar } from '../components/common/UserAvatar';
import { HomeReferEarnCard } from '../components/home/HomeReferEarnCard';
import {
  subscribeAnnouncements,
  getSeenAnnouncementIds,
  markAnnouncementsAsSeen,
} from '../services/announcementService';
import {
  markNotificationAsRead,
  subscribeUserNotifications,
} from '../services/notificationService';
import { TopNoticeBanner } from '../components/common/TopNoticeBanner';
import { NoticeListModal } from '../components/common/NoticeListModal';
import { CategoryRulesSection } from '../components/tournament/CategoryRulesSection';
import { getTournamentCategory } from '../constants/categoryRules';
import { subscribePendingWithdrawals } from '../services/walletService';
import { usePWAInstall } from '../context/PWAInstallContext';
import {
  Trophy,
  Swords,
  Users,
  ShieldCheck,
  Zap,
  Flame,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle,
  Smartphone,
  ChevronRight,
  Plus,
  Gamepad2,
  RefreshCw,
  Bell,
  X,
} from 'lucide-react';
import { TXLogo } from '../components/common/TXLogo';

interface HomeProps {
  onNavigate: (page: string, params?: any) => void;
  onJoinClick: (tournament: Tournament) => void;
  onNavigateLink?: (url: string) => void;
}

export interface CategoryItem {
  id: string;
  name: string;
  displayName?: string;
  image: string;
  badge: string;
  description: string;
}

export const CATEGORIES: CategoryItem[] = [
  {
    id: 'CS 1V1, 2V2',
    name: 'CS 1V1, 2V2',
    image: '/assets/categories/cat4_cs_4v4.jpg',
    badge: 'CLASH SQUAD',
    description: 'Tactical Clash Squad 1v1 & 2v2 team showdowns',
  },
  {
    id: 'BR MATCH',
    name: 'BR MATCH',
    image: '/assets/aistudio/SAVE_20261111_140849_3c32b90d.jpg',
    badge: 'BATTLE ROYALE',
    description: 'Classic Free Fire survival Battle Royale matches',
  },
  {
    id: 'LONE WOLF',
    name: 'LONE WOLF',
    image: '/assets/categories/cat3_lone_wolf.jpg',
    badge: '1V1 COMBAT',
    description: 'Intense 1v1 duel matches to test pure skills',
  },
  {
    id: 'LONE WOLF HEADSHOT',
    name: 'LONE WOLF HEADSHOT',
    image: '/assets/aistudio/IMG-20261115-WA4224_90e1a792.jpg',
    badge: 'HEADSHOT ONLY',
    description: 'One-tap headshot only skill challenge matches',
  },
  {
    id: 'LOST TO WIN',
    name: 'LOST TO WIN',
    image: '/assets/aistudio/Loss_to_Win__Wolf_Arena_Showdown_199babce.png',
    badge: 'SPECIAL REWARD',
    description: 'Comeback tournament with special reward pools',
  },
  {
    id: 'FREE MATCH',
    name: 'FREE MATCH',
    displayName: 'SPECIAL MATCH',
    image: '/assets/aistudio/IMG-20261119-WA4163_e7319484.jpg',
    badge: 'FREE ENTRY',
    description: 'Free to enter tournaments with cash prizes',
  },
];

export { getTournamentCategory };

export const Home: React.FC<HomeProps> = ({ onNavigate, onJoinClick, onNavigateLink }) => {
  const { language, t } = useLanguage();
  const { currentUser, userProfile, isAdmin, refreshProfile } = useAuth();
  const { triggerInstall, isInstalled } = usePWAInstall();

  const [tournaments, setTournaments] = useState<Tournament[]>(() => {
    try {
      const cached = sessionStorage.getItem('tx_cached_home_tournaments_v1');
      if (cached) {
        const parsed = JSON.parse(cached) as Tournament[];
        if (Array.isArray(parsed)) {
          return mergeOptimisticTournaments(parsed);
        }
      }
    } catch {}
    return mergeOptimisticTournaments([]);
  });
  const [optimisticTours, setOptimisticTours] = useState<OptimisticTournamentEntry[]>([]);
  const [registeredTourIds, setRegisteredTourIds] = useState<Set<string>>(new Set());
  const [optimisticJoins, setOptimisticJoins] = useState<OptimisticJoinEntry[]>([]);
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('tx_cached_home_tournaments_v1');
      if (cached) {
        const parsed = JSON.parse(cached) as Tournament[];
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {}
    return mergeOptimisticTournaments([]).length === 0;
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Delete Tournament modal & toast
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeletingTour, setIsDeletingTour] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Tap vs scroll guard: if finger moves > 10px in any direction, treat as scroll/drag and do NOT trigger click!
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDragActionRef = useRef<boolean>(false);

  const handleCardTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      isDragActionRef.current = false;
    }
  };

  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length === 0) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      isDragActionRef.current = true;
    }
  };

  const handleCardTouchEnd = () => {
    if (isDragActionRef.current) {
      setTimeout(() => {
        isDragActionRef.current = false;
        touchStartPosRef.current = null;
      }, 50);
    } else {
      touchStartPosRef.current = null;
    }
  };

  const handleSelectCategory = (catName: string) => {
    if (isDragActionRef.current) {
      return;
    }
    setSelectedCategory(catName);
  };

  // Admin Announcements, Personal Notifications & Notice Modal
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [userNotifications, setUserNotifications] = useState<AppNotification[]>([]);
  const [noticeModalOpen, setNoticeModalOpen] = useState<boolean>(false);
  const [seenAnnouncementIds, setSeenAnnouncementIds] = useState<Set<string>>(() =>
    getSeenAnnouncementIds(currentUser?.uid)
  );
  const [pendingWithdrawCount, setPendingWithdrawCount] = useState<number>(0);

  useEffect(() => {
    setSeenAnnouncementIds(getSeenAnnouncementIds(currentUser?.uid));
    if (!currentUser?.uid) {
      setUserNotifications([]);
      return;
    }
    const unsub = subscribeUserNotifications(currentUser.uid, setUserNotifications);
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingWithdrawCount(0);
      return;
    }
    const unsub = subscribePendingWithdrawals((list) => {
      setPendingWithdrawCount(list.length);
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    const unsubAnnouncements = subscribeAnnouncements(setAnnouncements);
    const handleSeenSync = () => {
      setSeenAnnouncementIds(getSeenAnnouncementIds(currentUser?.uid));
    };
    window.addEventListener('tx:announcements-seen', handleSeenSync);
    return () => {
      unsubAnnouncements();
      window.removeEventListener('tx:announcements-seen', handleSeenSync);
    };
  }, [currentUser?.uid]);

  const unreadNoticeCount =
    announcements.filter((ann) => !seenAnnouncementIds.has(ann.id)).length +
    userNotifications.filter((n) => !n.read).length;

  const handleOpenCategoryNoticeModal = () => {
    setNoticeModalOpen(true);
    const allIds = announcements.map((a) => a.id);
    markAnnouncementsAsSeen(allIds, currentUser?.uid);
    setSeenAnnouncementIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
    const unreadPersonal = userNotifications.filter((n) => !n.read);
    if (unreadPersonal.length > 0) {
      setUserNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      Promise.all(unreadPersonal.map((n) => markNotificationAsRead(n.id))).catch(() => {});
    }
  };

  const handleHomeNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id).catch(() => {});
    }
    setNoticeModalOpen(false);
    if (notif.link && onNavigateLink) {
      onNavigateLink(notif.link);
    }
  };

  const persistHomeTournamentsCache = useCallback((list: Tournament[]) => {
    try {
      const lightweight = list.slice(0, 30).map((t) => {
        if (t.bannerUrl && t.bannerUrl.startsWith('data:') && t.bannerUrl.length > 4096) {
          const { bannerUrl: _omit, ...rest } = t;
          return rest;
        }
        return t;
      });
      sessionStorage.setItem('tx_cached_home_tournaments_v1', JSON.stringify(lightweight));
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    try {
      const tList = await fetchTournaments();
      setTournaments(tList);
      persistHomeTournamentsCache(tList);

      if (currentUser?.uid) {
        const regs = await fetchUserRegistrations(currentUser.uid);
        setRegisteredTourIds(new Set(regs.map((r) => r.tournamentId)));
      } else {
        setRegisteredTourIds(new Set());
      }
      setRefreshTick(Date.now());
    } catch (err) {
      console.error('Error loading home data', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, persistHomeTournamentsCache]);

  useEffect(() => {
    loadData();
    const unsub = onSnapshot(
      collection(db, 'tournaments'),
      (snap) => {
        const list: Tournament[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Tournament), id: d.id });
        });
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setTournaments(list);
        persistHomeTournamentsCache(list);
        setLoading(false);
      },
      () => {
        // Ignore transient listener errors; loadData provides initial fetch
      }
    );
    return () => unsub();
  }, [loadData]);

  useEffect(() => {
    return subscribeOptimisticTournaments(setOptimisticTours);
  }, []);

  useEffect(() => {
    return subscribeOptimisticJoins(currentUser?.uid, setOptimisticJoins);
  }, [currentUser?.uid]);

  const effectiveTournaments = React.useMemo(
    () => mergeOptimisticTournaments(tournaments),
    [tournaments, optimisticTours]
  );

  const effectiveRegisteredTourIds = React.useMemo(() => {
    if (optimisticJoins.length === 0) return registeredTourIds;
    const merged = new Set(registeredTourIds);
    optimisticJoins.forEach((entry) => merged.add(entry.tournamentId));
    return merged;
  }, [registeredTourIds, optimisticJoins]);

  // Combined data & balance refresh without reloading the page or app
  const executeDataRefresh = useCallback(async () => {
    try {
      await Promise.all([
        loadData(),
        refreshProfile ? refreshProfile() : Promise.resolve(),
      ]);
    } catch (err) {
      console.error('Error refreshing home data & balance', err);
    }
  }, [loadData, refreshProfile]);

  const handleRefreshMatches = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        executeDataRefresh(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRequestDelete = (tournament: Tournament) => {
    if (!isAdmin) return;
    setTournamentToDelete(tournament);
  };

  const handleConfirmDelete = () => {
    if (!isAdmin || !tournamentToDelete) return;
    const targetTour = tournamentToDelete;
    const tourId = targetTour.id;

    const res = deleteTournamentInstant({
      id: tourId,
      onBackgroundFailed: (_failedId, errMsg) => {
        setTournaments((prev) => mergeOptimisticTournaments([targetTour, ...prev]));
        setToastMessage(errMsg || 'টুর্নামেন্ট ডিলিট করতে সমস্যা হয়েছে');
      },
    });

    if (!res.started) return;

    setTournaments((prev) => prev.filter((t) => t.id !== tourId));
    setTournamentToDelete(null);
    setToastMessage('Success! টুর্নামেন্ট ডিলিট হয়েছে!');
  };

  // Filtered matches for the active category
  const categoryTournaments = selectedCategory
    ? effectiveTournaments.filter((t) => getTournamentCategory(t) === selectedCategory)
    : [];
  const selectedCategoryDisplayName = selectedCategory
    ? CATEGORIES.find((c) => c.name === selectedCategory)?.displayName || selectedCategory
    : null;

  const steps = [
    {
      step: '০১',
      title: language === 'bn' ? 'ফ্রি একাউন্ট খুলুন' : 'Create Account',
      desc:
        language === 'bn'
          ? 'নাম, ফোন ও Free Fire UID দিয়ে কয়েক সেকেন্ডে আপনার প্লেয়ার প্রোফাইল তৈরি করুন।'
          : 'Set up your player profile in seconds with your name, phone & Free Fire UID.',
    },
    {
      step: '০২',
      title: language === 'bn' ? 'ওয়ালেট রিচার্জ করুন' : 'Add Funds to Wallet',
      desc:
        language === 'bn'
          ? 'বিকাশ বা নগদের মাধ্যমে নিরাপদে ওয়ালেটে টাকা ডিপোজিট করুন।'
          : 'Quick and safe deposits using bKash or Nagad mobile wallets.',
    },
    {
      step: '০৩',
      title: language === 'bn' ? 'স্লট বুক করুন' : 'Book Match Slot',
      desc:
        language === 'bn'
          ? 'সোলো, ডুও অথবা স্কোয়াড টুর্নামেন্ট বেছে নিয়ে আপনার পছন্দের স্লট নিশ্চিত করুন।'
          : 'Choose your preferred Solo, Duo, or Squad match and confirm your slot.',
    },
    {
      step: '০৪',
      title: language === 'bn' ? 'রুম আইডি পেয়ে প্রাইজ জিতুন' : 'Get Room ID & Win Cash',
      desc:
        language === 'bn'
          ? 'ম্যাচ শুরুর আগে রুম ক্রেডেনশিয়ালস নিন, যুদ্ধ জয় করে জিতে নিন নগদ টাকা।'
          : 'Receive match room details on time, dominate the match, and collect real cash prizes.',
    },
  ];

  const features = [
    {
      icon: Zap,
      title: language === 'bn' ? 'তাৎক্ষণিক রুম আইডি' : 'Instant Room Credentials',
      desc:
        language === 'bn'
          ? 'ম্যাচ শুরুর ঠিক ১০-১৫ মিনিট পূর্বে প্ল্যাটফর্মে অটোমেটিক সঠিক রুম আইডি ও পাসওয়ার্ড প্রকাশ পায়।'
          : 'Accurate Room ID & Password published automatically 10-15 minutes prior to match schedule.',
    },
    {
      icon: Trophy,
      title: language === 'bn' ? 'গ্যারান্টিড প্রাইজ পেআউট' : 'Guaranteed Prize Payouts',
      desc:
        language === 'bn'
          ? 'ম্যাচ সমাপ্তির পর ফলাফল যাচাই করে তাৎক্ষণিকভাবে ওয়ালেটে উইনিং ব্যালেন্স যোগ হয়।'
          : 'Winnings credited swiftly to player wallets and withdrawable directly to bKash or Nagad.',
    },
    {
      icon: ShieldCheck,
      title: language === 'bn' ? '১০০% ফেয়ার প্লে ও নো হ্যাক' : '100% Anti-Cheat & Fair Play',
      desc:
        language === 'bn'
          ? 'এমুলেটর নিষিদ্ধ ও সার্বক্ষণিক অ্যাডমিন পর্যবেক্ষণ। কোনো হ্যাকারকে প্রশ্রয় দেওয়া হয় না।'
          : 'Strict anti-cheat policy, emulator bans, and dedicated esports moderators overseeing matches.',
    },
    {
      icon: Smartphone,
      title: language === 'bn' ? 'মোবাইল ফ্রেন্ডলি প্ল্যাটফর্ম' : 'Mobile First Experience',
      desc:
        language === 'bn'
          ? 'স্মার্টফোনে অত্যন্ত মসৃণ এবং দ্রুতগতির ইন্টারফেস, যাতে গেমাররা নির্বিঘ্নে খেলতে পারেন।'
          : 'Engineered specifically for low-latency smartphone navigation and quick slot reservation.',
    },
  ];

  return (
    <div className="w-full bg-slate-100 dark:bg-[#070B18] text-slate-900 dark:text-white touch-pan-y relative overflow-x-hidden transition-colors">
      {/* VIEW 1: CATEGORY DETAIL VIEW (When a category box is clicked) */}
      {selectedCategory !== null ? (
        <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
          {/* Top Bar with Back Button + Title + Top-Right Round Refresh Button */}
          <div className="flex items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-[#1a2b4f] text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 text-xs font-black font-gaming flex items-center gap-2 transition-all cursor-pointer shadow-sm dark:shadow-md dark:shadow-black/40 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>BACK TO CATEGORIES</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-3xl font-black font-gaming tracking-wider text-slate-900 dark:text-white uppercase">
                    {selectedCategoryDisplayName}
                  </h2>
                  <span className="px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-mono text-xs font-bold border border-sky-200 dark:border-sky-500/40">
                    Match Found: {categoryTournaments.length}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Live Free Fire esports matches in this category
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenCategoryNoticeModal}
                aria-label={`Notifications (${unreadNoticeCount})`}
                title="View Notices"
                className="px-2.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-500/45 text-red-600 dark:text-red-500 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Bell className="w-4 h-4 text-red-600 dark:text-red-500 fill-red-500/20" />
                {unreadNoticeCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black font-gaming leading-none">
                    {unreadNoticeCount}
                  </span>
                )}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin', pendingWithdrawCount > 0 ? { tab: 'withdrawals' } : undefined)}
                  className="relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span className="hidden sm:inline">CREATE MATCH</span>
                  {pendingWithdrawCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black leading-none tabular-nums shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{pendingWithdrawCount}</span>
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleRefreshMatches}
                disabled={isRefreshing}
                aria-label="Refresh Matches"
                title="Refresh"
                className="w-9 h-9 rounded-full bg-white dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-[#1a2b4f] border border-sky-200 dark:border-sky-500/35 hover:border-sky-400 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm dark:shadow-md dark:shadow-black/40 transition-all cursor-pointer active:scale-95 disabled:opacity-75 shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 text-sky-600 dark:text-sky-400 stroke-[2.4] ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Category Tournament Cards List */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[440px] rounded-3xl bg-white dark:bg-[#0D1428] animate-pulse border border-slate-200 dark:border-slate-800"></div>
              ))}
            </div>
          ) : categoryTournaments.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl max-w-lg mx-auto space-y-3 my-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 mx-auto shadow-inner">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-black font-gaming tracking-wide text-slate-900 dark:text-white">
                Match Found: 0
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                বর্তমানে <span className="text-sky-600 dark:text-sky-300 font-bold">{selectedCategoryDisplayName}</span> ক্যাটাগরিতে কোনো ম্যাচ নেই। এডমিন প্যানেল থেকে খুব শীঘ্রই নতুন ম্যাচ দেওয়া হবে।
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-[#1a2b4f] text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-gaming text-xs font-bold transition-all cursor-pointer"
                >
                  অন্যান্য ক্যাটাগরি দেখুন
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigate('admin', pendingWithdrawCount > 0 ? { tab: 'withdrawals' } : undefined)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-gaming text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    <span>নতুন ম্যাচ তৈরি করুন</span>
                    {pendingWithdrawCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black leading-none tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>{pendingWithdrawCount}</span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
              {categoryTournaments.map((tournament, idx) => (
                <MatchCard
                  key={tournament.id}
                  tournament={tournament}
                  matchNumber={idx + 1}
                  onSelect={(tour) => onNavigate('tournamentDetails', { id: tour.id })}
                  onJoin={(tour) => onJoinClick(tour)}
                  onDelete={isAdmin ? handleRequestDelete : undefined}
                  onTimeUpdated={(updated, message) => {
                    setTournaments((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item))
                    );
                    setToastMessage(message);
                  }}
                  isRegistered={effectiveRegisteredTourIds.has(tournament.id)}
                  refreshTick={refreshTick}
                />
              ))}
            </div>
          )}

          {/* Category Rules Section */}
          <CategoryRulesSection category={selectedCategory} />
        </section>
      ) : (
        /* VIEW 2: 2-COLUMN GRID OF 6 CATEGORY BOXES */
        <section className="pt-6 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
          {/* Top Header Bar: TX TOUR BD + GAME LOBBY */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 flex items-center gap-3 shadow-lg dark:shadow-xl">
            <div className="flex items-center gap-3">
              {userProfile ? (
                <button
                  type="button"
                  onClick={() => onNavigate('profile')}
                  title="Open Profile"
                  className="rounded-full cursor-pointer transition-transform active:scale-95 shrink-0"
                >
                  <UserAvatar user={userProfile} size="md" />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm shrink-0">
                  <Gamepad2 className="w-5 h-5" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-xl font-black font-gaming tracking-wide text-slate-900 dark:text-white uppercase flex items-center gap-2">
                  <span>TX TOUR BD</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-600/30 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-400/30 font-bold">
                    GAME LOBBY
                  </span>
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  নিচের পছন্দের ক্যাটাগরি বেছে নিয়ে টুর্নামেন্টে জয়েন করুন
                </p>
              </div>
            </div>
          </div>

          {/* Latest Admin Notice right below TX TOUR BD banner */}
          <TopNoticeBanner
            announcements={announcements}
            userId={currentUser?.uid}
            language={language}
          />

          {/* 6 CATEGORY SLOT BOXES */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-6">
            {CATEGORIES.map((cat) => {
              // Dynamic live count of actual tournaments in this category
              const count = effectiveTournaments.filter(
                (t) => getTournamentCategory(t) === cat.name
              ).length;

              return (
                <div
                  key={cat.id}
                  onTouchStart={handleCardTouchStart}
                  onTouchMove={handleCardTouchMove}
                  onTouchEnd={handleCardTouchEnd}
                  onClick={() => handleSelectCategory(cat.name)}
                  className="group cursor-pointer flex flex-col transition-colors duration-150 select-none touch-pan-y"
                >
                  {/* Category Image Box */}
                  <div className="w-full aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-300 dark:border-slate-700/80 group-hover:border-sky-500 dark:group-hover:border-slate-500 bg-slate-900 shadow-lg dark:shadow-xl dark:shadow-black/50 transition-all duration-300 relative flex items-center justify-center">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        cat.id === 'LONE WOLF HEADSHOT'
                          ? 'object-center scale-[1.08] group-hover:scale-[1.12]'
                          : 'group-hover:scale-105'
                      }`}
                      loading="lazy"
                    />
                  </div>

                  {/* Below Image: Name + "Match Found: X" */}
                  <div className="pt-2.5 sm:pt-3 px-1 sm:px-1.5 flex flex-col gap-0.5 sm:gap-1">
                    <h3 className="text-sm sm:text-base font-black font-gaming tracking-wider text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors uppercase leading-snug">
                      {cat.displayName || cat.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          count > 0 ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
                        }`}
                      ></span>
                      <span className="text-xs sm:text-sm font-bold font-gaming text-slate-600 dark:text-slate-300">
                        Match Found:{' '}
                        <span
                          className={
                            count > 0 ? 'text-sky-600 dark:text-sky-400 font-black' : 'text-slate-500 dark:text-slate-400 font-bold'
                          }
                        >
                          {count}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* REFER & EARN */}
          <HomeReferEarnCard onNavigate={onNavigate} />
        </section>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteTournamentModal
        isOpen={isAdmin && !!tournamentToDelete}
        tournamentTitle={tournamentToDelete?.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTournamentToDelete(null)}
        isDeleting={isDeletingTour}
      />

      {/* Notice List Modal for Category Bell Button */}
      <NoticeListModal
        isOpen={noticeModalOpen}
        onClose={() => setNoticeModalOpen(false)}
        announcements={announcements}
        notifications={userNotifications}
        language={language}
        userId={currentUser?.uid}
        onNotificationClick={handleHomeNotificationClick}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <ToastNotification
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
