import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Tournament,
  DepositRequest,
  WithdrawalRequest,
  TournamentRegistration,
  RoomCredential,
  TeamPlacementResult,
  AppSettings,
  SupportTicket,
  UserProfile,
  WalletTransaction,
  MatchResult,
  GameMode,
} from '../../types';
import {
  fetchTournaments,
  createTournamentInstant,
  updateTournament,
  deleteTournamentInstant,
  fetchRegistrationsForTournament,
  fetchRoomCredentials,
  saveRoomCredentials,
  publishRoomCredentialsWithNotification,
} from '../../services/tournamentService';
import {
  mergeOptimisticRoomsMap,
  mergeOptimisticTournaments,
  subscribeOptimisticTournamentErrors,
} from '../../services/optimisticTournamentStore';
import {
  fetchDepositRequests,
  fetchWithdrawalRequests,
  adminApproveDeposit,
  adminRejectDeposit,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  getWalletBreakdown,
} from '../../services/walletService';
import {
  acquireAdminWithdrawActionLock,
  clearOptimisticAdminWithdrawResolution,
  isAdminWithdrawActionInFlight,
  mergeAdminOptimisticWithdrawals,
  setOptimisticAdminWithdrawResolution,
  subscribeOptimisticWithdrawStore,
} from '../../services/optimisticWithdrawStore';
import {
  calculatePoints,
  calculateMatchPrizeBreakdown,
  buildDistributedRecordsFromStandings,
  reconstructLegacyDistributedRecords,
  declareAndDistributeMatchResult,
  undoMatchResultAndRevertPrizes,
  syncLeaderboardEntry,
} from '../../services/matchResultService';
import {
  acquireResultDeclareLock,
  applyOptimisticUserDeltas,
  clearOptimisticMatchResult,
  clearOptimisticUserDeltasByOpId,
  isResultDeclareInFlight,
  mergeOptimisticMatchResults,
  setOptimisticMatchResult,
} from '../../services/optimisticResultStore';
import {
  getCurrentWeekStartIso,
  manualResetWeeklyLeaderboard,
  subscribeWeeklyTopPlayers,
  formatTimeUntilWeeklyReset,
  WeeklyLeaderboardMeta,
} from '../../services/weeklyLeaderboardService';
import { fetchAllTickets, replyToTicket } from '../../services/supportService';
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { handleFirestoreError, OperationType } from '../../services/firestoreError';
import { DeleteTournamentModal } from '../../components/tournament/DeleteTournamentModal';
import { EditMatchSlotsModal } from '../../components/tournament/EditMatchSlotsModal';
import { EditMatchTimeModal } from '../../components/tournament/EditMatchTimeModal';
import { ToastNotification } from '../../components/common/ToastNotification';
import {
  formatGameModeLabel,
  generateAutoBanglaTitle,
  getDhakaTodayDateStr,
  getMatchBannerUrl,
  getMaxSlotLimitForCategory,
  getSlotWeightForRegistration,
  getTournamentCategory,
  isBuiltInCategoryBannerUrl,
  isPlacementPrizeCategory,
  isPlaceholderBannerUrl,
  isSlotEditableCategory,
  normalizeCategory,
  parseMatchDateAndTime,
  supportsPerKillPrize,
} from '../../constants/categoryRules';
import { getLiveCategoryRulesText } from '../../services/rulesService';
import { formatAdminDisplayContact, subscribeAllAdmins } from '../../services/adminService';
import { ManageAdminsSection } from '../../components/admin/ManageAdminsSection';
import { SendAnnouncementSection } from '../../components/admin/SendAnnouncementSection';
import { ManageCategoryRulesSection } from '../../components/admin/ManageCategoryRulesSection';
import {
  Shield,
  Crown,
  Trophy,
  Wallet,
  Users,
  Key,
  KeyRound,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit,
  Pencil,
  Save,
  MessageSquare,
  Settings,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Flame,
  MapPin,
  Clock,
  Calendar,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  Bell,
  Search,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (page: string, params?: any) => void;
  initialTab?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
  initialTab,
}) => {
  const { userProfile, isAdmin, isSuperAdmin } = useAuth();
  const { language, t, formatBDT } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'tournaments'
    | 'rooms'
    | 'rules'
    | 'deposits'
    | 'withdrawals'
    | 'wallet'
    | 'gameHistory'
    | 'results'
    | 'tickets'
    | 'announcements'
    | 'settings'
    | 'manageAdmins'
  >((initialTab === 'manageAdmins' && !isSuperAdmin ? 'tournaments' : (initialTab as any)) || 'tournaments');

  useEffect(() => {
    if (activeTab === 'manageAdmins' && !isSuperAdmin) {
      setActiveTab('tournaments');
    }
  }, [activeTab, isSuperAdmin]);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [transactionsList, setTransactionsList] = useState<WalletTransaction[]>([]);
  const [matchResultsMap, setMatchResultsMap] = useState<Record<string, MatchResult>>({});
  const [allRegistrationsMap, setAllRegistrationsMap] = useState<Record<string, TournamentRegistration[]>>({});
  const [walletTxFilter, setWalletTxFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'ENTRY_FEE' | 'PRIZE'>('ALL');
  const [gameHistoryFilter, setGameHistoryFilter] = useState<'ALL' | 'COMPLETED' | 'ACTIVE'>('ALL');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // New Tournament Form
  const [showCreateTourModal, setShowCreateTourModal] = useState(false);
  const [isCreatingTour, setIsCreatingTour] = useState(false);
  const creatingTourRef = useRef(false);
  const [newTour, setNewTour] = useState<Partial<Tournament>>({
    title: '',
    titleBn: '',
    type: 'SQUAD',
    gameMode: 'BATTLE_ROYALE',
    category: 'BR MATCH',
    map: 'Bermuda',
    entryFee: 100,
    prizePool: 2400,
    firstPrize: 1200,
    secondPrize: 600,
    thirdPrize: 300,
    fourthPrize: '' as unknown as number,
    fifthPrize: '' as unknown as number,
    perKillPrize: 10,
    maxSlots: 24,
    status: 'REGISTRATION_OPEN',
    matchDate: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    matchTime: '08:00 PM',
    registrationDeadline: new Date(Date.now() + 80000000).toISOString(),
    rules: 'No emulator. Mobile only. No hack/scripts.',
    rulesBn: 'শুধুমাত্র মোবাইল প্লেয়ার। কোনো প্রকার হ্যাক বা এমুলেটর নিষিদ্ধ।',
    bannerUrl: getMatchBannerUrl('BR MATCH'),
    showParticipants: true,
  });
  const [newTourRoom, setNewTourRoom] = useState<{ roomId: string; roomPassword: string; isPublished: boolean }>({
    roomId: '',
    roomPassword: '',
    isPublished: false,
  });

  // Edit Tournament Modal State
  const [showEditTourModal, setShowEditTourModal] = useState(false);
  const [editingTour, setEditingTour] = useState<Tournament | null>(null);
  const [editingTourRoom, setEditingTourRoom] = useState<RoomCredential | null>(null);
  const [editingTourRoomSnapshot, setEditingTourRoomSnapshot] = useState<{
    roomId: string;
    roomPassword: string;
    isPublished: boolean;
  } | null>(null);

  // Quick Room Modal State
  const [showQuickRoomModal, setShowQuickRoomModal] = useState(false);
  const [quickRoomTour, setQuickRoomTour] = useState<Tournament | null>(null);
  const [quickRoomData, setQuickRoomData] = useState<RoomCredential>({
    id: '',
    tournamentId: '',
    roomId: '',
    roomPassword: '',
    releaseTime: '',
    isPublished: false,
  });

  // Map of rooms for all tournaments
  const [roomsMap, setRoomsMap] = useState<Record<string, RoomCredential>>({});

  // Room Credentials Tab State
  const [selectedTourForRoom, setSelectedTourForRoom] = useState<string>('');
  const [roomData, setRoomData] = useState<RoomCredential>({
    id: '',
    tournamentId: '',
    roomId: '',
    roomPassword: '',
    releaseTime: '',
    isPublished: false,
  });

  // Match Scoring Tab State
  const [selectedTourForScoring, setSelectedTourForScoring] = useState<string>('');
  const [scoringRegistrations, setScoringRegistrations] = useState<TournamentRegistration[]>([]);
  const [standingsInput, setStandingsInput] = useState<Record<string, { placement: number; kills: number }>>({});
  const [scoringStatusMessage, setScoringStatusMessage] = useState<string | null>(null);
  const [scoringSubmitting, setScoringSubmitting] = useState(false);
  const [justDeclaredTourId, setJustDeclaredTourId] = useState<string | null>(null);
  const [hasScoringEdits, setHasScoringEdits] = useState<boolean>(false);
  const resultDeclareLockRef = useRef<Record<string, boolean>>({});
  const prevScoringTourRef = useRef<string>('');
  const [confirmUndoResult, setConfirmUndoResult] = useState(false);
  const [copiedWithdrawId, setCopiedWithdrawId] = useState<string | null>(null);
  const [withdrawFilter, setWithdrawFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REJECTED'>('ALL');
  const [withdrawSearch, setWithdrawSearch] = useState<string>('');
  const [processingWithdrawId, setProcessingWithdrawId] = useState<string | null>(null);
  const [optimisticWithdrawTick, setOptimisticWithdrawTick] = useState<number>(0);
  const withdrawActionLockRef = useRef<Record<string, boolean>>({});
  const seenPendingWithdrawIdsRef = useRef<Set<string> | null>(null);

  // Settings tab state
  const [bkashNum, setBkashNum] = useState('');
  const [nagadNum, setNagadNum] = useState('');

  // Ticket reply state
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  // Delete Tournament Modal & Toast state
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [slotEditTour, setSlotEditTour] = useState<Tournament | null>(null);
  const [timeEditTour, setTimeEditTour] = useState<Tournament | null>(null);
  const [showWipeAllModal, setShowWipeAllModal] = useState(false);
  const [isDeletingTour, setIsDeletingTour] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Weekly Leaderboard state
  const [weeklyMeta, setWeeklyMeta] = useState<WeeklyLeaderboardMeta>({});
  const [weeklyTop1, setWeeklyTop1] = useState<UserProfile | null>(null);
  const [isResettingWeekly, setIsResettingWeekly] = useState(false);
  const [showResetWeeklyModal, setShowResetWeeklyModal] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadAllAdminData();
    const unsubAdmins = subscribeAllAdmins(() => {});
    const unsubWeekly = subscribeWeeklyTopPlayers(1, (snapshot) => {
      setWeeklyMeta(snapshot.meta || {});
      setWeeklyTop1(snapshot.players[0] || null);
    });
    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawalRequests'),
      (snap) => {
        const list: WithdrawalRequest[] = [];
        snap.forEach((d) => list.push(d.data() as WithdrawalRequest));
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

        const currentPending = list.filter((w) => w.status === 'PENDING');
        const currentPendingIds = new Set(currentPending.map((w) => w.id));
        if (seenPendingWithdrawIdsRef.current !== null) {
          const newlyArrived = currentPending.filter(
            (w) => !seenPendingWithdrawIdsRef.current!.has(w.id)
          );
          if (newlyArrived.length > 0) {
            const latest = newlyArrived[0];
            const ignLabel = latest.inGameName ? ` (IGN: ${latest.inGameName})` : '';
            setToastMessage(
              `নতুন Withdraw Request: ${latest.userName || 'Player'}${ignLabel} · ৳${latest.amount} (${latest.method})`
            );
          }
        }
        seenPendingWithdrawIdsRef.current = currentPendingIds;

        setWithdrawalRequests(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'withdrawalRequests');
      }
    );
    const unsubTourErrors = subscribeOptimisticTournamentErrors((msg) => {
      setToastMessage(msg);
    });
    const unsubWithdrawOpt = subscribeOptimisticWithdrawStore(() => {
      setOptimisticWithdrawTick((t) => t + 1);
    });
    return () => {
      unsubAdmins();
      unsubWeekly();
      unsubWithdrawals();
      unsubTourErrors();
      unsubWithdrawOpt();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!showCreateTourModal) {
      creatingTourRef.current = false;
      setIsCreatingTour(false);
    }
  }, [showCreateTourModal]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [tList, deps, withs, tkts, settDoc, userSnap, trxSnap, resultsSnap, regsSnap] = await Promise.all([
        fetchTournaments(),
        fetchDepositRequests(),
        fetchWithdrawalRequests(),
        fetchAllTickets(),
        getDoc(doc(db, 'settings', 'global')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'matchResults')),
        getDocs(collection(db, 'registrations')),
      ]);

      setTournaments(tList);
      setDepositRequests(deps);
      setWithdrawalRequests(withs);
      setTickets(tkts);

      if (settDoc.exists()) {
        const s = settDoc.data() as AppSettings;
        setSettings(s);
        setBkashNum(s.bkashNumber || '');
        setNagadNum(s.nagadNumber || '');
      }

      const uList: UserProfile[] = [];
      userSnap.forEach((d) => uList.push(d.data() as UserProfile));
      setUsersList(uList);
      Promise.all(uList.map((u) => syncLeaderboardEntry(u))).catch(() => {});

      const trxList: WalletTransaction[] = [];
      trxSnap.forEach((d) => trxList.push(d.data() as WalletTransaction));
      trxList.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      setTransactionsList(trxList);

      const resMap: Record<string, MatchResult> = {};
      resultsSnap.forEach((d) => {
        const resData = d.data() as MatchResult;
        resMap[resData.tournamentId || d.id] = resData;
      });
      setMatchResultsMap(resMap);

      const regGroups: Record<string, TournamentRegistration[]> = {};
      regsSnap.forEach((d) => {
        const reg = d.data() as TournamentRegistration;
        if (!regGroups[reg.tournamentId]) regGroups[reg.tournamentId] = [];
        regGroups[reg.tournamentId].push(reg);
      });
      Object.values(regGroups).forEach((arr) =>
        arr.sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
      );
      setAllRegistrationsMap(regGroups);

      // Fetch room credentials for each tournament
      const rMap: Record<string, RoomCredential> = {};
      await Promise.all(
        tList.map(async (t) => {
          try {
            const r = await fetchRoomCredentials(t.id);
            if (r) rMap[t.id] = r;
          } catch {
            // ignore
          }
        })
      );
      setRoomsMap(mergeOptimisticRoomsMap(rMap));

      if (tList.length > 0) {
        setSelectedTourForRoom(tList[0].id);
        setSelectedTourForScoring(tList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load Room Data when tournament selection changes in rooms tab
  useEffect(() => {
    if (selectedTourForRoom) {
      fetchRoomCredentials(selectedTourForRoom).then((r) => {
        if (r && r.roomId && r.roomId.trim()) {
          setRoomData(r);
        } else {
          setRoomData({
            id: selectedTourForRoom,
            tournamentId: selectedTourForRoom,
            roomId: r?.roomId || '',
            roomPassword: r?.roomPassword || '',
            releaseTime: r?.releaseTime || new Date().toISOString(),
            isPublished: true,
          });
        }
      });
    }
  }, [selectedTourForRoom]);

  // Load Registrations & prefill existing Match Result when tournament for scoring changes
  useEffect(() => {
    const tourChanged = prevScoringTourRef.current !== selectedTourForScoring;
    prevScoringTourRef.current = selectedTourForScoring;
    if (tourChanged) {
      setConfirmUndoResult(false);
      setScoringStatusMessage(null);
      setJustDeclaredTourId(null);
      setHasScoringEdits(false);
    }

    if (selectedTourForScoring) {
      const applyRegs = (regs: TournamentRegistration[]) => {
        setScoringRegistrations(regs);
        const existingResult = matchResultsMap[selectedTourForScoring];
        const map: Record<string, { placement: number; kills: number }> = {};

        regs.forEach((r, idx) => {
          const matchedStanding = existingResult?.standings?.find((st) => {
            if (r.teamName && st.teamName && st.teamName === r.teamName) return true;
            if (r.userId && st.playerUids?.includes(r.userId)) return true;
            return false;
          });
          map[r.id] = matchedStanding
            ? {
                placement: Math.max(1, Number(matchedStanding.placement || idx + 1)),
                kills: Math.max(0, Number(matchedStanding.kills || 0)),
              }
            : { placement: idx + 1, kills: 0 };
        });
        setStandingsInput(map);
      };

      const cachedRegs = allRegistrationsMap[selectedTourForScoring];
      if (cachedRegs && tourChanged) {
        applyRegs(cachedRegs);
      }

      fetchRegistrationsForTournament(selectedTourForScoring).then((regs) => {
        applyRegs(regs);
      });
    } else {
      setScoringRegistrations([]);
      setStandingsInput({});
    }
  }, [selectedTourForScoring, matchResultsMap, allRegistrationsMap]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070B18] p-8 text-center text-white flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold font-gaming">You are not authorized</h2>
        <p className="text-xs text-slate-400">
          You do not have administrative permissions to view this control room.
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs cursor-pointer"
          >
            Back to Home
          </button>
        )}
      </div>
    );
  }

  // Handle Create Tournament (Instant <1s UI + Background Atomic Firestore Save)
  const handleCreateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingTourRef.current || isCreatingTour) {
      return;
    }

    try {
      const selectedCat = newTour.category || 'BR MATCH';
      const isPlacementPrize = isPlacementPrizeCategory(selectedCat);
      const isFreeMatch = normalizeCategory(selectedCat) === 'FREE MATCH';
      const allowPerKill = supportsPerKillPrize(selectedCat);
      const catRules = getLiveCategoryRulesText(selectedCat);
      const parsedPerKill = allowPerKill ? Math.max(0, Number(newTour.perKillPrize ?? 0) || 0) : 0;
      const parsedEntryFee = Math.max(0, Number(newTour.entryFee ?? 0) || 0);
      const parsedPrizePool = Math.max(0, Number(newTour.prizePool ?? 0) || 0);
      const parsedMaxSlots = Math.max(1, Number(newTour.maxSlots ?? 24) || 24);

      const rawFirst = Math.max(0, Number(newTour.firstPrize || 0) || 0);
      const rawSecond = Math.max(0, Number(newTour.secondPrize || 0) || 0);
      const rawThird = Math.max(0, Number(newTour.thirdPrize || 0) || 0);
      const rawFourth = Math.max(0, Number(newTour.fourthPrize || 0) || 0);
      const rawFifth = Math.max(0, Number(newTour.fifthPrize || 0) || 0);

      const cleanTitle = (newTour.title || '').trim();
      if (!cleanTitle) {
        setToastMessage('অনুগ্রহ করে টুর্নামেন্টের নাম লিখুন! (Please enter tournament name)');
        return;
      }

      if (isPlacementPrize && !isFreeMatch && (rawFirst < 1 || rawSecond < 1 || rawThird < 1)) {
        setToastMessage(
          '1st, 2nd এবং 3rd Winning Prize কমপক্ষে ৳1 হতে হবে! (Winning prizes must be at least ৳1)'
        );
        return;
      }

      // Lock synchronously immediately so double-clicks cannot create duplicate matches
      creatingTourRef.current = true;
      setIsCreatingTour(true);

      const parsedFirstPrize = isPlacementPrize ? rawFirst : 0;
      const parsedSecondPrize = isPlacementPrize ? rawSecond : 0;
      const parsedThirdPrize = isPlacementPrize ? rawThird : 0;
      const parsedFourthPrize = isPlacementPrize ? rawFourth : 0;
      const parsedFifthPrize = isPlacementPrize ? rawFifth : 0;

      const autoTitleBn = generateAutoBanglaTitle(cleanTitle);
      const resolvedBannerUrl =
        !isPlaceholderBannerUrl(newTour.bannerUrl) &&
        !isBuiltInCategoryBannerUrl(newTour.bannerUrl)
          ? newTour.bannerUrl
          : getMatchBannerUrl(selectedCat);

      const instantRes = createTournamentInstant({
        tournament: {
          ...newTour,
          title: cleanTitle,
          titleBn: autoTitleBn,
          category: selectedCat,
          type: newTour.type || 'SQUAD',
          gameMode: (newTour.gameMode || 'BATTLE_ROYALE') as GameMode,
          entryFee: parsedEntryFee,
          prizePool: parsedPrizePool,
          firstPrize: parsedFirstPrize,
          secondPrize: parsedSecondPrize,
          thirdPrize: parsedThirdPrize,
          fourthPrize: parsedFourthPrize,
          fifthPrize: parsedFifthPrize,
          perKillPrize: parsedPerKill,
          maxSlots: parsedMaxSlots,
          map: newTour.map || 'Bermuda',
          bannerUrl: resolvedBannerUrl,
          rules: catRules,
          rulesBn: catRules,
          showParticipants: newTour.showParticipants !== false,
          createdBy: userProfile?.uid || 'admin',
        } as any,
        initialRoom: {
          roomId: newTourRoom.roomId,
          roomPassword: newTourRoom.roomPassword,
          isPublished: newTourRoom.isPublished,
        },
        onBackgroundFailed: (failedId, errMsg) => {
          setTournaments((prev) => prev.filter((item) => item.id !== failedId));
          setRoomsMap((prev) => {
            const next = { ...prev };
            delete next[failedId];
            return next;
          });
          setToastMessage(errMsg || 'টুর্নামেন্ট সেভ করতে সমস্যা হয়েছে!');
        },
      });

      if (!instantRes.started) {
        creatingTourRef.current = false;
        setIsCreatingTour(false);
        return;
      }

      // Immediately reflect in Admin Manage Matches, Rooms & Scoring dropdowns (<100ms)
      setTournaments((prev) => mergeOptimisticTournaments([instantRes.tournament, ...prev]));
      setRoomsMap((prev) => ({
        ...prev,
        [instantRes.tournament.id]: instantRes.room,
      }));
      setSelectedTourForRoom((prev) => prev || instantRes.tournament.id);
      setSelectedTourForScoring((prev) => prev || instantRes.tournament.id);

      // Immediately close modal, reset form & show Success notification
      setShowCreateTourModal(false);
      setNewTour({
        title: '',
        titleBn: '',
        type: 'SQUAD',
        gameMode: 'BATTLE_ROYALE',
        category: 'BR MATCH',
        map: 'Bermuda',
        entryFee: 100,
        prizePool: 2400,
        firstPrize: 1200,
        secondPrize: 600,
        thirdPrize: 300,
        fourthPrize: '' as unknown as number,
        fifthPrize: '' as unknown as number,
        perKillPrize: 10,
        maxSlots: 24,
        status: 'REGISTRATION_OPEN',
        matchDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Dhaka',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
        matchTime: '08:00 PM',
        registrationDeadline: new Date(Date.now() + 80000000).toISOString(),
        rules: 'No emulator. Mobile only. No hack/scripts.',
        rulesBn: 'শুধুমাত্র মোবাইল প্লেয়ার। কোনো প্রকার হ্যাক বা এমুলেটর নিষিদ্ধ।',
        bannerUrl: getMatchBannerUrl('BR MATCH'),
        showParticipants: true,
      });
      setNewTourRoom({ roomId: '', roomPassword: '', isPublished: false });
      setToastMessage('Success! নতুন টুর্নামেন্ট সফলভাবে তৈরি হয়েছে!');
    } catch (err: unknown) {
      creatingTourRef.current = false;
      setIsCreatingTour(false);
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  // Open Edit Tournament Modal
  const handleOpenEditTour = async (t: Tournament) => {
    setEditingTour({
      ...t,
      perKillPrize: supportsPerKillPrize(t.category || getTournamentCategory(t))
        ? (t.perKillPrize ?? 0)
        : 0,
    });
    const r = await fetchRoomCredentials(t.id);
    if (r) {
      setEditingTourRoom(r);
      setEditingTourRoomSnapshot({
        roomId: r.roomId || '',
        roomPassword: r.roomPassword || '',
        isPublished: Boolean(r.isPublished),
      });
    } else {
      setEditingTourRoom({
        id: t.id,
        tournamentId: t.id,
        roomId: '',
        roomPassword: '',
        releaseTime: t.matchDate || new Date().toISOString(),
        isPublished: false,
      });
      setEditingTourRoomSnapshot({
        roomId: '',
        roomPassword: '',
        isPublished: false,
      });
    }
    setShowEditTourModal(true);
  };

  // Update Tournament Submission
  const handleUpdateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTour) return;
    try {
      const selectedCat = editingTour.category || 'BR MATCH';
      const isPlacementPrize = isPlacementPrizeCategory(selectedCat);
      const isFreeMatch = normalizeCategory(selectedCat) === 'FREE MATCH';
      const rawFirst = Math.max(0, Number(editingTour.firstPrize || 0) || 0);
      const rawSecond = Math.max(0, Number(editingTour.secondPrize || 0) || 0);
      const rawThird = Math.max(0, Number(editingTour.thirdPrize || 0) || 0);
      const rawFourth = Math.max(0, Number(editingTour.fourthPrize || 0) || 0);
      const rawFifth = Math.max(0, Number(editingTour.fifthPrize || 0) || 0);

      if (isPlacementPrize && !isFreeMatch && (rawFirst < 1 || rawSecond < 1 || rawThird < 1)) {
        setToastMessage(
          '1st, 2nd এবং 3rd Winning Prize কমপক্ষে ৳1 হতে হবে! (Winning prizes must be at least ৳1)'
        );
        return;
      }

      const cleanTitle = (editingTour.title || '').trim();
      const autoTitleBn = generateAutoBanglaTitle(cleanTitle);
      const joinedCount = Math.max(0, Number(editingTour.registeredCount || 0));
      const parsedEditSlots = Math.max(1, Math.floor(Number(editingTour.maxSlots ?? 24) || 24));
      if (parsedEditSlots < joinedCount) {
        setToastMessage(
          `Already ${joinedCount} জন জয়েন করেছে! এর কম Slot করা যাবে না।`
        );
        return;
      }
      if (isSlotEditableCategory(selectedCat)) {
        const categorySlotCap = getMaxSlotLimitForCategory(selectedCat);
        if (categorySlotCap !== null && parsedEditSlots > categorySlotCap) {
          setToastMessage(
            `${isFreeMatch ? 'SPECIAL MATCH' : 'BR MATCH'}-এ সর্বোচ্চ ${categorySlotCap} Slot পর্যন্ত করা যাবে!`
          );
          return;
        }
      }

      const prevTour = tournaments.find((item) => item.id === editingTour.id);
      const todayDhakaStr = getDhakaTodayDateStr();
      let resolvedMatchDate = (editingTour.matchDate || todayDhakaStr).trim();
      const resolvedMatchTime = (editingTour.matchTime || '').trim();
      let editedMatchTarget = parseMatchDateAndTime(resolvedMatchDate, resolvedMatchTime);
      const nowMs = Date.now();
      if (editedMatchTarget && editedMatchTarget.getTime() <= nowMs) {
        const todayTarget = parseMatchDateAndTime(todayDhakaStr, resolvedMatchTime);
        if (todayTarget && todayTarget.getTime() > nowMs) {
          resolvedMatchDate = todayDhakaStr;
          editedMatchTarget = todayTarget;
        }
      }

      let nextStatus = editingTour.status;
      if (
        nextStatus !== 'COMPLETED' &&
        nextStatus !== 'CANCELLED' &&
        editedMatchTarget &&
        editedMatchTarget.getTime() > nowMs &&
        nextStatus === 'ONGOING'
      ) {
        nextStatus =
          joinedCount > 0 && parsedEditSlots <= joinedCount
            ? 'REGISTRATION_FULL'
            : 'REGISTRATION_OPEN';
      } else if (nextStatus === 'REGISTRATION_FULL' && parsedEditSlots > joinedCount) {
        nextStatus = 'REGISTRATION_OPEN';
      } else if (
        nextStatus === 'REGISTRATION_OPEN' &&
        joinedCount > 0 &&
        parsedEditSlots <= joinedCount
      ) {
        nextStatus = 'REGISTRATION_FULL';
      }

      const scheduleChangedByAdmin =
        !prevTour ||
        prevTour.matchTime !== resolvedMatchTime ||
        prevTour.matchDate !== resolvedMatchDate;

      await updateTournament(editingTour.id, {
        title: cleanTitle,
        titleBn: autoTitleBn,
        category: selectedCat,
        type: editingTour.type,
        gameMode: editingTour.gameMode,
        map: editingTour.map || 'Bermuda',
        entryFee: Math.max(0, Number(editingTour.entryFee ?? 0) || 0),
        prizePool: Math.max(0, Number(editingTour.prizePool ?? 0) || 0),
        firstPrize: isPlacementPrize ? rawFirst : 0,
        secondPrize: isPlacementPrize ? rawSecond : 0,
        thirdPrize: isPlacementPrize ? rawThird : 0,
        fourthPrize: isPlacementPrize ? rawFourth : 0,
        fifthPrize: isPlacementPrize ? rawFifth : 0,
        perKillPrize: supportsPerKillPrize(selectedCat)
          ? Math.max(0, Number(editingTour.perKillPrize ?? 0) || 0)
          : 0,
        maxSlots: parsedEditSlots,
        status: nextStatus,
        matchDate: resolvedMatchDate,
        matchTime: resolvedMatchTime,
        ...(scheduleChangedByAdmin
          ? {
              originalMatchDate: resolvedMatchDate,
              originalMatchTime: resolvedMatchTime,
            }
          : {}),
        bannerUrl:
          !isPlaceholderBannerUrl(editingTour.bannerUrl) &&
          !isBuiltInCategoryBannerUrl(editingTour.bannerUrl)
            ? editingTour.bannerUrl
            : getMatchBannerUrl(selectedCat),
        rules: editingTour.rules,
        rulesBn: editingTour.rulesBn,
        showParticipants: editingTour.showParticipants !== false,
      });

      let roomNotifiedMsg: string | null = null;
      if (editingTourRoom) {
        const nextRoomId = editingTourRoom.roomId.trim();
        const nextRoomPass = editingTourRoom.roomPassword.trim();
        const prev = editingTourRoomSnapshot;
        const roomCredentialsChangedOrNewlyPublished =
          !prev ||
          !prev.isPublished ||
          prev.roomId.trim() !== nextRoomId ||
          prev.roomPassword.trim() !== nextRoomPass;

        if (editingTourRoom.isPublished && nextRoomId && roomCredentialsChangedOrNewlyPublished) {
          const updatedTourObj: Tournament = {
            ...editingTour,
            category: selectedCat,
            map: editingTour.map || 'Bermuda',
          };
          const pubRes = await publishRoomCredentialsWithNotification(
            updatedTourObj,
            nextRoomId,
            nextRoomPass
          );
          if (!pubRes.success) {
            setToastMessage(pubRes.message);
            return;
          }
          roomNotifiedMsg = pubRes.message;
        } else {
          await saveRoomCredentials(editingTourRoom);
        }
      }

      setShowEditTourModal(false);
      await loadAllAdminData();
      setToastMessage(
        roomNotifiedMsg ||
          'টুর্নামেন্ট সফলভাবে আপডেট করা হয়েছে! (Tournament updated successfully!)'
      );
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  // Open Quick Room Modal
  const handleOpenQuickRoom = async (t: Tournament) => {
    setQuickRoomTour(t);
    const r = await fetchRoomCredentials(t.id);
    if (r && r.roomId && r.roomId.trim()) {
      setQuickRoomData(r);
    } else {
      setQuickRoomData({
        id: t.id,
        tournamentId: t.id,
        roomId: r?.roomId || '',
        roomPassword: r?.roomPassword || '',
        releaseTime: t.matchDate || new Date().toISOString(),
        isPublished: true,
      });
    }
    setShowQuickRoomModal(true);
  };

  // Save Quick Room Modal
  const handleSaveQuickRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (quickRoomTour && quickRoomData.isPublished && quickRoomData.roomId.trim()) {
        const res = await publishRoomCredentialsWithNotification(
          quickRoomTour,
          quickRoomData.roomId,
          quickRoomData.roomPassword
        );
        if (!res.success) {
          setToastMessage(res.message);
          return;
        }
        setShowQuickRoomModal(false);
        await loadAllAdminData();
        setToastMessage(res.message);
      } else {
        await saveRoomCredentials(quickRoomData);
        setShowQuickRoomModal(false);
        await loadAllAdminData();
        setToastMessage('রুম আইডি ও পাসওয়ার্ড ড্রাফট হিসেবে সংরক্ষিত হয়েছে! (Publish অন করলে প্লেয়াররা নোটিফিকেশন পাবে)');
      }
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  // Open Delete Tournament Modal
  const handleOpenDeleteTourModal = (tour: Tournament) => {
    if (!isAdmin) return;
    setTournamentToDelete(tour);
  };

  // Confirm and Execute Tournament Deletion (Instant <1s UI + Background Batch Delete)
  const handleConfirmDeleteTournament = () => {
    if (!isAdmin || !tournamentToDelete) return;
    const targetTour = tournamentToDelete;
    const tourId = targetTour.id;

    const res = deleteTournamentInstant({
      id: tourId,
      onBackgroundFailed: (_failedId, errMsg) => {
        setTournaments((prev) => mergeOptimisticTournaments([targetTour, ...prev]));
        setToastMessage('টুর্নামেন্ট ডিলিট করতে ত্রুটি হয়েছে: ' + errMsg);
      },
    });

    if (!res.started) return;

    setTournaments((prev) => prev.filter((t) => t.id !== tourId));
    setRoomsMap((prev) => {
      const next = { ...prev };
      delete next[tourId];
      return next;
    });
    setTournamentToDelete(null);
    setToastMessage('Success! টুর্নামেন্ট ডিলিট হয়েছে!');
  };

  // Wipe All Tournaments (Instant UI + Background Batch Deletes)
  const handleConfirmWipeAll = () => {
    if (!isAdmin) return;
    const listSnapshot = [...tournaments];
    setTournaments([]);
    setRoomsMap({});
    setShowWipeAllModal(false);
    setToastMessage('Success! সব টুর্নামেন্ট ডিলিট হয়েছে!');
    listSnapshot.forEach((t) => {
      deleteTournamentInstant({
        id: t.id,
        onBackgroundFailed: (_failedId, errMsg) => {
          setTournaments((prev) => mergeOptimisticTournaments([t, ...prev]));
          setToastMessage('টুর্নামেন্ট ডিলিট করতে ত্রুটি হয়েছে: ' + errMsg);
        },
      });
    });
  };

  // Handle Save Room Credentials (from rooms tab)
  const handleSaveRoom = async () => {
    try {
      const targetTour = tournaments.find((t) => t.id === (roomData.tournamentId || selectedTourForRoom));
      if (targetTour && roomData.isPublished && roomData.roomId.trim()) {
        const res = await publishRoomCredentialsWithNotification(
          targetTour,
          roomData.roomId,
          roomData.roomPassword
        );
        await loadAllAdminData();
        setToastMessage(res.message);
      } else {
        await saveRoomCredentials(roomData);
        await loadAllAdminData();
        setToastMessage('রুম ক্রেডেনশিয়ালস সংরক্ষিত হয়েছে! (Publish অন করলে জয়েন করা প্লেয়ারদের কাছে নোটিফিকেশন যাবে)');
      }
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  // Handle Approve Deposit
  const handleApproveDeposit = async (id: string) => {
    const res = await adminApproveDeposit(id, 'Approved by Admin');
    setToastMessage(res.message);
    await loadAllAdminData();
  };

  // Handle Reject Deposit
  const handleRejectDeposit = async (id: string) => {
    const res = await adminRejectDeposit(id, 'Invalid Transaction ID or payment not received');
    setToastMessage(res.message);
    await loadAllAdminData();
  };

  // Handle Approve Withdrawal (Instant <1s UI + Background Atomic Firestore Save)
  const handleApproveWithdrawal = (id: string) => {
    const targetReq = resolvedWithdrawalRequests.find((w) => w.id === id);
    if (!targetReq || targetReq.status !== 'PENDING') return;

    if (
      withdrawActionLockRef.current[id] ||
      isAdminWithdrawActionInFlight(id) ||
      processingWithdrawId === id
    ) {
      return;
    }

    const releaseLock = acquireAdminWithdrawActionLock(id);
    if (!releaseLock) return;
    withdrawActionLockRef.current[id] = true;

    const nowIso = new Date().toISOString();
    const adminNote = 'Approved & Paid by Admin';
    const prevWithdrawalsSnapshot = withdrawalRequests;
    const prevUsersSnapshot = usersList;
    const prevTransactionsSnapshot = transactionsList;

    // 1. Instant 0ms UI update: move from PENDING -> WITHDRAW HISTORY (PAID)
    setOptimisticAdminWithdrawResolution({
      requestId: id,
      userId: targetReq.userId,
      status: 'PAID',
      processedAt: nowIso,
      adminNote,
      refundAmount: 0,
      refundToWinning: 0,
      refundToDeposited: 0,
    });
    setWithdrawalRequests((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: 'PAID', adminNote, processedAt: nowIso } : w
      )
    );
    setUsersList((prev) =>
      prev.map((u) =>
        u.uid === targetReq.userId
          ? {
              ...u,
              totalWithdrawn: Number(u.totalWithdrawn || 0) + Number(targetReq.amount || 0),
              updatedAt: nowIso,
            }
          : u
      )
    );
    setTransactionsList((prev) =>
      prev.map((tx) =>
        tx.id === 'trx_w_' + id
          ? {
              ...tx,
              status: 'COMPLETED',
              description: `Withdraw Approved via ${targetReq.method} (${targetReq.accountNumber})`,
              descriptionBn: `${targetReq.method} (${targetReq.accountNumber})-এ ৳${targetReq.amount} উইথড্র অ্যাপ্রুভ হয়েছে`,
            }
          : tx
      )
    );
    setToastMessage('উইথড্র সফলভাবে অ্যাপ্রুভ ও পেইড হিসেবে চিহ্নিত হয়েছে।');

    // 2. Background Firestore atomic transaction without blocking Admin
    void (async () => {
      try {
        const res = await adminApproveWithdrawal(id, adminNote, nowIso);
        if (!res.success) {
          throw new Error(res.message || 'উইথড্র প্রক্রিয়াকরণে সমস্যা হয়েছে।');
        }

        // Quietly refresh users & transactions without global spinner
        try {
          const [userSnap, trxSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'transactions')),
          ]);
          const freshUsers: UserProfile[] = [];
          userSnap.forEach((d) => freshUsers.push(d.data() as UserProfile));
          setUsersList(freshUsers);

          const freshTrx: WalletTransaction[] = [];
          trxSnap.forEach((d) => freshTrx.push(d.data() as WalletTransaction));
          freshTrx.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
          setTransactionsList(freshTrx);
        } catch {
          // Non-critical quiet sync
        } finally {
          clearOptimisticAdminWithdrawResolution(id);
        }
      } catch (err: unknown) {
        clearOptimisticAdminWithdrawResolution(id);
        setWithdrawalRequests(prevWithdrawalsSnapshot);
        setUsersList(prevUsersSnapshot);
        setTransactionsList(prevTransactionsSnapshot);
        setToastMessage(
          err instanceof Error ? err.message : 'উইথড্র প্রক্রিয়াকরণে সমস্যা হয়েছে।'
        );
      } finally {
        withdrawActionLockRef.current[id] = false;
        releaseLock();
      }
    })();
  };

  // Handle Reject Withdrawal & Refund (Instant <1s UI + Instant Refund + Background Atomic Firestore Save)
  const handleRejectWithdrawal = (id: string) => {
    const targetReq = resolvedWithdrawalRequests.find((w) => w.id === id);
    if (!targetReq || targetReq.status !== 'PENDING') return;

    if (
      withdrawActionLockRef.current[id] ||
      isAdminWithdrawActionInFlight(id) ||
      processingWithdrawId === id
    ) {
      return;
    }

    const releaseLock = acquireAdminWithdrawActionLock(id);
    if (!releaseLock) return;
    withdrawActionLockRef.current[id] = true;

    const nowIso = new Date().toISOString();
    const adminNote = 'Incorrect account number or declined';
    const refundAmount = Number(targetReq.amount || 0);
    const refundToWinning =
      typeof targetReq.deductedFromWinning === 'number'
        ? targetReq.deductedFromWinning
        : refundAmount;
    const refundToDeposited =
      typeof targetReq.deductedFromDeposited === 'number'
        ? targetReq.deductedFromDeposited
        : 0;

    const prevWithdrawalsSnapshot = withdrawalRequests;
    const prevUsersSnapshot = usersList;
    const prevTransactionsSnapshot = transactionsList;

    // 1. Instant 0ms UI update: move from PENDING -> WITHDRAW HISTORY (REJECTED) & refund player balance immediately
    setOptimisticAdminWithdrawResolution({
      requestId: id,
      userId: targetReq.userId,
      status: 'REJECTED',
      processedAt: nowIso,
      adminNote,
      refundAmount,
      refundToWinning,
      refundToDeposited,
    });
    setWithdrawalRequests((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status: 'REJECTED', adminNote, processedAt: nowIso } : w
      )
    );
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.uid !== targetReq.userId) return u;
        const breakdown = getWalletBreakdown(u);
        return {
          ...u,
          walletBalance: breakdown.availableBalance + refundAmount,
          spentFromWinning: Math.max(0, Number(u.spentFromWinning || 0) - refundToWinning),
          spentFromDeposited: Math.max(0, Number(u.spentFromDeposited || 0) - refundToDeposited),
          updatedAt: nowIso,
        };
      })
    );
    setTransactionsList((prev) =>
      prev.map((tx) =>
        tx.id === 'trx_w_' + id
          ? {
              ...tx,
              status: 'REJECTED',
              description: `Withdraw Rejected via ${targetReq.method} (${targetReq.accountNumber})`,
              descriptionBn: `${targetReq.method} (${targetReq.accountNumber})-এ ৳${refundAmount} উইথড্র বাতিল ও রিফান্ড`,
            }
          : tx
      )
    );
    setToastMessage('উইথড্র বাতিল এবং ব্যালেন্স রিফান্ড করা হয়েছে।');

    // 2. Background Firestore atomic transaction without blocking Admin
    void (async () => {
      try {
        const res = await adminRejectWithdrawal(id, adminNote, nowIso);
        if (!res.success) {
          throw new Error(res.message || 'বাতিল করতে সমস্যা হয়েছে।');
        }

        try {
          const [userSnap, trxSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'transactions')),
          ]);
          const freshUsers: UserProfile[] = [];
          userSnap.forEach((d) => freshUsers.push(d.data() as UserProfile));
          setUsersList(freshUsers);

          const freshTrx: WalletTransaction[] = [];
          trxSnap.forEach((d) => freshTrx.push(d.data() as WalletTransaction));
          freshTrx.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
          setTransactionsList(freshTrx);
        } catch {
          // Non-critical quiet sync
        } finally {
          clearOptimisticAdminWithdrawResolution(id);
        }
      } catch (err: unknown) {
        clearOptimisticAdminWithdrawResolution(id);
        setWithdrawalRequests(prevWithdrawalsSnapshot);
        setUsersList(prevUsersSnapshot);
        setTransactionsList(prevTransactionsSnapshot);
        setToastMessage(err instanceof Error ? err.message : 'বাতিল করতে সমস্যা হয়েছে।');
      } finally {
        withdrawActionLockRef.current[id] = false;
        releaseLock();
      }
    })();
  };

  // Handle Save / Declare Result OR Edit & Recalculate Winning (Instant <1s + Background Atomic Save)
  const handlePublishResults = () => {
    const tour = tournaments.find((t) => t.id === selectedTourForScoring);
    if (!tour) return;

    if (
      scoringSubmitting ||
      resultDeclareLockRef.current[tour.id] ||
      isResultDeclareInFlight(tour.id)
    ) {
      return;
    }

    const existingResultBefore = matchResultsMap[tour.id];
    if (
      existingResultBefore?.isPrizeDistributed &&
      justDeclaredTourId === tour.id &&
      !hasScoringEdits
    ) {
      return;
    }

    const releaseStoreLock = acquireResultDeclareLock(tour.id);
    if (!releaseStoreLock) {
      return;
    }
    resultDeclareLockRef.current[tour.id] = true;

    const nowIso = new Date().toISOString();
    const opId = `op_res_${tour.id}_${Date.now().toString(36)}`;
    const currentWeekStartIso = getCurrentWeekStartIso();

    const standings: TeamPlacementResult[] = scoringRegistrations.map((reg, idx) => {
      const input = standingsInput[reg.id] || { placement: idx + 1, kills: 0 };
      const placement = Math.max(1, Number(input.placement || idx + 1));
      const kills = Math.max(0, Number(input.kills || 0));
      const { placementPoints, killPoints, totalPoints } = calculatePoints(
        placement,
        kills,
        tour.scoringRules?.killPoints || 1
      );

      const { winPrize, killPrize, totalPrize } = calculateMatchPrizeBreakdown(
        tour,
        placement,
        kills
      );

      const uids = Array.from(
        new Set([reg.userId, ...(reg.playerUids || [])].filter(Boolean))
      );

      return {
        placement,
        teamId: reg.teamId || '',
        teamName: reg.teamName || reg.userName || `Slot #${reg.slotNumber}`,
        playerUids: uids,
        players: reg.players || [],
        kills,
        placementPoints,
        killPoints,
        totalPoints,
        placementPrizeWon: winPrize,
        killPrizeWon: killPrize,
        prizeWon: totalPrize,
      };
    });

    standings.sort((a, b) => a.placement - b.placement || b.totalPoints - a.totalPoints);

    // 1. Compute distributed records & per-UID wallet deltas synchronously (<2ms)
    const wasAlreadyDistributed = Boolean(existingResultBefore?.isPrizeDistributed);
    const oldRecords =
      wasAlreadyDistributed && existingResultBefore
        ? reconstructLegacyDistributedRecords(existingResultBefore, tour)
        : [];
    const newRecords = buildDistributedRecordsFromStandings(
      tour,
      standings,
      currentWeekStartIso
    );

    const oldByUid = new Map<string, typeof oldRecords[number]>();
    oldRecords.forEach((r) => oldByUid.set(r.uid, r));
    const newByUid = new Map<string, typeof newRecords[number]>();
    newRecords.forEach((r) => newByUid.set(r.uid, r));

    const allAffectedUids = Array.from(new Set([...oldByUid.keys(), ...newByUid.keys()]));
    const uidDeltas = allAffectedUids.map((uid) => {
      const o = oldByUid.get(uid);
      const n = newByUid.get(uid);
      return {
        uid,
        deltaEarnings: Number(n?.prizeCredited || 0) - Number(o?.prizeCredited || 0),
        deltaKills: Number(n?.kills || 0) - Number(o?.kills || 0),
        deltaWins: Number(n?.winCredited || 0) - Number(o?.winCredited || 0),
      };
    });

    const totalDistributedAmount = newRecords.reduce(
      (sum, rec) => sum + Number(rec.prizeCredited || 0),
      0
    );

    const existingPayouts = existingResultBefore?.winnerPayouts || {};
    const recordsWithPayouts = newRecords.map((rec) => {
      const prevPayout = existingPayouts[rec.uid];
      if (prevPayout?.status === 'PAID') {
        return {
          ...rec,
          payoutStatus: 'PAID' as const,
          payoutPaidAt: prevPayout.paidAt,
          payoutPaidBy: prevPayout.paidBy,
        };
      }
      return rec;
    });

    const optimisticResult: MatchResult = {
      id: tour.id,
      tournamentId: tour.id,
      tournamentTitle: tour.title,
      matchCategory: String(getTournamentCategory(tour)),
      standings,
      distributedRecords: recordsWithPayouts,
      ...(existingResultBefore?.winnerPayouts
        ? { winnerPayouts: existingResultBefore.winnerPayouts }
        : {}),
      totalDistributedAmount,
      isVerified: true,
      isPrizeDistributed: true,
      publishedAt: existingResultBefore?.publishedAt || nowIso,
      ...(wasAlreadyDistributed ? { editedAt: nowIso } : {}),
      createdAt: existingResultBefore?.createdAt || nowIso,
    };

    const prevTourStatus = tour.status;
    const prevUsersSnapshot = usersList;

    // 2. Apply immediate UI + Wallet Balance updates at 0ms
    applyOptimisticUserDeltas(opId, uidDeltas, nowIso);
    setOptimisticMatchResult(optimisticResult);
    setMatchResultsMap((prev) =>
      mergeOptimisticMatchResults({ ...prev, [tour.id]: optimisticResult })
    );
    setTournaments((prev) =>
      prev.map((item) =>
        item.id === tour.id ? { ...item, status: 'COMPLETED', updatedAt: nowIso } : item
      )
    );
    setUsersList((prev) => {
      const deltaMap = new Map(uidDeltas.map((d) => [d.uid, d]));
      return prev.map((u) => {
        const d = deltaMap.get(u.uid);
        if (!d) return u;
        const nextEarnings = Math.max(0, Number(u.totalEarnings || 0) + d.deltaEarnings);
        const avail = getWalletBreakdown(u).availableBalance;
        return {
          ...u,
          walletBalance: Math.max(0, avail + d.deltaEarnings),
          totalEarnings: nextEarnings,
          totalKills: Math.max(0, Number(u.totalKills || 0) + d.deltaKills),
          totalWins: Math.max(0, Number(u.totalWins || 0) + d.deltaWins),
          updatedAt: nowIso,
        };
      });
    });

    const instantMsg = wasAlreadyDistributed
      ? `ফলাফল সফলভাবে আপডেট হয়েছে এবং নতুন হিসাব অনুযায়ী মোট ৳${totalDistributedAmount} সমন্বয় করা হয়েছে!`
      : `ফলাফল ডিক্লেয়ার হয়েছে এবং বিজয়ীদের Winning Balance-এ মোট ৳${totalDistributedAmount} অটো যোগ হয়েছে!`;

    setScoringStatusMessage(instantMsg);
    setToastMessage(instantMsg);
    setConfirmUndoResult(false);
    setJustDeclaredTourId(tour.id);
    setHasScoringEdits(false);

    // 3. Persist atomically to Firestore in background without blocking Admin
    void (async () => {
      try {
        const res = await declareAndDistributeMatchResult(tour, standings, nowIso);
        if (!res.success) {
          throw new Error(res.message || 'প্রাইজ বিতরণে সমস্যা হয়েছে।');
        }

        // Quietly sync fresh users, transactions, and matchResults without showing global spinner
        try {
          const [userSnap, trxSnap, resultsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'transactions')),
            getDocs(collection(db, 'matchResults')),
          ]);

          const freshUsers: UserProfile[] = [];
          userSnap.forEach((d) => freshUsers.push(d.data() as UserProfile));
          setUsersList(freshUsers);

          const freshTrx: WalletTransaction[] = [];
          trxSnap.forEach((d) => freshTrx.push(d.data() as WalletTransaction));
          freshTrx.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
          setTransactionsList(freshTrx);

          const freshResMap: Record<string, MatchResult> = {};
          resultsSnap.forEach((d) => {
            const r = d.data() as MatchResult;
            freshResMap[r.tournamentId || d.id] = r;
          });
          clearOptimisticMatchResult(tour.id);
          setMatchResultsMap(freshResMap);
        } catch {
          // Non-critical quiet sync
        } finally {
          clearOptimisticUserDeltasByOpId(opId);
        }
      } catch (err: unknown) {
        // Roll back optimistic state cleanly on failure
        clearOptimisticUserDeltasByOpId(opId);
        clearOptimisticMatchResult(tour.id);
        setMatchResultsMap((prev) => {
          const next = { ...prev };
          if (existingResultBefore) {
            next[tour.id] = existingResultBefore;
          } else {
            delete next[tour.id];
          }
          return next;
        });
        setTournaments((prev) =>
          prev.map((item) =>
            item.id === tour.id ? { ...item, status: prevTourStatus } : item
          )
        );
        setUsersList(prevUsersSnapshot);
        setJustDeclaredTourId(null);
        const errMsg = err instanceof Error ? err.message : 'Failed to declare result.';
        setScoringStatusMessage(errMsg);
        setToastMessage(errMsg);
      } finally {
        resultDeclareLockRef.current[tour.id] = false;
        releaseStoreLock();
      }
    })();
  };

  // Handle Undo / Reverse Declared Result & Subtract Winning Balance
  const handleUndoResults = async () => {
    const tour = tournaments.find((t) => t.id === selectedTourForScoring);
    if (!tour || scoringSubmitting) return;

    setScoringSubmitting(true);
    setScoringStatusMessage('Reversing declared result and subtracting Winning Balances...');

    try {
      clearOptimisticMatchResult(tour.id);
      const res = await undoMatchResultAndRevertPrizes(tour.id);
      setJustDeclaredTourId(null);
      setHasScoringEdits(false);
      setScoringStatusMessage(res.message);
      setToastMessage(res.message);
      setConfirmUndoResult(false);
      await loadAllAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reverse result.';
      setScoringStatusMessage(msg);
      setToastMessage(msg);
    } finally {
      setScoringSubmitting(false);
    }
  };

  // Manual Reset Weekly Leaderboard
  const handleConfirmResetWeeklyLeaderboard = async () => {
    if (!isAdmin || isResettingWeekly) return;
    setIsResettingWeekly(true);
    try {
      const res = await manualResetWeeklyLeaderboard(
        userProfile?.displayName || userProfile?.email || 'Admin'
      );
      setToastMessage(res.message);
      if (res.success) {
        setShowResetWeeklyModal(false);
        await loadAllAdminData();
      }
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    } finally {
      setIsResettingWeekly(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        bkashNumber: bkashNum,
        nagadNumber: nagadNum,
        updatedAt: new Date().toISOString(),
      });
      setToastMessage('Payment numbers saved successfully!');
    } catch (err: unknown) {
      if (err instanceof Error) setToastMessage(err.message);
    }
  };

  // Handle Ticket Reply
  const handleSendTicketReply = async (ticketId: string) => {
    const text = replyText[ticketId];
    if (!text || !text.trim()) return;

    await replyToTicket(
      ticketId,
      {
        senderId: userProfile?.uid || 'admin',
        senderName: userProfile?.displayName || 'Support Team',
        senderRole: 'ADMIN',
        message: text.trim(),
      },
      'RESOLVED'
    );

    setReplyText((prev) => ({ ...prev, [ticketId]: '' }));
    await loadAllAdminData();
    setToastMessage('Reply sent and ticket resolved!');
  };

  const pendingDeposits = depositRequests.filter((d) => d.status === 'PENDING');
  const resolvedWithdrawalRequests = useMemo(
    () => mergeAdminOptimisticWithdrawals(withdrawalRequests),
    [withdrawalRequests, optimisticWithdrawTick]
  );
  const pendingWithdrawals = resolvedWithdrawalRequests.filter((w) => w.status === 'PENDING');
  const paidWithdrawals = resolvedWithdrawalRequests.filter(
    (w) => w.status === 'PAID' || w.status === 'APPROVED'
  );
  const rejectedWithdrawals = resolvedWithdrawalRequests.filter((w) => w.status === 'REJECTED');
  const pendingWithdrawTotal = pendingWithdrawals.reduce(
    (sum, w) => sum + Number(w.amount || 0),
    0
  );
  const rejectedWithdrawTotal = rejectedWithdrawals.reduce(
    (sum, w) => sum + Number(w.amount || 0),
    0
  );

  const usersByUid = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    usersList.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [usersList]);

  const totalUsersWalletBalance = usersList.reduce(
    (sum, u) => sum + getWalletBreakdown(u).availableBalance,
    0
  );
  const totalApprovedDeposits = depositRequests
    .filter((d) => d.status === 'APPROVED')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalPaidWithdrawals = paidWithdrawals.reduce(
    (sum, w) => sum + Number(w.amount || 0),
    0
  );
  const totalPrizesDistributed = transactionsList
    .filter((tx) => tx.type === 'PRIZE' && tx.status === 'COMPLETED')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const filteredWalletTransactions = transactionsList.filter((tx) =>
    walletTxFilter === 'ALL' ? true : tx.type === walletTxFilter
  );

  const filteredGameHistory = tournaments.filter((tour) => {
    if (gameHistoryFilter === 'COMPLETED') return tour.status === 'COMPLETED';
    if (gameHistoryFilter === 'ACTIVE') return tour.status !== 'COMPLETED';
    return true;
  });

  const isAuthorizedAdmin = Boolean(isAdmin);

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-[#070B18] py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div className="p-8 rounded-3xl bg-[#0D1428] border border-red-500/30 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-gaming text-white">
            Admin Access Only
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Please log in with an authorized Admin Number & Password to access the Admin Dashboard.
          </p>
          {onNavigate && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="px-5 py-2.5 rounded-xl bg-[#111D35] border border-slate-700 text-slate-300 font-bold font-gaming text-xs cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-gaming uppercase tracking-widest">
            <Shield className="w-4 h-4" />
            <span>Master Administration Room</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-gaming text-white mt-1">
            TX TOUR BD Admin Control Center
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-gaming text-xs flex items-center gap-1.5 border border-slate-700 shadow-md cursor-pointer transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Profile</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('manageAdmins')}
              className={`px-4 py-2.5 rounded-xl border font-bold font-gaming text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all ${
                activeTab === 'manageAdmins'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border-amber-500/40 text-amber-300 shadow-amber-500/10'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Manage Admins</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateTourModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs flex items-center gap-1.5 shadow-lg shadow-sky-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Match</span>
          </button>
        </div>
      </div>

      {/* Live Pending Withdraw Notification Alert (Always visible across Admin Dashboard) */}
      {pendingWithdrawals.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-red-950/45 border border-red-500/45 shadow-lg shadow-red-950/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <Bell className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs sm:text-sm font-black font-gaming uppercase tracking-wide text-white">
                {pendingWithdrawals.length} New Withdraw{' '}
                {pendingWithdrawals.length === 1 ? 'Request' : 'Requests'} Waiting
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-[11px] font-bold tabular-nums">
                Total: {formatBDT(pendingWithdrawTotal)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {pendingWithdrawals.slice(0, 4).map((pw) => {
                const pwIgn = pw.inGameName || usersByUid[pw.userId]?.inGameName || 'No IGN';
                return (
                  <button
                    key={pw.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('withdrawals');
                      setWithdrawFilter('PENDING');
                    }}
                    className="text-left px-3 py-1.5 rounded-xl bg-[#0D1428]/90 hover:bg-[#111D35] border border-red-500/30 text-[11px] text-slate-200 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-white">{pw.userName || 'Player'}</span>
                    <span className="text-slate-400"> · IGN: </span>
                    <span className="font-semibold text-sky-300">{pwIgn}</span>
                    <span className="text-slate-400"> · {pw.method} </span>
                    <span className="font-mono text-white">{pw.accountNumber}</span>
                    <span className="text-slate-400"> · </span>
                    <span className="font-black text-emerald-400 tabular-nums">{formatBDT(pw.amount)}</span>
                  </button>
                );
              })}
              {pendingWithdrawals.length > 4 && (
                <span className="self-center text-[11px] text-red-300 font-semibold">
                  +{pendingWithdrawals.length - 4} more
                </span>
              )}
            </div>
          </div>

          {activeTab !== 'withdrawals' && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('withdrawals');
                setWithdrawFilter('ALL');
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold font-gaming text-xs uppercase tracking-wider shadow-md cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              <span>Review &amp; Pay Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 text-xs font-gaming tracking-wider no-scrollbar">
        {[
          { id: 'tournaments', label: `Manage Matches (${tournaments.length})` },
          { id: 'deposits', label: `Deposit Requests (${pendingDeposits.length} Pending)` },
          { id: 'withdrawals', label: 'Withdraw Requests', badgeCount: pendingWithdrawals.length },
          { id: 'overview', label: 'Analytics' },
          { id: 'rooms', label: 'Room ID & Password' },
          { id: 'rules', label: 'Match Rules' },
          { id: 'wallet', label: 'Wallet' },
          { id: 'gameHistory', label: `Game History (${tournaments.length})` },
          { id: 'results', label: 'Scoring & Prizes' },
          { id: 'tickets', label: `Tickets (${tickets.length})` },
          { id: 'announcements', label: 'Send Announcement' },
          { id: 'settings', label: 'Payment Settings' },
          ...(isSuperAdmin ? [{ id: 'manageAdmins', label: 'Manage Admins' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? tab.id === 'manageAdmins'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'bg-[#0D1428] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black leading-none tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{tab.badgeCount}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Users</span>
              <span className="text-2xl font-black font-gaming text-white">{usersList.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tournaments</span>
              <span className="text-2xl font-black font-gaming text-sky-400">{tournaments.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-amber-500/30">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pending Deposits</span>
              <span className="text-2xl font-black font-gaming text-amber-400">{pendingDeposits.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-emerald-500/30">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pending Withdrawals</span>
              <span className="text-2xl font-black font-gaming text-emerald-400">{pendingWithdrawals.length}</span>
            </div>
          </div>

          {/* Quick Action Alerts */}
          {pendingDeposits.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between">
              <div className="text-xs text-amber-200">
                <span className="font-bold block">
                  {pendingDeposits.length} deposit requests waiting for admin approval.
                </span>
                <span className="text-[11px] text-amber-300/80">Verify TrxIDs to credit player balances.</span>
              </div>
              <button
                onClick={() => setActiveTab('deposits')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs"
              >
                Review Deposits
              </button>
            </div>
          )}

          {/* Weekly Leaderboard Control Card */}
          <div className="p-4 rounded-2xl bg-[#0D1428] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold font-gaming uppercase tracking-wider text-amber-400">
                  Weekly Leaderboard Control (Manual Reset)
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Auto Reset: প্রতি সোমবার রাত ১২টা (BD) • পরের রিসেট:{' '}
                <span className="font-bold text-amber-300">{formatTimeUntilWeeklyReset()}</span>
              </p>
              {weeklyTop1 ? (
                <p className="text-[11px] text-emerald-300 font-semibold">
                  Top Player of the Week: {weeklyTop1.displayName} (৳{weeklyTop1.weeklyEarnings || 0} • {weeklyTop1.weeklyWins || 0} Win • {weeklyTop1.weeklyKills || 0} Kills)
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  এই সপ্তাহে এখনো কোনো ম্যাচ রেজাল্ট পাবলিশ হয়নি।
                </p>
              )}
              {weeklyMeta.lastResetAt && (
                <p className="text-[10px] text-slate-500">
                  Last Manual Reset: {new Date(weeklyMeta.lastResetAt).toLocaleString()} ({weeklyMeta.lastResetBy || 'Admin'})
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowResetWeeklyModal(true)}
              disabled={isResettingWeekly}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold font-gaming text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResettingWeekly ? 'animate-spin' : ''}`} />
              <span>Reset Weekly Leaderboard</span>
            </button>
          </div>

          <SendAnnouncementSection
            tournaments={tournaments}
            adminEmail={userProfile?.email || userProfile?.displayName || 'Admin'}
          />
        </div>
      )}

      {/* 2. TOURNAMENTS MANAGEMENT */}
      {activeTab === 'tournaments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold font-gaming uppercase tracking-wider text-sky-400">
                Free Fire টুর্নামেন্ট ম্যানেজমেন্ট ({tournaments.length})
              </h3>
              <p className="text-xs text-slate-400">
                নতুন টুর্নামেন্ট তৈরি করুন, রুম আইডি/পাসওয়ার্ড দিন এবং টুর্নামেন্ট নিয়ন্ত্রণ করুন।
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateTourModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs shadow-lg shadow-sky-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>নতুন টুর্নামেন্ট তৈরি করুন</span>
              </button>
              {tournaments.length > 0 && (
                <button
                  onClick={handleConfirmWipeAll}
                  title="সব টুর্নামেন্ট মুছে ফেলুন"
                  className="px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-950 text-red-400 border border-red-500/30 text-xs font-semibold cursor-pointer"
                >
                  সব মুছুন
                </button>
              )}
            </div>
          </div>

          {tournaments.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[#0D1428] rounded-3xl border border-sky-500/20 shadow-2xl max-w-xl mx-auto space-y-4 my-6">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black font-gaming tracking-wide text-white">
                No tournaments yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                বর্তমানে কোনো টুর্নামেন্ট তৈরি করা হয়নি। নতুন ম্যাচ আয়োজন করতে উপরের বা নিচের বাটনে ক্লিক করে টুর্নামেন্ট তৈরি করুন।
              </p>
              <button
                onClick={() => setShowCreateTourModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>নতুন টুর্নামেন্ট তৈরি করুন</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => {
                const room = roomsMap[t.id];
                return (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-[#0D1428] border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col gap-4 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-gaming bg-blue-600 text-white">
                          {t.type}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-gaming bg-slate-800 text-sky-300">
                          {formatGameModeLabel(t.gameMode)}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-gaming bg-cyan-950 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {t.map || 'Bermuda'}
                        </span>
                        {(() => {
                          const matchStart = parseMatchDateAndTime(t.matchDate, t.matchTime);
                          let effectiveAdminStatus: string = t.status;
                          if (t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && matchStart) {
                            effectiveAdminStatus =
                              matchStart.getTime() <= Date.now()
                                ? 'ONGOING'
                                : t.registeredCount >= t.maxSlots
                                ? 'REGISTRATION_FULL'
                                : 'REGISTRATION_OPEN';
                          }
                          return (
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-gaming ${
                                effectiveAdminStatus === 'REGISTRATION_OPEN'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                  : effectiveAdminStatus === 'ONGOING'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                  : effectiveAdminStatus === 'COMPLETED'
                                  ? 'bg-blue-950 text-blue-400 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {effectiveAdminStatus}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Participants List Quick Toggle */}
                        <div className="flex items-center gap-1.5 bg-[#111D35] px-2.5 py-1 rounded-lg border border-slate-700">
                          <span className="text-[11px] text-slate-400 font-medium">Participants:</span>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextVal = t.showParticipants === false ? true : false;
                              await updateTournament(t.id, { showParticipants: nextVal });
                              setToastMessage(
                                nextVal
                                  ? 'প্লেয়ার লিস্ট দৃশ্যমান করা হয়েছে (Participants Visible)'
                                  : 'প্লেয়ার লিস্ট গোপন করা হয়েছে (Participants Hidden)'
                              );
                              loadAllAdminData();
                            }}
                            className={`px-2 py-0.5 rounded font-bold font-gaming text-[10px] flex items-center gap-1 cursor-pointer transition-all ${
                              t.showParticipants !== false
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-900/60'
                                : 'bg-red-950 text-red-400 border border-red-500/40 hover:bg-red-900/60'
                            }`}
                            title="Toggle Show / Hide participants list for normal users"
                          >
                            {t.showParticipants !== false ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>SHOW (ON)</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>HIDDEN (OFF)</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                          <select
                            value={t.status}
                            onChange={async (e) => {
                              await updateTournament(t.id, { status: e.target.value as any });
                              loadAllAdminData();
                            }}
                            className="px-2 py-1 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs font-semibold"
                          >
                            <option value="REGISTRATION_OPEN">REGISTRATION_OPEN</option>
                            <option value="REGISTRATION_FULL">REGISTRATION_FULL</option>
                            <option value="ONGOING">ONGOING</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h4 className="text-base sm:text-lg font-black text-white tracking-wide">
                          {t.title}
                        </h4>
                        {t.titleBn && (
                          <p className="text-xs text-sky-300/80 font-medium">{t.titleBn}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 text-[11px] mt-2">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-sky-400" />
                            {t.matchDate}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>{t.matchTime}</span>
                            {t.status !== 'COMPLETED' &&
                              t.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => setTimeEditTour(t)}
                                  title="Edit Match Time"
                                  aria-label="Edit Match Time"
                                  className="p-0.5 rounded bg-amber-400/95 hover:bg-amber-300 text-black shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                  <Pencil className="w-2.5 h-2.5 stroke-[2.5]" />
                                </button>
                              )}
                          </span>
                          <span className="text-slate-400">
                            ফি: <b className="text-white">{formatBDT(t.entryFee)}</b>
                          </span>
                          <span className="text-slate-400">
                            প্রাইজপুল: <b className="text-emerald-400">{formatBDT(t.prizePool)}</b>
                          </span>
                          {isPlacementPrizeCategory(getTournamentCategory(t)) && (
                            <span className="text-slate-400">
                              1st: <b className="text-amber-400">{formatBDT(t.firstPrize || 0)}</b> • 2nd:{' '}
                              <b className="text-sky-400">{formatBDT(t.secondPrize || 0)}</b> • 3rd:{' '}
                              <b className="text-orange-400">{formatBDT(t.thirdPrize || 0)}</b> • 4th:{' '}
                              <b className="text-emerald-400">{formatBDT(t.fourthPrize || 0)}</b> • 5th:{' '}
                              <b className="text-violet-400">{formatBDT(t.fifthPrize || 0)}</b>
                            </span>
                          )}
                          {supportsPerKillPrize(getTournamentCategory(t)) && (
                            <span className="text-slate-400">
                              প্রতি কিল: <b className="text-amber-300">{formatBDT(t.perKillPrize ?? 0)}</b>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <span>
                              স্লট: <b className="text-sky-300">{t.registeredCount} / {t.maxSlots}</b>
                            </span>
                            {isSlotEditableCategory(getTournamentCategory(t)) &&
                              t.status !== 'COMPLETED' &&
                              t.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => setSlotEditTour(t)}
                                  title="Edit Slots"
                                  aria-label="Edit Slots"
                                  className="p-0.5 rounded bg-amber-400/95 hover:bg-amber-300 text-black shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                  <Pencil className="w-2.5 h-2.5 stroke-[2.5]" />
                                </button>
                              )}
                          </span>
                        </div>
                      </div>

                      {/* Room Credentials status badge & details */}
                      <div className="w-full md:w-auto p-2.5 rounded-xl bg-[#111D35] border border-slate-700/80 text-xs shrink-0 min-w-[220px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-sky-400" />
                            রুম ক্রেডেনশিয়ালস
                          </span>
                          {room?.isPublished ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                              ✓ প্রকাশিত (লাইভ)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30">
                              অপ্রকাশিত
                            </span>
                          )}
                        </div>
                        {room?.roomId ? (
                          <div className="font-mono text-[11px] text-white">
                            <span>ID: <b className="text-sky-300">{room.roomId}</b></span>
                            <span className="mx-1.5 text-slate-600">|</span>
                            <span>Pass: <b className="text-sky-300">{room.roomPassword || 'None'}</b></span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">রুম আইডি দেওয়া হয়নি</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons bar */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTourForScoring(t.id);
                          setActiveTab('results');
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs cursor-pointer ${
                          matchResultsMap[t.id]?.isPrizeDistributed
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>
                          {matchResultsMap[t.id]?.isPrizeDistributed
                            ? 'এডিট / আনডু রেজাল্ট'
                            : 'রেজাল্ট ডিক্লেয়ার'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenQuickRoom(t)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-500/30 font-semibold text-xs cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>রুম আইডি ও পাসওয়ার্ড</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditTour(t)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 font-semibold text-xs cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>এডিট টুর্নামেন্ট</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleOpenDeleteTourModal(t)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-950 text-red-400 border border-red-500/30 font-semibold text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ডিলিট</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. ROOM ID & PASSWORD MANAGEMENT */}
      {activeTab === 'rooms' && (
        <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
              Publish Match Room ID & Password
            </h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('roomManager')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black font-gaming text-xs uppercase cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 border border-yellow-300"
              >
                <Key className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span>Open All Matches Room Manager</span>
              </button>
            )}
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Tournament *
              </label>
              <select
                value={selectedTourForRoom}
                onChange={(e) => setSelectedTourForRoom(e.target.value)}
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.matchDate} {t.matchTime})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-sky-400 mb-1">
                  Custom Room ID *
                </label>
                <input
                  type="text"
                  value={roomData.roomId}
                  onChange={(e) => setRoomData({ ...roomData, roomId: e.target.value })}
                  placeholder="e.g. 5839201"
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-400 mb-1">
                  Room Password *
                </label>
                <input
                  type="text"
                  value={roomData.roomPassword}
                  onChange={(e) => setRoomData({ ...roomData, roomPassword: e.target.value })}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="publishToggle"
                checked={roomData.isPublished}
                onChange={(e) => setRoomData({ ...roomData, isPublished: e.target.checked })}
                className="rounded border-slate-700 text-sky-500"
              />
              <label htmlFor="publishToggle" className="text-xs text-white font-semibold cursor-pointer">
                Release and make credentials visible to confirmed players now
              </label>
            </div>

            <button
              onClick={handleSaveRoom}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs rounded-xl shadow-md cursor-pointer"
            >
              {roomData.isPublished
                ? 'Publish Room & Notify Joined Players'
                : 'Save Room Credentials (Draft)'}
            </button>
          </div>
        </div>
      )}

      {/* 4. DEPOSIT REQUESTS APPROVAL */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
            Player Deposit Verification Queue ({depositRequests.length})
          </h3>

          {depositRequests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No deposit requests.</p>
          ) : (
            <div className="space-y-3">
              {depositRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-[#0D1428] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-950 text-pink-400 border border-pink-500/30">
                        {req.method}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-400'
                            : req.status === 'REJECTED'
                            ? 'bg-red-950 text-red-400'
                            : 'bg-amber-950 text-amber-400'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="font-bold text-white text-sm block">
                        Amount: {formatBDT(req.amount)}
                        {req.senderNumber ? ` • Sender: ${req.senderNumber}` : ''}
                      </span>
                      <span className="text-sky-300 font-mono tracking-widest block">
                        TrxID: {req.transactionId}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Player: {req.userName} ({req.userEmail}) • {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {req.status === 'PENDING' ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleApproveDeposit(req.id)}
                        className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                      >
                        Approve & Add ৳{req.amount}
                      </button>
                      <button
                        onClick={() => handleRejectDeposit(req.id)}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-red-950 hover:bg-red-900 text-red-400 border border-red-500/30 font-bold rounded-lg text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Processed on {new Date(req.processedAt || req.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. WITHDRAWALS MANAGEMENT & WITHDRAW HISTORY */}
      {activeTab === 'withdrawals' && (() => {
        const searchLower = withdrawSearch.trim().toLowerCase();
        const matchesSearch = (req: WithdrawalRequest) => {
          if (!searchLower) return true;
          const profile = usersByUid[req.userId];
          const name = (req.userName || profile?.displayName || '').toLowerCase();
          const ign = (req.inGameName || profile?.inGameName || '').toLowerCase();
          const num = (req.accountNumber || '').toLowerCase();
          const email = (req.userEmail || profile?.email || '').toLowerCase();
          return (
            name.includes(searchLower) ||
            ign.includes(searchLower) ||
            num.includes(searchLower) ||
            email.includes(searchLower)
          );
        };

        const filteredPending = pendingWithdrawals.filter(matchesSearch);
        const filteredHistory = resolvedWithdrawalRequests
          .filter((w) => w.status !== 'PENDING')
          .filter((w) => {
            if (withdrawFilter === 'PAID') return w.status === 'PAID' || w.status === 'APPROVED';
            if (withdrawFilter === 'REJECTED') return w.status === 'REJECTED';
            return true;
          })
          .filter(matchesSearch);

        const renderWithdrawCard = (req: WithdrawalRequest) => {
          const profile = usersByUid[req.userId];
          const playerName = req.userName || profile?.displayName || 'Player';
          const playerIgn = req.inGameName || profile?.inGameName || 'Not set';
          const isPaid = req.status === 'PAID' || req.status === 'APPROVED';
          const isPending = req.status === 'PENDING';
          const isBusy =
            processingWithdrawId === req.id || isAdminWithdrawActionInFlight(req.id);

          return (
            <div
              key={req.id}
              className={`p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-xs transition-colors ${
                isPending
                  ? 'bg-[#0D1428] border-red-500/40'
                  : 'bg-[#0D1428] border-slate-800'
              }`}
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-black text-white text-sm">{playerName}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#111D35] border border-sky-500/30 text-sky-300 font-bold">
                    IGN: {playerIgn}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-pink-950/60 border border-pink-500/30 text-pink-300 font-bold">
                    {req.method}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                      isPaid
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                        : req.status === 'REJECTED'
                        ? 'bg-red-950/70 text-red-400 border border-red-500/30'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isPaid ? 'PAID' : req.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-black font-gaming text-emerald-400 text-lg tabular-nums">
                    {formatBDT(req.amount)}
                  </span>
                  <span className="font-mono font-bold text-white bg-[#111D35] border border-slate-700 px-3 py-1.5 rounded-lg select-all">
                    {req.accountNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(req.accountNumber);
                      setCopiedWithdrawId(req.id);
                      setTimeout(() => setCopiedWithdrawId(null), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-sky-300 font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedWithdrawId === req.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{req.userEmail || profile?.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>
                  {req.processedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={isPaid ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>
                        {isPaid ? 'Paid' : 'Processed'}: {new Date(req.processedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>

                {req.adminNote && !isPending && (
                  <p className="text-[11px] text-slate-400">Note: {req.adminNote}</p>
                )}
              </div>

              {isPending ? (
                <div className="flex flex-wrap gap-2 w-full lg:w-auto shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleApproveWithdrawal(req.id)}
                    className="flex-1 lg:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBusy ? 'Processing...' : `Approve & Mark Paid (৳${req.amount})`}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRejectWithdrawal(req.id)}
                    className="flex-1 lg:flex-initial px-3.5 py-2.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-500/30 font-bold rounded-xl text-xs cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject &amp; Refund
                  </button>
                </div>
              ) : (
                <div className="shrink-0 text-left lg:text-right">
                  <span
                    className={`inline-block text-xs font-bold ${
                      isPaid ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isPaid ? 'Paid & Deducted' : 'Rejected & Refunded'}
                  </span>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-5">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-[#0D1428] border border-red-500/30 tabular-nums">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Pending Requests
                </span>
                <span className="text-xl font-black font-gaming text-red-400 block mt-0.5">
                  {pendingWithdrawals.length} · {formatBDT(pendingWithdrawTotal)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1428] border border-emerald-500/30 tabular-nums">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Paid History Total
                </span>
                <span className="text-xl font-black font-gaming text-emerald-400 block mt-0.5">
                  {paidWithdrawals.length} · {formatBDT(totalPaidWithdrawals)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1428] border border-slate-700 tabular-nums">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Rejected &amp; Refunded
                </span>
                <span className="text-xl font-black font-gaming text-slate-300 block mt-0.5">
                  {rejectedWithdrawals.length} · {formatBDT(rejectedWithdrawTotal)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20 tabular-nums">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Total Requests
                </span>
                <span className="text-xl font-black font-gaming text-sky-400 block mt-0.5">
                  {resolvedWithdrawalRequests.length}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs font-gaming">
                {(
                  [
                    { id: 'ALL', label: `All (${resolvedWithdrawalRequests.length})` },
                    {
                      id: 'PENDING',
                      label: `Pending (${pendingWithdrawals.length})`,
                      redDot: pendingWithdrawals.length > 0,
                    },
                    { id: 'PAID', label: `Withdraw History / Paid (${paidWithdrawals.length})` },
                    { id: 'REJECTED', label: `Rejected (${rejectedWithdrawals.length})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWithdrawFilter(f.id)}
                    className={`px-3 py-2 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                      withdrawFilter === f.id
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'bg-[#0D1428] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {'redDot' in f && f.redDot && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={withdrawSearch}
                  onChange={(e) => setWithdrawSearch(e.target.value)}
                  placeholder="Search Name, IGN, Number..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0D1428] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* SECTION A: PENDING WITHDRAW QUEUE */}
            {(withdrawFilter === 'ALL' || withdrawFilter === 'PENDING') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-red-400 flex items-center gap-2">
                    {filteredPending.length > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                    <span>Pending Withdraw Requests ({filteredPending.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Send bKash/Nagad manually, then click Approve &amp; Mark Paid
                  </span>
                </div>

                {filteredPending.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 rounded-2xl bg-[#0D1428] border border-slate-800">
                    No pending withdraw requests right now.
                  </p>
                ) : (
                  <div className="space-y-3">{filteredPending.map(renderWithdrawCard)}</div>
                )}
              </div>
            )}

            {/* SECTION B: WITHDRAW HISTORY (PAID & REJECTED) */}
            {withdrawFilter !== 'PENDING' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    <span>Withdraw History ({filteredHistory.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Complete record of paid &amp; rejected payouts
                  </span>
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 rounded-2xl bg-[#0D1428] border border-slate-800">
                    No withdraw history records match your filter.
                  </p>
                ) : (
                  <div className="space-y-3">{filteredHistory.map(renderWithdrawCard)}</div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 6. SCORING & AUTO WINNING DISTRIBUTION */}
      {activeTab === 'results' && (() => {
        const selectedTour = tournaments.find((t) => t.id === selectedTourForScoring);
        const existingResult = selectedTour ? matchResultsMap[selectedTour.id] : undefined;
        const isAlreadyDistributed = Boolean(existingResult?.isPrizeDistributed);
        const selectedCat = selectedTour ? getTournamentCategory(selectedTour) : 'BR MATCH';
        const isPlacementMode = isPlacementPrizeCategory(selectedCat);
        const allowPerKill = supportsPerKillPrize(selectedCat);
        const winTopPrize = selectedTour
          ? Number(selectedTour.firstPrize || 0) > 0
            ? Number(selectedTour.firstPrize || 0)
            : Number(selectedTour.prizePool || 0)
          : 0;

        const previewRows = scoringRegistrations.map((reg, idx) => {
          const input = standingsInput[reg.id] || { placement: idx + 1, kills: 0 };
          const breakdown = selectedTour
            ? calculateMatchPrizeBreakdown(selectedTour, input.placement, input.kills)
            : { winPrize: 0, killPrize: 0, totalPrize: 0 };
          return { reg, input, breakdown };
        });

        const totalAutoPayoutPreview = previewRows.reduce(
          (sum, row) => sum + row.breakdown.totalPrize,
          0
        );

        return (
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold font-gaming uppercase tracking-wider text-sky-400">
                  Match Result Declaration &amp; Auto Winning Balance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter who won and how many kills each player got — Save &amp; Declare immediately adds the winning money to each player&apos;s Winning Balance.
                </p>
              </div>
              <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowResetWeeklyModal(true)}
                  disabled={isResettingWeekly}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResettingWeekly ? 'animate-spin' : ''}`} />
                  <span>Reset Weekly Leaderboard</span>
                </button>
                <span className="text-[10px] text-slate-400">
                  Auto Reset Monday 12:00 AM ({formatTimeUntilWeeklyReset()})
                  {weeklyTop1 ? ` · #1: ${weeklyTop1.displayName}` : ''}
                </span>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Match / Tournament
                </label>
                <select
                  value={selectedTourForScoring}
                  onChange={(e) => setSelectedTourForScoring(e.target.value)}
                  className="w-full lg:max-w-lg px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs font-semibold"
                >
                  {tournaments.map((t) => {
                    const res = matchResultsMap[t.id];
                    const stateTag = res?.isPrizeDistributed ? 'Declared & Paid' : t.status;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.title} ({getTournamentCategory(t)} · {stateTag})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedTour && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 bg-[#111D35] border border-slate-800 px-4 py-2.5 rounded-xl tabular-nums">
                  <span className="font-bold text-sky-300">{selectedCat}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span>{selectedTour.type}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  {isPlacementMode ? (
                    <span>
                      1st: <b className="text-emerald-400">৳{winTopPrize}</b> · 2nd:{' '}
                      <b className="text-sky-300">৳{selectedTour.secondPrize || 0}</b> · 3rd:{' '}
                      <b className="text-amber-300">৳{selectedTour.thirdPrize || 0}</b> · 4th:{' '}
                      <b className="text-emerald-300">৳{selectedTour.fourthPrize || 0}</b> · 5th:{' '}
                      <b className="text-violet-300">৳{selectedTour.fifthPrize || 0}</b>
                      {allowPerKill && (
                        <>
                          {' '}· Per Kill:{' '}
                          <b className="text-red-300">৳{selectedTour.perKillPrize || 0}</b>
                        </>
                      )}
                    </span>
                  ) : (
                    <span>
                      Rank Prize: <b className="text-emerald-400">৳{winTopPrize}</b>
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedTour && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  isAlreadyDistributed
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-[#111D35] border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isAlreadyDistributed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className="font-semibold">
                    {isAlreadyDistributed
                      ? `Result Declared & Paid (Total Paid: ৳${
                          existingResult?.totalDistributedAmount ??
                          existingResult?.standings?.reduce((s, r) => s + (r.prizeWon || 0), 0) ??
                          0
                        }). You can edit ranks/kills below or Undo to subtract money.`
                      : 'Ready to Declare: Set Winner / Placement & Kills below, then click Save & Declare Result.'}
                  </span>
                </div>
                {existingResult?.publishedAt && (
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {existingResult.editedAt ? 'Updated' : 'Declared'}:{' '}
                    {new Date(existingResult.editedAt || existingResult.publishedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {scoringStatusMessage && (
              <div className="p-3.5 rounded-xl bg-blue-950/60 border border-sky-500/40 text-xs text-sky-200 font-medium">
                {scoringStatusMessage}
              </div>
            )}

            {scoringRegistrations.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No registered slots for this match yet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  {previewRows.map(({ reg, input, breakdown }) => {
                    const isFirstPlace = Number(input.placement) === 1;
                    const playerNames = (reg.players || [])
                      .map((p) => p.inGameName || p.name)
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <div
                        key={reg.id}
                        className={`p-3.5 sm:p-4 rounded-xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 text-xs transition-colors ${
                          isFirstPlace
                            ? 'bg-emerald-950/25 border-emerald-500/40'
                            : 'bg-[#111D35] border-slate-800'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-sky-950 text-sky-400 font-bold font-gaming flex items-center justify-center shrink-0 tabular-nums">
                            #{reg.slotNumber}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-sm block truncate">
                              {reg.teamName || reg.userName}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              Account: {reg.userName}
                              {playerNames ? ` · Players: ${playerNames}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              // Toggle this slot to #1 (and shift previous #1 if winner mode)
                              const nextMap = { ...standingsInput };
                              if (!isPlacementMode) {
                                Object.keys(nextMap).forEach((k) => {
                                  if (k !== reg.id && nextMap[k]?.placement === 1) {
                                    nextMap[k] = { ...nextMap[k], placement: 2 };
                                  }
                                });
                              }
                              nextMap[reg.id] = { ...input, placement: 1 };
                              setStandingsInput(nextMap);
                              setHasScoringEdits(true);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                              isFirstPlace
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#070B18] hover:bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {isFirstPlace ? 'Winner (#1)' : 'Set Winner'}
                          </button>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Rank (#)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={input.placement}
                              onChange={(e) => {
                                setStandingsInput({
                                  ...standingsInput,
                                  [reg.id]: {
                                    ...input,
                                    placement: Math.max(1, Number(e.target.value) || 1),
                                  },
                                });
                                setHasScoringEdits(true);
                              }}
                              className="w-16 px-2 py-1.5 bg-[#070B18] border border-slate-700 rounded-lg text-white text-center font-bold font-gaming tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Kills
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={input.kills}
                              onChange={(e) => {
                                setStandingsInput({
                                  ...standingsInput,
                                  [reg.id]: {
                                    ...input,
                                    kills: Math.max(0, Number(e.target.value) || 0),
                                  },
                                });
                                setHasScoringEdits(true);
                              }}
                              className="w-16 px-2 py-1.5 bg-[#070B18] border border-slate-700 rounded-lg text-red-400 text-center font-bold font-gaming tabular-nums"
                            />
                          </div>

                          <div className="text-right min-w-[130px] tabular-nums">
                            <span className="block text-[10px] text-slate-400">
                              {allowPerKill
                                ? `Win ৳${breakdown.winPrize} + Kill ৳${breakdown.killPrize}`
                                : `Rank Prize ৳${breakdown.winPrize}`}
                            </span>
                            <span className="font-black font-gaming text-sm text-emerald-400">
                              Auto: ৳{breakdown.totalPrize}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Bar: Declare / Edit / Undo */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-300 tabular-nums">
                    Total Auto Winning Payout:{' '}
                    <b className="text-emerald-400 font-gaming text-sm">
                      ৳{totalAutoPayoutPreview}
                    </b>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {(() => {
                      const isLockedAfterDeclare =
                        isAlreadyDistributed &&
                        justDeclaredTourId === selectedTour?.id &&
                        !hasScoringEdits;
                      const isDeclareBusy =
                        scoringSubmitting ||
                        (selectedTour ? isResultDeclareInFlight(selectedTour.id) : false);
                      return (
                        <button
                          type="button"
                          disabled={isDeclareBusy || isLockedAfterDeclare}
                          onClick={handlePublishResults}
                          className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold font-gaming text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
                        >
                          {isLockedAfterDeclare ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>
                            {isLockedAfterDeclare
                              ? `Declared & Paid (৳${totalAutoPayoutPreview})`
                              : scoringSubmitting
                              ? 'Reversing...'
                              : isAlreadyDistributed
                              ? `Edit & Update Winning (৳${totalAutoPayoutPreview})`
                              : `Save & Declare Result (Auto Add ৳${totalAutoPayoutPreview})`}
                          </span>
                        </button>
                      );
                    })()}

                    {isAlreadyDistributed && !confirmUndoResult && (
                      <button
                        type="button"
                        disabled={scoringSubmitting}
                        onClick={() => setConfirmUndoResult(true)}
                        className="px-4 py-3 bg-red-950/70 hover:bg-red-900/70 text-red-300 border border-red-500/40 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Undo / Reverse Winning</span>
                      </button>
                    )}

                    {isAlreadyDistributed && confirmUndoResult && (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-red-950/60 border border-red-500/50">
                        <span className="text-[11px] text-red-200 px-2 font-semibold">
                          Subtract all paid prizes from winners?
                        </span>
                        <button
                          type="button"
                          disabled={scoringSubmitting}
                          onClick={handleUndoResults}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Confirm Undo
                        </button>
                        <button
                          type="button"
                          disabled={scoringSubmitting}
                          onClick={() => setConfirmUndoResult(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 7. SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
            Player Support Inquiries ({tickets.length})
          </h3>

          <div className="space-y-3">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-5 rounded-2xl bg-[#0D1428] border border-slate-800 space-y-3 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white text-sm block">{tkt.subject}</span>
                    <span className="text-[10px] text-slate-400">
                      From: {tkt.userName} ({tkt.userEmail}) • Category: {tkt.category}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-400">
                    {tkt.status}
                  </span>
                </div>

                <p className="p-3 rounded-xl bg-[#111D35] text-slate-300 border border-slate-800">
                  {tkt.message}
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText[tkt.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [tkt.id]: e.target.value })}
                    placeholder="Type official admin reply..."
                    className="flex-1 px-3 py-1.5 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs"
                  />
                  <button
                    onClick={() => handleSendTicketReply(tkt.id)}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs"
                  >
                    Reply & Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WALLET & TRANSACTION LEDGER */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/25">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Total User Balances
              </span>
              <span className="text-xl sm:text-2xl font-black font-gaming text-sky-400 mt-1 block">
                {formatBDT(totalUsersWalletBalance)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-emerald-500/25">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Approved Deposits
              </span>
              <span className="text-xl sm:text-2xl font-black font-gaming text-emerald-400 mt-1 block">
                {formatBDT(totalApprovedDeposits)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-amber-500/25">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Paid Withdrawals
              </span>
              <span className="text-xl sm:text-2xl font-black font-gaming text-amber-400 mt-1 block">
                {formatBDT(totalPaidWithdrawals)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0D1428] border border-purple-500/25">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Prizes Distributed
              </span>
              <span className="text-xl sm:text-2xl font-black font-gaming text-purple-300 mt-1 block">
                {formatBDT(totalPrizesDistributed)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span>Platform Wallet Transactions ({filteredWalletTransactions.length})</span>
            </h3>

            <div className="flex flex-wrap gap-1.5 text-xs font-gaming">
              {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'ENTRY_FEE', 'PRIZE'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setWalletTxFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                    walletTxFilter === f
                      ? 'bg-sky-500 text-white'
                      : 'bg-[#0D1428] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredWalletTransactions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0D1428] border border-slate-800 text-center text-xs text-slate-400">
              No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredWalletTransactions.map((tx) => {
                const u = usersByUid[tx.userId];
                const isCredit =
                  tx.type === 'DEPOSIT' || tx.type === 'PRIZE' || tx.type === 'REFUND';
                const uContact = u
                  ? formatAdminDisplayContact(u).primary
                  : tx.userId;

                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl bg-[#0D1428] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">
                            {u?.displayName || 'Player'}
                          </span>
                          <span className="text-[11px] font-mono text-sky-300">
                            ({uContact})
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-[#111D35] text-slate-300 border border-slate-700">
                            {tx.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : tx.status === 'REJECTED'
                                ? 'bg-red-950 text-red-400 border border-red-500/30'
                                : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <p className="text-slate-300">{tx.description}</p>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(tx.createdAt).toLocaleString()}
                          {tx.referenceId ? ` • Ref: ${tx.referenceId}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right self-end sm:self-center">
                      <span
                        className={`text-base font-black font-gaming block ${
                          isCredit ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatBDT(tx.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Balance: {formatBDT(tx.balanceAfter)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* GAME HISTORY */}
      {activeTab === 'gameHistory' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Platform Game History & Match Results ({filteredGameHistory.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                View all matches, registered slots, and published winners.
              </p>
            </div>

            <div className="flex gap-1.5 text-xs font-gaming">
              {(
                [
                  { id: 'ALL', label: 'All Matches' },
                  { id: 'COMPLETED', label: 'Completed' },
                  { id: 'ACTIVE', label: 'Open / Ongoing' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGameHistoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                    gameHistoryFilter === f.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-[#0D1428] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredGameHistory.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0D1428] border border-slate-800 text-center text-xs text-slate-400">
              No matches found in game history.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGameHistory.map((tour) => {
                const result = matchResultsMap[tour.id];
                const regs = allRegistrationsMap[tour.id] || [];

                return (
                  <div
                    key={tour.id}
                    className="p-5 rounded-2xl bg-[#0D1428] border border-slate-800 space-y-4 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {tour.category && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-blue-600 text-white">
                              {tour.category}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-[#111D35] text-sky-300 border border-slate-700">
                            {tour.type} • {tour.map || 'Bermuda'}
                          </span>
                          {(() => {
                            const matchStart = parseMatchDateAndTime(tour.matchDate, tour.matchTime);
                            let effectiveRoomTourStatus: string = tour.status;
                            if (
                              tour.status !== 'COMPLETED' &&
                              tour.status !== 'CANCELLED' &&
                              matchStart
                            ) {
                              effectiveRoomTourStatus =
                                matchStart.getTime() <= Date.now()
                                  ? 'ONGOING'
                                  : tour.registeredCount >= tour.maxSlots
                                  ? 'REGISTRATION_FULL'
                                  : 'REGISTRATION_OPEN';
                            }
                            return (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-gaming ${
                                  effectiveRoomTourStatus === 'COMPLETED'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                    : effectiveRoomTourStatus === 'ONGOING'
                                    ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                    : 'bg-sky-950 text-sky-400 border border-sky-500/30'
                                }`}
                              >
                                {effectiveRoomTourStatus}
                              </span>
                            );
                          })()}
                        </div>
                        <h4 className="text-base font-black text-white">{tour.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Schedule: {tour.matchDate} at {tour.matchTime}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 text-right">
                        <div className="px-3 py-1.5 rounded-xl bg-[#111D35] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Entry Fee</span>
                          <span className="font-bold text-white">{formatBDT(tour.entryFee)}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-[#111D35] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Prize Pool</span>
                          <span className="font-bold text-emerald-400">
                            {formatBDT(tour.prizePool)}
                          </span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-[#111D35] border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Slots</span>
                          <span className="font-bold text-sky-300">
                            {regs.reduce(
                              (sum, r) => sum + getSlotWeightForRegistration(tour, r.players),
                              0
                            ) || tour.registeredCount || 0}{' '}
                            / {tour.maxSlots}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Published Standings / Winners */}
                    {result && result.standings && result.standings.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold font-gaming uppercase tracking-wider text-emerald-400 block">
                          Official Match Results & Winners
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {result.standings.map((st, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-white block">
                                  #{st.placement} {st.teamName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Kills: {st.kills} • Points: {st.totalPoints}
                                </span>
                              </div>
                              <span className="font-black font-gaming text-emerald-400">
                                {formatBDT(st.prizeWon || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : regs.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold font-gaming uppercase tracking-wider text-sky-400 block">
                          Registered Players / Slots ({regs.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {regs.map((r) => {
                            const p1 = r.players?.[0]?.inGameName || r.players?.[0]?.name || r.userName;
                            const p2Raw = r.players?.[1]?.inGameName || r.players?.[1]?.name;
                            const p2 = p2Raw && !p2Raw.includes('Partner: -') && !p2Raw.includes('Solo') ? p2Raw : null;
                            return (
                              <span
                                key={r.id}
                                className="px-2.5 py-1 rounded-lg bg-[#111D35] border border-slate-800 text-[11px] text-slate-200"
                              >
                                <b className="text-sky-400">#{r.slotNumber}</b>{' '}
                                Player 1: {p1}{p2 ? ` • Player 2: ${p2}` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        No players joined this match yet.
                      </p>
                    )}

                    <div className="flex justify-end pt-2 border-t border-slate-800/70">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTourForScoring(tour.id);
                          setActiveTab('results');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 border border-sky-500/30 text-sky-300 font-semibold text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>
                          {result?.isPrizeDistributed
                            ? 'Edit / Undo Result'
                            : 'Declare Result & Auto-Pay'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 9. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 max-w-xl space-y-4">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
            Official Payment Numbers Configuration
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-pink-400 mb-1">
                bKash Number (Send Money)
              </label>
              <input
                type="text"
                value={bkashNum}
                onChange={(e) => setBkashNum(e.target.value)}
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-orange-400 mb-1">
                Nagad Number (Send Money)
              </label>
              <input
                type="text"
                value={nagadNum}
                onChange={(e) => setNagadNum(e.target.value)}
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs font-mono"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold font-gaming text-xs rounded-xl shadow-md cursor-pointer"
            >
              Save Payment Numbers
            </button>
          </form>
        </div>
      )}

      {/* 10. SEND ANNOUNCEMENT TAB */}
      {activeTab === 'announcements' && (
        <SendAnnouncementSection
          tournaments={tournaments}
          adminEmail={userProfile?.email || userProfile?.displayName || 'Admin'}
        />
      )}

      {/* 11. MANAGE ADMINS (INSIDE DASHBOARD — MAIN ADMIN ONLY) */}
      {activeTab === 'manageAdmins' && isSuperAdmin && (
        <ManageAdminsSection onNavigate={onNavigate} showBackButton={false} />
      )}

      {/* 12. MATCH & SLOT BOX RULES MANAGER */}
      {activeTab === 'rules' && <ManageCategoryRulesSection />}

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateTourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-[#0D1428] border border-sky-500/30 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold font-gaming text-white uppercase tracking-wider">
                  CREATE NEW TOURNAMENT
                </h3>
                <p className="text-xs text-slate-400">
                  Configure tournament rules, slots, schedule and room credentials
                </p>
              </div>
              <button
                onClick={() => setShowCreateTourModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                  TOURNAMENT NAME *
                </label>
                <input
                  type="text"
                  required
                  value={newTour.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    setNewTour({
                      ...newTour,
                      title: nextTitle,
                      titleBn: generateAutoBanglaTitle(nextTitle),
                    });
                  }}
                  placeholder="e.g. LONE WOLF 1V1 HEADSHOT"
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 font-medium"
                />
                {(newTour.title || '').trim().length > 0 && (
                  <p className="mt-1.5 text-[11px] text-sky-300/90 font-bangla">
                    Auto Bangla: {generateAutoBanglaTitle(newTour.title)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-sky-400 font-bold mb-1 uppercase tracking-wide">
                    CATEGORY *
                  </label>
                  <select
                    value={newTour.category || 'BR MATCH'}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      const shouldUpdateBanner =
                        isPlaceholderBannerUrl(newTour.bannerUrl) ||
                        isBuiltInCategoryBannerUrl(newTour.bannerUrl);
                      const isLoneWolfCat =
                        nextCat === 'LONE WOLF' || nextCat === 'LONE WOLF HEADSHOT';
                      const nextMap =
                        isLoneWolfCat && (!newTour.map || newTour.map === 'Bermuda')
                          ? 'Iron Cage'
                          : !isLoneWolfCat && newTour.map === 'Iron Cage'
                          ? 'Bermuda'
                          : newTour.map || 'Bermuda';
                      const allowNextPerKill = supportsPerKillPrize(nextCat);
                      setNewTour({
                        ...newTour,
                        category: nextCat as any,
                        map: nextMap,
                        perKillPrize: allowNextPerKill
                          ? Number(newTour.perKillPrize || 0) > 0
                            ? newTour.perKillPrize
                            : 10
                          : 0,
                        ...(shouldUpdateBanner
                          ? { bannerUrl: getMatchBannerUrl(nextCat) }
                          : {}),
                      });
                    }}
                    className="w-full px-2 py-2 bg-[#111D35] border border-sky-500/50 rounded-lg text-white font-bold focus:outline-none focus:border-sky-400 text-xs"
                  >
                    <option value="FREE MATCH">SPECIAL MATCH</option>
                    <option value="BR MATCH">BR MATCH</option>
                    <option value="LONE WOLF">LONE WOLF</option>
                    <option value="CS 1V1, 2V2">CS 1V1, 2V2</option>
                    <option value="LONE WOLF HEADSHOT">LONE WOLF HEADSHOT</option>
                    <option value="LOST TO WIN">LOST TO WIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    FORMAT *
                  </label>
                  <select
                    value={newTour.type}
                    onChange={(e) => setNewTour({ ...newTour, type: e.target.value as any })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-400 text-xs"
                  >
                    <option value="SQUAD">SQUAD</option>
                    <option value="DUO">DUO</option>
                    <option value="SOLO">SOLO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    MODE *
                  </label>
                  <select
                    value={newTour.gameMode}
                    onChange={(e) => setNewTour({ ...newTour, gameMode: e.target.value as GameMode })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-400 text-xs"
                  >
                    <option value="BATTLE_ROYALE">Battle Royale</option>
                    <option value="CLASH_SQUAD">Clash Squad</option>
                    <option value="LONE_WOLF">Lone Wolf</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    MAP *
                  </label>
                  <select
                    value={newTour.map || 'Bermuda'}
                    onChange={(e) => setNewTour({ ...newTour, map: e.target.value })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-400 text-xs"
                  >
                    <option value="Bermuda">Bermuda (Default)</option>
                    <option value="Iron Cage">Iron Cage</option>
                    <option value="Purgatory">Purgatory</option>
                    <option value="Kalahari">Kalahari</option>
                    <option value="Alpine">Alpine</option>
                    <option value="Nextra">Nextra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    ENTRY FEE (৳ BDT) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newTour.entryFee ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTour({
                        ...newTour,
                        entryFee: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    TOTAL PRIZEPOOL (৳ BDT) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newTour.prizePool ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTour({
                        ...newTour,
                        prizePool: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              {/* Conditional Winning Prize Breakdown: 1st-5th for BR MATCH (4th-5th 0+) & FREE MATCH (0+) */}
              {isPlacementPrizeCategory(newTour.category) && (() => {
                const isFreeMatchCreate = normalizeCategory(newTour.category) === 'FREE MATCH';
                return (
                  <div className="p-3.5 rounded-xl bg-[#111D35] border border-amber-500/30 space-y-2.5">
                    <span className="text-[11px] font-bold text-amber-300 block uppercase tracking-wider">
                      WINNING PRIZE BREAKDOWN (৳)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      <div>
                        <label
                          htmlFor="create-first-winning-prize"
                          className="block text-[11px] text-amber-400 font-bold mb-1"
                        >
                          1st Winning Prize (৳) *
                        </label>
                        <input
                          id="create-first-winning-prize"
                          type="number"
                          min={isFreeMatchCreate ? '0' : '1'}
                          step="any"
                          required={!isFreeMatchCreate}
                          value={newTour.firstPrize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTour({
                              ...newTour,
                              firstPrize: val === '' ? ('' as unknown as number) : Number(val),
                            });
                          }}
                          placeholder={isFreeMatchCreate ? '0 or more' : 'Enter amount (1+)'}
                          className="w-full px-2.5 py-2 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-second-winning-prize"
                          className="block text-[11px] text-sky-400 font-bold mb-1"
                        >
                          2nd Winning Prize (৳) *
                        </label>
                        <input
                          id="create-second-winning-prize"
                          type="number"
                          min={isFreeMatchCreate ? '0' : '1'}
                          step="any"
                          required={!isFreeMatchCreate}
                          value={newTour.secondPrize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTour({
                              ...newTour,
                              secondPrize: val === '' ? ('' as unknown as number) : Number(val),
                            });
                          }}
                          placeholder={isFreeMatchCreate ? '0 or more' : 'Enter amount (1+)'}
                          className="w-full px-2.5 py-2 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-third-winning-prize"
                          className="block text-[11px] text-orange-400 font-bold mb-1"
                        >
                          3rd Winning Prize (৳) *
                        </label>
                        <input
                          id="create-third-winning-prize"
                          type="number"
                          min={isFreeMatchCreate ? '0' : '1'}
                          step="any"
                          required={!isFreeMatchCreate}
                          value={newTour.thirdPrize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTour({
                              ...newTour,
                              thirdPrize: val === '' ? ('' as unknown as number) : Number(val),
                            });
                          }}
                          placeholder={isFreeMatchCreate ? '0 or more' : 'Enter amount (1+)'}
                          className="w-full px-2.5 py-2 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-orange-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-fourth-winning-prize"
                          className="block text-[11px] text-emerald-400 font-bold mb-1"
                        >
                          4th Winning Prize (৳) *
                        </label>
                        <input
                          id="create-fourth-winning-prize"
                          type="number"
                          min="0"
                          step="any"
                          value={newTour.fourthPrize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTour({
                              ...newTour,
                              fourthPrize: val === '' ? ('' as unknown as number) : Number(val),
                            });
                          }}
                          placeholder="Enter amount (0 or more)"
                          className="w-full px-2.5 py-2 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="create-fifth-winning-prize"
                          className="block text-[11px] text-violet-400 font-bold mb-1"
                        >
                          5th Winning Prize (৳) *
                        </label>
                        <input
                          id="create-fifth-winning-prize"
                          type="number"
                          min="0"
                          step="any"
                          value={newTour.fifthPrize ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTour({
                              ...newTour,
                              fifthPrize: val === '' ? ('' as unknown as number) : Number(val),
                            });
                          }}
                          placeholder="Enter amount (0 or more)"
                          className="w-full px-2.5 py-2 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-violet-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div
                className={`grid ${
                  supportsPerKillPrize(newTour.category) ? 'grid-cols-2' : 'grid-cols-1'
                } gap-2.5`}
              >
                {supportsPerKillPrize(newTour.category) && (
                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1 uppercase tracking-wide">
                      PER KILL (৳ BDT) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={newTour.perKillPrize ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewTour({
                          ...newTour,
                          perKillPrize: val === '' ? ('' as unknown as number) : Number(val),
                        });
                      }}
                      className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    TOTAL SLOTS (Max) *
                  </label>
                  <input
                    type="number"
                    min="2"
                    required
                    value={newTour.maxSlots ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTour({
                        ...newTour,
                        maxSlots: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    MATCH DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTour.matchDate}
                    onChange={(e) => setNewTour({ ...newTour, matchDate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                    MATCH TIME *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTour.matchTime}
                    onChange={(e) => setNewTour({ ...newTour, matchTime: e.target.value })}
                    placeholder="e.g. 08:30 PM"
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Room ID and Password Section */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/60 to-sky-950/40 border border-sky-500/30 space-y-2.5">
                <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase tracking-wider text-[11px]">
                  <KeyRound className="w-4 h-4" />
                  <span>ROOM ID & PASSWORD (Optional)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 uppercase font-semibold">
                      ROOM ID
                    </label>
                    <input
                      type="text"
                      value={newTourRoom.roomId}
                      onChange={(e) => setNewTourRoom({ ...newTourRoom, roomId: e.target.value })}
                      placeholder="e.g. 6829104"
                      className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 uppercase font-semibold">
                      ROOM PASSWORD
                    </label>
                    <input
                      type="text"
                      value={newTourRoom.roomPassword}
                      onChange={(e) => setNewTourRoom({ ...newTourRoom, roomPassword: e.target.value })}
                      placeholder="e.g. 1234"
                      className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="newTourPublish"
                    checked={newTourRoom.isPublished}
                    onChange={(e) => setNewTourRoom({ ...newTourRoom, isPublished: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                  <label htmlFor="newTourPublish" className="text-slate-300 text-[11px] cursor-pointer">
                    Publish Room ID & Password immediately to registered players
                  </label>
                </div>
              </div>

              {/* Show / Hide Participants Toggle (Default: ON) */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 to-[#111D35] border border-sky-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold font-gaming text-sky-400 block uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    SHOW PARTICIPANTS
                  </span>
                  <p className="text-[11px] text-slate-400">
                    ON = Players see participants list &amp; slot numbers. OFF = Names hidden with &quot;Participants Hidden&quot; box.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNewTour({
                      ...newTour,
                      showParticipants: newTour.showParticipants === false ? true : false,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl font-black font-gaming text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    newTour.showParticipants !== false
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                      : 'bg-red-950 text-red-400 border border-red-500/50'
                  }`}
                >
                  {newTour.showParticipants !== false ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>ON (SHOW)</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>OFF (HIDDEN)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#111D35] border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sky-400 font-bold uppercase tracking-wide">
                    AUTO BANNER PHOTO (Match Type অনুযায়ী)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTour({
                        ...newTour,
                        bannerUrl: getMatchBannerUrl(newTour.category || 'BR MATCH'),
                      })
                    }
                    className="text-[10px] font-bold text-sky-300 hover:text-white underline cursor-pointer"
                  >
                    Reset to Match Type Banner
                  </button>
                </div>
                <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <img
                    src={
                      !isPlaceholderBannerUrl(newTour.bannerUrl) &&
                      !isBuiltInCategoryBannerUrl(newTour.bannerUrl)
                        ? newTour.bannerUrl
                        : getMatchBannerUrl(newTour.category || 'BR MATCH')
                    }
                    alt="Match Banner Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <input
                  type="text"
                  value={newTour.bannerUrl || ''}
                  onChange={(e) => setNewTour({ ...newTour, bannerUrl: e.target.value })}
                  placeholder="/assets/match-banners/br_match.jpg"
                  className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded-lg text-white text-[11px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTourModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold cursor-pointer transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTour}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming uppercase tracking-wider shadow-lg shadow-sky-500/25 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTour ? 'CREATED!' : 'CREATE TOURNAMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TOURNAMENT MODAL */}
      {showEditTourModal && editingTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-[#0D1428] border border-blue-500/40 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold font-gaming text-white">
                  টুর্নামেন্ট সম্পাদনা / এডিট (Edit Tournament)
                </h3>
                <p className="text-xs text-sky-400">ID: {editingTour.id}</p>
              </div>
              <button
                onClick={() => setShowEditTourModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTournament} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 uppercase tracking-wide">
                  TOURNAMENT NAME *
                </label>
                <input
                  type="text"
                  required
                  value={editingTour.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    setEditingTour({
                      ...editingTour,
                      title: nextTitle,
                      titleBn: generateAutoBanglaTitle(nextTitle),
                    });
                  }}
                  placeholder="e.g. LONE WOLF 1V1 HEADSHOT"
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-400 font-medium"
                />
                {(editingTour.title || '').trim().length > 0 && (
                  <p className="mt-1.5 text-[11px] text-sky-300/90 font-bangla">
                    Auto Bangla: {generateAutoBanglaTitle(editingTour.title)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-sky-400 font-bold mb-1 uppercase tracking-wide">
                    CATEGORY *
                  </label>
                  <select
                    value={
                      editingTour.category === 'LOSS TO WIN'
                        ? 'LOST TO WIN'
                        : editingTour.category || 'BR MATCH'
                    }
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      const shouldUpdateBanner =
                        isPlaceholderBannerUrl(editingTour.bannerUrl) ||
                        isBuiltInCategoryBannerUrl(editingTour.bannerUrl);
                      const isLoneWolfCat =
                        nextCat === 'LONE WOLF' || nextCat === 'LONE WOLF HEADSHOT';
                      const nextMap =
                        isLoneWolfCat && (!editingTour.map || editingTour.map === 'Bermuda')
                          ? 'Iron Cage'
                          : !isLoneWolfCat && editingTour.map === 'Iron Cage'
                          ? 'Bermuda'
                          : editingTour.map || 'Bermuda';
                      const allowNextPerKill = supportsPerKillPrize(nextCat);
                      setEditingTour({
                        ...editingTour,
                        category: nextCat,
                        map: nextMap,
                        perKillPrize: allowNextPerKill
                          ? Number(editingTour.perKillPrize || 0) > 0
                            ? editingTour.perKillPrize
                            : 10
                          : 0,
                        ...(shouldUpdateBanner
                          ? { bannerUrl: getMatchBannerUrl(nextCat) }
                          : {}),
                      });
                    }}
                    className="w-full px-2 py-2 bg-[#111D35] border border-sky-500/50 rounded-lg text-white font-bold focus:outline-none focus:border-sky-400 text-xs"
                  >
                    <option value="FREE MATCH">SPECIAL MATCH</option>
                    <option value="BR MATCH">BR MATCH</option>
                    <option value="LONE WOLF">LONE WOLF</option>
                    <option value="CS 1V1, 2V2">CS 1V1, 2V2</option>
                    <option value="LONE WOLF HEADSHOT">LONE WOLF HEADSHOT</option>
                    <option value="LOST TO WIN">LOST TO WIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ফরম্যাট</label>
                  <select
                    value={editingTour.type}
                    onChange={(e) => setEditingTour({ ...editingTour, type: e.target.value as any })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs"
                  >
                    <option value="SQUAD">SQUAD</option>
                    <option value="DUO">DUO</option>
                    <option value="SOLO">SOLO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">মোড (MODE) *</label>
                  <select
                    value={editingTour.gameMode}
                    onChange={(e) => setEditingTour({ ...editingTour, gameMode: e.target.value as GameMode })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs"
                  >
                    <option value="BATTLE_ROYALE">Battle Royale</option>
                    <option value="CLASH_SQUAD">Clash Squad</option>
                    <option value="LONE_WOLF">Lone Wolf</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sky-400 font-bold mb-1">ম্যাপ (Map) *</label>
                  <select
                    value={editingTour.map || 'Bermuda'}
                    onChange={(e) => setEditingTour({ ...editingTour, map: e.target.value })}
                    className="w-full px-2 py-2 bg-[#111D35] border border-sky-500/50 rounded-lg text-white font-bold text-xs"
                  >
                    <option value="Bermuda">Bermuda (বারমুডা)</option>
                    <option value="Iron Cage">Iron Cage (আইরন কেজ)</option>
                    <option value="Purgatory">Purgatory (পার্গেটোরি)</option>
                    <option value="Kalahari">Kalahari (কালাহারি)</option>
                    <option value="Alpine">Alpine (আলপাইন)</option>
                    <option value="Nextra">Nextra (নেক্সট্রা)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">এন্ট্রি ফি (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editingTour.entryFee ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTour({
                        ...editingTour,
                        entryFee: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">মোট প্রাইজপুল (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editingTour.prizePool ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTour({
                        ...editingTour,
                        prizePool: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              {isPlacementPrizeCategory(editingTour.category) && (() => {
                const isFreeMatchEdit = normalizeCategory(editingTour.category) === 'FREE MATCH';
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 rounded-xl bg-[#111D35] border border-amber-500/30">
                    <div>
                      <label
                        htmlFor="edit-first-winning-prize"
                        className="block text-[11px] text-amber-400 font-bold mb-1"
                      >
                        1st Winning Prize (৳) *
                      </label>
                      <input
                        id="edit-first-winning-prize"
                        type="number"
                        min={isFreeMatchEdit ? '0' : '1'}
                        step="any"
                        required={!isFreeMatchEdit}
                        value={isFreeMatchEdit ? (editingTour.firstPrize ?? '') : (editingTour.firstPrize || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTour({
                            ...editingTour,
                            firstPrize: val === '' ? ('' as unknown as number) : Number(val),
                          });
                        }}
                        placeholder={isFreeMatchEdit ? '0 or more' : 'Enter amount (1+)'}
                        className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-second-winning-prize"
                        className="block text-[11px] text-sky-400 font-bold mb-1"
                      >
                        2nd Winning Prize (৳) *
                      </label>
                      <input
                        id="edit-second-winning-prize"
                        type="number"
                        min={isFreeMatchEdit ? '0' : '1'}
                        step="any"
                        required={!isFreeMatchEdit}
                        value={isFreeMatchEdit ? (editingTour.secondPrize ?? '') : (editingTour.secondPrize || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTour({
                            ...editingTour,
                            secondPrize: val === '' ? ('' as unknown as number) : Number(val),
                          });
                        }}
                        placeholder={isFreeMatchEdit ? '0 or more' : 'Enter amount (1+)'}
                        className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded text-white text-xs font-mono font-bold focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-third-winning-prize"
                        className="block text-[11px] text-orange-400 font-bold mb-1"
                      >
                        3rd Winning Prize (৳) *
                      </label>
                      <input
                        id="edit-third-winning-prize"
                        type="number"
                        min={isFreeMatchEdit ? '0' : '1'}
                        step="any"
                        required={!isFreeMatchEdit}
                        value={isFreeMatchEdit ? (editingTour.thirdPrize ?? '') : (editingTour.thirdPrize || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTour({
                            ...editingTour,
                            thirdPrize: val === '' ? ('' as unknown as number) : Number(val),
                          });
                        }}
                        placeholder={isFreeMatchEdit ? '0 or more' : 'Enter amount (1+)'}
                        className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded text-white text-xs font-mono font-bold focus:outline-none focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-fourth-winning-prize"
                        className="block text-[11px] text-emerald-400 font-bold mb-1"
                      >
                        4th Winning Prize (৳) *
                      </label>
                      <input
                        id="edit-fourth-winning-prize"
                        type="number"
                        min="0"
                        step="any"
                        value={editingTour.fourthPrize ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTour({
                            ...editingTour,
                            fourthPrize: val === '' ? ('' as unknown as number) : Number(val),
                          });
                        }}
                        placeholder="Enter amount (0 or more)"
                        className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-fifth-winning-prize"
                        className="block text-[11px] text-violet-400 font-bold mb-1"
                      >
                        5th Winning Prize (৳) *
                      </label>
                      <input
                        id="edit-fifth-winning-prize"
                        type="number"
                        min="0"
                        step="any"
                        value={editingTour.fifthPrize ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTour({
                            ...editingTour,
                            fifthPrize: val === '' ? ('' as unknown as number) : Number(val),
                          });
                        }}
                        placeholder="Enter amount (0 or more)"
                        className="w-full px-2.5 py-1.5 bg-[#0D1428] border border-slate-700 rounded text-white text-xs font-mono font-bold focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                );
              })()}

              <div
                className={`grid ${
                  supportsPerKillPrize(editingTour.category) ? 'grid-cols-2' : 'grid-cols-1'
                } gap-2.5`}
              >
                {supportsPerKillPrize(editingTour.category) && (
                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1">প্রতি কিল (৳) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={editingTour.perKillPrize ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingTour({
                          ...editingTour,
                          perKillPrize: val === '' ? ('' as unknown as number) : Number(val),
                        });
                      }}
                      className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">টোটাল স্লট *</label>
                  <input
                    type="number"
                    min="2"
                    required
                    value={editingTour.maxSlots ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTour({
                        ...editingTour,
                        maxSlots: val === '' ? ('' as unknown as number) : Number(val),
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ম্যাচ তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={editingTour.matchDate}
                    onChange={(e) => setEditingTour({ ...editingTour, matchDate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ম্যাচ সময় *</label>
                  <input
                    type="text"
                    required
                    value={editingTour.matchTime}
                    onChange={(e) => setEditingTour({ ...editingTour, matchTime: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-amber-400 font-semibold mb-1">স্ট্যাটাস (Status)</label>
                  <select
                    value={editingTour.status}
                    onChange={(e) => setEditingTour({ ...editingTour, status: e.target.value as any })}
                    className="w-full px-2.5 py-2 bg-[#111D35] border border-amber-500/40 rounded-lg text-white font-bold"
                  >
                    <option value="REGISTRATION_OPEN">REGISTRATION_OPEN</option>
                    <option value="REGISTRATION_FULL">REGISTRATION_FULL</option>
                    <option value="ONGOING">ONGOING</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Room ID and Password */}
              {editingTourRoom && (
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/60 to-sky-950/40 border border-sky-500/30 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <KeyRound className="w-4 h-4" />
                    <span>রুম আইডি ও পাসওয়ার্ড (Room Credentials)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">রুম ID</label>
                      <input
                        type="text"
                        value={editingTourRoom.roomId}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          const hadNoRoomBefore = !editingTourRoom.roomId.trim();
                          setEditingTourRoom({
                            ...editingTourRoom,
                            roomId: nextVal,
                            isPublished:
                              hadNoRoomBefore && nextVal.trim().length > 0
                                ? true
                                : editingTourRoom.isPublished,
                          });
                        }}
                        className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">রুম পাসওয়ার্ড</label>
                      <input
                        type="text"
                        value={editingTourRoom.roomPassword}
                        onChange={(e) => setEditingTourRoom({ ...editingTourRoom, roomPassword: e.target.value })}
                        className="w-full px-2.5 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editTourPublish"
                      checked={editingTourRoom.isPublished}
                      onChange={(e) => setEditingTourRoom({ ...editingTourRoom, isPublished: e.target.checked })}
                      className="w-4 h-4 accent-sky-500 cursor-pointer"
                    />
                    <label htmlFor="editTourPublish" className="text-slate-300 text-[11px] cursor-pointer">
                      প্লেয়ারদের জন্য রুম আইডি পাবলিশ ও নোটিফিকেশন পাঠান (Publish &amp; Notify Joined Players)
                    </label>
                  </div>
                </div>
              )}

              {/* Show / Hide Participants Toggle */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 to-[#111D35] border border-sky-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold font-gaming text-sky-400 block uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    SHOW PARTICIPANTS
                  </span>
                  <p className="text-[11px] text-slate-400">
                    ON = Players see participant slots &amp; names. OFF = Names hidden with &quot;Participants Hidden&quot; box.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingTour({
                      ...editingTour,
                      showParticipants: editingTour.showParticipants === false ? true : false,
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl font-black font-gaming text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    editingTour.showParticipants !== false
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                      : 'bg-red-950 text-red-400 border border-red-500/50'
                  }`}
                >
                  {editingTour.showParticipants !== false ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>ON (SHOW)</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>OFF (HIDDEN)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditTourModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming shadow-lg shadow-sky-500/25 cursor-pointer"
                >
                  আপডেট সংরক্ষণ করুন (Save Changes)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ROOM ID & PASSWORD MODAL */}
      {showQuickRoomModal && quickRoomTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0D1428] border border-sky-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-gaming text-white">রুম আইডি ও পাসওয়ার্ড</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                    {quickRoomTour.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickRoomModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickRoom} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  কাস্টম রুম ID (Custom Room ID) *
                </label>
                <input
                  type="text"
                  required
                  value={quickRoomData.roomId}
                  onChange={(e) => setQuickRoomData({ ...quickRoomData, roomId: e.target.value })}
                  placeholder="e.g. 5839201"
                  className="w-full px-3 py-2.5 bg-[#111D35] border border-slate-700 focus:border-sky-400 rounded-xl text-white font-mono font-black text-sm tracking-widest placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  রুম পাসওয়ার্ড (Room Password) *
                </label>
                <input
                  type="text"
                  required
                  value={quickRoomData.roomPassword}
                  onChange={(e) => setQuickRoomData({ ...quickRoomData, roomPassword: e.target.value })}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2.5 bg-[#111D35] border border-slate-700 focus:border-sky-400 rounded-xl text-white font-mono font-black text-sm tracking-widest placeholder-slate-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="quickPublishToggle"
                    checked={quickRoomData.isPublished}
                    onChange={(e) => setQuickRoomData({ ...quickRoomData, isPublished: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                  <label htmlFor="quickPublishToggle" className="text-white font-bold text-xs cursor-pointer">
                    প্লেয়ারদের জন্য লাইভ পাবলিশ ও নোটিফিকেশন পাঠান (Publish &amp; Notify)
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  এই ম্যাচে স্লট বুক করা <span className="text-sky-300 font-bold">{quickRoomTour.registeredCount || 0}</span> জন প্লেয়ারের কাছে সাথে সাথে &quot;Room Code Chole Asche&quot; নোটিফিকেশন যাবে। যারা স্লট কিনেনি তারা দেখতে পাবে না।
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickRoomModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming shadow-lg shadow-sky-500/25 cursor-pointer"
                >
                  {quickRoomData.isPublished
                    ? 'পাবলিশ ও নোটিফিকেশন পাঠান'
                    : 'ড্রাফট সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Popup Modal for Delete Tournament */}
      <DeleteTournamentModal
        isOpen={!!tournamentToDelete}
        tournamentTitle={tournamentToDelete?.title}
        onConfirm={handleConfirmDeleteTournament}
        onCancel={() => setTournamentToDelete(null)}
        isDeleting={isDeletingTour}
      />

      {/* Confirmation Popup Modal for Manual Reset Weekly Leaderboard */}
      {showResetWeeklyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0D1428] border border-amber-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-gaming text-white">
                  Reset Weekly Leaderboard?
                </h3>
                <p className="text-[11px] text-slate-400">
                  সব প্লেয়ারের এই সপ্তাহের Win, Kill ও Earning 0 হয়ে যাবে।
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200 leading-relaxed">
              সপ্তাহের Rank #1 এর{' '}
              <span className="font-bold text-amber-300">TOP PLAYER OF THE WEEK</span>{' '}
              ব্যাজ ও সাপ্তাহিক স্কোর রিসেট হবে। অল-টাইম লিডারবোর্ড ও প্লেয়ারদের ওয়ালেট ব্যালেন্স অপরিবর্তিত থাকবে।
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetWeeklyModal(false)}
                disabled={isResettingWeekly}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmResetWeeklyLeaderboard}
                disabled={isResettingWeekly}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold font-gaming text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResettingWeekly ? 'animate-spin' : ''}`} />
                <span>{isResettingWeekly ? 'Resetting...' : 'হ্যাঁ, Reset করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Match Slots Modal (All Matches) */}
      <EditMatchSlotsModal
        isOpen={!!slotEditTour}
        tournament={slotEditTour}
        onClose={() => setSlotEditTour(null)}
        onSuccess={(updated, message) => {
          setTournaments((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          setToastMessage(message);
        }}
      />

      {/* Edit Match Time Modal (All Matches) */}
      <EditMatchTimeModal
        isOpen={!!timeEditTour}
        tournament={timeEditTour}
        onClose={() => setTimeEditTour(null)}
        onSuccess={(updated, message) => {
          setTournaments((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          setToastMessage(message);
        }}
      />

      {/* Toast Notification */}
      <ToastNotification
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
