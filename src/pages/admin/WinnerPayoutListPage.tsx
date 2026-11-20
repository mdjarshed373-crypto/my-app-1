import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Tournament,
  MatchResult,
  UserProfile,
  WithdrawalRequest,
  PlayerSlotInfo,
} from '../../types';
import { fetchTournaments } from '../../services/tournamentService';
import { fetchWithdrawalRequests } from '../../services/walletService';
import {
  calculateMatchPrizeBreakdown,
  subscribeAllMatchResults,
  markMatchWinnerPaid,
} from '../../services/matchResultService';
import { getTournamentCategory } from '../../constants/categoryRules';
import { handleFirestoreError, OperationType } from '../../services/firestoreError';
import { isUserAdminAccount } from '../../utils/adminAuth';
import { ToastNotification } from '../../components/common/ToastNotification';
import {
  Trophy,
  ArrowLeft,
  ChevronRight,
  Clock,
  Calendar,
  Search,
  Copy,
  Check,
  CheckCircle,
  RefreshCw,
  Ban,
  Phone,
  Gamepad2,
  User,
  Hash,
} from 'lucide-react';

interface WinnerPayoutListPageProps {
  onNavigate?: (page: string, params?: any) => void;
  onBack?: () => void;
}

interface MatchWinnerRow {
  uid: string;
  name: string;
  inGameName: string;
  freeFireUid: string;
  phoneNumber: string;
  withdrawAccount?: string;
  withdrawMethod?: string;
  placement: number;
  kills: number;
  isWinner: boolean;
  winPrize: number;
  killPrize: number;
  totalPrize: number;
  payoutStatus: 'PENDING' | 'PAID';
  paidAt?: string;
  paidBy?: string;
}

function normalizeDigitsToAscii(input: string): string {
  const bnToEn: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return input.replace(/[০-৯]/g, (d) => bnToEn[d] ?? d);
}

const DHAKA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getDhakaDateKey(date: Date = new Date()): string {
  return DHAKA_DATE_FORMATTER.format(date);
}

export function extractDateKeyFromMatchDate(matchDate?: string): string | null {
  const raw = normalizeDigitsToAscii((matchDate || '').trim());
  if (!raw) return null;

  const isoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1].padStart(4, '0');
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const slashMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, '0');
    const m = slashMatch[2].padStart(2, '0');
    const y = slashMatch[3].padStart(4, '0');
    return `${y}-${m}-${d}`;
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return getDhakaDateKey(new Date(parsed));
  }
  return null;
}

export function extractDhakaDateKeyFromIso(iso?: string): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return getDhakaDateKey(new Date(parsed));
}

/**
 * Daily Reset Rule (Asia/Dhaka midnight 12:00 AM):
 * - Shows ONLY today's matches (morning -> night).
 * - After 12:00 AM, previous day's matches are automatically hidden.
 * - Matches whose result was already declared on an earlier day never reappear.
 */
export function isTodayMatchForWinnerList(
  tournament: Tournament,
  result: MatchResult | undefined,
  todayDhakaKey: string
): boolean {
  const resultDateKey = extractDhakaDateKeyFromIso(
    result?.publishedAt || result?.editedAt || result?.createdAt
  );
  if (resultDateKey) {
    if (resultDateKey < todayDhakaKey) return false;
    if (resultDateKey === todayDhakaKey) return true;
  }

  const matchDateKey = extractDateKeyFromMatchDate(tournament.matchDate);
  if (matchDateKey) {
    return matchDateKey === todayDhakaKey;
  }

  const createdDateKey = extractDhakaDateKeyFromIso(tournament.createdAt);
  return createdDateKey === todayDhakaKey;
}

/**
 * Dynamically parses whatever matchDate + matchTime the admin created for the slot/match
 * into epoch ms so matches sort strictly from morning to night (earliest at TOP -> later BELOW).
 * No fixed time is assumed.
 */
