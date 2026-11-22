import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  Tournament,
  TournamentRegistration,
  RoomCredential,
  PlayerSlotInfo,
  WalletTransaction,
} from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';
import { syncLeaderboardEntry } from './matchResultService';
import { getWalletBreakdown } from './walletService';
import { createUserNotification } from './notificationService';
import { sendServerRoomPushNotification } from './pushNotificationService';
import { BOOTSTRAP_ADMIN_EMAIL, getActiveAdminSession } from './adminService';
import { getSavedPlayerSession } from './playerAuthService';
import { getActiveBiometricSession } from './biometricAuthService';
import { isUserCurrentlyBanned, getBanErrorMessage } from './banService';
import {
  countsPlayersPerSlotForCategory,
  format24HourToDisplayTime,
  getDhakaDateTimeParts,
  getDhakaTodayDateStr,
  getMaxSlotLimitForCategory,
  getSlotWeightForRegistration,
  getTournamentCategory,
  isSlotEditableCategory,
  parseMatchDateAndTime,
  supportsPerKillPrize,
} from '../constants/categoryRules';
import {
  confirmOptimisticJoin,
  emitOptimisticJoinError,
  rollbackOptimisticJoin,
  startOptimisticJoin,
} from './optimisticJoinStore';
import {
  confirmOptimisticTournament,
  emitOptimisticTournamentError,
  getOptimisticTournaments,
  isTournamentDeleted,
  isTournamentDeleteLocked,
  lockTournamentDelete,
  mergeOptimisticTournaments,
  removeOptimisticTournament,
  rollbackDeleteOptimisticTournament,
  rollbackOptimisticTournament,
  startOptimisticTournament,
  unlockTournamentDelete,
} from './optimisticTournamentStore';

export async function fetchTournaments(): Promise<Tournament[]> {
  try {
    let snap;
    try {
      snap = await getDocsFromServer(collection(db, 'tournaments'));
    } catch {
      snap = await getDocs(collection(db, 'tournaments'));
    }
    const list: Tournament[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as Tournament), id: d.id });
    });
    // Sort by createdAt desc and merge any optimistic creations not yet reflected on server
    const merged = mergeOptimisticTournaments(list);
    // Non-blocking background sync if any active team match had legacy +1 count per registration
    void reconcileStaleTeamTournamentCounts(merged).catch(() => {});
    return merged;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'tournaments');
  }
}

const reconciledTournamentIds = new Set<string>();

