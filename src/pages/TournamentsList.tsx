import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  Tournament,
  TournamentType,
  GameMode,
  TournamentStatus,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MatchCard } from '../components/tournament/MatchCard';
import { fetchTournaments, deleteTournamentInstant, fetchUserRegistrations } from '../services/tournamentService';
import {
  OptimisticJoinEntry,
  subscribeOptimisticJoins,
} from '../services/optimisticJoinStore';
import {
  OptimisticTournamentEntry,
  mergeOptimisticTournaments,
  subscribeOptimisticTournaments,
} from '../services/optimisticTournamentStore';
import { subscribePendingWithdrawals } from '../services/walletService';
import { DeleteTournamentModal } from '../components/tournament/DeleteTournamentModal';
import { ToastNotification } from '../components/common/ToastNotification';
import { Search, Filter, Trophy, ArrowUpDown, Plus, RefreshCw } from 'lucide-react';

interface TournamentsListProps {
  onSelectTournament: (tournament: Tournament) => void;
  onJoinTournament: (tournament: Tournament) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const TournamentsList: React.FC<TournamentsListProps> = ({
  onSelectTournament,
  onJoinTournament,
  onNavigate,
}) => {
  const { language, t } = useLanguage();
  const { currentUser, isAdmin } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>(() =>
    mergeOptimisticTournaments([])
  );
  const [optimisticTours, setOptimisticTours] = useState<OptimisticTournamentEntry[]>([]);
  const [registeredTourIds, setRegisteredTourIds] = useState<Set<string>>(new Set());
  const [optimisticJoins, setOptimisticJoins] = useState<OptimisticJoinEntry[]>([]);
  const [loading, setLoading] = useState(() => mergeOptimisticTournaments([]).length === 0);

  // Delete Tournament modal & toast
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeletingTour, setIsDeletingTour] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'prize' | 'fee'>('date');
  const [pendingWithdrawCount, setPendingWithdrawCount] = useState<number>(0);

  useEffect(() => {
    loadTournaments();
    const unsub = onSnapshot(
      collection(db, 'tournaments'),
      (snap) => {
        const list: Tournament[] = [];
        snap.forEach((d) => {
          list.push({ ...(d.data() as Tournament), id: d.id });
        });
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setTournaments(list);
        setLoading(false);
      },
      () => {
        // Fallback already handled by loadTournaments
      }
    );
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    return subscribeOptimisticTournaments(setOptimisticTours);
  }, []);

  useEffect(() => {
    return subscribeOptimisticJoins(currentUser?.uid, setOptimisticJoins);
  }, [currentUser?.uid]);

  const effectiveTournaments = React.useMemo(
    () => mergeOptimisticTournaments(tournaments),
    [tournaments, optimisticTours]
  );