export function parseMatchStartTimestamp(
  matchDate?: string,
  matchTime?: string,
  fallbackCreatedAt?: string
): number {
  const rawDate = normalizeDigitsToAscii((matchDate || '').trim());
  const rawTime = normalizeDigitsToAscii((matchTime || '').trim());

  let year = 1970;
  let month = 0;
  let day = 1;
  let hasDate = false;

  const isoDateMatch = rawDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDateMatch) {
    year = Number(isoDateMatch[1]);
    month = Number(isoDateMatch[2]) - 1;
    day = Number(isoDateMatch[3]);
    hasDate = true;
  } else {
    const slashDateMatch = rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (slashDateMatch) {
      day = Number(slashDateMatch[1]);
      month = Number(slashDateMatch[2]) - 1;
      year = Number(slashDateMatch[3]);
      hasDate = true;
    } else if (rawDate) {
      const parsed = Date.parse(rawDate);
      if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
        hasDate = true;
      }
    }
  }

  let hours = 0;
  let minutes = 0;
  let hasTime = false;

  const lower = rawTime.toLowerCase();
  // Match "HH:MM", "HH.MM", or hour-only with meridiem like "10 AM" / "PM 2"
  const colonOrDotMatch = lower.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  const hourWithMeridiemMatch =
    !colonOrDotMatch
      ? lower.match(/(?:^|\s)(am|pm|a\.m\.|p\.m\.)\s*(\d{1,2})\b|\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/)
      : null;

  if (colonOrDotMatch) {
    hours = Number(colonOrDotMatch[1]);
    minutes = Number(colonOrDotMatch[2]);
    hasTime = true;
  } else if (hourWithMeridiemMatch) {
    hours = Number(hourWithMeridiemMatch[2] || hourWithMeridiemMatch[3]);
    minutes = 0;
    hasTime = true;
  }

  if (hasTime) {
    // Check explicit AM/PM adjacent to the first time token first (handles ranges like "11:30 AM - 12:30 PM")
    const attachedMeridiemMatch = lower.match(
      /(?:^|\s)(a\.?m\.?|p\.?m\.?)\s*\d|\d{1,2}(?:\s*[:.]\s*\d{2})?\s*(a\.?m\.?|p\.?m\.?)(?:\b|$)/
    );
    const attachedToken = (attachedMeridiemMatch?.[1] || attachedMeridiemMatch?.[2] || '').replace(/\./g, '');

    const hasExplicitPM =
      attachedToken === 'pm' ||
      (!attachedToken && (/\bp\.?m\.?\b/.test(lower) || /^pm\s*\d/.test(lower) || /\d\s*pm/.test(lower)));
    const hasExplicitAM =
      attachedToken === 'am' ||
      (!attachedToken && (/\ba\.?m\.?\b/.test(lower) || /^am\s*\d/.test(lower) || /\d\s*am/.test(lower)));

    // Bengali time-of-day hints if AM/PM wasn't written explicitly
    const hasBanglaMorning = /(সকাল|ভোর)/.test(rawTime);
    const hasBanglaPM = /(দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)/.test(rawTime);

    if (hasExplicitPM) {
      if (hours < 12) hours += 12;
    } else if (hasExplicitAM) {
      if (hours === 12) hours = 0;
    } else if (hasBanglaPM && !hasBanglaMorning) {
      if (hours === 12 && /রাত/.test(rawTime)) {
        hours = 0;
      } else if (hours >= 1 && hours < 12) {
        hours += 12;
      }
    } else if (hasBanglaMorning) {
      if (hours === 12) hours = 0;
    }

    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
  }

  if (hasDate) {
    return new Date(year, month, day, hours, minutes, 0, 0).getTime();
  }

  if (hasTime) {
    const baseMs = fallbackCreatedAt ? Date.parse(fallbackCreatedAt) : NaN;
    const baseDate = Number.isNaN(baseMs) ? new Date() : new Date(baseMs);
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
      0,
      0
    ).getTime();
  }

  const createdMs = fallbackCreatedAt ? Date.parse(fallbackCreatedAt) : NaN;
  return Number.isNaN(createdMs) ? Number.MAX_SAFE_INTEGER : createdMs;
}

