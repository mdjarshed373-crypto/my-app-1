import React, { useState, useEffect } from 'react';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Wallet,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserProfile } from '../types';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  REFERRAL_BONUS_AMOUNT,
  ensureUserReferCode,
  applyReferralBonus,
  fetchReferredFriends,
  normalizeReferCode,
} from '../services/referralService';

interface ReferAndEarnPageProps {
  onNavigate?: (page: string, params?: any) => void;
  onBack?: () => void;
  onOpenAuth?: () => void;
}

export const ReferAndEarnPage: React.FC<ReferAndEarnPageProps> = ({
  onNavigate,
  onBack,
  onOpenAuth,
}) => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { language, formatBDT } = useLanguage();

  const [referCode, setReferCode] = useState<string>(userProfile?.referCode || '');
  const [referredFriends, setReferredFriends] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // One-time Apply Friend's Refer Code (only shown if user has not used a refer code yet)
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!userProfile) {
      setReferCode('');
      setReferredFriends([]);
      return;
    }

    if (userProfile.referCode) {
      setReferCode(userProfile.referCode);
    } else {
      ensureUserReferCode(userProfile)
        .then((code) => {
          setReferCode(code);
          refreshProfile?.();
        })
        .catch(() => {});
    }

    setLoadingFriends(true);
    fetchReferredFriends(userProfile.uid)
      .then((list) => setReferredFriends(list))
      .catch(() => {})
      .finally(() => setLoadingFriends(false));
  }, [userProfile, refreshProfile]);

  const inviteLink =
    typeof window !== 'undefined' && referCode
      ? `${window.location.origin}/?ref=${referCode}`
      : '';

  const handleCopyCode = () => {
    if (!referCode) return;
    navigator.clipboard.writeText(referCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!referCode) return;
    const shareText = `Join TX TOUR BD Free Fire Tournaments! Register with my Refer Code ${referCode} and start playing: ${inviteLink}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'TX TOUR BD - Refer & Earn',
          text: shareText,
          url: inviteLink,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    navigator.clipboard.writeText(shareText);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApplyFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    setFeedback(null);

    const cleaned = normalizeReferCode(friendCodeInput);
    if (!cleaned || cleaned.length < 4) {
      setFeedback({ type: 'error', text: 'সঠিক Refer Code লিখুন (যেমন: TX1234)।' });
      return;
    }

    setApplyingCode(true);
    const res = await applyReferralBonus({
      newUserUid: userProfile.uid,
      newUserName: userProfile.inGameName || userProfile.displayName || 'Player',
      referCode: cleaned,
    });
    setApplyingCode(false);

    setFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });

    if (res.success) {
      setFriendCodeInput('');
      await refreshProfile?.();
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-10 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0D1428] border border-emerald-300 dark:border-emerald-500/30 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-slate-900 dark:text-white uppercase">
              Refer &amp; Earn
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5">
              Invite Friends, Earn {REFERRAL_BONUS_AMOUNT} Taka! আপনার Unique Refer Code পেতে লগইন বা রেজিস্ট্রেশন করুন।
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold font-gaming text-xs tracking-wider shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                Login / Register Now
              </button>
            )}
            <button
              type="button"
              onClick={() => (onBack ? onBack() : onNavigate?.('home'))}
              className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold font-gaming text-xs cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalInvited = Math.max(
    Number(userProfile.referralCount || 0),
    referredFriends.length
  );
  const totalEarned = Math.max(
    Number(userProfile.referralEarnings || 0),
    referredFriends.length * REFERRAL_BONUS_AMOUNT
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-5 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-3 transition-colors">
      {/* Back Button */}
      <div>
        <button
          type="button"
          onClick={() => (onBack ? onBack() : onNavigate?.('profile'))}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1428] hover:bg-slate-200 dark:hover:bg-[#111D35] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold font-gaming transition-colors cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-500" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Refer & Earn Hero Card */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#0D1428] border border-emerald-300 dark:border-emerald-500/35 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/40 text-emerald-500 flex items-center justify-center shrink-0">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 text-[10px] font-black font-gaming uppercase mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Earn {REFERRAL_BONUS_AMOUNT} Taka Per Invite</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-slate-900 dark:text-white uppercase">
              Refer &amp; Earn
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'বন্ধুদের ইনভাইট করুন, প্রতিটি নতুন একাউন্টে সাথে সাথে ৳১০ বোনাস পান!'
                : 'Invite Friends, Earn 10 Taka directly in your Wallet!'}
            </p>
          </div>
        </div>

        {/* Your Unique Refer Code Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#111D35] border border-emerald-300 dark:border-emerald-500/40 space-y-3">
          <span className="text-[11px] font-bold font-gaming uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Your Unique Refer Code
          </span>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-[#070B18] border border-slate-300 dark:border-slate-700 font-mono font-black text-xl sm:text-2xl tracking-widest text-slate-900 dark:text-white text-center sm:text-left select-all">
              {referCode || 'TX----'}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-gaming text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareInvite}
                className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-gaming text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/25 cursor-pointer transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {inviteLink && (
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate font-mono">{inviteLink}</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-sky-600 dark:text-sky-400 font-bold hover:underline shrink-0 cursor-pointer"
              >
                {copiedLink ? 'Link Copied!' : 'Copy Link'}
              </button>
            </div>
          )}
        </div>

        {/* Real Stats */}
        <div className="!mt-2.5 w-[90%] mx-auto grid grid-cols-2 gap-2.5">
          <div className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-500 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block leading-tight">
                Friends Invited
              </span>
              <span className="text-base sm:text-lg font-black font-gaming text-slate-900 dark:text-white leading-tight tabular-nums">
                {totalInvited}
              </span>
            </div>
          </div>

          <div className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block leading-tight">
                Total Earned
              </span>
              <span className="text-base sm:text-lg font-black font-gaming text-emerald-600 dark:text-emerald-400 leading-tight tabular-nums">
                {formatBDT(totalEarned)}
              </span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="!mt-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 space-y-2.5">
          <h3 className="text-xs font-black font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400">
            How Refer &amp; Earn Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
              <span className="font-black font-gaming text-emerald-600 dark:text-emerald-400 block mb-0.5">
                1. Share Code
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                আপনার ইউনিক কোড ({referCode}) বা ইনভাইট লিংক বন্ধুদের শেয়ার করুন।
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
              <span className="font-black font-gaming text-sky-600 dark:text-sky-400 block mb-0.5">
                2. Friend Joins
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                আপনার বন্ধু রেজিস্ট্রেশনের সময় আপনার Refer Code ব্যবহার করবে।
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-[#070B18] border border-slate-200 dark:border-slate-800">
              <span className="font-black font-gaming text-amber-600 dark:text-amber-400 block mb-0.5">
                3. Get ৳10 Bonus
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                সাথে সাথে আপনার Wallet-এ ৳১০ যোগ হয়ে যাবে!
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Friend's Refer Code (if not referred yet) */}
      {!userProfile.referredBy ? (
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg space-y-3">
          <div>
            <h2 className="text-sm font-black font-gaming uppercase tracking-wider text-slate-900 dark:text-white">
              Have a Friend&apos;s Refer Code?
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              রেজিস্ট্রেশনের সময় কোড না দিয়ে থাকলে একবারের জন্য বন্ধুর Refer Code বসিয়ে তাদের ৳১০ বোনাস দিতে পারেন।
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/40 text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleApplyFriendCode} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={friendCodeInput}
              onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter Refer Code (e.g. TX1234)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm uppercase focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={applyingCode}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 disabled:opacity-50 text-white font-bold font-gaming text-xs uppercase cursor-pointer"
            >
              {applyingCode ? 'Applying...' : 'Apply Code'}
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-emerald-500/30 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            You joined using Refer Code:{' '}
            <strong className="font-mono text-emerald-600 dark:text-emerald-400">
              {userProfile.referredByCode || 'Applied'}
            </strong>
          </span>
        </div>
      )}

      {/* Referred Friends List */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg space-y-3">
        <h2 className="text-sm font-black font-gaming uppercase tracking-wider text-slate-900 dark:text-white">
          Your Invited Friends ({referredFriends.length})
        </h2>

        {loadingFriends ? (
          <div className="h-16 rounded-2xl bg-slate-100 dark:bg-[#111D35] animate-pulse" />
        ) : referredFriends.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            {language === 'bn'
              ? 'এখনো কেউ আপনার Refer Code ব্যবহার করেনি। কোড শেয়ার করে ৳১০ করে আয় শুরু করুন!'
              : 'No friends invited yet. Share your code to start earning ৳10 per invite!'}
          </p>
        ) : (
          <div className="space-y-2">
            {referredFriends.map((friend) => (
              <div
                key={friend.uid}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar user={friend} size="sm" className="shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block truncate">
                      {friend.inGameName || friend.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Joined {new Date(friend.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 font-black font-gaming text-xs shrink-0">
                  +{formatBDT(REFERRAL_BONUS_AMOUNT)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