export async function reconcileSingleTournamentCount(tournamentId: string): Promise<void> {
  if (!tournamentId) return;
  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    const [tourSnap, regSnap] = await Promise.all([
      getDocFromServer(tourRef).catch(() => getDoc(tourRef)),
      getDocsFromServer(
        query(collection(db, 'registrations'), where('tournamentId', '==', tournamentId))
      ).catch(() =>
        getDocs(query(collection(db, 'registrations'), where('tournamentId', '==', tournamentId)))
      ),
    ]);
    if (!tourSnap.exists()) return;
    const tourData = { ...(tourSnap.data() as Tournament), id: tourSnap.id };
    if (!countsPlayersPerSlotForCategory(tourData)) return;
    const statusUpper = String(tourData.status || 'REGISTRATION_OPEN').toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') return;

    let actualPlayerCount = 0;
    regSnap.forEach((d) => {
      const reg = d.data() as TournamentRegistration;
      if (reg.status === 'CANCELLED' || reg.status === 'REJECTED') return;
      actualPlayerCount += getSlotWeightForRegistration(tourData, reg.players);
    });

    const maxSlots = Math.max(1, Number(tourData.maxSlots) || 1);
    const clampedCount = Math.min(maxSlots, Math.max(0, actualPlayerCount));
    const currentStoredCount = Math.max(0, Number(tourData.registeredCount) || 0);

    if (clampedCount !== currentStoredCount) {
      let nextStatus = tourData.status || 'REGISTRATION_OPEN';
      if (statusUpper !== 'ONGOING') {
        nextStatus = clampedCount >= maxSlots ? 'REGISTRATION_FULL' : 'REGISTRATION_OPEN';
      }
      await updateDoc(tourRef, {
        registeredCount: clampedCount,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Non-fatal background reconciliation
  }
}

async function reconcileStaleTeamTournamentCounts(tournaments: Tournament[]): Promise<void> {
  const candidates = tournaments.filter((t) => {
    if (!t.id || reconciledTournamentIds.has(t.id)) return false;
    const statusUpper = String(t.status || 'REGISTRATION_OPEN').toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') return false;
    if ((Number(t.registeredCount) || 0) <= 0) return false;
    if (t.type === 'SOLO') return false;
    return countsPlayersPerSlotForCategory(t);
  });
  if (candidates.length === 0) return;
  candidates.forEach((t) => reconciledTournamentIds.add(t.id));
  await Promise.all(candidates.map((t) => reconcileSingleTournamentCount(t.id)));
}

export async function fetchTournamentById(id: string): Promise<Tournament | null> {
  if (isTournamentDeleted(id)) {
    return null;
  }
  try {
    const ref = doc(db, 'tournaments', id);
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (snap.exists()) {
      return { ...(snap.data() as Tournament), id: snap.id };
    }
    const optimistic = getOptimisticTournaments().find((e) => e.id === id);
    return optimistic ? optimistic.tournament : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `tournaments/${id}`);
  }
}

export async function joinTournament(
  tournament: Tournament,
  userId: string,
  userName: string,
  players: PlayerSlotInfo[],
  teamName?: string,
  teamId?: string
): Promise<{ success: boolean; message: string; registrationId?: string; slotNumber?: number }> {
  const regId = `${userId}_${tournament.id}`;
  const regDocRef = doc(db, 'registrations', regId);
  const userDocRef = doc(db, 'users', userId);
  const tournamentDocRef = doc(db, 'tournaments', tournament.id);

  try {
    return await runTransaction(db, async (txn) => {
      // 1. Check existing registration
      const regSnap = await txn.get(regDocRef);
      if (regSnap.exists()) {
        throw new Error('আপনি ইতিমধ্যে এই টুর্নামেন্টে রেজিস্টার করেছেন! (Already registered)');
      }

      // 2. Fetch latest tournament doc
      const tourSnap = await txn.get(tournamentDocRef);
      if (!tourSnap.exists()) {
        throw new Error('টুর্নামেন্টটি খুঁজে পাওয়া যায়নি!');
      }
      const currentTour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };

      if (currentTour.status === 'COMPLETED' || currentTour.status === 'CANCELLED') {
        throw new Error('এই টুর্নামেন্টটি বন্ধ হয়ে গেছে!');
      }

      const slotWeight = getSlotWeightForRegistration(currentTour, players);
      const currentRegistered = Math.max(0, Number(currentTour.registeredCount) || 0);
      const remainingSlots = Math.max(0, currentTour.maxSlots - currentRegistered);

      if (remainingSlots <= 0) {
        throw new Error('দুঃখিত, টুর্নামেন্টের সমস্ত স্লট বুক হয়ে গেছে! (Slots Full)');
      }

      if (currentRegistered + slotWeight > currentTour.maxSlots) {
        throw new Error(
          `দুঃখিত! এই ম্যাচে মাত্র ${remainingSlots} টি স্লট খালি আছে, তাই ${slotWeight} জনের নাম দিয়ে জয়েন করা যাবে না!`
        );
      }

      // 3. Check user ban status & wallet balance
      const userSnap = await txn.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি!');
      }
      const userProfile = userSnap.data();
      if (isUserCurrentlyBanned(userProfile)) {
        throw new Error(getBanErrorMessage(userProfile));
      }
      const breakdown = getWalletBreakdown(userProfile);
      const currentBalance = breakdown.availableBalance;

      if (currentTour.entryFee > 0 && currentBalance < currentTour.entryFee) {
        throw new Error(
          `পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই! প্রয়োজন ৳${currentTour.entryFee}, আপনার ব্যালেন্স ৳${currentBalance}। দয়া করে ওয়ালেটে টাকা ডিপোজিট করুন।`
        );
      }

      // 4. Deduct fee from Deposited first, then Winning, and sync walletBalance
      const feeToDeduct = Math.max(0, Number(currentTour.entryFee || 0));
      const deductFromDeposited = Math.min(breakdown.depositedAmount, feeToDeduct);
      const deductFromWinning = Math.min(
        breakdown.winningAmount,
        feeToDeduct - deductFromDeposited
      );
      const newBalance = currentBalance - feeToDeduct;
      const nextSpentFromDeposited =
        Number(userProfile.spentFromDeposited || 0) + deductFromDeposited;
      const nextSpentFromWinning =
        Number(userProfile.spentFromWinning || 0) + deductFromWinning;
      const nextTournamentsCount = Number(userProfile.totalTournaments || 0) + 1;
      const nextMatchesCount = Math.max(Number(userProfile.totalMatches || 0), nextTournamentsCount);
      txn.update(userDocRef, {
        walletBalance: newBalance,
        spentFromDeposited: nextSpentFromDeposited,
        spentFromWinning: nextSpentFromWinning,
        totalTournaments: nextTournamentsCount,
        totalMatches: nextMatchesCount,
        updatedAt: new Date().toISOString(),
      });

      // 5. Update tournament registered count by real player count (1 for Lost To Win / Special Match)
      const slotNumber = currentRegistered + 1;
      const newRegisteredCount = currentRegistered + slotWeight;
      const newStatus =
        newRegisteredCount >= currentTour.maxSlots
          ? 'REGISTRATION_FULL'
          : currentTour.status;

      txn.update(tournamentDocRef, {
        registeredCount: newRegisteredCount,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // 6. Create registration record
      const playerUids = players.map((p) => p.uid || '').filter(Boolean);
      if (!playerUids.includes(userId)) playerUids.push(userId);

      const registrationData: TournamentRegistration = {
        id: regId,
        tournamentId: tournament.id,
        tournamentTitle: currentTour.title || tournament.title,
        matchDate: currentTour.matchDate || tournament.matchDate,
        matchTime: currentTour.matchTime || tournament.matchTime,
        userId,
        userName,
        teamId: teamId || '',
        teamName: teamName || (tournament.type === 'SOLO' ? players[0]?.inGameName : 'Squad ' + slotNumber),
        type: tournament.type,
        status: 'CONFIRMED',
        slotNumber,
        playerUids,
        players,
        entryFeePaid: currentTour.entryFee ?? tournament.entryFee,
        createdAt: new Date().toISOString(),
      };
      txn.set(regDocRef, registrationData);

      // 7. Create wallet transaction record if fee > 0
      if (feeToDeduct > 0) {
        const trxId = 'trx_fee_' + Math.random().toString(36).substring(2, 9);
        const trxDocRef = doc(db, 'transactions', trxId);
        const trxData: WalletTransaction = {
          id: trxId,
          userId,
          type: 'ENTRY_FEE',
          amount: feeToDeduct,
          status: 'COMPLETED',
          referenceId: tournament.id,
          description: `Entry fee for ${tournament.title} (Slot #${slotNumber})`,
          descriptionBn: `${tournament.titleBn || tournament.title}-এ যোগদানের এন্ট্রি ফি (স্লট #${slotNumber})`,
          balanceAfter: newBalance,
          createdAt: new Date().toISOString(),
        };
        txn.set(trxDocRef, trxData);
      }

      return {
        success: true,
        message: 'টুর্নামেন্টে সফলভাবে স্লট বুক করা হয়েছে!',
        registrationId: regId,
        slotNumber,
        nextMatchesCount,
        userProfile,
      };
    }).then((res) => {
      if (res.success && res.userProfile) {
        void syncLeaderboardEntry({
          ...(res.userProfile as any),
          uid: userId,
          totalTournaments: res.nextMatchesCount,
          totalMatches: res.nextMatchesCount,
        }).catch(() => {});
      }
      return {
        success: res.success,
        message: res.message,
        registrationId: res.registrationId,
        slotNumber: res.slotNumber,
      };
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, `registrations/${regId}`);
    }
    if (err instanceof Error) {
      return { success: false, message: err.message };
    }
    return { success: false, message: 'রেজিস্ট্রেশন করতে সমস্যা হয়েছে।' };
  }
}

export function joinTournamentInstant(params: {
  tournament: Tournament;
  userId: string;
  userName: string;
  players: PlayerSlotInfo[];
  teamName?: string;
  teamId?: string;
  onBackgroundConfirmed?: (slotNumber?: number) => void;
  onBackgroundFailed?: (message: string) => void;
}): { started: boolean; registration: TournamentRegistration; message: string } {
  const {
    tournament,
    userId,
    userName,
    players,
    teamName,
    teamId,
    onBackgroundConfirmed,
    onBackgroundFailed,
  } = params;

  const regId = `${userId}_${tournament.id}`;
  const slotWeight = getSlotWeightForRegistration(tournament, players);
  const predictedSlot = Math.min(
    Math.max(1, Number(tournament.maxSlots) || 1),
    Math.max(0, Number(tournament.registeredCount) || 0) + 1
  );
  const predictedEndSlot = Math.min(
    Math.max(1, Number(tournament.maxSlots) || 1),
    Math.max(0, Number(tournament.registeredCount) || 0) + slotWeight
  );
  const playerUids = Array.from(
    new Set([userId, ...players.map((p) => p.uid || '').filter(Boolean)])
  );

  const optimisticRegistration: TournamentRegistration = {
    id: regId,
    tournamentId: tournament.id,
    tournamentTitle: tournament.title,
    matchDate: tournament.matchDate,
    matchTime: tournament.matchTime,
    userId,
    userName,
    teamId: teamId || '',
    teamName: teamName || (tournament.type === 'SOLO' ? players[0]?.inGameName : `Slot #${predictedSlot}`),
    type: tournament.type,
    status: 'CONFIRMED',
    slotNumber: predictedSlot,
    playerUids,
    players,
    entryFeePaid: Number(tournament.entryFee || 0),
    createdAt: new Date().toISOString(),
  };

  const started = startOptimisticJoin({
    userId,
    tournament,
    registration: optimisticRegistration,
    feeDeducted: Math.max(0, Number(tournament.entryFee || 0)),
  });

  if (!started) {
    return {
      started: false,
      registration: optimisticRegistration,
      message: 'আপনি ইতিমধ্যে এই ম্যাচে জয়েন করেছেন!',
    };
  }

  // Run authoritative Firestore transaction in background without blocking user UI
  void joinTournament(tournament, userId, userName, players, teamName, teamId)
    .then((res) => {
      if (res.success) {
        confirmOptimisticJoin(userId, tournament.id, res.slotNumber);
        onBackgroundConfirmed?.(res.slotNumber);
      } else if (res.message.includes('ইতিমধ্যে এই টুর্নামেন্টে রেজিস্টার')) {
        confirmOptimisticJoin(userId, tournament.id);
        onBackgroundConfirmed?.();
      } else {
        rollbackOptimisticJoin(userId, tournament.id);
        emitOptimisticJoinError(res.message);
        onBackgroundFailed?.(res.message);
      }
    })
    .catch((err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'স্লট কনফার্ম করতে সমস্যা হয়েছে।';
      rollbackOptimisticJoin(userId, tournament.id);
      emitOptimisticJoinError(msg);
      onBackgroundFailed?.(msg);
    });

  return {
    started: true,
    registration: optimisticRegistration,
    message:
      slotWeight > 1
        ? `Slot #${predictedSlot}-#${predictedEndSlot} Confirmed!`
        : `Slot #${predictedSlot} Confirmed!`,
  };
}

export async function fetchUserRegistrations(userId: string): Promise<TournamentRegistration[]> {
  try {
    const byOwnerQ = query(
      collection(db, 'registrations'),
      where('userId', '==', userId)
    );
    const byTeammateQ = query(
      collection(db, 'registrations'),
      where('playerUids', 'array-contains', userId)
    );

    const [ownerSnap, teammateSnap] = await Promise.all([
      getDocsFromServer(byOwnerQ).catch(() => getDocs(byOwnerQ)),
      getDocsFromServer(byTeammateQ).catch(() => getDocs(byTeammateQ).catch(() => null)),
    ]);

    const regById = new Map<string, TournamentRegistration>();
    ownerSnap.forEach((d) => {
      const data = d.data() as TournamentRegistration;
      if (data.status !== 'CANCELLED' && data.status !== 'REJECTED') {
        regById.set(d.id, { ...data, id: data.id || d.id });
      }
    });
    if (teammateSnap) {
      teammateSnap.forEach((d) => {
        if (!regById.has(d.id)) {
          const data = d.data() as TournamentRegistration;
          if (data.status !== 'CANCELLED' && data.status !== 'REJECTED') {
            regById.set(d.id, { ...data, id: data.id || d.id });
          }
        }
      });
    }

    return Array.from(regById.values()).sort((a, b) =>
      b.createdAt > a.createdAt ? 1 : -1
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'registrations');
  }
}

export async function fetchRoomCredentials(tournamentId: string): Promise<RoomCredential | null> {
  try {
    const ref = doc(db, 'rooms', tournamentId);
    let snap;
    try {
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (snap.exists()) {
      return snap.data() as RoomCredential;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${tournamentId}`);
  }
}

export async function saveRoomCredentials(data: RoomCredential): Promise<void> {
  try {
    await setDoc(doc(db, 'rooms', data.tournamentId), {
      ...data,
      id: data.tournamentId,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${data.tournamentId}`);
  }
}

export async function fetchAllRooms(): Promise<Record<string, RoomCredential>> {
  try {
    const snap = await getDocs(collection(db, 'rooms'));
    const map: Record<string, RoomCredential> = {};
    snap.forEach((d) => {
      const data = d.data() as RoomCredential;
      map[d.id] = data;
      if (data.tournamentId) {
        map[data.tournamentId] = data;
      }
    });
    return map;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'rooms');
    return {};
  }
}

export async function publishRoomCredentialsWithNotification(
  tournament: Tournament,
  roomId: string,
  roomPassword: string
): Promise<{ success: boolean; notifiedCount: number; message: string }> {
  try {
    const cleanRoomId = roomId.trim();
    const cleanPass = roomPassword.trim();

    if (!cleanRoomId) {
      return {
        success: false,
        notifiedCount: 0,
        message: 'Room ID খালি রাখা যাবে না! (Room ID is required before publishing)',
      };
    }

    // 1. Save & Publish Room Credentials
    await setDoc(doc(db, 'rooms', tournament.id), {
      id: tournament.id,
      tournamentId: tournament.id,
      roomId: cleanRoomId,
      roomPassword: cleanPass,
      isPublished: true,
      releaseTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Query ONLY active joined registrations for this specific tournament
    const regSnap = await getDocs(
      query(collection(db, 'registrations'), where('tournamentId', '==', tournament.id))
    );

    const targetUserIds = new Set<string>();
    regSnap.forEach((d) => {
      const reg = d.data() as TournamentRegistration;
      if (reg.status === 'CANCELLED' || reg.status === 'REJECTED') {
        return;
      }
      if (reg.userId) targetUserIds.add(reg.userId);
      if (Array.isArray(reg.playerUids)) {
        reg.playerUids.forEach((uid) => {
          if (uid && !uid.startsWith('FF_')) targetUserIds.add(uid);
        });
      }
    });

    // 3. Send exact Notification ONLY to users who joined / bought slot in this match
    const notifTitle = 'Room Code Chole Asche';
    const notifMessage =
      'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.';
    const roomLink = `/app?view=tournament&id=${tournament.id}&tab=room`;

    if (targetUserIds.size > 0) {
      const targetList = Array.from(targetUserIds);
      const notifPromises = targetList.map((uid) =>
        createUserNotification(
          uid,
          notifTitle,
          notifTitle,
          notifMessage,
          notifMessage,
          'ALERT',
          roomLink
        )
      );
      await Promise.all([
        Promise.all(notifPromises),
        sendServerRoomPushNotification({
          userIds: targetList,
          title: notifTitle,
          body: notifMessage,
          url: roomLink,
          tag: `tx-room-${tournament.id}`,
        }),
      ]);
    }

    return {
      success: true,
      notifiedCount: targetUserIds.size,
      message:
        targetUserIds.size > 0
          ? `রুম আইডি এবং পাসওয়ার্ড সফলভাবে পাবলিশ হয়েছে! ${targetUserIds.size} জন জয়েন করা প্লেয়ারকে নোটিফিকেশন পাঠানো হয়েছে।`
          : 'রুম আইডি এবং পাসওয়ার্ড সফলভাবে পাবলিশ হয়েছে! (এই ম্যাচে এখনো কোনো প্লেয়ার জয়েন করেনি, তাই কোনো নোটিফিকেশন পাঠানো হয়নি।)',
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { success: false, notifiedCount: 0, message: err.message };
    }
    return { success: false, notifiedCount: 0, message: 'রুম তথ্য পাবলিশ করতে সমস্যা হয়েছে।' };
  }
}

export async function createTournament(
  tournament: Omit<Tournament, 'id'>,
  initialRoom?: { roomId?: string; roomPassword?: string; isPublished?: boolean }
): Promise<string> {
  try {
    const id = 'tour_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);

    const resolvedCategory = getTournamentCategory(tournament as Tournament);
    const sanitizedPerKillPrize = supportsPerKillPrize(resolvedCategory)
      ? Math.max(0, Number(tournament.perKillPrize ?? 0) || 0)
      : 0;

    batch.set(doc(db, 'tournaments', id), {
      ...tournament,
      perKillPrize: sanitizedPerKillPrize,
      id,
      registeredCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    batch.set(doc(db, 'rooms', id), {
      id,
      tournamentId: id,
      roomId: initialRoom?.roomId || '',
      roomPassword: initialRoom?.roomPassword || '',
      releaseTime: tournament.matchDate || nowIso,
      isPublished: initialRoom?.isPublished || false,
      updatedAt: nowIso,
    });

    await batch.commit();
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'tournaments');
  }
}

export function createTournamentInstant(params: {
  tournament: Omit<Tournament, 'id'>;
  initialRoom?: { roomId?: string; roomPassword?: string; isPublished?: boolean };
  onBackgroundConfirmed?: (id: string) => void;
  onBackgroundFailed?: (id: string, message: string) => void;
}): {
  started: boolean;
  tournament: Tournament;
  room: RoomCredential;
} {
  const { tournament, initialRoom, onBackgroundConfirmed, onBackgroundFailed } = params;
  const id = 'tour_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  const resolvedCategory = getTournamentCategory(tournament as Tournament);
  const sanitizedPerKillPrize = supportsPerKillPrize(resolvedCategory)
    ? Math.max(0, Number(tournament.perKillPrize ?? 0) || 0)
    : 0;

  const fullTournament: Tournament = {
    ...tournament,
    perKillPrize: sanitizedPerKillPrize,
    id,
    registeredCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  } as Tournament;

  const fullRoom: RoomCredential = {
    id,
    tournamentId: id,
    roomId: initialRoom?.roomId || '',
    roomPassword: initialRoom?.roomPassword || '',
    releaseTime: tournament.matchDate || nowIso,
    isPublished: initialRoom?.isPublished || false,
  };

  const started = startOptimisticTournament(fullTournament, fullRoom);
  if (!started) {
    return {
      started: false,
      tournament: fullTournament,
      room: fullRoom,
    };
  }

  // Commit atomically in the background detached from modal/component lifecycle
  void (async () => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'tournaments', id), fullTournament);
      batch.set(doc(db, 'rooms', id), {
        ...fullRoom,
        updatedAt: nowIso,
      });
      await batch.commit();
      confirmOptimisticTournament(id);
      onBackgroundConfirmed?.(id);
    } catch (err) {
      rollbackOptimisticTournament(id);
      let userMsg = 'টুর্নামেন্ট সেভ করতে সমস্যা হয়েছে।';
      try {
        handleFirestoreError(err, OperationType.WRITE, 'tournaments');
      } catch (handled) {
        if (handled instanceof Error && handled.message) {
          userMsg = handled.message;
        }
      }
      emitOptimisticTournamentError(userMsg);
      onBackgroundFailed?.(id, userMsg);
    }
  })();

  return {
    started: true,
    tournament: fullTournament,
    room: fullRoom,
  };
}

