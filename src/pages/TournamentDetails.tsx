import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Tournament, TournamentRegistration, RoomCredential } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchTournamentById,
  fetchRegistrationsForTournament,
  fetchRoomCredentials,
  deleteTournamentInstant,
  updateTournament,
} from '../services/tournamentService';
import {
  OptimisticJoinEntry,
  subscribeOptimisticJoins,
} from '../services/optimisticJoinStore';
import { emitOptimisticTournamentSuccess } from '../services/optimisticTournamentStore';
import { DeleteTournamentModal } from '../components/tournament/DeleteTournamentModal';
import { EditMatchTimeModal } from '../components/tournament/EditMatchTimeModal';
import { ToastNotification } from '../components/common/ToastNotification';
import { CategoryRulesSection } from '../components/tournament/CategoryRulesSection';
import { UserAvatar } from '../components/common/UserAvatar';
import { isUserAdminAccount } from '../utils/adminAuth';
import {
  getTournamentCategory,
  formatGameModeLabel,
  formatEntryTypeLabel,
  getMatchBannerUrl,
  isPlacementPrizeCategory,
  parseMatchDateAndTime,
  resolveTournamentBannerUrl,
  supportsPerKillPrize,
} from '../constants/categoryRules';
import {
  Calendar,
  Clock,
  Trophy,
  Users,
  KeyRound,
  Copy,
  Check,
  MapPin,
  ArrowLeft,
  Swords,
  Lock,
  Trash2,
  BookOpen,
  Eye,
  EyeOff,
  Shield,
  Key,
  Pencil,
} from 'lucide-react';

interface TournamentDetailsProps {
  tournamentId: string;
  focusRoom?: boolean;
  onBack: () => void;
  onJoinClick: (tournament: Tournament) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const TournamentDetails: React.FC<TournamentDetailsProps> = ({
  tournamentId,
  focusRoom = false,
  onBack,
  onJoinClick,
  onNavigate,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { language, t, formatBDT } = useLanguage();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [serverRegistrations, setServerRegistrations] = useState<TournamentRegistration[]>([]);
  const [optimisticJoin, setOptimisticJoin] = useState<OptimisticJoinEntry | null>(null);
  const [roomData, setRoomData] = useState<RoomCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'participants' | 'rules'>('matches');
  const [bannerError, setBannerError] = useState(false);
  const [highlightRoomBox, setHighlightRoomBox] = useState(false);

  // DUAL TIMER: Timer 1 (Global Clock) & Timer 2 (Match Countdown)
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return subscribeOptimisticJoins(currentUser?.uid, (entries) => {
      const match = entries.find((entry) => entry.tournamentId === tournamentId) || null;
      setOptimisticJoin(match);
    });
  }, [currentUser?.uid, tournamentId]);

