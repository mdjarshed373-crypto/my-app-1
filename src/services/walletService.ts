import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  DepositRequest,
  WithdrawalRequest,
  WalletTransaction,
  PaymentMethod,
  AppNotification,
  UserProfile,
} from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import { isUserCurrentlyBanned, getBanErrorMessage } from './banService';

export interface WalletBreakdown {
  depositedAmount: number;
  winningAmount: number;
  availableBalance: number;
  totalDepositedLifetime: number;
  totalWinningLifetime: number;
}

export function getWalletBreakdown(
  userProfile?: Partial<UserProfile> | null,
  options?: {
    depositRequests?: DepositRequest[];
    withdrawalRequests?: WithdrawalRequest[];
    transactions?: WalletTransaction[];
  }
): WalletBreakdown {
  const rawTotalDeposited = Number(userProfile?.totalDeposited || 0);
  const rawTotalEarnings = Number(userProfile?.totalEarnings || 0);
  const rawWalletBalance = Number(userProfile?.walletBalance || 0);

  const approvedDepositsFromReqs =
    options?.depositRequests
      ?.filter((d) => d.status === 'APPROVED')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0;

  const completedDepositsFromTrx =
    options?.transactions
      ?.filter((t) => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  const completedPrizesFromTrx =
    options?.transactions
      ?.filter((t) => t.type === 'PRIZE' && t.status === 'COMPLETED')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  const hasExplicitSpentFields =
    userProfile?.spentFromDeposited !== undefined ||
    userProfile?.spentFromWinning !== undefined;

  // If user doc has explicit totalDeposited / totalEarnings, use them unless untouched (0) while approved records exist
  const totalDepositedLifetime =
    rawTotalDeposited > 0
      ? rawTotalDeposited
      : Math.max(rawTotalDeposited, approvedDepositsFromReqs, completedDepositsFromTrx);

  const totalWinningLifetime =
    rawTotalEarnings > 0
      ? rawTotalEarnings
      : Math.max(rawTotalEarnings, completedPrizesFromTrx);

  if (hasExplicitSpentFields) {
    const spentDep = Math.max(0, Number(userProfile?.spentFromDeposited || 0));
    const spentWin = Math.max(0, Number(userProfile?.spentFromWinning || 0));
    const depositedAmount = Math.max(0, totalDepositedLifetime - spentDep);
    const winningAmount = Math.max(0, totalWinningLifetime - spentWin);
    return {
      depositedAmount,
      winningAmount,
      availableBalance: depositedAmount + winningAmount,
      totalDepositedLifetime,
      totalWinningLifetime,
    };
  }

  const combinedLifetime = totalDepositedLifetime + totalWinningLifetime;

  if (combinedLifetime === 0 && rawWalletBalance > 0) {
    return {
      depositedAmount: rawWalletBalance,
      winningAmount: 0,
      availableBalance: rawWalletBalance,
      totalDepositedLifetime: rawWalletBalance,
      totalWinningLifetime: 0,
    };
  }

  if (combinedLifetime > rawWalletBalance) {
    const hasSpendHistory =
      (options?.withdrawalRequests?.some((w) => w.status !== 'REJECTED') ?? false) ||
      (options?.transactions?.some(
        (t) =>
          t.type === 'ENTRY_FEE' ||
          (t.type === 'WITHDRAWAL' && t.status !== 'REJECTED')
      ) ??
        false);

    if (hasSpendHistory || (options === undefined && rawWalletBalance > 0)) {
      const implicitSpent = combinedLifetime - rawWalletBalance;
      const spentDep = Math.min(totalDepositedLifetime, implicitSpent);
      const spentWin = Math.min(totalWinningLifetime, implicitSpent - spentDep);
      const depositedAmount = Math.max(0, totalDepositedLifetime - spentDep);
      const winningAmount = Math.max(0, totalWinningLifetime - spentWin);
      return {
        depositedAmount,
        winningAmount,
        availableBalance: depositedAmount + winningAmount,
        totalDepositedLifetime,
        totalWinningLifetime,
      };
    }

    return {
      depositedAmount: totalDepositedLifetime,
      winningAmount: totalWinningLifetime,
      availableBalance: combinedLifetime,
      totalDepositedLifetime,
      totalWinningLifetime,
    };
  }

  const extraBalance = Math.max(0, rawWalletBalance - combinedLifetime);
  const depositedAmount = totalDepositedLifetime + extraBalance;
  const winningAmount = totalWinningLifetime;
  return {
    depositedAmount,
    winningAmount,
    availableBalance: depositedAmount + winningAmount,
    totalDepositedLifetime,
    totalWinningLifetime,
  };
}

export async function submitDepositRequest(
  userId: string,
  userName: string,
  userEmail: string,
  method: PaymentMethod,
  amount: number,
  senderNumber: string,
  transactionId: string,
  screenshotUrl?: string
): Promise<{ success: boolean; message: string }> {
  if (!amount || isNaN(amount) || amount < 10) {
    return { success: false, message: 'Minimum deposit is 10 TK (মিনিমাম ১০ টাকা)।' };
  }
  if (amount > 50000) {
    return { success: false, message: 'সর্বোচ্চ ডিপোজিট ৫০,০০০ টাকা।' };
  }
  const cleanSender = senderNumber.trim();
  if (!cleanSender || cleanSender.length < 6) {
    return {
      success: false,
      message: 'অনুগ্রহ করে যে নাম্বার থেকে টাকা পাঠিয়েছেন সেই Sender Number লিখুন।',
    };
  }
  const cleanTrx = transactionId.trim().toUpperCase();
  if (!cleanTrx || cleanTrx.length < 3) {
    return {
      success: false,
      message: 'অনুগ্রহ করে সঠিক Transaction ID (TrxID) প্রদান করুন।',
    };
  }

  try {
    const requestId = 'dep_' + Math.random().toString(36).substring(2, 9);
    const reqDocRef = doc(db, 'depositRequests', requestId);
    const userDocRef = doc(db, 'users', userId);
    const nowIso = new Date().toISOString();

    await runTransaction(db, async (txn) => {
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('ব্যবহারকারী পাওয়া যায়নি!');
      }

      const userData = userSnap.data();
      const currentBalance = Number(userData.walletBalance || 0);
      const currentPending = Number(userData.pendingBalance || 0);

      // 1. Create PENDING deposit request for Admin review (DO NOT credit walletBalance yet)
      const depositData: DepositRequest = {
        id: requestId,
        userId,
        userName,
        userEmail,
        method,
        amount,
        senderNumber: cleanSender,
        transactionId: cleanTrx,
        screenshotUrl: screenshotUrl || '',
        status: 'PENDING',
        createdAt: nowIso,
      };
      txn.set(reqDocRef, depositData);

      // 2. Track in pendingBalance only until Admin approves
      txn.update(userDocRef, {
        pendingBalance: currentPending + amount,
        updatedAt: nowIso,
      });

      // 3. Create PENDING deposit entry in Transaction History
      const trxId = 'trx_d_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        referenceId: cleanTrx,
        description: `Add Money via ${method} (TrxID: ${cleanTrx} • Sender: ${cleanSender})`,
        descriptionBn: `${method}-এ ৳${amount} Add Money রিকোয়েস্ট (TrxID: ${cleanTrx} • নম্বর: ${cleanSender})`,
        balanceAfter: currentBalance,
        createdAt: nowIso,
      };
      txn.set(trxDocRef, trxData);
    });

    return {
      success: true,
      message:
        'ডিপোজিট রিকোয়েস্ট সফলভাবে সাবমিট হয়েছে (Pending)! এডমিন অ্যাপ্রুভ করলে আপনার ওয়ালেটে ব্যালেন্স যোগ হবে।',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'depositRequests');
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'ডিপোজিট সাবমিট করতে সমস্যা হয়েছে।' };
  }
}

