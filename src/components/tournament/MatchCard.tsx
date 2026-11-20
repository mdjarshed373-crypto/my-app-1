import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tournament, TournamentRegistration, RoomCredential } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatEntryTypeLabel,
  formatMatchDateTimeLabel,
  formatMatchMapLabel,
  formatMatchTimeOnly,
  getDefaultBanglaSubtitle,
  getMatchBannerUrl,
  getMatchTypeBadgeLabel,
  getTournamentCategory,
  isPlacementPrizeCategory,
  parseMatchDateAndTime,
  resolveTournamentBannerUrl,
  supportsPerKillPrize,
} from '../../constants/categoryRules';
import {
  fetchRegistrationsForTournament,
  fetchRoomCredentials,
  fetchUserRegistrations,
} from '../../services/tournamentService';
import {
  OptimisticJoinEntry,
  subscribeOptimisticJoins,
} from '../../services/optimisticJoinStore';
import { isUserAdminAccount } from '../../utils/adminAuth';
import { EditMatchTimeModal } from './EditMatchTimeModal';
import {
  Clock,
  Trophy,
  Users,
  Crosshair,
  Trash2,
  Check,
  KeyRound,
  Lock,
  Copy,
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  Gamepad2,
  Pencil,
} from 'lucide-react';

export interface MatchCardProps {
  tournament: Tournament;
  matchNumber?: number;
  onSelect: (tournament: Tournament) => void;
  onJoin: (tournament: Tournament) => void;
  onDelete?: (tournament: Tournament) => void;
  onTimeUpdated?: (updatedTournament: Tournament, message: string) => void;
  isRegistered?: boolean;
  refreshTick?: number;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  tournament,
  matchNumber = 1,
  onSelect,
  onJoin,
  onDelete,
  onTimeUpdated,
  isRegistered = false,
  refreshTick,
}) => {
  const { language, formatBDT } = useLanguage();
  const { currentUser, userProfile, isAdmin } = useAuth();

  const [now, setNow] = useState<Date>(() => new Date());
  const [localTournament, setLocalTournament] = useState<Tournament>(tournament);
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [optimisticJoin, setOptimisticJoin] = useState<OptimisticJoinEntry | null>(null);

  // Popups State (SLOTS, ROOM, PRIZES)
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [registrationsList, setRegistrationsList] = useState<TournamentRegistration[]>([]);

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomData, setRoomData] = useState<RoomCredential | null>(null);
  const [verifiedJoined, setVerifiedJoined] = useState<boolean>(isRegistered);
  const [copiedField, setCopiedField] = useState<'id' | 'pass' | null>(null);

  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  useEffect(() => {
    setLocalTournament(tournament);
  }, [tournament]);

  useEffect(() => {
    return subscribeOptimisticJoins(currentUser?.uid, (entries) => {
      const match = entries.find((entry) => entry.tournamentId === tournament.id) || null;
      setOptimisticJoin(match);
    });
  }, [currentUser?.uid, tournament.id]);

  useEffect(() => {
    setVerifiedJoined(isRegistered || Boolean(optimisticJoin));
  }, [isRegistered, optimisticJoin]);

  useEffect(() => {
    setBannerError(false);
  }, [localTournament.bannerUrl, localTournament.category]);

  useEffect(() => {
    if (refreshTick) {
      setNow(new Date());
    }
  }, [refreshTick]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showRoomModal || !verifiedJoined) return;
    let cancelled = false;

    const refreshRoom = async () => {
      try {
        const room = await fetchRoomCredentials(tournament.id);
        if (!cancelled) {
          setRoomData(room);
        }
      } catch {
        // Keep existing state on transient error
      }
    };

    const pollInterval = setInterval(refreshRoom, 8000);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [showRoomModal, verifiedJoined, tournament.id]);

  const activeTournament = localTournament;
  const title =
    language === 'bn' && activeTournament.titleBn ? activeTournament.titleBn : activeTournament.title;
  const maxSlots = Math.max(1, Number(activeTournament.maxSlots) || 1);
  const rawRegisteredCount = Math.max(0, Number(activeTournament.registeredCount) || 0);
  const registeredCount = optimisticJoin
    ? Math.min(maxSlots, Math.max(rawRegisteredCount, optimisticJoin.expectedRegisteredCount))
    : rawRegisteredCount;
  const remainingSlots = Math.max(0, maxSlots - registeredCount);
  const isFull = registeredCount >= maxSlots;
  const progressPercent = Math.min(100, Math.round((registeredCount / maxSlots) * 100));

  const matchCategory = getTournamentCategory(activeTournament);
  const fallbackBannerSrc = getMatchBannerUrl(matchCategory);
  const bannerSrc = bannerError ? fallbackBannerSrc : resolveTournamentBannerUrl(activeTournament);
  const matchTypeLabel = getMatchTypeBadgeLabel(matchCategory);
  const normalizedStatus = (activeTournament.status || 'REGISTRATION_OPEN').toUpperCase();
  const isOpenForRegistration =
    !isFull &&
    remainingSlots > 0 &&
    (normalizedStatus === 'REGISTRATION_OPEN' || normalizedStatus === 'OPEN');
  const isFewSlotsLeft =
    isOpenForRegistration &&
    (matchCategory === 'BR MATCH'
      ? progressPercent >= 75 ||
        (maxSlots <= 4 && remainingSlots <= 1) ||
        (maxSlots > 4 && remainingSlots <= 4)
      : true);

  const mapOverlayLabel = formatMatchMapLabel(activeTournament.map, matchCategory);
  const timeOverlayLabel = formatMatchTimeOnly(activeTournament.matchTime);
  const primaryDisplayTitle = activeTournament.title || title;
  const banglaSubtitle = getDefaultBanglaSubtitle(activeTournament, matchCategory);
  const dateTimeLabel = formatMatchDateTimeLabel(
    activeTournament.matchDate,
    activeTournament.matchTime
  );

  const totalPrizePoolValue = Number(activeTournament.prizePool ?? 0);
  const firstPrizeValue = Number(activeTournament.firstPrize ?? 0);
  const secondPrizeValue = Number(activeTournament.secondPrize ?? 0);
  const thirdPrizeValue = Number(activeTournament.thirdPrize ?? 0);
  const fourthPrizeValue = Number(activeTournament.fourthPrize ?? 0);
  const fifthPrizeValue = Number(activeTournament.fifthPrize ?? 0);
  const showPerKillPrize = supportsPerKillPrize(matchCategory);
  const perKillPrizeValue = showPerKillPrize ? Number(activeTournament.perKillPrize ?? 0) : 0;
  const showWinningBreakdown = isPlacementPrizeCategory(matchCategory);

  // Live countdown calculation ("59 Minute 19 Second" format)
  const matchTarget = parseMatchDateAndTime(activeTournament.matchDate, activeTournament.matchTime);
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

  let countdownPrefix = 'Starts in:';
  let countdownValue = 'Match Started / Live';

  if (tournament.status === 'COMPLETED') {
    countdownPrefix = 'Status:';
    countdownValue = 'Match Ended';
  } else if (tournament.status === 'CANCELLED') {
    countdownPrefix = 'Status:';
    countdownValue = 'Cancelled';
  } else if (tournament.status === 'ONGOING') {
    countdownPrefix = 'Status:';
    countdownValue = 'Match Started / Live';
  } else if (matchTarget) {
    const diffSec = Math.floor((matchTarget.getTime() - now.getTime()) / 1000);
    if (diffSec <= 0) {
      countdownPrefix = 'Status:';
      countdownValue = 'Match Started / Live';
    } else {
      const days = Math.floor(diffSec / 86400);
      const hours = Math.floor((diffSec % 86400) / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      if (days > 0) {
        countdownValue = `${days}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
      } else if (hours > 0) {
        countdownValue = `${hours} Hour ${pad(minutes)} Minute ${pad(seconds)} Second`;
      } else {
        countdownValue = `${pad(minutes)} Minute ${pad(seconds)} Second`;
      }
    }
  }

  const handleOpenSlotsModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSlotsModal(true);

    // Show optimistic registration immediately without waiting for network
    if (optimisticJoin) {
      setRegistrationsList([optimisticJoin.registration]);
      setSlotsLoading(false);
    } else {
      setSlotsLoading(true);
    }

    try {
      const list = await fetchRegistrationsForTournament(tournament.id);
      if (optimisticJoin) {
        const alreadyInServer = list.some(
          (r) =>
            r.id === optimisticJoin.registration.id ||
            (currentUser?.uid && r.userId === currentUser.uid)
        );
        const merged = alreadyInServer
          ? list
          : [...list, optimisticJoin.registration].sort(
              (a, b) => a.slotNumber - b.slotNumber
            );
        setRegistrationsList(merged);
      } else {
        setRegistrationsList(list);
      }
    } catch {
      if (!optimisticJoin) {
        setRegistrationsList([]);
      }
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleOpenRoomModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRoomModal(true);
    setRoomLoading(true);
    try {
      let userHasJoined = isRegistered || Boolean(optimisticJoin);
      if (!userHasJoined && currentUser?.uid) {
        const regs = await fetchUserRegistrations(currentUser.uid);
        userHasJoined = regs.some((r) => r.tournamentId === tournament.id);
      }
      setVerifiedJoined(userHasJoined);

      if (userHasJoined) {
        const room = await fetchRoomCredentials(tournament.id);
        setRoomData(room);
      } else {
        setRoomData(null);
      }
    } catch {
      setVerifiedJoined(isRegistered);
    } finally {
      setRoomLoading(false);
    }
  };

  const handleCopyCredential = (value: string, field: 'id' | 'pass') => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const msUntilMatch = matchTarget ? matchTarget.getTime() - now.getTime() : null;
  const isWithinReleaseWindow =
    tournament.status === 'ONGOING' ||
    tournament.status === 'COMPLETED' ||
    (msUntilMatch !== null && msUntilMatch <= 4 * 60 * 1000);
  const hasSavedRoomId = Boolean(roomData?.roomId && roomData.roomId.trim().length > 0);
  const canShowRoomCredentials =
    verifiedJoined &&
    hasSavedRoomId &&
    Boolean(roomData?.isPublished);

  return (
    <>
      <div
        onClick={() => onSelect(tournament)}
        className="group relative bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 dark:hover:border-amber-500/50 rounded-2xl w-full h-full flex flex-col justify-between overflow-hidden shadow-md dark:shadow-xl dark:shadow-black/40 transition-all cursor-pointer select-none"
      >
        {/* TOP COMPACT BANNER PHOTO (Uniform height & full card width across all match types) */}
        <div className="relative h-32 w-full overflow-hidden bg-slate-900 keep-dark-surface shrink-0">
          <img
            src={bannerSrc}
            alt={primaryDisplayTitle}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (!bannerError && e.currentTarget.src !== fallbackBannerSrc) {
                setBannerError(true);
              }
            }}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              matchCategory === 'LONE WOLF HEADSHOT'
                ? 'object-[50%_18%] scale-[1.08] group-hover:scale-[1.12]'
                : matchCategory === 'LONE WOLF'
                ? 'object-[50%_15%] scale-[1.03] group-hover:scale-[1.07]'
                : matchCategory === 'CS 1V1, 2V2' || matchCategory === 'CS 4V4'
                ? 'object-[50%_15%] group-hover:scale-105'
                : matchCategory === 'LOST TO WIN' || matchCategory === 'LOSS TO WIN'
                ? 'object-[50%_40%] scale-[1.06] group-hover:scale-[1.10]'
                : 'object-center group-hover:scale-105'
            }`}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,11,24,0.92)_0%,rgba(7,11,24,0.28)_48%,rgba(0,0,0,0.58)_100%)] pointer-events-none" />

          {/* Top Banner Tags: Left = Red Match Type Box, Right = Slots Status Box */}
          <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[9px] sm:text-[10px] font-bold font-gaming">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider shadow-md whitespace-nowrap">
              {matchTypeLabel}
            </span>

            {isFewSlotsLeft ? (
              <span className="px-2 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wider font-black shadow-md whitespace-nowrap">
                FEW SLOTS LEFT
              </span>
            ) : isFull ? (
              <span className="px-2 py-0.5 rounded bg-red-900 text-white uppercase tracking-wider font-black shadow-md whitespace-nowrap">
                SLOTS FULL
              </span>
            ) : tournament.status === 'ONGOING' ? (
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider font-black shadow-md whitespace-nowrap">
                LIVE NOW
              </span>
            ) : tournament.status === 'COMPLETED' ? (
              <span className="px-2 py-0.5 rounded bg-black/70 text-white uppercase tracking-wider font-black shadow-md whitespace-nowrap">
                ENDED
              </span>
            ) : tournament.status === 'CANCELLED' ? (
              <span className="px-2 py-0.5 rounded bg-red-900 text-white uppercase tracking-wider font-black shadow-md whitespace-nowrap">
                CANCELLED
              </span>
            ) : null}
          </div>

          {/* Bottom Banner Corners: Left = Map Name, Right = Time + Clock Icon + Admin Edit Pencil */}
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[11px] font-gaming">
            <span className="flex items-center gap-1 text-white font-bold truncate max-w-[55%] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              <Gamepad2 className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">{mapOverlayLabel}</span>
            </span>
            <span className="flex items-center gap-1 text-white font-bold shrink-0 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{timeOverlayLabel}</span>
              {canEditMatchTime && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditTimeModal(true);
                  }}
                  title="Edit Match Time"
                  aria-label="Edit Match Time"
                  className="ml-0.5 p-0.5 rounded bg-amber-400/95 hover:bg-amber-300 text-black shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Pencil className="w-2.5 h-2.5 stroke-[2.5]" />
                </button>
              )}
            </span>
          </div>
        </div>

        {/* CARD BODY CONTENT (Identical compact proportions across all categories & formats) */}
        <div className="px-3 pt-4 pb-2.5 space-y-2 flex-1 flex flex-col justify-between">
          {/* Match Title + Bangla Subtitle + Optional Admin Delete (spaced down from banner) */}
          <div className="flex items-start justify-between gap-2 min-h-[32px]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black font-gaming text-amber-600 dark:text-amber-400 shrink-0 tabular-nums">
                  #{matchNumber}
                </span>
                <h3 className="text-sm font-black font-gaming tracking-wide text-slate-900 dark:text-white uppercase truncate leading-tight">
                  {primaryDisplayTitle}
                </h3>
              </div>
              <p className="text-[11px] text-sky-600 dark:text-sky-300 font-bangla font-semibold mt-0.5 truncate leading-tight">
                {banglaSubtitle}
              </p>
            </div>

            {isAdmin && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(tournament);
                }}
                title={language === 'bn' ? 'টুর্নামেন্ট ডিলিট করুন' : 'Delete Tournament'}
                className="p-1 rounded-lg text-red-600 dark:text-red-400/90 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Compact Metric Boxes: PRIZE, FEE (+ PER KILL only for BR Match & Free Match) */}
          <div
            className={`w-[90%] mx-auto grid ${
              showPerKillPrize ? 'grid-cols-3' : 'grid-cols-2'
            } gap-1.5 text-center font-gaming`}
          >
            <div className="py-0.5 px-1 rounded-md bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block uppercase font-bold leading-tight whitespace-nowrap">
                PRIZE
              </span>
              <span className="text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight whitespace-nowrap">
                {formatBDT(totalPrizePoolValue)}
              </span>
            </div>
            <div className="py-0.5 px-1 rounded-md bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
              <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block uppercase font-bold leading-tight whitespace-nowrap">
                FEE
              </span>
              <span className="text-[10.5px] font-black text-amber-700 dark:text-amber-300 tabular-nums leading-tight whitespace-nowrap">
                {tournament.entryFee > 0 ? formatBDT(tournament.entryFee) : 'FREE'}
              </span>
            </div>
            {showPerKillPrize && (
              <div className="py-0.5 px-1 rounded-md bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
                <span className="text-[8.5px] text-slate-500 dark:text-slate-400 block uppercase font-bold leading-tight whitespace-nowrap">
                  PER KILL
                </span>
                <span className="text-[10.5px] font-black text-sky-700 dark:text-sky-300 tabular-nums leading-tight whitespace-nowrap">
                  {formatBDT(perKillPrizeValue)}
                </span>
              </div>
            )}
          </div>

          {/* Compact Registration Progress Bar */}
          <div className="space-y-1 font-gaming">
            <div className="flex justify-between text-[10px] leading-none text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Registration</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {registeredCount}/{maxSlots}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Slim Action Buttons Area */}
          <div className="space-y-1.5">
            {verifiedJoined ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(tournament);
                }}
                className="w-full h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-400 dark:border-emerald-400/60 text-emerald-700 dark:text-emerald-300 font-black font-gaming text-[11px] tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Joined</span>
              </button>
            ) : isFull ? (
              <button
                type="button"
                disabled
                onClick={(e) => e.stopPropagation()}
                className="w-full h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black font-gaming text-[11px] tracking-wider uppercase flex items-center justify-center cursor-not-allowed whitespace-nowrap"
              >
                Slots Full
              </button>
            ) : tournament.status === 'COMPLETED' ? (
              <button
                type="button"
                disabled
                onClick={(e) => e.stopPropagation()}
                className="w-full h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black font-gaming text-[11px] tracking-wider uppercase flex items-center justify-center cursor-not-allowed whitespace-nowrap"
              >
                Ended
              </button>
            ) : tournament.status === 'CANCELLED' ? (
              <button
                type="button"
                disabled
                onClick={(e) => e.stopPropagation()}
                className="w-full h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black font-gaming text-[11px] tracking-wider uppercase flex items-center justify-center cursor-not-allowed whitespace-nowrap"
              >
                Cancelled
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(tournament);
                }}
                className="w-full h-8 rounded-lg bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-black font-gaming text-[11px] tracking-wider uppercase shadow-sm shadow-[#CFA84B]/20 transition-all cursor-pointer flex items-center justify-center border border-[#F4D77A]/60 whitespace-nowrap"
              >
                JOIN MATCH
              </button>
            )}

            {/* 3 Slim Utility Buttons: SLOTS, ROOM, PRIZES */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={handleOpenSlotsModal}
                className="h-6 rounded-md bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.98] text-black font-black font-gaming text-[10px] tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer border border-[#F4D77A]/40 whitespace-nowrap"
              >
                SLOTS
              </button>

              <button
                type="button"
                onClick={handleOpenRoomModal}
                className="h-6 rounded-md bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.98] text-black font-black font-gaming text-[10px] tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer border border-[#F4D77A]/40 whitespace-nowrap"
              >
                ROOM
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPrizeModal(true);
                }}
                className="h-6 rounded-md bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.98] text-black font-black font-gaming text-[10px] tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer border border-[#F4D77A]/40 whitespace-nowrap"
              >
                PRIZES
              </button>
            </div>
          </div>

          {/* BOTTOM COUNTDOWN FOOTER */}
          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/90 flex items-center justify-center gap-1.5 text-[10px] leading-none">
            <Clock className="w-3 h-3 text-amber-600 dark:text-[#F4D77A] shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">{countdownPrefix}</span>
            <span className="font-bold font-gaming text-amber-700 dark:text-[#F4D77A] truncate tabular-nums">
              {countdownValue}
            </span>
          </div>
        </div>
      </div>

      {/* POPUP: REGISTERED SLOTS MODAL */}
      {showSlotsModal &&
        createPortal(
          <div
            onClick={() => setShowSlotsModal(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0D1428] border border-amber-400/70 dark:border-[#CFA84B]/50 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-[#CFA84B]/15 border border-amber-300 dark:border-[#CFA84B]/40 flex items-center justify-center text-amber-700 dark:text-[#F4D77A] shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate">
                      Match Slots ({registeredCount}/{maxSlots})
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {title} • <span className="font-bold text-amber-700 dark:text-[#F4D77A] tabular-nums">{timeOverlayLabel}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSlotsModal(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto space-y-2 bg-white dark:bg-[#0D1428]">
                {tournament.showParticipants === false && !isAdmin ? (
                  <div className="py-8 px-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-500 flex items-center justify-center mx-auto shadow-md">
                      <EyeOff className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-black font-gaming uppercase tracking-wider text-red-600 dark:text-red-500">
                      Participants Hidden
                    </h4>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      ADMIN এর সিদ্ধান্তই চূড়ান্ত সিদ্ধান্ত।
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {registeredCount}/{maxSlots} slots booked • Player names hidden by organizer
                    </p>
                  </div>
                ) : slotsLoading ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-amber-500 dark:border-[#F4D77A] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Loading registered slots...</p>
                  </div>
                ) : registrationsList.length === 0 ? (
                  <div className="py-8 text-center space-y-1.5">
                    <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No players registered yet
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {maxSlots} slots available — be the first to join!
                    </p>
                  </div>
                ) : (
                  <>
                    {tournament.showParticipants === false && isAdmin && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[10px] text-center font-medium">
                        Notice: Participants list is hidden for normal users. Only admins can see this roster.
                      </div>
                    )}
                    {registrationsList.map((reg, i) => {
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
                          key={reg.id || i}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-gradient-to-r from-[#CFA84B] to-[#F4D77A] text-black font-black font-gaming text-[10px] shrink-0">
                              #{reg.slotNumber || i + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white truncate block">
                                Player 1: {p1}
                              </span>
                              {p2 && (
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold truncate block">
                                  Player 2: {p2}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase shrink-0">
                            Confirmed
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#090F21] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSlotsModal(false);
                    onSelect(tournament);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs uppercase cursor-pointer border border-[#F4D77A]/50"
                >
                  Full Match Details
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlotsModal(false)}
                  className="py-2 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* POPUP: ROOM ID & PASSWORD MODAL */}
      {showRoomModal &&
        createPortal(
          <div
            onClick={() => setShowRoomModal(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0D1428] border border-sky-300 dark:border-sky-500/35 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate">
                      Room ID &amp; Password
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 bg-white dark:bg-[#0D1428]">
                {roomLoading ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-10 h-10 border-2 border-sky-500 dark:border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Checking match registration &amp; room status...
                    </p>
                  </div>
                ) : !verifiedJoined ? (
                  <div className="py-2 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/15 border-2 border-red-400 dark:border-red-500/70 flex items-center justify-center mx-auto shadow-lg shadow-red-500/15">
                      <Lock className="w-8 h-8 text-red-600 dark:text-red-500" />
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        আপনি এই ম্যাচে জয়েন করেননি
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        Room ID দেখতে হলে আগে ম্যাচে জয়েন করুন
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2">
                      {!isFull && tournament.status === 'REGISTRATION_OPEN' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowRoomModal(false);
                            onJoin(tournament);
                          }}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider uppercase transition-all cursor-pointer border border-[#F4D77A]/50"
                        >
                          JOIN NOW
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowRoomModal(false)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  </div>
                ) : canShowRoomCredentials && roomData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>কাস্টম রুম আইডি ও পাসওয়ার্ড প্রস্তুত!</span>
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-sky-300 dark:border-sky-500/40 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                          ROOM ID
                        </span>
                        <span className="text-lg font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300 select-all">
                          {roomData.roomId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCredential(roomData.roomId, 'id')}
                        className="px-3 py-2 rounded-lg bg-sky-100 hover:bg-sky-600 text-sky-700 hover:text-white dark:bg-sky-600/25 dark:hover:bg-sky-600 dark:text-sky-300 dark:hover:text-white border border-sky-300 dark:border-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedField === 'id' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-sky-300 dark:border-sky-500/40 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
                          ROOM PASSWORD
                        </span>
                        <span className="text-lg font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300 select-all">
                          {roomData.roomPassword || 'No Password'}
                        </span>
                      </div>
                      {roomData.roomPassword && (
                        <button
                          type="button"
                          onClick={() => handleCopyCredential(roomData.roomPassword, 'pass')}
                          className="px-3 py-2 rounded-lg bg-sky-100 hover:bg-sky-600 text-sky-700 hover:text-white dark:bg-sky-600/25 dark:hover:bg-sky-600 dark:text-sky-300 dark:hover:text-white border border-sky-300 dark:border-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedField === 'pass' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRoomModal(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                ) : (
                  <div className="py-2 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-sky-50 dark:bg-sky-500/15 border-2 border-sky-300 dark:border-sky-400/50 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/15">
                      <Clock className="w-8 h-8 text-sky-600 dark:text-sky-400 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        ২/৪ মিনিট আগে ROOM ID দিয়া হবে
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        আপনি এই ম্যাচে সফলভাবে জয়েন করেছেন। ম্যাচ শুরু হওয়ার ২-৪ মিনিট আগে এখানেই আসল Room ID ও Password দেখতে পাবেন এবং কপি করতে পারবেন।
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">ম্যাচের সময়:</span>
                      <span className="font-bold font-gaming text-amber-700 dark:text-amber-300">
                        {dateTimeLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRoomModal(false)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider transition-colors cursor-pointer border border-[#F4D77A]/50"
                    >
                      ঠিক আছে
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* POPUP: PRIZE POOL DETAILS MODAL */}
      {showPrizeModal &&
        createPortal(
          <div
            onClick={() => setShowPrizeModal(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#0D1428] border border-amber-400/70 dark:border-amber-500/35 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate">
                      Prize Pool Details
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrizeModal(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 bg-white dark:bg-[#0D1428]">
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/15 dark:via-[#111D35] dark:to-sky-500/10 border border-amber-300 dark:border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                      TOTAL PRIZEPOOL
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {formatEntryTypeLabel(tournament)}
                    </span>
                  </div>
                  <span className="text-2xl font-black font-gaming text-amber-700 dark:text-amber-400 tabular-nums">
                    {formatBDT(totalPrizePoolValue)}
                  </span>
                </div>

                {showWinningBreakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-amber-300 dark:border-amber-500/30 text-center">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-1">
                        1st Winning Prize
                      </span>
                      <span className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(firstPrizeValue)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-sky-300 dark:border-sky-500/30 text-center">
                      <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 block mb-1">
                        2nd Winning Prize
                      </span>
                      <span className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(secondPrizeValue)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-orange-300 dark:border-orange-500/30 text-center">
                      <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 block mb-1">
                        3rd Winning Prize
                      </span>
                      <span className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(thirdPrizeValue)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-emerald-300 dark:border-emerald-500/30 text-center">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                        4th Winning Prize
                      </span>
                      <span className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(fourthPrizeValue)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-violet-300 dark:border-violet-500/30 text-center">
                      <span className="text-[10px] font-bold text-violet-700 dark:text-violet-400 block mb-1">
                        5th Winning Prize
                      </span>
                      <span className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(fifthPrizeValue)}
                      </span>
                    </div>
                  </div>
                )}

                {showPerKillPrize && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Per Kill Prize</span>
                    </span>
                    <span className="text-sm font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                      {formatBDT(perKillPrizeValue)}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Entry Fee</span>
                    <span className="font-bold font-gaming text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {tournament.entryFee > 0 ? formatBDT(tournament.entryFee) : 'FREE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Map</span>
                    <span className="font-bold text-slate-900 dark:text-white">{tournament.map || 'Bermuda'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Slots</span>
                    <span className="font-bold font-gaming text-sky-700 dark:text-sky-300 tabular-nums">
                      {registeredCount}/{maxSlots}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  {!verifiedJoined && !isFull && tournament.status === 'REGISTRATION_OPEN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrizeModal(false);
                        onJoin(tournament);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider uppercase transition-all cursor-pointer border border-[#F4D77A]/50"
                    >
                      JOIN NOW
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPrizeModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ADMIN ONLY: EDIT MATCH TIME MODAL */}
      <EditMatchTimeModal
        isOpen={canEditMatchTime && showEditTimeModal}
        tournament={activeTournament}
        onClose={() => setShowEditTimeModal(false)}
        onSuccess={(updated, message) => {
          setLocalTournament(updated);
          onTimeUpdated?.(updated, message);
        }}
      />
    </>
  );
};
