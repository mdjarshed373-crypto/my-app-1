import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  TournamentRegistration,
  Tournament,
  RoomCredential,
  MatchResult,
  TeamPlacementResult,
} from '../types';
import {
  fetchUserRegistrations,
  fetchTournamentById,
  fetchRoomCredentials,
} from '../services/tournamentService';
import {
  OptimisticJoinEntry,
  subscribeOptimisticJoins,
} from '../services/optimisticJoinStore';
import { fetchMatchResult } from '../services/matchResultService';
import { fetchUserTransactions } from '../services/walletService';
import { formatEntryTypeLabel } from '../constants/categoryRules';
import {
  BrowserNotificationPermissionState,
  ensureWebPushSubscribed,
  getNotificationPermissionState,
  requestBrowserNotificationPermission,
} from '../services/pushNotificationService';
import {
  Swords,
  KeyRound,
  Copy,
  Check,
  Calendar,
  Clock,
  Trophy,
  ShieldCheck,
  BellRing,
} from 'lucide-react';

interface MyMatchesProps {
  onNavigate: (page: string, params?: any) => void;
}

function formatMatchCardTitle(
  tour?: Tournament,
  reg?: TournamentRegistration
): { brand: string; matchName: string } {
  const raw = (
    tour?.title ||
    tour?.titleBn ||
    reg?.tournamentTitle ||
    tour?.category ||
    'TOURNAMENT'
  ).trim();
  const cleanedMatchName =
    raw.replace(/^tx\s*tour\s*bd[\s\-:–—]*/i, '').trim() || raw;
  return {
    brand: 'Tx Tour BD',
    matchName: cleanedMatchName,
  };
}

function formatMatchIdCode(tournamentId: string): string {
  const source = (tournamentId || '19704').trim();
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  const fiveDigit = 10000 + (hash % 90000);
  return `#${fiveDigit}`;
}

function formatDynamicMatchDateTime(
  tour?: Tournament,
  reg?: TournamentRegistration
): string {
  const rawDate = (tour?.matchDate || reg?.matchDate || '').trim();
  const rawTime = (tour?.matchTime || reg?.matchTime || '').trim();
  const fallbackIso = reg?.createdAt || tour?.createdAt || '';

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;
  let hours24: number | null = null;
  let minutes: number | null = null;

  if (rawDate) {
    const ymd = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const dmy = rawDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ymd) {
      year = parseInt(ymd[1], 10);
      month = parseInt(ymd[2], 10);
      day = parseInt(ymd[3], 10);
    } else if (dmy) {
      day = parseInt(dmy[1], 10);
      month = parseInt(dmy[2], 10);
      year = parseInt(dmy[3], 10);
    } else {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        day = parsed.getDate();
        month = parsed.getMonth() + 1;
        year = parsed.getFullYear();
        hours24 = parsed.getHours();
        minutes = parsed.getMinutes();
      }
    }
  }

  if (rawTime) {
    const tMatch = rawTime.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (tMatch) {
      let h = parseInt(tMatch[1], 10);
      const m = parseInt(tMatch[2], 10);
      const mer = tMatch[3]?.toUpperCase();
      if (mer === 'PM' && h < 12) h += 12;
      else if (mer === 'AM' && h === 12) h = 0;
      hours24 = h % 24;
      minutes = m % 60;
    }
  }

  if (
    (day === null ||
      month === null ||
      year === null ||
      hours24 === null ||
      minutes === null) &&
    fallbackIso
  ) {
    const fb = new Date(fallbackIso);
    if (!isNaN(fb.getTime())) {
      if (day === null || month === null || year === null) {
        day = fb.getDate();
        month = fb.getMonth() + 1;
        year = fb.getFullYear();
      }
      if (hours24 === null || minutes === null) {
        hours24 = fb.getHours();
        minutes = fb.getMinutes();
      }
    }
  }

  if (day === null || month === null || year === null) {
    return rawDate ? `${rawDate}${rawTime ? ` at ${rawTime}` : ''}` : '';
  }

  const h24 = hours24 ?? 0;
  const min = minutes ?? 0;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  const hh = String(h12).padStart(2, '0');
  const minStr = String(min).padStart(2, '0');

  return `${dd}-${mm}-${yyyy} at ${hh}:${minStr} ${ampm}`;
}

