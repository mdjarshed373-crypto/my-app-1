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
  getTournamentCategory,
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
    return mergeOptimisticTournaments(list);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'tournaments');
  }
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
      const currentTour = tourSnap.data() as Tournament;

      if (currentTour.status === 'COMPLETED' || currentTour.status === 'CANCELLED') {
        throw new Error('এই টুর্নামেন্টটি বন্ধ হয়ে গেছে!');
      }

      if (currentTour.registeredCount >= currentTour.maxSlots) {
        throw new Error('দুঃখিত, টুর্নামেন্টের সমস্ত স্লট বুক হয়ে গেছে! (Slots Full)');
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

      // 5. Update tournament registered count
      const newRegisteredCount = (currentTour.registeredCount || 0) + 1;
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
      const slotNumber = newRegisteredCount;
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
  const predictedSlot = Math.min(
    Math.max(1, Number(tournament.maxSlots) || 1),
    Math.max(0, Number(tournament.registeredCount) || 0) + 1
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
    message: `Slot #${predictedSlot} Confirmed!`,
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
    if (
      statusUpper === 'ONGOING' ||
      statusUpper === 'COMPLETED' ||
      statusUpper === 'CANCELLED'
    ) {
      return {
        success: false,
        message: 'ম্যাচ ইতিমধ্যে শুরু বা শেষ হয়ে গেছে — এখন আর Time Edit করা যাবে না!',
        notifiedCount: 0,
      };
    }

    const currentStart = parseMatchDateAndTime(currentTour.matchDate, currentTour.matchTime);
    if (currentStart && currentStart.getTime() <= Date.now()) {
      return {
        success: false,
        message: 'ম্যাচের সময় ইতিমধ্যে হয়ে গেছে (Match Started) — এখন আর Time Edit করা যাবে না!',
        notifiedCount: 0,
      };
    }

    const resolvedDate = (newMatchDate || currentTour.matchDate || '').trim();
    const nowIso = new Date().toISOString();

    await updateDoc(tourRef, {
      matchTime: cleanTime,
      matchDate: resolvedDate,
      updatedAt: nowIso,
    });

    const updatedTournament: Tournament = {
      ...currentTour,
      matchTime: cleanTime,
      matchDate: resolvedDate,
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

