const USER_AVATARS_STORAGE_KEY = 'tx_user_avatars_v1';
const USER_AVATAR_UPDATED_EVENT = 'tx_user_avatar_updated';

export interface AvatarUserLike {
  uid?: string;
  email?: string;
  phoneNumber?: string;
  username?: string;
  displayName?: string;
  inGameName?: string;
  avatarUrl?: string;
}

function normalizePhoneKey(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('880') && digits.length >= 13) {
    return '0' + digits.slice(3);
  }
  return digits;
}

function getAccountLookupKeys(user?: AvatarUserLike | null): string[] {
  if (!user) return [];
  const keys: string[] = [];
  if (user.uid && user.uid.trim()) {
    keys.push(`uid:${user.uid.trim()}`);
  }
  if (user.email && user.email.trim()) {
    keys.push(`email:${user.email.trim().toLowerCase()}`);
  }
  const normPhone = normalizePhoneKey(user.phoneNumber);
  if (normPhone) {
    keys.push(`phone:${normPhone}`);
  }
  if (user.username && user.username.trim()) {
    keys.push(`username:${user.username.trim().toLowerCase()}`);
  }
  return keys;
}

function readAvatarMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USER_AVATARS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAvatarMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_AVATARS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(USER_AVATAR_UPDATED_EVENT));
  } catch {
    // Handle storage quota exceeded by pruning oldest unrelated keys if necessary
    try {
      const entries = Object.entries(map);
      if (entries.length > 8) {
        const trimmed = Object.fromEntries(entries.slice(-8));
        window.localStorage.setItem(USER_AVATARS_STORAGE_KEY, JSON.stringify(trimmed));
        window.dispatchEvent(new CustomEvent(USER_AVATAR_UPDATED_EVENT));
      }
    } catch {
      // Ignore unrecoverable storage error
    }
  }
}

/**
 * Retrieve saved base64 profile photo for a specific user account from localStorage.
 * Persists across logouts, refreshes, and switching between password / fingerprint / admin logins.
 */
export function getSavedUserAvatar(user?: AvatarUserLike | null): string {
  if (!user) return '';
  const map = readAvatarMap();
  const keys = getAccountLookupKeys(user);
  for (const key of keys) {
    const val = map[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val;
    }
  }
  return typeof user.avatarUrl === 'string' ? user.avatarUrl.trim() : '';
}

/**
 * Save base64 profile photo in localStorage for that user account (keyed by uid, email, phone, username).
 */
export function saveUserAvatar(user: AvatarUserLike, base64DataUrl: string): void {
  const cleanUrl = (base64DataUrl || '').trim();
  const keys = getAccountLookupKeys(user);
  if (keys.length === 0) return;

  const map = readAvatarMap();
  if (!cleanUrl) {
    for (const key of keys) {
      delete map[key];
    }
  } else {
    for (const key of keys) {
      map[key] = cleanUrl;
    }
  }
  writeAvatarMap(map);
}

/**
 * Subscribe to instant avatar changes across all mounted components.
 */
export function subscribeAvatarUpdates(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(USER_AVATAR_UPDATED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(USER_AVATAR_UPDATED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Extract a clean single uppercase letter for users without a profile photo (e.g., "M" for "Md.Jarshed").
 */
export function getSingleUserInitial(user?: AvatarUserLike | null): string {
  if (!user) return 'U';
  const candidate =
    user.displayName?.trim() ||
    user.inGameName?.trim() ||
    user.email?.trim() ||
    user.username?.trim() ||
    'U';
  const match = candidate.match(/[A-Za-z0-9\u0980-\u09FF]/);
  const firstChar = match ? match[0] : candidate.charAt(0) || 'U';
  return firstChar.toUpperCase();
}
