import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  WalletTransaction,
  DepositRequest,
  WithdrawalRequest,
  PaymentMethod,
  AppSettings,
  UserProfile,
  PublicAdminRecord,
} from '../types';
import {
  submitAutoVerifiedDeposit,
  submitWithdrawalRequest,
  calculateTodayWithdrawn,
  getWalletBreakdown,
  MIN_WITHDRAW_AMOUNT,
  MAX_DAILY_WITHDRAW_AMOUNT,
} from '../services/walletService';
import {
  OptimisticWithdrawEntry,
  acquireWithdrawLock,
  isWithdrawInFlight,
  markOptimisticWithdrawSynced,
  mergeAdminOptimisticWithdrawals,
  rollbackOptimisticWithdraw,
  startOptimisticWithdraw,
  subscribeOptimisticWithdrawStore,
  subscribeOptimisticWithdraws,
} from '../services/optimisticWithdrawStore';
import { isUserCurrentlyBanned, getBanErrorMessage } from '../services/banService';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestoreError';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  History,
  Plus,
  ArrowUp,
  ShieldCheck,
  Zap,
  Trophy,
  Smartphone,
  ArrowRight,
  Download,
} from 'lucide-react';
import { GatewaySelector } from '../components/wallet/GatewaySelector';
import { UserAvatar } from '../components/common/UserAvatar';
import { subscribePublicAdmins } from '../services/adminService';
import { getAdminAvatarUrl } from '../constants/adminAvatars';
import { fetchTopPlayers } from '../services/matchResultService';
import { usePWAInstall } from '../context/PWAInstallContext';

interface WalletPageProps {
  initialTab?: 'overview' | 'deposit' | 'withdraw';
  onNavigate?: (page: string, params?: any) => void;
  onOpenAuth?: () => void;
}

const ADMIN_PAYMENT_NUMBER = '01602570739';

