import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  runTransaction,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  MatchResult,
  TeamPlacementResult,
  DistributedPrizeRecord,
  Tournament,
  UserProfile,
  WalletTransaction,
  AppNotification,
} from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import { getWalletBreakdown } from './walletService';
import {
  getTournamentCategory,
  isPlacementPrizeCategory,
  supportsPerKillPrize,
} from '../constants/categoryRules';
import {
  getCurrentWeekStartIso,
  resolveEffectiveWeeklyStats,
  WeeklyLeaderboardMeta,
} from './weeklyLeaderboardService';
import {
  getOptimisticMatchResultsSnapshot,
  mergeOptimisticMatchResults,
  subscribeOptimisticResultStore,
} from './optimisticResultStore';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  inGameName?: string;
  freeFireUid?: string;
  teamName?: string;
  avatarUrl?: string;
  totalEarnings: number;
  totalWins: number;
  totalKills: number;
  totalMatches: number;
  weeklyEarnings?: number;
  weeklyWins?: number;
  weeklyKills?: number;
  weeklyMatches?: number;
  weekStartIso?: string;
  weekResetAt?: string;
  isBanned?: boolean;
  banReason?: string;
  banExpiresAt?: string | null;
  updatedAt: string;
}

export async function syncLeaderboardEntry(profile: Partial<UserProfile> & { uid: string }): Promise<void> {
  try {
    const lbRef = doc(db, 'leaderboard', profile.uid);
    const snap = await getDoc(lbRef);
    const existing = snap.exists() ? (snap.data() as Partial<LeaderboardEntry>) : {};
    const nowIso = new Date().toISOString();

    const matchesCount = Math.max(
      Number(profile.totalMatches ?? 0),
      Number(profile.totalTournaments ?? 0),
      Number(existing.totalMatches ?? 0)
    );

    const entry: LeaderboardEntry = {
      uid: profile.uid,
      displayName: profile.displayName || existing.displayName || 'Player',
      inGameName: profile.inGameName ?? existing.inGameName ?? '',
      freeFireUid: profile.freeFireUid ?? existing.freeFireUid ?? '',
      teamName: profile.teamName ?? existing.teamName ?? '',
      avatarUrl: profile.avatarUrl ?? existing.avatarUrl ?? '',
      totalEarnings: Math.max(Number(profile.totalEarnings ?? 0), Number(existing.totalEarnings ?? 0)),
      totalWins: Math.max(Number(profile.totalWins ?? 0), Number(existing.totalWins ?? 0)),
      totalKills: Math.max(Number(profile.totalKills ?? 0), Number(existing.totalKills ?? 0)),
      totalMatches: matchesCount,
      weeklyEarnings: profile.weeklyEarnings ?? existing.weeklyEarnings ?? 0,
      weeklyWins: profile.weeklyWins ?? existing.weeklyWins ?? 0,
      weeklyKills: profile.weeklyKills ?? existing.weeklyKills ?? 0,
      weeklyMatches: profile.weeklyMatches ?? existing.weeklyMatches ?? 0,
      weekStartIso: profile.weekStartIso ?? existing.weekStartIso ?? '',
      weekResetAt: profile.weekResetAt ?? existing.weekResetAt ?? '',
      isBanned: profile.isBanned ?? existing.isBanned ?? false,
      banReason: profile.banReason ?? existing.banReason ?? '',
      banExpiresAt: profile.banExpiresAt ?? existing.banExpiresAt ?? null,
      updatedAt: nowIso,
    };

    await setDoc(lbRef, entry, { merge: true });
  } catch {
    // Non-blocking leaderboard sync
  }
}

export const DEFAULT_PLACEMENT_POINTS: Record<number, number> = {
  1: 12,
  2: 9,
  3: 8,
  4: 7,
  5: 6,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1,
};

export function calculatePoints(
  placement: number,
  kills: number,
  killPointsMultiplier = 1,
  customPlacementPoints?: Record<number, number>
) {
  const pMap = customPlacementPoints || DEFAULT_PLACEMENT_POINTS;
  const placementPoints = pMap[placement] || 0;
  const killPoints = kills * killPointsMultiplier;
  const totalPoints = placementPoints + killPoints;
  return { placementPoints, killPoints, totalPoints };
}

/**
 * Canonical Auto-Winning calculator for ALL match categories:
 * - BR MATCH & FREE MATCH: placement prize (1st-3rd, or 1st-5th for Free Match) + (kills * perKillPrize)
 * - CS 1V1/2V2, CS 4V4, LONE WOLF, LONE WOLF HEADSHOT, LOST TO WIN:
 *   Winner (#1) gets (firstPrize > 0 ? firstPrize : prizePool), per-kill prize is strictly 0.
 */
export function calculateMatchPrizeBreakdown(
  tournament: Partial<Tournament>,
  placement: number,
  kills: number
): { winPrize: number; killPrize: number; totalPrize: number } {
  const rank = Math.max(0, Math.floor(Number(placement || 0)));
  const safeKills = Math.max(0, Math.floor(Number(kills || 0)));
  const category = getTournamentCategory(tournament as Tournament);
  const isPlacementMode = isPlacementPrizeCategory(category);
  const allowPerKill = supportsPerKillPrize(category);

  let winPrize = 0;
  if (isPlacementMode) {
    if (rank === 1) {
      winPrize =
        Number(tournament.firstPrize || 0) > 0
          ? Number(tournament.firstPrize || 0)
          : Number(tournament.prizePool || 0);
    } else if (rank === 2) {
      winPrize = Number(tournament.secondPrize || 0);
    } else if (rank === 3) {
      winPrize = Number(tournament.thirdPrize || 0);
    } else if (rank === 4) {
      winPrize = Number(tournament.fourthPrize || 0);
    } else if (rank === 5) {
      winPrize = Number(tournament.fifthPrize || 0);
    }
  } else {
    if (rank === 1) {
      winPrize =
        Number(tournament.firstPrize || 0) > 0
          ? Number(tournament.firstPrize || 0)
          : Number(tournament.prizePool || 0);
    }
  }

  winPrize = Math.max(0, Math.round(winPrize));
  const perKillRate = allowPerKill ? Math.max(0, Number(tournament.perKillPrize || 0)) : 0;
  const killPrize = allowPerKill ? Math.max(0, Math.round(safeKills * perKillRate)) : 0;
  const totalPrize = winPrize + killPrize;

  return { winPrize, killPrize, totalPrize };
}

function splitTotalEqually(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const base = Math.floor(safeTotal / parts);
  const remainder = safeTotal - base * parts;
  return Array.from({ length: parts }, (_, idx) => (idx === 0 ? base + remainder : base));
}