export async function submitAutoVerifiedDeposit(
  userId: string,
  userName: string,
  userEmail: string,
  method: PaymentMethod,
  amount: number,
  transactionId: string
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  if (!amount || isNaN(amount) || amount <= 0) {
    return { success: false, message: 'Amount must be more than 0.' };
  }
  if (amount > 50000) {
    return { success: false, message: 'Maximum deposit is ৳50,000.' };
  }
  const cleanTrx = transactionId.trim().toUpperCase();
  if (!cleanTrx || cleanTrx.length < 8) {
    return {
      success: false,
      message: 'TrxID must be at least 8 characters.',
    };
  }

  try {
    const requestId = 'dep_' + Math.random().toString(36).substring(2, 9);
    const reqDocRef = doc(db, 'depositRequests', requestId);
    const userDocRef = doc(db, 'users', userId);
    const nowIso = new Date().toISOString();

    const newBalance = await runTransaction(db, async (txn) => {
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('User account not found!');
      }

      const userData = userSnap.data() as Partial<UserProfile>;
      const breakdown = getWalletBreakdown(userData);
      const nextTotalDeposited = breakdown.totalDepositedLifetime + amount;
      const nextWalletBalance = breakdown.availableBalance + amount;

      // 1. Instantly add deposit amount to user's main walletBalance & totalDeposited
      txn.update(userDocRef, {
        walletBalance: nextWalletBalance,
        totalDeposited: nextTotalDeposited,
        updatedAt: nowIso,
      });

      // 2. Save approved deposit record in depositRequests
      const depositData: DepositRequest = {
        id: requestId,
        userId,
        userName,
        userEmail,
        method,
        amount,
        senderNumber: '',
        transactionId: cleanTrx,
        screenshotUrl: '',
        status: 'APPROVED',
        adminNote: 'Auto Verified',
        createdAt: nowIso,
        processedAt: nowIso,
      };
      txn.set(reqDocRef, depositData);

      // 3. Save completed deposit transaction in Transaction History
      const trxId = 'trx_d_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId,
        type: 'DEPOSIT',
        amount,
        status: 'COMPLETED',
        referenceId: cleanTrx,
        description: `Deposit via ${method} (TrxID: ${cleanTrx})`,
        descriptionBn: `${method} ডিপোজিট ৳${amount} (TrxID: ${cleanTrx})`,
        balanceAfter: nextWalletBalance,
        createdAt: nowIso,
      };
      txn.set(trxDocRef, trxData);

      // 4. Create notification
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId,
        title: 'Deposit Successful!',
        titleBn: 'ডিপোজিট সফল হয়েছে!',
        message: `Deposit Successful! ৳${amount} Added`,
        messageBn: `Deposit Successful! ৳${amount} Added`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return nextWalletBalance;
    });

    return {
      success: true,
      message: `Deposit Successful! ৳${amount} Added`,
      newBalance,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'depositRequests');
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'Failed to verify deposit.' };
  }
}

