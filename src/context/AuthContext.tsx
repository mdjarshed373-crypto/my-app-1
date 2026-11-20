import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../services/firestoreError';
import { syncLeaderboardEntry } from '../services/matchResultService';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  normalizePhoneNumber,
  isValidPhoneNumber,
  phoneToSyntheticEmail,
  getActiveAdminSession,
  setActiveAdminSession,
  verifyAndLoginAdmin,
} from '../services/adminService';
import {
  getActiveBiometricSession,
  setActiveBiometricSession,
  authenticateWithSavedFingerprint,
  BiometricAccountCandidate,
} from '../services/biometricAuthService';
import {
  getSavedUserAvatar,
  saveUserAvatar,
} from '../services/avatarStorageService';
import {
  hashPassword,
  normalizeUsername,
  normalizeBDPhoneNumber,
  isValidBDPhoneNumber,
  checkUsernameExists,
  checkEmailExists,
  checkPhoneExists,
  lookupUserByIdentifier,
  lookupFastAuthCache,
  saveFastAuthEntry,
  removeFastAuthEntry,
  hasFastAuthDuplicate,
  acquireRegistrationLock,
  commitNewPlayerBatch,
  emitAuthBackgroundError,
  emitAuthBackgroundNotice,
  resetPasswordInFirestore,
  savePlayerSession,
  getSavedPlayerSession,
  clearPlayerSession,
} from '../services/playerAuthService';
import {
  isAdminRole,
  isUserAdminAccount,
  isUserSuperAdminAccount,
  normalizeProfileAdminFlags,
} from '../utils/adminAuth';
import {
  isUserCurrentlyBanned,
  getBanErrorMessage,
  unbanUserAccount,
} from '../services/banService';
import {
  generateUniqueReferCode,
  ensureUserReferCode,
  applyReferralBonus,
  normalizeReferCode,
  clearPendingReferCode,
} from '../services/referralService';
import {
  applyOptimisticDeltasToProfile,
  subscribeOptimisticResultStore,
} from '../services/optimisticResultStore';
import {
  applyOptimisticWithdrawToProfile,
  subscribeOptimisticWithdrawStore,
} from '../services/optimisticWithdrawStore';