export function buildDistributedRecordsFromStandings(
  tournament: Tournament,
  standings: TeamPlacementResult[],
  currentWeekStartIso: string
): DistributedPrizeRecord[] {
  const perUidMap = new Map<string, DistributedPrizeRecord>();

  for (const standing of standings) {
    const uidsToCredit = Array.from(new Set((standing.playerUids || []).filter(Boolean)));
    if (uidsToCredit.length === 0) continue;

    const kills = Math.max(0, Math.round(Number(standing.kills || 0)));
    const placement = Math.max(1, Math.round(Number(standing.placement || 1)));
    const isWinner = placement === 1 ? 1 : 0;

    // Resolve win + kill prize using tournament rules (per-kill strictly only for BR/Free Match)
    const allowPerKill = supportsPerKillPrize(getTournamentCategory(tournament));
    const computed = calculateMatchPrizeBreakdown(tournament, placement, kills);
    const hasExplicitBreakdown =
      typeof standing.placementPrizeWon === 'number' || typeof standing.killPrizeWon === 'number';
    const rawWinPrize = hasExplicitBreakdown
      ? Math.max(0, Number(standing.placementPrizeWon || 0))
      : computed.winPrize;
    const rawKillPrize = allowPerKill
      ? hasExplicitBreakdown
        ? Math.max(0, Number(standing.killPrizeWon || 0))
        : computed.killPrize
      : 0;
    const rawTotalPrize =
      typeof standing.prizeWon === 'number' && standing.prizeWon >= 0 && allowPerKill
        ? Math.round(standing.prizeWon)
        : rawWinPrize + rawKillPrize;

    const winShares = splitTotalEqually(rawWinPrize, uidsToCredit.length);
    const killPrizeShares = splitTotalEqually(rawKillPrize, uidsToCredit.length);
    const totalPrizeShares = splitTotalEqually(rawTotalPrize, uidsToCredit.length);
    const killCountShares = splitTotalEqually(kills, uidsToCredit.length);

    uidsToCredit.forEach((uid, idx) => {
      const winShare = winShares[idx] ?? 0;
      const killPrizeShare = killPrizeShares[idx] ?? 0;
      const prizeShare = totalPrizeShares[idx] ?? winShare + killPrizeShare;
      const killShare = killCountShares[idx] ?? 0;

      const trxId = 'trx_pz_' + tournament.id + '_' + uid.substring(0, 6);
      const notifId = 'notif_pz_' + tournament.id + '_' + uid.substring(0, 6);

      const prev = perUidMap.get(uid);
      if (prev) {
        prev.kills += killShare;
        prev.winPrizeCredited += winShare;
        prev.killPrizeCredited += killPrizeShare;
        prev.prizeCredited += prizeShare;
        prev.winCredited = Math.max(prev.winCredited, isWinner);
        prev.placement = Math.min(prev.placement, placement);
      } else {
        perUidMap.set(uid, {
          uid,
          playerName: standing.players?.[idx]?.inGameName || standing.teamName || 'Player',
          placement,
          kills: killShare,
          winPrizeCredited: winShare,
          killPrizeCredited: killPrizeShare,
          prizeCredited: prizeShare,
          winCredited: isWinner,
          weekStartIso: currentWeekStartIso,
          trxId,
          notifId,
        });
      }
    });
  }

  return Array.from(perUidMap.values());
}

export function reconstructLegacyDistributedRecords(
  result: MatchResult,
  tournament: Tournament
): DistributedPrizeRecord[] {
  if (result.distributedRecords && result.distributedRecords.length > 0) {
    return result.distributedRecords;
  }
  const fallbackWeekIso = result.publishedAt
    ? getCurrentWeekStartIso(new Date(result.publishedAt).getTime())
    : '';
  return buildDistributedRecordsFromStandings(
    tournament,
    result.standings || [],
    fallbackWeekIso
  );
}

function applyUndoRecordToUserState(
  userData: UserProfile,
  rec: DistributedPrizeRecord,
  weeklyMeta: WeeklyLeaderboardMeta,
  currentWeekStartIso: string,
  nowIso: string
): { nextUser: UserProfile; balanceAfter: number } {
  const hasExplicitSpentFields =
    userData.spentFromDeposited !== undefined || userData.spentFromWinning !== undefined;

  const prevEarnings = Number(userData.totalEarnings || 0);
  const nextEarnings = Math.max(0, prevEarnings - Number(rec.prizeCredited || 0));

  let nextBalance: number;
  if (hasExplicitSpentFields) {
    const postUndoBreakdown = getWalletBreakdown({
      ...userData,
      totalEarnings: nextEarnings,
    });
    nextBalance = postUndoBreakdown.availableBalance;
  } else {
    const prevBreakdown = getWalletBreakdown(userData);
    const currentAvail =
      typeof userData.walletBalance === 'number'
        ? userData.walletBalance
        : prevBreakdown.availableBalance;
    nextBalance = Math.max(0, currentAvail - Number(rec.prizeCredited || 0));
  }

  const nextKills = Math.max(0, Number(userData.totalKills || 0) - Number(rec.kills || 0));
  const nextWins = Math.max(0, Number(userData.totalWins || 0) - Number(rec.winCredited || 0));

  const baseWeekly = resolveEffectiveWeeklyStats(userData, weeklyMeta);
  const sameWeek = !rec.weekStartIso || rec.weekStartIso === currentWeekStartIso;

  const nextWeeklyEarnings = sameWeek
    ? Math.max(0, baseWeekly.weeklyEarnings - Number(rec.prizeCredited || 0))
    : baseWeekly.weeklyEarnings;
  const nextWeeklyKills = sameWeek
    ? Math.max(0, baseWeekly.weeklyKills - Number(rec.kills || 0))
    : baseWeekly.weeklyKills;
  const nextWeeklyWins = sameWeek
    ? Math.max(0, baseWeekly.weeklyWins - Number(rec.winCredited || 0))
    : baseWeekly.weeklyWins;

  const nextUser: UserProfile = {
    ...userData,
    walletBalance: nextBalance,
    totalEarnings: nextEarnings,
    totalKills: nextKills,
    totalWins: nextWins,
    weeklyEarnings: nextWeeklyEarnings,
    weeklyKills: nextWeeklyKills,
    weeklyWins: nextWeeklyWins,
    weeklyMatches: baseWeekly.weeklyMatches,
    weekStartIso: currentWeekStartIso,
    weekResetAt: baseWeekly.activeResetAt,
    updatedAt: nowIso,
  };

  return { nextUser, balanceAfter: nextBalance };
}

