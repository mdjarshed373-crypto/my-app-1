import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import type { LeaderboardEntry } from './matchResultService';

const BD_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka (UTC+6, no DST)
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyLeaderboardMeta {
  weekStartIso?: string;
  lastResetAt?: string;
  lastResetBy?: string;
  updatedAt?: string;
}

export interface WeeklyLeaderboardSnapshot {
  players: UserProfile[];
  meta: WeeklyLeaderboardMeta;
  rank1Uid: string | null;
}

/**
 * Returns UTC timestamp (ms) of the most recent Monday 00:00:00 Bangladesh Time (UTC+6).
 */
export function getCurrentWeekStartMs(nowMs: number = Date.now()): number {
  const bdDate = new Date(nowMs + BD_OFFSET_MS);
  const day = bdDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const bdMondayMidnightUtcMs = Date.UTC(
    bdDate.getUTCFullYear(),
    bdDate.getUTCMonth(),
    bdDate.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0
  );
  return bdMondayMidnightUtcMs - BD_OFFSET_MS;
}

export function getCurrentWeekStartIso(nowMs: number = Date.now()): string {
  return new Date(getCurrentWeekStartMs(nowMs)).toISOString();
}

export function getNextMondayMidnightMs(nowMs: number = Date.now()): number {
  return getCurrentWeekStartMs(nowMs) + ONE_WEEK_MS;
}

export function formatTimeUntilWeeklyReset(nowMs: number = Date.now()): string {
  const diff = Math.max(0, getNextMondayMidnightMs(nowMs) - nowMs);
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function resolveEffectiveWeeklyStats(
  entry: Partial<LeaderboardEntry & UserProfile>,
  meta?: WeeklyLeaderboardMeta | null,
  nowMs: number = Date.now()
): {
  weeklyWins: number;
  weeklyKills: number;
  weeklyEarnings: number;
  weeklyMatches: number;
  activeResetAt: string;
  currentWeekStartIso: string;
} {
  const currentWeekStartMs = getCurrentWeekStartMs(nowMs);
  const currentWeekStartIso = new Date(currentWeekStartMs).toISOString();
  const activeResetAt =
    meta?.lastResetAt && new Date(meta.lastResetAt).getTime() >= currentWeekStartMs
      ? meta.lastResetAt
      : '';

  if (entry.weekStartIso === currentWeekStartIso) {
    if (activeResetAt) {
      const updatedAfterReset =
        entry.weekResetAt === activeResetAt ||
        (Boolean(entry.updatedAt) && String(entry.updatedAt) > activeResetAt);
      if (!updatedAfterReset) {
        return {
          weeklyWins: 0,
          weeklyKills: 0,
          weeklyEarnings: 0,
          weeklyMatches: 0,
          activeResetAt,
          currentWeekStartIso,
        };
      }
    }
    return {
      weeklyWins: Math.max(0, Number(entry.weeklyWins || 0)),
      weeklyKills: Math.max(0, Number(entry.weeklyKills || 0)),
      weeklyEarnings: Math.max(0, Number(entry.weeklyEarnings || 0)),
      weeklyMatches: Math.max(0, Number(entry.weeklyMatches || 0)),
      activeResetAt,
      currentWeekStartIso,
    };
  }

  // Legacy entries created/updated during the current week before weekly fields existed
  if (!entry.weekStartIso && entry.updatedAt) {
    const updatedMs = new Date(entry.updatedAt).getTime();
    if (
      !Number.isNaN(updatedMs) &&
      updatedMs >= currentWeekStartMs &&
      (!activeResetAt || entry.updatedAt > activeResetAt)
    ) {
      return {
        weeklyWins: Math.max(0, Number(entry.totalWins || 0)),
        weeklyKills: Math.max(0, Number(entry.totalKills || 0)),
        weeklyEarnings: Math.max(0, Number(entry.totalEarnings || 0)),
        weeklyMatches: Math.max(0, Number(entry.totalMatches || 0)),
        activeResetAt,
        currentWeekStartIso,
      };
    }
  }

  return {
    weeklyWins: 0,
    weeklyKills: 0,
    weeklyEarnings: 0,
    weeklyMatches: 0,
    activeResetAt,
    currentWeekStartIso,
  };
}

function mapEntryToWeeklyUserProfile(
  entry: LeaderboardEntry,
  meta?: WeeklyLeaderboardMeta | null,
  nowMs: number = Date.now()
): UserProfile {
  const weekly = resolveEffectiveWeeklyStats(entry, meta, nowMs);
  return {
    uid: entry.uid,
    email: '',
    displayName: entry.displayName || 'Player',
    username: '',
    inGameName: entry.inGameName || '',
    freeFireUid: entry.freeFireUid || '',
    teamName: entry.teamName || '',
    avatarUrl: entry.avatarUrl || '',
    role: 'PLAYER',
    isAdmin: false,
    walletBalance: 0,
    pendingBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalEarnings: weekly.weeklyEarnings,
    totalKills: weekly.weeklyKills,
    totalWins: weekly.weeklyWins,
    totalMatches: weekly.weeklyMatches,
    totalTournaments: weekly.weeklyMatches,
    weeklyEarnings: weekly.weeklyEarnings,
    weeklyWins: weekly.weeklyWins,
    weeklyKills: weekly.weeklyKills,
    weeklyMatches: weekly.weeklyMatches,
    weekStartIso: weekly.currentWeekStartIso,
    weekResetAt: weekly.activeResetAt,
    isBanned: Boolean(entry.isBanned),
    banReason: entry.banReason || '',
    banExpiresAt: entry.banExpiresAt ?? null,
    createdAt: entry.updatedAt || new Date().toISOString(),
  };
}

function buildWeeklySnapshot(
  entries: LeaderboardEntry[],
  meta: WeeklyLeaderboardMeta,
  limitCount: number = 10
): WeeklyLeaderboardSnapshot {
  const nowMs = Date.now();
  const mapped = entries
    .map((entry) => mapEntryToWeeklyUserProfile(entry, meta, nowMs))
    .filter(
      (p) =>
        (p.weeklyEarnings || 0) > 0 ||
        (p.weeklyWins || 0) > 0 ||
        (p.weeklyKills || 0) > 0
    )
    .sort(
      (a, b) =>
        (b.weeklyEarnings || 0) - (a.weeklyEarnings || 0) ||
        (b.weeklyWins || 0) - (a.weeklyWins || 0) ||
        (b.weeklyKills || 0) - (a.weeklyKills || 0)
    );

  const rank1Uid = mapped.length > 0 ? mapped[0].uid : null;
  const sliced = limitCount > 0 ? mapped.slice(0, limitCount) : mapped;

  return {
    players: sliced,
    meta,
    rank1Uid,
  };
}

export async function fetchWeeklyLeaderboardMeta(): Promise<WeeklyLeaderboardMeta> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'weeklyLeaderboard'));
    if (snap.exists()) {
      return snap.data() as WeeklyLeaderboardMeta;
    }
    return {};
  } catch {
    return {};
  }
}