function hydrateProfileAvatar(profile: UserProfile): UserProfile {
  const localAvatar = getSavedUserAvatar(profile);
  const resolved = localAvatar || profile.avatarUrl || '';
  if (resolved && !localAvatar) {
    saveUserAvatar(profile, resolved);
  }
  return resolved ? { ...profile, avatarUrl: resolved } : profile;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loginWithEmail: (
    identifier: string,
    pass: string,
    rememberMe?: boolean
  ) => Promise<BiometricAccountCandidate>;
  loginWithFingerprint: () => Promise<void>;
  loginAsAdmin: (adminNumberOrEmail: string, pass: string) => Promise<UserProfile>;
  loginMainAdminWithGoogle: () => Promise<void>;
  registerWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    username: string,
    phoneNumber?: string,
    freeFireUid?: string,
    inGameName?: string,
    rememberMe?: boolean
  ) => Promise<void>;
  registerNewPlayer: (
    username: string,
    email: string,
    phoneNumber: string,
    pass: string,
    rememberMe?: boolean,
    referCode?: string
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (emailOrIdentifier: string) => Promise<void>;
  resetPlayerPassword: (
    identifier: string,
    newPass: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updatePlayerProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  banAlertMessage: string | null;
  clearBanAlert: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [playerSession, setPlayerSession] = useState<UserProfile | null>(() => {
    const session = getSavedPlayerSession();
    return session ? hydrateProfileAvatar(session) : null;
  });
  const [localAdminSession, setLocalAdminSession] = useState<UserProfile | null>(() => {
    const session = getActiveAdminSession();
    return session ? hydrateProfileAvatar(session) : null;
  });
  const [biometricSession, setBiometricSession] = useState<UserProfile | null>(() => {
    const session = getActiveBiometricSession();
    return session ? hydrateProfileAvatar(session) : null;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const session =
      getSavedPlayerSession() ||
      getActiveAdminSession() ||
      getActiveBiometricSession();
    return session ? hydrateProfileAvatar(session) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [banAlertMessage, setBanAlertMessage] = useState<string | null>(null);
  const clearBanAlert = () => setBanAlertMessage(null);
  const activeSessionNonceRef = useRef<number>(0);
  const [, setOptimisticResultTick] = useState<number>(0);

  useEffect(() => {
    const unsubRes = subscribeOptimisticResultStore(() => {
      setOptimisticResultTick((t) => t + 1);
    });
    const unsubWithdraw = subscribeOptimisticWithdrawStore(() => {
      setOptimisticResultTick((t) => t + 1);
    });
    return () => {
      unsubRes();
      unsubWithdraw();
    };
  }, []);

  const restoredSession = playerSession || localAdminSession || biometricSession;
  const effectiveUser: User | null =
    firebaseUser ||
    (restoredSession
      ? ({
          uid: restoredSession.uid,
          email: restoredSession.email || '',
          displayName: restoredSession.displayName || 'Player',
          phoneNumber: restoredSession.phoneNumber || '',
          photoURL: restoredSession.avatarUrl || null,
          emailVerified: true,
          isAnonymous: false,
          providerData: [],
        } as unknown as User)
      : null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        // Clear any separate local admin session if a different Firebase user signed in
        const activeLocal = getActiveAdminSession();
        if (activeLocal && activeLocal.uid !== user.uid) {
          setActiveAdminSession(null);
          setLocalAdminSession(null);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync Firestore user profile for Firebase Auth user, Direct Admin session, Biometric session, or Player session
  useEffect(() => {
    const activeUid =
      firebaseUser?.uid ||
      playerSession?.uid ||
      localAdminSession?.uid ||
      biometricSession?.uid ||
      null;

    if (!activeUid) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', activeUid);

    const forceSignOutRevokedAdmin = () => {
      clearPlayerSession();
      setActiveAdminSession(null);
      setLocalAdminSession(null);
      setActiveBiometricSession(null);
      setBiometricSession(null);
      setPlayerSession(null);
      setUserProfile(null);
      setLoading(false);
      signOut(auth).catch(() => {});
    };

    const isBootstrapAccount =
      firebaseUser?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ||
      localAdminSession?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

    const currentSessionWasAdmin = Boolean(
      (localAdminSession && localAdminSession.uid === activeUid) ||
      (biometricSession &&
        biometricSession.uid === activeUid &&
        (biometricSession.role === 'ADMIN' ||
          biometricSession.role === 'MODERATOR' ||
          biometricSession.role === 'SUPER_ADMIN')) ||
      (playerSession &&
        playerSession.uid === activeUid &&
        (playerSession.role === 'ADMIN' ||
          playerSession.role === 'MODERATOR' ||
          playerSession.role === 'SUPER_ADMIN'))
    );

    const unsubAdminGuard =
      !isBootstrapAccount && currentSessionWasAdmin
        ? onSnapshot(
            doc(db, 'admins', activeUid),
            (adminSnap) => {
              const isSuperSession =
                localAdminSession?.role === 'SUPER_ADMIN' ||
                biometricSession?.role === 'SUPER_ADMIN' ||
                playerSession?.role === 'SUPER_ADMIN';
              if (
                !isSuperSession &&
                !adminSnap.metadata.fromCache &&
                !adminSnap.exists()
              ) {
                forceSignOutRevokedAdmin();
              }
            },
            () => {
              // ignore listener read hiccups
            }
          )
        : () => {};

    const unsubProfile = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.data() as UserProfile;
          const data = normalizeProfileAdminFlags(
            hydrateProfileAvatar(rawData),
            firebaseUser?.email
          );

          const isStillAdmin = isUserAdminAccount(data, firebaseUser?.email);

          // If this session had Admin powers and their role was downgraded to PLAYER/USER, kick them out immediately
          if (currentSessionWasAdmin && !isStillAdmin) {
            forceSignOutRevokedAdmin();
            return;
          }

          // Auto-clear expired temporary ban if banExpiresAt has passed
          if (data.isBanned && !isUserCurrentlyBanned(data)) {
            unbanUserAccount({ targetUid: activeUid }).catch(() => {});
            data.isBanned = false;
            data.banReason = '';
            data.banDuration = '';
            data.banExpiresAt = null;
          }

          // If this user is actively banned, immediately end their active session and alert them
          if (!isStillAdmin && isUserCurrentlyBanned(data)) {
            setBanAlertMessage(getBanErrorMessage(data));
            forceSignOutRevokedAdmin();
            return;
          }

          // Keep Direct Local Admin session synced while active
          if (!firebaseUser && localAdminSession) {
            const mergedLocalAdmin: UserProfile = hydrateProfileAvatar({
              ...localAdminSession,
              ...data,
              role:
                data.role === 'SUPER_ADMIN' || localAdminSession.role === 'SUPER_ADMIN'
                  ? 'SUPER_ADMIN'
                  : 'ADMIN',
              isAdmin: true,
            });
            setActiveAdminSession(mergedLocalAdmin);
            setUserProfile(mergedLocalAdmin);
            setLoading(false);
            return;
          }

          if (
            firebaseUser &&
            firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL
          ) {
            if (data.role !== 'SUPER_ADMIN') {
              try {
                await updateDoc(userDocRef, { role: 'SUPER_ADMIN' });
                data.role = 'SUPER_ADMIN';
              } catch {
                // ignore
              }
            }
          }

          // Only update existing /publicAdmins entry if already registered as a credentialed Admin
          const isUserAdmin = isUserAdminAccount(data, firebaseUser?.email);
          if (isUserAdmin) {
            try {
              const pubRef = doc(db, 'publicAdmins', activeUid);
              const pubSnap = await getDoc(pubRef);
              if (pubSnap.exists()) {
                const existingPub = pubSnap.data();
                const cleanAdminName =
                  (data.displayName || 'Admin').trim().slice(0, 100) || 'Admin';
                if (existingPub.displayName !== cleanAdminName) {
                  await setDoc(
                    pubRef,
                    {
                      id: activeUid,
                      displayName: cleanAdminName,
                      ...(existingPub.avatarId ? { avatarId: existingPub.avatarId } : {}),
                      createdAt:
                        existingPub.createdAt ||
                        data.createdAt ||
                        new Date().toISOString(),
                    },
                    { merge: true }
                  );
                }
              }
            } catch {
              // ignore non-blocking public sync error
            }
          }

          if (!data.referCode) {
            ensureUserReferCode(data)
              .then((code) => {
                data.referCode = code;
              })
              .catch(() => {});
          }

          setUserProfile(data);
          if (data.passwordHash) {
            saveFastAuthEntry(data);
          }
          if (playerSession) {
            setPlayerSession(data);
          }
          if (!firebaseUser && biometricSession) {
            setActiveBiometricSession(data);
          }
          syncLeaderboardEntry(data);
        } else if (firebaseUser) {
          // Create default profile if not yet created (e.g. from Google Sign-In)
          const isSuper = firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL;
          const newProfile: UserProfile = hydrateProfileAvatar({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName:
              firebaseUser.displayName || 'Gamer ' + firebaseUser.uid.substring(0, 5),
            username: (
              firebaseUser.email?.split('@')[0] ||
              'player_' + firebaseUser.uid.substring(0, 5)
            ).toLowerCase(),
            phoneNumber: firebaseUser.phoneNumber || '',
            freeFireUid: '',
            inGameName: firebaseUser.displayName || '',
            role: isSuper ? 'SUPER_ADMIN' : 'PLAYER',
            isAdmin: isSuper,
            walletBalance: 0,
            pendingBalance: 0,
            totalDeposited: 0,
            spentFromDeposited: 0,
            totalWithdrawn: 0,
            totalEarnings: 0,
            spentFromWinning: 0,
            totalKills: 0,
            totalWins: 0,
            totalMatches: 0,
            totalTournaments: 0,
            avatarUrl: firebaseUser.photoURL || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          try {
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
            await syncLeaderboardEntry(newProfile);
          } catch (err) {
            console.error('Error creating profile document', err);
          }
        } else if (playerSession) {
          setUserProfile(hydrateProfileAvatar(playerSession));
        } else if (localAdminSession) {
          setUserProfile(hydrateProfileAvatar(localAdminSession));
        } else if (biometricSession) {
          setUserProfile(hydrateProfileAvatar(biometricSession));
        }
        setLoading(false);
      },
      (error) => {
        if (playerSession) {
          setUserProfile(playerSession);
          setLoading(false);
          return;
        }
        if (!firebaseUser && localAdminSession) {
          // Keep Direct Local Admin session working even if Firestore listener fails
          setUserProfile(localAdminSession);
          setLoading(false);
          return;
        }
        if (!firebaseUser && biometricSession) {
          setUserProfile(biometricSession);
          setLoading(false);
          return;
        }
        handleFirestoreError(error, OperationType.GET, `users/${activeUid}`);
      }
    );

    return () => {
      unsubAdminGuard();
      unsubProfile();
    };
  }, [
    firebaseUser?.uid,
    playerSession?.uid,
    localAdminSession?.uid,
    biometricSession?.uid,
  ]);

  const loginWithEmail = async (
    identifier: string,
    pass: string,
    rememberMe: boolean = true
  ): Promise<BiometricAccountCandidate> => {
    const trimmed = identifier.trim();
    if (!trimmed || !pass) {
      throw new Error('Please enter both your Username/Email and Password.');
    }

    const sessionNonce = ++activeSessionNonceRef.current;
    const inputHashPromise = hashPassword(pass);

    // 0. Ultra-fast cached credential check (<10ms) with background server verification
    const cached = lookupFastAuthCache(trimmed);
    const inputHash = await inputHashPromise;

    if (cached && cached.passwordHash && cached.passwordHash === inputHash) {
      const profile = cached.userProfile
        ? normalizeProfileAdminFlags(cached.userProfile)
        : {
            uid: cached.uid,
            email: cached.email,
            username: cached.username,
            displayName: cached.displayName || 'Player',
            phoneNumber: cached.phoneNumber || '',
            role: 'PLAYER' as const,
            isAdmin: false,
            walletBalance: 0,
            pendingBalance: 0,
            totalDeposited: 0,
            spentFromDeposited: 0,
            totalWithdrawn: 0,
            totalEarnings: 0,
            spentFromWinning: 0,
            totalKills: 0,
            totalWins: 0,
            totalMatches: 0,
            totalTournaments: 0,
            passwordHash: cached.passwordHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
      const hydrated = hydrateProfileAvatar(profile);
      if (!isUserAdminAccount(hydrated) && isUserCurrentlyBanned(hydrated)) {
        throw new Error(getBanErrorMessage(hydrated));
      }
      if (hydrated.isBanned && !isUserCurrentlyBanned(hydrated)) {
        unbanUserAccount({ targetUid: hydrated.uid }).catch(() => {});
        hydrated.isBanned = false;
        hydrated.banReason = '';
        hydrated.banDuration = '';
        hydrated.banExpiresAt = null;
      }

      setFirebaseUser(null);
      if (auth.currentUser) {
        void signOut(auth).catch(() => {});
      }
      setBanAlertMessage(null);
      setActiveAdminSession(null);
      setLocalAdminSession(null);
      setActiveBiometricSession(null);
      setBiometricSession(null);
      savePlayerSession(hydrated, rememberMe);
      setPlayerSession(hydrated);
      setUserProfile(hydrated);
      setLoading(false);

      // Background verification against Firestore (catches password resets from another device)
      void (async () => {
        try {
          const fresh = await lookupUserByIdentifier(trimmed);
          if (activeSessionNonceRef.current !== sessionNonce) return;
          if (fresh && fresh.passwordHash && fresh.passwordHash !== inputHash) {
            removeFastAuthEntry(cached.uid);
            clearPlayerSession();
            setPlayerSession(null);
            setUserProfile(null);
            emitAuthBackgroundError('Your password was updated. Please sign in with your new password.');
            return;
          }
          if (fresh?.userProfile) {
            const freshHydrated = normalizeProfileAdminFlags(hydrateProfileAvatar(fresh.userProfile));
            saveFastAuthEntry(freshHydrated);
          }
        } catch {}
      })();

      return {
        uid: hydrated.uid,
        email: hydrated.email,
        identifier: trimmed,
        phoneNumber: hydrated.phoneNumber || '',
        displayName: hydrated.inGameName || hydrated.displayName || hydrated.username,
        role: hydrated.role,
      };
    }

    // 1. Cold cache: run Firestore user lookup & optional admin credential check in parallel
    const isPhoneInput = isValidPhoneNumber(trimmed);
    const normAdminPhone = isPhoneInput ? normalizePhoneNumber(trimmed) : '';
    const [lookedUp, adminCredSnap] = await Promise.all([
      lookupUserByIdentifier(trimmed),
      isPhoneInput
        ? getDoc(doc(db, 'adminCredentials', normAdminPhone)).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (adminCredSnap && adminCredSnap.exists()) {
      try {
        const adminProfile = await loginAsAdmin(normAdminPhone, pass);
        return {
          uid: adminProfile.uid,
          email: adminProfile.email || normAdminPhone,
          identifier: trimmed,
          phoneNumber: adminProfile.phoneNumber || normAdminPhone,
          displayName: adminProfile.inGameName || adminProfile.displayName || trimmed,
          role: adminProfile.role,
        };
      } catch {}
    }

    // 2. Password hash verification against Firestore
    if (lookedUp && lookedUp.passwordHash) {
      if (lookedUp.passwordHash === inputHash) {
        const profile = lookedUp.userProfile
          ? normalizeProfileAdminFlags(lookedUp.userProfile)
          : {
              uid: lookedUp.uid,
              email: lookedUp.email,
              username: lookedUp.username,
              displayName: lookedUp.displayName || 'Player',
              phoneNumber: lookedUp.phoneNumber || '',
              role: 'PLAYER' as const,
              isAdmin: false,
              walletBalance: 0,
              pendingBalance: 0,
              totalDeposited: 0,
              spentFromDeposited: 0,
              totalWithdrawn: 0,
              totalEarnings: 0,
              spentFromWinning: 0,
              totalKills: 0,
              totalWins: 0,
              totalMatches: 0,
              totalTournaments: 0,
              passwordHash: lookedUp.passwordHash,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
        const hydrated = hydrateProfileAvatar(profile);
        if (!isUserAdminAccount(hydrated) && isUserCurrentlyBanned(hydrated)) {
          throw new Error(getBanErrorMessage(hydrated));
        }
        if (hydrated.isBanned && !isUserCurrentlyBanned(hydrated)) {
          unbanUserAccount({ targetUid: hydrated.uid }).catch(() => {});
          hydrated.isBanned = false;
          hydrated.banReason = '';
          hydrated.banDuration = '';
          hydrated.banExpiresAt = null;
        }

        setFirebaseUser(null);
        if (auth.currentUser && auth.currentUser.uid !== hydrated.uid) {
          void signOut(auth).catch(() => {});
        }
        setBanAlertMessage(null);
        setActiveAdminSession(null);
        setLocalAdminSession(null);
        setActiveBiometricSession(null);
        setBiometricSession(null);
        savePlayerSession(hydrated, rememberMe);
        saveFastAuthEntry(hydrated);
        setPlayerSession(hydrated);
        setUserProfile(hydrated);
        setLoading(false);

        return {
          uid: hydrated.uid,
          email: hydrated.email,
          identifier: trimmed,
          phoneNumber: hydrated.phoneNumber || '',
          displayName: hydrated.inGameName || hydrated.displayName || hydrated.username,
          role: hydrated.role,
        };
      }

      // Wrong password for an account that already has a Firestore passwordHash
      throw new Error('Invalid Username/Email or Password. Please check and try again.');
    }

    // 3. Legacy fallback: Firebase Auth / Admin login if no Firestore passwordHash exists
    let targetEmail = lookedUp?.email || trimmed.toLowerCase();
    if (!targetEmail.includes('@')) {
      targetEmail = phoneToSyntheticEmail(targetEmail);
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
      const fbUser = cred.user;
      let profileData: UserProfile | null = null;
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          profileData = snap.data() as UserProfile;
        }
      } catch {}

      const candidateProfile: UserProfile = profileData
        ? normalizeProfileAdminFlags(profileData, fbUser.email)
        : {
            uid: fbUser.uid,
            email: fbUser.email || targetEmail,
            displayName: fbUser.displayName || trimmed,
            username: (lookedUp?.username || trimmed).toLowerCase(),
            phoneNumber: lookedUp?.phoneNumber || fbUser.phoneNumber || '',
            role: 'PLAYER',
            isAdmin: false,
            walletBalance: 0,
            pendingBalance: 0,
            totalDeposited: 0,
            spentFromDeposited: 0,
            totalWithdrawn: 0,
            totalEarnings: 0,
            spentFromWinning: 0,
            totalKills: 0,
            totalWins: 0,
            totalMatches: 0,
            totalTournaments: 0,
            passwordHash: inputHash,
            createdAt: new Date().toISOString(),
          };

      const hydrated = hydrateProfileAvatar(candidateProfile);
      if (!isUserAdminAccount(hydrated, fbUser.email) && isUserCurrentlyBanned(hydrated)) {
        const banMsg = getBanErrorMessage(hydrated);
        clearPlayerSession();
        setPlayerSession(null);
        setUserProfile(null);
        void signOut(auth).catch(() => {});
        throw new Error(banMsg);
      }
      if (hydrated.isBanned && !isUserCurrentlyBanned(hydrated)) {
        unbanUserAccount({ targetUid: hydrated.uid }).catch(() => {});
        hydrated.isBanned = false;
        hydrated.banReason = '';
        hydrated.banDuration = '';
        hydrated.banExpiresAt = null;
      }
      setBanAlertMessage(null);
      setActiveAdminSession(null);
      setLocalAdminSession(null);
      setActiveBiometricSession(null);
      setBiometricSession(null);
      savePlayerSession(hydrated, rememberMe);
      saveFastAuthEntry(hydrated);
      setPlayerSession(hydrated);
      setUserProfile(hydrated);
      setLoading(false);

      return {
        uid: fbUser.uid,
        email: candidateProfile.email,
        identifier: trimmed,
        phoneNumber: candidateProfile.phoneNumber || '',
        displayName:
          candidateProfile.inGameName ||
          candidateProfile.displayName ||
          candidateProfile.username,
        role: candidateProfile.role || 'PLAYER',
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Your Account Has Been Banned')) {
        throw err;
      }
      try {
        const adminProfile = await loginAsAdmin(trimmed, pass);
        return {
          uid: adminProfile.uid,
          email: adminProfile.email || targetEmail,
          identifier: trimmed,
          phoneNumber: adminProfile.phoneNumber || '',
          displayName: adminProfile.inGameName || adminProfile.displayName || trimmed,
          role: adminProfile.role,
        };
      } catch {}

      throw new Error('Invalid Username/Email or Password. Please check and try again.');
    }
  };

  const loginAsAdmin = async (
    adminNumberOrEmail: string,
    pass: string
  ): Promise<UserProfile> => {
    const profile = await verifyAndLoginAdmin(adminNumberOrEmail, pass);
    const hydrated = hydrateProfileAvatar(profile);
    clearPlayerSession();
    setPlayerSession(null);
    setActiveBiometricSession(null);
    setBiometricSession(null);
    setActiveAdminSession(hydrated);
    setLocalAdminSession(hydrated);
    setUserProfile(hydrated);
    setLoading(false);
    return hydrated;
  };

  /**
   * Instant registration matching 2nd image: Username, Email, Mobile, Password.
   * Logs user in immediately (<100ms) and commits Firestore records in background.
   */
  const registerNewPlayer = async (
    username: string,
    email: string,
    phoneNumber: string,
    pass: string,
    rememberMe: boolean = true,
    referCode?: string
  ): Promise<void> => {
    const normUsername = normalizeUsername(username);
    const cleanEmail = email.trim().toLowerCase();
    const normPhone = normalizeBDPhoneNumber(phoneNumber);
    const cleanReferCode = referCode ? normalizeReferCode(referCode) : '';

    if (normUsername.length < 4) {
      throw new Error('Username must be at least 4 characters long.');
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!isValidBDPhoneNumber(normPhone)) {
      throw new Error('Please enter a valid 11-digit Bangladeshi mobile number (017xxxxxxxx).');
    }
    if (pass.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (cleanEmail === BOOTSTRAP_ADMIN_EMAIL) {
      throw new Error('This email address is reserved and cannot be registered.');
    }

    const localDuplicateMsg = hasFastAuthDuplicate(normUsername, cleanEmail, normPhone);
    if (localDuplicateMsg) {
      throw new Error(localDuplicateMsg);
    }

    const releaseLock = acquireRegistrationLock(normUsername, cleanEmail, normPhone);
    if (!releaseLock) {
      return;
    }

    let backgroundStarted = false;
    try {
      const sessionNonce = ++activeSessionNonceRef.current;
      const passHash = await hashPassword(pass);
      const ownReferCode = `TX${Math.floor(10000 + Math.random() * 90000)}`;
      const uid = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const nowIso = new Date().toISOString();

      const newProfile: UserProfile = {
        uid,
        email: cleanEmail,
        displayName: username.trim(),
        username: normUsername,
        phoneNumber: normPhone,
        freeFireUid: '',
        inGameName: username.trim(),
        role: 'PLAYER',
        isAdmin: false,
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        spentFromDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: 0,
        spentFromWinning: 0,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        totalTournaments: 0,
        referCode: ownReferCode,
        referralCount: 0,
        referralEarnings: 0,
        passwordHash: passHash,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const hydrated = hydrateProfileAvatar(newProfile);

      // Synchronously enter Home with newly registered player session
      setFirebaseUser(null);
      if (auth.currentUser) {
        void signOut(auth).catch(() => {});
      }
      setBanAlertMessage(null);
      setActiveAdminSession(null);
      setLocalAdminSession(null);
      setActiveBiometricSession(null);
      setBiometricSession(null);
      savePlayerSession(hydrated, rememberMe);
      saveFastAuthEntry(hydrated);
      setPlayerSession(hydrated);
      setUserProfile(hydrated);
      setLoading(false);

      // Background persistence + uniqueness verification + referral bonus
      backgroundStarted = true;
      void (async () => {
        try {
          const [userTaken, emailTaken, phoneTaken] = await Promise.all([
            checkUsernameExists(normUsername),
            checkEmailExists(cleanEmail),
            checkPhoneExists(normPhone),
          ]);

          if (userTaken || emailTaken || phoneTaken) {
            removeFastAuthEntry(uid);
            if (activeSessionNonceRef.current === sessionNonce) {
              clearPlayerSession();
              setPlayerSession(null);
              setUserProfile(null);
            }
            const errMsg = userTaken
              ? 'Already registered with this Username, please Sign In.'
              : emailTaken
              ? 'Already registered with this Email, please Sign In.'
              : 'Already registered with this Mobile Number, please Sign In.';
            emitAuthBackgroundError(errMsg);
            return;
          }

          await commitNewPlayerBatch(newProfile);

          if (cleanReferCode) {
            const refRes = await applyReferralBonus({
              newUserUid: uid,
              newUserName: username.trim(),
              referCode: cleanReferCode,
            }).catch(() => ({ success: false, message: '' }));
            clearPendingReferCode();
            if (refRes && !refRes.success && refRes.message) {
              emitAuthBackgroundNotice(refRes.message);
            }
          }
        } catch (bgErr) {
          console.warn('[AuthContext] Background registration sync warning:', bgErr);
        } finally {
          releaseLock();
        }
      })();
    } finally {
      if (!backgroundStarted) {
        releaseLock();
      }
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    username: string,
    phoneNumber?: string,
    freeFireUid?: string,
    inGameName?: string,
    rememberMe: boolean = true
  ) => {
    return registerNewPlayer(
      username || displayName,
      email,
      phoneNumber || '',
      pass,
      rememberMe
    );
  };

  const resetPlayerPassword = async (
    identifier: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    return resetPasswordInFirestore(identifier, newPass);
  };

  const loginWithGoogle = async () => {
    clearPlayerSession();
    setPlayerSession(null);
    setActiveAdminSession(null);
    setLocalAdminSession(null);
    setActiveBiometricSession(null);
    setBiometricSession(null);

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      const isSuper = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
      const ownReferCode = await generateUniqueReferCode();
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Gamer',
        username: (
          user.email?.split('@')[0] || 'player_' + user.uid.substring(0, 5)
        ).toLowerCase(),
        phoneNumber: user.phoneNumber || '',
        freeFireUid: '',
        inGameName: user.displayName || '',
        role: isSuper ? 'SUPER_ADMIN' : 'PLAYER',
        isAdmin: isSuper,
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        spentFromDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: 0,
        spentFromWinning: 0,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        totalTournaments: 0,
        referCode: ownReferCode,
        referralCount: 0,
        referralEarnings: 0,
        avatarUrl: user.photoURL || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
      await syncLeaderboardEntry(newProfile);
    } else {
      const existingData = snap.data() as UserProfile;
      if (!isUserAdminAccount(existingData, user.email) && isUserCurrentlyBanned(existingData)) {
        const banMsg = getBanErrorMessage(existingData);
        await signOut(auth).catch(() => {});
        clearPlayerSession();
        setUserProfile(null);
        throw new Error(banMsg);
      }
      if (existingData.isBanned && !isUserCurrentlyBanned(existingData)) {
        unbanUserAccount({ targetUid: user.uid }).catch(() => {});
      }
      setBanAlertMessage(null);
    }
  };

  const loginMainAdminWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const googleEmail = (user.email || '').trim().toLowerCase();
    const isBootstrap = googleEmail === BOOTSTRAP_ADMIN_EMAIL;

    if (!isBootstrap) {
      let existingSuperAdmin = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists() && adminSnap.data()?.role === 'SUPER_ADMIN') {
          existingSuperAdmin = true;
        }
      } catch {
        // ignore
      }
      if (!existingSuperAdmin) {
        await signOut(auth).catch(() => {});
        throw new Error('Access denied! Only Main Admin account can sign in here.');
      }
    }

    clearPlayerSession();
    setPlayerSession(null);
    setActiveAdminSession(null);
    setLocalAdminSession(null);
    setActiveBiometricSession(null);
    setBiometricSession(null);

    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    const nowIso = new Date().toISOString();

    if (!snap.exists()) {
      const ownReferCode = await generateUniqueReferCode();
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Main Admin',
        username: (
          user.email?.split('@')[0] || 'admin_' + user.uid.substring(0, 5)
        ).toLowerCase(),
        phoneNumber: user.phoneNumber || '',
        freeFireUid: '',
        inGameName: user.displayName || 'Main Admin',
        role: 'SUPER_ADMIN',
        isAdmin: true,
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        spentFromDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: 0,
        spentFromWinning: 0,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        totalTournaments: 0,
        referCode: ownReferCode,
        referralCount: 0,
        referralEarnings: 0,
        avatarUrl: user.photoURL || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
    } else {
      const existingData = normalizeProfileAdminFlags(
        snap.data() as UserProfile,
        user.email
      );
      if (isBootstrap && existingData.role !== 'SUPER_ADMIN') {
        await updateDoc(userDocRef, {
          role: 'SUPER_ADMIN',
          isAdmin: true,
          updatedAt: nowIso,
        }).catch(() => {});
        existingData.role = 'SUPER_ADMIN';
        existingData.isAdmin = true;
      }
      setUserProfile(existingData);
    }
    setBanAlertMessage(null);
  };

  const loginWithFingerprint = async () => {
    const verified = await authenticateWithSavedFingerprint();

    let loadedProfile: UserProfile | null = null;
    try {
      if (verified.uid) {
        const snap = await getDoc(doc(db, 'users', verified.uid));
        if (snap.exists()) {
          loadedProfile = snap.data() as UserProfile;
        }
      }
      if (!loadedProfile && verified.email) {
        const q = query(
          collection(db, 'users'),
          where('email', '==', verified.email.toLowerCase()),
          limit(1)
        );
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          loadedProfile = querySnap.docs[0].data() as UserProfile;
        }
      }
    } catch {
      // fallback to saved metadata if offline
    }

    if (!loadedProfile) {
      loadedProfile = {
        uid: verified.uid,
        email: verified.email || '',
        displayName: verified.displayName || 'Player',
        username: (
          verified.email?.split('@')[0] ||
          verified.phoneNumber ||
          'player_' + verified.uid.slice(0, 5)
        ).toLowerCase(),
        phoneNumber: verified.phoneNumber || '',
        freeFireUid: '',
        inGameName: verified.displayName || '',
        role: (verified.role as any) || 'PLAYER',
        walletBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        spentFromDeposited: 0,
        totalWithdrawn: 0,
        totalEarnings: 0,
        spentFromWinning: 0,
        totalKills: 0,
        totalWins: 0,
        totalMatches: 0,
        totalTournaments: 0,
        createdAt: verified.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    let resolvedBiometricRole = loadedProfile.role || 'PLAYER';
    let resolvedBiometricIsAdmin = isUserAdminAccount(loadedProfile);
    if (
      isAdminRole(resolvedBiometricRole) &&
      loadedProfile.email?.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL
    ) {
      try {
        const adminDocSnap = await getDoc(doc(db, 'admins', loadedProfile.uid));
        if (!adminDocSnap.metadata.fromCache && !adminDocSnap.exists()) {
          resolvedBiometricRole = 'PLAYER';
          resolvedBiometricIsAdmin = false;
        }
      } catch {
        // ignore offline check
      }
    }

    const hydratedProfile = hydrateProfileAvatar({
      ...loadedProfile,
      role: resolvedBiometricRole,
      isAdmin: resolvedBiometricIsAdmin,
    });
    if (!resolvedBiometricIsAdmin && isUserCurrentlyBanned(hydratedProfile)) {
      const banMsg = getBanErrorMessage(hydratedProfile);
      setActiveBiometricSession(null);
      setBiometricSession(null);
      setUserProfile(null);
      throw new Error(banMsg);
    }
    if (hydratedProfile.isBanned && !isUserCurrentlyBanned(hydratedProfile)) {
      unbanUserAccount({ targetUid: hydratedProfile.uid }).catch(() => {});
      hydratedProfile.isBanned = false;
      hydratedProfile.banReason = '';
      hydratedProfile.banDuration = '';
      hydratedProfile.banExpiresAt = null;
    }
    setBanAlertMessage(null);
    setActiveAdminSession(null);
    setLocalAdminSession(null);
    setActiveBiometricSession(hydratedProfile);
    setBiometricSession(hydratedProfile);
    setUserProfile(hydratedProfile);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    activeSessionNonceRef.current += 1;
    clearPlayerSession();
    setActiveAdminSession(null);
    setLocalAdminSession(null);
    setActiveBiometricSession(null);
    setBiometricSession(null);
    setPlayerSession(null);
    setFirebaseUser(null);
    setUserProfile(null);
    try {
      await signOut(auth);
    } catch {
      // ignore if signed in via local/biometric session only
    }
  };

  const updatePlayerProfile = async (data: Partial<UserProfile>) => {
    const activeProfile = userProfile || localAdminSession || biometricSession;
    if (!effectiveUser || !activeProfile) return;
    const userDocRef = doc(db, 'users', effectiveUser.uid);

    if (Object.prototype.hasOwnProperty.call(data, 'avatarUrl')) {
      saveUserAvatar(activeProfile, data.avatarUrl || '');
    }

    const safeData = {
      ...data,
      role: activeProfile.role,
      isAdmin: isUserAdminAccount(activeProfile, effectiveUser.email),
      walletBalance: activeProfile.walletBalance,
      pendingBalance: activeProfile.pendingBalance,
      totalDeposited: activeProfile.totalDeposited ?? 0,
      spentFromDeposited: activeProfile.spentFromDeposited ?? 0,
      totalEarnings: activeProfile.totalEarnings ?? 0,
      spentFromWinning: activeProfile.spentFromWinning ?? 0,
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...activeProfile, ...safeData };
    setUserProfile(updated);
    savePlayerSession(updated, true);
    if (playerSession) {
      setPlayerSession(updated);
    }
    if (localAdminSession?.uid === effectiveUser.uid) {
      setActiveAdminSession(updated);
      setLocalAdminSession(updated);
    }
    if (biometricSession?.uid === effectiveUser.uid) {
      setActiveBiometricSession(updated);
      setBiometricSession(updated);
    }

    try {
      await setDoc(userDocRef, updated, { merge: true });
      await syncLeaderboardEntry(updated);

      // If phone changed, update phoneAuthLookup
      if (updated.phoneNumber) {
        try {
          const normP = normalizeBDPhoneNumber(updated.phoneNumber);
          if (normP) {
            await setDoc(
              doc(db, 'phoneAuthLookup', normP),
              {
                phoneNumber: normP,
                authEmail: (updated.email || '').toLowerCase(),
                uid: effectiveUser.uid,
                username: (updated.username || '').toLowerCase(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        } catch {}
      }

      // If user is Admin, keep adminCredentials & publicAdmins in sync
      if (isUserAdminAccount(updated, effectiveUser.email)) {
        const cleanAdminName =
          (updated.displayName || 'Admin').trim().slice(0, 100) || 'Admin';
        const pubRef = doc(db, 'publicAdmins', effectiveUser.uid);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          const existingPubData = pubSnap.data();
          await setDoc(
            pubRef,
            {
              id: effectiveUser.uid,
              displayName: cleanAdminName,
              ...(existingPubData?.avatarId ? { avatarId: existingPubData.avatarId } : {}),
              createdAt:
                existingPubData?.createdAt ||
                updated.createdAt ||
                new Date().toISOString(),
            },
            { merge: true }
          );
        }

        // If phone changed for admin, update adminCredentials doc
        if (updated.phoneNumber) {
          try {
            const normPhone = normalizeBDPhoneNumber(updated.phoneNumber);
            const adminCredRef = doc(db, 'adminCredentials', normPhone);
            const adminCredSnap = await getDoc(adminCredRef);
            if (adminCredSnap.exists()) {
              await updateDoc(adminCredRef, {
                displayName: cleanAdminName,
                updatedAt: new Date().toISOString(),
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${effectiveUser.uid}`);
    }
  };

  const refreshProfile = async () => {
    if (!effectiveUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', effectiveUser.uid));
      if (snap.exists()) {
        const data = normalizeProfileAdminFlags(
          hydrateProfileAvatar(snap.data() as UserProfile),
          firebaseUser?.email
        );
        setUserProfile(data);
        if (playerSession?.uid === effectiveUser.uid) {
          savePlayerSession(data, true);
          setPlayerSession(data);
        }
        if (localAdminSession?.uid === effectiveUser.uid) {
          setActiveAdminSession(data);
          setLocalAdminSession(data);
        }
        if (biometricSession?.uid === effectiveUser.uid) {
          setActiveBiometricSession(data);
          setBiometricSession(data);
        }
      }
    } catch {
      if (localAdminSession) {
        setUserProfile(localAdminSession);
      } else if (biometricSession) {
        setUserProfile(biometricSession);
      }
    }
  };

  const rawResolvedProfile = userProfile || localAdminSession || biometricSession;
  const resolvedProfile = applyOptimisticWithdrawToProfile(
    applyOptimisticDeltasToProfile(rawResolvedProfile)
  );

  const isSuperAdmin = Boolean(
    effectiveUser &&
      resolvedProfile &&
      isUserSuperAdminAccount(resolvedProfile, firebaseUser?.email)
  );

  const isAdmin = Boolean(
    effectiveUser &&
      resolvedProfile &&
      isUserAdminAccount(resolvedProfile, firebaseUser?.email)
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser: effectiveUser,
        userProfile: resolvedProfile,
        loading,
        isAdmin,
        isSuperAdmin,
        loginWithEmail,
        loginWithFingerprint,
        loginAsAdmin,
        loginMainAdminWithGoogle,
        registerWithEmail,
        registerNewPlayer,
        loginWithGoogle,
        resetPassword,
        resetPlayerPassword,
        logout,
        updatePlayerProfile,
        refreshProfile,
        banAlertMessage,
        clearBanAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

