import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import type { LeaderboardEntry } from './matchResultService';

export const USER_SESSION_KEY = 'tx_saved_user_session';
export const USER_SESSION_REMEMBER_FLAG = 'tx_user_remember_me';
const FAST_AUTH_CACHE_KEY = 'tx_fast_auth_cache_v1';
const MAX_FAST_AUTH_ENTRIES = 20;

interface FastAuthEntry {
  uid: string;
  email: string;
  username: string;
  phoneNumber: string;
  passwordHash: string;
  profile: UserProfile;
  updatedAt: number;
}

const inFlightRegistrationKeys = new Set<string>();
const authErrorListeners = new Set<(message: string) => void>();
const authNoticeListeners = new Set<(message: string) => void>();

export function subscribeAuthBackgroundErrors(
  listener: (message: string) => void
): () => void {
  authErrorListeners.add(listener);
  return () => {
    authErrorListeners.delete(listener);
  };
}

export function emitAuthBackgroundError(message: string): void {
  authErrorListeners.forEach((cb) => {
    try {
      cb(message);
    } catch {}
  });
}

export function subscribeAuthBackgroundNotices(
  listener: (message: string) => void
): () => void {
  authNoticeListeners.add(listener);
  return () => {
    authNoticeListeners.delete(listener);
  };
}

export function emitAuthBackgroundNotice(message: string): void {
  authNoticeListeners.forEach((cb) => {
    try {
      cb(message);
    } catch {}
  });
}

function readFastAuthMap(): Record<string, FastAuthEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FAST_AUTH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, FastAuthEntry>) : {};
  } catch {
    return {};
  }
}