function buildMatchWinnerRows(
  tournament: Tournament,
  result: MatchResult | undefined,
  usersByUid: Record<string, UserProfile>,
  latestWithdrawByUid: Record<string, WithdrawalRequest>
): MatchWinnerRow[] {
  if (!result) return [];

  const payoutMap = result.winnerPayouts || {};
  const slotInfoByUid: Record<string, PlayerSlotInfo> = {};

  (result.standings || []).forEach((standing) => {
    const players = standing.players || [];
    const uids = standing.playerUids || [];
    players.forEach((p, idx) => {
      const uid = p.uid || uids[idx] || '';
      if (uid && !slotInfoByUid[uid]) {
        slotInfoByUid[uid] = p;
      }
    });
  });

  const rows: MatchWinnerRow[] = [];

  if (result.distributedRecords && result.distributedRecords.length > 0) {
    for (const rec of result.distributedRecords) {
      const totalPrize = Math.round(Number(rec.prizeCredited || 0));
      if (totalPrize < 1) continue; // Strictly hide 0 TK players

      const user = usersByUid[rec.uid];
      const slot = slotInfoByUid[rec.uid];
      const latestWith = latestWithdrawByUid[rec.uid];
      const payoutEntry = payoutMap[rec.uid];

      const isPaid =
        payoutEntry?.status === 'PAID' || rec.payoutStatus === 'PAID';
      const slotEnteredGameName =
        slot?.inGameName || slot?.name || rec.playerName || '';

      rows.push({
        uid: rec.uid,
        name:
          slotEnteredGameName ||
          user?.inGameName ||
          user?.displayName ||
          'Player',
        inGameName:
          slotEnteredGameName ||
          user?.inGameName ||
          user?.displayName ||
          'Not set',
        freeFireUid: user?.freeFireUid || slot?.freeFireUid || 'Not set',
        phoneNumber:
          latestWith?.accountNumber ||
          user?.phoneNumber ||
          slot?.phone ||
          'Not provided',
        withdrawAccount: latestWith?.accountNumber,
        withdrawMethod: latestWith?.method,
        placement: Number(rec.placement || 1),
        kills: Number(rec.kills || 0),
        isWinner: Number(rec.winCredited || 0) > 0 || Number(rec.placement) === 1,
        winPrize: Math.round(Number(rec.winPrizeCredited || 0)),
        killPrize: Math.round(Number(rec.killPrizeCredited || 0)),
        totalPrize,
        payoutStatus: isPaid ? 'PAID' : 'PENDING',
        paidAt: payoutEntry?.paidAt || rec.payoutPaidAt,
        paidBy: payoutEntry?.paidBy || rec.payoutPaidBy,
      });
    }
  } else if (result.standings && result.standings.length > 0) {
    const perUidFallback = new Map<string, MatchWinnerRow>();

    for (const standing of result.standings) {
      const uids = Array.from(
        new Set(
          [
            ...(standing.playerUids || []),
            ...(standing.players || []).map((p) => p.uid || ''),
          ].filter(Boolean)
        )
      );
      if (uids.length === 0) continue;

      const kills = Math.max(0, Math.round(Number(standing.kills || 0)));
      const placement = Math.max(1, Math.round(Number(standing.placement || 1)));
      const computed = calculateMatchPrizeBreakdown(tournament, placement, kills);

      const rawWin =
        typeof standing.placementPrizeWon === 'number'
          ? Math.max(0, Number(standing.placementPrizeWon))
          : computed.winPrize;
      const rawKill =
        typeof standing.killPrizeWon === 'number'
          ? Math.max(0, Number(standing.killPrizeWon))
          : computed.killPrize;
      const rawTotal =
        typeof standing.prizeWon === 'number' && standing.prizeWon >= 0
          ? Math.round(standing.prizeWon)
          : rawWin + rawKill;

      if (rawTotal < 1) continue;

      const parts = uids.length;
      const shareBase = Math.floor(rawTotal / parts);
      const shareRem = rawTotal - shareBase * parts;
      const winBase = Math.floor(rawWin / parts);
      const winRem = rawWin - winBase * parts;
      const killBase = Math.floor(rawKill / parts);
      const killRem = rawKill - killBase * parts;

      uids.forEach((uid, idx) => {
        const totalShare = idx === 0 ? shareBase + shareRem : shareBase;
        if (totalShare < 1) return;

        const winShare = idx === 0 ? winBase + winRem : winBase;
        const killShare = idx === 0 ? killBase + killRem : killBase;

        const user = usersByUid[uid];
        const slot = slotInfoByUid[uid];
        const latestWith = latestWithdrawByUid[uid];
        const payoutEntry = payoutMap[uid];
        const isPaid = payoutEntry?.status === 'PAID';

        if (!perUidFallback.has(uid)) {
          const slotEnteredGameName =
            slot?.inGameName || slot?.name || standing.teamName || '';
          perUidFallback.set(uid, {
            uid,
            name:
              slotEnteredGameName ||
              user?.inGameName ||
              user?.displayName ||
              'Player',
            inGameName:
              slotEnteredGameName ||
              user?.inGameName ||
              user?.displayName ||
              'Not set',
            freeFireUid: user?.freeFireUid || slot?.freeFireUid || 'Not set',
            phoneNumber:
              latestWith?.accountNumber ||
              user?.phoneNumber ||
              slot?.phone ||
              'Not provided',
            withdrawAccount: latestWith?.accountNumber,
            withdrawMethod: latestWith?.method,
            placement,
            kills,
            isWinner: placement === 1,
            winPrize: winShare,
            killPrize: killShare,
            totalPrize: totalShare,
            payoutStatus: isPaid ? 'PAID' : 'PENDING',
            paidAt: payoutEntry?.paidAt,
            paidBy: payoutEntry?.paidBy,
          });
        }
      });
    }

    rows.push(...perUidFallback.values());
  }

  return rows.sort((a, b) => a.placement - b.placement || b.totalPrize - a.totalPrize);
}

