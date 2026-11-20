import { RoomCredential, Tournament } from '../types';

export type OptimisticTournamentStatus = 'PENDING' | 'CONFIRMED';

export interface OptimisticTournamentEntry {
  id: string;
  tournament: Tournament;
  room: RoomCredential;
  status: OptimisticTournamentStatus;
  createdAt: number;
}

const OPTIMISTIC_TOUR_EVENT = 'tx:optimistic-tournament-changed';
const OPTIMISTIC_TOUR_ERROR_EVENT = 'tx:optimistic-tournament-error';
const OPTIMISTIC_TOUR_SUCCESS_EVENT = 'tx:optimistic-tournament-success';
const STORAGE_KEY = 'tx_optimistic_tournaments_v1';
const DELETED_STORAGE_KEY = 'tx_optimistic_deleted_tournaments_v1';
const OPTIMISTIC_TTL_MS = 10 * 60 * 1000; // 10 minutes local cache
const DELETED_TTL_MS = 5 * 60 * 1000; // 5 minutes suppression for pending/stale deletes

const entriesMap = new Map<string, OptimisticTournamentEntry>();
const deletedAtMap = new Map<string, number>();
const inFlightDeleteIds = new Set<string>();

function hydrateFromStorage(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    const rawDeleted = window.sessionStorage.getItem(DELETED_STORAGE_KEY);
    if (rawDeleted) {
      const parsedDeleted = JSON.parse(rawDeleted) as Array<{ id: string; deletedAt: number }>;
      if (Array.isArray(parsedDeleted)) {
        parsedDeleted.forEach((item) => {
          if (item && item.id && now - Number(item.deletedAt || 0) < DELETED_TTL_MS) {
            deletedAtMap.set(item.id, Number(item.deletedAt));
          }
        });
      }
    }
  } catch {
    // ignore storage read errors
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as OptimisticTournamentEntry[];
    if (!Array.isArray(parsed)) return;
    parsed.forEach((item) => {
      if (
        item &&
        item.id &&
        item.tournament &&
        !deletedAtMap.has(item.id) &&
        now - Number(item.createdAt || 0) < OPTIMISTIC_TTL_MS
      ) {
        entriesMap.set(item.id, item);
      }
    });
  } catch {
    // ignore storage read errors
  }
}

function pruneDeletedIds(): void {
  const now = Date.now();
  deletedAtMap.forEach((ts, id) => {
    if (now - ts >= DELETED_TTL_MS) {
      deletedAtMap.delete(id);
    }
  });
}

function persistToStorage(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  pruneDeletedIds();
  try {
    const list = Array.from(entriesMap.values()).filter(
      (item) => now - item.createdAt < OPTIMISTIC_TTL_MS && !deletedAtMap.has(item.id)
    );
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage write errors
  }
  try {
    const deletedList = Array.from(deletedAtMap.entries()).map(([id, deletedAt]) => ({
      id,
      deletedAt,
    }));
    window.sessionStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(deletedList));
  } catch {
    // ignore storage write errors
  }
}

hydrateFromStorage();

function emitChange(): void {
  persistToStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPTIMISTIC_TOUR_EVENT));
  }
}

export function emitOptimisticTournamentError(message: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ message: string }>(OPTIMISTIC_TOUR_ERROR_EVENT, {
        detail: { message },
      })
    );
  }
}

export function subscribeOptimisticTournamentErrors(
  callback: (message: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{ message: string }>;
    if (ce.detail?.message) {
      callback(ce.detail.message);
    }
  };
  window.addEventListener(OPTIMISTIC_TOUR_ERROR_EVENT, handler);
  return () => window.removeEventListener(OPTIMISTIC_TOUR_ERROR_EVENT, handler);
}

export function emitOptimisticTournamentSuccess(message: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<{ message: string }>(OPTIMISTIC_TOUR_SUCCESS_EVENT, {
        detail: { message },
      })
    );
  }
}

