import { MatchResult, UserProfile } from '../types';
import { getWalletBreakdown } from './walletService';

export interface OptimisticUserDelta {
  opId: string;
  uid: string;
  deltaEarnings: number;
  deltaKills: number;
  deltaWins: number;
  txTimestampIso: string;
}

const inFlightResultTourIds = new Set<string>();
const optimisticResultsMap = new Map<string, MatchResult>();
const optimisticUserDeltasMap = new Map<string, OptimisticUserDelta[]>();
const listeners = new Set<() => void>();

function notifyAll(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

export function subscribeOptimisticResultStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isResultDeclareInFlight(tournamentId: string): boolean {
  return inFlightResultTourIds.has(tournamentId);
}

export function acquireResultDeclareLock(tournamentId: string): (() => void) | null {
  if (!tournamentId || inFlightResultTourIds.has(tournamentId)) {
    return null;
  }
  inFlightResultTourIds.add(tournamentId);
  notifyAll();
  return () => {
    if (inFlightResultTourIds.delete(tournamentId)) {
      notifyAll();
    }
  };
}

export function setOptimisticMatchResult(result: MatchResult): void {
  if (!result?.tournamentId) return;
  optimisticResultsMap.set(result.tournamentId, result);
  notifyAll();
}

export function clearOptimisticMatchResult(tournamentId: string): void {
  if (optimisticResultsMap.delete(tournamentId)) {
    notifyAll();
  }
}

export function getOptimisticMatchResultsSnapshot(): Record<string, MatchResult> {
  const out: Record<string, MatchResult> = {};
  optimisticResultsMap.forEach((val, key) => {
    out[key] = val;
  });
  return out;
}

export function mergeOptimisticMatchResults(
  baseMap: Record<string, MatchResult>
): Record<string, MatchResult> {
  if (optimisticResultsMap.size === 0) return baseMap;
  const merged = { ...baseMap };
  optimisticResultsMap.forEach((opt, tourId) => {
    const existing = merged[tourId];
    const optTime = opt.editedAt || opt.publishedAt || opt.createdAt || '';
    const existingTime = existing?.editedAt || existing?.publishedAt || existing?.createdAt || '';
    if (!existing || optTime >= existingTime) {
      merged[tourId] = opt;
    }
  });
  return merged;
}

export function applyOptimisticUserDeltas(
  opId: string,
  deltas: Array<{ uid: string; deltaEarnings: number; deltaKills: number; deltaWins: number }>,
  txTimestampIso: string
): void {
  let changed = false;
  for (const d of deltas) {
    if (!d.uid) continue;
    if (d.deltaEarnings === 0 && d.deltaKills === 0 && d.deltaWins === 0) continue;
    const list = optimisticUserDeltasMap.get(d.uid) || [];
    list.push({
      opId,
      uid: d.uid,
      deltaEarnings: d.deltaEarnings,
      deltaKills: d.deltaKills,
      deltaWins: d.deltaWins,
      txTimestampIso,
    });
    optimisticUserDeltasMap.set(d.uid, list);
    changed = true;
  }
  if (changed) notifyAll();
}

export function clearOptimisticUserDeltasByOpId(opId: string): void {
  let changed = false;
  optimisticUserDeltasMap.forEach((list, uid) => {
    const next = list.filter((item) => item.opId !== opId);
    if (next.length !== list.length) {
      changed = true;
      if (next.length === 0) {
        optimisticUserDeltasMap.delete(uid);
      } else {
        optimisticUserDeltasMap.set(uid, next);
      }
    }
  });
  if (changed) notifyAll();
}

export function applyOptimisticDeltasToProfile(
  profile: UserProfile | null
): UserProfile | null {
  if (!profile?.uid) return profile;
  const list = optimisticUserDeltasMap.get(profile.uid);
  if (!list || list.length === 0) return profile;

  const profileUpdatedAt = profile.updatedAt || '';
  // Apply only deltas whose server timestamp hasn't landed in profile yet
  const pending = list.filter((d) => !profileUpdatedAt || profileUpdatedAt < d.txTimestampIso);
  if (pending.length === 0) return profile;

  let sumEarnings = 0;
  let sumKills = 0;
  let sumWins = 0;
  for (const d of pending) {
    sumEarnings += d.deltaEarnings;
    sumKills += d.deltaKills;
    sumWins += d.deltaWins;
  }

  if (sumEarnings === 0 && sumKills === 0 && sumWins === 0) {
    return profile;
  }

  const nextEarnings = Math.max(0, Number(profile.totalEarnings || 0) + sumEarnings);
  const hasExplicitSpentFields =
    profile.spentFromDeposited !== undefined || profile.spentFromWinning !== undefined;

  let nextBalance: number;
  if (hasExplicitSpentFields) {
    nextBalance = getWalletBreakdown({
      ...profile,
      totalEarnings: nextEarnings,
    }).availableBalance;
  } else {
    const baseAvail = getWalletBreakdown(profile).availableBalance;
    nextBalance = Math.max(0, baseAvail + sumEarnings);
  }

  return {
    ...profile,
    walletBalance: nextBalance,
    totalEarnings: nextEarnings,
    totalKills: Math.max(0, Number(profile.totalKills || 0) + sumKills),
    totalWins: Math.max(0, Number(profile.totalWins || 0) + sumWins),
  };
}