export const MIN_WITHDRAW_AMOUNT = 100;
export const MAX_DAILY_WITHDRAW_AMOUNT = 400;

export function isSameLocalDay(createdAt?: unknown, refDate: Date = new Date()): boolean {
  if (!createdAt) return false;
  let d: Date;
  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    d = new Date(createdAt);
  } else if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === 'function'
  ) {
    d = (createdAt as { toDate: () => Date }).toDate();
  } else {
    return false;
  }
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === refDate.getFullYear() &&
    d.getMonth() === refDate.getMonth() &&
    d.getDate() === refDate.getDate()
  );
}

export function calculateTodayWithdrawn(
  requests: WithdrawalRequest[],
  refDate: Date = new Date()
): number {
  return requests.reduce((sum, req) => {
    if (req.status === 'REJECTED') return sum;
    if (!isSameLocalDay(req.createdAt, refDate)) return sum;
    return sum + Number(req.amount || 0);
  }, 0);
}

export async function submitWithdrawalRequest(
  userId: string,
  userName: string,
  userEmail: string,
  method: PaymentMethod,
  accountNumber: string,
  amount: number,
  inGameName?: string,
  options?: {
    requestId?: string;
    nowIso?: string;
    knownTodayWithdrawn?: number;
  }
): Promise<{ success: boolean; message: string }> {
  if (method !== 'bKash' && method !== 'Nagad') {
    return { success: false, message: 'Only bKash and Nagad are supported.' };
  }
  if (!amount || isNaN(amount) || amount < MIN_WITHDRAW_AMOUNT) {
    return { success: false, message: 'Minimum Withdraw 100 TK' };
  }
  const cleanAccount = accountNumber.trim();
  if (!cleanAccount || cleanAccount.length < 6) {
    return { success: false, message: 'Please enter a valid Mobile Number.' };
  }

  if (typeof options?.knownTodayWithdrawn === 'number') {
    const knownToday = options.knownTodayWithdrawn;
    if (
      knownToday >= MAX_DAILY_WITHDRAW_AMOUNT ||
      knownToday + amount > MAX_DAILY_WITHDRAW_AMOUNT
    ) {
      return {
        success: false,
        message: 'Daily limit reached. You can withdraw maximum 400 TK per day.',
      };
    }
  } else {
    try {
      const existingWithdrawals = await fetchWithdrawalRequests(userId);
      const todayWithdrawn = calculateTodayWithdrawn(existingWithdrawals);
      if (
        todayWithdrawn >= MAX_DAILY_WITHDRAW_AMOUNT ||
        todayWithdrawn + amount > MAX_DAILY_WITHDRAW_AMOUNT
      ) {
        return {
          success: false,
          message: 'Daily limit reached. You can withdraw maximum 400 TK per day.',
        };
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, 'withdrawalRequests');
      }
    }
  }

  const requestId =
    options?.requestId || 'with_' + Math.random().toString(36).substring(2, 9);
  const reqDocRef = doc(db, 'withdrawalRequests', requestId);
  const userDocRef = doc(db, 'users', userId);
  const nowIso = options?.nowIso || new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('ব্যবহারকারী পাওয়া যায়নি!');
      }

      const userData = userSnap.data() as Partial<UserProfile>;
      if (isUserCurrentlyBanned(userData)) {
        throw new Error(getBanErrorMessage(userData));
      }
      const breakdown = getWalletBreakdown(userData);
      const winningBalance = breakdown.winningAmount;
      const availableBalance = breakdown.availableBalance;

      if (winningBalance < MIN_WITHDRAW_AMOUNT) {
        throw new Error('Minimum 100 TK Withdraw korte parbe');
      }

      if (winningBalance < amount) {
        throw new Error(
          `Insufficient Winning Balance. Available Winning Balance is ${winningBalance} TK.`
        );
      }

      if (availableBalance < amount) {
        throw new Error(`Insufficient balance. Available balance is ${availableBalance} TK.`);
      }

      const deductFromWinning = amount;
      const deductFromDeposited = 0;
      const nextWinningBalance = winningBalance - deductFromWinning;
      const nextDepositedBalance = breakdown.depositedAmount;
      const newBalance = nextDepositedBalance + nextWinningBalance;
      const baselineSpentWin = Math.max(
        0,
        breakdown.totalWinningLifetime - breakdown.winningAmount
      );
      const baselineSpentDep = Math.max(
        0,
        breakdown.totalDepositedLifetime - breakdown.depositedAmount
      );
      const nextSpentFromWinning = baselineSpentWin + deductFromWinning;
      const nextSpentFromDeposited = baselineSpentDep;

      // Deduct from Winning Balance & walletBalance immediately and send to Admin as PENDING
      txn.update(userDocRef, {
        walletBalance: newBalance,
        totalDeposited: breakdown.totalDepositedLifetime,
        totalEarnings: breakdown.totalWinningLifetime,
        spentFromDeposited: nextSpentFromDeposited,
        spentFromWinning: nextSpentFromWinning,
        updatedAt: nowIso,
      });

      const resolvedName = String(userData.displayName || userName || 'Player').trim();
      const resolvedIgn = String(userData.inGameName || inGameName || '').trim();

      // Create PENDING withdrawal request for Admin approval
      const withdrawalData: WithdrawalRequest = {
        id: requestId,
        userId,
        userName: resolvedName,
        ...(resolvedIgn ? { inGameName: resolvedIgn } : {}),
        userEmail,
        method,
        accountNumber: cleanAccount,
        amount,
        deductedFromDeposited: deductFromDeposited,
        deductedFromWinning: deductFromWinning,
        status: 'PENDING',
        createdAt: nowIso,
      };
      txn.set(reqDocRef, withdrawalData);

      // Create PENDING withdrawal entry in Transaction History
      const trxId = 'trx_w_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId,
        type: 'WITHDRAWAL',
        amount,
        status: 'PENDING',
        referenceId: requestId,
        description: `Withdraw via ${method} (${cleanAccount})`,
        descriptionBn: `${method} (${cleanAccount})-এ ${amount} TK উইথড্র রিকোয়েস্ট`,
        balanceAfter: newBalance,
        createdAt: nowIso,
      };
      txn.set(trxDocRef, trxData);

      return {
        success: true,
        message: `${amount} TK Withdraw সফল হয়েছে! আপনার Wallet থেকে ৳${amount} কেটে Admin-এর কাছে Request পাঠানো হয়েছে।`,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawalRequests');
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'উইথড্র করতে সমস্যা হয়েছে।' };
  }
}

