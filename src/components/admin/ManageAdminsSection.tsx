import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminRecord } from '../../types';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  createNewAdmin,
  removeAdmin,
  subscribeAllAdmins,
  updateAdminAvatar,
  formatAdminDisplayContact,
  normalizePhoneNumber,
} from '../../services/adminService';
import {
  ADMIN_CARTOON_AVATARS,
  getAdminAvatarUrl,
  pickNextUniqueAdminAvatarId,
  resolveAdminAvatarId,
} from '../../constants/adminAvatars';
import { ToastNotification } from '../common/ToastNotification';
import { useLockBodyScroll } from '../../utils/scrollLock';
import {
  Shield,
  Crown,
  UserPlus,
  Users,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Phone,
  Lock,
  User,
  Edit3,
  Check,
  X,
} from 'lucide-react';

interface ManageAdminsSectionProps {
  onNavigate?: (page: string, params?: any) => void;
  showBackButton?: boolean;
}

export const ManageAdminsSection: React.FC<ManageAdminsSectionProps> = ({
  onNavigate,
  showBackButton = false,
}) => {
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Add New Admin form state (Name, Phone Number, 6-digit Password only)
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Remove confirmation modal state
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<AdminRecord | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Change Cartoon Avatar modal state
  const [avatarPickerAdmin, setAvatarPickerAdmin] = useState<{
    admin: AdminRecord;
    index: number;
  } | null>(null);
  const [pendingAvatarId, setPendingAvatarId] = useState<string>('');
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useLockBodyScroll(Boolean(confirmRemoveAdmin || avatarPickerAdmin));

  // Map of avatarId -> Admin owning it (ensures unique avatars per admin)
  const avatarOwnerById = useMemo(() => {
    const map = new Map<string, { uid: string; displayName: string; index: number }>();
    admins.forEach((admin, idx) => {
      const resolvedId = resolveAdminAvatarId(admin.avatarId, idx);
      if (!map.has(resolvedId)) {
        map.set(resolvedId, {
          uid: admin.uid,
          displayName: admin.displayName || `Admin ${idx + 1}`,
          index: idx,
        });
      }
    });
    return map;
  }, [admins]);

  // Auto-select an unused Cartoon Avatar internally
  const autoSelectedNewAvatarId = useMemo(
    () => pickNextUniqueAdminAvatarId(admins, null),
    [admins]
  );

  // Only Main Admin (Super Admin / Admin 1) can view Admin List and Add/Delete Admins
  const primaryAdmin = admins[0];
  const primaryAdminUid = primaryAdmin?.uid || '';
  const primaryAdminEmail = (primaryAdmin?.email || '').trim().toLowerCase();
  const primaryAdminPhone = normalizePhoneNumber(primaryAdmin?.phoneNumber || '');
  const actorEmail = (currentUser?.email || userProfile?.email || '').trim().toLowerCase();
  const actorPhone = normalizePhoneNumber(
    currentUser?.phoneNumber || userProfile?.phoneNumber || ''
  );

  const isActingMainAdmin = Boolean(
    isAdmin &&
      isSuperAdmin &&
      currentUser?.uid &&
      (actorEmail === BOOTSTRAP_ADMIN_EMAIL ||
        !primaryAdminUid ||
        primaryAdminUid === currentUser.uid ||
        (primaryAdminEmail && actorEmail && primaryAdminEmail === actorEmail) ||
        (primaryAdminPhone && actorPhone && primaryAdminPhone === actorPhone) ||
        isSuperAdmin)
  );

  useEffect(() => {
    if (!isAdmin || !isSuperAdmin) {
      setAdmins([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const unsub = subscribeAllAdmins((list) => {
      setAdmins(list);
      setLoadingList(false);
    });
    return () => unsub();
  }, [isAdmin, isSuperAdmin]);

  if (!isAdmin || !isSuperAdmin) {
    return (
      <div className="p-8 rounded-3xl bg-[#0D1428] border border-red-500/30 shadow-2xl text-center space-y-4 max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black font-gaming text-white">
          Main Admin Access Only
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Only Main Admin can view the Admin List and add new administrators.
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(isAdmin ? 'admin' : 'home')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
          >
            {isAdmin ? 'Back to Admin Dashboard' : 'Back to Home'}
          </button>
        )}
      </div>
    );
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isActingMainAdmin) return;

    setFormFeedback(null);

    const cleanPassword = password.trim();
    if (!/^\d{6}$/.test(cleanPassword)) {
      setFormFeedback({
        type: 'error',
        text: 'Password must be a 6-digit number (exactly 6 digits).',
      });
      return;
    }

    setSubmitting(true);

    const res = await createNewAdmin({
      name,
      contact,
      password: cleanPassword,
      role: 'ADMIN',
      avatarId: autoSelectedNewAvatarId,
      createdByUid: currentUser.uid,
      createdByEmail: currentUser.email || userProfile?.email || '',
      isActingAdmin: isAdmin,
      isActingSuperAdmin: isActingMainAdmin,
    });

    setSubmitting(false);
    if (res.success) {
      setFormFeedback({ type: 'success', text: res.message });
      setToastMessage(res.message);
      setName('');
      setContact('');
      setPassword('');
    } else {
      setFormFeedback({ type: 'error', text: res.message });
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveAdmin || !currentUser || !isActingMainAdmin) return;

    const target = confirmRemoveAdmin;
    if (
      target.uid === currentUser.uid ||
      target.uid === admins[0]?.uid ||
      target.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL
    ) {
      setConfirmRemoveAdmin(null);
      setToastMessage('Admin 1 (Main Admin) cannot be deleted.');
      return;
    }

    setRemovingUid(target.uid);
    const res = await removeAdmin({
      targetAdmin: target,
      actingUid: currentUser.uid,
      actingEmail: currentUser.email || userProfile?.email || '',
      isActingAdmin: isAdmin,
      isActingSuperAdmin: isActingMainAdmin,
      isTargetFirstAdmin: admins[0]?.uid === target.uid,
    });
    setRemovingUid(null);
    setConfirmRemoveAdmin(null);
    setToastMessage(res.message);
  };

  const openAvatarPicker = (admin: AdminRecord, idx: number) => {
    setAvatarPickerAdmin({ admin, index: idx });
    setPendingAvatarId(resolveAdminAvatarId(admin.avatarId, idx));
  };

  const handleSaveAvatar = async () => {
    if (!avatarPickerAdmin || !currentUser || !pendingAvatarId) return;

    const owner = avatarOwnerById.get(pendingAvatarId);
    if (owner && owner.uid !== avatarPickerAdmin.admin.uid) {
      setToastMessage(
        `এই Avatar টি ইতিমধ্যে Admin ${owner.index + 1} (${owner.displayName}) ব্যবহার করছেন। অন্য একটি সিলেক্ট করুন।`
      );
      return;
    }

    setSavingAvatar(true);
    const res = await updateAdminAvatar({
      targetAdmin: avatarPickerAdmin.admin,
      avatarId: pendingAvatarId,
      actingUid: currentUser.uid,
      actingEmail: currentUser.email || userProfile?.email || '',
      isActingAdmin: isAdmin,
      isActingSuperAdmin: isActingMainAdmin,
    });
    setSavingAvatar(false);

    if (res.success) {
      setAvatarPickerAdmin(null);
    }
    setToastMessage(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          {showBackButton && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Control Center</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-gaming uppercase tracking-widest">
            <Crown className="w-4 h-4" />
            <span>Admin Team Control</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-gaming text-white mt-1">
            Manage Admins
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Only Main Admin can view the Admin List and add new Admins with Name, Phone Number &amp; 6-digit Password.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-[#0D1428] border border-sky-500/25 text-center shrink-0">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            Total Admins
          </span>
          <span className="text-lg font-black font-gaming text-sky-400">
            {admins.length}
          </span>
        </div>
      </div>

      {/* Add New Admin Card — Visible ONLY to Admin 1 (Main Admin / Super Admin) */}
      {isActingMainAdmin && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0D1428] border border-sky-500/25 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-white">
                Add New Admin
              </h3>
              <p className="text-[11px] text-slate-400">
                New admins can sign in on the Admin Login page using their Admin Number + Password.
              </p>
            </div>
          </div>

          {formFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                formFeedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/40 text-red-200'
              }`}
            >
              {formFeedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{formFeedback.text}</span>
            </div>
          )}

          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahim"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {/* 2. Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {/* 3. 6-Digit Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  6-Digit Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    inputMode="numeric"
                    minLength={6}
                    maxLength={6}
                    pattern="\d{6}"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="6-digit password"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-sky-400 font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold font-gaming text-xs sm:text-sm tracking-wider shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? 'Adding Admin...' : 'Add Admin'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* All Admins List Card — Visible ONLY to Main Admin */}
      <div className="rounded-2xl bg-[#0D1428] border border-sky-500/25 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-white">
              All Admins ({admins.length})
            </h3>
          </div>
          <span className="text-[11px] text-amber-300 font-semibold">
            Visible only to Main Admin
          </span>
        </div>

        {loadingList ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading admins list...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No admins found.
          </div>
        ) : (
          <div>
            {/* Column Header */}
            <div className="bg-[#111D35] border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 text-[10px] sm:text-[11px] font-bold font-gaming uppercase tracking-wider text-sky-400">
              <span>Admin List Name</span>
              <span className="text-right">Number & Action</span>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs sm:text-sm">
              {admins.map((admin, idx) => {
                const isMainAdmin = idx === 0;
                const isSelf = admin.uid === currentUser?.uid;
                const canDelete = isActingMainAdmin && !isMainAdmin && !isSelf;
                const canChangeAvatar = isActingMainAdmin || isSelf;
                const contactInfo = formatAdminDisplayContact(admin);
                const avatarUrl = getAdminAvatarUrl(admin.avatarId, idx);

                return (
                  <div
                    key={admin.uid}
                    className="px-4 sm:px-6 py-3.5 hover:bg-[#111D35]/60 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4"
                  >
                    {/* Left: Cartoon Avatar + Admin Name + Main/Access Badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-full overflow-hidden shrink-0 border-2 shadow-sm bg-[#0D1428] ${
                          isMainAdmin
                            ? 'border-amber-400/75 shadow-amber-500/20'
                            : 'border-sky-400/65 shadow-sky-500/15'
                        }`}
                      >
                        <img
                          src={avatarUrl}
                          alt={`${admin.displayName} Cartoon Avatar`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white truncate">
                            Admin {idx + 1} - {admin.displayName}
                          </span>
                          {isMainAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase shrink-0">
                              Main
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-gaming bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                            <Shield className="w-2.5 h-2.5" />
                            Full Admin
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Admin Number + Change Avatar + Delete buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-14 sm:pl-0 shrink-0 flex-wrap">
                      <div className="text-left sm:text-right mr-1">
                        <span className="font-mono font-semibold text-slate-200 block text-xs sm:text-sm">
                          {contactInfo.primary}
                        </span>
                        {contactInfo.secondary && (
                          <span className="text-[11px] text-slate-400 block">
                            {contactInfo.secondary}
                          </span>
                        )}
                      </div>

                      {canChangeAvatar && (
                        <button
                          type="button"
                          onClick={() => openAvatarPicker(admin, idx)}
                          aria-label={`Change Avatar for ${admin.displayName}`}
                          title="Change Cartoon Avatar"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/35 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Avatar</span>
                        </button>
                      )}

                      {/* Delete Button — Visible ONLY to Admin 1 (Main Admin), NEVER on Main Admin row */}
                      {isActingMainAdmin && canDelete && (
                        <button
                          type="button"
                          disabled={removingUid === admin.uid}
                          onClick={() => setConfirmRemoveAdmin(admin)}
                          aria-label={`Delete Admin ${admin.displayName}`}
                          title="Delete Admin"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/60 shadow-sm shadow-red-950/40 text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {removingUid === admin.uid ? 'Deleting...' : 'Delete'}
                          </span>
                        </button>
                      )}

                      {isActingMainAdmin && !canDelete && isMainAdmin && (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#111D35] border border-amber-500/30 text-[10px] font-bold text-amber-300 shrink-0">
                          {isSelf ? 'Main Admin (You)' : 'Main Admin'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Change Cartoon Avatar Modal */}
      {avatarPickerAdmin && (
        <div
          onClick={() => {
            if (!savingAvatar) setAvatarPickerAdmin(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-admin-avatar-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#0D1428] border border-sky-500/40 p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="change-admin-avatar-title"
                  className="text-base sm:text-lg font-black font-gaming text-white"
                >
                  Change Cartoon Avatar
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Admin {avatarPickerAdmin.index + 1} - {avatarPickerAdmin.admin.displayName}. Choose a unique gaming avatar not used by any other admin.
                </p>
              </div>
              <button
                type="button"
                disabled={savingAvatar}
                onClick={() => setAvatarPickerAdmin(null)}
                className="p-1.5 rounded-lg bg-[#111D35] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ADMIN_CARTOON_AVATARS.map((avatar) => {
                const owner = avatarOwnerById.get(avatar.id);
                const usedByOther =
                  owner && owner.uid !== avatarPickerAdmin.admin.uid;
                const isSelected = pendingAvatarId === avatar.id;

                return (
                  <button
                    key={avatar.id}
                    type="button"
                    disabled={Boolean(usedByOther) || savingAvatar}
                    onClick={() => setPendingAvatarId(avatar.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 ring-2 ring-sky-400/35 cursor-pointer'
                        : usedByOther
                        ? 'bg-[#111D35]/60 border-slate-800 opacity-45 cursor-not-allowed'
                        : 'bg-[#111D35] border-slate-800 hover:border-sky-500/40 cursor-pointer'
                    }`}
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700 bg-[#0D1428]">
                      <img
                        src={avatar.url}
                        alt={avatar.label}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center border border-[#0D1428]">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="w-full">
                      <span className="text-[11px] font-bold text-white block truncate">
                        {avatar.label}
                      </span>
                      {usedByOther && (
                        <span className="text-[9px] text-amber-400 font-semibold block truncate">
                          Used: Admin {owner.index + 1}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={savingAvatar}
                onClick={() => setAvatarPickerAdmin(null)}
                className="px-4 py-2 rounded-xl bg-[#111D35] hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAvatar}
                onClick={handleSaveAvatar}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white text-xs font-bold font-gaming flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingAvatar ? 'Saving...' : 'Save Avatar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Admin Modal (Accessible only by Admin 1) */}
      {isActingMainAdmin && confirmRemoveAdmin && (
        <div
          onClick={() => {
            if (!removingUid) setConfirmRemoveAdmin(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-admin-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#0D1428] border border-red-500/40 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="confirm-delete-admin-title"
                  className="text-base font-black font-gaming text-white leading-snug"
                >
                  Are you sure? Ei Admin ke delete korte chao?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Yes dile ei Admin All Admins list ebong Our Admins theke permanent vabe delete hoye jabe.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 text-xs space-y-1">
              <p className="text-white font-bold">
                Name: {confirmRemoveAdmin.displayName}
              </p>
              <p className="text-slate-300 font-mono">
                Number:{' '}
                {formatAdminDisplayContact(confirmRemoveAdmin).primary}
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={removingUid === confirmRemoveAdmin.uid}
                onClick={() => setConfirmRemoveAdmin(null)}
                className="px-4 py-2 rounded-xl bg-[#111D35] hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingUid === confirmRemoveAdmin.uid}
                onClick={handleConfirmRemove}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-gaming flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {removingUid === confirmRemoveAdmin.uid ? 'Deleting...' : 'Yes'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <ToastNotification
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