export async function fetchWeeklyTopPlayers(
  limitCount: number = 10
): Promise<WeeklyLeaderboardSnapshot> {
  try {
    const [meta, lbSnap] = await Promise.all([
      fetchWeeklyLeaderboardMeta(),
      getDocs(collection(db, 'leaderboard')),
    ]);
    const entries: LeaderboardEntry[] = [];
    lbSnap.forEach((d) => {
      const data = d.data() as LeaderboardEntry;
      entries.push({ ...data, uid: data.uid || d.id });
    });
    return buildWeeklySnapshot(entries, meta, limitCount);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'leaderboard');
  }
}

export function subscribeWeeklyTopPlayers(
  limitCount: number,
  onUpdate: (snapshot: WeeklyLeaderboardSnapshot) => void
): () => void {
  let currentEntries: LeaderboardEntry[] = [];
  let currentMeta: WeeklyLeaderboardMeta = {};
  let hasEntries = false;

  const emit = () => {
    if (!hasEntries) return;
    onUpdate(buildWeeklySnapshot(currentEntries, currentMeta, limitCount));
  };

  const unsubMeta = onSnapshot(
    doc(db, 'settings', 'weeklyLeaderboard'),
    (snap) => {
      currentMeta = snap.exists() ? (snap.data() as WeeklyLeaderboardMeta) : {};
      emit();
    },
    () => {
      // Non-fatal if weeklyLeaderboard settings doc hasn't been created yet
    }
  );

  const unsubLeaderboard = onSnapshot(
    collection(db, 'leaderboard'),
    (snap) => {
      const list: LeaderboardEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as LeaderboardEntry;
        list.push({ ...data, uid: data.uid || d.id });
      });
      currentEntries = list;
      hasEntries = true;
      emit();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'leaderboard');
    }
  );

  // Re-evaluate every 60 seconds so Monday 12:00 AM BD auto-reset updates live
  const intervalId = setInterval(() => {
    emit();
  }, 60000);

  return () => {
    unsubMeta();
    unsubLeaderboard();
    clearInterval(intervalId);
  };
}

export async function manualResetWeeklyLeaderboard(
  adminName: string = 'Admin'
): Promise<{ success: boolean; message: string }> {
  const nowIso = new Date().toISOString();
  const currentWeekStartIso = getCurrentWeekStartIso();

  try {
    await setDoc(
      doc(db, 'settings', 'weeklyLeaderboard'),
      {
        weekStartIso: currentWeekStartIso,
        lastResetAt: nowIso,
        lastResetBy: adminName,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    const [lbSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'leaderboard')),
      getDocs(collection(db, 'users')),
    ]);

    const refsToReset: Array<{ col: 'leaderboard' | 'users'; id: string }> = [];
    lbSnap.forEach((d) => refsToReset.push({ col: 'leaderboard', id: d.id }));
    usersSnap.forEach((d) => refsToReset.push({ col: 'users', id: d.id }));

    const resetPayload = {
      weeklyWins: 0,
      weeklyKills: 0,
      weeklyEarnings: 0,
      weeklyMatches: 0,
      weekStartIso: currentWeekStartIso,
      weekResetAt: nowIso,
    };

    const CHUNK_SIZE = 400;
    for (let i = 0; i < refsToReset.length; i += CHUNK_SIZE) {
      const chunk = refsToReset.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        batch.set(doc(db, item.col, item.id), resetPayload, { merge: true });
      });
      await batch.commit();
    }

    return {
      success: true,
      message: 'Weekly Leaderboard সফলভাবে Reset করা হয়েছে! (সকল প্লেয়ারের সাপ্তাহিক স্কোর 0 হয়েছে)',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'leaderboard');
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Weekly Leaderboard reset করতে সমস্যা হয়েছে।' };
  }
}