export async function adminApproveDeposit(
  requestId: string,
  adminNote?: string
): Promise<{ success: boolean; message: string }> {
  const reqDocRef = doc(db, 'depositRequests', requestId);
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const reqSnap = await txn.get(reqDocRef);
      if (!reqSnap.exists()) {
        throw new Error('ডিপোজিট রিকোয়েস্ট পাওয়া যায়নি!');
      }
      const req = reqSnap.data() as DepositRequest;
      if (req.status !== 'PENDING') {
        throw new Error(`এই রিকোয়েস্টটি ইতিমধ্যে ${req.status} হয়েছে!`);
      }

      const userDocRef = doc(db, 'users', req.userId);
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('খেলোয়াড় একাউন্ট পাওয়া যায়নি!');
      }

      const userData = userSnap.data() as Partial<UserProfile>;
      const breakdown = getWalletBreakdown(userData);
      const currentPending = Math.max(0, Number(userData.pendingBalance || 0) - req.amount);
      const totalDeposited = Number(userData.totalDeposited || 0) + req.amount;
      const newBalance = breakdown.availableBalance + req.amount;

      // 1. Add money to user walletBalance & totalDeposited
      txn.update(userDocRef, {
        walletBalance: newBalance,
        pendingBalance: currentPending,
        totalDeposited,
        updatedAt: nowIso,
      });

      // 2. Mark deposit request APPROVED
      txn.update(reqDocRef, {
        status: 'APPROVED',
        adminNote: adminNote || 'Approved by Admin',
        processedAt: nowIso,
      });

      // 3. Update transaction log to COMPLETED (shows Approved in Transaction History)
      const trxId = 'trx_d_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId: req.userId,
        type: 'DEPOSIT',
        amount: req.amount,
        status: 'COMPLETED',
        referenceId: req.transactionId,
        description: `Add Money Approved via ${req.method} (TrxID: ${req.transactionId})`,
        descriptionBn: `${req.method}-এ ৳${req.amount} ডিপোজিট অ্যাপ্রুভ হয়েছে (TrxID: ${req.transactionId})`,
        balanceAfter: newBalance,
        createdAt: req.createdAt || nowIso,
      };
      txn.set(trxDocRef, trxData);

      // 4. Notify player
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId: req.userId,
        title: 'Deposit Approved!',
        titleBn: 'ডিপোজিট অনুমোদিত হয়েছে!',
        message: `৳${req.amount} has been added to your wallet balance.`,
        messageBn: `আপনার ওয়ালেটে ৳${req.amount} সফলভাবে যুক্ত হয়েছে।`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return { success: true, message: `ডিপোজিট অ্যাপ্রুভ হয়েছে এবং ৳${req.amount} ওয়ালেটে যোগ হয়েছে।` };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `depositRequests/${requestId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'অনুমোদন করতে ব্যর্থ হয়েছে।' };
  }
}

export async function adminRejectDeposit(
  requestId: string,
  adminNote: string
): Promise<{ success: boolean; message: string }> {
  const reqDocRef = doc(db, 'depositRequests', requestId);
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const reqSnap = await txn.get(reqDocRef);
      if (!reqSnap.exists()) throw new Error('রিকোয়েস্ট পাওয়া যায়নি!');
      const req = reqSnap.data() as DepositRequest;
      if (req.status !== 'PENDING') throw new Error('রিকোয়েস্টটি আর পেন্ডিং নেই!');

      const userDocRef = doc(db, 'users', req.userId);
      const userSnap = await txn.get(userDocRef);
      let currentBalance = 0;
      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentBalance = Number(userData.walletBalance || 0);
        const currentPending = Math.max(0, Number(userData.pendingBalance || 0) - req.amount);
        txn.update(userDocRef, { pendingBalance: currentPending, updatedAt: nowIso });
      }

      txn.update(reqDocRef, {
        status: 'REJECTED',
        adminNote: adminNote || 'Invalid Transaction ID or payment not received',
        processedAt: nowIso,
      });

      // Mark transaction log REJECTED (no money added)
      const trxId = 'trx_d_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId: req.userId,
        type: 'DEPOSIT',
        amount: req.amount,
        status: 'REJECTED',
        referenceId: req.transactionId,
        description: `Add Money Rejected via ${req.method} (TrxID: ${req.transactionId})`,
        descriptionBn: `${req.method}-এ ৳${req.amount} ডিপোজিট বাতিল হয়েছে (TrxID: ${req.transactionId})`,
        balanceAfter: currentBalance,
        createdAt: req.createdAt || nowIso,
      };
      txn.set(trxDocRef, trxData);

      // Notify player
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId: req.userId,
        title: 'Deposit Rejected',
        titleBn: 'ডিপোজিট বাতিল হয়েছে',
        message: `Your deposit request of ৳${req.amount} was rejected: ${adminNote || 'TrxID not matched'}`,
        messageBn: `আপনার ৳${req.amount} ডিপোজিট আবেদন বাতিল করা হয়েছে। কারণ: ${adminNote || 'সঠিক TrxID পাওয়া যায়নি'}`,
        type: 'ALERT',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return { success: true, message: 'ডিপোজিট বাতিল করা হয়েছে (কোনো টাকা যোগ হয়নি)।' };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `depositRequests/${requestId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'বাতিল করতে সমস্যা হয়েছে।' };
  }
}

