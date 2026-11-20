import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { fetchUserRegistrations } from '../services/tournamentService';
import { getWalletBreakdown, subscribePendingWithdrawals } from '../services/walletService';
import {
  isFingerprintLoginEnabled,
  setFingerprintLoginEnabled,
  hasSavedFingerprintForUser,
  registerDeviceFingerprint,
} from '../services/biometricAuthService';
import { saveUserAvatar } from '../services/avatarStorageService';
import {
  isValidBDPhoneNumber,
  normalizeBDPhoneNumber,
} from '../services/playerAuthService';
import { UserAvatar } from '../components/common/UserAvatar';
import { AvatarCropModal } from '../components/profile/AvatarCropModal';
import {
  User,
  Gamepad2,
  Mail,
  Phone,
  Shield,
  Wallet,
  Edit3,
  CheckCircle,
  AlertCircle,
  Award,
  ArrowUpRight,
  BookOpen,
  Code2,
  LogOut,
  ChevronRight,
  Copy,
  Check,
  X,
  MessageSquare,
  Moon,
  Fingerprint,
  Camera,
  Maximize2,
  Megaphone,
  Users,
  Ban,
  Gift,
  Crown,
  Trophy,
} from 'lucide-react';
import { breakoutToStandalone } from '../utils/fullscreen';
import { NoticeManagerSection } from '../components/profile/NoticeManagerSection';
import { AllUsersAddMoneySection } from '../components/profile/AllUsersAddMoneySection';
import { isUserAdminAccount } from '../utils/adminAuth';
import { isUserCurrentlyBanned } from '../services/banService';
import { subscribeWeeklyTopPlayers } from '../services/weeklyLeaderboardService';

