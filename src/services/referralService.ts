import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification, UserProfile, WalletTransaction } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import { getWalletBreakdown } from './walletService';

export const REFERRAL_BONUS_AMOUNT = 10;
const PENDING_REFER_CODE_KEY = 'tx_pending_refer_code';

export function normalizeReferCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateCandidateCode(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `TX${randomDigits}`;
}

export async function generateUniqueReferCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate =
      attempt < 8
        ? generateCandidateCode()
        : `TX${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      const q = query(
        collection(db, 'users'),
        where('referCode', '==', candidate),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return candidate;
      }
    } catch {
      return candidate;
    }
  }
  return `TX${Date.now().toString().slice(-5)}`;
}

export async function ensureUserReferCode(
  userProfile: UserProfile
): Promise<string> {
  if (userProfile.referCode && normalizeReferCode(userProfile.referCode)) {
    return normalizeReferCode(userProfile.referCode);
  }

  const generated = await generateUniqueReferCode();
  try {
    await updateDoc(doc(db, 'users', userProfile.uid), {
      referCode: generated,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  }
  return generated;
}

export async function findUserByReferCode(
  rawCode: string
): Promise<UserProfile | null> {
  const code = normalizeReferCode(rawCode);
  if (!code || code.length < 4) return null;

  try {
    const q = query(
      collection(db, 'users'),
      where('referCode', '==', code),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { ...(docSnap.data() as UserProfile), uid: docSnap.id };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'users');
  }
}

export async function applyReferralBonus(params: {
  newUserUid: string;
  newUserName: string;
  referCode: string;
}): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const code = normalizeReferCode(params.referCode);
  if (!code) {
    return { success: false, message: 'Please enter a valid Refer Code.' };
  }

  const referrer = await findUserByReferCode(code);
  if (!referrer) {
    return { success: false, message: 'Invalid Refer Code! এই কোডটি খুঁজে পাওয়া যায়নি।' };
  }

  if (referrer.uid === params.newUserUid) {
    return { success: false, message: 'নিজের Refer Code ব্যবহার করা যাবে না।' };
  }

  if (referrer.referredBy === params.newUserUid) {
    return { success: false, message: 'Circular referral is not allowed.' };
  }

  const nowIso = new Date().toISOString();
  const newUserRef = doc(db, 'users', params.newUserUid);
  const referrerRef = doc(db, 'users', referrer.uid);

  try {
    await runTransaction(db, async (txn) => {
      const [newUserSnap, referrerSnap] = await Promise.all([
        txn.get(newUserRef),
        txn.get(referrerRef),
      ]);

      if (!newUserSnap.exists()) {
        throw new Error('User account not found.');
      }
      if (!referrerSnap.exists()) {
        throw new Error('Referrer account not found.');
      }

      const newUserData = newUserSnap.data() as UserProfile;
      if (newUserData.referredBy) {
        throw new Error('আপনি ইতিমধ্যেই একটি Refer Code ব্যবহার করেছেন।');
      }

      const referrerData = referrerSnap.data() as UserProfile;
      const breakdown = getWalletBreakdown(referrerData);
      const nextWalletBalance = breakdown.availableBalance + REFERRAL_BONUS_AMOUNT;
      const nextTotalDeposited =
        breakdown.totalDepositedLifetime + REFERRAL_BONUS_AMOUNT;
      const nextReferralCount = Number(referrerData.referralCount || 0) + 1;
      const nextReferralEarnings =
        Number(referrerData.referralEarnings || 0) + REFERRAL_BONUS_AMOUNT;

      txn.update(referrerRef, {
        walletBalance: nextWalletBalance,
        totalDeposited: nextTotalDeposited,
        referralCount: nextReferralCount,
        referralEarnings: nextReferralEarnings,
        updatedAt: nowIso,
      });

      txn.update(newUserRef, {
        referredBy: referrer.uid,
        referredByCode: code,
        updatedAt: nowIso,
      });

      const trxId = 'trx_ref_' + params.newUserUid.slice(0, 10) + '_' + Date.now();
      const trxData: WalletTransaction = {
        id: trxId,
        userId: referrer.uid,
        type: 'DEPOSIT',
        amount: REFERRAL_BONUS_AMOUNT,
        status: 'COMPLETED',
        referenceId: code,
        description: `Refer & Earn Bonus (+৳${REFERRAL_BONUS_AMOUNT} for inviting ${params.newUserName})`,
        descriptionBn: `রেফার বোনাস (+৳${REFERRAL_BONUS_AMOUNT}) - বন্ধু ${params.newUserName} জয়েন করেছে`,
        balanceAfter: nextWalletBalance,
        createdAt: nowIso,
      };
      txn.set(doc(db, 'transactions', trxId), trxData);

      const notifId = 'notif_ref_' + Math.random().toString(36).substring(2, 10);
      const notifData: AppNotification = {
        id: notifId,
        userId: referrer.uid,
        title: `Refer Bonus! +৳${REFERRAL_BONUS_AMOUNT} Earned`,
        titleBn: `রেফার বোনাস! +৳${REFERRAL_BONUS_AMOUNT} পেয়েছেন`,
        message: `${params.newUserName} joined using your Refer Code (${code}). ৳${REFERRAL_BONUS_AMOUNT} has been added to your Wallet!`,
        messageBn: `${params.newUserName} আপনার রেফার কোড (${code}) দিয়ে জয়েন করেছে। আপনার ওয়ালেটে ৳${REFERRAL_BONUS_AMOUNT} যোগ হয়েছে!`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      };
      txn.set(doc(db, 'notifications', notifId), notifData);
    });

    return {
      success: true,
      message: `Refer Code সফলভাবে প্রয়োগ হয়েছে! ${referrer.inGameName || referrer.displayName} ৳${REFERRAL_BONUS_AMOUNT} বোনাস পেয়েছেন।`,
      referrerName: referrer.inGameName || referrer.displayName,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `users/${referrer.uid}`);
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Refer Code প্রয়োগ করতে সমস্যা হয়েছে।' };
  }
}

export async function fetchReferredFriends(
  referrerUid: string
): Promise<UserProfile[]> {
  if (!referrerUid) return [];
  try {
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', referrerUid)
    );
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as UserProfile), uid: d.id });
    });
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'users');
  }
}

export function capturePendingReferCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref');
    if (raw) {
      const cleaned = normalizeReferCode(raw);
      if (cleaned.length >= 4) {
        localStorage.setItem(PENDING_REFER_CODE_KEY, cleaned);
        return cleaned;
      }
    }
  } catch {}
  return null;
}

export function getPendingReferCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(PENDING_REFER_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function clearPendingReferCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_REFER_CODE_KEY);
  } catch {}
}
