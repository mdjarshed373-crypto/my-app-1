import React from 'react';
import { PlatformAnnouncement } from '../../types';
import { formatAnnouncementTime } from '../../services/announcementService';
import { Megaphone, Clock, Trophy, Users } from 'lucide-react';

interface NoticeBoardSectionProps {
  announcements: PlatformAnnouncement[];
  id?: string;
  className?: string;
}

export const NoticeBoardSection: React.FC<NoticeBoardSectionProps> = ({
  announcements,
  id,
  className = '',
}) => {
  return (
    <section
      id={id}
      aria-label="Notice Board"
      className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0D1428] border border-sky-200 dark:border-sky-500/25 shadow-lg dark:shadow-xl space-y-3.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-slate-800/90">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-600/15 border border-red-200 dark:border-red-500/35 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black font-gaming tracking-wide text-slate-900 dark:text-white uppercase">
              Notice Board
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Latest tournament notices & admin announcements
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 text-[11px] font-bold font-gaming text-sky-600 dark:text-sky-400 shrink-0">
          {announcements.length} {announcements.length === 1 ? 'Notice' : 'Notices'}
        </span>
      </div>

      {announcements.length === 0 ? (
        <div className="py-5 px-4 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            No active announcements right now. Important match updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
          {announcements.map((ann) => {
            const isTournamentTarget =
              ann.targetType === 'TOURNAMENT' && Boolean(ann.tournamentTitle);

            return (
              <div
                key={ann.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 hover:border-sky-400/60 dark:hover:border-sky-500/35 transition-colors space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold font-gaming uppercase tracking-wider border ${
                      isTournamentTarget
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30'
                        : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/30'
                    }`}
                  >
                    {isTournamentTarget ? (
                      <>
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span>{ann.tournamentTitle}</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 shrink-0" />
                        <span>All Users</span>
                      </>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>{formatAnnouncementTime(ann.createdAt)}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed whitespace-pre-line break-words">
                  {ann.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