export async function updateTournament(id: string, data: Partial<Tournament>): Promise<void> {
  try {
    const sanitizedData: Partial<Tournament> = { ...data };
    if (sanitizedData.category !== undefined && !supportsPerKillPrize(sanitizedData.category)) {
      sanitizedData.perKillPrize = 0;
    }
    await updateDoc(doc(db, 'tournaments', id), {
      ...sanitizedData,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tournaments/${id}`);
  }
}

async function verifyCurrentActorIsAdmin(): Promise<boolean> {
  const adminRoles = new Set(['ADMIN', 'SUPER_ADMIN', 'MODERATOR']);
  const fbUser = auth.currentUser;
  if (fbUser) {
    if (fbUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    try {
      const [adminSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'admins', fbUser.uid)),
        getDoc(doc(db, 'users', fbUser.uid)),
      ]);
      if (adminSnap.exists()) return true;
      if (userSnap.exists() && adminRoles.has(String(userSnap.data()?.role || ''))) {
        return true;
      }
    } catch {
      // fall through to session checks
    }
  }

  const activeAdmin = getActiveAdminSession();
  const candidates = [activeAdmin, getActiveBiometricSession(), getSavedPlayerSession()].filter(
    (s): s is NonNullable<typeof s> => Boolean(s && s.uid)
  );

  for (const session of candidates) {
    if (session.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    try {
      const [adminSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'admins', session.uid)),
        getDoc(doc(db, 'users', session.uid)),
      ]);
      if (adminSnap.exists()) return true;
      if (userSnap.exists() && adminRoles.has(String(userSnap.data()?.role || ''))) {
        return true;
      }
    } catch {
      if (activeAdmin && session.uid === activeAdmin.uid && adminRoles.has(String(activeAdmin.role || ''))) {
        return true;
      }
    }
  }

  return false;
}

export async function deleteTournament(id: string): Promise<void> {
  const isAllowed = await verifyCurrentActorIsAdmin();
  if (!isAllowed) {
    throw new Error('শুধুমাত্র অ্যাডমিনরা ম্যাচ, রুম বা টুর্নামেন্ট ডিলিট করতে পারবেন!');
  }
  lockTournamentDelete(id);
  removeOptimisticTournament(id);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'tournaments', id));
    batch.delete(doc(db, 'rooms', id));
    await batch.commit();
  } catch (err) {
    rollbackDeleteOptimisticTournament(id);
    handleFirestoreError(err, OperationType.DELETE, `tournaments/${id}`);
  } finally {
    unlockTournamentDelete(id);
  }
}

export function deleteTournamentInstant(params: {
  id: string;
  onBackgroundConfirmed?: (id: string) => void;
  onBackgroundFailed?: (id: string, message: string) => void;
}): { started: boolean } {
  const { id, onBackgroundConfirmed, onBackgroundFailed } = params;
  if (!id || isTournamentDeleteLocked(id)) {
    return { started: false };
  }

  lockTournamentDelete(id);
  removeOptimisticTournament(id);

  // Execute admin verification & single atomic batch delete in background detached from modal/component lifecycle
  void (async () => {
    try {
      const isAllowed = await verifyCurrentActorIsAdmin();
      if (!isAllowed) {
        throw new Error('শুধুমাত্র অ্যাডমিনরা ম্যাচ, রুম বা টুর্নামেন্ট ডিলিট করতে পারবেন!');
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, 'tournaments', id));
      batch.delete(doc(db, 'rooms', id));
      await batch.commit();
      onBackgroundConfirmed?.(id);
    } catch (err) {
      rollbackDeleteOptimisticTournament(id);
      let userMsg = 'টুর্নামেন্ট ডিলিট করতে সমস্যা হয়েছে!';
      if (err instanceof Error && err.message) {
        userMsg = err.message;
      }
      try {
        handleFirestoreError(err, OperationType.DELETE, `tournaments/${id}`);
      } catch (handled) {
        if (handled instanceof Error && handled.message) {
          userMsg = handled.message;
        }
      }
      emitOptimisticTournamentError(userMsg);
      onBackgroundFailed?.(id, userMsg);
    } finally {
      unlockTournamentDelete(id);
    }
  })();

  return { started: true };
}

export async function fetchRegistrationsForTournament(tournamentId: string): Promise<TournamentRegistration[]> {
  try {
    const q = query(
      collection(db, 'registrations'),
      where('tournamentId', '==', tournamentId)
    );
    const snap = await getDocs(q);
    const list: TournamentRegistration[] = [];
    snap.forEach((d) => {
      const reg = d.data() as TournamentRegistration;
      if (reg.status !== 'CANCELLED' && reg.status !== 'REJECTED') {
        list.push({ ...reg, id: reg.id || d.id });
      }
    });
    return list.sort((a, b) => a.slotNumber - b.slotNumber);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'registrations');
  }
}

export async function updateMatchTimeWithNotification(params: {
  tournamentId: string;
  newMatchTime: string;
  newMatchDate?: string;
}): Promise<{
  success: boolean;
  message: string;
  updatedTournament?: Tournament;
  notifiedCount: number;
}> {
  const { tournamentId, newMatchTime, newMatchDate } = params;
  const cleanTime = (newMatchTime || '').trim();
  if (!cleanTime) {
    return {
      success: false,
      message: 'দয়া করে সঠিক নতুন সময় সিলেক্ট করুন।',
      notifiedCount: 0,
    };
  }

  const isAllowed = await verifyCurrentActorIsAdmin();
  if (!isAllowed) {
    return {
      success: false,
      message: 'শুধুমাত্র অ্যাডমিনরা ম্যাচের সময় পরিবর্তন করতে পারবেন!',
      notifiedCount: 0,
    };
  }

  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    let tourSnap;
    try {
      tourSnap = await getDocFromServer(tourRef);
    } catch {
      tourSnap = await getDoc(tourRef);
    }

    if (!tourSnap.exists()) {
      return {
        success: false,
        message: 'টুর্নামেন্টটি খুঁজে পাওয়া যায়নি!',
        notifiedCount: 0,
      };
    }

    const currentTour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };
    const statusUpper = String(currentTour.status || '').toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') {
      return {
        success: false,
        message: 'ম্যাচ ইতিমধ্যে শেষ বা বাতিল হয়ে গেছে — এখন আর Time Edit করা যাবে না!',
        notifiedCount: 0,
      };
    }

    const todayStr = getDhakaTodayDateStr();
    const nowMs = Date.now();

    let anchorDate = (currentTour.originalMatchDate || currentTour.matchDate || todayStr).trim();
    const anchorTime = (currentTour.originalMatchTime || currentTour.matchTime || cleanTime).trim();
    let resolvedDate = (newMatchDate || currentTour.matchDate || anchorDate).trim();

    let anchorDateObj = parseMatchDateAndTime(anchorDate, anchorTime);
    let targetDateObj = parseMatchDateAndTime(resolvedDate, cleanTime);

    // If the stored matchDate is from a previous day while the edited time today is upcoming,
    // align the date to today (Asia/Dhaka) so status & countdown reflect the edited time properly.
    if (targetDateObj && targetDateObj.getTime() <= nowMs) {
      const todayTargetObj = parseMatchDateAndTime(todayStr, cleanTime);
      if (todayTargetObj && todayTargetObj.getTime() > nowMs) {
        resolvedDate = todayStr;
        targetDateObj = todayTargetObj;
        if (anchorDateObj && anchorDateObj.getTime() <= nowMs) {
          const todayAnchorObj = parseMatchDateAndTime(todayStr, anchorTime);
          if (todayAnchorObj) {
            anchorDate = todayStr;
            anchorDateObj = todayAnchorObj;
          }
        }
      }
    }

    if (anchorDateObj && targetDateObj) {
      const diffMinutes = Math.round((targetDateObj.getTime() - anchorDateObj.getTime()) / 60000);
      if (diffMinutes < 0) {
        return {
          success: false,
          message: `মূল সময় (${anchorTime}) এর আগে Time কমানো যাবে না!`,
          notifiedCount: 0,
        };
      }
      if (diffMinutes > 15) {
        const maxObj = new Date(anchorDateObj.getTime() + 15 * 60 * 1000);
        const maxParts = getDhakaDateTimeParts(maxObj);
        const maxDisplay = format24HourToDisplayTime(maxParts.hours, maxParts.minutes);
        return {
          success: false,
          message: `সর্বোচ্চ ১৫ মিনিট পর্যন্ত (${maxDisplay}) Time বাড়ানো যাবে! এর বেশি নয়।`,
          notifiedCount: 0,
        };
      }
    }

    const currentJoined = Math.max(0, Number(currentTour.registeredCount) || 0);
    const maxSlots = Math.max(1, Number(currentTour.maxSlots) || 1);
    let nextStatus = currentTour.status || 'REGISTRATION_OPEN';

    if (targetDateObj && targetDateObj.getTime() > nowMs) {
      if (statusUpper === 'ONGOING' || statusUpper === 'UPCOMING' || statusUpper === 'OPEN') {
        nextStatus = currentJoined >= maxSlots ? 'REGISTRATION_FULL' : 'REGISTRATION_OPEN';
      }
    }

    const nowIso = new Date().toISOString();

    await updateDoc(tourRef, {
      matchTime: cleanTime,
      matchDate: resolvedDate,
      originalMatchTime: anchorTime,
      originalMatchDate: anchorDate,
      status: nextStatus,
      updatedAt: nowIso,
    });

    const updatedTournament: Tournament = {
      ...currentTour,
      matchTime: cleanTime,
      matchDate: resolvedDate,
      originalMatchTime: anchorTime,
      originalMatchDate: anchorDate,
      status: nextStatus,
      updatedAt: nowIso,
    };

    // Sync matchTime & matchDate across all active registrations and notify joined players
    const regSnap = await getDocs(
      query(collection(db, 'registrations'), where('tournamentId', '==', tournamentId))
    );

    const targetUserIds = new Set<string>();
    const activeRegRefs: ReturnType<typeof doc>[] = [];

    regSnap.forEach((d) => {
      const reg = d.data() as TournamentRegistration;
      if (reg.status === 'CANCELLED' || reg.status === 'REJECTED') {
        return;
      }
      activeRegRefs.push(doc(db, 'registrations', d.id));
      if (reg.userId) targetUserIds.add(reg.userId);
      if (Array.isArray(reg.playerUids)) {
        reg.playerUids.forEach((uid) => {
          if (uid && !uid.startsWith('FF_')) targetUserIds.add(uid);
        });
      }
    });

    if (activeRegRefs.length > 0) {
      const batch = writeBatch(db);
      activeRegRefs.forEach((regRef) => {
        batch.update(regRef, {
          matchTime: cleanTime,
          matchDate: resolvedDate,
        });
      });
      await batch.commit();
    }

    const notifTitle = 'Match Time Changed';
    const notifTitleBn = 'ম্যাচের সময় পরিবর্তন হয়েছে';
    const notifBody = `Match Time Change Hoise, Notun Time: ${cleanTime}`;
    const notifFullMessage = currentTour.title
      ? `${notifBody} (${currentTour.title})`
      : notifBody;
    const matchLink = `/app?view=tournament&id=${tournamentId}`;

    if (targetUserIds.size > 0) {
      const targetList = Array.from(targetUserIds);
      const notifPromises = targetList.map((uid) =>
        createUserNotification(
          uid,
          notifTitle,
          notifTitleBn,
          notifFullMessage,
          notifFullMessage,
          'ALERT',
          matchLink
        )
      );

      await Promise.all([
        Promise.all(notifPromises),
        sendServerRoomPushNotification({
          userIds: targetList,
          title: notifTitle,
          body: notifFullMessage,
          url: matchLink,
          tag: `tx-time-${tournamentId}-${Date.now()}`,
        }),
      ]);
    }

    return {
      success: true,
      updatedTournament,
      notifiedCount: targetUserIds.size,
      message:
        targetUserIds.size > 0
          ? `Match Time Change Hoise, Notun Time: ${cleanTime} · ${targetUserIds.size} জন জয়েন করা প্লেয়ারকে নোটিফিকেশন পাঠানো হয়েছে!`
          : `Match Time সফলভাবে ${cleanTime} করা হয়েছে!`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournamentId}`);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'ম্যাচের সময় পরিবর্তন করতে সমস্যা হয়েছে।',
      notifiedCount: 0,
    };
  }
}

