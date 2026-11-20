import { Tournament, TournamentRegistration } from '../types';

export type OptimisticJoinStatus = 'PENDING' | 'CONFIRMED';

export interface OptimisticJoinEntry {
  key: string; // `${userId}_${tournamentId}`
  userId: string;
  tournamentId: string;
  tournament: Tournament;
  registration: TournamentRegistration;
  expectedRegisteredCount: number;
  feeDeducted: number;
  status: OptimisticJoinStatus;
  createdAt: number;
}

const OPTIMISTIC_EVENT = 'tx:optimistic-join-changed';
const OPTIMISTIC_ERROR_EVENT = 'tx:optimistic-join-error';
const STORAGE_KEY = 'tx_optimistic_joins_v1';
const OPTIMISTIC_TTL_MS = 10 * 60 * 1000; // 10 minutes max local cache

const entriesMap = new Map<string, OptimisticJoinEntry>();
const inFlightKeys = new Set<string>();

function makeKey(userId: string, tournamentId: string): string {
  return `${userId}_${tournamentId}`;
}

function hydrateFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as OptimisticJoinEntry[];
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    parsed.forEach((item) => {
      if (
        item &&
        item.key &&
        item.userId &&
        item.tournamentId &&
        now - Number(item.createdAt || 0) < OPTIMISTIC_TTL_MS
      ) {
        entriesMap.set(item.key, item);
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

function emitChange(): void {
  persistToStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMISTIC_EVENT));
  }
}

export function emitOptimisticJoinError(message: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ message: string }>(OPTIMISTIC_ERROR_EVENT, {
        detail: { message },
      })
    );
  }
}

export function subscribeOptimisticJoinErrors(
  callback: (message: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{ message: string }>;
    if (ce.detail?.message) {
      callback(ce.detail.message);
    }
  };
  window.addEventListener(OPTIMISTIC_ERROR_EVENT, handler);
  return () => window.removeEventListener(OPTIMISTIC_ERROR_EVENT, handler);
}

export function isJoinLockedOrJoined(userId?: string, tournamentId?: string): boolean {
  if (!userId || !tournamentId) return false;
  const key = makeKey(userId, tournamentId);
  return inFlightKeys.has(key) || entriesMap.has(key);
}

export function getOptimisticJoin(
  userId?: string,
  tournamentId?: string
): OptimisticJoinEntry | null {
  if (!userId || !tournamentId) return null;
  const entry = entriesMap.get(makeKey(userId, tournamentId));
  if (!entry) return null;
  if (Date.now() - entry.createdAt >= OPTIMISTIC_TTL_MS) {
    entriesMap.delete(entry.key);
    persistToStorage();
    return null;
  }
  return entry;
}

export function getOptimisticJoinsForUser(userId?: string): OptimisticJoinEntry[] {
  if (!userId) return [];
  const now = Date.now();
  const list: OptimisticJoinEntry[] = [];
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
  return list;
}

export function getPendingBalanceDeduction(userId?: string): number {
  if (!userId) return 0;
  let total = 0;
  entriesMap.forEach((entry) => {
    if (entry.userId === userId && entry.status === 'PENDING') {
      total += Math.max(0, Number(entry.feeDeducted || 0));
    }
  });
  return total;
}

export function startOptimisticJoin(params: {
  userId: string;
  tournament: Tournament;
  registration: TournamentRegistration;
  feeDeducted: number;
}): boolean {
  const { userId, tournament, registration, feeDeducted } = params;
  const key = makeKey(userId, tournament.id);
  if (inFlightKeys.has(key) || entriesMap.has(key)) {
    return false;
  }

  inFlightKeys.add(key);
  const expectedRegisteredCount = Math.min(
    Math.max(1, Number(tournament.maxSlots) || 1),
    Math.max(0, Number(tournament.registeredCount) || 0) + 1
  );

  entriesMap.set(key, {
    key,
    userId,
    tournamentId: tournament.id,
    tournament: {
      ...tournament,
      registeredCount: expectedRegisteredCount,
    },
    registration,
    expectedRegisteredCount,
    feeDeducted: Math.max(0, Number(feeDeducted || 0)),
    status: 'PENDING',
    createdAt: Date.now(),
  });

  emitChange();
  return true;
}

export function confirmOptimisticJoin(
  userId: string,
  tournamentId: string,
  serverSlotNumber?: number
): void {
  const key = makeKey(userId, tournamentId);
  inFlightKeys.delete(key);
  const existing = entriesMap.get(key);
  if (!existing) {
    emitChange();
    return;
  }

  entriesMap.set(key, {
    ...existing,
    status: 'CONFIRMED',
    registration:
      typeof serverSlotNumber === 'number' && serverSlotNumber > 0
        ? { ...existing.registration, slotNumber: serverSlotNumber }
        : existing.registration,
  });
  emitChange();
}

export function rollbackOptimisticJoin(userId: string, tournamentId: string): void {
  const key = makeKey(userId, tournamentId);
  inFlightKeys.delete(key);
  entriesMap.delete(key);
  emitChange();
}

export function subscribeOptimisticJoins(
  userId: string | undefined,
  callback: (entries: OptimisticJoinEntry[]) => void
): () => void {
  const notify = () => {
    callback(getOptimisticJoinsForUser(userId));
  };
  notify();

  if (typeof window === 'undefined') return () => {};
  window.addEventListener(OPTIMISTIC_EVENT, notify);
  return () => {
    window.removeEventListener(OPTIMISTIC_EVENT, notify);
  };
}