export const WalletPage: React.FC<WalletPageProps> = ({
  initialTab = 'overview',
  onNavigate,
  onOpenAuth,
}) => {
  const { currentUser, userProfile, isSuperAdmin, refreshProfile } = useAuth();
  const { language, t, formatBDT } = useLanguage();
  const { triggerInstall, isInstalled } = usePWAInstall();

  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw'>(initialTab);

  const steps = [
    {
      step: '০১',
      title: language === 'bn' ? 'ফ্রি একাউন্ট খুলুন' : 'Create Account',
      desc:
        language === 'bn'
          ? 'নাম, ফোন ও Free Fire UID দিয়ে কয়েক সেকেন্ডে আপনার প্লেয়ার প্রোফাইল তৈরি করুন।'
          : 'Set up your player profile in seconds with your name, phone & Free Fire UID.',
    },
    {
      step: '০২',
      title: language === 'bn' ? 'ওয়ালেট রিচার্জ করুন' : 'Add Funds to Wallet',
      desc:
        language === 'bn'
          ? 'বিকাশ বা নগদের মাধ্যমে নিরাপদে ওয়ালেটে টাকা ডিপোজিট করুন।'
          : 'Quick and safe deposits using bKash or Nagad mobile wallets.',
    },
    {
      step: '০৩',
      title: language === 'bn' ? 'স্লট বুক করুন' : 'Book Match Slot',
      desc:
        language === 'bn'
          ? 'সোলো, ডুও অথবা স্কোয়াড টুর্নামেন্ট বেছে নিয়ে আপনার পছন্দের স্লট নিশ্চিত করুন।'
          : 'Choose your preferred Solo, Duo, or Squad match and confirm your slot.',
    },
    {
      step: '০৪',
      title: language === 'bn' ? 'রুম আইডি পেয়ে প্রাইজ জিতুন' : 'Get Room ID & Win Cash',
      desc:
        language === 'bn'
          ? 'ম্যাচ শুরুর আগে রুম ক্রেডেনশিয়ালস নিন, যুদ্ধ জয় করে জিতে নিন নগদ টাকা।'
          : 'Receive match room details on time, dominate the match, and collect real cash prizes.',
    },
  ];

  const features = [
    {
      icon: Zap,
      title: language === 'bn' ? 'তাৎক্ষণিক রুম আইডি' : 'Instant Room Credentials',
      desc:
        language === 'bn'
          ? 'ম্যাচ শুরুর ঠিক ১০-১৫ মিনিট পূর্বে প্ল্যাটফর্মে অটোমেটিক সঠিক রুম আইডি ও পাসওয়ার্ড প্রকাশ পায়।'
          : 'Accurate Room ID & Password published automatically 10-15 minutes prior to match schedule.',
    },
    {
      icon: Trophy,
      title: language === 'bn' ? 'গ্যারান্টিড প্রাইজ পেআউট' : 'Guaranteed Prize Payouts',
      desc:
        language === 'bn'
          ? 'ম্যাচ সমাপ্তির পর ফলাফল যাচাই করে তাৎক্ষণিকভাবে ওয়ালেটে উইনিং ব্যালেন্স যোগ হয়।'
          : 'Winnings credited swiftly to player wallets and withdrawable directly to bKash or Nagad.',
    },
    {
      icon: ShieldCheck,
      title: language === 'bn' ? '১০০% ফেয়ার প্লে ও নো হ্যাক' : '100% Anti-Cheat & Fair Play',
      desc:
        language === 'bn'
          ? 'এমুলেটর নিষিদ্ধ ও সার্বক্ষণিক অ্যাডমিন পর্যবেক্ষণ। কোনো হ্যাকারকে প্রশ্রয় দেওয়া হয় না।'
          : 'Strict anti-cheat policy, emulator bans, and dedicated esports moderators overseeing matches.',
    },
    {
      icon: Smartphone,
      title: language === 'bn' ? 'মোবাইল ফ্রেন্ডলি প্ল্যাটফর্ম' : 'Mobile First Experience',
      desc:
        language === 'bn'
          ? 'স্মার্টফোনে অত্যন্ত মসৃণ এবং দ্রুতগতির ইন্টারফেস, যাতে গেমাররা নির্বিঘ্নে খেলতে পারেন।'
          : 'Engineered specifically for low-latency smartphone navigation and quick slot reservation.',
    },
  ];
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Additional sections moved from Home: Top Players and Public Admins
  const [topPlayers, setTopPlayers] = useState<UserProfile[]>([]);
  const [publicAdmins, setPublicAdmins] = useState<PublicAdminRecord[]>([]);

  // Add Money (Deposit) Form State — Instant Auto-Verify Flow
  const [depMethod, setDepMethod] = useState<PaymentMethod>('bKash');
  const [depAmount, setDepAmount] = useState<string>('');
  const [depTrxId, setDepTrxId] = useState('');
  const [depLoading, setDepLoading] = useState(false);
  const [depMessage, setDepMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [depositSuccessPopup, setDepositSuccessPopup] = useState<{ amount: number } | null>(null);

  // Withdraw Form State — REAL bKash & Nagad Flow (Min 100 TK, Max Daily 400 TK)
  const [withMethod, setWithMethod] = useState<PaymentMethod>('bKash');
  const [withAmount, setWithAmount] = useState<string>('');
  const [withAccount, setWithAccount] = useState('');
  const [withLoading, setWithLoading] = useState(false);
  const [withJustSubmitted, setWithJustSubmitted] = useState(false);
  const [withMessage, setWithMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [optimisticWithdraws, setOptimisticWithdraws] = useState<OptimisticWithdrawEntry[]>([]);
  const [optimisticAdminTick, setOptimisticAdminTick] = useState(0);
  const withdrawLockRef = useRef(false);

  const [copiedNumber, setCopiedNumber] = useState(false);

  // Sync active tab when navigated with params
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Load top players and (for Main Admin only) admin list
  useEffect(() => {
    fetchTopPlayers()
      .then((players) => setTopPlayers(players.slice(0, 5)))
      .catch((err) => console.error('Error loading top players in wallet', err));
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setPublicAdmins([]);
      return;
    }
    const unsubAdm = subscribePublicAdmins(setPublicAdmins);
    return () => {
      unsubAdm();
    };
  }, [isSuperAdmin]);

  // Real-time Firestore subscriptions for transactions, depositRequests, withdrawalRequests & settings
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    getDoc(doc(db, 'settings', 'global'))
      .then((settDoc) => {
        if (settDoc.exists()) {
          setSettings(settDoc.data() as AppSettings);
        }
      })
      .catch(() => {
        // fallback to default number 01602570739
      });

    const txQuery = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid));
    const depQuery = query(collection(db, 'depositRequests'), where('userId', '==', currentUser.uid));
    const withQuery = query(collection(db, 'withdrawalRequests'), where('userId', '==', currentUser.uid));

    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: WalletTransaction[] = [];
        snap.forEach((d) => list.push(d.data() as WalletTransaction));
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'transactions');
      }
    );

    const unsubDep = onSnapshot(
      depQuery,
      (snap) => {
        const list: DepositRequest[] = [];
        snap.forEach((d) => list.push(d.data() as DepositRequest));
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setDepositRequests(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'depositRequests');
      }
    );

    const unsubWith = onSnapshot(
      withQuery,
      (snap) => {
        const list: WithdrawalRequest[] = [];
        snap.forEach((d) => list.push(d.data() as WithdrawalRequest));
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setWithdrawalRequests(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'withdrawalRequests');
      }
    );

    const unsubOptWith = subscribeOptimisticWithdraws(currentUser.uid, setOptimisticWithdraws);
    const unsubOptStore = subscribeOptimisticWithdrawStore(() =>
      setOptimisticAdminTick((t) => t + 1)
    );

    return () => {
      unsubTx();
      unsubDep();
      unsubWith();
      unsubOptWith();
      unsubOptStore();
    };
  }, [currentUser]);

  const mergedWithdrawalRequests = useMemo(() => {
    let base = withdrawalRequests;
    if (optimisticWithdraws.length > 0) {
      const serverIds = new Set(withdrawalRequests.map((w) => w.id));
      const pendingOpt = optimisticWithdraws
        .map((entry) => entry.withdrawal)
        .filter((w) => !serverIds.has(w.id));
      if (pendingOpt.length > 0) {
        base = [...pendingOpt, ...withdrawalRequests].sort((a, b) =>
          b.createdAt > a.createdAt ? 1 : -1
        );
      }
    }
    return mergeAdminOptimisticWithdrawals(base);
  }, [withdrawalRequests, optimisticWithdraws, optimisticAdminTick]);

  const { depositedAmount, winningAmount, availableBalance } = useMemo(
    () =>
      getWalletBreakdown(userProfile, {
        depositRequests,
        withdrawalRequests: mergedWithdrawalRequests,
        transactions,
      }),
    [userProfile, depositRequests, mergedWithdrawalRequests, transactions]
  );

  // Combine real transactions + optimistic withdrawals + any legacy deposit/withdrawal requests not yet in transactions
  const mergedTransactions = useMemo(() => {
    const existingIds = new Set(transactions.map((tx) => tx.id));
    const extra: WalletTransaction[] = [];

    optimisticWithdraws.forEach((entry) => {
      if (!existingIds.has(entry.transaction.id)) {
        existingIds.add(entry.transaction.id);
        extra.push(entry.transaction);
      }
    });

    depositRequests.forEach((d) => {
      const trxId = 'trx_d_' + d.id;
      if (!existingIds.has(trxId)) {
        extra.push({
          id: trxId,
          userId: d.userId,
          type: 'DEPOSIT',
          amount: d.amount,
          status:
            d.status === 'APPROVED' || d.status === 'SUCCESS'
              ? 'COMPLETED'
              : d.status === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING',
          referenceId: d.transactionId,
          description: d.senderNumber
            ? `Deposit via ${d.method} (TrxID: ${d.transactionId} • Sender: ${d.senderNumber})`
            : `Deposit via ${d.method} (TrxID: ${d.transactionId})`,
          descriptionBn: `${d.method} ডিপোজিট ৳${d.amount} (TrxID: ${d.transactionId})`,
          balanceAfter: availableBalance,
          createdAt: d.createdAt,
        });
      }
    });

    mergedWithdrawalRequests.forEach((w) => {
      const trxId = 'trx_w_' + w.id;
      if (!existingIds.has(trxId)) {
        extra.push({
          id: trxId,
          userId: w.userId,
          type: 'WITHDRAWAL',
          amount: w.amount,
          status:
            w.status === 'PAID' || w.status === 'APPROVED'
              ? 'COMPLETED'
              : w.status === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING',
          referenceId: w.id,
          description: `Withdraw via ${w.method} (${w.accountNumber})`,
          descriptionBn: `${w.method} (${w.accountNumber})-এ ৳${w.amount} উইথড্র`,
          balanceAfter: availableBalance,
          createdAt: w.createdAt,
        });
      }
    });

    return [...transactions, ...extra].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }, [transactions, optimisticWithdraws, depositRequests, mergedWithdrawalRequests, availableBalance]);

  const matchWinningRecords = useMemo(
    () =>
      mergedTransactions.filter(
        (tx) => tx.type === 'PRIZE' && tx.status === 'COMPLETED' && !tx.reversed
      ),
    [mergedTransactions]
  );

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#070B18] py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div className="p-8 rounded-3xl bg-[#0D1428] border border-sky-500/25 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center mx-auto text-white shadow-lg shadow-sky-500/25">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-white">
              {language === 'bn' ? 'ওয়ালেট ব্যবহার করতে লগইন করুন' : 'Sign In to Access Wallet'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              {language === 'bn'
                ? 'টাকা অ্যাড, উইথড্র এবং রিয়েল লেনদেনের হিসাব দেখতে একাউন্টে লগইন করুন।'
                : 'Log in to add money, withdraw tournament winnings, and view real transaction history.'}
            </p>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs tracking-wider shadow-lg shadow-sky-500/25 cursor-pointer"
            >
              {language === 'bn' ? 'লগইন / রেজিস্ট্রেশন করুন' : 'Login / Create Account'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const getAdminNumberForMethod = (method: PaymentMethod) => {
    if (method === 'bKash') return settings?.bkashNumber || ADMIN_PAYMENT_NUMBER;
    return settings?.nagadNumber || ADMIN_PAYMENT_NUMBER;
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    const rawAmount = depAmount.trim();
    const rawTrxId = depTrxId.trim();

    if (!rawAmount || !rawTrxId) {
      setDepMessage({
        type: 'error',
        text: 'Please enter Amount and TrxID',
      });
      return;
    }

    const amount = Number(rawAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setDepMessage({
        type: 'error',
        text: 'Amount must be more than 0',
      });
      return;
    }

    if (amount > 50000) {
      setDepMessage({
        type: 'error',
        text: 'Maximum deposit is ৳50,000',
      });
      return;
    }

    if (rawTrxId.length < 8) {
      setDepMessage({
        type: 'error',
        text: 'TrxID must be at least 8 characters',
      });
      return;
    }

    setDepLoading(true);
    setDepMessage(null);

    try {
      const [, res] = await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 2000)),
        submitAutoVerifiedDeposit(
          currentUser.uid,
          userProfile.displayName,
          currentUser.email || '',
          depMethod,
          amount,
          rawTrxId
        ),
      ]);

      setDepLoading(false);
      if (res.success) {
        setDepAmount('');
        setDepTrxId('');
        setDepositSuccessPopup({ amount });
        await refreshProfile();
      } else {
        setDepMessage({ type: 'error', text: res.message });
      }
    } catch (err: unknown) {
      setDepLoading(false);
      setDepMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification failed. Please try again.',
      });
    }
  };

  const todayWithdrawn = useMemo(
    () => calculateTodayWithdrawn(mergedWithdrawalRequests),
    [mergedWithdrawalRequests]
  );
  const isDailyLimitReached = todayWithdrawn >= MAX_DAILY_WITHDRAW_AMOUNT;
  const isWinningBelowMin = winningAmount < MIN_WITHDRAW_AMOUNT;
  const maxAllowedByDaily = Math.max(0, MAX_DAILY_WITHDRAW_AMOUNT - todayWithdrawn);
  const maxWithdrawableAmount = Math.max(0, Math.min(winningAmount, maxAllowedByDaily));

  const parsedWithAmount = Number(withAmount);
  const hasTypedWithAmount = withAmount.trim() !== '';
  const isTypedWithAmountInvalid =
    hasTypedWithAmount &&
    (!Number.isFinite(parsedWithAmount) || parsedWithAmount <= 0);
  const isTypedWithAmountBelowMin =
    hasTypedWithAmount &&
    Number.isFinite(parsedWithAmount) &&
    parsedWithAmount < MIN_WITHDRAW_AMOUNT;
  const isTypedExceedsWinning =
    hasTypedWithAmount &&
    Number.isFinite(parsedWithAmount) &&
    parsedWithAmount > winningAmount;
  const isTypedExceedsDaily =
    hasTypedWithAmount &&
    Number.isFinite(parsedWithAmount) &&
    todayWithdrawn + parsedWithAmount > MAX_DAILY_WITHDRAW_AMOUNT;

  const isWithdrawBusy =
    withLoading || (currentUser ? isWithdrawInFlight(currentUser.uid) : false);

  const isWithdrawSubmitDisabled =
    isWithdrawBusy ||
    withJustSubmitted ||
    isWinningBelowMin ||
    isDailyLimitReached ||
    isTypedWithAmountInvalid ||
    isTypedWithAmountBelowMin ||
    isTypedExceedsWinning ||
    isTypedExceedsDaily;

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    if (
      withdrawLockRef.current ||
      withLoading ||
      withJustSubmitted ||
      isWithdrawInFlight(currentUser.uid)
    ) {
      return;
    }

    if (isUserCurrentlyBanned(userProfile)) {
      setWithMessage({
        type: 'error',
        text: getBanErrorMessage(userProfile),
      });
      return;
    }

    if (winningAmount < MIN_WITHDRAW_AMOUNT) {
      setWithMessage({
        type: 'error',
        text: 'Minimum 100 TK Withdraw korte parbe',
      });
      return;
    }

    if (todayWithdrawn >= MAX_DAILY_WITHDRAW_AMOUNT) {
      setWithMessage({
        type: 'error',
        text: 'Daily limit reached. You can withdraw maximum 400 TK per day.',
      });
      return;
    }

    const amount = Number(withAmount);
    if (!amount || isNaN(amount) || amount < MIN_WITHDRAW_AMOUNT) {
      setWithMessage({
        type: 'error',
        text: 'Minimum 100 TK Withdraw korte parbe',
      });
      return;
    }
    if (amount > winningAmount) {
      setWithMessage({
        type: 'error',
        text: `পর্যাপ্ত Winning Balance নেই! আপনার Winning Balance: ৳${winningAmount}`,
      });
      return;
    }
    if (todayWithdrawn + amount > MAX_DAILY_WITHDRAW_AMOUNT) {
      setWithMessage({
        type: 'error',
        text: 'Daily limit reached. You can withdraw maximum 400 TK per day.',
      });
      return;
    }
    const cleanAccount = withAccount.trim();
    if (!cleanAccount || cleanAccount.length < 6) {
      setWithMessage({
        type: 'error',
        text: language === 'bn' ? 'সঠিক মোবাইল নম্বর প্রদান করুন।' : 'Please enter a valid Mobile Number.',
      });
      return;
    }

    const releaseLock = acquireWithdrawLock(currentUser.uid);
    if (!releaseLock) {
      return;
    }
    withdrawLockRef.current = true;

    const uid = currentUser.uid;
    const displayName = userProfile.displayName;
    const email = currentUser.email || '';
    const ign = userProfile.inGameName;
    const method = withMethod;
    const priorTodayWithdrawn = todayWithdrawn;
    const requestId =
      'with_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
    const nowIso = new Date().toISOString();
    const expectedBalanceAfter = Math.max(0, availableBalance - amount);

    const optimisticWithdrawal: WithdrawalRequest = {
      id: requestId,
      userId: uid,
      userName: String(displayName || 'Player').trim(),
      ...(ign ? { inGameName: String(ign).trim() } : {}),
      userEmail: email,
      method,
      accountNumber: cleanAccount,
      amount,
      deductedFromDeposited: 0,
      deductedFromWinning: amount,
      status: 'PENDING',
      createdAt: nowIso,
    };

    const optimisticTrx: WalletTransaction = {
      id: 'trx_w_' + requestId,
      userId: uid,
      type: 'WITHDRAWAL',
      amount,
      status: 'PENDING',
      referenceId: requestId,
      description: `Withdraw via ${method} (${cleanAccount})`,
      descriptionBn: `${method} (${cleanAccount})-এ ${amount} TK উইথড্র রিকোয়েস্ট`,
      balanceAfter: expectedBalanceAfter,
      createdAt: nowIso,
    };

    // Instant 0ms update: deduct Winning Balance, add Pending row to Withdraw & Transaction History, lock button
    startOptimisticWithdraw({
      requestId,
      userId: uid,
      amount,
      txTimestampIso: nowIso,
      withdrawal: optimisticWithdrawal,
      transaction: optimisticTrx,
    });

    setWithLoading(false);
    setWithJustSubmitted(true);
    setWithAccount('');
    setWithAmount('');
    setWithMessage({
      type: 'success',
      text: `Success - Request Pathano Hoyeche! ${amount} TK (${method}: ${cleanAccount}) আপনার Winning Balance থেকে কাটা হয়েছে।`,
    });

    // Background atomic Firestore commit to Admin queue without blocking user
    void (async () => {
      try {
        const res = await submitWithdrawalRequest(
          uid,
          displayName,
          email,
          method,
          cleanAccount,
          amount,
          ign,
          {
            requestId,
            nowIso,
            knownTodayWithdrawn: priorTodayWithdrawn,
          }
        );

        if (res.success) {
          markOptimisticWithdrawSynced(requestId);
          void refreshProfile();
        } else {
          rollbackOptimisticWithdraw(requestId);
          setWithJustSubmitted(false);
          setWithMessage({ type: 'error', text: res.message || 'উইথড্র করতে সমস্যা হয়েছে।' });
        }
      } catch (err: unknown) {
        rollbackOptimisticWithdraw(requestId);
        setWithJustSubmitted(false);
        setWithMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'উইথড্র করতে সমস্যা হয়েছে।',
        });
      } finally {
        withdrawLockRef.current = false;
        releaseLock();
      }
    })();
  };

  const getStatusLabel = (status: string, type?: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'APPROVED' || s === 'PAID' || s === 'SUCCESS') {
      return type === 'DEPOSIT' ? 'Success' : 'Approved';
    }
    if (s === 'REJECTED') return 'Rejected';
    return 'Pending';
  };

  const getStatusBadgeClasses = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'APPROVED' || s === 'PAID' || s === 'SUCCESS') {
      return 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30';
    }
    if (s === 'REJECTED') {
      return 'text-red-400 bg-red-950/60 border border-red-500/30';
    }
    return 'text-amber-400 bg-amber-950/60 border border-amber-500/30';
  };

  return (
    <div className="min-h-screen bg-[#070B18] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
            <Wallet className="w-4 h-4" />
            <span>{language === 'bn' ? 'ওয়ালেট ও পেমেন্ট' : 'Esports Wallet'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-gaming text-white mt-1">
            {t('wallet.title')}
          </h1>
        </div>

        {activeTab !== 'overview' && (
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="px-3.5 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-sky-500/30 text-sky-400 text-xs font-bold font-gaming flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Transaction History</span>
          </button>
        )}
      </div>

      {/* TOTAL BALANCE Card (Adapts to Light & Dark Theme while keeping exact Dark Mode look) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090B10] border border-amber-400/90 dark:border-amber-400/80 shadow-lg dark:shadow-2xl space-y-4 transition-colors">
        {/* Top: Left side "TOTAL BALANCE" small golden text, Right side small "BDT" pill badge */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold font-gaming uppercase tracking-wider text-amber-700 dark:text-amber-400">
            TOTAL BALANCE
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-[#1A2234] border border-amber-400/60 dark:border-amber-400/40 text-amber-800 dark:text-amber-300 font-bold font-gaming text-[10px] tracking-wider uppercase">
            BDT
          </span>
        </div>

        {/* Big text below: "৳" in golden color + Total Amount */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black font-gaming text-amber-600 dark:text-[#F4D77A]">৳</span>
          <span className="text-3xl sm:text-4xl font-black font-gaming text-slate-900 dark:text-white tracking-tight tabular-nums">
            {availableBalance}
          </span>
        </div>

        {/* 2 Small Boxes in One Row: Left Deposit Balance, Right Winning Balance */}
        <div className="grid grid-cols-2 gap-3">
          {/* Left box: Green wallet icon + "Deposit Balance" + "৳" amount */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 sm:gap-3 transition-colors">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 block font-medium truncate">
                Deposit Balance
              </span>
              <span className="text-xs sm:text-sm font-black font-gaming text-slate-900 dark:text-white block tabular-nums">
                ৳{depositedAmount}
              </span>
            </div>
          </div>

          {/* Right box: Golden trophy icon + "Winning Balance" + "৳" amount */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 sm:gap-3 transition-colors">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 block font-medium truncate">
                Winning Balance
              </span>
              <span className="text-xs sm:text-sm font-black font-gaming text-slate-900 dark:text-white block tabular-nums">
                ৳{winningAmount}
              </span>
            </div>
          </div>
        </div>

        {/* 2 Buttons in One Row: Left Golden filled button "+ Add Money", Right outline golden border button "↑ Withdraw" */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('deposit');
              setDepMessage(null);
            }}
            className="w-full py-2.5 sm:py-3 px-3 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-black font-gaming text-xs sm:text-sm tracking-wider uppercase shadow-md shadow-[#CFA84B]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#CFA84B] dark:border-[#F4D77A]/60"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Money</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('withdraw');
              setWithMessage(null);
              setWithJustSubmitted(false);
            }}
            className="w-full py-2.5 sm:py-3 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-[#0A0A0A] dark:hover:bg-[#151515] border border-amber-500 dark:border-[#CFA84B] dark:hover:border-[#F4D77A] active:scale-[0.99] text-amber-800 dark:text-[#F4D77A] font-black font-gaming text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            <span>↑ Withdraw</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADD MONEY FLOW (Instant Auto-Verify) */}
      {activeTab === 'deposit' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-[#0D1428] border border-sky-500/30 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-black font-gaming text-white uppercase tracking-wide">
                Add Money
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Send Money to this number and verify your TrxID
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold font-gaming uppercase">
              Instant Verify
            </span>
          </div>

          {/* Payment Method Selector: bKash & Nagad */}
          <GatewaySelector
            selectedMethod={depMethod}
            onSelect={(m) => {
              setDepMethod(m);
              setDepMessage(null);
            }}
          />

          {/* Admin bKash / Nagad Number Box with "Send Money to this number" */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-3 ${
              depMethod === 'bKash'
                ? 'bg-[#090E1F] border-[#E2136E]/60'
                : 'bg-[#090E1F] border-orange-500/50'
            }`}
          >
            <div>
              <span className="text-xs font-bold text-sky-300 block">
                Send Money to this number ({depMethod})
              </span>
              <span
                className={`text-xl sm:text-2xl font-black font-gaming tracking-widest mt-1 block ${
                  depMethod === 'bKash' ? 'text-[#E2136E]' : 'text-orange-400'
                }`}
              >
                {getAdminNumberForMethod(depMethod)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleCopyNumber(getAdminNumberForMethod(depMethod))}
              className={`px-4 py-2.5 text-xs rounded-xl text-white font-bold font-gaming transition-all flex items-center gap-1.5 cursor-pointer shadow-md shrink-0 ${
                depMethod === 'bKash'
                  ? 'bg-[#E2136E] hover:bg-[#C20E5C]'
                  : 'bg-orange-600 hover:bg-orange-500'
              }`}
            >
              {copiedNumber ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedNumber ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {depMessage && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 text-xs sm:text-sm ${
                depMessage.type === 'success'
                  ? 'bg-emerald-950/75 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/75 border-red-500/50 text-red-200'
              }`}
            >
              {depMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{depMessage.text}</span>
            </div>
          )}

          <form noValidate onSubmit={handleDepositSubmit} className="space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                AMOUNT *
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['20', '50', '100', '200', '500'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDepAmount(preset)}
                    className={`py-2 rounded-xl text-xs font-bold font-gaming transition-all cursor-pointer ${
                      depAmount === preset
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                        : 'bg-[#111D35] text-slate-300 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    ৳{preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="50000"
                step="1"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                placeholder="Enter amount (e.g. 100)"
                className="w-full px-4 py-3 bg-[#111D35] border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-sky-400 font-mono"
              />
            </div>

            {/* TrxID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                TRXID (TRANSACTION ID) *
              </label>
              <input
                type="text"
                value={depTrxId}
                onChange={(e) => setDepTrxId(e.target.value)}
                placeholder="E.G. BGH7K2M91P"
                className="w-full px-4 py-3 bg-[#111D35] border border-slate-700 rounded-xl text-white text-sm uppercase tracking-widest font-mono font-bold focus:outline-none focus:border-sky-400"
              />
            </div>

            <button
              type="submit"
              disabled={depLoading}
              className={`w-full py-3.5 text-white font-black font-gaming tracking-widest text-xs sm:text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                depMethod === 'bKash'
                  ? 'bg-gradient-to-r from-[#E2136E] to-[#C20E5C] hover:opacity-95 shadow-[#E2136E]/30'
                  : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:opacity-95 shadow-orange-600/30'
              }`}
            >
              {depLoading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>VERIFY</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: WITHDRAW FLOW (AUTOMATIC — bKash, Nagad, Winning Balance >= 100 TK, Max Daily 400 TK) */}
      {activeTab === 'withdraw' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-[#0D1428] border border-emerald-500/30 shadow-2xl space-y-6">
          {/* Top Winning Balance Banner inside Withdraw */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/90 to-[#111D35] border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-bold block">
                Winning Balance (Withdrawable)
              </span>
              <span
                className={`text-2xl font-black font-gaming block ${
                  isWinningBelowMin ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {formatBDT(winningAmount)}
              </span>
              <span className="text-xs font-semibold text-sky-300 mt-1 block">
                Available Wallet Balance: {formatBDT(availableBalance)} • Max Daily: 400 TK
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Today&apos;s Withdrawn: {todayWithdrawn} TK / 400 TK
              </span>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold self-start sm:self-center shrink-0">
              Minimum Withdraw 100 TK
            </span>
          </div>

          {isWinningBelowMin && (
            <div className="p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm bg-amber-950/70 border-amber-500/50 text-amber-200 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="block">Minimum 100 TK Withdraw korte parbe</span>
                <span className="text-[11px] font-normal text-amber-300/90 block mt-0.5">
                  আপনার বর্তমান Winning Balance: {formatBDT(winningAmount)} (Withdraw করতে কমপক্ষে ৳100 Winning Balance থাকতে হবে)
                </span>
              </div>
            </div>
          )}

          {isDailyLimitReached && (
            <div className="p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm bg-red-950/70 border-red-500/50 text-red-200 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Daily limit reached. You can withdraw maximum 400 TK per day.</span>
            </div>
          )}

          {withMessage &&
            !(
              isDailyLimitReached &&
              withMessage.text === 'Daily limit reached. You can withdraw maximum 400 TK per day.'
            ) && (
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm ${
                  withMessage.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                    : 'bg-red-950/70 border-red-500/50 text-red-200'
                }`}
              >
                {withMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span>{withMessage.text}</span>
              </div>
            )}

          <form noValidate onSubmit={handleWithdrawalSubmit} className="space-y-4">
            {/* Select Payment Method: bKash & Nagad */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                Select Payment Method *
              </label>
              <GatewaySelector
                selectedMethod={withMethod}
                onSelect={(m) => {
                  setWithMethod(m);
                  if (withJustSubmitted) setWithJustSubmitted(false);
                }}
              />
            </div>

            {/* Mobile Number Input */}
            <div>
              <label className="block text-xs font-bold text-slate-200 tracking-wider mb-1.5">
                MOBILE NUMBER ({withMethod}) *
              </label>
              <input
                type="tel"
                required
                disabled={isWinningBelowMin || isDailyLimitReached}
                value={withAccount}
                onChange={(e) => {
                  setWithAccount(e.target.value);
                  if (withJustSubmitted) setWithJustSubmitted(false);
                }}
                placeholder="01XXXXXXXXX"
                className="w-full px-4 py-3 bg-[#111D35] border border-slate-700 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Amount to Withdraw Input */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Amount to Withdraw (৳) *
                </label>
                <div className="flex items-center gap-2">
                  {!isWinningBelowMin && maxWithdrawableAmount >= MIN_WITHDRAW_AMOUNT && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithAmount(String(Math.floor(maxWithdrawableAmount)));
                        if (withJustSubmitted) setWithJustSubmitted(false);
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold cursor-pointer"
                    >
                      Max ৳{Math.floor(maxWithdrawableAmount)}
                    </button>
                  )}
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Minimum Withdraw 100 TK
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2.5">
                {['100', '200', '300', '400'].map((preset) => {
                  const presetVal = Number(preset);
                  const presetDisabled =
                    isWinningBelowMin ||
                    isDailyLimitReached ||
                    presetVal > winningAmount ||
                    todayWithdrawn + presetVal > MAX_DAILY_WITHDRAW_AMOUNT;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={presetDisabled}
                      onClick={() => {
                        setWithAmount(preset);
                        if (withJustSubmitted) setWithJustSubmitted(false);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold font-gaming transition-all cursor-pointer tabular-nums disabled:opacity-40 disabled:cursor-not-allowed ${
                        withAmount === preset
                          ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                          : 'bg-[#111D35] text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      ৳{preset}
                    </button>
                  );
                })}
              </div>
              <input
                type="number"
                min="100"
                max="400"
                step="1"
                required
                disabled={isWinningBelowMin || isDailyLimitReached}
                value={withAmount}
                onChange={(e) => {
                  setWithAmount(e.target.value);
                  if (withJustSubmitted) setWithJustSubmitted(false);
                }}
                placeholder="100"
                className="w-full px-4 py-3 bg-[#111D35] border border-slate-700 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!isWinningBelowMin && isTypedExceedsWinning && (
                <p className="text-[11px] text-red-400 font-semibold mt-1.5">
                  পর্যাপ্ত Winning Balance নেই! সর্বোচ্চ ৳{winningAmount} Withdraw করতে পারবেন।
                </p>
              )}
              {!isWinningBelowMin && !isTypedExceedsWinning && isTypedWithAmountBelowMin && (
                <p className="text-[11px] text-amber-400 font-semibold mt-1.5">
                  Minimum 100 TK Withdraw korte parbe
                </p>
              )}
              {!isWinningBelowMin && !isTypedExceedsWinning && !isTypedWithAmountBelowMin && isTypedExceedsDaily && (
                <p className="text-[11px] text-red-400 font-semibold mt-1.5">
                  Daily limit reached. আজকে সর্বোচ্চ আর ৳{maxAllowedByDaily} Withdraw করতে পারবেন।
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isWithdrawSubmitDisabled}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 text-white font-black font-gaming tracking-wider text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-emerald-600"
            >
              {withJustSubmitted ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Success - Request Pathano Hoyeche</span>
                </>
              ) : isWithdrawBusy ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Withdraw Money</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* WITHDRAW REQUESTS HISTORY */}
      {mergedWithdrawalRequests.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-amber-500/25 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" />
              <span>{language === 'bn' ? 'উইথড্র হিস্ট্রি' : 'Withdraw History'}</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold tabular-nums">
              {mergedWithdrawalRequests.length}{' '}
              {mergedWithdrawalRequests.length === 1 ? 'request' : 'requests'}
            </span>
          </div>

          <div className="space-y-2.5">
            {mergedWithdrawalRequests.map((w) => {
              const withStatusLabel =
                w.status === 'PAID' || w.status === 'APPROVED'
                  ? 'Paid'
                  : w.status === 'REJECTED'
                  ? 'Rejected (Refunded)'
                  : 'Pending';

              return (
                <div
                  key={w.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-black font-gaming text-white text-sm tabular-nums">
                        {formatBDT(w.amount)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#0D1428] border border-sky-500/25 font-mono text-[11px] font-bold text-sky-300">
                        {w.method}: {w.accountNumber}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-400">
                      <span>Requested: {new Date(w.createdAt).toLocaleString()}</span>
                      {w.processedAt && (
                        <>
                          <span>·</span>
                          <span>Processed: {new Date(w.processedAt).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                    {w.adminNote && w.status !== 'PENDING' && (
                      <p className="text-[11px] text-slate-400 truncate">Note: {w.adminNote}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${getStatusBadgeClasses(
                        w.status
                      )}`}
                    >
                      {withStatusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DEPOSIT HISTORY */}
      {depositRequests.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-sky-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Deposit History</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold">
              {depositRequests.length} {depositRequests.length === 1 ? 'deposit' : 'deposits'}
            </span>
          </div>

          <div className="space-y-2.5">
            {depositRequests.map((d) => {
              const depStatusLabel =
                d.status === 'APPROVED' || d.status === 'SUCCESS'
                  ? 'Success'
                  : d.status === 'REJECTED'
                  ? 'Rejected'
                  : 'Pending';

              return (
                <div
                  key={d.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-black font-gaming text-white text-sm">
                        Amount: {formatBDT(d.amount)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#0D1428] border border-sky-500/25 font-mono text-[11px] font-bold text-sky-300">
                        TrxID: {d.transactionId}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-400">
                      <span>Date: {new Date(d.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${getStatusBadgeClasses(
                        d.status
                      )}`}
                    >
                      {depStatusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MATCH WINNINGS BREAKDOWN (Per Match Name, Kills & Winning Money) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-emerald-500/25 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span>
                {language === 'bn'
                  ? 'ম্যাচ অনুযায়ী উইনিং হিসাব'
                  : 'Match Winnings Breakdown'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'কোন ম্যাচ থেকে, কত কিল এবং জিতে কত টাকা পেয়েছেন তার পূর্ণ হিসাব'
                : 'Exact match-by-match kills, win prizes, and auto-credited winnings'}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0 tabular-nums">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {language === 'bn' ? 'মোট উইনিং ব্যালেন্স' : 'Total Winning Balance'}
            </span>
            <span className="text-lg font-black font-gaming text-emerald-400">
              {formatBDT(winningAmount)}
            </span>
          </div>
        </div>

        {matchWinningRecords.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl bg-[#070B18]/60 border border-slate-800/80">
            <p className="text-xs sm:text-sm text-slate-400">
              {language === 'bn'
                ? 'এখনো কোনো ম্যাচ উইনিং যোগ হয়নি। ম্যাচ জিতলে বা কিল করলে অটো এখানে যুক্ত হবে।'
                : 'No match winnings yet. Win matches or get kills and your prize will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {matchWinningRecords.map((tx) => {
              const hasKillStats = typeof tx.kills === 'number';
              const hasWinSplit =
                typeof tx.winPrize === 'number' || typeof tx.killPrize === 'number';
              const matchName =
                language === 'bn'
                  ? tx.tournamentTitleBn || tx.tournamentTitle || tx.descriptionBn || tx.description
                  : tx.tournamentTitle || tx.description;

              return (
                <div
                  key={`win_${tx.id}`}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111D35] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="font-bold text-white text-sm block truncate">
                      {matchName}
                    </span>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 tabular-nums">
                      {typeof tx.placement === 'number' && (
                        <>
                          <span className="font-semibold text-amber-300">
                            {language === 'bn' ? `#${tx.placement} স্থান` : `Rank #${tx.placement}`}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">·</span>
                        </>
                      )}
                      {hasKillStats && (
                        <>
                          <span className="font-semibold text-sky-300">
                            {tx.kills} {language === 'bn' ? 'কিল' : tx.kills === 1 ? 'Kill' : 'Kills'}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">·</span>
                        </>
                      )}
                      {hasWinSplit && (
                        <>
                          <span className="text-slate-400">
                            {language === 'bn'
                              ? `উইন ৳${tx.winPrize ?? 0} + কিল ৳${tx.killPrize ?? 0}`
                              : `Win ৳${tx.winPrize ?? 0} + Kills ৳${tx.killPrize ?? 0}`}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 tabular-nums">
                    <span className="text-base font-black font-gaming text-emerald-400 block">
                      +{formatBDT(tx.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {language === 'bn' ? 'উইনিং ব্যালেন্সে যোগ' : 'Added to Winning'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRANSACTION HISTORY (Always visible below on Wallet Overview, and also visible below Deposit/Withdraw for live status) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-sky-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <History className="w-4 h-4" />
            <span>Transaction History</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-semibold">
            {mergedTransactions.length} {mergedTransactions.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#111D35] animate-pulse" />
            ))}
          </div>
        ) : mergedTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl bg-[#070B18]/60 border border-slate-800/80">
            <p className="text-xs sm:text-sm text-slate-400">
              {language === 'bn' ? 'এখনও কোনো লেনদেন হয়নি।' : 'No transactions yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {mergedTransactions.map((tx) => {
              const isCredit =
                tx.type === 'DEPOSIT' || tx.type === 'PRIZE' || tx.type === 'REFUND';
              const statusLabel =
                tx.reversed || (tx.type === 'PRIZE' && tx.status === 'REJECTED')
                  ? 'Reversed'
                  : getStatusLabel(tx.status, tx.type);

              return (
                <div
                  key={tx.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit && tx.status !== 'REJECTED' && !tx.reversed
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-950 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {isCredit && tx.status !== 'REJECTED' && !tx.reversed ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">
                        {language === 'bn' ? tx.descriptionBn || tx.description : tx.description}
                      </span>
                      <div className="flex items-center flex-wrap gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{new Date(tx.createdAt).toLocaleString()}</span>
                        {tx.type === 'PRIZE' && typeof tx.kills === 'number' && (
                          <>
                            <span>·</span>
                            <span className="text-sky-300 font-semibold">
                              {tx.kills} Kills
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${getStatusBadgeClasses(
                            tx.status
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <span
                      className={`text-sm font-black font-gaming block ${
                        tx.status === 'REJECTED' || tx.reversed
                          ? 'text-slate-400 line-through'
                          : isCredit
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatBDT(tx.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Bal: {formatBDT(tx.balanceAfter)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTIONS MOVED FROM HOME: HOW TO PARTICIPATE & WIN, WHY CHOOSE TX TOUR BD, TOP PLAYERS, OUR ADMINS */}
      <div className="space-y-6 pt-4 border-t border-slate-800/80">
        {/* HOW TO PARTICIPATE & WIN */}
        <section className="pt-2">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <span className="text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
              {language === 'bn' ? 'সহজ চার ধাপ' : 'Easy 4 Steps'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-white mt-1">
              {language === 'bn' ? 'কিভাবে টুর্নামেন্টে অংশ নেবেন?' : 'How To Participate & Win'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((st, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-[#0D1428] border border-slate-800 hover:border-sky-500/40 transition-all group"
              >
                <div className="text-2xl font-black font-gaming text-sky-500/30 group-hover:text-sky-400 transition-colors mb-1.5">
                  {st.step}
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHY CHOOSE TX TOUR BD */}
        <section className="pt-6 border-t border-slate-800">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <span className="text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
              {language === 'bn' ? 'সেরা অভিজ্ঞতা' : 'Esports Standard'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-white mt-1">
              {language === 'bn' ? 'কেন TX TOUR BD বেছে নেবেন?' : 'Why Choose TX TOUR BD'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-[#0D1428] border border-sky-500/20 hover:border-sky-400/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TOP PLAYERS LEADERBOARD PREVIEW */}
        {topPlayers.length > 0 && (
          <section className="pt-6 border-t border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-amber-400 text-xs font-bold font-gaming uppercase tracking-widest">
                  {language === 'bn' ? 'শীর্ষ চ্যাম্পিয়ন' : 'Hall of Fame'}
                </span>
                <h2 className="text-xl font-black font-gaming text-white">
                  {language === 'bn' ? 'টপ প্লেয়ার লিডারবোর্ড' : 'Top Performing Players'}
                </h2>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('leaderboard')}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 font-gaming tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'bn' ? 'সম্পূর্ণ লিডারবোর্ড' : 'Full Leaderboard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {topPlayers.slice(0, 3).map((p, idx) => {
                const playerAvatarData =
                  userProfile && p.uid === userProfile.uid ? userProfile : p;
                return (
                  <div
                    key={p.uid}
                    className="p-3.5 rounded-xl bg-[#0D1428] border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-black font-gaming text-[11px] shrink-0 ${
                          idx === 0
                            ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-300 text-black'
                            : 'bg-amber-700 text-white'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <UserAvatar user={playerAvatarData} size="sm" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate max-w-[120px]">
                          {p.inGameName || p.displayName}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.totalWins || 0} Wins • {p.totalKills || 0} Kills
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block font-medium">Earnings</span>
                      <span className="text-xs font-extrabold font-gaming text-sky-400">
                        {formatBDT(p.totalEarnings || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* OUR ADMINS / ADMIN LIST SECTION — MAIN ADMIN ONLY */}
        {isSuperAdmin && (
          <section className="pt-6 border-t border-slate-800">
            <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#0D1428] border border-sky-500/20 shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/90">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-black font-gaming tracking-wide text-white">
                      Our Admins
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Admin List
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#111D35] border border-slate-800 text-[11px] font-bold font-gaming text-sky-400">
                  {publicAdmins.length} {publicAdmins.length === 1 ? 'Admin' : 'Admins'}
                </span>
              </div>

              {publicAdmins.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No admins listed yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {publicAdmins.map((admin, idx) => (
                    <div
                      key={admin.id}
                      className="px-4 py-3 rounded-xl bg-[#111D35] border border-slate-800/90 hover:border-sky-500/30 flex items-center gap-3 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 shadow-sm bg-[#0D1428] ${
                          idx === 0
                            ? 'border-amber-400/70 shadow-amber-500/20'
                            : 'border-sky-400/60 shadow-sky-500/15'
                        }`}
                      >
                        <img
                          src={getAdminAvatarUrl(admin.avatarId, idx)}
                          alt={`${admin.displayName} Cartoon Avatar`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        Admin {idx + 1} - {admin.displayName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* DEPOSIT SUCCESS POPUP MODAL */}
      {depositSuccessPopup && (
        <div
          onClick={() => setDepositSuccessPopup(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-success-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0D1428] border-2 border-emerald-400/60 p-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.28)] space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3
                id="deposit-success-modal-title"
                className="text-lg sm:text-xl font-black font-gaming text-white"
              >
                Deposit Successful! ৳{depositSuccessPopup.amount} Added
              </h3>
              <p className="text-xs text-slate-300">
                Your wallet balance has been updated immediately.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDepositSuccessPopup(null)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black font-gaming tracking-wider text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