function applyCreditRecordToUserState(
  userData: UserProfile,
  rec: DistributedPrizeRecord,
  weeklyMeta: WeeklyLeaderboardMeta,
  currentWeekStartIso: string,
  nowIso: string,
  incrementWeeklyMatch: boolean
): { nextUser: UserProfile; balanceAfter: number } {
  const hasExplicitSpentFields =
    userData.spentFromDeposited !== undefined || userData.spentFromWinning !== undefined;

  const nextEarnings = Number(userData.totalEarnings || 0) + Number(rec.prizeCredited || 0);
  let nextBalance: number;
  if (hasExplicitSpentFields) {
    const postCreditBreakdown = getWalletBreakdown({
      ...userData,
      totalEarnings: nextEarnings,
    });
    nextBalance = postCreditBreakdown.availableBalance;
  } else {
    const breakdown = getWalletBreakdown(userData);
    nextBalance = breakdown.availableBalance + Number(rec.prizeCredited || 0);
  }

  const nextKills = Number(userData.totalKills || 0) + Number(rec.kills || 0);
  const nextWins = Number(userData.totalWins || 0) + Number(rec.winCredited || 0);
  const nextMatches = Math.max(
    Number(userData.totalMatches || 0),
    Number(userData.totalTournaments || 0),
    1
  );

  const baseWeekly = resolveEffectiveWeeklyStats(userData, weeklyMeta);
  const nextWeeklyEarnings = baseWeekly.weeklyEarnings + Number(rec.prizeCredited || 0);
  const nextWeeklyKills = baseWeekly.weeklyKills + Number(rec.kills || 0);
  const nextWeeklyWins = baseWeekly.weeklyWins + Number(rec.winCredited || 0);
  const nextWeeklyMatches = incrementWeeklyMatch
    ? baseWeekly.weeklyMatches + 1
    : Math.max(1, baseWeekly.weeklyMatches);

  const nextUser: UserProfile = {
    ...userData,
    walletBalance: nextBalance,
    totalEarnings: nextEarnings,
    totalKills: nextKills,
    totalWins: nextWins,
    totalMatches: nextMatches,
    weeklyEarnings: nextWeeklyEarnings,
    weeklyKills: nextWeeklyKills,
    weeklyWins: nextWeeklyWins,
    weeklyMatches: nextWeeklyMatches,
    weekStartIso: currentWeekStartIso,
    weekResetAt: baseWeekly.activeResetAt,
    updatedAt: nowIso,
  };

  return { nextUser, balanceAfter: nextBalance };
}

function buildPrizeDescription(
  tour: Tournament,
  rec: DistributedPrizeRecord
): { description: string; descriptionBn: string } {
  const partsEn: string[] = [];
  const partsBn: string[] = [];
  if (rec.winPrizeCredited > 0) {
    partsEn.push(`Win ৳${rec.winPrizeCredited}`);
    partsBn.push(`উইন ৳${rec.winPrizeCredited}`);
  }
  const allowPerKill = supportsPerKillPrize(getTournamentCategory(tour));
  if (allowPerKill && (rec.killPrizeCredited > 0 || rec.kills > 0)) {
    partsEn.push(`${rec.kills} Kills (৳${rec.killPrizeCredited})`);
    partsBn.push(`${rec.kills} কিল (৳${rec.killPrizeCredited})`);
  }
  const detailEn = partsEn.length > 0 ? ` [${partsEn.join(' + ')}]` : '';
  const detailBn = partsBn.length > 0 ? ` [${partsBn.join(' + ')}]` : '';

  return {
    description: `${tour.title} • Rank #${rec.placement}${detailEn}`,
    descriptionBn: `${tour.titleBn || tour.title} • #${rec.placement} স্থান${detailBn}`,
  };
}

export async function fetchMatchResult(tournamentId: string): Promise<MatchResult | null> {
  const opt = getOptimisticMatchResultsSnapshot()[tournamentId] || null;
  try {
    const snap = await getDoc(doc(db, 'matchResults', tournamentId));
    if (snap.exists()) {
      const serverRes = snap.data() as MatchResult;
      if (opt) {
        const optTime = opt.editedAt || opt.publishedAt || opt.createdAt || '';
        const serverTime = serverRes.editedAt || serverRes.publishedAt || serverRes.createdAt || '';
        if (optTime >= serverTime) return opt;
      }
      return serverRes;
    }
    return opt;
  } catch (err) {
    if (opt) return opt;
    handleFirestoreError(err, OperationType.GET, `matchResults/${tournamentId}`);
  }
}

