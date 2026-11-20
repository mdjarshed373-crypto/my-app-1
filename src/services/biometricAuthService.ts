import { UserProfile } from '../types';

export const FINGERPRINT_USER_STORAGE_KEY = 'tx_fingerprint_user';
const ACTIVE_BIOMETRIC_SESSION_KEY = 'tx_active_biometric_session_v1';
const FINGERPRINT_ENABLED_KEY = 'tx_fingerprint_login_enabled_v1';
const BIOMETRIC_SETTINGS_EVENT = 'tx_biometric_settings_updated';

export interface StoredFingerprintUser {
  credentialId: string;
  email: string;
  identifier: string;
  phoneNumber?: string;
  uid: string;
  displayName: string;
  role: string;
  createdAt: string;
}

export interface BiometricAccountCandidate {
  uid: string;
  email: string;
  identifier: string;
  phoneNumber?: string;
  displayName: string;
  role?: string;
}

const NO_FINGERPRINT_SAVED_MSG =
  'No fingerprint saved, please login with password first';
const FINGERPRINT_NOT_MATCHED_MSG = 'Fingerprint not matched';

function emitBiometricSettingsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BIOMETRIC_SETTINGS_EVENT));
  }
}

export function subscribeBiometricSettings(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(BIOMETRIC_SETTINGS_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(BIOMETRIC_SETTINGS_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function isFingerprintLoginEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(FINGERPRINT_ENABLED_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setFingerprintLoginEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FINGERPRINT_ENABLED_KEY, enabled ? 'true' : 'false');
    emitBiometricSettingsChanged();
  } catch {
    // ignore storage errors
  }
}

export function getSavedFingerprintUser(): StoredFingerprintUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FINGERPRINT_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFingerprintUser;
    if (!parsed || !parsed.credentialId || (!parsed.email && !parsed.uid)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasSavedFingerprintForUser(
  account: Pick<BiometricAccountCandidate, 'uid' | 'email' | 'identifier'>
): boolean {
  const existing = getSavedFingerprintUser();
  if (!existing || !existing.credentialId) return false;

  if (account.uid && existing.uid === account.uid) return true;
  if (
    account.email &&
    existing.email &&
    existing.email.toLowerCase() === account.email.trim().toLowerCase()
  ) {
    return true;
  }
  if (
    account.identifier &&
    existing.identifier &&
    existing.identifier.toLowerCase() === account.identifier.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function getActiveBiometricSession(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_BIOMETRIC_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed || !parsed.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveBiometricSession(profile: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!profile) {
      window.localStorage.removeItem(ACTIVE_BIOMETRIC_SESSION_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_BIOMETRIC_SESSION_KEY,
        JSON.stringify(profile)
      );
    }
  } catch {
    // ignore storage errors
  }
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded =
    base64Url.replace(/-/g, '+').replace(/_/g, '/') +
    '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getRpEntity(): PublicKeyCredentialRpEntity {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const isIpAddress =
    !hostname ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':');

  return isIpAddress
    ? { name: 'TX TOUR BD' }
    : { name: 'TX TOUR BD', id: hostname };
}

function getRpIdOption(): { rpId?: string } {
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const isIpAddress =
    !hostname ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':');

  return isIpAddress ? {} : { rpId: hostname };
}

/**
 * Register device biometric credential using real WebAuthn navigator.credentials.create()
 * and save credentialId + user email in localStorage as "tx_fingerprint_user".
 */
export async function registerDeviceFingerprint(
  account: BiometricAccountCandidate
): Promise<StoredFingerprintUser> {
  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    !navigator.credentials ||
    typeof navigator.credentials.create !== 'function'
  ) {
    throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userEmailOrMobile =
    account.email?.trim() ||
    account.phoneNumber?.trim() ||
    account.identifier?.trim() ||
    account.uid;

  const userIdBuffer = new TextEncoder()
    .encode(account.uid || userEmailOrMobile)
    .slice(0, 64);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: getRpEntity(),
    user: {
      id: userIdBuffer,
      name: userEmailOrMobile,
      displayName: account.displayName?.trim() || userEmailOrMobile,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };

  let credential: PublicKeyCredential | null = null;
  try {
    credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential | null;
  } catch {
    throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
  }

  if (!credential || !credential.rawId) {
    throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
  }

  const credentialId = uint8ArrayToBase64Url(new Uint8Array(credential.rawId));
  const savedRecord: StoredFingerprintUser = {
    credentialId,
    email: account.email?.trim() || userEmailOrMobile,
    identifier: account.identifier?.trim() || userEmailOrMobile,
    phoneNumber: account.phoneNumber?.trim() || '',
    uid: account.uid,
    displayName: account.displayName?.trim() || userEmailOrMobile,
    role: account.role || 'PLAYER',
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    FINGERPRINT_USER_STORAGE_KEY,
    JSON.stringify(savedRecord)
  );
  setFingerprintLoginEnabled(true);
  emitBiometricSettingsChanged();

  return savedRecord;
}

/**
 * Verify saved fingerprint credential using real WebAuthn navigator.credentials.get()
 * to trigger the real system fingerprint / Face ID popup.
 */
export async function authenticateWithSavedFingerprint(): Promise<StoredFingerprintUser> {
  const saved = getSavedFingerprintUser();
  if (!saved || !saved.credentialId) {
    throw new Error(NO_FINGERPRINT_SAVED_MSG);
  }

  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    !navigator.credentials ||
    typeof navigator.credentials.get !== 'function'
  ) {
    throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    ...getRpIdOption(),
    allowCredentials: [
      {
        type: 'public-key',
        id: base64UrlToUint8Array(saved.credentialId),
        transports: ['internal'],
      },
    ],
    userVerification: 'required',
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey });
    if (!assertion) {
      throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
    }
    return saved;
  } catch {
    throw new Error(FINGERPRINT_NOT_MATCHED_MSG);
  }
}