function writeFastAuthMap(map: Record<string, FastAuthEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const trimmed: Record<string, FastAuthEntry> = {};
    for (const item of entries.slice(0, MAX_FAST_AUTH_ENTRIES)) {
      if (item?.uid) {
        trimmed[item.uid] = item;
      }
    }
    localStorage.setItem(FAST_AUTH_CACHE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function saveFastAuthEntry(profile: UserProfile): void {
  if (!profile?.uid || !profile.passwordHash) return;
  const map = readFastAuthMap();
  const safeProfile: UserProfile = { ...profile };
  // Avoid storing oversized data URL avatars inside fast auth cache
  if (safeProfile.avatarUrl && safeProfile.avatarUrl.startsWith('data:') && safeProfile.avatarUrl.length > 4096) {
    delete safeProfile.avatarUrl;
  }
  map[profile.uid] = {
    uid: profile.uid,
    email: (profile.email || '').trim().toLowerCase(),
    username: normalizeUsername(profile.username || ''),
    phoneNumber: normalizeBDPhoneNumber(profile.phoneNumber || ''),
    passwordHash: profile.passwordHash,
    profile: safeProfile,
    updatedAt: Date.now(),
  };
  writeFastAuthMap(map);
}

export function removeFastAuthEntry(uid: string): void {
  if (!uid) return;
  const map = readFastAuthMap();
  if (map[uid]) {
    delete map[uid];
    writeFastAuthMap(map);
  }
}

export function lookupFastAuthCache(identifier: string): PlayerLookupResult | null {
  const raw = identifier.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const isEmail = raw.includes('@');
  const isPhone = isValidBDPhoneNumber(raw);
  const normPhone = normalizeBDPhoneNumber(raw);
  const normUser = normalizeUsername(raw);

  const entries = Object.values(readFastAuthMap());
  for (const entry of entries) {
    const matched =
      (isEmail && entry.email === lower) ||
      (isPhone && entry.phoneNumber === normPhone) ||
      (!isEmail && entry.username === normUser);
    if (matched && entry.passwordHash) {
      return {
        uid: entry.uid,
        email: entry.email,
        username: entry.username,
        phoneNumber: entry.phoneNumber,
        displayName: entry.profile?.displayName || entry.username || 'Player',
        passwordHash: entry.passwordHash,
        userProfile: entry.profile,
      };
    }
  }
  return null;
}

export function hasFastAuthDuplicate(
  username: string,
  email: string,
  phoneNumber: string
): string | null {
  const normUser = normalizeUsername(username);
  const cleanEmail = email.trim().toLowerCase();
  const normPhone = normalizeBDPhoneNumber(phoneNumber);
  const entries = Object.values(readFastAuthMap());
  for (const entry of entries) {
    if (normUser && entry.username === normUser) {
      return 'Already registered with this Username, please Sign In.';
    }
    if (cleanEmail && entry.email === cleanEmail) {
      return 'Already registered with this Email, please Sign In.';
    }
    if (normPhone && entry.phoneNumber === normPhone) {
      return 'Already registered with this Mobile Number, please Sign In.';
    }
  }
  return null;
}

export function acquireRegistrationLock(
  username: string,
  email: string,
  phoneNumber: string
): (() => void) | null {
  const keys = [
    `u:${normalizeUsername(username)}`,
    `e:${email.trim().toLowerCase()}`,
    `p:${normalizeBDPhoneNumber(phoneNumber)}`,
  ].filter((k) => k.length > 2);

  for (const k of keys) {
    if (inFlightRegistrationKeys.has(k)) {
      return null;
    }
  }
  keys.forEach((k) => inFlightRegistrationKeys.add(k));
  return () => {
    keys.forEach((k) => inFlightRegistrationKeys.delete(k));
  };
}

/**
 * SHA-256 password hash using standard Web Crypto API.
 */
export async function hashPassword(plainText: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(plainText.trim() + '::tx_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalizes username: lowercase, trimmed, alphanumeric and underscore only.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Normalizes Bangladeshi phone number: 11 digits (e.g., 017xxxxxxxx).
 */
export function normalizeBDPhoneNumber(raw: string): string {
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

export function isValidBDPhoneNumber(phone: string): boolean {
  const norm = normalizeBDPhoneNumber(phone);
  return /^01[3-9]\d{8}$/.test(norm);
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Converts a username or phone to a safe synthetic email format for Firebase Auth backing.
 */
export function identifierToAuthEmail(identifier: string): string {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }
  if (isValidBDPhoneNumber(clean)) {
    const norm = normalizeBDPhoneNumber(clean);
    return `user_${norm}@tx-tour-bd.player`;
  }
  const normUser = normalizeUsername(clean);
  return `user_${normUser}@tx-tour-bd.player`;
}

/**
 * Checks if username is already registered (parallel single-hop check).
 */
export async function checkUsernameExists(username: string): Promise<boolean> {
  const norm = normalizeUsername(username);
  if (!norm) return false;
  try {
    const [lookupSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, 'usernameAuthLookup', norm)).catch(() => null),
      getDocs(query(collection(db, 'users'), where('username', '==', norm), limit(1))).catch(() => null),
    ]);
    return Boolean(lookupSnap?.exists() || (usersSnap && !usersSnap.empty));
  } catch (err) {
    console.warn('[playerAuthService] checkUsernameExists fallback check', err);
    return false;
  }
}

/**
 * Checks if email is already registered.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    const q = query(collection(db, 'users'), where('email', '==', norm), limit(1));
    const querySnap = await getDocs(q);
    return !querySnap.empty;
  } catch (err) {
    console.warn('[playerAuthService] checkEmailExists fallback check', err);
    return false;
  }
}

/**
 * Checks if phone number is already registered (parallel single-hop check).
 */
export async function checkPhoneExists(phoneNumber: string): Promise<boolean> {
  const norm = normalizeBDPhoneNumber(phoneNumber);
  if (!norm) return false;
  try {
    const [lookupSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, 'phoneAuthLookup', norm)).catch(() => null),
      getDocs(query(collection(db, 'users'), where('phoneNumber', '==', norm), limit(1))).catch(() => null),
    ]);
    return Boolean(lookupSnap?.exists() || (usersSnap && !usersSnap.empty));
  } catch (err) {
    console.warn('[playerAuthService] checkPhoneExists fallback check', err);
    return false;
  }
}

export interface PlayerLookupResult {
  uid: string;
  email: string;
  username: string;
  phoneNumber?: string;
  displayName: string;
  passwordHash?: string;
  userProfile?: UserProfile;
}

