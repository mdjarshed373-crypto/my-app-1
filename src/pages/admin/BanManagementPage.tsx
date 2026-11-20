import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../services/firestoreError';
import { formatAdminDisplayContact } from '../../services/adminService';
import { isUserSuperAdminAccount, isUserAdminAccount } from '../../utils/adminAuth';
import { UserAvatar } from '../../components/common/UserAvatar';
import {
  BAN_REASONS,
  BAN_DURATIONS,
  BanReason,
  BanDuration,
  isUserCurrentlyBanned,
  formatBanStatusLabel,
  banUserAccount,
  unbanUserAccount,
} from '../../services/banService';
import {
  Ban,
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  X,
} from 'lucide-react';

interface BanManagementPageProps {
  onNavigate?: (page: string, params?: any) => void;
  onBack?: () => void;
}

export const BanManagementPage: React.FC<BanManagementPageProps> = ({
  onNavigate,
  onBack,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const isUserAdmin = Boolean(
    currentUser &&
      userProfile &&
      isAdmin &&
      isUserAdminAccount(userProfile, currentUser.email)
  );

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BANNED' | 'ACTIVE'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ban Modal State
  const [banTargetUser, setBanTargetUser] = useState<UserProfile | null>(null);
  const [selectedReason, setSelectedReason] = useState<BanReason>('Hack Use');
  const [selectedDuration, setSelectedDuration] = useState<BanDuration>('Permanent');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [unbanningUid, setUnbanningUid] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        list.push({ ...data, uid: data.uid || d.id });
      });
      // Sort banned users or newest first cleanly
      list.sort((a, b) => {
        const aBan = isUserCurrentlyBanned(a) ? 1 : 0;
        const bBan = isUserCurrentlyBanned(b) ? 1 : 0;
        if (aBan !== bBan) return bBan - aBan;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      setUsersList(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUserAdmin) {
      loadUsers();
    }
  }, [isUserAdmin, loadUsers]);

  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-[#070B18] p-8 text-center text-white flex flex-col items-center justify-center gap-3">
        <Ban className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold font-gaming text-red-400">
          Access Denied - Admin Only
        </h2>
        <button
          type="button"
          onClick={() => (onBack ? onBack() : onNavigate?.('home'))}
          className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  const bannedCount = usersList.filter((u) => isUserCurrentlyBanned(u)).length;
  const activeCount = usersList.length - bannedCount;

  const filteredUsers = usersList.filter((u) => {
    const banned = isUserCurrentlyBanned(u);
    if (statusFilter === 'BANNED' && !banned) return false;
    if (statusFilter === 'ACTIVE' && banned) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const name = (u.displayName || '').toLowerCase();
    const ign = (u.inGameName || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const phone = (u.phoneNumber || '').toLowerCase();
    const ffUid = (u.freeFireUid || '').toLowerCase();
    const uid = (u.uid || '').toLowerCase();
    const email = (u.email || '').toLowerCase();

    return (
      name.includes(q) ||
      ign.includes(q) ||
      username.includes(q) ||
      phone.includes(q) ||
      ffUid.includes(q) ||
      uid.includes(q) ||
      email.includes(q)
    );
  });

  const handleOpenBanModal = (target: UserProfile) => {
    setBanTargetUser(target);
    setSelectedReason('Hack Use');
    setSelectedDuration('Permanent');
    setFeedback(null);
  };

  const handleConfirmBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTargetUser) return;

    setIsProcessing(true);
    setFeedback(null);
    const res = await banUserAccount({
      targetUid: banTargetUser.uid,
      reason: selectedReason,
      duration: selectedDuration,
      adminName: userProfile?.displayName || userProfile?.email || 'Admin',
    });
    setIsProcessing(false);

    setFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });

    if (res.success) {
      setBanTargetUser(null);
      await loadUsers();
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleUnban = async (target: UserProfile) => {
    setUnbanningUid(target.uid);
    setFeedback(null);
    const res = await unbanUserAccount({ targetUid: target.uid });
    setUnbanningUid(null);

    setFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });

    if (res.success) {
      await loadUsers();
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B18] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : onNavigate?.('profile'))}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-slate-700 text-slate-200 text-xs font-bold font-gaming transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-sky-400" />
          <span>Back to Profile</span>
        </button>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-sky-500/30 text-sky-400 text-xs font-bold font-gaming transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-red-500/35 shadow-2xl space-y-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/10">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black font-gaming uppercase tracking-wide text-white">
              Ban Users / Manage Ban
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Ban hackers, cheaters &amp; manage banned users
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-[#111D35] border border-slate-800 text-center">
            <span className="text-lg sm:text-xl font-black font-gaming text-white block tabular-nums">
              {usersList.length}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
              Total Users
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#111D35] border border-red-500/30 text-center">
            <span className="text-lg sm:text-xl font-black font-gaming text-red-500 block tabular-nums">
              {bannedCount}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-red-400">
              Banned Users
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-[#111D35] border border-emerald-500/30 text-center">
            <span className="text-lg sm:text-xl font-black font-gaming text-emerald-400 block tabular-nums">
              {activeCount}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">
              Active Users
            </span>
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

        {/* Search Box & Filter Pills */}
        <div className="space-y-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Phone, or UID..."
              className="w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-xl bg-[#111D35] border border-sky-500/30 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-sky-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'ALL', label: `All Users (${usersList.length})` },
                { id: 'BANNED', label: `Banned (${bannedCount})` },
                { id: 'ACTIVE', label: `Active (${activeCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-gaming transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? tab.id === 'BANNED'
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                      : 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                    : 'bg-[#111D35] text-slate-400 hover:text-white border border-slate-700/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 rounded-3xl bg-[#0D1428] border border-slate-800 text-center space-y-2.5">
            <div className="w-9 h-9 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading users list...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 rounded-3xl bg-[#0D1428] border border-slate-800 text-center space-y-2">
            <Users className="w-9 h-9 text-slate-500 mx-auto" />
            <p className="text-xs sm:text-sm text-slate-400">
              {searchQuery
                ? `No users found matching "${searchQuery}"`
                : 'No users found in this category.'}
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const banned = isUserCurrentlyBanned(u);
            const contactInfo = formatAdminDisplayContact(u);
            const isSuper = isUserSuperAdminAccount(u, u.email);
            const isSelf = userProfile?.uid === u.uid;

            return (
              <div
                key={u.uid}
                className={`p-4 sm:p-5 rounded-2xl bg-[#0D1428] border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  banned
                    ? 'border-red-500/60 shadow-lg shadow-red-950/20'
                    : 'border-slate-800 hover:border-sky-500/30'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <UserAvatar user={u} size="md" className="shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm sm:text-base truncate">
                        {u.inGameName || u.displayName || 'Player'}
                      </span>

                      {banned && (
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black font-gaming uppercase tracking-wider shadow-sm">
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

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>
                        Phone: <strong className="text-slate-200">{contactInfo.primary}</strong>
                      </span>
                      {u.freeFireUid && (
                        <span>
                          • FF UID:{' '}
                          <strong className="text-amber-300 font-mono">{u.freeFireUid}</strong>
                        </span>
                      )}
                      <span>
                        • UID: <strong className="text-slate-300 font-mono">{u.uid}</strong>
                      </span>
                    </div>

                    {banned && (
                      <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 border border-red-500/35 text-[11px] text-red-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Reason: <strong className="text-red-400">{u.banReason || 'Hack Use'}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-red-400" />
                          <span>{formatBanStatusLabel(u)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button: BAN or UNBAN */}
                <div className="w-full sm:w-auto flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  {banned ? (
                    <button
                      type="button"
                      disabled={unbanningUid === u.uid}
                      onClick={() => handleUnban(u)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-black font-gaming text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{unbanningUid === u.uid ? 'UNBANNING...' : 'UNBAN'}</span>
                    </button>
                  ) : isSuper || isSelf ? (
                    <span className="px-3 py-1.5 rounded-xl bg-[#111D35] border border-slate-700 text-slate-400 text-[11px] font-bold font-gaming">
                      Protected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenBanModal(u)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black font-gaming text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-md shadow-red-600/25 transition-all cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>BAN</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* BAN USER CONFIRMATION MODAL */}
      {banTargetUser && (
        <div
          onClick={() => !isProcessing && setBanTargetUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-user-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#0D1428] border-2 border-red-500/60 p-5 sm:p-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-500">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="ban-user-modal-title"
                    className="text-base font-black font-gaming text-white uppercase tracking-wider"
                  >
                    Ban User Account
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Target:{' '}
                    <strong className="text-white">
                      {banTargetUser.inGameName || banTargetUser.displayName}
                    </strong>
                    {banTargetUser.phoneNumber ? ` (${banTargetUser.phoneNumber})` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setBanTargetUser(null)}
                aria-label="Close"
                className="p-1.5 rounded-xl bg-[#111D35] hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBan} className="space-y-4 text-xs">
              {/* Reason Selection */}
              <div>
                <label className="block text-slate-200 font-bold uppercase tracking-wider mb-2">
                  Ban Reason *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BAN_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`py-2.5 px-3 rounded-xl border font-bold font-gaming text-xs transition-all cursor-pointer ${
                        selectedReason === reason
                          ? 'bg-red-600 text-white border-red-400 shadow-md shadow-red-600/30'
                          : 'bg-[#111D35] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration / Somoy Selection */}
              <div>
                <label className="block text-slate-200 font-bold uppercase tracking-wider mb-2">
                  Ban Somoy (Duration) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BAN_DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setSelectedDuration(duration)}
                      className={`py-2.5 px-2.5 rounded-xl border font-bold font-gaming text-xs transition-all cursor-pointer ${
                        selectedDuration === duration
                          ? 'bg-amber-500 text-black border-amber-300 shadow-md shadow-amber-500/25'
                          : 'bg-[#111D35] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-[11px] space-y-1">
                <span className="font-bold text-red-400 uppercase block text-[10px]">
                  User Login / Block Message:
                </span>
                <p className="font-semibold">
                  Your Account Has Been Banned - Reason: {selectedReason}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setBanTargetUser(null)}
                  className="py-3 rounded-2xl bg-[#111D35] hover:bg-slate-800 text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="py-3 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black font-gaming text-xs tracking-wider uppercase shadow-xl shadow-red-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isProcessing ? 'BANNING...' : 'Confirm Ban'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
