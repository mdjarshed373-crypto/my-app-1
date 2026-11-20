import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/common/UserAvatar';
import {
  subscribeAllTimeTopPlayers,
  subscribeMonthlyTopPlayers,
} from '../services/matchResultService';
import {
  subscribeWeeklyTopPlayers,
  formatTimeUntilWeeklyReset,
} from '../services/weeklyLeaderboardService';
import { isUserCurrentlyBanned } from '../services/banService';
import { Trophy, Search, Crown, Clock } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { formatBDT } = useLanguage();
  const { userProfile } = useAuth();

  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL_TIME' | 'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);

    if (activeTab === 'WEEKLY') {
      const unsub = subscribeWeeklyTopPlayers(50, (snapshot) => {
        setPlayers(snapshot.players);
        setLoading(false);
      });
      return () => unsub();
    }

    if (activeTab === 'MONTHLY') {
      const unsub = subscribeMonthlyTopPlayers(50, (list) => {
        setPlayers(list);
        setLoading(false);
      });
      return () => unsub();
    }

    const unsub = subscribeAllTimeTopPlayers(50, (list) => {
      setPlayers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [activeTab]);

  const filteredPlayers = players.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.inGameName && p.inGameName.toLowerCase().includes(q)) ||
      (p.displayName && p.displayName.toLowerCase().includes(q)) ||
      (p.freeFireUid && p.freeFireUid.toLowerCase().includes(q)) ||
      (p.teamName && p.teamName.toLowerCase().includes(q))
    );
  });

  const champion = filteredPlayers[0] || null;
  const restPlayers = filteredPlayers.slice(1);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-7 pb-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-6 transition-colors">
      {/* 1. Header Section */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/50 text-amber-500 dark:text-amber-400 text-[11px] font-black font-gaming uppercase tracking-widest shadow-sm">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>ESPORTS HALL OF FAME</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black font-gaming tracking-wide text-slate-900 dark:text-white leading-tight">
          Tournament Leaderboard
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Top performing Free Fire competitors ranked by total earnings, wins, and kills.
        </p>

        {activeTab === 'WEEKLY' && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Weekly Auto-Reset: Monday 12:00 AM ({formatTimeUntilWeeklyReset()} left)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 2. Filter Buttons (All-Time / Monthly / Weekly — Monthly Default Blue) + 3. Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-md space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'ALL_TIME', label: 'All-Time' },
              { id: 'MONTHLY', label: 'Monthly' },
              { id: 'WEEKLY', label: 'Weekly' },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-gaming tracking-wide transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-100 dark:bg-[#111D35] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or UID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500 dark:focus:border-sky-400 placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-64 rounded-3xl bg-white dark:bg-[#0D1428] border border-amber-400/30 animate-pulse" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : !champion ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 text-center space-y-2 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto">
            <Trophy className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black font-gaming text-slate-900 dark:text-white">
            No Rankings Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {search.trim()
              ? 'No player matched your search. Try another name or Free Fire UID.'
              : 'Rankings update automatically as soon as official match results are published.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 4. CHAMPION Card (Top #1) */}
          <div className="relative mt-4 pt-8 pb-6 px-5 sm:px-8 rounded-3xl bg-gradient-to-b from-amber-50 via-white to-amber-50/40 dark:from-[#191306] dark:via-[#0D1428] dark:to-[#0A0F1F] border-2 border-amber-400 shadow-2xl shadow-amber-500/15 text-center space-y-4">
            {/* Top CHAMPION Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-black text-[11px] font-black font-gaming tracking-widest uppercase shadow-lg shadow-amber-500/30 flex items-center gap-1.5 whitespace-nowrap">
              <Trophy className="w-3.5 h-3.5 text-black" />
              <span>CHAMPION</span>
            </div>

            {/* Golden Crown Icon in Center */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Crown className="w-6 h-6 text-amber-400 fill-amber-400/30" />
              </div>
            </div>

            {/* Player Profile Pic with Blue Circle Border */}
            <div className="flex justify-center">
              <div className="p-1 rounded-full border-[3px] border-blue-500 ring-4 ring-blue-500/25 shadow-[0_0_24px_rgba(37,99,235,0.4)] inline-flex">
                <UserAvatar
                  user={userProfile && champion.uid === userProfile.uid ? userProfile : champion}
                  size="xl"
                />
              </div>
            </div>

            {/* Player Name + Title (e.g. Solo Master) */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-slate-900 dark:text-white truncate max-w-full">
                  {champion.inGameName || champion.displayName}
                </h2>
                {isUserCurrentlyBanned(champion) && (
                  <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black font-gaming uppercase shrink-0">
                    BANNED
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 tracking-wide">
                {champion.teamName || 'Solo Master'}
              </p>
            </div>

            {/* Bottom 3 Stats: Wins - Kills - Earnings */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-amber-300/50 dark:border-amber-500/20">
              <div className="py-2 px-2 rounded-2xl bg-white/80 dark:bg-[#111D35]/80 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Wins
                </span>
                <span className="text-base sm:text-lg font-black font-gaming tabular-nums text-amber-600 dark:text-amber-400">
                  {champion.totalWins || 0}
                </span>
              </div>

              <div className="py-2 px-2 rounded-2xl bg-white/80 dark:bg-[#111D35]/80 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Kills
                </span>
                <span className="text-base sm:text-lg font-black font-gaming tabular-nums text-red-600 dark:text-red-400">
                  {champion.totalKills || 0}
                </span>
              </div>

              <div className="py-2 px-2 rounded-2xl bg-white/80 dark:bg-[#111D35]/80 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Earnings
                </span>
                <span className="text-base sm:text-lg font-black font-gaming tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatBDT(champion.totalEarnings || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Serial List (#2, #3, #4...) */}
          {restPlayers.length > 0 && (
            <div className="space-y-2.5">
              {restPlayers.map((player, idx) => {
                const rank = idx + 2;
                const rankBadgeClass =
                  rank === 2
                    ? 'bg-slate-300 text-black border border-slate-400 shadow-sm'
                    : rank === 3
                    ? 'bg-amber-700 text-white border border-amber-500/60 shadow-sm'
                    : 'bg-slate-200 dark:bg-[#111D35] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700';

                return (
                  <div
                    key={player.uid}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-sm hover:border-sky-400/50 transition-colors flex items-center justify-between gap-3"
                  >
                    {/* Left: Rank Number + Profile Pic + Name */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                      <span
                        className={`w-8 h-8 rounded-xl font-black font-gaming text-xs flex items-center justify-center shrink-0 tabular-nums ${rankBadgeClass}`}
                      >
                        #{rank}
                      </span>

                      <UserAvatar
                        user={userProfile && player.uid === userProfile.uid ? userProfile : player}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate block">
                            {player.inGameName || player.displayName}
                          </span>
                          {isUserCurrentlyBanned(player) && (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black font-gaming uppercase shrink-0">
                              BANNED
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                          {player.freeFireUid
                            ? `UID: ${player.freeFireUid}`
                            : player.teamName || 'Solo'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Wins, Kills, Earnings */}
                    <div className="flex items-center gap-3 sm:gap-5 text-right shrink-0">
                      <div>
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                          Wins
                        </span>
                        <span className="text-xs sm:text-sm font-black font-gaming tabular-nums text-amber-600 dark:text-amber-400">
                          {player.totalWins || 0}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                          Kills
                        </span>
                        <span className="text-xs sm:text-sm font-black font-gaming tabular-nums text-red-600 dark:text-red-400">
                          {player.totalKills || 0}
                        </span>
                      </div>

                      <div className="min-w-[52px]">
                        <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block">
                          Earnings
                        </span>
                        <span className="text-xs sm:text-sm font-black font-gaming tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatBDT(player.totalEarnings || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
