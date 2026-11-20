import React, { useState, useEffect } from 'react';
import { PlatformAnnouncement } from '../../types';
import {
  formatAnnouncementDateTime,
  markAnnouncementsAsSeen,
} from '../../services/announcementService';
import { NoticeListModal } from './NoticeListModal';
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface TopNoticeBannerProps {
  announcements: PlatformAnnouncement[];
  userId?: string | null;
  language?: string;
}

export const TopNoticeBanner: React.FC<TopNoticeBannerProps> = ({
  announcements,
  userId,
  language = 'bn',
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showAllModal, setShowAllModal] = useState<boolean>(false);

  const latestId = announcements[0]?.id;

  // Jump to newest notice whenever a new announcement is created
  useEffect(() => {
    if (latestId) {
      setCurrentIndex(0);
    }
  }, [latestId]);

  // Reset index if announcements list shrinks
  useEffect(() => {
    if (currentIndex >= announcements.length) {
      setCurrentIndex(0);
    }
  }, [announcements.length, currentIndex]);

  if (announcements.length === 0) {
    return null;
  }

  const currentNotice = announcements[currentIndex] || announcements[0];
  const totalCount = announcements.length;

  const handleOpenModal = () => {
    markAnnouncementsAsSeen(
      announcements.map((a) => a.id),
      userId
    );
    setShowAllModal(true);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % totalCount);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Latest Notice"
        onClick={handleOpenModal}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-white to-orange-50 dark:from-[#1D1202] dark:via-[#0D1428] dark:to-[#1D0909] border border-amber-400/75 dark:border-amber-500/55 hover:border-amber-500 dark:hover:border-amber-400 shadow-md dark:shadow-lg dark:shadow-amber-500/10 p-3.5 sm:p-4 transition-all cursor-pointer group"
      >
        {/* Subtle animated background glow accent */}
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-3">
          {/* Left: Megaphone Badge */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-black shadow-md shadow-amber-500/30 shrink-0">
              <Megaphone className="w-4.5 h-4.5 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-black font-gaming text-[10px] tracking-wider uppercase leading-none shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                NOTICE
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold mt-1">
                নতুন নোটিশ
              </span>
            </div>
          </div>

          {/* Middle: Newest Notice Content + Date/Time */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 sm:hidden">
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black font-gaming text-[9px] tracking-wider uppercase leading-none">
                NOTICE
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold truncate flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatAnnouncementDateTime(currentNotice.createdAt)}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors line-clamp-2 leading-relaxed">
              {currentNotice.content}
            </p>

            <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400">
              <span className="hidden sm:inline-flex items-center gap-1 text-amber-700 dark:text-amber-400/90 font-medium">
                <Clock className="w-3 h-3" />
                {formatAnnouncementDateTime(currentNotice.createdAt)}
              </span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-600">•</span>
              <span className="text-sky-600 dark:text-sky-400 group-hover:underline font-semibold">
                সব নোটিশ দেখুন ({totalCount})
              </span>
            </div>
          </div>

          {/* Right: Arrows / View All */}
          <div className="flex items-center gap-1.5 shrink-0">
            {totalCount > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center bg-white/95 dark:bg-[#111D35]/90 rounded-xl p-0.5 border border-slate-300 dark:border-slate-700/80"
              >
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous Notice"
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 px-1">
                  {currentIndex + 1}/{totalCount}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next Notice"
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenModal();
              }}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-[11px] font-bold font-gaming transition-all cursor-pointer"
            >
              <span>সব দেখুন</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: View All Notices with Date & Time */}
      <NoticeListModal
        isOpen={showAllModal}
        onClose={() => setShowAllModal(false)}
        announcements={announcements}
        language={language}
      />
    </>
  );
};
