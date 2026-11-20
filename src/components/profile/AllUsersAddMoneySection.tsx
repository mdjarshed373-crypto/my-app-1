import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../services/firestoreError';
import {
  getWalletBreakdown,
  adminAddMoneyToUser,
  AdminAddMoneyBalanceType,
  AdminAddMoneyReason,
} from '../../services/walletService';
import { formatAdminDisplayContact } from '../../services/adminService';
import { isUserCurrentlyBanned } from '../../services/banService';
import { useLanguage } from '../../context/LanguageContext';
import {
  Users,
  Search,
  Plus,
  DollarSign,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface AllUsersAddMoneySectionProps {
  onClose?: () => void;
  adminName?: string;
  onMoneyAdded?: () => Promise<void> | void;
}

export const AllUsersAddMoneySection: React.FC<AllUsersAddMoneySectionProps> = ({
  onClose,
  adminName,
  onMoneyAdded,
}) => {
  const { formatBDT } = useLanguage();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Money Modal states
  const [addMoneyTargetUser, setAddMoneyTargetUser] = useState<UserProfile | null>(null);
  const [addMoneyAmount, setAddMoneyAmount] = useState<string>('');
  const [addMoneyBalanceType, setAddMoneyBalanceType] =
    useState<AdminAddMoneyBalanceType>('WINNING');
  const [addMoneyReason, setAddMoneyReason] =
    useState<AdminAddMoneyReason>('WINNING');
  const [isSubmittingAddMoney, setIsSubmittingAddMoney] = useState<boolean>(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        list.push(d.data() as UserProfile);
      });
      // Sort newest or alphabetical cleanly
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setUsersList(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenAddMoney = (user: UserProfile) => {
    setAddMoneyTargetUser(user);
    setAddMoneyAmount('');
    setAddMoneyBalanceType('WINNING');
    setAddMoneyReason('WINNING');
  };

  const handleSendAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMoneyTargetUser) return;

    const amountNum = Number(addMoneyAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({
        type: 'error',
        text: 'সঠিক টাকার পরিমাণ দিন (Enter a valid amount)',
      });
      return;
    }

    setIsSubmittingAddMoney(true);
    setFeedback(null);
    try {
      const res = await adminAddMoneyToUser({
        userId: addMoneyTargetUser.uid,
        amount: amountNum,
        balanceType: addMoneyBalanceType,
        reason: addMoneyReason,
        adminName: adminName || 'Admin',
      });

      setFeedback({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });

      if (res.success) {
        setAddMoneyTargetUser(null);
        setAddMoneyAmount('');
        await loadUsers();
        if (onMoneyAdded) {
          await onMoneyAdded();
        }
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'টাকা যোগ করতে ব্যর্থ হয়েছে',
      });
    } finally {
      setIsSubmittingAddMoney(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase().trim();
    const name = (u.displayName || '').toLowerCase();
    const ign = (u.inGameName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phoneNumber || '').toLowerCase();
    const ffUid = (u.freeFireUid || '').toLowerCase();
    const uid = (u.uid || '').toLowerCase();
    return (
      name.includes(q) ||
      ign.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      ffUid.includes(q) ||
      uid.includes(q)
    );
  });

  return (
    <div
      role="region"
      aria-label="All Users and Add Money"
      className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border-2 border-emerald-500/40 shadow-2xl shadow-emerald-500/10 space-y-5 animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-black shadow-lg shadow-emerald-500/25 shrink-0">
            <Users className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2 flex-wrap">
              <span>ALL USERS DIRECTORY ({filteredUsers.length} of {usersList.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Search any user and add money directly to their wallet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            title="Refresh Users List"
            className="p-2 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-sky-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close All Users Directory"
              className="p-2 rounded-xl bg-[#111D35] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/70 border-red-500/50 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <span className="font-semibold">{feedback.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={userSearchQuery}
          onChange={(e) => setUserSearchQuery(e.target.value)}
          placeholder="Search by name, phone, FF UID, email..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#111D35] border border-sky-500/30 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-sky-400"
        />
        {userSearchQuery && (
          <button
            type="button"
            onClick={() => setUserSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">ইউজার তালিকা লোড হচ্ছে...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#111D35] border border-slate-800 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-xs text-slate-400">
            {userSearchQuery
              ? `কোনো ইউজার পাওয়া যায়নি "${userSearchQuery}" দিয়ে`
              : 'এখনও কোনো ইউজার রেজিস্টার করেনি।'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5">
          {filteredUsers.map((u) => {
            const contactInfo = formatAdminDisplayContact(u);
            const breakdown = getWalletBreakdown(u);

            return (
              <div
                key={u.uid}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#111D35] border border-slate-800 hover:border-sky-500/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">
                      {u.inGameName || u.displayName}
                    </span>
                    {isUserCurrentlyBanned(u) && (
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black font-gaming uppercase tracking-wider">
                        BANNED
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-gaming font-bold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : u.role === 'ADMIN'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                    <span>
                      Phone: <strong className="text-slate-200">{contactInfo.primary}</strong>
                    </span>
                    {u.freeFireUid && (
                      <span>
                        • FF UID:{' '}
                        <strong className="text-amber-300 font-mono">{u.freeFireUid}</strong>
                      </span>
                    )}
                    {u.email && (
                      <span>
                        • Email: <strong className="text-slate-300">{u.email}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/80">
                    <span>
                      Total Available:{' '}
                      <strong className="text-emerald-400 font-bold font-gaming">
                        {formatBDT(breakdown.availableBalance)}
                      </strong>
                    </span>
                    <span>
                      Winning:{' '}
                      <strong className="text-amber-300 font-gaming">
                        {formatBDT(breakdown.winningAmount)}
                      </strong>
                    </span>
                    <span>
                      Deposited:{' '}
                      <strong className="text-sky-300 font-gaming">
                        {formatBDT(breakdown.depositedAmount)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Right Action: ADD MONEY button & Balance info */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Balance
                    </span>
                    <span className="text-base font-black font-gaming text-emerald-400 block leading-tight">
                      {formatBDT(breakdown.availableBalance)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddMoney(u)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-md shadow-[#CFA84B]/25 active:scale-95 transition-all cursor-pointer border border-[#F4D77A]/60"
                    title={`Add money to ${u.displayName || u.inGameName}`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>ADD MONEY</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MANUAL ADD MONEY POPUP MODAL (Admin Only) */}
      {addMoneyTargetUser && (
        <div
          onClick={() => !isSubmittingAddMoney && setAddMoneyTargetUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-add-money-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#0D1428] border-2 border-emerald-500/50 p-5 sm:p-6 shadow-[0_0_50px_rgba(16,185,129,0.25)] space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-md">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3
                    id="profile-add-money-modal-title"
                    className="text-base font-black font-gaming text-white uppercase tracking-wider"
                  >
                    ADD MONEY (ম্যানুয়াল টাকা যোগ)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    To:{' '}
                    <strong className="text-white">
                      {addMoneyTargetUser.inGameName || addMoneyTargetUser.displayName}
                    </strong>
                    {addMoneyTargetUser.phoneNumber && ` (${addMoneyTargetUser.phoneNumber})`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmittingAddMoney}
                onClick={() => setAddMoneyTargetUser(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Current Balance Overview */}
            <div className="p-3 rounded-2xl bg-[#111D35] border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  বর্তমান ব্যালেন্স (Current Balance)
                </span>
                <span className="text-lg font-black font-gaming text-emerald-400">
                  {formatBDT(getWalletBreakdown(addMoneyTargetUser).availableBalance)}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div>
                  উইনিং:{' '}
                  <strong className="text-amber-300 font-gaming">
                    {formatBDT(getWalletBreakdown(addMoneyTargetUser).winningAmount)}
                  </strong>
                </div>
                <div>
                  ডিপোজিট:{' '}
                  <strong className="text-sky-300 font-gaming">
                    {formatBDT(getWalletBreakdown(addMoneyTargetUser).depositedAmount)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Add Money Form */}
            <form onSubmit={handleSendAddMoney} className="space-y-4 text-xs">
              {/* 1. Amount */}
              <div>
                <label className="block text-slate-200 font-bold mb-1.5 uppercase tracking-wide">
                  কত টাকা (Amount in ৳ BDT) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-gaming font-bold text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    autoFocus
                    value={addMoneyAmount}
                    onChange={(e) => setAddMoneyAmount(e.target.value)}
                    placeholder="e.g. 15, 50, 100"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#111D35] border border-slate-700 focus:border-emerald-400 text-white font-mono font-bold text-base placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Quick preset amount chips */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[15, 50, 100, 200, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAddMoneyAmount(String(preset))}
                      className="px-2.5 py-1 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-white font-mono text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      +৳{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Destination Balance (WINNING / DEPOSITED) */}
              <div>
                <label className="block text-slate-200 font-bold mb-1.5 uppercase tracking-wide">
                  কোথায় যোগ হবে (Destination Balance) *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAddMoneyBalanceType('WINNING')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      addMoneyBalanceType === 'WINNING'
                        ? 'bg-amber-950/40 border-amber-400 text-white shadow-md shadow-amber-500/20'
                        : 'bg-[#111D35] border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black font-gaming text-xs text-amber-300">
                        WINNING Balance
                      </span>
                      <input
                        type="radio"
                        checked={addMoneyBalanceType === 'WINNING'}
                        readOnly
                        className="accent-amber-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                      উইথড্রযোগ্য ব্যালেন্স (Withdrawable directly)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddMoneyBalanceType('DEPOSITED')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      addMoneyBalanceType === 'DEPOSITED'
                        ? 'bg-sky-950/40 border-sky-400 text-white shadow-md shadow-sky-500/20'
                        : 'bg-[#111D35] border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black font-gaming text-xs text-sky-300">
                        DEPOSITED Balance
                      </span>
                      <input
                        type="radio"
                        checked={addMoneyBalanceType === 'DEPOSITED'}
                        readOnly
                        className="accent-sky-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                      ম্যাচ খেলার ডিপোজিট ব্যালেন্স (Match entry funds)
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Reason */}
              <div>
                <label className="block text-slate-200 font-bold mb-1.5 uppercase tracking-wide">
                  কারণ (Reason) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['WINNING', 'SLOT REFUND', 'BONUS'] as AdminAddMoneyReason[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAddMoneyReason(r)}
                      className={`py-2 px-2 rounded-xl border text-center font-black font-gaming text-[11px] tracking-wide transition-all cursor-pointer ${
                        addMoneyReason === r
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-[#111D35] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Preview */}
              {Number(addMoneyAmount) > 0 && (
                <div className="p-3 rounded-xl bg-[#090E1F] border border-emerald-500/30 text-[11px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span>যোগ হবে:</span>
                    <strong className="text-emerald-400 font-gaming">
                      +৳{addMoneyAmount}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>নতুন ব্যালেন্স হবে:</span>
                    <strong className="text-white font-gaming">
                      {formatBDT(
                        getWalletBreakdown(addMoneyTargetUser).availableBalance +
                          Number(addMoneyAmount)
                      )}
                    </strong>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    ট্রানজেকশন হিস্ট্রি:{' '}
                    <span className="text-amber-300">
                      Admin Added +{addMoneyAmount} Taka - {addMoneyReason}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingAddMoney}
                  onClick={() => setAddMoneyTargetUser(null)}
                  className="flex-1 py-3 rounded-2xl bg-[#111D35] hover:bg-slate-800 text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  বাতিল (Cancel)
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmittingAddMoney || !addMoneyAmount || Number(addMoneyAmount) <= 0
                  }
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black font-gaming text-sm tracking-wider uppercase shadow-xl shadow-[#CFA84B]/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all border border-[#F4D77A]/60"
                >
                  {isSubmittingAddMoney ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>SENDING...</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 stroke-[3]" />
                      <span>SEND (টাকা পাঠান)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
