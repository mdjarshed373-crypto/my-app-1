import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  TournamentRegistration,
  WalletTransaction,
  Tournament,
} from '../types';
import { fetchUserRegistrations, fetchTournamentById } from '../services/tournamentService';
import { fetchUserTransactions, getWalletBreakdown } from '../services/walletService';
import {
  Trophy,
  Swords,
  Wallet,
  Users,
  Target,
  Flame,
  Plus,
  ArrowUpRight,
  Clock,
  Gamepad2,
  Calendar,
  ChevronRight,
  KeyRound,
} from 'lucide-react';

interface PlayerDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ onNavigate }) => {
  const { userProfile, currentUser } = useAuth();
  const { language, t, formatBDT } = useLanguage();

  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  const loadUserData = async () => {
    if (!currentUser) return;
    try {
      const [regs, txs] = await Promise.all([
        fetchUserRegistrations(currentUser.uid),
        fetchUserTransactions(currentUser.uid),
      ]);
      setRegistrations(regs);
      setTransactions(txs.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) return null;

  const quickActions = [
    {
      id: 'tournaments',
      label: language === 'bn' ? 'টুর্নামেন্টে জয়েন' : 'Join Match',
      icon: Swords,
      color: 'bg-blue-600',
    },
    {
      id: 'myMatches',
      label: language === 'bn' ? 'আমার ম্যাচ ও রুম আইডি' : 'My Matches',
      icon: KeyRound,
      color: 'bg-sky-600',
    },
    {
      id: 'wallet',
      label: language === 'bn' ? 'টাকা ডিপোজিট / উইথড্র' : 'My Wallet',
      icon: Wallet,
      color: 'bg-emerald-600',
    },
    {
      id: 'myTeam',
      label: language === 'bn' ? 'স্কোয়াড ম্যানেজমেন্ট' : 'My Squad',
      icon: Users,
      color: 'bg-purple-600',
    },
    {
      id: 'leaderboard',
      label: language === 'bn' ? 'র‍্যাংকিং ও স্কোর' : 'Leaderboard',
      icon: Trophy,
      color: 'bg-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner Card */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-[#0D1428] via-[#111D35] to-[#0D1428] border border-sky-500/25 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={userProfile} size="lg" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-white">
                  {userProfile.inGameName || userProfile.displayName}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-sky-500/20 text-sky-400 border border-sky-500/40">
                  {userProfile.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <Gamepad2 className="w-3.5 h-3.5 text-sky-400" />
                UID: {userProfile.freeFireUid || 'Not linked yet'} • Team: {userProfile.teamName || 'Solo Player'}
              </p>
            </div>
          </div>

          {/* Wallet summary card in header */}
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#070B18]/80 border border-slate-700/80 backdrop-blur-md">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                {t('wallet.available')}
              </span>
              <span className="text-lg font-black font-gaming text-sky-300">
                {formatBDT(getWalletBreakdown(userProfile).availableBalance)}
              </span>
            </div>
            <button
              onClick={() => onNavigate('wallet', { tab: 'deposit' })}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-sky-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('wallet.deposit')}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => onNavigate(act.id)}
              className="p-3.5 rounded-2xl bg-[#0D1428] border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div
                className={`w-10 h-10 rounded-xl ${act.color} text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                {act.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Player Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Swords className="w-3.5 h-3.5 text-sky-400" />
            <span>{language === 'bn' ? 'মোট টুর্নামেন্ট' : 'Tournaments'}</span>
          </div>
          <span className="text-xl sm:text-2xl font-black font-gaming text-white">
            {userProfile.totalTournaments || registrations.length || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'bn' ? 'মোট ম্যাচ' : 'Matches'}</span>
          </div>
          <span className="text-xl sm:text-2xl font-black font-gaming text-white">
            {userProfile.totalMatches || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Target className="w-3.5 h-3.5 text-red-400" />
            <span>{language === 'bn' ? 'মোট কিল' : 'Total Kills'}</span>
          </div>
          <span className="text-xl sm:text-2xl font-black font-gaming text-white">
            {userProfile.totalKills || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span>{language === 'bn' ? 'মোট জয় (Wins)' : 'Wins'}</span>
          </div>
          <span className="text-xl sm:text-2xl font-black font-gaming text-white">
            {userProfile.totalWins || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'bn' ? 'মোট আর্নিং' : 'Total Earnings'}</span>
          </div>
          <span className="text-xl sm:text-2xl font-black font-gaming text-emerald-400">
            {formatBDT(userProfile.totalEarnings || 0)}
          </span>
        </div>
      </div>

      {/* Two Column Layout: Upcoming Joined Matches & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Joined Tournaments */}
        <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-lg">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Swords className="w-4 h-4" />
              {language === 'bn' ? 'আমার নিবন্ধিত টুর্নামেন্ট' : 'My Registered Tournaments'}
            </h3>
            <button
              onClick={() => onNavigate('myMatches')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
            >
              {language === 'bn' ? 'সব দেখুন' : 'View All'}
            </button>
          </div>

          {registrations.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <p>{language === 'bn' ? 'আপনি এখনও কোনো টুর্নামেন্টে যুক্ত হননি।' : 'You have not joined any tournament yet.'}</p>
              <button
                onClick={() => onNavigate('tournaments')}
                className="mt-3 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
              >
                {t('hero.joinBtn')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.slice(0, 3).map((reg) => (
                <div
                  key={reg.id}
                  onClick={() => onNavigate('myMatches')}
                  className="p-3.5 rounded-xl bg-[#111D35] hover:bg-slate-800 border border-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-sky-950 text-sky-400 font-bold font-gaming flex items-center justify-center border border-sky-500/30">
                      #{reg.slotNumber}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{reg.teamName}</h4>
                      <p className="text-[11px] text-slate-400">
                        {reg.type} • {reg.status}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'রুম আইডি' : 'Room ID'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Financial Transactions */}
        <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-lg">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              {language === 'bn' ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions'}
            </h3>
            <button
              onClick={() => onNavigate('wallet')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
            >
              {language === 'bn' ? 'ওয়ালেট বিস্তারিত' : 'Full Ledger'}
            </button>
          </div>

          {transactions.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs">
              {language === 'bn' ? 'কোনো লেনদেনের রেকর্ড নেই।' : 'No transaction records yet.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">
                      {language === 'bn' ? tx.descriptionBn || tx.description : tx.description}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString()} • {tx.status}
                    </span>
                  </div>

                  <span
                    className={`font-bold font-gaming text-sm ${
                      tx.type === 'DEPOSIT' || tx.type === 'PRIZE' || tx.type === 'REFUND'
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {tx.type === 'DEPOSIT' || tx.type === 'PRIZE' || tx.type === 'REFUND'
                      ? '+'
                      : '-'}
                    {formatBDT(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