interface ProfilePageProps {
  onNavigate?: (page: string, params?: any) => void;
  onOpenAuth?: () => void;
  onLogoutSuccess?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigate,
  onOpenAuth,
  onLogoutSuccess,
}) => {
  const { currentUser, userProfile, updatePlayerProfile, logout, isAdmin, refreshProfile } = useAuth();
  const { language, t, formatBDT } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const isUserAdmin = Boolean(
    currentUser &&
      userProfile &&
      isAdmin &&
      isUserAdminAccount(userProfile, currentUser.email)
  );

  const [activePanel, setActivePanel] = useState<'none' | 'myProfile' | 'developer' | 'notice' | 'allUsers'>('none');
  const noticeRef = React.useRef<HTMLDivElement | null>(null);
  const allUsersRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activePanel === 'notice') {
      setTimeout(() => {
        noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else if (activePanel === 'allUsers') {
      setTimeout(() => {
        allUsersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [activePanel]);

  useEffect(() => {
    if (!isUserAdmin) {
      setPendingWithdrawCount(0);
      return;
    }
    const unsub = subscribePendingWithdrawals((list) => {
      setPendingWithdrawCount(list.length);
    });
    return () => unsub();
  }, [isUserAdmin]);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [inGameName, setInGameName] = useState(userProfile?.inGameName || '');
  const [freeFireUid, setFreeFireUid] = useState(userProfile?.freeFireUid || '');
  const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [fingerprintEnabled, setFingerprintEnabled] = useState<boolean>(() =>
    isFingerprintLoginEnabled()
  );
  const [copiedDevPhone, setCopiedDevPhone] = useState(false);
  const [copiedDevEmail, setCopiedDevEmail] = useState(false);
  const [joinedRegsCount, setJoinedRegsCount] = useState<number>(0);
  const [rank1WeeklyUid, setRank1WeeklyUid] = useState<string | null>(null);
  const [pendingWithdrawCount, setPendingWithdrawCount] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Edit Profile Popup modal states
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditProfileModal = () => {
    setEditFullName(userProfile?.displayName || userProfile?.inGameName || '');
    setEditPhoneNumber(userProfile?.phoneNumber || '');
    setEditModalError(null);
    setIsEditProfileModalOpen(true);
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditModalError(null);

    const cleanName = editFullName.trim();
    const cleanPhone = editPhoneNumber.trim();

    if (!cleanName || cleanName.length < 3) {
      setEditModalError('Enter valid name / number (Name minimum 3 letters)');
      return;
    }

    if (!isValidBDPhoneNumber(cleanPhone)) {
      setEditModalError('Enter valid name / number (11 digit Bangladeshi number)');
      return;
    }

    const normPhone = normalizeBDPhoneNumber(cleanPhone);
    setIsSavingEdit(true);

    try {
      await updatePlayerProfile({
        displayName: cleanName,
        inGameName: cleanName,
        phoneNumber: normPhone,
      });

      setDisplayName(cleanName);
      setInGameName(cleanName);
      setPhone(normPhone);

      setIsEditProfileModalOpen(false);
      setMessage({
        type: 'success',
        text: 'Profile updated successfully!',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditModalError(err.message);
      } else {
        setEditModalError('Failed to save profile changes. Please try again.');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setInGameName(userProfile.inGameName || '');
      setFreeFireUid(userProfile.freeFireUid || '');
      setPhone(userProfile.phoneNumber || '');
      setAvatarUrl(userProfile.avatarUrl || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!currentUser) {
      setJoinedRegsCount(0);
      return;
    }
    let mounted = true;
    fetchUserRegistrations(currentUser.uid)
      .then((regs) => {
        if (mounted) {
          setJoinedRegsCount(regs.length);
        }
      })
      .catch(() => {
        // fallback to profile counters
      });
    return () => {
      mounted = false;
    };
  }, [currentUser, userProfile?.totalTournaments, userProfile?.totalMatches]);

  useEffect(() => {
    const unsub = subscribeWeeklyTopPlayers(1, (snapshot) => {
      setRank1WeeklyUid(snapshot.rank1Uid);
    });
    return () => unsub();
  }, []);

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-[#070B18] py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div className="p-8 rounded-3xl bg-[#0D1428] border border-sky-500/25 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center mx-auto text-white shadow-lg shadow-sky-500/25">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-white">
              {language === 'bn' ? 'আপনার প্রোফাইল দেখুন' : 'Sign In to View Profile'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              {language === 'bn'
                ? 'ম্যাচ স্ট্যাটাস, ওয়ালেট ব্যালেন্স এবং টুর্নামেন্ট প্রোফাইল দেখতে লগইন করুন।'
                : 'Log in or create an account to track matches joined, wallet balance, and wins.'}
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

  // Real database stats — all start at 0 for new users
  const matchesJoined = Math.max(
    Number(userProfile.totalMatches || 0),
    Number(userProfile.totalTournaments || 0),
    joinedRegsCount
  );
  const { availableBalance: walletBalance } =
    getWalletBreakdown(userProfile);
  const matchesWon = Number(userProfile.totalWins || 0);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updatePlayerProfile({
        displayName: displayName.trim(),
        inGameName: inGameName.trim(),
        freeFireUid: freeFireUid.trim(),
        phoneNumber: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setMessage({
        type: 'success',
        text: language === 'bn' ? 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে!' : 'Profile updated successfully!',
      });
      setIsEditing(false);
    } catch (err: unknown) {
      if (err instanceof Error) setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({
        type: 'error',
        text: language === 'bn' ? 'দয়া করে একটি বৈধ ছবি নির্বাচন করুন।' : 'Please select a valid image file.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedAvatar = async (croppedBase64: string) => {
    setAvatarUrl(croppedBase64);
    saveUserAvatar(userProfile, croppedBase64);
    setCropImageSrc(null);
    try {
      await updatePlayerProfile({ avatarUrl: croppedBase64 });
    } catch {
      // Saved immediately in localStorage even if network/Firestore is unavailable
    }
  };

  const handleToggleFingerprint = async () => {
    const next = !fingerprintEnabled;
    if (next && userProfile) {
      const candidate = {
        uid: userProfile.uid,
        email: userProfile.email || '',
        identifier:
          userProfile.email ||
          userProfile.phoneNumber ||
          userProfile.username ||
          userProfile.uid,
        phoneNumber: userProfile.phoneNumber || '',
        displayName:
          userProfile.inGameName || userProfile.displayName || 'Player',
        role: userProfile.role,
      };
      if (!hasSavedFingerprintForUser(candidate)) {
        try {
          await registerDeviceFingerprint(candidate);
          setFingerprintEnabled(true);
          setFingerprintLoginEnabled(true);
        } catch {
          setFingerprintEnabled(false);
          setFingerprintLoginEnabled(false);
        }
        return;
      }
    }
    setFingerprintEnabled(next);
    setFingerprintLoginEnabled(next);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      if (onLogoutSuccess) {
        onLogoutSuccess();
      } else {
        onNavigate?.('home');
        onOpenAuth?.();
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCopyDev = (value: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(value);
    if (type === 'phone') {
      setCopiedDevPhone(true);
      setTimeout(() => setCopiedDevPhone(false), 2000);
    } else {
      setCopiedDevEmail(true);
      setTimeout(() => setCopiedDevEmail(false), 2000);
    }
  };

  const badges = [
    {
      title: 'Verified Gamer',
      desc: 'Free Fire UID Linked',
      earned: !!userProfile.freeFireUid,
      color: 'from-blue-600 to-sky-400',
    },
    {
      title: 'Tournament Veteran',
      desc: 'Joined 5+ Matches',
      earned: matchesJoined >= 5,
      color: 'from-purple-600 to-indigo-400',
    },
    {
      title: 'Top Gunner',
      desc: '20+ Lifetime Kills',
      earned: (userProfile.totalKills || 0) >= 20,
      color: 'from-red-600 to-rose-400',
    },
    {
      title: 'Cash Winner',
      desc: 'Earned ৳500+ in Prizes',
      earned: (userProfile.totalEarnings || 0) >= 500,
      color: 'from-amber-500 to-yellow-300',
    },
  ];

  const gameCenterItems = [
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      isNew: true,
      sublabel:
        language === 'bn'
          ? 'সেরা খেলোয়াড়, চ্যাম্পিয়ন ও র‍্যাঙ্কিং'
          : 'Esports Hall of Fame & top rankings',
      icon: Crown,
      iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
      iconClass: 'fill-amber-400/25',
      onClick: () => onNavigate?.('leaderboard'),
    },
    {
      id: 'referAndEarn',
      label: 'Refer & Earn',
      sublabel: 'Invite Friends, Earn 10 Taka',
      icon: Gift,
      iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      onClick: () => onNavigate?.('referAndEarn'),
    },
    {
      id: 'allRules',
      label: 'All Rules',
      sublabel: language === 'bn' ? 'সব ম্যাচ ও টুর্নামেন্টের নিয়মাবলী' : 'Official match & category rules',
      icon: BookOpen,
      iconBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      onClick: () => onNavigate?.('rules'),
    },
  ];

  const topMenuItems = [
    {
      id: 'myProfile',
      label: 'My Profile',
      sublabel: userProfile.freeFireUid
        ? `UID: ${userProfile.freeFireUid}`
        : language === 'bn'
        ? 'নাম, FF UID ও ফোন নম্বর দেখুন / এডিট করুন'
        : 'View & edit IGN, Free Fire UID, phone',
      icon: User,
      iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      active: activePanel === 'myProfile',
      onClick: () => {
        setMessage(null);
        setActivePanel((prev) => (prev === 'myProfile' ? 'none' : 'myProfile'));
      },
    },
  ];

  const bottomMenuItems = [
    {
      id: 'fullscreenApp',
      label: 'Fullscreen App Mode',
      sublabel: 'Open standalone Play Store view (No AI Studio bar)',
      icon: Maximize2,
      iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      onClick: () => {
        breakoutToStandalone();
      },
    },
    {
      id: 'developerProfile',
      label: 'Developer Profile',
      sublabel: 'TX TOUR BD Official Dev & Support',
      icon: Code2,
      iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      active: activePanel === 'developer',
      onClick: () => {
        setActivePanel((prev) => (prev === 'developer' ? 'none' : 'developer'));
      },
    },
    {
      id: 'logout',
      label: loggingOut ? (language === 'bn' ? 'লগআউট হচ্ছে...' : 'Logging out...') : 'Logout',
      sublabel: language === 'bn' ? 'একাউন্ট থেকে সাইন আউট করুন' : 'Sign out of your account',
      icon: LogOut,
      iconBg: 'bg-red-500/15 text-red-400 border-red-500/30',
      danger: true,
      onClick: handleLogout,
    },
    ...(isUserAdmin
      ? [
          {
            id: 'notice',
            label: 'Send Notice / Notice',
            sublabel:
              language === 'bn'
                ? 'হোম পেজে নোটিশ পাঠান ও পুরানো নোটিশ ডিলিট'
                : 'Broadcast notice to Home & manage notices',
            icon: Megaphone,
            iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
            active: activePanel === 'notice',
            onClick: () => {
              setMessage(null);
              setActivePanel((prev) => (prev === 'notice' ? 'none' : 'notice'));
            },
          },
          {
            id: 'allUsers',
            label: 'All Users / Add Money',
            sublabel:
              language === 'bn'
                ? 'সকল ইউজার লিস্ট, সার্চ ও টাকা পাঠান'
                : 'Search all users & add Winning / Deposited money',
            icon: Users,
            iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
            active: activePanel === 'allUsers',
            onClick: () => {
              setMessage(null);
              setActivePanel((prev) => (prev === 'allUsers' ? 'none' : 'allUsers'));
            },
          },
          {
            id: 'banManagement',
            label: 'Ban Users / Manage Ban',
            sublabel: 'Ban hackers, cheaters & manage banned users',
            icon: Ban,
            iconBg: 'bg-red-500/15 text-red-400 border-red-500/40',
            onClick: () => {
              setMessage(null);
              onNavigate?.('banManagement');
            },
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#070B18] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-5">
      {/* Top Profile Header + 3 Real Stats Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-[#0D1428] border border-sky-500/25 shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top-Right Edit Profile Icon Button */}
        <button
          type="button"
          onClick={handleOpenEditProfileModal}
          title="Edit Profile"
          className="absolute top-4 right-4 z-10 p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-xl bg-[#0A0A0A] hover:bg-[#1A1408] border border-[#CFA84B]/60 text-[#F4D77A] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#CFA84B]/15 cursor-pointer active:scale-95"
        >
          <Edit3 className="w-4 h-4 text-[#F4D77A]" />
          <span className="hidden sm:inline font-gaming">{language === 'bn' ? 'এডিট' : 'Edit'}</span>
        </button>

        {/* Centered Top Circular Profile Photo + Blue Camera Upload Button + Name & Phone Below */}
        <div className="flex flex-col items-center text-center pt-1">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full rounded-full cursor-pointer"
              title="Tap to change profile photo"
            >
              <UserAvatar user={userProfile} size="xl" />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload Profile Photo"
              title="Choose photo from Gallery"
              className="keep-dark-surface absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white border-2 border-[#0D1428] shadow-lg shadow-blue-600/40 flex items-center justify-center cursor-pointer transition-all z-10"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryFileChange}
              className="hidden"
            />
          </div>

          <div className="mt-3.5 flex items-center justify-center gap-2 max-w-full flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-white truncate">
              {userProfile.displayName || userProfile.inGameName}
            </h1>
            {isUserCurrentlyBanned(userProfile) && (
              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black font-gaming uppercase tracking-wider">
                BANNED
              </span>
            )}
          </div>

          {rank1WeeklyUid && userProfile.uid === rank1WeeklyUid && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black text-[10px] sm:text-xs font-black font-gaming uppercase tracking-wider shadow-lg shadow-amber-500/30 border border-yellow-200">
              <Crown className="w-3.5 h-3.5 fill-black/20 shrink-0" />
              <span>TOP PLAYER OF THE WEEK</span>
            </div>
          )}

          <p className="text-xs sm:text-sm text-[#B8A06A] max-w-full truncate mt-0.5 font-medium">
            {userProfile.phoneNumber || userProfile.email || `@${userProfile.username}`}
          </p>

          {userProfile.freeFireUid && (
            <p className="text-[11px] font-mono font-semibold text-sky-400 mt-1">
              FF UID: {userProfile.freeFireUid}
            </p>
          )}
        </div>

        {/* 3 Real Stats Bar (All start at 0 for new user, from real Firestore DB) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 pt-4 border-t border-slate-800/90">
          {/* 1. Matches Joined */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#070B18] border border-slate-800/90 text-center">
            <span className="text-lg sm:text-2xl font-black font-gaming text-white block">
              {matchesJoined}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-1 block">
              Matches Joined
            </span>
          </div>

          {/* 2. Balance */}
          <div
            onClick={() => onNavigate?.('wallet', { tab: 'overview' })}
            className="p-3.5 sm:p-4 rounded-2xl bg-[#070B18] border border-sky-500/30 text-center cursor-pointer hover:border-sky-400/60 transition-colors"
          >
            <span className="text-lg sm:text-2xl font-black font-gaming text-sky-400 block">
              {formatBDT(walletBalance)}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-1 block">
              Balance
            </span>
          </div>

          {/* 3. Win */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#070B18] border border-amber-500/25 text-center">
            <span className="text-lg sm:text-2xl font-black font-gaming text-amber-400 block">
              {matchesWon}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 mt-1 block">
              Win
            </span>
          </div>
        </div>
      </div>

      {/* Golden Admin Panel Button (ONLY for Admin) */}
      {isUserAdmin && (
        <button
          type="button"
          onClick={() => onNavigate?.('admin', pendingWithdrawCount > 0 ? { tab: 'withdrawals' } : undefined)}
          className="relative w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-black font-gaming text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-[#CFA84B]/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-[#F4D77A]"
        >
          <Shield className="w-5 h-5 fill-black stroke-black" />
          <span>🛡️ Admin Panel</span>
          {pendingWithdrawCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black shadow-md tabular-nums">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>{pendingWithdrawCount} Withdraw</span>
            </span>
          )}
        </button>
      )}

      {/* Expandable Panel: MY PROFILE (View & Edit Real Profile Info) */}
      {activePanel === 'myProfile' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-sky-500/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-white">
                My Profile Details
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-sky-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? t('common.cancel') : language === 'bn' ? 'প্রোফাইল এডিট' : 'Edit Profile'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePanel('none');
                  setIsEditing(false);
                }}
                className="p-1.5 rounded-lg bg-[#111D35] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs ${
                message.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/40 text-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'bn' ? 'পুরো নাম' : 'Display Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-sky-400 mb-1">
                    In-Game Name (IGN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={inGameName}
                    onChange={(e) => setInGameName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sky-400 mb-1">
                    Free Fire UID *
                  </label>
                  <input
                    type="text"
                    required
                    value={freeFireUid}
                    onChange={(e) => setFreeFireUid(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {language === 'bn' ? 'ফোন নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Profile Photo
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3.5 py-2.5 bg-[#111D35] hover:bg-slate-800 border border-slate-700 rounded-xl text-sky-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{language === 'bn' ? 'গ্যালারি থেকে ছবি নির্বাচন করুন' : 'Choose from Gallery'}</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming tracking-wider text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('common.save')}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center gap-3">
                  <Gamepad2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Free Fire UID</span>
                    <span className="font-bold text-white font-mono">
                      {userProfile.freeFireUid || 'Not linked'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center gap-3">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">In-Game Name (IGN)</span>
                    <span className="font-bold text-white">
                      {userProfile.inGameName || userProfile.displayName}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase block">Email Address</span>
                    <span className="font-bold text-white truncate block">{userProfile.email}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center gap-3">
                  <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Phone Number</span>
                    <span className="font-bold text-white">{userProfile.phoneNumber || 'Not added'}</span>
                  </div>
                </div>
              </div>

              {/* Career Badges */}
              <div className="pt-2 space-y-2.5">
                <h3 className="text-[11px] font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Career Achievements
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {badges.map((b, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border ${
                        b.earned
                          ? 'bg-[#111D35] border-sky-500/40 text-white'
                          : 'bg-[#090E1F]/60 border-slate-800 text-slate-500 opacity-65'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-md bg-gradient-to-br ${
                          b.earned ? b.color : 'from-slate-700 to-slate-800'
                        } text-white flex items-center justify-center font-bold text-[11px] mb-1.5`}
                      >
                        ★
                      </div>
                      <h4 className="font-bold text-[11px]">{b.title}</h4>
                      <p className="text-[10px] text-slate-400">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expandable Panel: DEVELOPER PROFILE */}
      {activePanel === 'developer' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#0D1428] border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-white">
                Developer Profile
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="p-1.5 rounded-lg bg-[#111D35] text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#111D35] border border-slate-800">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center font-black font-gaming text-lg text-white shrink-0 shadow-lg">
              TX
            </div>
            <div>
              <h3 className="text-base font-black font-gaming text-white">TX TOUR BD Dev Team</h3>
              <p className="text-xs text-sky-400 font-semibold">
                Official Free Fire Esports Tournament Platform
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'bn'
                  ? 'দ্রুত পেমেন্ট, স্বচ্ছ টুর্নামেন্ট স্লট ম্যানেজমেন্ট ও ২৪/৭ প্লেয়ার সাপোর্টের জন্য নির্মিত।'
                  : 'Built for fair custom room tournaments, fast payouts, and real-time match tracking.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Official Helpline / Payment</span>
                <span className="font-bold font-mono text-white text-sm">01602570739</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyDev('01602570739', 'phone')}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {copiedDevPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDevPhone ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase block">Developer Contact Email</span>
                <span className="font-bold text-white truncate block">support@txtourbd.com</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyDev('support@txtourbd.com', 'email')}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedDevEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDevEmail ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('support')}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{language === 'bn' ? 'সাপোর্ট সেন্টারে যোগাযোগ করুন' : 'Open Support Center'}</span>
          </button>
        </div>
      )}

      {/* GAME CENTER Section */}
      <div className="space-y-2">
        <div className="px-1.5 flex items-center justify-between">
          <span className="text-[11px] font-black font-gaming uppercase tracking-widest text-slate-400">
            GAME CENTER
          </span>
        </div>

        <div className="rounded-3xl bg-[#0D1428] border border-sky-500/20 shadow-xl overflow-hidden divide-y divide-slate-800/80">
          {gameCenterItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer hover:bg-[#111D35]/75"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${item.iconClass || ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold block text-white">
                        {item.label}
                      </span>
                      {item.isNew && (
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-black text-[9px] font-black font-gaming uppercase tracking-wider shadow-sm shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu List: My Profile, Theme, Fingerprint, Fullscreen, Developer Profile, Logout */}
      <div className="rounded-3xl bg-[#0D1428] border border-sky-500/20 shadow-xl overflow-hidden divide-y divide-slate-800/80">
        {topMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                item.active ? 'bg-[#111D35]' : 'hover:bg-[#111D35]/75'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold block text-white">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                    {item.sublabel}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />
            </button>
          );
        })}

        {/* Theme Row: Exactly between Top Players and Developer Profile */}
        <div
          onClick={toggleTheme}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer hover:bg-[#111D35]/75 select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-blue-500 bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm keep-dark-surface">
              <Moon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold block text-white">
                Theme
              </span>
              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                Switch Light/Dark
              </span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Theme Switch Light/Dark"
            onClick={(e) => {
              e.stopPropagation();
              toggleTheme();
            }}
            className={`theme-toggle-track relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-none ${
              isDark ? 'bg-blue-600' : 'bg-slate-400'
            }`}
          >
            <span
              className={`theme-toggle-thumb inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                isDark ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Enable Fingerprint Login ON/OFF Toggle Row */}
        <div
          onClick={handleToggleFingerprint}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer hover:bg-[#111D35]/75 select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold block text-white">
                Enable Fingerprint Login
              </span>
              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                Quick login with fingerprint ({fingerprintEnabled ? 'ON' : 'OFF'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-black font-gaming ${
                fingerprintEnabled ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {fingerprintEnabled ? 'ON' : 'OFF'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={fingerprintEnabled}
              aria-label="Enable Fingerprint Login ON/OFF"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFingerprint();
              }}
              className={`theme-toggle-track relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-none ${
                fingerprintEnabled ? 'bg-emerald-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`theme-toggle-thumb inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  fingerprintEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {bottomMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              disabled={item.id === 'logout' && loggingOut}
              className={`w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                item.active
                  ? 'bg-[#111D35]'
                  : item.danger
                  ? 'hover:bg-red-950/25'
                  : 'hover:bg-[#111D35]/75'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span
                    className={`text-sm font-bold block ${
                      item.danger ? 'text-red-400' : 'text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                    {item.sublabel}
                  </span>
                </div>
              </div>

              <ChevronRight
                className={`w-4 h-4 shrink-0 ${
                  item.danger ? 'text-red-400/70' : 'text-slate-500'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Winner List / Payout List Box (Directly below Ban Users / Manage Ban & above Copyright) */}
      {isUserAdmin && (
        <div className="rounded-3xl bg-[#0D1428] border border-amber-500/35 hover:border-amber-400/60 shadow-xl overflow-hidden transition-colors">
          <button
            type="button"
            onClick={() => onNavigate?.('winnerPayoutList')}
            className="w-full min-h-[68px] px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#111D35]/75 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold block text-white">
                  Winner List / Payout List
                </span>
                <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                  Match-wise winners (৳1+), UID, bKash number &amp; Paid status
                </span>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 shrink-0 text-amber-400" />
          </button>
        </div>
      )}

      {/* Expandable Panel: SEND NOTICE / NOTICE MANAGER (Admin Only, Below Logout) */}
      {isUserAdmin && activePanel === 'notice' && (
        <div ref={noticeRef}>
          <NoticeManagerSection
            onClose={() => setActivePanel('none')}
            adminEmail={userProfile.email || currentUser?.email || undefined}
          />
        </div>
      )}

      {/* Expandable Panel: ALL USERS / ADD MONEY (Admin Only, Below Send Notice) */}
      {isUserAdmin && activePanel === 'allUsers' && (
        <div ref={allUsersRef}>
          <AllUsersAddMoneySection
            onClose={() => setActivePanel('none')}
            adminName={userProfile.displayName || userProfile.email || 'Admin'}
            onMoneyAdded={refreshProfile}
          />
        </div>
      )}

      {/* Interactive Square / Circle Photo Cropper Modal */}
      <AvatarCropModal
        imageSrc={cropImageSrc}
        onCancel={() => setCropImageSrc(null)}
        onSave={handleSaveCroppedAvatar}
      />

      {/* Edit Profile Modal Popup (Golden Black theme matching user specifications) */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#0A0A0A] border border-[#CFA84B]/40 rounded-2xl shadow-2xl shadow-[#CFA84B]/20 overflow-hidden">
            {/* Top gold metallic accent gradient line */}
            <div className="h-1 bg-gradient-to-r from-[#8A6A24] via-[#F4D77A] to-[#8A6A24]"></div>

            {/* Header: Edit Profile with X close button on top right */}
            <div className="p-4 sm:p-5 pb-3 flex items-center justify-between border-b border-[#CFA84B]/20">
              <h2 className="text-lg font-bold font-gaming tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#F4D77A] via-[#E2B755] to-[#CFA84B]">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="p-1.5 text-[#B8A06A] hover:text-[#F4D77A] hover:bg-[#1E190E]/60 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditProfile} className="p-4 sm:p-6 space-y-4">
              {editModalError && (
                <div className="p-3 rounded-xl bg-[#2A1010] border border-red-500/50 flex items-start gap-2 text-red-200 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{editModalError}</span>
                </div>
              )}

              {/* Field 1: FULL NAME */}
              <div>
                <label className="block text-xs font-bold text-[#E2B755] uppercase tracking-wider mb-1.5">
                  FULL NAME
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Enter full name (e.g. Admin:Jarshed-1)"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0D1428] border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              {/* Field 2: PHONE NUMBER */}
              <div>
                <label className="block text-xs font-bold text-[#E2B755] uppercase tracking-wider mb-1.5">
                  PHONE NUMBER
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-[#B8A06A]" />
                  <input
                    type="tel"
                    required
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0D1428] border border-[#CFA84B]/40 focus:border-[#F4D77A] rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              {/* Buttons: Cancel & Save Changes */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  disabled={isSavingEdit}
                  className="py-3 px-4 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold font-gaming text-xs tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 active:scale-[0.99] text-black font-extrabold font-gaming text-xs tracking-wider shadow-lg shadow-[#CFA84B]/20 transition-all border border-[#F4D77A]/60 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
