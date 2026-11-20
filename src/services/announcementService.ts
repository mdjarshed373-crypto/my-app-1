import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { PlatformAnnouncement } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

const ANNOUNCEMENTS_COLLECTION = 'announcements';

export interface CreateAnnouncementInput {
  content: string;
  targetType: 'ALL_USERS' | 'TOURNAMENT';
  tournamentId?: string;
  tournamentTitle?: string;
  createdBy?: string;
}

/**
 * Subscribe in real time to all active admin announcements ordered newest first.
 */
export function subscribeAnnouncements(
  onData: (announcements: PlatformAnnouncement[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    (snapshot) => {
      const list: PlatformAnnouncement[] = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, any>;
          return {
            id: data.id || d.id,
            title: data.title || 'Tournament Notice',
            titleBn: data.titleBn || data.title || 'জরুরি নোটিশ',
            content: data.content || '',
            contentBn: data.contentBn || data.content || '',
            priority: data.priority || 'IMPORTANT',
            targetType:
              data.targetType === 'TOURNAMENT' ? 'TOURNAMENT' : 'ALL_USERS',
            tournamentId: data.tournamentId || undefined,
            tournamentTitle: data.tournamentTitle || undefined,
            createdBy: data.createdBy || undefined,
            createdAt: data.createdAt || new Date().toISOString(),
          } as PlatformAnnouncement;
        })
        .filter((item) => {
          const text = item.content.trim();
          if (!text) return false;
          if (
            item.id === 'important_rules_notice' ||
            (text.includes('IMPORTANT RULES') &&
              text.includes('40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে'))
          ) {
            return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, ANNOUNCEMENTS_COLLECTION);
    }
  );
}

/**
 * Create and broadcast a new admin announcement.
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<PlatformAnnouncement> {
  const trimmed = input.content.trim();
  if (!trimmed) {
    throw new Error('Announcement message cannot be empty.');
  }

  const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isTournament =
    input.targetType === 'TOURNAMENT' && Boolean(input.tournamentId);

  const payload: PlatformAnnouncement = {
    id,
    title:
      isTournament && input.tournamentTitle
        ? input.tournamentTitle
        : 'All Users Notice',
    titleBn:
      isTournament && input.tournamentTitle
        ? input.tournamentTitle
        : 'সকল প্লেয়ারদের জন্য নোটিশ',
    content: trimmed,
    contentBn: trimmed,
    priority: 'IMPORTANT',
    targetType: isTournament ? 'TOURNAMENT' : 'ALL_USERS',
    ...(isTournament && input.tournamentId
      ? { tournamentId: input.tournamentId }
      : {}),
    ...(isTournament && input.tournamentTitle
      ? { tournamentTitle: input.tournamentTitle }
      : {}),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tx:announcement-created', { detail: payload })
      );
    }
    return payload;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${ANNOUNCEMENTS_COLLECTION}/${id}`
    );
  }
}

/**
 * Delete an existing announcement by ID so it is removed from Notice Boards.
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `${ANNOUNCEMENTS_COLLECTION}/${id}`
    );
  }
}

/**
 * Format announcement timestamp cleanly for Notice Board & notification popups.
 */
export function formatAnnouncementTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (isSameDay) {
    return `Today, ${timePart}`;
  }

  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${datePart}, ${timePart}`;
}

/**
 * Format full date and time for Notice List modal (e.g. "Nov 12, 2026 • 08:50 PM").
 */
export function formatAnnouncementDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${datePart} • ${timePart}`;
}

function getSeenStorageKey(userId?: string | null): string {
  return `tx_seen_announcements_${userId || 'guest'}`;
}

export function getSeenAnnouncementIds(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(getSeenStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function markAnnouncementsAsSeen(
  ids: string[],
  userId?: string | null
): void {
  if (!ids.length) return;
  try {
    const existing = getSeenAnnouncementIds(userId);
    let changed = false;
    ids.forEach((id) => {
      if (!existing.has(id)) {
        existing.add(id);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(
        getSeenStorageKey(userId),
        JSON.stringify(Array.from(existing))
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tx:announcements-seen'));
      }
    }
  } catch {
    // ignore storage errors
  }
}