function getWonAmountForMatch(
  tournamentId: string,
  myStanding: TeamPlacementResult | undefined,
  prizeTransactionsByTourId: Record<string, number>
): number {
  if (Object.prototype.hasOwnProperty.call(prizeTransactionsByTourId, tournamentId)) {
    return Math.max(0, Number(prizeTransactionsByTourId[tournamentId] || 0));
  }
  if (!myStanding) {
    return 0;
  }
  const rawPrize = Number(myStanding.prizeWon || 0);
  if (rawPrize <= 0) {
    return 0;
  }
  const validUids = (myStanding.playerUids || []).filter(Boolean);
  if (validUids.length > 0) {
    return Math.floor(rawPrize / validUids.length);
  }
  return rawPrize;
}

export const MyMatches: React.FC<MyMatchesProps> = ({ onNavigate }) => {
  const { currentUser, userProfile } = useAuth();
  const { language, t } = useLanguage();

  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [optimisticJoins, setOptimisticJoins] = useState<OptimisticJoinEntry[]>([]);
  const [tournamentsMap, setTournamentsMap] = useState<Record<string, Tournament>>({});
  const [roomsMap, setRoomsMap] = useState<Record<string, RoomCredential>>({});
  const [resultsMap, setResultsMap] = useState<Record<string, MatchResult>>({});
  const [prizeByTourMap, setPrizeByTourMap] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'ONGOING' | 'COMPLETED'>('UPCOMING');
  const [loading, setLoading] = useState(true);
  const didAutoSelectTab = useRef(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<BrowserNotificationPermissionState>(() =>
    getNotificationPermissionState()
  );

  useEffect(() => {
    return subscribeOptimisticJoins(currentUser?.uid, setOptimisticJoins);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    loadMyMatches();
    ensureWebPushSubscribed(currentUser.uid).catch(() => {});

    const unsub = onSnapshot(
      collection(db, 'tournaments'),
      (snap) => {
        const liveMap: Record<string, Tournament> = {};
        snap.forEach((d) => {
          liveMap[d.id] = { ...(d.data() as Tournament), id: d.id };
        });
        setTournamentsMap((prev) => ({ ...prev, ...liveMap }));
        setRegistrations((prev) =>
          prev.map((reg) => {
            const liveTour = liveMap[reg.tournamentId];
            if (!liveTour) return reg;
            if (
              liveTour.matchTime === reg.matchTime &&
              liveTour.matchDate === reg.matchDate
            ) {
              return reg;
            }
            return {
              ...reg,
              matchTime: liveTour.matchTime,
              matchDate: liveTour.matchDate,
            };
          })
        );
      },
      () => {
        // Ignore transient snapshot issues
      }
    );

    return () => unsub();
  }, [currentUser]);

  const handleEnableRoomPush = async () => {
    const next = await requestBrowserNotificationPermission(currentUser?.uid);
    setNotifPermission(next);
    if (next === 'granted' && currentUser?.uid) {
      await ensureWebPushSubscribed(currentUser.uid);
    }
  };

  const loadMyMatches = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [regs, userTrxList] = await Promise.all([
        fetchUserRegistrations(currentUser.uid),
        fetchUserTransactions(currentUser.uid).catch(() => []),
      ]);
      setRegistrations(regs);

      const prizeMap: Record<string, number> = {};
      for (const trx of userTrxList) {
        if (trx.type === 'PRIZE' && trx.status === 'COMPLETED' && trx.referenceId) {
          prizeMap[trx.referenceId] =
            (prizeMap[trx.referenceId] || 0) + Number(trx.amount || 0);
        }
      }
      setPrizeByTourMap(prizeMap);

      const uniqueTourIds = Array.from(
        new Set(regs.map((r) => r.tournamentId).filter(Boolean))
      );

      const fetchedEntries = await Promise.all(
        uniqueTourIds.map(async (tourId) => {
          const [tour, room, res] = await Promise.all([
            fetchTournamentById(tourId).catch(() => null),
            fetchRoomCredentials(tourId).catch(() => null),
            fetchMatchResult(tourId).catch(() => null),
          ]);
          return { tourId, tour, room, res };
        })
      );

      const tMap: Record<string, Tournament> = {};
      const rMap: Record<string, RoomCredential> = {};
      const resMap: Record<string, MatchResult> = {};

      for (const entry of fetchedEntries) {
        if (entry.tour) tMap[entry.tourId] = entry.tour;
        if (entry.room) rMap[entry.tourId] = entry.room;
        if (entry.res) resMap[entry.tourId] = entry.res;
      }

      setTournamentsMap(tMap);
      setRoomsMap(rMap);
      setResultsMap(resMap);

      if (!didAutoSelectTab.current && regs.length > 0) {
        didAutoSelectTab.current = true;
        let upcomingCnt = 0;
        let ongoingCnt = 0;
        let completedCnt = 0;

        for (const reg of regs) {
          const tour = tMap[reg.tournamentId];
          const res = resMap[reg.tournamentId];
          const isCompleted =
            tour?.status === 'COMPLETED' ||
            Boolean(res?.isPrizeDistributed || res?.isVerified);
          if (isCompleted) {
            completedCnt++;
          } else if (tour?.status === 'ONGOING') {
            ongoingCnt++;
          } else {
            upcomingCnt++;
          }
        }

        if (upcomingCnt === 0 && ongoingCnt > 0) {
          setActiveTab('ONGOING');
        } else if (upcomingCnt === 0 && completedCnt > 0) {
          setActiveTab('COMPLETED');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string, type: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedPass(id);
      setTimeout(() => setCopiedPass(null), 2000);
    }
  };

  const effectiveTournamentsMap = useMemo(() => {
    if (optimisticJoins.length === 0) return tournamentsMap;
    const merged = { ...tournamentsMap };
    optimisticJoins.forEach((entry) => {
      if (!merged[entry.tournamentId]) {
        merged[entry.tournamentId] = entry.tournament;
      }
    });
    return merged;
  }, [tournamentsMap, optimisticJoins]);

  const effectiveRegistrations = useMemo(() => {
    if (optimisticJoins.length === 0) return registrations;
    const existingTourIds = new Set(registrations.map((r) => r.tournamentId));
    const missingOptimistic = optimisticJoins
      .filter((entry) => !existingTourIds.has(entry.tournamentId))
      .map((entry) => entry.registration);
    if (missingOptimistic.length === 0) return registrations;
    return [...missingOptimistic, ...registrations];
  }, [registrations, optimisticJoins]);

  const getRegBucket = (reg: TournamentRegistration): 'UPCOMING' | 'ONGOING' | 'COMPLETED' => {
    const tour = effectiveTournamentsMap[reg.tournamentId];
    const res = resultsMap[reg.tournamentId];
    const isCompleted =
      tour?.status === 'COMPLETED' ||
      Boolean(res?.isPrizeDistributed || res?.isVerified);
    if (isCompleted) return 'COMPLETED';
    if (tour?.status === 'ONGOING') return 'ONGOING';
    return 'UPCOMING';
  };

  const tabCounts = effectiveRegistrations.reduce(
    (acc, reg) => {
      acc[getRegBucket(reg)] += 1;
      return acc;
    },
    { UPCOMING: 0, ONGOING: 0, COMPLETED: 0 }
  );

  // Filter registrations by tournament status
  const filteredRegs = effectiveRegistrations.filter(
    (reg) => getRegBucket(reg) === activeTab
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
            <Swords className="w-4 h-4" />
            <span>{language === 'bn' ? 'আমার ম্যাচ ও কাস্টম রুম' : 'Player Match Headquarters'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-gaming text-slate-900 dark:text-white mt-1">
            {t('nav.myMatches')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'আপনার সকল নিবন্ধিত টুর্নামেন্ট, ম্যাচ শিডিউল, রুম আইডি এবং স্কোরকার্ড দেখুন।'
              : 'View all your registered matches, match schedules, live room IDs, and post-game scorecards.'}
          </p>
        </div>

        {userProfile && <UserAvatar user={userProfile} size="md" />}
      </div>

      {/* Push Notification Opt-in Banner for Joined Players */}
      {notifPermission === 'default' && registrations.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/35 border border-sky-300 dark:border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <BellRing className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                অ্যাপ বন্ধ থাকলেও ফোনে Room Code Notification পান
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Allow Notification দিলে ম্যাচের Room ID ও Password দেয়ার সাথে সাথে ফোনের নোটিফিকেশন বারে এলার্ট যাবে।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableRoomPush}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold font-gaming text-xs uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
          >
            Allow Notification
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-gaming tracking-wider overflow-x-auto">
        <button
          onClick={() => setActiveTab('UPCOMING')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'UPCOMING'
              ? 'border-sky-600 dark:border-sky-400 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {language === 'bn'
            ? `আসন্ন টুর্নামেন্ট (${tabCounts.UPCOMING})`
            : `Upcoming Matches (${tabCounts.UPCOMING})`}
        </button>
        <button
          onClick={() => setActiveTab('ONGOING')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ONGOING'
              ? 'border-sky-600 dark:border-sky-400 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {language === 'bn'
            ? `চলমান (${tabCounts.ONGOING})`
            : `Ongoing (${tabCounts.ONGOING})`}
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'COMPLETED'
              ? 'border-sky-600 dark:border-sky-400 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {language === 'bn'
            ? `সমাপ্ত ও ফলাফল (${tabCounts.COMPLETED})`
            : `Completed & Results (${tabCounts.COMPLETED})`}
        </button>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-white dark:bg-[#0D1428] animate-pulse border border-slate-200 dark:border-slate-800"></div>
          ))}
        </div>
      ) : filteredRegs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 space-y-3">
          <Swords className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-gaming">
            {language === 'bn' ? 'এই ক্যাটাগরিতে কোনো ম্যাচ নেই' : 'No matches in this category'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'নতুন টুর্নামেন্টে যোগ দিন এবং আপনার পছন্দের স্লট বুক করুন।'
              : 'Join a new tournament and book your match slot now.'}
          </p>
          <button
            onClick={() => onNavigate('tournaments')}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs font-gaming tracking-wider cursor-pointer"
          >
            {t('hero.browseBtn')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRegs.map((reg) => {
            const tour = effectiveTournamentsMap[reg.tournamentId];
            const room = roomsMap[reg.tournamentId];
            const result = resultsMap[reg.tournamentId];

            // Find player result if published
            const myStanding =
              result?.standings?.find((s) =>
                Boolean(currentUser?.uid && s.playerUids?.includes(currentUser.uid))
              ) ||
              result?.standings?.find((s) =>
                Boolean(reg.teamName && s.teamName === reg.teamName)
              );

            const titleParts = formatMatchCardTitle(tour, reg);
            const entryFeeValue = Number(tour?.entryFee ?? reg.entryFeePaid ?? 0) || 0;
            const formattedDateTime = formatDynamicMatchDateTime(tour, reg);
            const wonAmount = getWonAmountForMatch(
              reg.tournamentId,
              myStanding,
              prizeByTourMap
            );
            const matchIdCode = formatMatchIdCode(reg.tournamentId);
            const entryTypeBadge = tour ? formatEntryTypeLabel(tour) : reg.type;

            return (
              <div
                key={reg.id}
                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-sky-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-4"
              >
                {/* Match Header */}
                <div className="flex justify-between items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-blue-600 text-white uppercase">
                        {entryTypeBadge}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30">
                        Slot #{reg.slotNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 dark:bg-[#070B18] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        Match ID {matchIdCode}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black font-gaming text-slate-900 dark:text-white leading-snug break-words">
                      <span className="text-sky-600 dark:text-sky-400">{titleParts.brand}</span> - {titleParts.matchName}
                    </h3>
                  </div>

                  {/* Entry Fee Box */}
                  <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#050811] border border-slate-300 dark:border-slate-700/90 text-right shrink-0 shadow-inner">
                    <span className="text-xs sm:text-sm font-black font-gaming tracking-wider text-slate-900 dark:text-white tabular-nums">
                      TK {entryFeeValue}
                    </span>
                  </div>
                </div>

                {/* Schedule Date & Won Amount Summary Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090F21] border border-slate-200 dark:border-slate-800/90">
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span className="tabular-nums">{formattedDateTime}</span>
                  </div>

                  <div
                    className={`px-3 py-1 rounded-lg border text-xs font-black font-gaming tracking-wide tabular-nums flex items-center gap-1.5 ${
                      wonAmount > 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-500/40 dark:text-emerald-400'
                        : 'bg-white border-slate-200 text-slate-700 dark:bg-[#070B18] dark:border-slate-700/80 dark:text-slate-300'
                    }`}
                  >
                    <Trophy
                      className={`w-3.5 h-3.5 ${
                        wonAmount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span>Won Amount : {wonAmount}</span>
                  </div>
                </div>

                {/* Team Roster In Match */}
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    {reg.type === 'SOLO' ? 'Registered Player' : `Squad: ${reg.teamName}`}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {reg.players.map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#111D35] text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                      >
                        {pIdx === 0 && userProfile && reg.userId === userProfile.uid && (
                          <UserAvatar user={userProfile} size="xs" />
                        )}
                        <span className="font-bold text-slate-900 dark:text-white">{p.inGameName || p.name}</span>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">({p.freeFireUid})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Room ID and Password Box */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      {t('room.title')}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified Player Access
                    </span>
                  </div>

                  {room && room.isPublished && room.roomId ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="p-3 rounded-lg bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                            {t('room.id')}
                          </span>
                          <span className="text-base font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300">
                            {room.roomId}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(room.roomId, reg.id, 'id')}
                          className="px-2.5 py-1 text-xs rounded bg-sky-100 hover:bg-sky-600 text-sky-700 hover:text-white dark:bg-sky-600/30 dark:text-sky-400 dark:hover:bg-sky-600 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === reg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === reg.id ? t('room.copied') : t('room.copy')}
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                            {t('room.password')}
                          </span>
                          <span className="text-base font-black font-gaming tracking-widest text-sky-700 dark:text-sky-300">
                            {room.roomPassword}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(room.roomPassword, reg.id, 'pass')}
                          className="px-2.5 py-1 text-xs rounded bg-sky-100 hover:bg-sky-600 text-sky-700 hover:text-white dark:bg-sky-600/30 dark:text-sky-400 dark:hover:bg-sky-600 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPass === reg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPass === reg.id ? t('room.copied') : t('room.copy')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#070B18] border border-slate-200 dark:border-transparent text-xs text-slate-600 dark:text-slate-400 text-center">
                      <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 inline mr-1" />
                      {t('room.waiting')}
                    </div>
                  )}
                </div>

                {/* Match Result / Scorecard if completed */}
                {myStanding && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 space-y-2">
                    <span className="text-xs font-bold font-gaming uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      Official Match Scorecard
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="p-2 rounded-lg bg-white dark:bg-[#070B18] border border-emerald-100 dark:border-transparent">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Placement</span>
                        <span className="text-sm font-black font-gaming text-slate-900 dark:text-white">
                          #{myStanding.placement}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#070B18] border border-emerald-100 dark:border-transparent">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Kills</span>
                        <span className="text-sm font-black font-gaming text-red-600 dark:text-red-400">
                          {myStanding.kills} Kills
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#070B18] border border-emerald-100 dark:border-transparent">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Total Points</span>
                        <span className="text-sm font-black font-gaming text-sky-600 dark:text-sky-400">
                          {myStanding.totalPoints} Pts
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#070B18] border border-emerald-100 dark:border-transparent">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Won Amount</span>
                        <span className="text-sm font-black font-gaming text-emerald-600 dark:text-emerald-400 tabular-nums">
                          TK {wonAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