  const effectiveRegisteredTourIds = React.useMemo(() => {
    if (optimisticJoins.length === 0) return registeredTourIds;
    const merged = new Set(registeredTourIds);
    optimisticJoins.forEach((entry) => merged.add(entry.tournamentId));
    return merged;
  }, [registeredTourIds, optimisticJoins]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingWithdrawCount(0);
      return;
    }
    const unsub = subscribePendingWithdrawals((list) => {
      setPendingWithdrawCount(list.length);
    });
    return () => unsub();
  }, [isAdmin]);

  const loadTournaments = async () => {
    try {
      const data = await fetchTournaments();
      setTournaments(data);
      if (currentUser?.uid) {
        const regs = await fetchUserRegistrations(currentUser.uid);
        setRegisteredTourIds(new Set(regs.map((r) => r.tournamentId)));
      } else {
        setRegisteredTourIds(new Set());
      }
      setRefreshTick(Date.now());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMatches = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 1000)),
        loadTournaments(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Delete Modal
  const handleRequestDelete = (tournament: Tournament) => {
    if (!isAdmin) return;
    setTournamentToDelete(tournament);
  };

  // Confirm Delete (Instant <1s UI + Background Batch Delete)
  const handleConfirmDelete = () => {
    if (!isAdmin || !tournamentToDelete) return;
    const targetTour = tournamentToDelete;
    const tourId = targetTour.id;

    const res = deleteTournamentInstant({
      id: tourId,
      onBackgroundFailed: (_failedId, errMsg) => {
        setTournaments((prev) => mergeOptimisticTournaments([targetTour, ...prev]));
        setToastMessage(errMsg || 'টুর্নামেন্ট ডিলিট করতে সমস্যা হয়েছে');
      },
    });

    if (!res.started) return;

    setTournaments((prev) => prev.filter((t) => t.id !== tourId));
    setTournamentToDelete(null);
    setToastMessage('Success! টুর্নামেন্ট ডিলিট হয়েছে!');
  };

  const filteredTournaments = effectiveTournaments
    .filter((t) => {
      // Search
      const query = search.toLowerCase();
      const matchSearch =
        t.title.toLowerCase().includes(query) ||
        (t.titleBn && t.titleBn.toLowerCase().includes(query)) ||
        (t.map && t.map.toLowerCase().includes(query)) ||
        t.id.toLowerCase().includes(query);
      if (!matchSearch) return false;

      // Type
      if (selectedType !== 'ALL' && t.type !== selectedType) return false;

      // Mode
      if (selectedMode !== 'ALL' && t.gameMode !== selectedMode) return false;

      // Status
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'prize') return b.prizePool - a.prizePool;
      if (sortBy === 'fee') return a.entryFee - b.entryFee;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-colors">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
            <Trophy className="w-4 h-4" />
            <span>{language === 'bn' ? 'ফ্রি ফায়ার টুর্নামেন্ট লবি' : 'Free Fire Match Lobby'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-gaming tracking-wide text-slate-900 dark:text-white mt-1">
            {t('tournaments.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t('tournaments.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={handleRefreshMatches}
          disabled={isRefreshing}
          aria-label="Refresh Matches"
          title="Refresh"
          className="w-9 h-9 rounded-full bg-white dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-[#1a2b4f] border border-sky-200 dark:border-sky-500/35 hover:border-sky-400 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-sm dark:shadow-md dark:shadow-black/40 transition-all cursor-pointer active:scale-95 disabled:opacity-75 shrink-0 mt-1"
        >
          <RefreshCw
            className={`w-4 h-4 text-sky-600 dark:text-sky-400 stroke-[2.4] ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 mb-8 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'bn' ? 'টুর্নামেন্টের নাম বা ম্যাপ খুঁজুন...' : 'Search tournament or map...'}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500 dark:focus:border-sky-400"
            >
              <option value="date">{language === 'bn' ? 'সর্বশেষ ম্যাচ' : 'Latest Matches'}</option>
              <option value="prize">{language === 'bn' ? 'সর্বোচ্চ প্রাইজপুল' : 'Highest Prize'}</option>
              <option value="fee">{language === 'bn' ? 'কম এন্ট্রি ফি' : 'Lowest Entry Fee'}</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            {language === 'bn' ? 'টাইপ:' : 'Type:'}
          </span>
          {['ALL', 'SOLO', 'DUO', 'SQUAD'].map((tType) => (
            <button
              key={tType}
              onClick={() => setSelectedType(tType)}
              className={`px-3 py-1 rounded-lg font-bold font-gaming transition-all cursor-pointer ${
                selectedType === tType
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'bg-slate-100 dark:bg-[#111D35] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {tType === 'ALL' ? t('tournaments.filter.all') : tType}
            </button>
          ))}

          <span className="text-slate-600 dark:text-slate-400 font-semibold ml-2">
            {language === 'bn' ? 'মোড:' : 'Mode:'}
          </span>
          {[
            { id: 'ALL', label: t('tournaments.filter.all') },
            { id: 'BATTLE_ROYALE', label: 'Battle Royale' },
            { id: 'CLASH_SQUAD', label: 'Clash Squad' },
            { id: 'LONE_WOLF', label: 'Lone Wolf' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`px-3 py-1 rounded-lg font-bold font-gaming transition-all cursor-pointer ${
                selectedMode === m.id
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'bg-slate-100 dark:bg-[#111D35] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}

          <span className="text-slate-600 dark:text-slate-400 font-semibold ml-2">
            {language === 'bn' ? 'স্ট্যাটাস:' : 'Status:'}
          </span>
          {['ALL', 'REGISTRATION_OPEN', 'ONGOING', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1 rounded-lg font-bold font-gaming transition-all cursor-pointer ${
                selectedStatus === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-[#111D35] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {st === 'ALL'
                ? t('tournaments.filter.statusAll')
                : st === 'REGISTRATION_OPEN'
                ? t('tournaments.filter.open')
                : st === 'ONGOING'
                ? t('tournaments.filter.ongoing')
                : t('tournaments.completed')}
            </button>
          ))}
        </div>
      </div>

      {/* Tournaments Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-[440px] rounded-3xl bg-white dark:bg-[#0D1428] animate-pulse border border-slate-200 dark:border-slate-800"
            ></div>
          ))}
        </div>
      ) : effectiveTournaments.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white dark:bg-[#0D1428] rounded-3xl border border-slate-200 dark:border-sky-500/20 shadow-xl dark:shadow-2xl max-w-xl mx-auto space-y-4 my-8">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center text-sky-600 dark:text-sky-400 mx-auto shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black font-gaming tracking-wide text-slate-900 dark:text-white">
            No tournaments yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {language === 'bn'
              ? 'বর্তমানে কোনো টুর্নামেন্ট নেই। এডমিন নতুন টুর্নামেন্ট তৈরি করলে এখানে দেখতে পাবেন।'
              : 'There are currently no tournaments available. New matches will be listed here once created.'}
          </p>
          {isAdmin && onNavigate && (
            <button
              onClick={() => onNavigate('admin', pendingWithdrawCount > 0 ? { tab: 'withdrawals' } : undefined)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{language === 'bn' ? 'এডমিন প্যানেলে টুর্নামেন্ট যোগ করুন' : 'Create Tournament in Admin Panel'}</span>
              {pendingWithdrawCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black leading-none tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>{pendingWithdrawCount}</span>
                </span>
              )}
            </button>
          )}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0D1428] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Trophy className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-gaming">
            {language === 'bn' ? 'কোনো টুর্নামেন্ট পাওয়া যায়নি' : 'No tournaments match your filter'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'অন্য কোনো ফিল্টার বা সার্চ কিওয়ার্ড দিয়ে চেষ্টা করুন।'
              : 'Try clearing some filters or searching for something else.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
          {filteredTournaments.map((tournament, idx) => (
            <MatchCard
              key={tournament.id}
              tournament={tournament}
              matchNumber={idx + 1}
              onSelect={onSelectTournament}
              onJoin={onJoinTournament}
              onDelete={isAdmin ? handleRequestDelete : undefined}
              onTimeUpdated={(updated, message) => {
                setTournaments((prev) =>
                  prev.map((item) => (item.id === updated.id ? updated : item))
                );
                setToastMessage(message);
              }}
              isRegistered={effectiveRegisteredTourIds.has(tournament.id)}
              refreshTick={refreshTick}
            />
          ))}
        </div>
      )}

      {/* Confirmation Popup Modal for Delete Tournament */}
      <DeleteTournamentModal
        isOpen={isAdmin && !!tournamentToDelete}
        tournamentTitle={tournamentToDelete?.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTournamentToDelete(null)}
        isDeleting={isDeletingTour}
      />

      {/* Toast Notification */}
      <ToastNotification
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
