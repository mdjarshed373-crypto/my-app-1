import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ensureUserReferCode, REFERRAL_BONUS_AMOUNT } from '../../services/referralService';

interface HomeReferEarnCardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const HomeReferEarnCard: React.FC<HomeReferEarnCardProps> = ({
  onNavigate,
}) => {
  const { userProfile } = useAuth();
  const { language } = useLanguage();
  const [referCode, setReferCode] = useState<string>(userProfile?.referCode || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userProfile) {
      setReferCode('');
      return;
    }
    if (userProfile.referCode) {
      setReferCode(userProfile.referCode);
      return;
    }
    ensureUserReferCode(userProfile)
      .then((code) => setReferCode(code))
      .catch(() => {});
  }, [userProfile]);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!referCode) return;
    navigator.clipboard.writeText(referCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => onNavigate('referAndEarn')}
      className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0D1428] border border-emerald-300 dark:border-emerald-500/35 shadow-lg dark:shadow-xl cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-400/60 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/15 border border-emerald-500/40 text-emerald-500 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black font-gaming tracking-wider text-slate-900 dark:text-white uppercase">
                Refer &amp; Earn
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 text-[10px] font-black font-gaming">
                <Sparkles className="w-3 h-3" />
                Earn {REFERRAL_BONUS_AMOUNT} Taka
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'বন্ধুদের ইনভাইট করুন এবং প্রতিটি সফল রেফারে ১০ টাকা করে জিতে নিন!'
                : 'Invite Friends, Earn 10 Taka directly in your Wallet for every friend who joins!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {userProfile && referCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-slate-800 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{referCode}</span>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('referAndEarn');
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 text-white font-bold font-gaming text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all"
          >
            <span>{userProfile ? 'Invite Friends' : 'Get Refer Code'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
