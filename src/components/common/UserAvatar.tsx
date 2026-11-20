import React, { useEffect, useState } from 'react';
import {
  AvatarUserLike,
  getSavedUserAvatar,
  getSingleUserInitial,
  subscribeAvatarUpdates,
} from '../../services/avatarStorageService';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  user?: AvatarUserLike | null;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, { outer: string; text: string }> = {
  xs: { outer: 'w-7 h-7 p-[1.5px]', text: 'text-xs' },
  sm: { outer: 'w-9 h-9 p-[2px]', text: 'text-sm' },
  md: { outer: 'w-11 h-11 p-[2px]', text: 'text-base' },
  lg: { outer: 'w-16 h-16 p-[2.5px]', text: 'text-2xl' },
  xl: { outer: 'w-28 h-28 sm:w-32 sm:h-32 p-[3px]', text: 'text-4xl sm:text-5xl' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  className = '',
}) => {
  const [, setTick] = useState(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    return subscribeAvatarUpdates(() => {
      setImgError(false);
      setTick((t) => t + 1);
    });
  }, []);

  const avatarSrc = getSavedUserAvatar(user);
  const initial = getSingleUserInitial(user);
  const sizeSpec = SIZE_CLASSES[size];

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  return (
    <div
      className={`rounded-full bg-gradient-to-tr from-blue-600 via-sky-400 to-cyan-300 shrink-0 shadow-md ${sizeSpec.outer} ${className}`}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-[#080D1B] flex items-center justify-center">
        {avatarSrc && !imgError ? (
          <img
            src={avatarSrc}
            alt={user?.displayName || user?.inGameName || 'User'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span
            className={`font-black font-gaming text-white uppercase select-none leading-none ${sizeSpec.text}`}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
};