export async function adminApproveWithdrawal(
  requestId: string,
  adminNote?: string,
  customNowIso?: string
): Promise<{ success: boolean; message: string }> {
  const reqDocRef = doc(db, 'withdrawalRequests', requestId);
  const nowIso = customNowIso || new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const reqSnap = await txn.get(reqDocRef);
      if (!reqSnap.exists()) throw new Error('উইথড্র রিকোয়েস্ট পাওয়া যায়নি!');
      const req = reqSnap.data() as WithdrawalRequest;
      if (req.status !== 'PENDING') throw new Error('রিকোয়েস্টটি আর পেন্ডিং নেই!');

      const userDocRef = doc(db, 'users', req.userId);
      const userSnap = await txn.get(userDocRef);
      let currentBalance = 0;
      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentBalance = Number(userData.walletBalance || 0);
        txn.update(userDocRef, {
          totalWithdrawn: Number(userData.totalWithdrawn || 0) + req.amount,
          updatedAt: nowIso,
        });
      }

      txn.update(reqDocRef, {
        status: 'PAID',
        adminNote: adminNote || 'Approved & Paid by Admin',
        processedAt: nowIso,
      });

      // Update transaction status to COMPLETED (shows Approved in Transaction History)
      const trxId = 'trx_w_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId: req.userId,
        type: 'WITHDRAWAL',
        amount: req.amount,
        status: 'COMPLETED',
        referenceId: requestId,
        description: `Withdraw Approved via ${req.method} (${req.accountNumber})`,
        descriptionBn: `${req.method} (${req.accountNumber})-এ ৳${req.amount} উইথড্র অ্যাপ্রুভ হয়েছে`,
        balanceAfter: currentBalance,
        createdAt: req.createdAt || nowIso,
      };
      txn.set(trxDocRef, trxData);

      // Notify player
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId: req.userId,
        title: 'Withdrawal Approved!',
        titleBn: 'উইথড্র অনুমোদিত হয়েছে!',
        message: `৳${req.amount} has been sent to your ${req.method} account (${req.accountNumber}).`,
        messageBn: `আপনার ${req.method} নম্বরে (${req.accountNumber}) ৳${req.amount} সফলভাবে পাঠিয়ে দেওয়া হয়েছে।`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return { success: true, message: 'উইথড্র সফলভাবে অ্যাপ্রুভ ও পেইড হিসেবে চিহ্নিত হয়েছে।' };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawalRequests/${requestId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'উইথড্র প্রক্রিয়াকরণে সমস্যা হয়েছে।' };
  }
}

