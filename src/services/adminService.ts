import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from './firebase';
import { AdminRecord, PublicAdminRecord, Role, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  ADMIN_CARTOON_AVATARS,
  pickNextUniqueAdminAvatarId,
  resolveAdminAvatarId,
} from '../constants/adminAvatars';

export const BOOTSTRAP_ADMIN_EMAIL = 'mdjarshed373@gmail.com';
const SYNTHETIC_ADMIN_DOMAIN = '@txtourbd.app';

const LOCAL_ADMINS_KEY = 'tx_local_admins_v1';
const LOCAL_PUBLIC_ADMINS_KEY = 'tx_local_public_admins_v1';
const ACTIVE_ADMIN_SESSION_KEY = 'tx_active_admin_session_v1';
const LOCAL_ADMINS_EVENT = 'tx_admins_updated';

export interface LocalStoredAdminRecord {
  uid: string;
  displayName: string;
  phoneNumber: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  avatarId?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizePhoneNumber(raw: string): string {
  const stripped = raw.trim().replace(/[\s\-().]/g, '');
  if (!stripped) return '';
  if (stripped.startsWith('+880')) {
    return '0' + stripped.slice(4);
  }
  if (stripped.startsWith('880') && stripped.length >= 13) {
    return '0' + stripped.slice(3);
  }
  return stripped.replace(/^\+/, '');
}

export function isValidPhoneNumber(normPhone: string): boolean {
  return /^[0-9]{6,20}$/.test(normPhone);
}

export function isEmailInput(raw: string): boolean {
  return raw.trim().includes('@');
}

export function phoneToSyntheticEmail(normPhone: string): string {
  return `admin.${normPhone}${SYNTHETIC_ADMIN_DOMAIN}`;
}

export function formatAdminDisplayContact(admin: {
  phoneNumber?: string;
  email?: string;
}): { primary: string; secondary?: string } {
  const phone = admin.phoneNumber?.trim() || '';
  const email = admin.email?.trim() || '';
  const isSynthetic = email.toLowerCase().endsWith(SYNTHETIC_ADMIN_DOMAIN);

  if (phone && email && !isSynthetic) {
    return { primary: phone, secondary: email };
  }
  if (phone) {
    return { primary: phone };
  }
  return { primary: email || 'N/A' };
}

function sha256FallbackHex(input: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padLen = withOne % 64 <= 56 ? 56 - (withOne % 64) : 120 - (withOne % 64);
  const totalLen = withOne + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes, 0);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return H.map((v) => v.toString(16).padStart(8, '0')).join('');
}