function firstNonNullPromise<T>(tasks: Array<Promise<T | null>>): Promise<T | null> {
  if (tasks.length === 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    let remaining = tasks.length;
    let settled = false;
    tasks.forEach((p) => {
      p.then((val) => {
        if (!settled && val !== null) {
          settled = true;
          resolve(val);
        }
      })
        .catch(() => {})
        .finally(() => {
          remaining -= 1;
          if (!settled && remaining <= 0) {
            settled = true;
            resolve(null);
          }
        });
    });
  });
}

async function resolveUserByField(
  field: 'email' | 'phoneNumber' | 'username',
  value: string
): Promise<PlayerLookupResult | null> {
  try {
    const q = query(collection(db, 'users'), where(field, '==', value), limit(1));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const docSnap = qSnap.docs[0];
      const up = docSnap.data() as UserProfile;
      return {
        uid: docSnap.id,
        email: up.email,
        username: up.username,
        phoneNumber: up.phoneNumber,
        displayName: up.displayName,
        passwordHash: up.passwordHash,
        userProfile: { ...up, uid: docSnap.id },
      };
    }
  } catch (e) {
    console.warn('[playerAuthService] users query error:', e);
  }
  return null;
}

async function resolveFromIndexDoc(
  colName: 'phoneAuthLookup' | 'usernameAuthLookup',
  docId: string,
  fallbackUsername: string,
  fallbackPhone?: string
): Promise<PlayerLookupResult | null> {
  try {
    const snap = await getDoc(doc(db, colName, docId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const uid = data.uid as string;
    if (!uid) return null;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;
    const up = userDoc.data() as UserProfile;
    return {
      uid,
      email: up.email || (data.authEmail as string),
      username: up.username || (data.username as string) || fallbackUsername,
      phoneNumber: up.phoneNumber || fallbackPhone,
      displayName: up.displayName || 'Player',
      passwordHash: up.passwordHash,
      userProfile: { ...up, uid },
    };
  } catch (e) {
    console.warn(`[playerAuthService] ${colName} check error:`, e);
    return null;
  }
}

/**
 * Look up user by Username, Email, or Phone number across Firestore in parallel (1 round trip).
 */
export async function lookupUserByIdentifier(
  identifier: string
): Promise<PlayerLookupResult | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  const isEmail = raw.includes('@');
  const isPhone = isValidBDPhoneNumber(raw);
  const normPhone = normalizeBDPhoneNumber(raw);
  const normUser = normalizeUsername(raw);

  if (isEmail) {
    return resolveUserByField('email', raw.toLowerCase());
  }

  if (isPhone) {
    return firstNonNullPromise([
      resolveUserByField('phoneNumber', normPhone),
      resolveFromIndexDoc('phoneAuthLookup', normPhone, normUser, normPhone),
    ]);
  }

  return firstNonNullPromise([
    resolveUserByField('username', normUser),
    resolveFromIndexDoc('usernameAuthLookup', normUser, normUser),
  ]);
}

/**
 * Saves or updates lookup documents in Firestore in parallel.
 */
export async function registerPlayerLookupIndexes(
  uid: string,
  username: string,
  email: string,
  phoneNumber: string
): Promise<void> {
  const normUser = normalizeUsername(username);
  const normPhone = normalizeBDPhoneNumber(phoneNumber);
  const now = new Date().toISOString();
  const tasks: Array<Promise<void>> = [];

  if (normUser && normUser.length >= 3) {
    tasks.push(
      setDoc(doc(db, 'usernameAuthLookup', normUser), {
        username: normUser,
        authEmail: email.toLowerCase(),
        uid,
        phoneNumber: normPhone,
        updatedAt: now,
      }).catch((e) => {
        console.warn('[playerAuthService] Failed saving usernameAuthLookup', e);
      })
    );
  }

  if (normPhone) {
    tasks.push(
      setDoc(doc(db, 'phoneAuthLookup', normPhone), {
        phoneNumber: normPhone,
        authEmail: email.toLowerCase(),
        uid,
        username: normUser,
        updatedAt: now,
      }).catch((e) => {
        console.warn('[playerAuthService] Failed saving phoneAuthLookup', e);
      })
    );
  }

  await Promise.all(tasks);
}

/**
 * Atomically writes new player profile, lookup indexes, and leaderboard entry in one Firestore batch.
 */
export async function commitNewPlayerBatch(newProfile: UserProfile): Promise<void> {
  const batch = writeBatch(db);
  const now = newProfile.updatedAt || new Date().toISOString();
  const normUser = normalizeUsername(newProfile.username || '');
  const normPhone = normalizeBDPhoneNumber(newProfile.phoneNumber || '');
  const cleanEmail = (newProfile.email || '').trim().toLowerCase();

  batch.set(doc(db, 'users', newProfile.uid), newProfile);

  if (normUser && normUser.length >= 3) {
    batch.set(doc(db, 'usernameAuthLookup', normUser), {
      username: normUser,
      authEmail: cleanEmail,
      uid: newProfile.uid,
      phoneNumber: normPhone,
      updatedAt: now,
    });
  }

  if (normPhone) {
    batch.set(doc(db, 'phoneAuthLookup', normPhone), {
      phoneNumber: normPhone,
      authEmail: cleanEmail,
      uid: newProfile.uid,
      username: normUser,
      updatedAt: now,
    });
  }

  const lbEntry: LeaderboardEntry = {
    uid: newProfile.uid,
    displayName: newProfile.displayName || 'Player',
    inGameName: newProfile.inGameName ?? '',
    freeFireUid: newProfile.freeFireUid ?? '',
    teamName: newProfile.teamName ?? '',
    avatarUrl: newProfile.avatarUrl ?? '',
    totalEarnings: 0,
    totalWins: 0,
    totalKills: 0,
    totalMatches: 0,
    weeklyEarnings: 0,
    weeklyWins: 0,
    weeklyKills: 0,
    weeklyMatches: 0,
    weekStartIso: '',
    weekResetAt: '',
    isBanned: false,
    banReason: '',
    banExpiresAt: null,
    updatedAt: now,
  };
  batch.set(doc(db, 'leaderboard', newProfile.uid), lbEntry, { merge: true });

  await batch.commit();
}

/**
 * Updates password hash for an account in Firestore.
 */
export async function resetPasswordInFirestore(
  identifier: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const userResult = await lookupUserByIdentifier(identifier);
    if (!userResult) {
      return {
        success: false,
        message: 'No account found with this Username, Email or Mobile number.',
      };
    }

    const newHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    const userRef = doc(db, 'users', userResult.uid);
    await updateDoc(userRef, {
      passwordHash: newHash,
      updatedAt: nowIso,
    });

    if (userResult.userProfile) {
      saveFastAuthEntry({
        ...userResult.userProfile,
        passwordHash: newHash,
        updatedAt: nowIso,
      });
    }

    return {
      success: true,
      message: 'Password changed successfully! Please Sign In with your new password.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to update password. Please try again.',
    };
  }
}

