import React, { useState, useEffect } from 'react';
import { Tournament, RoomCredential, TournamentRegistration } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  fetchTournaments,
  fetchAllRooms,
  publishRoomCredentialsWithNotification,
  fetchRegistrationsForTournament,
} from '../../services/tournamentService';
import { formatEntryTypeLabel } from '../../constants/categoryRules';
import {
  Key,
  Send,
  Check,
  AlertCircle,
  Clock,
  Users,
  ArrowLeft,
  Shield,
  RefreshCw,
  ExternalLink,
  Lock,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface RoomManagerPageProps {
  onNavigate: (page: string, params?: any) => void;
  onBack: () => void;
  initialTournamentId?: string;
}

interface RoomFormState {
  roomId: string;
  roomPassword: string;
  saving: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export const RoomManagerPage: React.FC<RoomManagerPageProps> = ({
  onNavigate,
  onBack,
  initialTournamentId,
}) => {
  const { isAdmin, currentUser } = useAuth();
  const { language, t } = useLanguage();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [roomsMap, setRoomsMap] = useState<Record<string, RoomCredential>>({});
  const [formStates, setFormStates] = useState<Record<string, RoomFormState>>({});
  const [joinedPlayersMap, setJoinedPlayersMap] = useState<Record<string, TournamentRegistration[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'published'>('all');

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadAllData();
  }, [isAdmin]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [tourList, allRooms] = await Promise.all([
        fetchTournaments(),
        fetchAllRooms(),
      ]);

      setTournaments(tourList);
      setRoomsMap(allRooms);

      // Initialize form states
      const initialForms: Record<string, RoomFormState> = {};
      tourList.forEach((tour) => {
        const room = allRooms[tour.id];
        initialForms[tour.id] = {
          roomId: room?.roomId || '',
          roomPassword: room?.roomPassword || '',
          saving: false,
        };
      });
      setFormStates(initialForms);

      // Also asynchronously fetch registrations for all tournaments to show joined players
      const regMap: Record<string, TournamentRegistration[]> = {};
      await Promise.all(
        tourList.map(async (tour) => {
          try {
            const regs = await fetchRegistrationsForTournament(tour.id);
            regMap[tour.id] = regs;
          } catch {
            regMap[tour.id] = [];
          }
        })
      );
      setJoinedPlayersMap(regMap);
    } catch (err) {
      console.error('Failed to load room manager data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleInputChange = (tourId: string, field: 'roomId' | 'roomPassword', val: string) => {
    setFormStates((prev) => ({
      ...prev,
      [tourId]: {
        ...(prev[tourId] || { roomId: '', roomPassword: '', saving: false }),
        [field]: val,
        successMessage: undefined,
        errorMessage: undefined,
      },
    }));
  };

  const handlePublishRoom = async (tournament: Tournament) => {
    const state = formStates[tournament.id];
    if (!state) return;

    if (!state.roomId.trim()) {
      setFormStates((prev) => ({
        ...prev,
        [tournament.id]: {
          ...prev[tournament.id],
          errorMessage: language === 'bn' ? 'অনুগ্রহ করে Room ID লিখুন!' : 'Please enter Room ID!',
        },
      }));
      return;
    }

    setFormStates((prev) => ({
      ...prev,
      [tournament.id]: {
        ...prev[tournament.id],
        saving: true,
        errorMessage: undefined,
        successMessage: undefined,
      },
    }));

    try {
      const result = await publishRoomCredentialsWithNotification(
        tournament,
        state.roomId,
        state.roomPassword
      );

      if (result.success) {
        // Update local roomsMap
        const updatedRoom: RoomCredential = {
          id: tournament.id,
          tournamentId: tournament.id,
          roomId: state.roomId.trim(),
          roomPassword: state.roomPassword.trim(),
          isPublished: true,
          releaseTime: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setRoomsMap((prev) => ({
          ...prev,
          [tournament.id]: updatedRoom,
        }));

        setFormStates((prev) => ({
          ...prev,
          [tournament.id]: {
            ...prev[tournament.id],
            saving: false,
            successMessage:
              language === 'bn'
                ? `রুম আইডি এবং পাসওয়ার্ড সফলভাবে পাঠানো হয়েছে! (${result.notifiedCount} জন খেলোয়াড়কে নোটিফিকেশন পাঠানো হয়েছে)`
                : `Room ID & Password published! (${result.notifiedCount} players notified)`,
          },
        }));
      } else {
        setFormStates((prev) => ({
          ...prev,
          [tournament.id]: {
            ...prev[tournament.id],
            saving: false,
            errorMessage: result.message,
          },
        }));
      }
    } catch (err: any) {
      setFormStates((prev) => ({
        ...prev,
        [tournament.id]: {
          ...prev[tournament.id],
          saving: false,
          errorMessage: err?.message || 'Error publishing room credentials',
        },
      }));
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-16 px-4 flex items-center justify-center transition-colors">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-[#0D1428] border border-red-200 dark:border-red-500/40 text-center space-y-4 shadow-xl dark:shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/50 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wider">
            You are not authorized
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            এই পৃষ্ঠাটি শুধুমাত্র অ্যাডমিনদের জন্য সংরক্ষিত। রুম পাসওয়ার্ড প্রদান করতে অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-gaming text-xs uppercase cursor-pointer"
          >
            হোম পেজে ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  const publishedCount = tournaments.filter(
    (t) => roomsMap[t.id]?.isPublished && Boolean(roomsMap[t.id]?.roomId)
  ).length;
  const pendingCount = tournaments.length - publishedCount;

  const filteredTournaments = tournaments.filter((t) => {
    const isPub = roomsMap[t.id]?.isPublished && Boolean(roomsMap[t.id]?.roomId);
    if (activeFilter === 'published') return isPub;
    if (activeFilter === 'pending') return !isPub;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6 transition-colors">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-sky-500/20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="ফিরে যান (Back)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 text-[10px] font-black font-gaming uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                ADMIN CONTROL
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">• TX TOUR BD</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-gaming text-slate-900 dark:text-white tracking-wide flex items-center gap-2 mt-1">
              <Key className="w-6 h-6 text-amber-500 dark:text-[#F4D77A]" />
              <span>ROOM MANAGER / ALL MATCHES ROOM</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              সব ম্যাচের জন্য রুম আইডি ও পাসওয়ার্ড দিন এবং জয়েন করা খেলোয়াড়দের স্বয়ংক্রিয় নোটিফিকেশন পাঠান।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#111D35] hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/40 text-xs font-bold font-gaming transition-all cursor-pointer"
          >
            <span>Admin Dashboard</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Cards & Filter Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-2xl bg-white dark:bg-[#0D1428] border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
            activeFilter === 'all'
              ? 'border-sky-500 shadow-lg shadow-sky-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              TOTAL MATCHES
            </span>
            <span className="text-2xl font-black font-gaming text-slate-900 dark:text-white tabular-nums">
              {tournaments.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('published')}
          className={`p-4 rounded-2xl bg-white dark:bg-[#0D1428] border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
            activeFilter === 'published'
              ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              ROOMS PUBLISHED
            </span>
            <span className="text-2xl font-black font-gaming text-emerald-600 dark:text-emerald-400 tabular-nums">
              {publishedCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('pending')}
          className={`p-4 rounded-2xl bg-white dark:bg-[#0D1428] border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
            activeFilter === 'pending'
              ? 'border-amber-500 shadow-lg shadow-amber-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
              ROOMS PENDING
            </span>
            <span className="text-2xl font-black font-gaming text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Admin Notice Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/15 dark:via-[#111D35] dark:to-sky-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-md">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold font-gaming text-slate-900 dark:text-white uppercase tracking-wider block">
            HOW ADMIN ROOM PUBLISHING WORKS
          </span>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            ম্যাচ শুরুর ৫ বা ১০ মিনিট আগে সংশ্লিষ্ট ম্যাচের জন্য <b>Room ID</b> এবং <b>Room Password</b> লিখুন এবং <b>&quot;PUBLISH / SEND ROOM&quot;</b> বাটনে ক্লিক করুন। সাথে সাথে শুধুমাত্র ওই ম্যাচের স্লট বুক করা প্লেয়ারদের কাছে নোটিফিকেশন যাবে: <i>&quot;Room Code Chole Asche&quot;</i> এবং ম্যাচ ডিটেইলস পেজে তাদের জন্য রুম আইডি দৃশ্যমান হবে।
          </p>
        </div>
      </div>

      {/* Match Cards List */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-amber-500 dark:border-[#F4D77A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">সব ম্যাচের তালিকা লোড হচ্ছে...</p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
          <Calendar className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">কোনো ম্যাচ পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredTournaments.map((tour, idx) => {
            const room = roomsMap[tour.id];
            const form = formStates[tour.id] || { roomId: '', roomPassword: '', saving: false };
            const isPublished = Boolean(room?.isPublished && room?.roomId);
            const totalSlots = Math.max(1, Number(tour.maxSlots) || 12);
            const joinedList = joinedPlayersMap[tour.id] || [];
            const joinedCount = tour.registeredCount ?? joinedList.length ?? 0;
            const isTargetHighlight = initialTournamentId === tour.id;

            return (
              <div
                key={tour.id}
                id={`match-card-${tour.id}`}
                className={`p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D1428] border transition-all shadow-lg dark:shadow-xl space-y-4 ${
                  isTargetHighlight
                    ? 'border-yellow-500 dark:border-yellow-400 ring-2 ring-yellow-400/30'
                    : isPublished
                    ? 'border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-500/60'
                    : 'border-slate-200 dark:border-sky-500/25 hover:border-sky-400 dark:hover:border-sky-500/50'
                }`}
              >
                {/* Match Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-black font-gaming text-[10px] tracking-wider uppercase">
                        {formatEntryTypeLabel(tour)}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-sky-50 dark:bg-[#111D35] text-sky-700 dark:text-sky-400 font-bold text-[11px] border border-sky-200 dark:border-sky-500/30">
                        {tour.category || 'REGULAR'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#070B18] text-slate-700 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                        #{idx + 1}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black font-gaming tracking-wide text-slate-900 dark:text-white">
                      {language === 'bn' && tour.titleBn ? tour.titleBn : tour.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        {tour.matchDate}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        {tour.matchTime} (Asia/Dhaka)
                      </span>
                      <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-gaming tabular-nums">
                        <Users className="w-3.5 h-3.5" />
                        <b>{joinedCount}</b> / {totalSlots} Slots Joined
                      </span>
                    </div>
                  </div>

                  {/* Room Status Indicator & Quick Match Details Link */}
                  <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
                    {isPublished ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40 text-xs font-bold font-gaming flex items-center gap-1.5 shadow-sm">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ROOM PUBLISHED</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 text-xs font-bold font-gaming flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>ROOM PENDING</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigate('tournamentDetails', { id: tour.id })}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-[#111D35] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="ম্যাচ ডিটেইলস পেজ দেখুন (View Match Details)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Slots Joined Progress Bar */}
                <div>
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Joined Players: <b className="text-sky-600 dark:text-sky-400">{joinedCount}</b> of {totalSlots}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      {Math.max(0, totalSlots - joinedCount)} Open Slots
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#070B18] border border-slate-300 dark:border-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((joinedCount / totalSlots) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Form Inputs: Room ID, Room Password & Publish Button */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111D35]/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-500 dark:text-yellow-400" />
                        <span>Room ID (রুম আইডি) *</span>
                      </label>
                      <input
                        type="text"
                        value={form.roomId}
                        onChange={(e) => handleInputChange(tour.id, 'roomId', e.target.value)}
                        placeholder="যেমন: 45892104"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#070B18] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold font-mono text-sm tracking-wider placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 dark:focus:border-yellow-400 shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>Room Password (রুম পাসওয়ার্ড)</span>
                      </label>
                      <input
                        type="text"
                        value={form.roomPassword}
                        onChange={(e) => handleInputChange(tour.id, 'roomPassword', e.target.value)}
                        placeholder="যেমন: 1234 (যদি থাকে)"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#070B18] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold font-mono text-sm tracking-wider placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Feedback Messages */}
                  {form.successMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{form.successMessage}</span>
                    </div>
                  )}

                  {form.errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <span>{form.errorMessage}</span>
                    </div>
                  )}

                  {/* Action Button Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      {isPublished
                        ? `Last published: ${new Date(room?.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'এখনো রুম পাবলিশ করা হয়নি (Not published yet)'}
                    </span>

                    <button
                      type="button"
                      disabled={form.saving}
                      onClick={() => handlePublishRoom(tour)}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming tracking-wider text-xs sm:text-sm shadow-xl shadow-[#CFA84B]/25 active:scale-95 transition-all transform hover:-translate-y-0.5 cursor-pointer uppercase flex items-center justify-center gap-2 border border-[#F4D77A]/60 disabled:opacity-50"
                    >
                      {form.saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          <span>পাঠানো হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-black stroke-[2.5]" />
                          <span>{isPublished ? 'UPDATE & SEND ROOM' : 'PUBLISH / SEND ROOM'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Joined Players Preview Box */}
                {joinedList.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070B18]/60 border border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] font-bold font-gaming uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                      WHO WILL RECEIVE THIS ROOM NOTIFICATION ({joinedList.length} Players):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {joinedList.map((reg) => {
                        const p1 = reg.players?.[0]?.inGameName || reg.players?.[0]?.name || reg.userName;
                        const p2Raw = reg.players?.[1]?.inGameName || reg.players?.[1]?.name;
                        const p2 = p2Raw && !p2Raw.includes('Partner: -') && !p2Raw.includes('Solo') ? p2Raw : null;
                        return (
                          <span
                            key={reg.id}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-[#111D35] border border-slate-200 dark:border-slate-700/80 text-[10px] text-slate-700 dark:text-slate-300"
                          >
                            <b className="text-sky-600 dark:text-sky-400">#{reg.slotNumber}</b> {p1}
                            {p2 ? ` & ${p2}` : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