  useEffect(() => {
    setActiveTab('matches');
    setBannerError(false);
    loadDetails();

    if (!tournamentId) return;
    const unsubTour = onSnapshot(
      doc(db, 'tournaments', tournamentId),
      (snap) => {
        if (snap.exists()) {
          setTournament({ ...(snap.data() as Tournament), id: snap.id });
        }
      },
      () => {
        // Fallback already handled via loadDetails
      }
    );

    const regsQuery = query(
      collection(db, 'registrations'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubRegs = onSnapshot(
      regsQuery,
      (snap) => {
        const list: TournamentRegistration[] = [];
        snap.forEach((d) => {
          const reg = d.data() as TournamentRegistration;
          if (reg.status !== 'CANCELLED' && reg.status !== 'REJECTED') {
            list.push({ ...reg, id: reg.id || d.id });
          }
        });
        list.sort((a, b) => a.slotNumber - b.slotNumber);
        setServerRegistrations(list);
      },
      () => {
        // Fallback handled via loadDetails
      }
    );

    return () => {
      unsubTour();
      unsubRegs();
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!focusRoom || loading || !tournament) return;
    setActiveTab('matches');
    setHighlightRoomBox(true);
    fetchRoomCredentials(tournament.id)
      .then((freshRoom) => {
        if (freshRoom) setRoomData(freshRoom);
      })
      .catch(() => {});
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById('room-credentials-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 180);
    const clearTimer = setTimeout(() => setHighlightRoomBox(false), 4500);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [focusRoom, loading, tournament?.id]);

  const handleToggleParticipantsVisibility = async () => {
    if (!tournament) return;
    const nextVal = tournament.showParticipants === false ? true : false;
    try {
      await updateTournament(tournament.id, { showParticipants: nextVal });
      setTournament({ ...tournament, showParticipants: nextVal });
      setToastMessage(
        nextVal
          ? 'প্লেয়ার লিস্ট দৃশ্যমান করা হয়েছে (Participants Visible)'
          : 'প্লেয়ার লিস্ট গোপন করা হয়েছে (Participants Hidden)'
      );
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  const handleConfirmDelete = () => {
    if (!isAdmin || !tournament) return;
    const res = deleteTournamentInstant({
      id: tournament.id,
    });
    if (!res.started) return;

    setShowDeleteModal(false);
    emitOptimisticTournamentSuccess('Success! টুর্নামেন্ট ডিলিট হয়েছে!');
    onBack();
  };

  const loadDetails = async () => {
    try {
      const [tour, regs, room] = await Promise.all([
        fetchTournamentById(tournamentId),
        fetchRegistrationsForTournament(tournamentId),
        fetchRoomCredentials(tournamentId),
      ]);
      setTournament(tour);
      setServerRegistrations(regs);
      setRoomData(room);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const registrations = useMemo(() => {
    if (!optimisticJoin) return serverRegistrations;
    const alreadyPresent = serverRegistrations.some(
      (r) =>
        r.id === optimisticJoin.registration.id ||
        (currentUser?.uid && r.userId === currentUser.uid)
    );
    if (alreadyPresent) return serverRegistrations;
    return [...serverRegistrations, optimisticJoin.registration].sort(
      (a, b) => a.slotNumber - b.slotNumber
    );
  }, [serverRegistrations, optimisticJoin, currentUser?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] flex items-center justify-center p-8 transition-colors">
        <div className="w-10 h-10 border-4 border-sky-500 dark:border-sky-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-16 px-4 text-center transition-colors">
        <p className="text-slate-900 dark:text-white text-lg font-bold">টুর্নামেন্ট পাওয়া যায়নি!</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold shadow-sm cursor-pointer"
        >
          ফিরে যান
        </button>
      </div>
    );
  }

  const isUserRegistered = Boolean(
    optimisticJoin ||
      (currentUser &&
        registrations.some(
          (r) =>
            r.userId === currentUser.uid ||
            (r.playerUids && r.playerUids.includes(currentUser.uid))
        ))
  );

  const totalSlots = Math.max(1, Number(tournament.maxSlots) || 12);
  const displayRegisteredCount = Math.min(
    totalSlots,
    Math.max(
      Number(tournament.registeredCount || 0),
      registrations.length,
      optimisticJoin ? optimisticJoin.expectedRegisteredCount : 0
    )
  );
  const isFull = displayRegisteredCount >= totalSlots;
  const isAvailable =
    tournament.status === 'REGISTRATION_OPEN' && !isFull && !isUserRegistered;

  // Build dynamic slots from #1 up to totalSlots (e.g. 12 slots, 24 slots, etc.)
  const slotMap = new Map<number, TournamentRegistration>();
  const unslottedRegistrations: TournamentRegistration[] = [];

  registrations.forEach((reg) => {
    const sn = Number(reg.slotNumber);
    if (sn >= 1 && sn <= totalSlots && !slotMap.has(sn)) {
      slotMap.set(sn, reg);
    } else {
      unslottedRegistrations.push(reg);
    }
  });

  let nextAvailableSlot = 1;
  unslottedRegistrations.forEach((reg) => {
    while (nextAvailableSlot <= totalSlots && slotMap.has(nextAvailableSlot)) {
      nextAvailableSlot++;
    }
    if (nextAvailableSlot <= totalSlots) {
      slotMap.set(nextAvailableSlot, reg);
      nextAvailableSlot++;
    }
  });

  const allSlots = Array.from({ length: totalSlots }, (_, idx) => {
    const slotNum = idx + 1;
    return {
      slotNumber: slotNum,
      registration: slotMap.get(slotNum) || null,
    };
  });

  const matchCategory = getTournamentCategory(tournament);
  const resolvedBannerSrc = bannerError
    ? getMatchBannerUrl(matchCategory)
    : resolveTournamentBannerUrl(tournament);

  // DUAL TIMER CALCULATIONS:
  // Timer 1: Live Global Clock (increments forward like a clock)
  const globalClock = now.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Timer 2: Tournament Countdown (decreases towards 00:00:00, then shows Match Started / Live)
  const matchTarget = parseMatchDateAndTime(tournament.matchDate, tournament.matchTime);
  const normalizedStatus = String(tournament.status || '').toUpperCase();
  const isVerifiedAdminActor = Boolean(
    currentUser &&
      isAdmin &&
      (!userProfile || isUserAdminAccount(userProfile, currentUser.email))
  );
  const canEditMatchTime =
    isVerifiedAdminActor &&
    normalizedStatus !== 'ONGOING' &&
    normalizedStatus !== 'COMPLETED' &&
    normalizedStatus !== 'CANCELLED' &&
    (!matchTarget || matchTarget.getTime() > now.getTime());

  let isLive = tournament.status === 'ONGOING';
  let countdownText = 'Match Started / Live';

  if (tournament.status === 'COMPLETED') {
    countdownText = 'ENDED';
  } else if (tournament.status === 'CANCELLED') {
    countdownText = 'CANCELLED';
  } else if (matchTarget) {
    const diffSec = Math.floor((matchTarget.getTime() - now.getTime()) / 1000);
    if (diffSec <= 0) {
      isLive = true;
      countdownText = 'Match Started / Live';
    } else {
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        countdownText = `${days}d ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`;
      } else {
        countdownText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }
    }
  }

  const copyToClipboard = (text: string, type: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto transition-colors">
      {/* Top Bar with Back and Delete Actions */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'bn' ? 'সব টুর্নামেন্টে ফিরে যান' : 'Back to Tournaments'}</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'টুর্নামেন্ট ডিলিট' : 'Delete Tournament'}</span>
          </button>
        )}
      </div>

      {/* Top Tabs: Matches / Participants / Rules */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/25 mb-6 shadow-md dark:shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold font-gaming text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'matches'
              ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-sky-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#111D35]'
          }`}
        >
          <Swords className="w-4 h-4 shrink-0" />
          <span>Matches</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold font-gaming text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'participants'
              ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-sky-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#111D35]'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Participants</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold font-gaming text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'rules'
              ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-sky-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#111D35]'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Rules</span>
        </button>
      </div>

      {activeTab === 'rules' ? (
        <div className="space-y-6">
          {/* Compact Match Header Context inside Rules Tab */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md dark:shadow-lg">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-black font-gaming text-xs tracking-wider">
                  {formatEntryTypeLabel(tournament)}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-sky-50 dark:bg-[#111D35] text-sky-700 dark:text-sky-400 font-bold text-xs border border-sky-200 dark:border-sky-500/30">
                  {matchCategory}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {displayRegisteredCount} / {totalSlots} Slots
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black font-gaming tracking-wide text-slate-900 dark:text-white">
                {language === 'bn' && tournament.titleBn ? tournament.titleBn : tournament.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => (onNavigate ? onNavigate('roomManager', { id: tournament.id }) : null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming tracking-wider text-xs shadow-lg shadow-[#CFA84B]/25 active:scale-95 transition-all cursor-pointer uppercase flex items-center gap-1.5 border border-[#F4D77A]/60"
                >
                  <Key className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  <span>GIVE ROOM</span>
                </button>
              )}
              {isUserRegistered ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40 font-bold font-gaming tracking-wider text-xs flex items-center gap-2 shrink-0">
                  <Check className="w-4 h-4" />
                  <span>JOINED</span>
                </div>
              ) : isAvailable ? (
                <button
                  type="button"
                  onClick={() => onJoinClick(tournament)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold font-gaming tracking-wider text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer uppercase shrink-0"
                >
                  JOIN NOW
                </button>
              ) : null}
            </div>
          </div>

          {/* Game Rules for this match */}
          <CategoryRulesSection category={matchCategory} />
        </div>
      ) : activeTab === 'participants' ? (
        <div className="space-y-5">
          {/* Match Context Header */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md dark:shadow-lg">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-black font-gaming text-xs tracking-wider">
                  {formatEntryTypeLabel(tournament)}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-sky-50 dark:bg-[#111D35] text-sky-700 dark:text-sky-400 font-bold text-xs border border-sky-200 dark:border-sky-500/30">
                  {matchCategory}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {displayRegisteredCount} / {totalSlots} Slots
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black font-gaming tracking-wide text-slate-900 dark:text-white">
                {language === 'bn' && tournament.titleBn ? tournament.titleBn : tournament.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => (onNavigate ? onNavigate('roomManager', { id: tournament.id }) : null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming tracking-wider text-xs shadow-lg shadow-[#CFA84B]/25 active:scale-95 transition-all cursor-pointer uppercase flex items-center gap-1.5 border border-[#F4D77A]/60"
                >
                  <Key className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  <span>GIVE ROOM</span>
                </button>
              )}
              {isUserRegistered ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40 font-bold font-gaming tracking-wider text-xs flex items-center gap-2 shrink-0">
                  <Check className="w-4 h-4" />
                  <span>JOINED</span>
                </div>
              ) : isAvailable ? (
                <button
                  type="button"
                  onClick={() => onJoinClick(tournament)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold font-gaming tracking-wider text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer uppercase shrink-0"
                >
                  JOIN NOW
                </button>
              ) : null}
            </div>
          </div>

          {/* Admin Control Banner (Only for Admins) */}
          {isAdmin && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-sky-50 dark:from-blue-950/70 dark:via-[#111D35] dark:to-sky-950/40 border border-sky-200 dark:border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md dark:shadow-lg">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Admin Control: Participants Visibility
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Normal players see:{' '}
                    <b className={tournament.showParticipants !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {tournament.showParticipants !== false ? 'VISIBLE (ON)' : 'HIDDEN (OFF)'}
                    </b>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleParticipantsVisibility}
                className={`px-3.5 py-1.5 rounded-xl font-bold font-gaming text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                  tournament.showParticipants !== false
                    ? 'bg-red-50 dark:bg-red-950/80 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                }`}
              >
                {tournament.showParticipants !== false ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide for Users</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show to Users</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Top Count Bar: "Participants (2/48)" and "46 Needed" */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/25 flex items-center justify-between shadow-md dark:shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wider">
                  Participants ({displayRegisteredCount}/{totalSlots})
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {displayRegisteredCount} players confirmed
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-sky-50 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 font-bold font-gaming text-xs tracking-wide tabular-nums">
              {Math.max(0, totalSlots - displayRegisteredCount)} Needed
            </span>
          </div>

          {/* Hidden View vs Visible View */}
          {tournament.showParticipants === false && !isAdmin ? (
            <div className="py-14 px-6 rounded-3xl bg-white dark:bg-[#0D1428] border border-red-200 dark:border-red-500/40 text-center space-y-3.5 shadow-xl dark:shadow-2xl my-2">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-500 flex items-center justify-center mx-auto shadow-lg shadow-red-500/15">
                <EyeOff className="w-8 h-8" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black font-gaming uppercase tracking-wider text-red-600 dark:text-red-500">
                Participants Hidden
              </h3>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                ADMIN এর সিদ্ধান্তই চূড়ান্ত সিদ্ধান্ত।
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                এই টুর্নামেন্টের অংশগ্রহণকারীদের নাম এডমিন কর্তৃক গোপন রাখা হয়েছে।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tournament.showParticipants === false && isAdmin && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                  Notice: Participants list is hidden for normal users. Only admins can see this roster.
                </div>
              )}

              {registrations.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">No participants yet</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Be the first player to join this tournament!
                  </p>
                  {isAvailable && (
                    <button
                      type="button"
                      onClick={() => onJoinClick(tournament)}
                      className="mt-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs uppercase cursor-pointer"
                    >
                      Join Now
                    </button>
                  )}
                </div>
              ) : (
                registrations.map((reg, idx) => {
                  const p1 =
                    reg.players?.[0]?.inGameName ||
                    reg.players?.[0]?.name ||
                    reg.userName ||
                    `Player ${idx + 1}`;
                  const p2Raw =
                    reg.players?.[1]?.inGameName ||
                    reg.players?.[1]?.name;
                  const p2 = p2Raw && !p2Raw.includes('Partner: -') && !p2Raw.includes('Solo') ? p2Raw : null;
                  const slotNum = reg.slotNumber || idx + 1;

                  return (
                    <div
                      key={reg.id || idx}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/40 transition-all flex items-center justify-between gap-3 text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 dark:bg-[#111D35] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black font-gaming text-xs flex items-center justify-center shrink-0">
                          #{slotNum}
                        </div>

                        <div className="min-w-0">
                          <span className="font-black font-gaming text-slate-900 dark:text-white text-sm sm:text-base tracking-wide block truncate">
                            Player 1: {p1}
                          </span>
                          {p2 && (
                            <span className="text-xs text-sky-600 dark:text-sky-400 font-bold truncate block mt-0.5">
                              Player 2: {p2}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        Confirmed
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Quick Join Button */}
          {isAvailable && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onJoinClick(tournament)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 hover:from-blue-500 text-white font-black font-gaming text-sm tracking-wider uppercase shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
              >
                JOIN TOURNAMENT (SLOT #{Math.min(totalSlots, displayRegisteredCount + 1)})
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Hero Banner Card */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-sky-500/25 bg-white dark:bg-[#0D1428] shadow-xl dark:shadow-2xl mb-8">
            <div className="h-64 sm:h-80 w-full relative bg-slate-200 dark:bg-[#090E1F]">
              <img
                src={resolvedBannerSrc}
                alt={tournament.title}
                referrerPolicy="no-referrer"
                onError={() => setBannerError(true)}
                className={`w-full h-full object-cover ${
                  matchCategory === 'LONE WOLF HEADSHOT'
                    ? 'object-[50%_18%] scale-[1.08]'
                    : matchCategory === 'LONE WOLF'
                    ? 'object-[50%_15%] scale-[1.03]'
                    : matchCategory === 'CS 1V1, 2V2' || matchCategory === 'CS 4V4'
                    ? 'object-[50%_15%]'
                    : matchCategory === 'LOST TO WIN' || matchCategory === 'LOSS TO WIN'
                    ? 'object-[50%_38%] scale-[1.06]'
                    : 'object-center'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/35 dark:from-[#0D1428] dark:via-[#0D1428]/60 to-transparent"></div>

              <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-md bg-blue-600 text-white font-black font-gaming text-sm tracking-wider shadow-md">
                  {formatEntryTypeLabel(tournament)}
                </span>
                <span className="px-3 py-1 rounded-md bg-slate-900/80 text-sky-400 font-bold text-sm border border-sky-500/30 backdrop-blur-md">
                  {formatGameModeLabel(tournament.gameMode)}
                </span>
              </div>

              {/* Map tag */}
              {tournament.map && (
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-xs text-white font-semibold bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm border border-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>Map: {tournament.map}</span>
                </div>
              )}
            </div>

            {/* DUAL TIMER BANNER STRIP */}
            <div className="bg-slate-50 dark:bg-[#111D35] px-6 py-2.5 border-y border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              {/* Timer 1: Global Live Clock */}
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold font-sans">
                  GLOBAL LIVE CLOCK:
                </span>
                <span className="font-bold text-slate-900 dark:text-white tracking-widest text-sm bg-white dark:bg-[#090E1F] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 tabular-nums">
                  {globalClock}
                </span>
              </div>

              {/* Timer 2: Tournament Countdown */}
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/50 text-xs font-bold font-gaming animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Match Started / Live
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold font-sans">
                      COUNTDOWN:
                    </span>
                    <span className="bg-amber-50 dark:bg-[#090E1F] px-3 py-1 rounded-lg border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold font-gaming text-xs tracking-wider tabular-nums">
                      Tournament starts in: {countdownText}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tournament Info Header */}
            <div className="p-6 sm:p-8 -mt-2 relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black font-gaming tracking-wide text-slate-900 dark:text-white">
                    {language === 'bn' && tournament.titleBn ? tournament.titleBn : tournament.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      {tournament.matchDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                        {tournament.matchTime}
                      </span>{' '}
                      <span>(Asia/Dhaka)</span>
                      {canEditMatchTime && (
                        <button
                          type="button"
                          onClick={() => setShowEditTimeModal(true)}
                          title="Edit Match Time"
                          aria-label="Edit Match Time"
                          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/95 hover:bg-amber-300 text-black font-black font-gaming text-[10px] uppercase shadow cursor-pointer transition-all active:scale-95"
                        >
                          <Pencil className="w-3 h-3 stroke-[2.5]" />
                          <span>Edit</span>
                        </button>
                      )}
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Users className="w-4 h-4 text-sky-400" />
                      {displayRegisteredCount} / {totalSlots} Slots
                    </span>
                  </div>
                </div>

                {/* Quick Action: ADMIN GIVE ROOM & JOIN TOURNAMENT */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* ADMIN ROOM MANAGER button in the exact red box place beside JOIN NOW button - ONLY visible for Admin */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => (onNavigate ? onNavigate('roomManager', { id: tournament.id }) : null)}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming tracking-wider text-xs sm:text-sm shadow-xl shadow-[#CFA84B]/25 active:scale-95 transition-all transform hover:-translate-y-0.5 cursor-pointer uppercase flex items-center gap-2 border border-[#F4D77A]/60 shrink-0"
                      title="Open Room Manager for all matches"
                    >
                      <Key className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>GIVE ROOM</span>
                    </button>
                  )}

                  {isUserRegistered ? (
                    <div className="px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold font-gaming tracking-wider text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/10 shrink-0">
                      <Check className="w-4 h-4" />
                      <span>JOINED (SLOT CONFIRMED)</span>
                    </div>
                  ) : isAvailable ? (
                    <button
                      type="button"
                      onClick={() => onJoinClick(tournament)}
                      className="min-h-[44px] px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold font-gaming tracking-wider text-sm shadow-xl shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer uppercase shrink-0"
                    >
                      JOIN NOW
                    </button>
                  ) : isFull ? (
                    <span className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-xs uppercase font-gaming shrink-0">
                      SLOTS FULL
                    </span>
                  ) : (
                    <span className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs shrink-0">
                      {tournament.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid: Details & Room Credentials */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column (2 Cols): Prize Breakdown & Dynamic Match Slots */}
            <div className="lg:col-span-2 space-y-6">
              {/* Prize Distribution Box */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-md dark:shadow-lg space-y-3">
                <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>PRIZE BREAKDOWN (৳)</span>
                </h3>

                {/* Total Prizepool Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-slate-50 to-sky-50 dark:from-amber-500/15 dark:via-[#111D35] dark:to-sky-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                      TOTAL PRIZEPOOL
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {formatEntryTypeLabel(tournament)}
                    </span>
                  </div>
                  <span className="text-2xl font-black font-gaming text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatBDT(Number(tournament.prizePool || 0))}
                  </span>
                </div>

                {/* 1st to 5th Winning Prizes for BR MATCH and FREE MATCH */}
                {isPlacementPrizeCategory(matchCategory) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-[#111D35] border border-amber-200 dark:border-amber-500/30 text-center">
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                        🥇 1st Winning Prize
                      </span>
                      <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(Number(tournament.firstPrize || 0))}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30 text-center">
                      <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 block mb-0.5">
                        🥈 2nd Winning Prize
                      </span>
                      <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(Number(tournament.secondPrize || 0))}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-[#111D35] border border-orange-200 dark:border-orange-500/30 text-center">
                      <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 block mb-0.5">
                        🥉 3rd Winning Prize
                      </span>
                      <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(Number(tournament.thirdPrize || 0))}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-[#111D35] border border-emerald-200 dark:border-emerald-500/30 text-center">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                        🏅 4th Winning Prize
                      </span>
                      <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(Number(tournament.fourthPrize || 0))}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-violet-50/70 dark:bg-[#111D35] border border-violet-200 dark:border-violet-500/30 text-center">
                      <span className="text-[11px] font-bold text-violet-700 dark:text-violet-400 block mb-0.5">
                        🏅 5th Winning Prize
                      </span>
                      <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(Number(tournament.fifthPrize || 0))}
                      </span>
                    </div>
                  </div>
                )}

                {supportsPerKillPrize(matchCategory) && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-[#111D35] border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400">
                      🎯 PER KILL
                    </span>
                    <span className="text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                      {formatBDT(Number(tournament.perKillPrize || 0))}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Match Slots List (1 to tournament.maxSlots) */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-md dark:shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                  <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>MATCH SLOTS ({totalSlots} Slots • {tournament.matchTime})</span>
                  </h3>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                    <b className="text-sky-600 dark:text-sky-400">{displayRegisteredCount}</b> / {totalSlots} Joined •{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{Math.max(0, totalSlots - displayRegisteredCount)} Open</span>
                  </span>
                </div>

                {tournament.showParticipants === false && !isAdmin ? (
                  <div className="py-12 px-6 rounded-2xl bg-red-50/40 dark:bg-[#090E1F] border border-red-200 dark:border-red-500/40 text-center space-y-3.5 shadow-lg dark:shadow-2xl">
                    <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-500 flex items-center justify-center mx-auto shadow-md">
                      <EyeOff className="w-7 h-7" />
                    </div>
                    <h4 className="text-xl font-black font-gaming uppercase tracking-wider text-red-600 dark:text-red-500">
                      Participants Hidden
                    </h4>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      ADMIN এর সিদ্ধান্তই চূড়ান্ত সিদ্ধান্ত।
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                      ম্যাচ অর্গানাইজার এই টুর্নামেন্টের অংশগ্রহণকারী তালিকা গোপন রেখেছেন।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {tournament.showParticipants === false && isAdmin && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs text-center font-medium mb-2">
                        Notice: Participants list is hidden for normal users. Only admins can see this roster.
                      </div>
                    )}
                    {allSlots.map(({ slotNumber, registration: reg }) => {
                      if (!reg) {
                        return (
                          <div
                            key={`slot-${slotNumber}`}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35]/55 border border-slate-200 dark:border-slate-800/90 hover:border-sky-400 dark:hover:border-sky-500/30 transition-all text-xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-lg bg-white dark:bg-[#090E1F] text-slate-600 dark:text-slate-400 font-bold font-gaming tabular-nums flex items-center justify-center border border-slate-200 dark:border-slate-700/80 text-xs shrink-0">
                                #{slotNumber}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                                  Slot #{slotNumber}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {language === 'bn' ? 'খালি স্লট • জয়েন করার জন্য উন্মুক্ত' : 'Empty Slot • Available'}
                                </span>
                              </div>
                            </div>

                            {isAvailable ? (
                              <button
                                type="button"
                                onClick={() => onJoinClick(tournament)}
                                className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-500 text-sky-700 dark:text-sky-400 hover:text-white border border-sky-200 dark:border-sky-500/30 font-bold font-gaming text-[11px] tracking-wider uppercase transition-all cursor-pointer shrink-0"
                              >
                                JOIN
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#090E1F] text-slate-500 border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider shrink-0">
                                Empty
                              </span>
                            )}
                          </div>
                        );
                      }

                      const p1 =
                        reg.players?.[0]?.inGameName ||
                        reg.players?.[0]?.name ||
                        reg.userName ||
                        'Player 1';
                      const p2Raw =
                        reg.players?.[1]?.inGameName ||
                        reg.players?.[1]?.name;
                      const p2 = p2Raw && !p2Raw.includes('Partner: -') && !p2Raw.includes('Solo') ? p2Raw : null;

                      return (
                        <div
                          key={`slot-${slotNumber}`}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30 hover:border-sky-400 dark:hover:border-sky-400/50 transition-all text-xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-bold font-gaming tabular-nums flex items-center justify-center border border-sky-200 dark:border-sky-500/40 text-xs shrink-0">
                                #{slotNumber}
                              </span>
                              <UserAvatar
                                user={
                                  userProfile && reg.userId === userProfile.uid
                                    ? userProfile
                                    : {
                                        uid: reg.userId,
                                        displayName: p1,
                                        inGameName: p1,
                                      }
                                }
                                size="sm"
                              />
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                                  Player 1: {p1}
                                </span>
                                {p2 && (
                                  <span className="text-xs text-sky-600 dark:text-sky-400 font-bold block mt-0.5">
                                    Player 2: {p2}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" />
                              Confirmed
                            </span>
                          </div>

                          {/* Joined Players list */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
                            <div className="p-2 rounded-lg bg-white dark:bg-[#090E1F] border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                  👑 Player 1: {p1}
                                </span>
                                {reg.players?.[0]?.freeFireUid && reg.players[0].freeFireUid !== '-' && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    UID: {reg.players[0].freeFireUid}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">Slot #{slotNumber}</span>
                            </div>

                            {p2 && (
                              <div className="p-2 rounded-lg bg-white dark:bg-[#090E1F] border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                    Player 2: {p2}
                                  </span>
                                  {reg.players?.[1]?.freeFireUid &&
                                    reg.players[1].freeFireUid !== '-' &&
                                    !reg.players[1].freeFireUid.startsWith('FF_') && (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                        UID: {reg.players[1].freeFireUid}
                                      </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">Partner</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Secure Match Room Credentials Box */}
            <div className="space-y-6">
              <div
                id="room-credentials-section"
                className={`p-6 rounded-2xl bg-white dark:bg-[#0D1428] border-2 shadow-lg dark:shadow-2xl relative overflow-hidden transition-all ${
                  highlightRoomBox
                    ? 'border-amber-400 ring-4 ring-amber-400/35'
                    : 'border-sky-200 dark:border-sky-500/40'
                }`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-gaming uppercase tracking-wider text-xs font-bold mb-3">
                  <KeyRound className="w-4 h-4" />
                  <span>{t('room.title')}</span>
                </div>

                {/* Check Authorization */}
                {isUserRegistered || isAdmin ? (
                  roomData && roomData.isPublished && roomData.roomId ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30 space-y-3">
                        {/* Room ID */}
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">
                            {t('room.id')}
                          </span>
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-700">
                            <span className="text-base font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300">
                              {roomData.roomId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(roomData.roomId, 'id')}
                              className="px-2 py-1 text-xs rounded bg-sky-100 dark:bg-sky-600/30 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedId ? t('room.copied') : t('room.copy')}
                            </button>
                          </div>
                        </div>

                        {/* Room Password */}
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block mb-1">
                            {t('room.password')}
                          </span>
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-700">
                            <span className="text-base font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300">
                              {roomData.roomPassword}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(roomData.roomPassword, 'pass')}
                              className="px-2 py-1 text-xs rounded bg-sky-100 dark:bg-sky-600/30 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {copiedPass ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedPass ? t('room.copied') : t('room.copy')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        {language === 'bn'
                          ? 'রুম আইডি কপি করে ফ্রি ফায়ার গেমে কাস্টম রুমে প্রবেশ করুন।'
                          : 'Copy Room credentials and enter custom lobby in Free Fire.'}
                      </p>
                    </div>
                  ) : (
                    /* Room Waiting State */
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111D35]/80 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                      <Clock className="w-8 h-8 text-sky-600 dark:text-sky-400 mx-auto animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {language === 'bn' ? 'রুম তথ্য প্রকাশের অপেক্ষায়' : 'Room Release Pending'}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">{t('room.waiting')}</p>
                    </div>
                  )
                ) : (
                  /* Unauthorized view */
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111D35]/80 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <Lock className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'bn' ? 'রুম আইডি লক করা আছে' : 'Room Credentials Protected'}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">{t('room.warning')}</p>
                    {isAvailable && (
                      <button
                        type="button"
                        onClick={() => onJoinClick(tournament)}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg font-gaming tracking-wider cursor-pointer"
                      >
                        {t('tournaments.joinNow')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Organizer Contact Box */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 shadow-sm">
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold font-gaming uppercase tracking-wider block">
                  Organizer Support
                </span>
                <p className="font-semibold text-slate-900 dark:text-white">TX TOUR BD Official Moderator</p>
                <p className="text-slate-600 dark:text-slate-400">
                  যেকোনো রুম সংক্রান্ত সমস্যা বা বিরোধের ক্ষেত্রে আমাদের হোয়াটসঅ্যাপ হেল্পলাইনে মেসেজ দিন।
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Admin Only: Edit Match Time Modal */}
      <EditMatchTimeModal
        isOpen={canEditMatchTime && showEditTimeModal}
        tournament={tournament}
        onClose={() => setShowEditTimeModal(false)}
        onSuccess={(updated, message) => {
          setTournament(updated);
          setToastMessage(message);
        }}
      />

      {/* Confirmation Popup Modal for Delete Tournament */}
      <DeleteTournamentModal
        isOpen={isAdmin && showDeleteModal}
        tournamentTitle={language === 'bn' && tournament.titleBn ? tournament.titleBn : tournament.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />

      {/* Toast Notification */}
      <ToastNotification
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