export async function adminRejectWithdrawal(
  requestId: string,
  adminNote: string,
  customNowIso?: string
): Promise<{ success: boolean; message: string }> {
  const reqDocRef = doc(db, 'withdrawalRequests', requestId);
  const nowIso = customNowIso || new Date().toISOString();

  try {
    return await runTransaction(db, async (txn) => {
      const reqSnap = await txn.get(reqDocRef);
      if (!reqSnap.exists()) throw new Error('রিকোয়েস্ট পাওয়া যায়নি!');
      const req = reqSnap.data() as WithdrawalRequest;
      if (req.status !== 'PENDING') throw new Error('রিকোয়েস্টটি আর পেন্ডিং নেই!');

      const userDocRef = doc(db, 'users', req.userId);
      const userSnap = await txn.get(userDocRef);
      let refundedBalance = req.amount;
      if (userSnap.exists()) {
        const userData = userSnap.data() as Partial<UserProfile>;
        const breakdown = getWalletBreakdown(userData);
        const refundToWinning =
          typeof req.deductedFromWinning === 'number' ? req.deductedFromWinning : req.amount;
        const refundToDeposited =
          typeof req.deductedFromDeposited === 'number' ? req.deductedFromDeposited : 0;
        const nextSpentFromWinning = Math.max(
          0,
          Number(userData.spentFromWinning || 0) - refundToWinning
        );
        const nextSpentFromDeposited = Math.max(
          0,
          Number(userData.spentFromDeposited || 0) - refundToDeposited
        );
        refundedBalance = breakdown.availableBalance + req.amount;
        txn.update(userDocRef, {
          walletBalance: refundedBalance,
          spentFromDeposited: nextSpentFromDeposited,
          spentFromWinning: nextSpentFromWinning,
          updatedAt: nowIso,
        });
      }

      txn.update(reqDocRef, {
        status: 'REJECTED',
        adminNote: adminNote || 'Incorrect account number or declined',
        processedAt: nowIso,
      });

      const trxId = 'trx_w_' + requestId;
      const trxDocRef = doc(db, 'transactions', trxId);
      const trxData: WalletTransaction = {
        id: trxId,
        userId: req.userId,
        type: 'WITHDRAWAL',
        amount: req.amount,
        status: 'REJECTED',
        referenceId: requestId,
        description: `Withdraw Rejected via ${req.method} (${req.accountNumber})`,
        descriptionBn: `${req.method} (${req.accountNumber})-এ ৳${req.amount} উইথড্র বাতিল ও রিফান্ড`,
        balanceAfter: refundedBalance,
        createdAt: req.createdAt || nowIso,
      };
      txn.set(trxDocRef, trxData);

      // Notify player
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId: req.userId,
        title: 'Withdrawal Declined',
        titleBn: 'উইথড্র বাতিল ও রিফান্ড হয়েছে',
        message: `Your withdrawal of ৳${req.amount} was rejected and refunded to your wallet. Reason: ${adminNote}`,
        messageBn: `আপনার ৳${req.amount} উইথড্র বাতিল করা হয়েছে এবং টাকা ওয়ালেটে ফেরত দেওয়া হয়েছে। কারণ: ${adminNote}`,
        type: 'WARNING',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return { success: true, message: 'উইথড্র বাতিল এবং ব্যালেন্স রিফান্ড করা হয়েছে।' };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `withdrawalRequests/${requestId}`);
    }
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'বাতিল করতে সমস্যা হয়েছে।' };
  }
}