export async function saveMatchResult(
  tournament: Tournament,
  standings: TeamPlacementResult[]
): Promise<void> {
  try {
    const resultDocRef = doc(db, 'matchResults', tournament.id);
    const resultData: MatchResult = {
      id: tournament.id,
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      matchCategory: String(getTournamentCategory(tournament)),
      standings,
      isVerified: false,
      isPrizeDistributed: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(resultDocRef, resultData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matchResults/${tournament.id}`);
  }
}

export async function publishResultAndDistributePrizes(
  tournamentId: string
): Promise<{ success: boolean; message: string }> {
  const resultDocRef = doc(db, 'matchResults', tournamentId);
  const tourDocRef = doc(db, 'tournaments', tournamentId);
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const weeklyMetaRef = doc(db, 'settings', 'weeklyLeaderboard');
      const [resultSnap, tourSnap, weeklyMetaSnap] = await Promise.all([
        txn.get(resultDocRef),
        txn.get(tourDocRef),
        txn.get(weeklyMetaRef),
      ]);
      if (!resultSnap.exists()) throw new Error('ম্যাচ ফলাফল পাওয়া যায়নি!');
      const result = resultSnap.data() as MatchResult;

      if (result.isPrizeDistributed) {
        throw new Error('এই টুর্নামেন্টের প্রাইজ ইতিমধ্যে বিতরণ করা হয়েছে!');
      }

      if (!tourSnap.exists()) throw new Error('টুর্নামেন্ট পাওয়া যায়নি!');
      const tour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };

      const weeklyMeta: WeeklyLeaderboardMeta = weeklyMetaSnap.exists()
        ? (weeklyMetaSnap.data() as WeeklyLeaderboardMeta)
        : {};
      const currentWeekStartIso = getCurrentWeekStartIso();

      const desiredRecords = buildDistributedRecordsFromStandings(
        tour,
        result.standings || [],
        currentWeekStartIso
      );

      // Parallel-read all affected user docs before writing
      const userDocsMap = new Map<string, UserProfile>();
      const userSnaps = await Promise.all(
        desiredRecords.map((rec) => txn.get(doc(db, 'users', rec.uid)))
      );
      desiredRecords.forEach((rec, idx) => {
        const uSnap = userSnaps[idx];
        if (uSnap?.exists()) {
          userDocsMap.set(rec.uid, uSnap.data() as UserProfile);
        }
      });

      const persistedRecords: DistributedPrizeRecord[] = [];
      let totalDistributedAmount = 0;

      for (const rec of desiredRecords) {
        const userData = userDocsMap.get(rec.uid);
        if (!userData) continue;

        const { nextUser, balanceAfter } = applyCreditRecordToUserState(
          userData,
          rec,
          weeklyMeta,
          currentWeekStartIso,
          nowIso,
          true
        );

        const userRef = doc(db, 'users', rec.uid);
        txn.update(userRef, {
          walletBalance: nextUser.walletBalance,
          totalEarnings: nextUser.totalEarnings,
          totalKills: nextUser.totalKills,
          totalWins: nextUser.totalWins,
          totalMatches: nextUser.totalMatches,
          weeklyEarnings: nextUser.weeklyEarnings,
          weeklyKills: nextUser.weeklyKills,
          weeklyWins: nextUser.weeklyWins,
          weeklyMatches: nextUser.weeklyMatches,
          weekStartIso: currentWeekStartIso,
          weekResetAt: nextUser.weekResetAt || '',
          updatedAt: nowIso,
        });

        const lbRef = doc(db, 'leaderboard', rec.uid);
        txn.set(
          lbRef,
          {
            uid: rec.uid,
            displayName: nextUser.displayName || 'Player',
            inGameName: nextUser.inGameName || '',
            freeFireUid: nextUser.freeFireUid || '',
            teamName: nextUser.teamName || '',
            avatarUrl: nextUser.avatarUrl || '',
            totalEarnings: nextUser.totalEarnings,
            totalWins: nextUser.totalWins,
            totalKills: nextUser.totalKills,
            totalMatches: nextUser.totalMatches,
            weeklyEarnings: nextUser.weeklyEarnings,
            weeklyWins: nextUser.weeklyWins,
            weeklyKills: nextUser.weeklyKills,
            weeklyMatches: nextUser.weeklyMatches,
            weekStartIso: currentWeekStartIso,
            weekResetAt: nextUser.weekResetAt || '',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        persistedRecords.push(rec);
        totalDistributedAmount += rec.prizeCredited;

        if (rec.prizeCredited > 0) {
          const trxId = rec.trxId || 'trx_pz_' + tournamentId + '_' + rec.uid.substring(0, 6);
          const trxRef = doc(db, 'transactions', trxId);
          const { description, descriptionBn } = buildPrizeDescription(tour, rec);
          const trxData: WalletTransaction = {
            id: trxId,
            userId: rec.uid,
            type: 'PRIZE',
            amount: rec.prizeCredited,
            status: 'COMPLETED',
            referenceId: tournamentId,
            tournamentId,
            tournamentTitle: tour.title,
            tournamentTitleBn: tour.titleBn || '',
            matchCategory: String(getTournamentCategory(tour)),
            placement: rec.placement,
            kills: rec.kills,
            killPrize: rec.killPrizeCredited,
            winPrize: rec.winPrizeCredited,
            reversed: false,
            description,
            descriptionBn,
            balanceAfter,
            createdAt: nowIso,
          };
          txn.set(trxRef, trxData);

          const notifId = rec.notifId || 'notif_pz_' + tournamentId + '_' + rec.uid.substring(0, 6);
          const notifRef = doc(db, 'notifications', notifId);
          const notif: AppNotification = {
            id: notifId,
            userId: rec.uid,
            title: 'Auto Winning Credited!',
            titleBn: 'অটো উইনিং ব্যালেন্স যোগ হয়েছে!',
            message: `You won ৳${rec.prizeCredited} in ${tour.title} (Rank #${rec.placement}, ${rec.kills} Kills).`,
            messageBn: `${tour.titleBn || tour.title} ম্যাচে #${rec.placement} স্থান ও ${rec.kills} কিল করে আপনার Winning Balance-এ ৳${rec.prizeCredited} যোগ হয়েছে!`,
            type: 'SUCCESS',
            read: false,
            createdAt: nowIso,
          };
          txn.set(notifRef, notif);
        }
      }

      txn.update(resultDocRef, {
        isVerified: true,
        isPrizeDistributed: true,
        distributedRecords: persistedRecords,
        totalDistributedAmount,
        publishedAt: nowIso,
      });

      txn.update(tourDocRef, {
        status: 'COMPLETED',
        updatedAt: nowIso,
      });

      return {
        success: true,
        message: `ফলাফল ডিক্লেয়ার হয়েছে এবং বিজয়ীদের Winning Balance-এ মোট ৳${totalDistributedAmount} অটো যোগ হয়েছে!`,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `matchResults/${tournamentId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'প্রাইজ বিতরণে সমস্যা হয়েছে।' };
  }
}

/**
 * Single atomic Save & Declare Result (or Edit & Recalculate if already distributed).
 * Uses parallel reads inside ONE transaction for minimal latency.
 */
export async function declareAndDistributeMatchResult(
  tournament: Tournament,
  standings: TeamPlacementResult[],
  customNowIso?: string
): Promise<{ success: boolean; message: string }> {
  return editAndRedeclareMatchResult(tournament, standings, customNowIso);
}

/**
 * Atomically reverses previously distributed prizes/stats (if any) and applies new standings/prizes
 * inside ONE Firestore transaction with parallel document reads.
 */
export async function editAndRedeclareMatchResult(
  tournament: Tournament,
  newStandings: TeamPlacementResult[],
  customNowIso?: string
): Promise<{ success: boolean; message: string }> {
  const tournamentId = tournament.id;
  const resultDocRef = doc(db, 'matchResults', tournamentId);
  const tourDocRef = doc(db, 'tournaments', tournamentId);
  const nowIso = customNowIso || new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const weeklyMetaRef = doc(db, 'settings', 'weeklyLeaderboard');
      const [resultSnap, tourSnap, weeklyMetaSnap] = await Promise.all([
        txn.get(resultDocRef),
        txn.get(tourDocRef),
        txn.get(weeklyMetaRef),
      ]);
      if (!tourSnap.exists()) throw new Error('টুর্নামেন্ট পাওয়া যায়নি!');
      const tour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };

      const weeklyMeta: WeeklyLeaderboardMeta = weeklyMetaSnap.exists()
        ? (weeklyMetaSnap.data() as WeeklyLeaderboardMeta)
        : {};
      const currentWeekStartIso = getCurrentWeekStartIso();

      const oldResult = resultSnap.exists() ? (resultSnap.data() as MatchResult) : null;
      const wasAlreadyDistributed = Boolean(oldResult?.isPrizeDistributed);
      const oldRecords: DistributedPrizeRecord[] = wasAlreadyDistributed && oldResult
        ? reconstructLegacyDistributedRecords(oldResult, tour)
        : [];

      const newRecords = buildDistributedRecordsFromStandings(
        tour,
        newStandings,
        currentWeekStartIso
      );

      // Union of all affected UIDs — parallel-read ALL docs before writing
      const allUids = new Set<string>();
      oldRecords.forEach((r) => allUids.add(r.uid));
      newRecords.forEach((r) => allUids.add(r.uid));

      const uidList = Array.from(allUids);
      const userSnaps = await Promise.all(
        uidList.map((uid) => txn.get(doc(db, 'users', uid)))
      );
      const userStateMap = new Map<string, UserProfile>();
      uidList.forEach((uid, idx) => {
        const uSnap = userSnaps[idx];
        if (uSnap?.exists()) {
          userStateMap.set(uid, uSnap.data() as UserProfile);
        }
      });

      // 1. Revert old credits in memory first
      const oldRecByUid = new Map<string, DistributedPrizeRecord>();
      for (const oldRec of oldRecords) {
        oldRecByUid.set(oldRec.uid, oldRec);
        const state = userStateMap.get(oldRec.uid);
        if (!state) continue;
        const { nextUser } = applyUndoRecordToUserState(
          state,
          oldRec,
          weeklyMeta,
          currentWeekStartIso,
          nowIso
        );
        userStateMap.set(oldRec.uid, nextUser);
      }

      // 2. Apply new credits in memory
      const newRecByUid = new Map<string, DistributedPrizeRecord>();
      const persistedNewRecords: DistributedPrizeRecord[] = [];
      let totalDistributedAmount = 0;

      for (const newRec of newRecords) {
        newRecByUid.set(newRec.uid, newRec);
        const state = userStateMap.get(newRec.uid);
        if (!state) continue;
        const hadOldEntry = oldRecByUid.has(newRec.uid);
        const { nextUser } = applyCreditRecordToUserState(
          state,
          newRec,
          weeklyMeta,
          currentWeekStartIso,
          nowIso,
          !hadOldEntry
        );
        userStateMap.set(newRec.uid, nextUser);
        persistedNewRecords.push(newRec);
        totalDistributedAmount += newRec.prizeCredited;
      }

      // 3. Write updated user + leaderboard + transaction + notification docs
      for (const uid of allUids) {
        const nextUser = userStateMap.get(uid);
        if (!nextUser) continue;

        const userRef = doc(db, 'users', uid);
        txn.update(userRef, {
          walletBalance: nextUser.walletBalance,
          totalEarnings: nextUser.totalEarnings,
          totalKills: nextUser.totalKills,
          totalWins: nextUser.totalWins,
          totalMatches: nextUser.totalMatches,
          weeklyEarnings: nextUser.weeklyEarnings,
          weeklyKills: nextUser.weeklyKills,
          weeklyWins: nextUser.weeklyWins,
          weeklyMatches: nextUser.weeklyMatches,
          weekStartIso: currentWeekStartIso,
          weekResetAt: nextUser.weekResetAt || '',
          updatedAt: nowIso,
        });

        const lbRef = doc(db, 'leaderboard', uid);
        txn.set(
          lbRef,
          {
            uid,
            displayName: nextUser.displayName || 'Player',
            inGameName: nextUser.inGameName || '',
            freeFireUid: nextUser.freeFireUid || '',
            teamName: nextUser.teamName || '',
            avatarUrl: nextUser.avatarUrl || '',
            totalEarnings: nextUser.totalEarnings,
            totalWins: nextUser.totalWins,
            totalKills: nextUser.totalKills,
            totalMatches: nextUser.totalMatches,
            weeklyEarnings: nextUser.weeklyEarnings,
            weeklyWins: nextUser.weeklyWins,
            weeklyKills: nextUser.weeklyKills,
            weeklyMatches: nextUser.weeklyMatches,
            weekStartIso: currentWeekStartIso,
            weekResetAt: nextUser.weekResetAt || '',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        const oldRec = oldRecByUid.get(uid);
        const newRec = newRecByUid.get(uid);
        const trxId =
          newRec?.trxId ||
          oldRec?.trxId ||
          'trx_pz_' + tournamentId + '_' + uid.substring(0, 6);
        const trxRef = doc(db, 'transactions', trxId);

        if (newRec && newRec.prizeCredited > 0) {
          const { description, descriptionBn } = buildPrizeDescription(tour, newRec);
          const trxData: WalletTransaction = {
            id: trxId,
            userId: uid,
            type: 'PRIZE',
            amount: newRec.prizeCredited,
            status: 'COMPLETED',
            referenceId: tournamentId,
            tournamentId,
            tournamentTitle: tour.title,
            tournamentTitleBn: tour.titleBn || '',
            matchCategory: String(getTournamentCategory(tour)),
            placement: newRec.placement,
            kills: newRec.kills,
            killPrize: newRec.killPrizeCredited,
            winPrize: newRec.winPrizeCredited,
            reversed: false,
            description,
            descriptionBn,
            balanceAfter: nextUser.walletBalance,
            createdAt: nowIso,
          };
          txn.set(trxRef, trxData);

          const notifId =
            newRec.notifId || 'notif_pz_' + tournamentId + '_' + uid.substring(0, 6);
          const notifRef = doc(db, 'notifications', notifId);
          txn.set(notifRef, {
            id: notifId,
            userId: uid,
            title: oldRec ? 'Match Result Updated!' : 'Auto Winning Credited!',
            titleBn: oldRec
              ? 'ম্যাচ ফলাফল আপডেট হয়েছে!'
              : 'অটো উইনিং ব্যালেন্স যোগ হয়েছে!',
            message: `Updated result for ${tour.title}: ৳${newRec.prizeCredited} (Rank #${newRec.placement}, ${newRec.kills} Kills).`,
            messageBn: `${tour.titleBn || tour.title} ম্যাচের ফলাফল আপডেট হয়েছে: #${newRec.placement} স্থান ও ${newRec.kills} কিল (৳${newRec.prizeCredited})।`,
            type: 'SUCCESS',
            read: false,
            createdAt: nowIso,
          });
        } else if (oldRec && oldRec.prizeCredited > 0) {
          // Previously had a prize, now 0 -> mark transaction reversed
          const revTrxData: WalletTransaction = {
            id: trxId,
            userId: uid,
            type: 'PRIZE',
            amount: oldRec.prizeCredited,
            status: 'REJECTED',
            referenceId: tournamentId,
            tournamentId,
            tournamentTitle: tour.title,
            tournamentTitleBn: tour.titleBn || '',
            matchCategory: String(getTournamentCategory(tour)),
            placement: oldRec.placement,
            kills: oldRec.kills,
            killPrize: oldRec.killPrizeCredited,
            winPrize: oldRec.winPrizeCredited,
            reversed: true,
            description: `[Reversed] ${tour.title} prize adjusted by Admin`,
            descriptionBn: `[বাতিল/সংশোধিত] ${tour.titleBn || tour.title} ম্যাচের প্রাইজ অ্যাডমিন পরিবর্তন করেছেন`,
            balanceAfter: nextUser.walletBalance,
            createdAt: nowIso,
          };
          txn.set(trxRef, revTrxData);
        }
      }

      const existingPayouts = oldResult?.winnerPayouts || {};
      const recordsWithPayouts = persistedNewRecords.map((rec) => {
        const prevPayout = existingPayouts[rec.uid];
        if (prevPayout?.status === 'PAID') {
          return {
            ...rec,
            payoutStatus: 'PAID' as const,
            payoutPaidAt: prevPayout.paidAt,
            payoutPaidBy: prevPayout.paidBy,
          };
        }
        return rec;
      });

      const updatedResult: MatchResult = {
        id: tournamentId,
        tournamentId,
        tournamentTitle: tour.title,
        matchCategory: String(getTournamentCategory(tour)),
        standings: newStandings,
        distributedRecords: recordsWithPayouts,
        ...(oldResult?.winnerPayouts ? { winnerPayouts: oldResult.winnerPayouts } : {}),
        totalDistributedAmount,
        isVerified: true,
        isPrizeDistributed: true,
        publishedAt: oldResult?.publishedAt || nowIso,
        ...(wasAlreadyDistributed ? { editedAt: nowIso } : {}),
        createdAt: oldResult?.createdAt || nowIso,
      };
      txn.set(resultDocRef, updatedResult);

      txn.update(tourDocRef, {
        status: 'COMPLETED',
        updatedAt: nowIso,
      });

      return {
        success: true,
        message: wasAlreadyDistributed
          ? `ফলাফল সফলভাবে আপডেট হয়েছে এবং নতুন হিসাব অনুযায়ী মোট ৳${totalDistributedAmount} সমন্বয় করা হয়েছে!`
          : `ফলাফল ডিক্লেয়ার হয়েছে এবং বিজয়ীদের Winning Balance-এ মোট ৳${totalDistributedAmount} অটো যোগ হয়েছে!`,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `matchResults/${tournamentId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'ফলাফল এডিট করতে সমস্যা হয়েছে।' };
  }
}

/**
 * Atomically undoes a declared match result: deducts distributed prize money,
 * kills, wins, and leaderboard stats, and marks prize transactions as REJECTED/reversed.
 */
export async function undoMatchResultAndRevertPrizes(
  tournamentId: string
): Promise<{ success: boolean; message: string }> {
  const resultDocRef = doc(db, 'matchResults', tournamentId);
  const tourDocRef = doc(db, 'tournaments', tournamentId);
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const weeklyMetaRef = doc(db, 'settings', 'weeklyLeaderboard');
      const [resultSnap, tourSnap, weeklyMetaSnap] = await Promise.all([
        txn.get(resultDocRef),
        txn.get(tourDocRef),
        txn.get(weeklyMetaRef),
      ]);
      if (!resultSnap.exists()) throw new Error('রিভার্স করার মতো কোনো ফলাফল পাওয়া যায়নি!');
      const result = resultSnap.data() as MatchResult;

      if (!result.isPrizeDistributed) {
        throw new Error('এই ম্যাচের উইনিং এখনো ডিস্ট্রিবিউট করা হয়নি বা ইতিমধ্যে আনডু করা হয়েছে!');
      }

      if (!tourSnap.exists()) throw new Error('টুর্নামেন্ট পাওয়া যায়নি!');
      const tour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };

      const weeklyMeta: WeeklyLeaderboardMeta = weeklyMetaSnap.exists()
        ? (weeklyMetaSnap.data() as WeeklyLeaderboardMeta)
        : {};
      const currentWeekStartIso = getCurrentWeekStartIso();

      const oldRecords = reconstructLegacyDistributedRecords(result, tour);
      const userSnaps = await Promise.all(
        oldRecords.map((rec) => txn.get(doc(db, 'users', rec.uid)))
      );
      const userDocsMap = new Map<string, UserProfile>();
      oldRecords.forEach((rec, idx) => {
        const uSnap = userSnaps[idx];
        if (uSnap?.exists()) {
          userDocsMap.set(rec.uid, uSnap.data() as UserProfile);
        }
      });

      let totalRevertedAmount = 0;

      for (const rec of oldRecords) {
        const userData = userDocsMap.get(rec.uid);
        if (!userData) continue;

        const { nextUser, balanceAfter } = applyUndoRecordToUserState(
          userData,
          rec,
          weeklyMeta,
          currentWeekStartIso,
          nowIso
        );

        const userRef = doc(db, 'users', rec.uid);
        txn.update(userRef, {
          walletBalance: nextUser.walletBalance,
          totalEarnings: nextUser.totalEarnings,
          totalKills: nextUser.totalKills,
          totalWins: nextUser.totalWins,
          weeklyEarnings: nextUser.weeklyEarnings,
          weeklyKills: nextUser.weeklyKills,
          weeklyWins: nextUser.weeklyWins,
          weeklyMatches: nextUser.weeklyMatches,
          weekStartIso: currentWeekStartIso,
          weekResetAt: nextUser.weekResetAt || '',
          updatedAt: nowIso,
        });

        const lbRef = doc(db, 'leaderboard', rec.uid);
        txn.set(
          lbRef,
          {
            uid: rec.uid,
            displayName: nextUser.displayName || 'Player',
            inGameName: nextUser.inGameName || '',
            freeFireUid: nextUser.freeFireUid || '',
            teamName: nextUser.teamName || '',
            avatarUrl: nextUser.avatarUrl || '',
            totalEarnings: nextUser.totalEarnings,
            totalWins: nextUser.totalWins,
            totalKills: nextUser.totalKills,
            totalMatches: nextUser.totalMatches,
            weeklyEarnings: nextUser.weeklyEarnings,
            weeklyWins: nextUser.weeklyWins,
            weeklyKills: nextUser.weeklyKills,
            weeklyMatches: nextUser.weeklyMatches,
            weekStartIso: currentWeekStartIso,
            weekResetAt: nextUser.weekResetAt || '',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        totalRevertedAmount += rec.prizeCredited;

        if (rec.prizeCredited > 0) {
          const trxId = rec.trxId || 'trx_pz_' + tournamentId + '_' + rec.uid.substring(0, 6);
          const trxRef = doc(db, 'transactions', trxId);
          const revTrxData: WalletTransaction = {
            id: trxId,
            userId: rec.uid,
            type: 'PRIZE',
            amount: rec.prizeCredited,
            status: 'REJECTED',
            referenceId: tournamentId,
            tournamentId,
            tournamentTitle: tour.title,
            tournamentTitleBn: tour.titleBn || '',
            matchCategory: String(getTournamentCategory(tour)),
            placement: rec.placement,
            kills: rec.kills,
            killPrize: rec.killPrizeCredited,
            winPrize: rec.winPrizeCredited,
            reversed: true,
            description: `[Undone by Admin] ${tour.title} (৳${rec.prizeCredited} reversed)`,
            descriptionBn: `[অ্যাডমিন আনডু] ${tour.titleBn || tour.title} (৳${rec.prizeCredited} ফেরত নেওয়া হয়েছে)`,
            balanceAfter,
            createdAt: nowIso,
          };
          txn.set(trxRef, revTrxData);

          const notifId = 'notif_undo_' + tournamentId + '_' + rec.uid.substring(0, 6);
          txn.set(doc(db, 'notifications', notifId), {
            id: notifId,
            userId: rec.uid,
            title: 'Match Result Reversed',
            titleBn: 'ম্যাচ ফলাফল রিভার্স করা হয়েছে',
            message: `Admin reversed the result for ${tour.title}. ৳${rec.prizeCredited} was deducted from your Winning Balance.`,
            messageBn: `অ্যাডমিন ${tour.titleBn || tour.title} ম্যাচের ফলাফল সংশোধন/আনডু করেছেন। ৳${rec.prizeCredited} Winning Balance থেকে কমানো হয়েছে।`,
            type: 'WARNING',
            read: false,
            createdAt: nowIso,
          });
        }
      }

      txn.update(resultDocRef, {
        isVerified: false,
        isPrizeDistributed: false,
        distributedRecords: [],
        totalDistributedAmount: 0,
        reversedAt: nowIso,
      });

      txn.update(tourDocRef, {
        status: 'ONGOING',
        updatedAt: nowIso,
      });

      return {
        success: true,
        message: `ফলাফল সফলভাবে Undo করা হয়েছে এবং ৳${totalRevertedAmount} Winning Balance থেকে কমানো হয়েছে!`,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `matchResults/${tournamentId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'ফলাফল Undo করতে সমস্যা হয়েছে।' };
  }
}