export async function updateTournamentMaxSlots(params: {
  tournamentId: string;
  newMaxSlots: number;
}): Promise<{
  success: boolean;
  message: string;
  updatedTournament?: Tournament;
}> {
  const { tournamentId, newMaxSlots } = params;
  const parsedSlots = Math.floor(Number(newMaxSlots));

  if (!Number.isFinite(parsedSlots) || parsedSlots < 1) {
    return {
      success: false,
      message: 'সঠিক Slot সংখ্যা দিন (কমপক্ষে 1 হতে হবে)।',
    };
  }

  const isAllowed = await verifyCurrentActorIsAdmin();
  if (!isAllowed) {
    return {
      success: false,
      message: 'শুধুমাত্র অ্যাডমিনরা ম্যাচের Slot পরিবর্তন করতে পারবেন!',
    };
  }

  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    const updatedTournament = await runTransaction(db, async (txn) => {
      const tourSnap = await txn.get(tourRef);
      if (!tourSnap.exists()) {
        throw new Error('টুর্নামেন্টটি খুঁজে পাওয়া যায়নি!');
      }

      const currentTour = { ...(tourSnap.data() as Tournament), id: tourSnap.id };
      const category = getTournamentCategory(currentTour);

      if (!isSlotEditableCategory(category)) {
        throw new Error('এই ম্যাচের Slot Edit করা যাবে না!');
      }

      const statusUpper = String(currentTour.status || 'REGISTRATION_OPEN').toUpperCase();
      if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') {
        throw new Error('ম্যাচটি ইতিমধ্যে শেষ বা বাতিল হয়ে গেছে — এখন Slot পরিবর্তন করা যাবে না!');
      }

      const currentJoined = Math.max(0, Number(currentTour.registeredCount) || 0);
      const minAllowed = Math.max(1, currentJoined);
      const maxAllowed = getMaxSlotLimitForCategory(category);
      const matchLabel = category === 'FREE MATCH' ? 'SPECIAL MATCH' : category;

      if (parsedSlots < minAllowed) {
        throw new Error(
          currentJoined > 0
            ? `Already ${currentJoined} জন জয়েন করেছে! ${currentJoined} এর কম Slot করা যাবে না।`
            : 'Slot সংখ্যা কমপক্ষে 1 হতে হবে!'
        );
      }

      if (maxAllowed !== null && parsedSlots > maxAllowed) {
        throw new Error(`${matchLabel}-এ সর্বোচ্চ ${maxAllowed} Slot পর্যন্ত করা যাবে!`);
      }

      let nextStatus = currentTour.status || 'REGISTRATION_OPEN';
      if (statusUpper === 'REGISTRATION_FULL' && parsedSlots > currentJoined) {
        nextStatus = 'REGISTRATION_OPEN';
      } else if (
        (statusUpper === 'REGISTRATION_OPEN' || statusUpper === 'OPEN') &&
        currentJoined > 0 &&
        parsedSlots <= currentJoined
      ) {
        nextStatus = 'REGISTRATION_FULL';
      }

      const nowIso = new Date().toISOString();
      txn.update(tourRef, {
        maxSlots: parsedSlots,
        status: nextStatus,
        updatedAt: nowIso,
      });

      return {
        ...currentTour,
        maxSlots: parsedSlots,
        status: nextStatus,
        updatedAt: nowIso,
      } as Tournament;
    });

    return {
      success: true,
      updatedTournament,
      message: `Total Slot সফলভাবে ${parsedSlots} করা হয়েছে!`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournamentId}`);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Slot আপডেট করতে সমস্যা হয়েছে।',
    };
  }
}

export async function updateRegistrationPlayerName(params: {
  registrationId: string;
  tournamentId: string;
  actorUserId: string;
  playerIndex?: number;
  newPlayerName: string;
}): Promise<{
  success: boolean;
  message: string;
  updatedRegistration?: TournamentRegistration;
}> {
  const {
    registrationId,
    tournamentId,
    actorUserId,
    playerIndex = 0,
    newPlayerName,
  } = params;

  const trimmedName = (newPlayerName || '').trim();
  if (!trimmedName) {
    return {
      success: false,
      message: 'অনুগ্রহ করে নতুন প্লেয়ারের নাম লিখুন!',
    };
  }
  if (trimmedName.length > 40) {
    return {
      success: false,
      message: 'প্লেয়ারের নাম সর্বোচ্চ ৪০ অক্ষরের মধ্যে হতে হবে!',
    };
  }
  if (!actorUserId || !registrationId || !tournamentId) {
    return {
      success: false,
      message: 'স্লটের তথ্য পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    };
  }

  try {
    const tourRef = doc(db, 'tournaments', tournamentId);
    const regRef = doc(db, 'registrations', registrationId);

    const updatedRegistration = await runTransaction(db, async (txn) => {
      const tourSnap = await txn.get(tourRef);
      if (!tourSnap.exists()) {
        throw new Error('টুর্নামেন্টটি খুঁজে পাওয়া যায়নি!');
      }

      const tourData = { ...(tourSnap.data() as Tournament), id: tourSnap.id };
      const statusUpper = String(tourData.status || 'REGISTRATION_OPEN').toUpperCase();
      if (statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') {
        throw new Error('ম্যাচ ইতিমধ্যে শেষ বা বাতিল হয়ে গেছে — এখন আর নাম পরিবর্তন করা যাবে না!');
      }

      const matchStart = parseMatchDateAndTime(tourData.matchDate, tourData.matchTime);
      const hasStarted =
        (matchStart && matchStart.getTime() <= Date.now()) ||
        (!matchStart && statusUpper === 'ONGOING');
      if (hasStarted) {
        throw new Error('ম্যাচ শুরু (Started / Live) হয়ে গেছে — এখন আর নাম Edit করা যাবে না!');
      }

      const regSnap = await txn.get(regRef);
      if (!regSnap.exists()) {
        throw new Error('আপনার স্লটটি খুঁজে পাওয়া যায়নি!');
      }

      const regData = { ...(regSnap.data() as TournamentRegistration), id: regSnap.id };
      if (regData.userId !== actorUserId) {
        throw new Error('শুধুমাত্র যিনি এই Slot জয়েন করেছেন, তিনিই নিজের Slot এর নাম Edit করতে পারবেন!');
      }

      if (regData.status === 'CANCELLED' || regData.status === 'REJECTED') {
        throw new Error('এই রেজিস্ট্রেশনটি বাতিল হয়ে গেছে!');
      }

      const targetIndex = Math.max(0, Math.floor(Number(playerIndex) || 0));
      const existingPlayers = Array.isArray(regData.players)
        ? regData.players.map((p) => ({ ...p }))
        : [];

      if (targetIndex < existingPlayers.length) {
        existingPlayers[targetIndex] = {
          ...existingPlayers[targetIndex],
          name: trimmedName,
          inGameName: trimmedName,
        };
      } else if (targetIndex === 0) {
        existingPlayers.push({
          uid: regData.userId,
          name: trimmedName,
          inGameName: trimmedName,
          freeFireUid: '',
        });
      } else {
        throw new Error('প্লেয়ারের তথ্য খুঁজে পাওয়া যায়নি!');
      }

      let nextUserName = regData.userName;
      let nextTeamName = regData.teamName || '';

      if (targetIndex === 0) {
        nextUserName = trimmedName;
        const p2Raw = existingPlayers[1]?.inGameName || existingPlayers[1]?.name || '';
        const hasRealPartner =
          Boolean(p2Raw) && !p2Raw.includes('Partner: -') && !p2Raw.includes('Solo');
        if (regData.type === 'DUO' && hasRealPartner) {
          nextTeamName = `${trimmedName} & ${p2Raw}`;
        } else if (regData.type === 'SOLO' || (regData.type === 'DUO' && !hasRealPartner)) {
          nextTeamName = trimmedName;
        }
      } else if (targetIndex === 1 && regData.type === 'DUO') {
        const p1Name =
          existingPlayers[0]?.inGameName || existingPlayers[0]?.name || regData.userName;
        nextTeamName = `${p1Name} & ${trimmedName}`;
      }

      txn.update(regRef, {
        players: existingPlayers,
        userName: nextUserName,
        teamName: nextTeamName,
      });

      return {
        ...regData,
        players: existingPlayers,
        userName: nextUserName,
        teamName: nextTeamName,
      } as TournamentRegistration;
    });

    return {
      success: true,
      updatedRegistration,
      message: `Slot #${updatedRegistration.slotNumber} এর নাম সফলভাবে "${trimmedName}" করা হয়েছে!`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `registrations/${registrationId}`);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'নাম পরিবর্তন করতে সমস্যা হয়েছে।',
    };
  }
}


