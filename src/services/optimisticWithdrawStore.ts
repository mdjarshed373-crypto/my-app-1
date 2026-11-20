import { UserProfile, WalletTransaction, WithdrawalRequest } from '../types';
import { getWalletBreakdown } from './walletService';

export type OptimisticWithdrawStatus = 'PENDING_SYNC' | 'SYNCED';

export interface OptimisticWithdrawEntry {
  requestId: string;
  userId: string;
  amount: number;
  txTimestampIso: string;
  withdrawal: WithdrawalRequest;
  transaction: WalletTransaction;
  status: OptimisticWithdrawStatus;
  createdAt: number;
}

const STORAGE_KEY = 'tx_optimistic_withdraws_v1';
const OPTIMISTIC_TTL_MS = 5 * 60 * 1000;

const entriesMap = new Map<string, OptimisticWithdrawEntry>();
const inFlightUserIds = new Set<string>();
const listeners = new Set<() => void>();

function hydrateFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as OptimisticWithdrawEntry[];
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    parsed.forEach((item) => {
      if (
        item &&
        item.requestId &&
        item.userId &&
        now - Number(item.createdAt || 0) < OPTIMISTIC_TTL_MS
      ) {
        entriesMap.set(item.requestId, item);
      }
    });
  } catch {
    // ignore storage read errors
  }
}

function persistToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const list = Array.from(entriesMap.values()).filter(
      (item) => now - item.createdAt < OPTIMISTIC_TTL_MS
    );
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage write errors
  }
}

hydrateFromStorage();

