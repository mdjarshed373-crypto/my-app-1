import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export const BAN_REASONS = ['Hack Use', 'Cheating', 'Fake Payment'] as const;
export type BanReason = (typeof BAN_REASONS)[number];

export const BAN_DURATIONS = ['1 Din', '7 Din', '30 Din', 'Permanent'] as const;
export type BanDuration = (typeof BAN_DURATIONS)[number];

/**
 * Checks whether a user profile is currently actively banned.
 * Automatically respects temporary ban expiration timestamps.
 */
export function isUserCurrentlyBanned(profile?: Partial<UserProfile> | null): boolean {
  if (!profile || !profile.isBanned) return false;
  if (profile.banExpiresAt) {
    const expiresMs = new Date(profile.banExpiresAt).getTime();
    if (!isNaN(expiresMs) && expiresMs <= Date.now()) {
      return false;
    }
  }
  return true;
}

/**
 * Standard banned user message matching exact required wording.
 */
export function getBanErrorMessage(profile?: Partial<UserProfile> | null): string {
  const reason = (profile?.banReason || 'Hack Use').trim();
  return `Your Account Has Been Banned - Reason: ${reason}`;
}

/**
 * Computes human-readable ban duration/expiry label for Admin Ban Management UI.
 */
export function formatBanStatusLabel(profile?: Partial<UserProfile> | null): string {
  if (!isUserCurrentlyBanned(profile)) return 'Active';
  const duration = profile?.banDuration || (profile?.banExpiresAt ? 'Temporary' : 'Permanent');
  if (!profile?.banExpiresAt) {
    return `${duration} (Permanent)`;
  }
  const expiresDate = new Date(profile.banExpiresAt);
  if (isNaN(expiresDate.getTime())) return duration;
  return `${duration} (Until ${expiresDate.toLocaleDateString()})`;
}

function computeBanExpiryIso(duration: BanDuration): string | null {
  const now = Date.now();
  switch (duration) {
    case '1 Din':
      return new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();
    case '7 Din':
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30 Din':
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'Permanent':
    default:
      return null;
  }
}

export async function banUserAccount(params: {
  targetUid: string;
  reason: BanReason | string;
  duration: BanDuration;
  adminName?: string;
}): Promise<{ success: boolean; message: string }> {
  const { targetUid, reason, duration, adminName } = params;
  if (!targetUid) {
    return { success: false, message: 'Invalid user ID.' };
  }

  const nowIso = new Date().toISOString();
  const banExpiresAt = computeBanExpiryIso(duration);
  const cleanReason = reason.trim() || 'Hack Use';

  try {
    await updateDoc(doc(db, 'users', targetUid), {
      isBanned: true,
      banReason: cleanReason,
      banDuration: duration,
      bannedAt: nowIso,
      banExpiresAt,
      bannedBy: adminName || 'Admin',
      updatedAt: nowIso,
    });

    // Non-blocking sync to public leaderboard entry so BANNED badge shows there as well
    setDoc(
      doc(db, 'leaderboard', targetUid),
      {
        isBanned: true,
        banReason: cleanReason,
        banExpiresAt,
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});

    return {
      success: true,
      message: `ইউজার সফলভাবে ব্যান করা হয়েছে (${cleanReason} • ${duration})।`,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'ইউজার ব্যান করতে সমস্যা হয়েছে।',
    };
  }
}

export async function unbanUserAccount(params: {
  targetUid: string;
}): Promise<{ success: boolean; message: string }> {
  const { targetUid } = params;
  if (!targetUid) {
    return { success: false, message: 'Invalid user ID.' };
  }

  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      isBanned: false,
      banReason: '',
      banDuration: '',
      bannedAt: '',
      banExpiresAt: null,
      bannedBy: '',
      updatedAt: nowIso,
    });

    setDoc(
      doc(db, 'leaderboard', targetUid),
      {
        isBanned: false,
        banReason: '',
        banExpiresAt: null,
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});

    return {
      success: true,
      message: 'ইউজারকে সফলভাবে আনব্যান (UNBAN) করা হয়েছে!',
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'আনব্যান করতে সমস্যা হয়েছে।',
    };
  }
}