export async function fetchUserTransactions(userId: string): Promise<WalletTransaction[]> {
  try {
    const q = query(collection(db, 'transactions'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: WalletTransaction[] = [];
    snap.forEach((d) => list.push(d.data() as WalletTransaction));
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'transactions');
  }
}

export async function fetchDepositRequests(userId?: string): Promise<DepositRequest[]> {
  try {
    let q = query(collection(db, 'depositRequests'));
    if (userId) {
      q = query(collection(db, 'depositRequests'), where('userId', '==', userId));
    }
    const snap = await getDocs(q);
    const list: DepositRequest[] = [];
    snap.forEach((d) => list.push(d.data() as DepositRequest));
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'depositRequests');
  }
}

export async function fetchWithdrawalRequests(userId?: string): Promise<WithdrawalRequest[]> {
  try {
    let q = query(collection(db, 'withdrawalRequests'));
    if (userId) {
      q = query(collection(db, 'withdrawalRequests'), where('userId', '==', userId));
    }
    const snap = await getDocs(q);
    const list: WithdrawalRequest[] = [];
    snap.forEach((d) => list.push(d.data() as WithdrawalRequest));
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'withdrawalRequests');
  }
}

export function subscribePendingWithdrawals(
  onUpdate: (pending: WithdrawalRequest[]) => void
): () => void {
  const q = query(collection(db, 'withdrawalRequests'), where('status', '==', 'PENDING'));
  return onSnapshot(
    q,
    (snap) => {
      const list: WithdrawalRequest[] = [];
      snap.forEach((d) => list.push(d.data() as WithdrawalRequest));
      list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'withdrawalRequests');
    }
  );
}