export function subscribeAllMatchResults(
  onUpdate: (resultsMap: Record<string, MatchResult>) => void
): () => void {
  let latestServerMap: Record<string, MatchResult> = {};
  const emitMerged = () => {
    onUpdate(mergeOptimisticMatchResults(latestServerMap));
  };

  const unsubOptimistic = subscribeOptimisticResultStore(emitMerged);
  const unsubSnap = onSnapshot(
    collection(db, 'matchResults'),
    (snap) => {
      const map: Record<string, MatchResult> = {};
      snap.forEach((d) => {
        const data = d.data() as MatchResult;
        const key = data.tournamentId || d.id;
        map[key] = { ...data, id: d.id };
      });
      latestServerMap = map;
      emitMerged();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'matchResults');
    }
  );

  return () => {
    unsubOptimistic();
    unsubSnap();
  };
}

export async function markMatchWinnerPaid(
  tournamentId: string,
  winnerUid: string,
  amount: number,
  adminName: string,
  matchTitle?: string
): Promise<{ success: boolean; message: string }> {
  const resultDocRef = doc(db, 'matchResults', tournamentId);
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const resultSnap = await txn.get(resultDocRef);
      if (!resultSnap.exists()) {
        throw new Error('ম্যাচের ফলাফল পাওয়া যায়নি!');
      }

      const resultData = resultSnap.data() as MatchResult;
      const existingPayouts = { ...(resultData.winnerPayouts || {}) };
      existingPayouts[winnerUid] = {
        status: 'PAID',
        amount,
        paidAt: nowIso,
        paidBy: adminName || 'Admin',
      };

      const nextRecords = (resultData.distributedRecords || []).map((rec) =>
        rec.uid === winnerUid
          ? {
              ...rec,
              payoutStatus: 'PAID' as const,
              payoutPaidAt: nowIso,
              payoutPaidBy: adminName || 'Admin',
            }
          : rec
      );

      txn.update(resultDocRef, {
        winnerPayouts: existingPayouts,
        distributedRecords: nextRecords,
      });

      const notifId = `notif_paid_${tournamentId}_${winnerUid.substring(0, 6)}_${Date.now().toString(36)}`;
      txn.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: winnerUid,
        title: 'Winner Payout Paid!',
        titleBn: 'ম্যাচ পেমেন্ট পাঠানো হয়েছে!',
        message: `Admin marked your ৳${amount} prize for ${matchTitle || resultData.tournamentTitle || 'match'} as Paid.`,
        messageBn: `${matchTitle || resultData.tournamentTitle || 'ম্যাচ'}-এর ৳${amount} পেমেন্ট এডমিন পাঠিয়ে দিয়েছেন (Paid)।`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      });

      return {
        success: true,
        message: `৳${amount} পেমেন্ট Paid হিসেবে সেভ হয়েছে!`,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `matchResults/${tournamentId}`);
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'পেমেন্ট স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।' };
  }
}