function notifyAll(): void {
  persistToStorage();
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeOptimisticWithdrawStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isWithdrawInFlight(userId?: string): boolean {
  if (!userId) return false;
  return inFlightUserIds.has(userId);
}

export function acquireWithdrawLock(userId: string): (() => void) | null {
  if (!userId || inFlightUserIds.has(userId)) {
    return null;
  }
  inFlightUserIds.add(userId);
  notifyAll();
  return () => {
    if (inFlightUserIds.delete(userId)) {
      notifyAll();
    }
  };
}

export function startOptimisticWithdraw(params: {
  requestId: string;
  userId: string;
  amount: number;
  txTimestampIso: string;
  withdrawal: WithdrawalRequest;
  transaction: WalletTransaction;
}): void {
  entriesMap.set(params.requestId, {
    requestId: params.requestId,
    userId: params.userId,
    amount: Math.max(0, Number(params.amount || 0)),
    txTimestampIso: params.txTimestampIso,
    withdrawal: params.withdrawal,
    transaction: params.transaction,
    status: 'PENDING_SYNC',
    createdAt: Date.now(),
  });
  notifyAll();
}

export function markOptimisticWithdrawSynced(requestId: string): void {
  const existing = entriesMap.get(requestId);
  if (!existing) return;
  entriesMap.set(requestId, {
    ...existing,
    status: 'SYNCED',
  });
  notifyAll();
}

export function rollbackOptimisticWithdraw(requestId: string): void {
  if (entriesMap.delete(requestId)) {
    notifyAll();
  }
}

export function getOptimisticWithdrawsForUser(userId?: string): OptimisticWithdrawEntry[] {
  if (!userId) return [];
  const now = Date.now();
  const list: OptimisticWithdrawEntry[] = [];
  let dirty = false;
  entriesMap.forEach((entry, key) => {
    if (now - entry.createdAt >= OPTIMISTIC_TTL_MS) {
      entriesMap.delete(key);
      dirty = true;
      return;
    }
    if (entry.userId === userId) {
      list.push(entry);
    }
  });
  if (dirty) persistToStorage();
  return list.sort((a, b) => (b.txTimestampIso > a.txTimestampIso ? 1 : -1));
}

export function subscribeOptimisticWithdraws(
  userId: string | undefined,
  callback: (entries: OptimisticWithdrawEntry[]) => void
): () => void {
  const emit = () => {
    callback(getOptimisticWithdrawsForUser(userId));
  };
  emit();
  return subscribeOptimisticWithdrawStore(emit);
}

export interface OptimisticAdminWithdrawResolution {
  requestId: string;
  userId: string;
  status: 'PAID' | 'REJECTED';
  processedAt: string;
  adminNote: string;
  refundAmount: number;
  refundToWinning: number;
  refundToDeposited: number;
  createdAt: number;
}

const adminResolutionsMap = new Map<string, OptimisticAdminWithdrawResolution>();
const inFlightAdminWithdrawIds = new Set<string>();

export function isAdminWithdrawActionInFlight(requestId?: string): boolean {
  if (!requestId) return false;
  return inFlightAdminWithdrawIds.has(requestId);
}

export function acquireAdminWithdrawActionLock(requestId: string): (() => void) | null {
  if (!requestId || inFlightAdminWithdrawIds.has(requestId)) {
    return null;
  }
  inFlightAdminWithdrawIds.add(requestId);
  notifyAll();
  return () => {
    if (inFlightAdminWithdrawIds.delete(requestId)) {
      notifyAll();
    }
  };
}

export function setOptimisticAdminWithdrawResolution(
  resolution: Omit<OptimisticAdminWithdrawResolution, 'createdAt'>
): void {
  adminResolutionsMap.set(resolution.requestId, {
    ...resolution,
    createdAt: Date.now(),
  });
  notifyAll();
}

export function clearOptimisticAdminWithdrawResolution(requestId: string): void {
  if (adminResolutionsMap.delete(requestId)) {
    notifyAll();
  }
}

export function mergeAdminOptimisticWithdrawals(
  list: WithdrawalRequest[]
): WithdrawalRequest[] {
  if (adminResolutionsMap.size === 0) return list;
  const now = Date.now();
  let changed = false;
  const merged = list.map((item) => {
    const res = adminResolutionsMap.get(item.id);
    if (!res) return item;
    if (now - res.createdAt >= OPTIMISTIC_TTL_MS) {
      adminResolutionsMap.delete(item.id);
      return item;
    }
    if (item.status === 'PENDING') {
      changed = true;
      return {
        ...item,
        status: res.status,
        processedAt: res.processedAt,
        adminNote: res.adminNote,
      };
    }
    return item;
  });
  return changed ? merged : list;
}

export function applyOptimisticWithdrawToProfile(
  profile: UserProfile | null
): UserProfile | null {
  if (!profile?.uid) return profile;

  let currentProfile = profile;
  const profileUpdatedAt = currentProfile.updatedAt || '';

  // 1. Apply any pending optimistic user withdrawals not yet reflected on server profile
  const entries = getOptimisticWithdrawsForUser(currentProfile.uid);
  const pending = entries.filter(
    (e) => !profileUpdatedAt || profileUpdatedAt < e.txTimestampIso
  );
  if (pending.length > 0) {
    const totalPendingWithdraw = pending.reduce(
      (sum, item) => sum + Math.max(0, Number(item.amount || 0)),
      0
    );
    if (totalPendingWithdraw > 0) {
      const breakdown = getWalletBreakdown(currentProfile);
      const actualDeduct = Math.min(breakdown.availableBalance, totalPendingWithdraw);
      if (actualDeduct > 0) {
        const deductFromWin = Math.min(breakdown.winningAmount, actualDeduct);
        const deductFromDep = Math.max(0, actualDeduct - deductFromWin);
        const baselineSpentWin = Math.max(
          0,
          breakdown.totalWinningLifetime - breakdown.winningAmount
        );
        const baselineSpentDep = Math.max(
          0,
          breakdown.totalDepositedLifetime - breakdown.depositedAmount
        );
        currentProfile = {
          ...currentProfile,
          walletBalance: Math.max(0, breakdown.availableBalance - actualDeduct),
          totalDeposited: breakdown.totalDepositedLifetime,
          totalEarnings: breakdown.totalWinningLifetime,
          spentFromDeposited: baselineSpentDep + deductFromDep,
          spentFromWinning: baselineSpentWin + deductFromWin,
        };
      }
    }
  }

  // 2. Apply any pending optimistic Admin Reject refunds not yet reflected on server profile
  const now = Date.now();
  const pendingRefunds: OptimisticAdminWithdrawResolution[] = [];
  adminResolutionsMap.forEach((res, key) => {
    if (now - res.createdAt >= OPTIMISTIC_TTL_MS) {
      adminResolutionsMap.delete(key);
      return;
    }
    if (
      res.userId === currentProfile.uid &&
      res.status === 'REJECTED' &&
      (!profileUpdatedAt || profileUpdatedAt < res.processedAt)
    ) {
      pendingRefunds.push(res);
    }
  });

  if (pendingRefunds.length > 0) {
    let refundTotal = 0;
    let refundWin = 0;
    let refundDep = 0;
    for (const r of pendingRefunds) {
      refundTotal += Math.max(0, Number(r.refundAmount || 0));
      refundWin += Math.max(0, Number(r.refundToWinning || 0));
      refundDep += Math.max(0, Number(r.refundToDeposited || 0));
    }
    if (refundTotal > 0) {
      const breakdown = getWalletBreakdown(currentProfile);
      const baselineSpentWin = Math.max(
        0,
        breakdown.totalWinningLifetime - breakdown.winningAmount
      );
      const baselineSpentDep = Math.max(
        0,
        breakdown.totalDepositedLifetime - breakdown.depositedAmount
      );
      currentProfile = {
        ...currentProfile,
        walletBalance: breakdown.availableBalance + refundTotal,
        totalDeposited: breakdown.totalDepositedLifetime,
        totalEarnings: breakdown.totalWinningLifetime,
        spentFromWinning: Math.max(0, baselineSpentWin - refundWin),
        spentFromDeposited: Math.max(0, baselineSpentDep - refundDep),
      };
    }
  }

  return currentProfile;
}