export function subscribeOptimisticTournamentSuccess(
  callback: (message: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<{ message: string }>;
    if (ce.detail?.message) {
      callback(ce.detail.message);
    }
  };
  window.addEventListener(OPTIMISTIC_TOUR_SUCCESS_EVENT, handler);
  return () => window.removeEventListener(OPTIMISTIC_TOUR_SUCCESS_EVENT, handler);
}

export function isTournamentDeleteLocked(id: string): boolean {
  return inFlightDeleteIds.has(id);
}

export function lockTournamentDelete(id: string): void {
  inFlightDeleteIds.add(id);
}

export function unlockTournamentDelete(id: string): void {
  inFlightDeleteIds.delete(id);
}

export function isTournamentDeleted(id: string): boolean {
  pruneDeletedIds();
  return deletedAtMap.has(id);
}

export function getOptimisticTournaments(): OptimisticTournamentEntry[] {
  const now = Date.now();
  pruneDeletedIds();
  const list: OptimisticTournamentEntry[] = [];
  let dirty = false;
  entriesMap.forEach((entry, id) => {
    if (deletedAtMap.has(id) || now - entry.createdAt >= OPTIMISTIC_TTL_MS) {
      entriesMap.delete(id);
      dirty = true;
      return;
    }
    list.push(entry);
  });
  if (dirty) persistToStorage();
  return list;
}

export function startOptimisticTournament(
  tournament: Tournament,
  room: RoomCredential
): boolean {
  if (!tournament.id || entriesMap.has(tournament.id)) {
    return false;
  }
  deletedAtMap.delete(tournament.id);
  entriesMap.set(tournament.id, {
    id: tournament.id,
    tournament,
    room,
    status: 'PENDING',
    createdAt: Date.now(),
  });
  emitChange();
  return true;
}

export function confirmOptimisticTournament(id: string): void {
  const existing = entriesMap.get(id);
  if (!existing) {
    emitChange();
    return;
  }
  entriesMap.set(id, {
    ...existing,
    status: 'CONFIRMED',
  });
  emitChange();
}

export function rollbackOptimisticTournament(id: string): void {
  entriesMap.delete(id);
  emitChange();
}

export function removeOptimisticTournament(id: string): void {
  deletedAtMap.set(id, Date.now());
  entriesMap.delete(id);
  emitChange();
}

export function rollbackDeleteOptimisticTournament(id: string): void {
  deletedAtMap.delete(id);
  emitChange();
}

export function mergeOptimisticTournaments(serverList: Tournament[]): Tournament[] {
  pruneDeletedIds();
  const activeEntries = getOptimisticTournaments();
  const byId = new Map<string, Tournament>();

  serverList.forEach((t) => {
    if (t && t.id && !deletedAtMap.has(t.id)) {
      byId.set(t.id, t);
    }
  });

  activeEntries.forEach((entry) => {
    if (!byId.has(entry.id) && !deletedAtMap.has(entry.id)) {
      byId.set(entry.id, entry.tournament);
    }
  });

  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '') > (a.createdAt || '') ? 1 : -1
  );
}

export function mergeOptimisticRoomsMap(
  serverRooms: Record<string, RoomCredential>
): Record<string, RoomCredential> {
  const activeEntries = getOptimisticTournaments();
  if (activeEntries.length === 0) return serverRooms;
  const merged = { ...serverRooms };
  activeEntries.forEach((entry) => {
    if (!merged[entry.id] && !deletedAtMap.has(entry.id)) {
      merged[entry.id] = entry.room;
    }
  });
  return merged;
}

export function subscribeOptimisticTournaments(
  callback: (entries: OptimisticTournamentEntry[]) => void
): () => void {
  const notify = () => {
    callback(getOptimisticTournaments());
  };
  notify();

  if (typeof window === 'undefined') return () => {};
  window.addEventListener(OPTIMISTIC_TOUR_EVENT, notify);
  return () => {
    window.removeEventListener(OPTIMISTIC_TOUR_EVENT, notify);
  };
}
