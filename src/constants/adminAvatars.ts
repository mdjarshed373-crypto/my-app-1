export interface AdminCartoonAvatar {
  id: string;
  label: string;
  url: string;
}

export const ADMIN_CARTOON_AVATARS: AdminCartoonAvatar[] = [
  {
    id: 'avatar_1',
    label: 'Crown Striker',
    url: '/assets/admin-avatars/avatar_1.jpg',
  },
  {
    id: 'avatar_2',
    label: 'Red Beret Sniper',
    url: '/assets/admin-avatars/avatar_2.jpg',
  },
  {
    id: 'avatar_3',
    label: 'Cyber Ninja',
    url: '/assets/admin-avatars/avatar_3.jpg',
  },
  {
    id: 'avatar_4',
    label: 'Neon Sharpshooter',
    url: '/assets/admin-avatars/avatar_4.jpg',
  },
  {
    id: 'avatar_5',
    label: 'Flame Oni',
    url: '/assets/admin-avatars/avatar_5.jpg',
  },
  {
    id: 'avatar_6',
    label: 'Squad Captain',
    url: '/assets/admin-avatars/avatar_6.jpg',
  },
  {
    id: 'avatar_7',
    label: 'Gold Rusher',
    url: '/assets/admin-avatars/avatar_7.jpg',
  },
  {
    id: 'avatar_8',
    label: 'Wolf Clan',
    url: '/assets/admin-avatars/avatar_8.jpg',
  },
];

export function resolveAdminAvatarId(
  avatarId?: string | null,
  fallbackIndex: number = 0
): string {
  if (avatarId && ADMIN_CARTOON_AVATARS.some((a) => a.id === avatarId)) {
    return avatarId;
  }
  const safeIndex = Math.abs(fallbackIndex) % ADMIN_CARTOON_AVATARS.length;
  return ADMIN_CARTOON_AVATARS[safeIndex].id;
}

export function getAdminAvatarUrl(
  avatarId?: string | null,
  fallbackIndex: number = 0
): string {
  const resolvedId = resolveAdminAvatarId(avatarId, fallbackIndex);
  return (
    ADMIN_CARTOON_AVATARS.find((a) => a.id === resolvedId)?.url ||
    ADMIN_CARTOON_AVATARS[0].url
  );
}

/**
 * Picks a Cartoon Avatar ID that is not currently used by any existing admin.
 */
export function pickNextUniqueAdminAvatarId(
  existingAdmins: Array<{ avatarId?: string | null }>,
  preferredAvatarId?: string | null
): string {
  const usedIds = new Set<string>();
  existingAdmins.forEach((admin, idx) => {
    usedIds.add(resolveAdminAvatarId(admin.avatarId, idx));
  });

  if (
    preferredAvatarId &&
    ADMIN_CARTOON_AVATARS.some((a) => a.id === preferredAvatarId) &&
    !usedIds.has(preferredAvatarId)
  ) {
    return preferredAvatarId;
  }

  const unused = ADMIN_CARTOON_AVATARS.find((a) => !usedIds.has(a.id));
  if (unused) {
    return unused.id;
  }

  return ADMIN_CARTOON_AVATARS[existingAdmins.length % ADMIN_CARTOON_AVATARS.length].id;
}
