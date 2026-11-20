import React, { useState, useEffect, useRef } from 'react';
import { PlatformAnnouncement } from '../../types';
import {
  subscribeAnnouncements,
  formatAnnouncementTime,
} from '../../services/announcementService';
import { Bell, Clock, Trophy, Users, X } from 'lucide-react';
import { useLockBodyScroll, forceResetBodyScroll } from '../../utils/scrollLock';

interface AnnouncementPopupModalProps {
  currentPage: string;
}

const DISMISSED_STORAGE_KEY = 'tx_dismissed_announcement_popups';
const RECENT_WINDOW_MS = 45000;

function getDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function markIdDismissed(id: string): void {
  try {
    const current = getDismissedIds();
    current.add(id);
    sessionStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {
    // ignore storage errors
  }
}

export const AnnouncementPopupModal: React.FC<AnnouncementPopupModalProps> = ({
  currentPage,
}) => {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [activePopup, setActivePopup] = useState<PlatformAnnouncement | null>(
    null
  );
  const initializedRef = useRef<boolean>(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeAnnouncements((list) => {
      setAnnouncements(list);
      const dismissed = getDismissedIds();

      if (!initializedRef.current) {
        initializedRef.current = true;
        list.forEach((item) => knownIdsRef.current.add(item.id));

        // Also catch very recent un-dismissed announcement (e.g., sent moments ago before returning to Home)
        const now = Date.now();
        const recentUnread = list.find((item) => {
          if (dismissed.has(item.id)) return false;
          const createdMs = new Date(item.createdAt).getTime();
          return !Number.isNaN(createdMs) && now - createdMs <= RECENT_WINDOW_MS;
        });

        if (recentUnread && currentPage !== 'admin') {
          setActivePopup(recentUnread);
        }
        return;
      }

      // Live update after initial load: find newest item that wasn't known before
      const newlyArrived = list.find((item) => !knownIdsRef.current.has(item.id));
      list.forEach((item) => knownIdsRef.current.add(item.id));

      if (newlyArrived && !dismissed.has(newlyArrived.id)) {
        setActivePopup(newlyArrived);
      } else {
        // If currently displayed popup was deleted by admin, close it immediately
        setActivePopup((prev) =>
          prev && !list.some((item) => item.id === prev.id) ? null : prev
        );
      }
    });

    return () => unsub();
  }, []);

  // When navigating out of admin panel, check if a newly created un-dismissed announcement is waiting
  useEffect(() => {
    if (currentPage === 'admin' || activePopup || announcements.length === 0) {
      return;
    }
    const dismissed = getDismissedIds();
    const now = Date.now();
    const recentUnread = announcements.find((item) => {
      if (dismissed.has(item.id)) return false;
      const createdMs = new Date(item.createdAt).getTime();
      return !Number.isNaN(createdMs) && now - createdMs <= RECENT_WINDOW_MS;
    });
    if (recentUnread) {
      setActivePopup(recentUnread);
    }
  }, [currentPage, announcements, activePopup]);

  useLockBodyScroll(Boolean(activePopup && currentPage !== 'admin'));

  const handleDismiss = () => {
    if (activePopup) {
      markIdDismissed(activePopup.id);
    }
    forceResetBodyScroll();
    setActivePopup(null);
  };

  useEffect(() => {
    if (!activePopup || currentPage === 'admin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePopup, currentPage]);

  if (!activePopup || currentPage === 'admin') return null;

  const isTournamentTarget =
    activePopup.targetType === 'TOURNAMENT' &&
    Boolean(activePopup.tournamentTitle);

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-announcement-title"
        className="w-full max-w-md bg-white dark:bg-[#0D1428] border border-red-300 dark:border-red-500/45 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-600/20 border border-red-200 dark:border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="live-announcement-title"
                className="text-sm sm:text-base font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide"
              >
                New Announcement
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>{formatAnnouncementTime(activePopup.createdAt)}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close announcement popup"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Audience Badge */}
        <div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold font-gaming uppercase tracking-wider border ${
              isTournamentTarget
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/35'
                : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/35'
            }`}
          >
            {isTournamentTarget ? (
              <>
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span>{activePopup.tournamentTitle}</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>All Users</span>
              </>
            )}
          </span>
        </div>

        {/* Message Body */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800">
          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed whitespace-pre-line break-words">
            {activePopup.content}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full min-h-[44px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black font-gaming text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-red-600/25 transition-all cursor-pointer"
        >
          Okay
        </button>
      </div>
    </div>
  );
};
