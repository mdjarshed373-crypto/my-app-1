import { UserProfile } from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'mdjarshed373@gmail.com';

export function isAdminRole(role?: string | null): boolean {
  const normalized = String(role || '').trim().toUpperCase();
  return (
    normalized === 'ADMIN' ||
    normalized === 'SUPER_ADMIN' ||
    normalized === 'MODERATOR'
  );
}

export function isSuperAdminRole(role?: string | null): boolean {
  return String(role || '').trim().toUpperCase() === 'SUPER_ADMIN';
}

export function isUserSuperAdminAccount(
  profile?: Partial<UserProfile> | null,
  authEmail?: string | null
): boolean {
  if (!profile) return false;
  if (isSuperAdminRole(profile.role)) return true;

  const effectiveEmail = (authEmail || '').trim().toLowerCase();
  if (effectiveEmail === BOOTSTRAP_ADMIN_EMAIL) {
    return true;
  }

  return false;
}

export function isUserAdminAccount(
  profile?: Partial<UserProfile> | null,
  authEmail?: string | null
): boolean {
  if (!profile) return false;
  if (isUserSuperAdminAccount(profile, authEmail)) return true;

  // Explicit isAdmin === true grants admin access; explicit isAdmin === false with non-admin role denies it
  if (profile.isAdmin === true) return true;
  if (isAdminRole(profile.role)) return true;

  return false;
}

export function normalizeProfileAdminFlags(
  profile: UserProfile,
  authEmail?: string | null
): UserProfile {
  const adminFlag = isUserAdminAccount(profile, authEmail);
  return {
    ...profile,
    isAdmin: adminFlag,
  };
}