export async function fetchTopPlayers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('totalEarnings', 'desc'), limit(50));
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as LeaderboardEntry;
      list.push({
        uid: data.uid,
        email: '',
        displayName: data.displayName || 'Player',
        username: '',
        inGameName: data.inGameName || '',
        freeFireUid: data.freeFireUid || '',
        teamName: data.teamName || '',
        avatarUrl: data.avatarUrl || '',
        role: 'PLAYER',
        isAdmin: false,
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: Number(data.totalEarnings || 0),
        totalKills: Number(data.totalKills || 0),
        totalWins: Number(data.totalWins || 0),
        totalMatches: Number(data.totalMatches || 0),
        totalTournaments: Number(data.totalMatches || 0),
        weeklyEarnings: Number(data.weeklyEarnings || 0),
        weeklyKills: Number(data.weeklyKills || 0),
        weeklyWins: Number(data.weeklyWins || 0),
        weeklyMatches: Number(data.weeklyMatches || 0),
        weekStartIso: data.weekStartIso || '',
        weekResetAt: data.weekResetAt || '',
        isBanned: Boolean(data.isBanned),
        banReason: data.banReason || '',
        banExpiresAt: data.banExpiresAt ?? null,
        createdAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch {
    try {
      const snap = await getDocs(collection(db, 'leaderboard'));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as LeaderboardEntry;
        list.push({
          uid: data.uid,
          email: '',
          displayName: data.displayName || 'Player',
          username: '',
          inGameName: data.inGameName || '',
          freeFireUid: data.freeFireUid || '',
          teamName: data.teamName || '',
          avatarUrl: data.avatarUrl || '',
          role: 'PLAYER',
          isAdmin: false,
          walletBalance: 0,
          pendingBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalEarnings: Number(data.totalEarnings || 0),
          totalKills: Number(data.totalKills || 0),
          totalWins: Number(data.totalWins || 0),
          totalMatches: Number(data.totalMatches || 0),
          totalTournaments: Number(data.totalMatches || 0),
          weeklyEarnings: Number(data.weeklyEarnings || 0),
          weeklyKills: Number(data.weeklyKills || 0),
          weeklyWins: Number(data.weeklyWins || 0),
          weeklyMatches: Number(data.weeklyMatches || 0),
          weekStartIso: data.weekStartIso || '',
          weekResetAt: data.weekResetAt || '',
          isBanned: Boolean(data.isBanned),
          banReason: data.banReason || '',
          banExpiresAt: data.banExpiresAt ?? null,
          createdAt: data.updatedAt || new Date().toISOString(),
        });
      });
      return list.sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0) || (b.totalWins || 0) - (a.totalWins || 0));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'leaderboard');
    }
  }
}