export async function hashAdminPassword(
  identifier: string,
  password: string
): Promise<string> {
  const cleanId = identifier.trim().toLowerCase();
  const payload = `tx_admin_auth_v1:${cleanId}:${password}`;
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const data = new TextEncoder().encode(payload);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256:${hex}`;
    }
  } catch {
    // Fallback to pure-JS SHA-256 if subtle crypto is unavailable
  }
  return `sha256:${sha256FallbackHex(payload)}`;
}

function emitLocalAdminsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOCAL_ADMINS_EVENT));
  }
}

export function readLocalAdmins(): LocalStoredAdminRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ADMINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalStoredAdminRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAdmins(list: LocalStoredAdminRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_ADMINS_KEY, JSON.stringify(list));
    emitLocalAdminsChanged();
  } catch {
    // ignore storage quota error
  }
}

function upsertLocalAdmin(record: LocalStoredAdminRecord): void {
  const existing = readLocalAdmins();
  const idx = existing.findIndex(
    (a) =>
      a.uid === record.uid ||
      (record.phoneNumber &&
        normalizePhoneNumber(a.phoneNumber) === normalizePhoneNumber(record.phoneNumber))
  );
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...record };
  } else {
    existing.push(record);
  }
  writeLocalAdmins(existing);
}

function removeLocalAdminByUid(uid: string): void {
  const next = readLocalAdmins().filter((a) => a.uid !== uid);
  writeLocalAdmins(next);
}

export function readLocalPublicAdmins(): PublicAdminRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PUBLIC_ADMINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PublicAdminRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalPublicAdmins(list: PublicAdminRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_PUBLIC_ADMINS_KEY, JSON.stringify(list));
    emitLocalAdminsChanged();
  } catch {
    // ignore
  }
}

function upsertLocalPublicAdmin(record: PublicAdminRecord): void {
  const existing = readLocalPublicAdmins();
  const idx = existing.findIndex((p) => p.id === record.id);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...record };
  } else {
    existing.push(record);
  }
  writeLocalPublicAdmins(existing);
}

function removeLocalPublicAdminById(id: string): void {
  const next = readLocalPublicAdmins().filter((p) => p.id !== id);
  writeLocalPublicAdmins(next);
}

export function getActiveAdminSession(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || !parsed.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveAdminSession(profile: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!profile) {
      window.localStorage.removeItem(ACTIVE_ADMIN_SESSION_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_ADMIN_SESSION_KEY, JSON.stringify(profile));
    }
    emitLocalAdminsChanged();
  } catch {
    // ignore
  }
}

function buildDefaultAdminUserProfile(params: {
  uid: string;
  displayName: string;
  phoneNumber: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}): UserProfile {
  const normPhone = normalizePhoneNumber(params.phoneNumber);
  return {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
    username: normPhone ? `admin_${normPhone}` : `admin_${params.uid.slice(0, 6)}`,
    phoneNumber: normPhone,
    freeFireUid: '',
    inGameName: params.displayName,
    role: params.role,
    isAdmin: true,
    walletBalance: 0,
    pendingBalance: 0,
    totalDeposited: 0,
    spentFromDeposited: 0,
    totalWithdrawn: 0,
    totalEarnings: 0,
    spentFromWinning: 0,
    totalKills: 0,
    totalWins: 0,
    totalMatches: 0,
    totalTournaments: 0,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

/**
 * Checks whether at least one credentialed Admin already exists (locally or in Firestore).
 * When false, the Admin Login page shows "Create First Admin" so the owner can become 1 No Admin.
 */
export async function hasAnyAdminConfigured(): Promise<boolean> {
  if (readLocalAdmins().length > 0) {
    return true;
  }
  try {
    const metaSnap = await getDoc(doc(db, 'publicMeta', 'adminBootstrap'));
    if (metaSnap.exists() && metaSnap.data()?.hasAdmin === true) {
      return true;
    }
  } catch {
    // ignore metadata read hiccup
  }

  try {
    const adminsSnap = await getDocs(collection(db, 'admins'));
    let foundCredentialedAdmin = false;
    adminsSnap.forEach((d) => {
      const data = d.data() as Partial<AdminRecord>;
      const hasPhone = Boolean(data.phoneNumber && String(data.phoneNumber).trim().length >= 6);
      const hasAddedBy = Boolean(data.addedBy);
      if (hasPhone || hasAddedBy) {
        foundCredentialedAdmin = true;
      }
    });
    if (foundCredentialedAdmin) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

export interface CreateFirstAdminParams {
  name: string;
  phoneNumber: string;
  password: string;
}

/**
 * Admin self-registration is disabled. Only Main Admin can add new admins.
 */
export async function createFirstAdmin(
  _params: CreateFirstAdminParams
): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  return {
    success: false,
    message: 'Admin self-registration is disabled. Please sign in as Main Admin.',
  };
}

function _unusedLegacyFirstAdminBlockRemoved() {
  const _now = Date.now();
  return _now;

  // Self-registration removed
}

/**
 * Verifies Admin Number + Password against Local System, Firestore hashed credentials,
 * or Firebase Auth fallback (never exposing raw auth/operation-not-allowed errors).
 */
export async function verifyAndLoginAdmin(
  adminNumberOrEmail: string,
  pass: string
): Promise<UserProfile> {
  const trimmed = adminNumberOrEmail.trim();
  if (!trimmed) {
    throw new Error('Please enter your Admin Number.');
  }
  if (!pass) {
    throw new Error('Please enter your Password.');
  }

  const isEmail = isEmailInput(trimmed);
  const normPhone = !isEmail ? normalizePhoneNumber(trimmed) : '';

  if (!isEmail && !isValidPhoneNumber(normPhone)) {
    throw new Error('Please enter a valid Admin Number (e.g. 017XXXXXXXX).');
  }

  const nowIso = new Date().toISOString();

  // 1. Check Local Admin Registry first (instant, works offline & when Firebase Email/Pass is disabled)
  const localAdmins = readLocalAdmins();
  const matchedLocal = localAdmins.find((a) =>
    normPhone
      ? normalizePhoneNumber(a.phoneNumber) === normPhone
      : a.email.toLowerCase() === trimmed.toLowerCase()
  );

  if (matchedLocal) {
    const idForHash = normPhone || normalizePhoneNumber(matchedLocal.phoneNumber) || matchedLocal.email;
    const candidateHash = await hashAdminPassword(idForHash, pass);
    if (candidateHash !== matchedLocal.passwordHash) {
      throw new Error('Invalid Admin Number or Password!');
    }

    try {
      if (auth.currentUser && auth.currentUser.uid !== matchedLocal.uid) {
        await signOut(auth);
      }
    } catch {
      // ignore
    }

    let resolvedProfile = buildDefaultAdminUserProfile({
      uid: matchedLocal.uid,
      displayName: matchedLocal.displayName,
      phoneNumber: matchedLocal.phoneNumber || normPhone,
      email: matchedLocal.email,
      role: matchedLocal.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      createdAt: matchedLocal.createdAt,
      updatedAt: nowIso,
    });

    try {
      const [adminSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'admins', matchedLocal.uid)),
        getDoc(doc(db, 'users', matchedLocal.uid)),
      ]);
      const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;
      const isBootstrapLocal =
        matchedLocal.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
      const isSuperLocal = isBootstrapLocal || matchedLocal.role === 'SUPER_ADMIN';

      if (
        !isSuperLocal &&
        ((!adminSnap.metadata.fromCache && !adminSnap.exists()) ||
          userData?.role === 'PLAYER' ||
          userData?.role === 'USER' ||
          userData?.role === 'user' ||
          userData?.isAdmin === false)
      ) {
        removeLocalAdminByUid(matchedLocal.uid);
        removeLocalPublicAdminById(matchedLocal.uid);
        throw new Error('Your Admin access has been removed.');
      }

      if (userData) {
        resolvedProfile = {
          ...userData,
          role: isSuperLocal ? 'SUPER_ADMIN' : 'ADMIN',
          isAdmin: true,
          phoneNumber: userData.phoneNumber || matchedLocal.phoneNumber || normPhone,
          updatedAt: nowIso,
        };
      }
    } catch (checkErr: unknown) {
      if (
        checkErr instanceof Error &&
        checkErr.message === 'Your Admin access has been removed.'
      ) {
        throw checkErr;
      }
      // use local profile if Firestore read is unavailable offline
    }

    const resolvedAvatarId = matchedLocal.avatarId;
    setActiveAdminSession(resolvedProfile);
    upsertLocalPublicAdmin({
      id: resolvedProfile.uid,
      displayName: (resolvedProfile.displayName || 'Admin').slice(0, 100),
      ...(resolvedAvatarId ? { avatarId: resolvedAvatarId } : {}),
      createdAt: resolvedProfile.createdAt,
    });

    // Background sync to Firestore in case created offline
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'publicMeta', 'adminBootstrap'), {
        hasAdmin: true,
        updatedAt: nowIso,
      });
      if (matchedLocal.phoneNumber || normPhone) {
        const cleanNum = normalizePhoneNumber(matchedLocal.phoneNumber || normPhone);
        batch.set(doc(db, 'adminCredentials', cleanNum), {
          phoneNumber: cleanNum,
          uid: resolvedProfile.uid,
          displayName: (resolvedProfile.displayName || 'Admin').slice(0, 100),
          passwordHash: matchedLocal.passwordHash,
          role: matchedLocal.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
          createdAt: resolvedProfile.createdAt,
          updatedAt: nowIso,
        });
      }
      batch.set(
        doc(db, 'admins', resolvedProfile.uid),
        {
          uid: resolvedProfile.uid,
          displayName: resolvedProfile.displayName,
          phoneNumber: resolvedProfile.phoneNumber || normPhone,
          email: resolvedProfile.email,
          role: matchedLocal.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
          ...(resolvedAvatarId ? { avatarId: resolvedAvatarId } : {}),
          createdAt: resolvedProfile.createdAt,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      batch.set(
        doc(db, 'publicAdmins', resolvedProfile.uid),
        {
          id: resolvedProfile.uid,
          displayName: (resolvedProfile.displayName || 'Admin').slice(0, 100),
          ...(resolvedAvatarId ? { avatarId: resolvedAvatarId } : {}),
          createdAt: resolvedProfile.createdAt,
        },
        { merge: true }
      );
      batch.set(doc(db, 'users', resolvedProfile.uid), resolvedProfile, { merge: true });
      await batch.commit();
    } catch {
      // ignore non-blocking background sync error
    }

    return resolvedProfile;
  }

  // 2. Check Firestore Hashed Credentials (/adminCredentials/{normPhone}) for multi-admin / cross-device login
  if (normPhone) {
    try {
      const credSnap = await getDoc(doc(db, 'adminCredentials', normPhone));
      if (credSnap.exists()) {
        const credData = credSnap.data() as {
          phoneNumber: string;
          uid: string;
          displayName: string;
          passwordHash: string;
          role: 'ADMIN' | 'SUPER_ADMIN';
          createdAt: string;
        };
        const candidateHash = await hashAdminPassword(normPhone, pass);
        if (candidateHash !== credData.passwordHash) {
          throw new Error('Invalid Admin Number or Password!');
        }

        try {
          if (auth.currentUser && auth.currentUser.uid !== credData.uid) {
            await signOut(auth);
          }
        } catch {
          // ignore
        }

        const [adminSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'admins', credData.uid)),
          getDoc(doc(db, 'users', credData.uid)),
        ]);
        const existingUserData = userSnap.exists()
          ? (userSnap.data() as UserProfile)
          : null;
        const isSuperCred = credData.role === 'SUPER_ADMIN';

        if (
          !isSuperCred &&
          ((!adminSnap.metadata.fromCache && !adminSnap.exists()) ||
            existingUserData?.role === 'PLAYER' ||
            existingUserData?.role === 'USER' ||
            existingUserData?.role === 'user' ||
            existingUserData?.isAdmin === false)
        ) {
          removeLocalAdminByUid(credData.uid);
          removeLocalPublicAdminById(credData.uid);
          throw new Error('Your Admin access has been removed.');
        }

        const resolvedRole: Role =
          credData.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
        const authEmail = phoneToSyntheticEmail(normPhone);

        let resolvedProfile = buildDefaultAdminUserProfile({
          uid: credData.uid,
          displayName: credData.displayName || 'Admin',
          phoneNumber: normPhone,
          email: authEmail,
          role: resolvedRole,
          createdAt: credData.createdAt || nowIso,
          updatedAt: nowIso,
        });

        if (existingUserData) {
          resolvedProfile = {
            ...existingUserData,
            role: resolvedRole,
            isAdmin: true,
            phoneNumber: existingUserData.phoneNumber || normPhone,
            updatedAt: nowIso,
          };
        }

        const existingAvatarId =
          (adminSnap.exists() && (adminSnap.data()?.avatarId as string | undefined)) ||
          undefined;

        upsertLocalAdmin({
          uid: resolvedProfile.uid,
          displayName: resolvedProfile.displayName,
          phoneNumber: normPhone,
          email: resolvedProfile.email || authEmail,
          passwordHash: credData.passwordHash,
          role: resolvedRole,
          ...(existingAvatarId ? { avatarId: existingAvatarId } : {}),
          createdAt: resolvedProfile.createdAt,
          updatedAt: nowIso,
        });
        upsertLocalPublicAdmin({
          id: resolvedProfile.uid,
          displayName: (resolvedProfile.displayName || 'Admin').slice(0, 100),
          ...(existingAvatarId ? { avatarId: existingAvatarId } : {}),
          createdAt: resolvedProfile.createdAt,
        });
        setActiveAdminSession(resolvedProfile);

        // Ensure /admins and /publicAdmins docs exist
        try {
          const batch = writeBatch(db);
          batch.set(
            doc(db, 'admins', resolvedProfile.uid),
            {
              uid: resolvedProfile.uid,
              displayName: resolvedProfile.displayName,
              phoneNumber: normPhone,
              email: resolvedProfile.email || authEmail,
              role: resolvedRole,
              ...(existingAvatarId ? { avatarId: existingAvatarId } : {}),
              createdAt: resolvedProfile.createdAt,
              updatedAt: nowIso,
            },
            { merge: true }
          );
          batch.set(
            doc(db, 'publicAdmins', resolvedProfile.uid),
            {
              id: resolvedProfile.uid,
              displayName: (resolvedProfile.displayName || 'Admin').slice(0, 100),
              ...(existingAvatarId ? { avatarId: existingAvatarId } : {}),
              createdAt: resolvedProfile.createdAt,
            },
            { merge: true }
          );
          batch.set(doc(db, 'users', resolvedProfile.uid), resolvedProfile, { merge: true });
          await batch.commit();
        } catch {
          // ignore
        }

        return resolvedProfile;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === 'Invalid Admin Number or Password!' ||
          err.message === 'Your Admin access has been removed.')
      ) {
        throw err;
      }
    }
  }

  // 3. Fallback to Firebase Auth if Email/Password provider is enabled in Firebase Console
  let targetEmail = trimmed.toLowerCase();
  if (!isEmail && normPhone) {
    try {
      const lookupSnap = await getDoc(doc(db, 'phoneAuthLookup', normPhone));
      if (lookupSnap.exists() && lookupSnap.data()?.authEmail) {
        targetEmail = String(lookupSnap.data().authEmail).toLowerCase();
      } else {
        targetEmail = phoneToSyntheticEmail(normPhone);
      }
    } catch {
      targetEmail = phoneToSyntheticEmail(normPhone);
    }
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
    const uid = cred.user.uid;
    const isBoot = (cred.user.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

    const [userSnap, adminSnap, publicSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'admins', uid)),
      getDoc(doc(db, 'publicAdmins', uid)),
    ]);

    const existingUser = userSnap.exists()
      ? (userSnap.data() as UserProfile)
      : null;

    const hasAdminAccess =
      isBoot ||
      adminSnap.exists() ||
      existingUser?.role === 'ADMIN' ||
      existingUser?.role === 'SUPER_ADMIN' ||
      existingUser?.role === 'MODERATOR';

    if (!hasAdminAccess) {
      await signOut(auth);
      throw new Error('Access denied! This number does not have Admin access.');
    }

    const resolvedRole: Role =
      isBoot || existingUser?.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    const resolvedProfile: UserProfile = existingUser
      ? {
          ...existingUser,
          role: resolvedRole,
          phoneNumber: existingUser.phoneNumber || normPhone || '',
          updatedAt: nowIso,
        }
      : buildDefaultAdminUserProfile({
          uid,
          displayName: cred.user.displayName || 'Admin',
          phoneNumber: normPhone || cred.user.phoneNumber || '',
          email: cred.user.email || targetEmail,
          role: resolvedRole,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

    const createdTimestamp =
      (publicSnap.exists() && publicSnap.data()?.createdAt) ||
      (adminSnap.exists() && adminSnap.data()?.createdAt) ||
      resolvedProfile.createdAt ||
      nowIso;

    const cleanNum = normalizePhoneNumber(resolvedProfile.phoneNumber || normPhone);
    const passwordHash = await hashAdminPassword(cleanNum || resolvedProfile.email, pass);

    const existingFbAvatarId =
      (publicSnap.exists() && (publicSnap.data()?.avatarId as string | undefined)) ||
      (adminSnap.exists() && (adminSnap.data()?.avatarId as string | undefined)) ||
      undefined;

    upsertLocalAdmin({
      uid,
      displayName: resolvedProfile.displayName || 'Admin',
      phoneNumber: cleanNum,
      email: resolvedProfile.email || targetEmail,
      passwordHash,
      role: resolvedRole,
      ...(existingFbAvatarId ? { avatarId: existingFbAvatarId } : {}),
      createdAt: createdTimestamp,
      updatedAt: nowIso,
    });
    upsertLocalPublicAdmin({
      id: uid,
      displayName: (resolvedProfile.displayName || 'Admin').trim().slice(0, 100) || 'Admin',
      ...(existingFbAvatarId ? { avatarId: existingFbAvatarId } : {}),
      createdAt: createdTimestamp,
    });
    setActiveAdminSession(resolvedProfile);

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'publicMeta', 'adminBootstrap'), {
        hasAdmin: true,
        updatedAt: nowIso,
      });
      if (cleanNum) {
        batch.set(doc(db, 'adminCredentials', cleanNum), {
          phoneNumber: cleanNum,
          uid,
          displayName: (resolvedProfile.displayName || 'Admin').trim().slice(0, 100) || 'Admin',
          passwordHash,
          role: resolvedRole,
          createdAt: createdTimestamp,
          updatedAt: nowIso,
        });
      }
      batch.set(doc(db, 'users', uid), resolvedProfile, { merge: true });
      batch.set(
        doc(db, 'admins', uid),
        {
          uid,
          displayName: resolvedProfile.displayName || 'Admin',
          phoneNumber: cleanNum,
          email: resolvedProfile.email || targetEmail,
          role: resolvedRole,
          ...(existingFbAvatarId ? { avatarId: existingFbAvatarId } : {}),
          createdAt: createdTimestamp,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      batch.set(
        doc(db, 'publicAdmins', uid),
        {
          id: uid,
          displayName: (resolvedProfile.displayName || 'Admin').trim().slice(0, 100) || 'Admin',
          ...(existingFbAvatarId ? { avatarId: existingFbAvatarId } : {}),
          createdAt: createdTimestamp,
        },
        { merge: true }
      );
      await batch.commit();
    } catch {
      // ignore non-blocking write error
    }

    return resolvedProfile;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('Access denied') ||
        err.message === 'Your Admin access has been removed.')
    ) {
      throw err;
    }
    throw new Error('Invalid Admin Number or Password!');
  }
}

function mergeAdminLists(
  adminDocs: Record<string, Partial<AdminRecord>>,
  userDocs: Record<string, UserProfile>,
  localDocs: LocalStoredAdminRecord[]
): AdminRecord[] {
  const merged = new Map<string, AdminRecord>();

  // 1. Add all docs from Firestore /admins
  Object.entries(adminDocs).forEach(([uid, a]) => {
    const u = userDocs[uid];
    const email = a.email || u?.email || '';
    const isBootstrap = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    const rawRole = isBootstrap ? 'SUPER_ADMIN' : a.role || u?.role || 'ADMIN';
    const role: 'ADMIN' | 'SUPER_ADMIN' =
      rawRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    merged.set(uid, {
      uid,
      displayName: a.displayName || u?.displayName || u?.inGameName || 'Admin',
      phoneNumber: a.phoneNumber || u?.phoneNumber || '',
      email,
      role,
      avatarId: a.avatarId,
      addedBy: a.addedBy,
      createdAt: a.createdAt || u?.createdAt || new Date().toISOString(),
      updatedAt: a.updatedAt || u?.updatedAt,
    });
  });

  // 2. Include any users with ADMIN / SUPER_ADMIN role not yet in /admins
  Object.values(userDocs).forEach((u) => {
    const isBootstrap = (u.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    if (isBootstrap || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
      const existing = merged.get(u.uid);
      const role: 'ADMIN' | 'SUPER_ADMIN' =
        isBootstrap || u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
      if (!existing) {
        merged.set(u.uid, {
          uid: u.uid,
          displayName: u.displayName || u.inGameName || 'Admin',
          phoneNumber: u.phoneNumber || '',
          email: u.email || '',
          role,
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt,
        });
      }
    }
  });

  // 3. Include locally stored admins (for offline / local-only / immediate UI feedback)
  localDocs.forEach((loc) => {
    const existing = merged.get(loc.uid);
    if (!existing) {
      merged.set(loc.uid, {
        uid: loc.uid,
        displayName: loc.displayName || 'Admin',
        phoneNumber: loc.phoneNumber || '',
        email: loc.email || '',
        role: loc.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
        avatarId: loc.avatarId,
        addedBy: loc.addedBy,
        createdAt: loc.createdAt || new Date().toISOString(),
        updatedAt: loc.updatedAt,
      });
    } else if (!existing.avatarId && loc.avatarId) {
      merged.set(loc.uid, { ...existing, avatarId: loc.avatarId });
    }
  });

  // Sort so Bootstrap Admin / Admin 1 is always first, followed chronologically; only index 0 is SUPER_ADMIN
  const sorted = Array.from(merged.values()).sort((a, b) => {
    const aIsBootstrap = a.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    const bIsBootstrap = b.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
    if (aIsBootstrap !== bIsBootstrap) {
      return aIsBootstrap ? -1 : 1;
    }
    const aIsSuper = a.role === 'SUPER_ADMIN';
    const bIsSuper = b.role === 'SUPER_ADMIN';
    if (aIsSuper !== bIsSuper) {
      return aIsSuper ? -1 : 1;
    }
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  // Ensure every admin has a unique cartoon avatar ID
  const assignedSoFar: AdminRecord[] = [];
  return sorted.map((admin, idx) => {
    const resolvedAvatarId =
      admin.avatarId && !assignedSoFar.some((a) => a.avatarId === admin.avatarId)
        ? resolveAdminAvatarId(admin.avatarId, idx)
        : admin.avatarId
        ? admin.avatarId
        : pickNextUniqueAdminAvatarId(assignedSoFar);
    const enriched: AdminRecord = {
      ...admin,
      role: idx === 0 ? 'SUPER_ADMIN' : 'ADMIN',
      avatarId: resolvedAvatarId,
    };
    assignedSoFar.push(enriched);
    return enriched;
  });
}

/**
 * Public non-PII listener for the "Our Admins" section.
 * Exposes ONLY { id, displayName, avatarId, createdAt } ordered chronologically (Admin 1, Admin 2, ...).
 */
export function subscribePublicAdmins(
  onUpdate: (admins: PublicAdminRecord[]) => void
): () => void {
  let firestorePublic: PublicAdminRecord[] = [];
  let hasBootstrapMeta = false;
  let hasServerPublicSnap = false;

  const emitCombined = () => {
    const byId = new Map<string, PublicAdminRecord>();
    const localAdmins = readLocalAdmins();
    const localPub = readLocalPublicAdmins();

    // Only include Firestore publicAdmins if bootstrap is active OR they match a local admin
    firestorePublic.forEach((item) => {
      if (hasBootstrapMeta || localAdmins.some((la) => la.uid === item.id)) {
        byId.set(item.id, item);
      }
    });

    if (!(hasServerPublicSnap && hasBootstrapMeta && firestorePublic.length > 0)) {
      localPub.forEach((item) => {
        if (!byId.has(item.id)) {
          byId.set(item.id, item);
        }
      });

      localAdmins.forEach((la) => {
        if (!byId.has(la.uid) && la.displayName) {
          byId.set(la.uid, {
            id: la.uid,
            displayName: la.displayName,
            ...(la.avatarId ? { avatarId: la.avatarId } : {}),
            createdAt: la.createdAt,
          });
        }
      });
    }

    const sorted = Array.from(byId.values()).sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || '')
    );

    const assignedSoFar: PublicAdminRecord[] = [];
    const list = sorted.map((item, idx) => {
      const resolvedAvatarId =
        item.avatarId && ADMIN_CARTOON_AVATARS.some((a) => a.id === item.avatarId)
          ? item.avatarId
          : pickNextUniqueAdminAvatarId(assignedSoFar, ADMIN_CARTOON_AVATARS[idx % ADMIN_CARTOON_AVATARS.length].id);
      const nextItem: PublicAdminRecord = {
        ...item,
        avatarId: resolvedAvatarId,
      };
      assignedSoFar.push(nextItem);
      return nextItem;
    });

    onUpdate(list);
  };

  // Emit immediately from localStorage so UI is instantaneous
  if (readLocalAdmins().length > 0) {
    emitCombined();
  }

  hasAnyAdminConfigured()
    .then((configured) => {
      if (configured && !hasBootstrapMeta) {
        hasBootstrapMeta = true;
        emitCombined();
      }
    })
    .catch(() => {});

  const unsubMeta = onSnapshot(
    doc(db, 'publicMeta', 'adminBootstrap'),
    (snap) => {
      if (snap.exists() && snap.data()?.hasAdmin === true) {
        hasBootstrapMeta = true;
      }
      emitCombined();
    },
    () => {
      // ignore
    }
  );

  const unsubPublic = onSnapshot(
    collection(db, 'publicAdmins'),
    (snap) => {
      const next: PublicAdminRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<PublicAdminRecord>;
        const cleanName = String(data.displayName || '').trim();
        if (cleanName) {
          next.push({
            id: data.id || d.id,
            displayName: cleanName,
            ...(data.avatarId ? { avatarId: String(data.avatarId) } : {}),
            createdAt: String(data.createdAt || ''),
          });
        }
      });
      firestorePublic = next;
      if (!snap.metadata.fromCache) {
        hasServerPublicSnap = true;
      }
      if (hasBootstrapMeta) {
        writeLocalPublicAdmins(
          next.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        );
      }
      emitCombined();
    },
    (err) => {
      console.warn('Public admins listener error:', err);
      emitCombined();
    }
  );

  const handleLocalChange = () => emitCombined();
  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_ADMINS_EVENT, handleLocalChange);
    window.addEventListener('storage', handleLocalChange);
  }

  return () => {
    unsubMeta();
    unsubPublic();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_ADMINS_EVENT, handleLocalChange);
      window.removeEventListener('storage', handleLocalChange);
    }
  };
}

/**
 * Ensures every active admin in /admins or /users has a matching non-PII doc in /publicAdmins
 * (including unique Cartoon Avatar ID) so the user-facing "Our Admins" list stays 100% synced.
 */
export async function syncAllAdminsToPublicDirectory(
  adminList: AdminRecord[]
): Promise<void> {
  if (!adminList.length) return;
  try {
    const publicSnap = await getDocs(collection(db, 'publicAdmins'));
    const existingMap: Record<string, PublicAdminRecord> = {};
    publicSnap.forEach((d) => {
      existingMap[d.id] = d.data() as PublicAdminRecord;
    });

    const batch = writeBatch(db);
    let hasWrites = false;
    const assignedSoFar: Array<{ avatarId?: string }> = [];

    adminList.forEach((admin) => {
      if (!admin.uid) return;
      const cleanName = (admin.displayName || 'Admin').trim().slice(0, 100) || 'Admin';
      const existing = existingMap[admin.uid];
      const desiredCreatedAt =
        existing?.createdAt || admin.createdAt || new Date().toISOString();

      const candidateAvatarId = existing?.avatarId || admin.avatarId;
      const resolvedAvatarId =
        candidateAvatarId && ADMIN_CARTOON_AVATARS.some((a) => a.id === candidateAvatarId)
          ? candidateAvatarId
          : pickNextUniqueAdminAvatarId(assignedSoFar);
      assignedSoFar.push({ avatarId: resolvedAvatarId });

      if (
        !existing ||
        existing.displayName !== cleanName ||
        existing.id !== admin.uid ||
        !existing.createdAt ||
        existing.avatarId !== resolvedAvatarId
      ) {
        batch.set(doc(db, 'publicAdmins', admin.uid), {
          id: admin.uid,
          displayName: cleanName,
          avatarId: resolvedAvatarId,
          createdAt: desiredCreatedAt,
        });
        hasWrites = true;
      }
    });

    if (hasWrites) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Sync publicAdmins note:', err);
  }
}

export function subscribeAllAdmins(
  onUpdate: (admins: AdminRecord[]) => void
): () => void {
  let adminDocs: Record<string, Partial<AdminRecord>> = {};
  let userDocs: Record<string, UserProfile> = {};
  let hasServerAdminsSnap = false;

  const pruneDeletedLocalAdmins = () => {
    if (!hasServerAdminsSnap || Object.keys(adminDocs).length === 0) return;
    const currentLocal = readLocalAdmins();
    const pruned = currentLocal.filter(
      (loc) =>
        loc.role === 'SUPER_ADMIN' ||
        loc.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ||
        Boolean(adminDocs[loc.uid]) ||
        Boolean(
          userDocs[loc.uid] &&
            (userDocs[loc.uid].role === 'ADMIN' ||
              userDocs[loc.uid].role === 'SUPER_ADMIN')
        )
    );
    if (pruned.length !== currentLocal.length) {
      writeLocalAdmins(pruned);
    }
  };

  const healSecondarySuperAdmins = async (mergedList: AdminRecord[]) => {
    if (mergedList.length <= 1) return;
    const secondaryWithSuper = mergedList.slice(1).filter((adm) => {
      if (adm.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) return false;
      const docRole = adminDocs[adm.uid]?.role;
      const userRole = userDocs[adm.uid]?.role;
      return docRole === 'SUPER_ADMIN' || userRole === 'SUPER_ADMIN';
    });

    const localAdmins = readLocalAdmins();
    let localChanged = false;
    const primaryUid = mergedList[0]?.uid;
    const nextLocal = localAdmins.map((loc) => {
      if (
        loc.uid !== primaryUid &&
        loc.email.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL &&
        loc.role === 'SUPER_ADMIN'
      ) {
        localChanged = true;
        return { ...loc, role: 'ADMIN' as const };
      }
      return loc;
    });
    if (localChanged) {
      writeLocalAdmins(nextLocal);
    }

    if (secondaryWithSuper.length === 0) return;

    try {
      const nowIso = new Date().toISOString();
      const batch = writeBatch(db);
      let hasWrites = false;
      for (const adm of secondaryWithSuper) {
        if (adminDocs[adm.uid]?.role === 'SUPER_ADMIN') {
          batch.update(doc(db, 'admins', adm.uid), { role: 'ADMIN', updatedAt: nowIso });
          hasWrites = true;
        }
        if (userDocs[adm.uid]?.role === 'SUPER_ADMIN') {
          batch.update(doc(db, 'users', adm.uid), { role: 'ADMIN', updatedAt: nowIso });
          hasWrites = true;
        }
        const normP = adm.phoneNumber ? normalizePhoneNumber(adm.phoneNumber) : '';
        if (normP && isValidPhoneNumber(normP)) {
          const credSnap = await getDoc(doc(db, 'adminCredentials', normP));
          if (credSnap.exists() && credSnap.data()?.role === 'SUPER_ADMIN') {
            batch.update(doc(db, 'adminCredentials', normP), {
              role: 'ADMIN',
              updatedAt: nowIso,
            });
            hasWrites = true;
          }
        }
      }
      if (hasWrites) {
        await batch.commit();
      }
    } catch {
      // non-blocking cleanup note
    }
  };

  const emit = () => {
    pruneDeletedLocalAdmins();
    const mergedList = mergeAdminLists(adminDocs, userDocs, readLocalAdmins());
    onUpdate(mergedList);
    if (mergedList.length > 0) {
      syncAllAdminsToPublicDirectory(mergedList);
      healSecondarySuperAdmins(mergedList);
    }
  };

  // Emit immediately if local admins exist
  if (readLocalAdmins().length > 0) {
    emit();
  }

  const unsubAdmins = onSnapshot(
    collection(db, 'admins'),
    (snap) => {
      const next: Record<string, Partial<AdminRecord>> = {};
      snap.forEach((d) => {
        next[d.id] = { ...(d.data() as Partial<AdminRecord>), uid: d.id };
      });
      adminDocs = next;
      if (!snap.metadata.fromCache) {
        hasServerAdminsSnap = true;
      }
      emit();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'admins');
    }
  );

  const adminUsersQuery = query(
    collection(db, 'users'),
    where('role', 'in', ['ADMIN', 'SUPER_ADMIN'])
  );

  const unsubUsers = onSnapshot(
    adminUsersQuery,
    (snap) => {
      const next: Record<string, UserProfile> = {};
      snap.forEach((d) => {
        next[d.id] = d.data() as UserProfile;
      });
      userDocs = next;
      emit();
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'users');
    }
  );

  const handleLocalChange = () => emit();
  if (typeof window !== 'undefined') {
    window.addEventListener(LOCAL_ADMINS_EVENT, handleLocalChange);
    window.addEventListener('storage', handleLocalChange);
  }

  return () => {
    unsubAdmins();
    unsubUsers();
    if (typeof window !== 'undefined') {
      window.removeEventListener(LOCAL_ADMINS_EVENT, handleLocalChange);
      window.removeEventListener('storage', handleLocalChange);
    }
  };
}

export interface CreateAdminParams {
  name: string;
  contact: string; // Admin Mobile Number (or Email)
  password: string;
  role?: 'ADMIN' | 'SUPER_ADMIN';
  avatarId?: string;
  createdByUid: string;
  createdByEmail: string;
  isActingAdmin: boolean;
  isActingSuperAdmin?: boolean;
}

export async function createNewAdmin(
  params: CreateAdminParams
): Promise<{ success: boolean; message: string; admin?: AdminRecord }> {
  const isActorMainAdmin =
    Boolean(params.isActingSuperAdmin) ||
    params.createdByEmail.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  if (!params.isActingAdmin || !isActorMainAdmin) {
    return {
      success: false,
      message: 'Access denied. Only Main Admin can add new admins.',
    };
  }

  const cleanName = params.name.trim();
  if (cleanName.length < 2) {
    return {
      success: false,
      message: 'Please enter a valid Admin Name (at least 2 characters).',
    };
  }

  const rawContact = params.contact.trim();
  if (!rawContact) {
    return {
      success: false,
      message: 'Please enter a Phone Number.',
    };
  }

  if (isEmailInput(rawContact)) {
    return {
      success: false,
      message: 'Please enter a Phone Number only (e.g. 017XXXXXXXX).',
    };
  }

  const normPhone = normalizePhoneNumber(rawContact);
  if (!isValidPhoneNumber(normPhone)) {
    return {
      success: false,
      message: 'Please enter a valid Phone Number (e.g. 017XXXXXXXX).',
    };
  }

  const cleanPassword = params.password.trim();
  if (!/^\d{6}$/.test(cleanPassword)) {
    return {
      success: false,
      message: 'Password must be a 6-digit number (exactly 6 digits).',
    };
  }

  const phoneNumber = normPhone;
  const authEmail = phoneToSyntheticEmail(normPhone);

  const assignedRole: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN';
  const nowIso = new Date().toISOString();
  const passwordHash = await hashAdminPassword(phoneNumber || authEmail, params.password);

  let targetUid = phoneNumber
    ? `admin_${phoneNumber}`
    : `admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Reuse existing UID if this number or email already exists in local store or Firestore
  const existingLocal = readLocalAdmins().find((a) =>
    phoneNumber
      ? normalizePhoneNumber(a.phoneNumber) === phoneNumber
      : a.email.toLowerCase() === authEmail
  );
  if (existingLocal?.uid) {
    targetUid = existingLocal.uid;
  }

  try {
    if (phoneNumber) {
      const credSnap = await getDoc(doc(db, 'adminCredentials', phoneNumber));
      if (credSnap.exists() && credSnap.data()?.uid) {
        targetUid = String(credSnap.data().uid);
      } else {
        const usersByPhone = await getDocs(
          query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber))
        );
        if (!usersByPhone.empty) {
          targetUid = usersByPhone.docs[0].id;
        }
      }
    } else {
      const usersByEmail = await getDocs(
        query(collection(db, 'users'), where('email', '==', authEmail))
      );
      if (!usersByEmail.empty) {
        targetUid = usersByEmail.docs[0].id;
      }
    }
  } catch {
    // ignore pre-lookup failure
  }

  // Optional silent Firebase Auth sync if Email/Password happens to be enabled in Firebase Console
  try {
    const secondaryAppName =
      'adminCreator_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        authEmail,
        params.password
      );
      if (!existingLocal) {
        targetUid = cred.user.uid;
      }
    } catch {
      // Silently ignore auth/operation-not-allowed or auth/email-already-in-use
    } finally {
      await signOut(secondaryAuth).catch(() => {});
      await deleteApp(secondaryApp).catch(() => {});
    }
  } catch {
    // ignore
  }

  try {
    const userDocRef = doc(db, 'users', targetUid);
    const [existingUserSnap, existingAdminSnap, existingPublicSnap] =
      await Promise.all([
        getDoc(userDocRef).catch(() => null),
        getDoc(doc(db, 'admins', targetUid)).catch(() => null),
        getDoc(doc(db, 'publicAdmins', targetUid)).catch(() => null),
      ]);

    const existingUserData =
      existingUserSnap && existingUserSnap.exists()
        ? (existingUserSnap.data() as Partial<UserProfile>)
        : null;
    const existingAdminData =
      existingAdminSnap && existingAdminSnap.exists()
        ? (existingAdminSnap.data() as Partial<AdminRecord>)
        : null;
    const existingPublicData =
      existingPublicSnap && existingPublicSnap.exists()
        ? (existingPublicSnap.data() as Partial<PublicAdminRecord>)
        : null;

    const cleanUsername =
      existingUserData?.username ||
      (phoneNumber
        ? `admin_${phoneNumber}`
        : authEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    const createdTimestamp =
      existingPublicData?.createdAt ||
      existingAdminData?.createdAt ||
      existingUserData?.createdAt ||
      existingLocal?.createdAt ||
      nowIso;

    const resolvedPhone = phoneNumber || existingUserData?.phoneNumber || '';

    const userPayload: UserProfile = {
      uid: targetUid,
      email: authEmail,
      displayName: cleanName,
      username: cleanUsername,
      phoneNumber: resolvedPhone,
      freeFireUid: existingUserData?.freeFireUid || '',
      inGameName: existingUserData?.inGameName || cleanName,
      role: assignedRole,
      isAdmin: true,
      walletBalance: Number(existingUserData?.walletBalance || 0),
      pendingBalance: Number(existingUserData?.pendingBalance || 0),
      totalDeposited: Number(existingUserData?.totalDeposited || 0),
      spentFromDeposited: Number(existingUserData?.spentFromDeposited || 0),
      totalWithdrawn: Number(existingUserData?.totalWithdrawn || 0),
      totalEarnings: Number(existingUserData?.totalEarnings || 0),
      spentFromWinning: Number(existingUserData?.spentFromWinning || 0),
      totalKills: Number(existingUserData?.totalKills || 0),
      totalWins: Number(existingUserData?.totalWins || 0),
      totalMatches: Number(existingUserData?.totalMatches || 0),
      totalTournaments: Number(existingUserData?.totalTournaments || 0),
      createdAt: existingUserData?.createdAt || createdTimestamp,
      updatedAt: nowIso,
    };

    // Collect existing admins' avatar IDs so the new Admin automatically gets a unique unused Cartoon Avatar
    const existingAvatarCandidates: Array<{ avatarId?: string | null }> = [];
    try {
      const [allAdminsSnap, allPubSnap] = await Promise.all([
        getDocs(collection(db, 'admins')).catch(() => null),
        getDocs(collection(db, 'publicAdmins')).catch(() => null),
      ]);
      const seenUids = new Set<string>();
      allAdminsSnap?.forEach((d) => {
        if (d.id === targetUid) return;
        seenUids.add(d.id);
        existingAvatarCandidates.push({
          avatarId: (d.data() as Partial<AdminRecord>)?.avatarId || null,
        });
      });
      allPubSnap?.forEach((d) => {
        if (d.id === targetUid || seenUids.has(d.id)) return;
        seenUids.add(d.id);
        existingAvatarCandidates.push({
          avatarId: (d.data() as Partial<PublicAdminRecord>)?.avatarId || null,
        });
      });
      readLocalAdmins().forEach((loc) => {
        if (loc.uid === targetUid || seenUids.has(loc.uid)) return;
        seenUids.add(loc.uid);
        existingAvatarCandidates.push({ avatarId: loc.avatarId || null });
      });
    } catch {
      readLocalAdmins().forEach((loc) => {
        if (loc.uid !== targetUid) {
          existingAvatarCandidates.push({ avatarId: loc.avatarId || null });
        }
      });
    }

    const assignedAvatarId =
      existingAdminData?.avatarId ||
      existingPublicData?.avatarId ||
      existingLocal?.avatarId ||
      pickNextUniqueAdminAvatarId(existingAvatarCandidates, params.avatarId);

    const adminRecord: AdminRecord = {
      uid: targetUid,
      displayName: cleanName,
      phoneNumber: resolvedPhone,
      email: authEmail,
      role: assignedRole,
      avatarId: assignedAvatarId,
      addedBy: params.createdByUid,
      createdAt: createdTimestamp,
      updatedAt: nowIso,
    };

    // Save in Local Store + Local Public Directory immediately
    upsertLocalAdmin({
      uid: targetUid,
      displayName: cleanName,
      phoneNumber: resolvedPhone,
      email: authEmail,
      passwordHash,
      role: assignedRole,
      avatarId: assignedAvatarId,
      addedBy: params.createdByUid,
      createdAt: createdTimestamp,
      updatedAt: nowIso,
    });
    upsertLocalPublicAdmin({
      id: targetUid,
      displayName: cleanName.slice(0, 100),
      avatarId: assignedAvatarId,
      createdAt: createdTimestamp,
    });

    // Save atomically in Firestore
    const batch = writeBatch(db);
    batch.set(doc(db, 'publicMeta', 'adminBootstrap'), {
      hasAdmin: true,
      updatedAt: nowIso,
    });

    if (resolvedPhone) {
      batch.set(doc(db, 'adminCredentials', resolvedPhone), {
        phoneNumber: resolvedPhone,
        uid: targetUid,
        displayName: cleanName.slice(0, 100),
        passwordHash,
        role: assignedRole,
        createdAt: createdTimestamp,
        updatedAt: nowIso,
      });
      batch.set(doc(db, 'phoneAuthLookup', resolvedPhone), {
        phoneNumber: resolvedPhone,
        authEmail,
        updatedAt: nowIso,
      });
    }

    batch.set(userDocRef, userPayload, { merge: true });
    batch.set(doc(db, 'admins', targetUid), adminRecord);

    // Sync non-PII display name & unique cartoon avatar to /publicAdmins so "Our Admins" shows it live
    batch.set(doc(db, 'publicAdmins', targetUid), {
      id: targetUid,
      displayName: cleanName.slice(0, 100),
      avatarId: assignedAvatarId,
      createdAt: createdTimestamp,
    });

    batch.set(
      doc(db, 'leaderboard', targetUid),
      {
        uid: targetUid,
        displayName: cleanName,
        inGameName: userPayload.inGameName || cleanName,
        freeFireUid: userPayload.freeFireUid || '',
        teamName: existingUserData?.teamName || '',
        avatarUrl: existingUserData?.avatarUrl || '',
        totalEarnings: userPayload.totalEarnings,
        totalWins: userPayload.totalWins,
        totalKills: userPayload.totalKills,
        totalMatches: userPayload.totalMatches,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    batch.set(doc(db, 'auditLogs', logId), {
      id: logId,
      adminId: params.createdByUid,
      adminEmail: params.createdByEmail,
      action: 'ADD_ADMIN',
      details: `Added ${cleanName} (${resolvedPhone || authEmail}) as Admin`,
      createdAt: nowIso,
    });

    await batch.commit();

    return {
      success: true,
      admin: adminRecord,
      message: `${cleanName} (${resolvedPhone || authEmail}) added as Admin successfully!`,
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(err, OperationType.WRITE, 'admins');
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Failed to add new admin.' };
  }
}

export interface RemoveAdminParams {
  targetAdmin: AdminRecord;
  actingUid: string;
  actingEmail: string;
  isActingAdmin: boolean;
  isActingSuperAdmin?: boolean;
  isTargetFirstAdmin?: boolean;
}

export async function removeAdmin(
  params: RemoveAdminParams
): Promise<{ success: boolean; message: string }> {
  const isActorMainAdmin =
    Boolean(params.isActingSuperAdmin) ||
    params.actingEmail.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  if (!params.isActingAdmin || !isActorMainAdmin) {
    return {
      success: false,
      message: 'Access denied. Only Admin 1 (Main Admin) can delete another Admin.',
    };
  }

  const { targetAdmin, actingUid, actingEmail } = params;
  if (!targetAdmin?.uid) {
    return { success: false, message: 'Invalid admin selected.' };
  }

  if (
    params.isTargetFirstAdmin ||
    targetAdmin.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ||
    (params.isTargetFirstAdmin === undefined && targetAdmin.role === 'SUPER_ADMIN')
  ) {
    return {
      success: false,
      message: 'Admin 1 (Main Admin) cannot be deleted.',
    };
  }

  if (targetAdmin.uid === actingUid) {
    return {
      success: false,
      message: 'Admin 1 cannot delete their own account.',
    };
  }

  try {
    removeLocalAdminByUid(targetAdmin.uid);
    removeLocalPublicAdminById(targetAdmin.uid);

    const nowIso = new Date().toISOString();

    const userRef = doc(db, 'users', targetAdmin.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? (userSnap.data() as Partial<UserProfile>) : null;

    const credPhonesToDelete = new Set<string>();
    const addCandidatePhone = (raw?: string) => {
      if (!raw) return;
      const norm = normalizePhoneNumber(raw);
      if (norm && isValidPhoneNumber(norm)) {
        credPhonesToDelete.add(norm);
      }
    };

    addCandidatePhone(targetAdmin.phoneNumber);
    addCandidatePhone(userData?.phoneNumber);
    const syntheticPhoneMatch = targetAdmin.email
      ?.toLowerCase()
      .match(/^admin\.([0-9]{6,20})@txtourbd\.app$/);
    if (syntheticPhoneMatch?.[1]) {
      addCandidatePhone(syntheticPhoneMatch[1]);
    }

    // Ensure secondary admin doc is downgraded from stale SUPER_ADMIN before delete (satisfies Firestore rules)
    try {
      const targetAdminDocSnap = await getDoc(doc(db, 'admins', targetAdmin.uid));
      const preBatch = writeBatch(db);
      let needsPreBatch = false;
      if (
        targetAdminDocSnap.exists() &&
        targetAdminDocSnap.data()?.role === 'SUPER_ADMIN'
      ) {
        preBatch.update(doc(db, 'admins', targetAdmin.uid), {
          role: 'ADMIN',
          updatedAt: nowIso,
        });
        needsPreBatch = true;
      }
      for (const phoneKey of credPhonesToDelete) {
        const credSnap = await getDoc(doc(db, 'adminCredentials', phoneKey));
        if (credSnap.exists() && credSnap.data()?.role === 'SUPER_ADMIN') {
          preBatch.update(doc(db, 'adminCredentials', phoneKey), {
            role: 'ADMIN',
            updatedAt: nowIso,
          });
          needsPreBatch = true;
        }
      }
      if (needsPreBatch) {
        await preBatch.commit();
      }
    } catch {
      // continue with main delete batch
    }

    const batch = writeBatch(db);

    batch.delete(doc(db, 'admins', targetAdmin.uid));
    batch.delete(doc(db, 'publicAdmins', targetAdmin.uid));

    credPhonesToDelete.forEach((phoneKey) => {
      batch.delete(doc(db, 'adminCredentials', phoneKey));
    });

    if (userSnap.exists()) {
      batch.update(userRef, {
        role: 'PLAYER',
        isAdmin: false,
        updatedAt: nowIso,
      });
    }

    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    batch.set(doc(db, 'auditLogs', logId), {
      id: logId,
      adminId: actingUid,
      adminEmail: actingEmail,
      action: 'REMOVE_ADMIN',
      details: `Removed admin access for ${targetAdmin.displayName} (${
        targetAdmin.phoneNumber || targetAdmin.email
      })`,
      createdAt: nowIso,
    });

    await batch.commit();

    return {
      success: true,
      message: `${targetAdmin.displayName} has been removed from Admin access.`,
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('Missing or insufficient permissions')
    ) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${targetAdmin.uid}`);
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Failed to remove admin.' };
  }
}

export interface UpdateAdminAvatarParams {
  targetAdmin: AdminRecord;
  avatarId: string;
  actingUid: string;
  actingEmail: string;
  isActingAdmin: boolean;
  isActingSuperAdmin?: boolean;
}

export async function updateAdminAvatar(
  params: UpdateAdminAvatarParams
): Promise<{ success: boolean; message: string }> {
  const { targetAdmin, avatarId, actingUid, actingEmail, isActingAdmin, isActingSuperAdmin } =
    params;

  const isSelf = targetAdmin.uid === actingUid;
  const isActorMainAdmin =
    Boolean(isActingSuperAdmin) ||
    actingEmail.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  if (!isActingAdmin || (!isSelf && !isActorMainAdmin)) {
    return {
      success: false,
      message: 'Access denied. Only Main Admin or the Admin themselves can change this avatar.',
    };
  }

  if (!ADMIN_CARTOON_AVATARS.some((a) => a.id === avatarId)) {
    return { success: false, message: 'Invalid Cartoon Avatar selected.' };
  }

  const nowIso = new Date().toISOString();
  const cleanName = (targetAdmin.displayName || 'Admin').trim().slice(0, 100) || 'Admin';

  // Update local caches immediately
  const localAdmins = readLocalAdmins();
  const localIdx = localAdmins.findIndex((a) => a.uid === targetAdmin.uid);
  if (localIdx >= 0) {
    localAdmins[localIdx] = { ...localAdmins[localIdx], avatarId, updatedAt: nowIso };
    writeLocalAdmins(localAdmins);
  }
  upsertLocalPublicAdmin({
    id: targetAdmin.uid,
    displayName: cleanName,
    avatarId,
    createdAt: targetAdmin.createdAt || nowIso,
  });

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'admins', targetAdmin.uid),
      {
        uid: targetAdmin.uid,
        displayName: cleanName,
        phoneNumber: targetAdmin.phoneNumber || '',
        email: targetAdmin.email || '',
        role: targetAdmin.role,
        avatarId,
        createdAt: targetAdmin.createdAt || nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    batch.set(
      doc(db, 'publicAdmins', targetAdmin.uid),
      {
        id: targetAdmin.uid,
        displayName: cleanName,
        avatarId,
        createdAt: targetAdmin.createdAt || nowIso,
      },
      { merge: true }
    );

    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    batch.set(doc(db, 'auditLogs', logId), {
      id: logId,
      adminId: actingUid,
      adminEmail: actingEmail,
      action: 'UPDATE_ADMIN_AVATAR',
      details: `Updated Cartoon Avatar (${avatarId}) for Admin ${cleanName}`,
      createdAt: nowIso,
    });

    await batch.commit();
    return {
      success: true,
      message: `${cleanName}-এর Cartoon Avatar সফলভাবে পরিবর্তন করা হয়েছে!`,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Failed to update admin avatar.' };
  }
}