export const WinnerPayoutListPage: React.FC<WinnerPayoutListPageProps> = ({
  onNavigate,
  onBack,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { formatBDT } = useLanguage();

  const isUserAdmin = Boolean(
    currentUser &&
      userProfile &&
      isAdmin &&
      isUserAdminAccount(userProfile, currentUser.email)
  );

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matchResultsMap, setMatchResultsMap] = useState<Record<string, MatchResult>>({});
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchSearch, setMatchSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [payingUid, setPayingUid] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [todayDhakaKey, setTodayDhakaKey] = useState<string>(() => getDhakaDateKey());

  useEffect(() => {
    const timer = setInterval(() => {
      const nextKey = getDhakaDateKey();
      setTodayDhakaKey((prev) => (prev === nextKey ? prev : nextKey));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tourList, usersSnap, withdrawList] = await Promise.all([
        fetchTournaments(),
        getDocs(collection(db, 'users')),
        fetchWithdrawalRequests(),
      ]);

      setTournaments(tourList);

      const uList: UserProfile[] = [];
      usersSnap.forEach((d) => {
        const data = d.data() as UserProfile;
        uList.push({ ...data, uid: data.uid || d.id });
      });
      setUsersList(uList);
      setWithdrawals(withdrawList);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, 'tournaments');
      }
      setToastMessage('ডেটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isUserAdmin) return;
    loadData();
    const unsubResults = subscribeAllMatchResults(setMatchResultsMap);
    const unsubTournaments = onSnapshot(
      collection(db, 'tournaments'),
      (snap) => {
        const list: Tournament[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Tournament), id: d.id });
        });
        setTournaments(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'tournaments');
      }
    );
    return () => {
      unsubResults();
      unsubTournaments();
    };
  }, [isUserAdmin, loadData]);

  const usersByUid = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    usersList.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [usersList]);

  const latestWithdrawByUid = useMemo(() => {
    const map: Record<string, WithdrawalRequest> = {};
    withdrawals.forEach((w) => {
      if (!map[w.userId]) {
        map[w.userId] = w;
      }
    });
    return map;
  }, [withdrawals]);

  // Daily Reset System: Filter to TODAY'S matches only (Asia/Dhaka), then sort
  // strictly chronologically by admin-configured start time (morning -> night).
  const sortedTournaments = useMemo(() => {
    return tournaments
      .filter((t) => isTodayMatchForWinnerList(t, matchResultsMap[t.id], todayDhakaKey))
      .sort((a, b) => {
        const aTime = parseMatchStartTimestamp(a.matchDate, a.matchTime, a.createdAt);
        const bTime = parseMatchStartTimestamp(b.matchDate, b.matchTime, b.createdAt);
        if (aTime !== bTime) return aTime - bTime;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
  }, [tournaments, matchResultsMap, todayDhakaKey]);

  useEffect(() => {
    if (selectedMatchId && !sortedTournaments.some((t) => t.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [selectedMatchId, sortedTournaments]);

  const winnersByTournamentId = useMemo(() => {
    const map: Record<string, MatchWinnerRow[]> = {};
    sortedTournaments.forEach((tour) => {
      map[tour.id] = buildMatchWinnerRows(
        tour,
        matchResultsMap[tour.id],
        usersByUid,
        latestWithdrawByUid
      );
    });
    return map;
  }, [sortedTournaments, matchResultsMap, usersByUid, latestWithdrawByUid]);

  const filteredMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    if (!q) return sortedTournaments;
    return sortedTournaments.filter((t) => {
      const cat = String(getTournamentCategory(t)).toLowerCase();
      return (
        (t.title || '').toLowerCase().includes(q) ||
        (t.titleBn || '').toLowerCase().includes(q) ||
        cat.includes(q) ||
        (t.matchTime || '').toLowerCase().includes(q) ||
        (t.matchDate || '').toLowerCase().includes(q)
      );
    });
  }, [sortedTournaments, matchSearch]);

  const globalSummary = useMemo(() => {
    let totalWinners = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let pendingAmount = 0;
    sortedTournaments.forEach((t) => {
      const rows = winnersByTournamentId[t.id] || [];
      rows.forEach((r) => {
        totalWinners += 1;
        if (r.payoutStatus === 'PAID') {
          paidCount += 1;
        } else {
          pendingCount += 1;
          pendingAmount += r.totalPrize;
        }
      });
    });
    return { totalWinners, pendingCount, paidCount, pendingAmount };
  }, [sortedTournaments, winnersByTournamentId]);

  const selectedMatch = useMemo(
    () => sortedTournaments.find((t) => t.id === selectedMatchId) || null,
    [sortedTournaments, selectedMatchId]
  );

  const selectedMatchWinners = useMemo(
    () => (selectedMatch ? winnersByTournamentId[selectedMatch.id] || [] : []),
    [selectedMatch, winnersByTournamentId]
  );

  const handleCopyText = (key: string, value: string) => {
    if (!value || value === 'Not provided' || value === 'Not set') return;
    navigator.clipboard.writeText(value);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleMarkPaid = async (tour: Tournament, winner: MatchWinnerRow) => {
    if (payingUid || winner.payoutStatus === 'PAID') return;
    setPayingUid(winner.uid);
    try {
      const adminName = userProfile?.displayName || userProfile?.email || 'Admin';
      const res = await markMatchWinnerPaid(
        tour.id,
        winner.uid,
        winner.totalPrize,
        adminName,
        tour.title
      );
      setToastMessage(res.message);
    } finally {
      setPayingUid(null);
    }
  };

  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-[#070B18] p-8 text-center text-white flex flex-col items-center justify-center gap-3">
        <Ban className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold font-gaming text-red-400">
          Only Admin
        </h2>
        <p className="text-xs text-slate-400">
          Access Denied — শুধুমাত্র Admin-রাই Winner List / Payout List দেখতে পারবেন।
        </p>
        <button
          type="button"
          onClick={() => (onBack ? onBack() : onNavigate?.('home'))}
          className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B18] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              if (selectedMatchId) {
                setSelectedMatchId(null);
              } else if (onBack) {
                onBack();
              } else {
                onNavigate?.('profile');
              }
            }}
            className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-bold font-gaming text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{selectedMatchId ? 'Back to All Matches' : 'Back to Profile'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-white">
              {selectedMatch ? selectedMatch.title : 'Winner List / Payout List'}
            </h1>
          </div>

          {selectedMatch ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="text-amber-300 font-semibold">{selectedMatch.matchTime}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedMatch.matchDate}</span>
              <span aria-hidden="true">·</span>
              <span>{getTournamentCategory(selectedMatch)}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedMatch.map}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              শুধুমাত্র আজকের ({todayDhakaKey}) ম্যাচগুলো সকাল থেকে রাত পর্যন্ত সময় অনুযায়ী সাজানো · রাত ১২:০০ টার পর আগের দিনের লিস্ট অটো ক্লিয়ার হয়।
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-slate-700 text-sky-300 font-bold font-gaming text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 self-start sm:self-center shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* VIEW 1: TODAY'S MATCHES LIST (CHRONOLOGICALLY ORDERED, DAILY RESET AT 12:00 AM) */}
      {!selectedMatch && (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Today&apos;s Matches</span>
              <span className="text-xl font-black font-gaming text-white mt-0.5 block">
                {sortedTournaments.length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Winners (৳1+)</span>
              <span className="text-xl font-black font-gaming text-sky-400 mt-0.5 block">
                {globalSummary.totalWinners}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-amber-500/30">
              <span className="text-[11px] text-slate-400 block font-semibold">Pending Payouts</span>
              <span className="text-xl font-black font-gaming text-amber-400 mt-0.5 block">
                {globalSummary.pendingCount} · {formatBDT(globalSummary.pendingAmount)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-emerald-500/30">
              <span className="text-[11px] text-slate-400 block font-semibold">Paid Winners</span>
              <span className="text-xl font-black font-gaming text-emerald-400 mt-0.5 block">
                {globalSummary.paidCount}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={matchSearch}
              onChange={(e) => setMatchSearch(e.target.value)}
              placeholder="Search today's match name, category, time..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#0D1428] border border-slate-800 focus:border-sky-400 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Match List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-[#0D1428] animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-[#0D1428] border border-slate-800 space-y-1.5">
              <p className="text-sm font-bold text-white">
                {matchSearch.trim()
                  ? 'সার্চের সাথে মিল থাকা আজকের কোনো ম্যাচ পাওয়া যায়নি।'
                  : 'আজকের কোনো ম্যাচ পাওয়া যায়নি।'}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                প্রতিদিন রাত ১২:০০ টার পর আগের দিনের ম্যাচ অটো ক্লিয়ার হয়ে যায়। আজ নতুন ম্যাচ বানালে এখানে শুরু হওয়ার সময় অনুযায়ী দেখাবে।
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-[#0D1428] border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
              {filteredMatches.map((tour, index) => {
                const winners = winnersByTournamentId[tour.id] || [];
                const paidCount = winners.filter((w) => w.payoutStatus === 'PAID').length;
                const pendingCount = winners.length - paidCount;
                const totalPayout = winners.reduce((sum, w) => sum + w.totalPrize, 0);
                const category = getTournamentCategory(tour);
                const hasResult = Boolean(matchResultsMap[tour.id]);

                return (
                  <button
                    key={tour.id}
                    type="button"
                    onClick={() => setSelectedMatchId(tour.id)}
                    className="w-full min-h-[72px] px-4 sm:px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#111D35]/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#070B18] border border-slate-700 text-amber-400 font-black font-gaming text-xs flex items-center justify-center shrink-0 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-300 tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            {tour.matchTime || 'Time TBD'}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] tabular-nums">
                            <Calendar className="w-3 h-3" />
                            {tour.matchDate || 'Date TBD'}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="text-[11px] font-semibold text-sky-400">
                            {category}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {tour.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right tabular-nums">
                      <div>
                        {winners.length > 0 ? (
                          <>
                            <span className="text-xs sm:text-sm font-black font-gaming text-emerald-400 block">
                              {winners.length} Winners · {formatBDT(totalPayout)}
                            </span>
                            <span className="text-[11px] block mt-0.5">
                              {pendingCount > 0 ? (
                                <span className="text-amber-300 font-semibold">
                                  Pending: {pendingCount} · Paid: {paidCount}
                                </span>
                              ) : (
                                <span className="text-emerald-300 font-semibold">
                                  All {paidCount} Paid
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 block">
                            {hasResult ? '0 Winners (৳1+)' : 'Result Pending'}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SINGLE MATCH WINNER / PAYOUT LIST ONLY */}
      {selectedMatch && (
        <div className="space-y-4">
          {/* Selected Match Summary Bar */}
          <div className="grid grid-cols-3 gap-3 tabular-nums">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1428] border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">
                Winners (৳1+)
              </span>
              <span className="text-lg sm:text-xl font-black font-gaming text-white mt-0.5 block">
                {selectedMatchWinners.length}
              </span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1428] border border-amber-500/30">
              <span className="text-[11px] text-slate-400 block font-semibold">Pending</span>
              <span className="text-lg sm:text-xl font-black font-gaming text-amber-400 mt-0.5 block">
                {selectedMatchWinners.filter((w) => w.payoutStatus === 'PENDING').length}
              </span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0D1428] border border-emerald-500/30">
              <span className="text-[11px] text-slate-400 block font-semibold">Paid</span>
              <span className="text-lg sm:text-xl font-black font-gaming text-emerald-400 mt-0.5 block">
                {selectedMatchWinners.filter((w) => w.payoutStatus === 'PAID').length}
              </span>
            </div>
          </div>

          {selectedMatchWinners.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#0D1428] border border-slate-800 text-center space-y-3">
              <Trophy className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">
                এই ম্যাচে এখনো কোনো Winner (৳1+) নেই
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                শুধুমাত্র ১ টাকা বা তার বেশি পাওয়া প্লেয়ারদের নাম এখানে দেখাবে (০ টাকা পেলে দেখাবে না)। Admin Panel → Scoring &amp; Prizes থেকে রেজাল্ট ডিক্লেয়ার করলে এখানে সাথে সাথে চলে আসবে।
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin', { tab: 'results' })}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
                >
                  Open Scoring &amp; Prizes
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedMatchWinners.map((winner) => {
                const isPaid = winner.payoutStatus === 'PAID';
                const isPaying = payingUid === winner.uid;
                const copyPhoneKey = `phone_${winner.uid}`;
                const copyUidKey = `uid_${winner.uid}`;

                return (
                  <div
                    key={winner.uid}
                    className={`p-4 sm:p-5 rounded-2xl bg-[#0D1428] border flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs transition-colors ${
                      isPaid ? 'border-emerald-500/35' : 'border-amber-500/35'
                    }`}
                  >
                    {/* Left: All Winner Details */}
                    <div className="space-y-2.5 min-w-0 flex-1">
                      {/* Row 1: Name, Win Status, Payout Status */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 font-black text-white text-sm sm:text-base">
                          <User className="w-4 h-4 text-sky-400 shrink-0" />
                          <span>{winner.name}</span>
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span
                          className={`font-bold text-xs ${
                            winner.isWinner ? 'text-emerald-400' : 'text-sky-300'
                          }`}
                        >
                          {winner.isWinner
                            ? 'Win: Yes (Winner #1)'
                            : `Win: No (Rank #${winner.placement})`}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span
                          className={`font-black uppercase text-xs ${
                            isPaid ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isPaid ? 'Status: Paid' : 'Status: Pending'}
                        </span>
                      </div>

                      {/* Row 2: IGN, Free Fire UID, Kills, Total Money */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs tabular-nums">
                        <div className="p-2.5 rounded-xl bg-[#111D35] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">IGN (In-Game Name)</span>
                          <span className="font-bold text-sky-300 inline-flex items-center gap-1 mt-0.5 truncate max-w-full">
                            <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{winner.inGameName}</span>
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 block">Free Fire UID</span>
                            <span className="font-mono font-bold text-white inline-flex items-center gap-1 mt-0.5 truncate max-w-full">
                              <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{winner.freeFireUid}</span>
                            </span>
                          </div>
                          {winner.freeFireUid !== 'Not set' && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(copyUidKey, winner.freeFireUid)}
                              title="Copy Free Fire UID"
                              className="p-1.5 rounded-lg bg-[#0D1428] hover:bg-slate-800 text-sky-300 cursor-pointer shrink-0"
                            >
                              {copiedId === copyUidKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#111D35] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Total Kills</span>
                          <span className="font-black font-gaming text-white text-sm mt-0.5 block">
                            {winner.kills} {winner.kills === 1 ? 'Kill' : 'Kills'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#111D35] border border-emerald-500/25">
                          <span className="text-[10px] text-slate-400 block">Mot Koto Taka Pabe</span>
                          <span className="font-black font-gaming text-emerald-400 text-base mt-0.5 block">
                            {formatBDT(winner.totalPrize)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Win ৳{winner.winPrize} + Kill ৳{winner.killPrize}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: bKash / Phone Number + Copy */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          <span>
                            {winner.withdrawMethod
                              ? `${winner.withdrawMethod} / Phone:`
                              : 'bKash / Phone Number:'}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-white bg-[#111D35] border border-slate-700 px-3 py-1 rounded-lg select-all tabular-nums">
                          {winner.phoneNumber}
                        </span>
                        {winner.phoneNumber !== 'Not provided' && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(copyPhoneKey, winner.phoneNumber)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-sky-300 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedId === copyPhoneKey ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Number</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isPaid && winner.paidAt && (
                        <p className="text-[11px] text-emerald-300">
                          Paid on {new Date(winner.paidAt).toLocaleString()}
                          {winner.paidBy ? ` by ${winner.paidBy}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Right: Paid Action Button */}
                    <div className="shrink-0 w-full lg:w-auto">
                      {isPaid ? (
                        <div className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-black font-gaming text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 w-full lg:w-auto">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>Paid</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(payingUid)}
                          onClick={() => handleMarkPaid(selectedMatch, winner)}
                          className="min-h-[44px] w-full lg:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black font-gaming text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{isPaying ? 'Saving...' : `Paid (৳${winner.totalPrize})`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ToastNotification
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