function mapLeaderboardEntryToUserProfile(data: LeaderboardEntry): UserProfile {
  return {
    uid: data.uid,
    email: '',
    displayName: data.displayName || 'Player',
    username: '',
    inGameName: data.inGameName || '',
    freeFireUid: data.freeFireUid || '',
    teamName: data.teamName || '',
    avatarUrl: data.avatarUrl || '',
    role: 'PLAYER',
    isAdmin: false,
    walletBalance: 0,
    pendingBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalEarnings: Number(data.totalEarnings || 0),
    totalKills: Number(data.totalKills || 0),
    totalWins: Number(data.totalWins || 0),
    totalMatches: Number(data.totalMatches || 0),
    totalTournaments: Number(data.totalMatches || 0),
    weeklyEarnings: Number(data.weeklyEarnings || 0),
    weeklyKills: Number(data.weeklyKills || 0),
    weeklyWins: Number(data.weeklyWins || 0),
    weeklyMatches: Number(data.weeklyMatches || 0),
    weekStartIso: data.weekStartIso || '',
    weekResetAt: data.weekResetAt || '',
    isBanned: Boolean(data.isBanned),
    banReason: data.banReason || '',
    banExpiresAt: data.banExpiresAt ?? null,
    createdAt: data.updatedAt || new Date().toISOString(),
  };
}

