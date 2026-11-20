import React, { useState } from 'react';
import { AppNotification, PlatformAnnouncement } from '../../types';
import { formatAnnouncementDateTime } from '../../services/announcementService';
import {
  BrowserNotificationPermissionState,
  ensureWebPushSubscribed,
  getNotificationPermissionState,
  requestBrowserNotificationPermission,
} from '../../services/pushNotificationService';
import {
  Bell,
  BellRing,
  Megaphone,
  Clock,
  Calendar,
  Trophy,
  Users,
  KeyRound,
  ArrowRight,
  X,
} from 'lucide-react';
import { useLockBodyScroll } from '../../utils/scrollLock';

interface NoticeListModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: PlatformAnnouncement[];
  notifications?: AppNotification[];
  language?: string;
  userId?: string;
  onNotificationClick?: (notification: AppNotification) => void;
}

export const NoticeListModal: React.FC<NoticeListModalProps> = ({
  isOpen,
  onClose,
  announcements,
  notifications = [],
  language = 'bn',
  userId,
  onNotificationClick,
}) => {
  useLockBodyScroll(isOpen);
  const [permState, setPermState] = useState<BrowserNotificationPermissionState>(() =>
    getNotificationPermissionState()
  );

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    const next = await requestBrowserNotificationPermission(userId);
    setPermState(next);
    if (next === 'granted' && userId) {
      await ensureWebPushSubscribed(userId);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-list-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-[#0A0E1C] border-2 border-amber-400/70 dark:border-amber-500/45 rounded-3xl shadow-2xl shadow-slate-900/20 dark:shadow-amber-500/15 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Top metallic gold gradient bar */}
        <div className="h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600" />

        {/* Header */}
        <div className="p-4 sm:p-5 pb-3.5 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1428]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/25 shrink-0">
              <Megaphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2
                id="notice-list-modal-title"
                className="text-base sm:text-lg font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wider"
              >
                Notifications &amp; Notice List
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                রুম কোড নোটিফিকেশন ও Admin নোটিশ সমূহ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Notice List"
            className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#111D35] dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-[#0A0E1C]">
          {/* Browser/Phone Push Notification Permission Prompt */}
          {permState === 'default' && (
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <BellRing className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                    ফোনে Room Code Push Notification চালু করুন
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    রুম আইডি ও পাসওয়ার্ড দিলে সাথে সাথে ফোনের নোটিফিকেশন বারে এলার্ট পাবেন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold font-gaming text-[11px] uppercase tracking-wider cursor-pointer shrink-0 shadow-md"
              >
                Allow Notification
              </button>
            </div>
          )}

          {/* Personal Match & Room Code Notifications (Shown First When Available) */}
          {notifications.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  <span>My Match Notifications</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {notifications.length} items
                </span>
              </div>

              <div className="space-y-2">
                {notifications.slice(0, 12).map((n) => {
                  const isRoomNotif =
                    n.title?.toLowerCase().includes('room') ||
                    Boolean(n.link && n.link.includes('tab=room'));
                  const isClickable = Boolean(n.link && onNotificationClick);

                  return (
                    <button
                      key={n.id}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => {
                        if (isClickable && onNotificationClick) {
                          onNotificationClick(n);
                        }
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all ${
                        isRoomNotif
                          ? 'bg-gradient-to-br from-sky-50 via-white to-amber-50/70 dark:from-[#0E1E3A] dark:via-[#111D35] dark:to-[#18160B] border-sky-400/80 dark:border-sky-400/50 shadow-md'
                          : 'bg-slate-50 dark:bg-[#111D35]/70 border-slate-200 dark:border-slate-800'
                      } ${
                        isClickable
                          ? 'hover:border-amber-500 dark:hover:border-amber-400 cursor-pointer active:scale-[0.99]'
                          : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isRoomNotif && (
                            <span className="w-6 h-6 rounded-lg bg-sky-600/15 dark:bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-600 dark:text-sky-300 shrink-0">
                              <KeyRound className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className="font-black text-slate-900 dark:text-white truncate">
                            {language === 'bn' ? n.titleBn || n.title : n.title}
                          </span>
                        </div>
                        {n.createdAt && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatAnnouncementDateTime(n.createdAt)}
                          </span>
                        )}
                      </div>

                      <p className="text-[11.5px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                        {language === 'bn' ? n.messageBn || n.message : n.message}
                      </p>

                      {isClickable && (
                        <div className="pt-1 flex items-center justify-end">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] text-black font-black font-gaming text-[10px] uppercase tracking-wider shadow-sm">
                            <span>{isRoomNotif ? 'Open Room' : 'View'}</span>
                            <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin Notices List */}
          <div className={notifications.length > 0 ? 'pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5' : 'space-y-3'}>
            {notifications.length > 0 && (
              <span className="text-[11px] font-bold font-gaming uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Admin Notices</span>
              </span>
            )}

            {announcements.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-slate-50 dark:bg-[#111D35]/70 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'বর্তমানে কোনো Admin নোটিশ নেই' : 'No admin notices available right now'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Admin নতুন কোনো নোটিশ পাঠালে এখানে দেখাবে।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann, idx) => {
                  const isTournament =
                    ann.targetType === 'TOURNAMENT' && Boolean(ann.tournamentTitle);

                  return (
                    <div
                      key={ann.id}
                      className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
                        idx === 0
                          ? 'bg-gradient-to-br from-amber-50 via-white to-amber-50/70 dark:from-[#191306] dark:via-[#111D35] dark:to-[#111D35] border-amber-400/75 dark:border-amber-500/45 shadow-md shadow-amber-500/10'
                          : 'bg-slate-50 dark:bg-[#111D35] border-slate-200 dark:border-slate-800 hover:border-sky-400/60 dark:hover:border-sky-500/35'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black font-gaming uppercase tracking-wider">
                              LATEST
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold font-gaming uppercase tracking-wider border ${
                              isTournament
                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-500/35'
                                : 'bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/35'
                            }`}
                          >
                            {isTournament ? (
                              <>
                                <Trophy className="w-3 h-3 shrink-0" />
                                <span>{ann.tournamentTitle}</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-3 h-3 shrink-0" />
                                <span>Admin Notice</span>
                              </>
                            )}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-white dark:bg-[#0A0E1C] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                          <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>{formatAnnouncementDateTime(ann.createdAt)}</span>
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
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D1428] flex items-center justify-between gap-3">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            মোট নোটিফিকেশন:{' '}
            <strong className="text-amber-600 dark:text-amber-400">
              {notifications.length + announcements.length}
            </strong>{' '}
            টি
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] text-black font-black font-gaming text-xs tracking-wider uppercase cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