/**
 * Session persistence helper: saves user session depending on "Remember me" setting.
 */
export function savePlayerSession(user: UserProfile, rememberMe: boolean): void {
  try {
    const raw = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem(USER_SESSION_KEY, raw);
      localStorage.setItem(USER_SESSION_REMEMBER_FLAG, 'true');
      sessionStorage.removeItem(USER_SESSION_KEY);
    } else {
      sessionStorage.setItem(USER_SESSION_KEY, raw);
      localStorage.removeItem(USER_SESSION_KEY);
      localStorage.setItem(USER_SESSION_REMEMBER_FLAG, 'false');
    }
  } catch (e) {
    console.warn('[playerAuthService] savePlayerSession error', e);
  }
}

/**
 * Retrieves saved player session on app launch.
 */
export function getSavedPlayerSession(): UserProfile | null {
  try {
    // Check localStorage first (if Remember me was checked)
    const local = localStorage.getItem(USER_SESSION_KEY);
    if (local) {
      return JSON.parse(local) as UserProfile;
    }
    // Check sessionStorage
    const session = sessionStorage.getItem(USER_SESSION_KEY);
    if (session) {
      return JSON.parse(session) as UserProfile;
    }
  } catch (e) {
    console.warn('[playerAuthService] getSavedPlayerSession error', e);
  }
  return null;
}

/**
 * Clears player session from both storages.
 */
export function clearPlayerSession(): void {
  try {
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(USER_SESSION_REMEMBER_FLAG);
    sessionStorage.removeItem(USER_SESSION_KEY);
  } catch (e) {}
}