export function subscribeAllTimeTopPlayers(
  limitCount: number,
  onUpdate: (players: UserProfile[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'leaderboard'),
    (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as LeaderboardEntry;
        const mapped = mapLeaderboardEntryToUserProfile({
          ...data,
          uid: data.uid || d.id,
        });
        if (
          (mapped.totalEarnings || 0) > 0 ||
          (mapped.totalWins || 0) > 0 ||
          (mapped.totalKills || 0) > 0
        ) {
          list.push(mapped);
        }
      });

      list.sort(
        (a, b) =>
          (b.totalEarnings || 0) - (a.totalEarnings || 0) ||
          (b.totalWins || 0) - (a.totalWins || 0) ||
          (b.totalKills || 0) - (a.totalKills || 0)
      );

      onUpdate(limitCount > 0 ? list.slice(0, limitCount) : list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'leaderboard');
    }
  );
}

const BD_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka (UTC+6)

function getCurrentMonthBoundsMsBD(nowMs: number = Date.now()): {
  startMs: number;
  endMs: number;
} {
  const bdDate = new Date(nowMs + BD_OFFSET_MS);
  const startMs =
    Date.UTC(bdDate.getUTCFullYear(), bdDate.getUTCMonth(), 1, 0, 0, 0, 0) -
    BD_OFFSET_MS;
  const endMs =
    Date.UTC(bdDate.getUTCFullYear(), bdDate.getUTCMonth() + 1, 1, 0, 0, 0, 0) -
    BD_OFFSET_MS;
  return { startMs, endMs };
}

export function subscribeMonthlyTopPlayers(
  limitCount: number,
  onUpdate: (players: UserProfile[]) => void
): () => void {
  let lbMap = new Map<string, LeaderboardEntry>();
  let resultsList: MatchResult[] = [];
  let hasResults = false;

  const emit = () => {
    if (!hasResults) return;
    const { startMs, endMs } = getCurrentMonthBoundsMsBD();
    const statsByUid = new Map<
      string,
      {
        uid: string;
        displayName: string;
        inGameName: string;
        freeFireUid: string;
        teamName: string;
        totalEarnings: number;
        totalWins: number;
        totalKills: number;
        totalMatches: number;
      }
    >();

    for (const result of resultsList) {
      if (!result.isVerified && !result.isPrizeDistributed) continue;
      const ts = new Date(result.publishedAt || result.createdAt || '').getTime();
      if (Number.isNaN(ts) || ts < startMs || ts >= endMs) continue;

      for (const standing of result.standings || []) {
        const uids = Array.from(new Set((standing.playerUids || []).filter(Boolean)));
        if (uids.length === 0) continue;

        const prizeAmount = Number(standing.prizeWon || 0);
        const kills = Number(standing.kills || 0);
        const isWinner = Number(standing.placement) === 1;
        const perPlayerPrize = Math.floor(prizeAmount / uids.length);
        const perPlayerKills = Math.round(kills / uids.length);

        uids.forEach((uid, idx) => {
          const lb = lbMap.get(uid);
          const standingPlayer = standing.players?.[idx];
          const prev = statsByUid.get(uid) || {
            uid,
            displayName: lb?.displayName || standingPlayer?.inGameName || 'Player',
            inGameName: lb?.inGameName || standingPlayer?.inGameName || '',
            freeFireUid: lb?.freeFireUid || standingPlayer?.freeFireUid || '',
            teamName: lb?.teamName || standing.teamName || '',
            totalEarnings: 0,
            totalWins: 0,
            totalKills: 0,
            totalMatches: 0,
          };

          prev.totalEarnings += perPlayerPrize;
          prev.totalWins += isWinner ? 1 : 0;
          prev.totalKills += perPlayerKills;
          prev.totalMatches += 1;
          statsByUid.set(uid, prev);
        });
      }
    }

    const list: UserProfile[] = [];
    statsByUid.forEach((stat) => {
      if (
        stat.totalEarnings <= 0 &&
        stat.totalWins <= 0 &&
        stat.totalKills <= 0
      ) {
        return;
      }
      const lb = lbMap.get(stat.uid);
      list.push({
        uid: stat.uid,
        email: '',
        displayName: lb?.displayName || stat.displayName || 'Player',
        username: '',
        inGameName: lb?.inGameName || stat.inGameName || '',
        freeFireUid: lb?.freeFireUid || stat.freeFireUid || '',
        teamName: lb?.teamName || stat.teamName || '',
        avatarUrl: lb?.avatarUrl || '',
        role: 'PLAYER',
        isAdmin: false,
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: stat.totalEarnings,
        totalKills: stat.totalKills,
        totalWins: stat.totalWins,
        totalMatches: stat.totalMatches,
        totalTournaments: stat.totalMatches,
        isBanned: Boolean(lb?.isBanned),
        banReason: lb?.banReason || '',
        banExpiresAt: lb?.banExpiresAt ?? null,
        createdAt: lb?.updatedAt || new Date().toISOString(),
      });
    });

    list.sort(
      (a, b) =>
        (b.totalEarnings || 0) - (a.totalEarnings || 0) ||
        (b.totalWins || 0) - (a.totalWins || 0) ||
        (b.totalKills || 0) - (a.totalKills || 0)
    );

    onUpdate(limitCount > 0 ? list.slice(0, limitCount) : list);
  };

  const unsubLb = onSnapshot(
    collection(db, 'leaderboard'),
    (snap) => {
      const nextMap = new Map<string, LeaderboardEntry>();
      snap.forEach((d) => {
        const data = d.data() as LeaderboardEntry;
        const uid = data.uid || d.id;
        nextMap.set(uid, { ...data, uid });
      });
      lbMap = nextMap;
      emit();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'leaderboard');
    }
  );

  const unsubResults = onSnapshot(
    collection(db, 'matchResults'),
    (snap) => {
      const nextList: MatchResult[] = [];
      snap.forEach((d) => {
        nextList.push(d.data() as MatchResult);
      });
      resultsList = nextList;
      hasResults = true;
      emit();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'matchResults');
    }
  );

  return () => {
    unsubLb();
    unsubResults();
  };
}