export type AdminAddMoneyBalanceType = 'WINNING' | 'DEPOSITED';
export type AdminAddMoneyReason = 'WINNING' | 'SLOT REFUND' | 'BONUS';

export interface AdminAddMoneyParams {
  userId: string;
  amount: number;
  balanceType: AdminAddMoneyBalanceType;
  reason: AdminAddMoneyReason;
  adminName?: string;
}

export async function adminAddMoneyToUser(
  params: AdminAddMoneyParams
): Promise<{ success: boolean; message: string; balanceAfter?: number }> {
  const { userId, amount, balanceType, reason, adminName } = params;

  if (!userId) {
    return { success: false, message: 'ইউজার আইডি পাওয়া যায়নি (User not found)' };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { success: false, message: 'সঠিক টাকার পরিমাণ দিন (Enter valid positive amount)' };
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const nowIso = new Date().toISOString();

    const result = await runTransaction(db, async (txn) => {
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি (User does not exist)');
      }

      const userData = userSnap.data() as UserProfile;
      const currentWalletBalance = Number(userData.walletBalance || 0);
      const newWalletBalance = currentWalletBalance + numAmount;

      const currentTotalDeposited = Number(userData.totalDeposited || 0);
      const currentTotalEarnings = Number(userData.totalEarnings || 0);

      // Updates based on destination balance type
      const updates: Record<string, any> = {
        walletBalance: newWalletBalance,
        updatedAt: nowIso,
      };

      if (balanceType === 'WINNING') {
        updates.totalEarnings = currentTotalEarnings + numAmount;
      } else {
        updates.totalDeposited = currentTotalDeposited + numAmount;
      }

      txn.update(userDocRef, updates);

      // Create transaction record
      const trxId = 'trx_adm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const trxDocRef = doc(db, 'transactions', trxId);

      // Description formatted as requested:
      // "Admin Added +15 Taka - WINNING / SLOT REFUND"
      const descEn = `Admin Added +${numAmount} Taka - ${reason} (${balanceType === 'WINNING' ? 'Winning Balance' : 'Deposited Balance'})`;
      const descBn = `এডমিন যোগ করেছেন +${numAmount} টাকা - ${reason} (${balanceType === 'WINNING' ? 'উইনিং ব্যালেন্স' : 'ডিপোজিট ব্যালেন্স'})`;

      const trxData: WalletTransaction = {
        id: trxId,
        userId: userId,
        type: balanceType === 'WINNING' ? 'PRIZE' : 'DEPOSIT',
        amount: numAmount,
        status: 'COMPLETED',
        referenceId: 'admin_manual_credit',
        description: descEn,
        descriptionBn: descBn,
        balanceAfter: newWalletBalance,
        createdAt: nowIso,
      };
      txn.set(trxDocRef, trxData);

      // Create player notification
      const notifId = 'notif_adm_' + Math.random().toString(36).substring(2, 9);
      const notifRef = doc(db, 'notifications', notifId);
      const notif: AppNotification = {
        id: notifId,
        userId: userId,
        title: `৳${numAmount} Added by Admin`,
        titleBn: `এডমিন ওয়ালেটে ৳${numAmount} যোগ করেছেন`,
        message: `Admin added ৳${numAmount} to your ${balanceType === 'WINNING' ? 'Winning' : 'Deposited'} Balance. Reason: ${reason}.`,
        messageBn: `এডমিন আপনার ${balanceType === 'WINNING' ? 'উইনিং' : 'ডিপোজিট'} ব্যালেন্সে ৳${numAmount} যোগ করেছেন। কারণ: ${reason}।`,
        type: 'SUCCESS',
        read: false,
        createdAt: nowIso,
      };
      txn.set(notifRef, notif);

      return { newWalletBalance };
    });

    return {
      success: true,
      message: `৳${numAmount} সফলভাবে ব্যবহারকারীর ওয়ালেটে যোগ হয়েছে!`,
      balanceAfter: result.newWalletBalance,
    };
  } catch (err: unknown) {
    console.error('adminAddMoneyToUser error:', err);
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'টাকা যোগ করতে ব্যর্থ হয়েছে।' };
  }
}

