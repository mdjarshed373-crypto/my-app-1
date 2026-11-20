import React, { useState, useEffect } from 'react';
import { PlatformAnnouncement, Tournament } from '../../types';
import {
  subscribeAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  formatAnnouncementTime,
} from '../../services/announcementService';
import {
  Megaphone,
  Send,
  Trash2,
  Users,
  Trophy,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface SendAnnouncementSectionProps {
  tournaments: Tournament[];
  adminEmail?: string;
}

export const SendAnnouncementSection: React.FC<SendAnnouncementSectionProps> = ({
  tournaments,
  adminEmail,
}) => {
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'ALL_USERS' | 'TOURNAMENT'>(
    'ALL_USERS'
  );
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);

  useEffect(() => {
    const unsub = subscribeAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (
      targetType === 'TOURNAMENT' &&
      !selectedTournamentId &&
      tournaments.length > 0
    ) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [targetType, selectedTournamentId, tournaments]);

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setStatusFeedback({
        type: 'error',
        text: 'Please type an announcement message.',
      });
      return;
    }

    if (targetType === 'TOURNAMENT' && !selectedTournamentId) {
      setStatusFeedback({
        type: 'error',
        text: 'Please select a tournament.',
      });
      return;
    }

    const selectedTour = tournaments.find((t) => t.id === selectedTournamentId);
    setSending(true);
    setStatusFeedback(null);

    try {
      await createAnnouncement({
        content: trimmed,
        targetType,
        tournamentId:
          targetType === 'TOURNAMENT' ? selectedTournamentId : undefined,
        tournamentTitle:
          targetType === 'TOURNAMENT' ? selectedTour?.title : undefined,
        createdBy: adminEmail,
      });

      setMessage('');
      setStatusFeedback({
        type: 'success',
        text:
          targetType === 'TOURNAMENT' && selectedTour
            ? `Announcement sent for "${selectedTour.title}"!`
            : 'Announcement sent to All Users!',
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: err?.message || 'Failed to send announcement.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      aria-label="Send Announcement"
      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-sky-200 dark:border-sky-500/25 space-y-5 shadow-lg dark:shadow-xl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-600/15 border border-red-200 dark:border-red-500/35 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black font-gaming uppercase tracking-wider text-slate-900 dark:text-white">
              Send Announcement
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Send instant tournament notices to All Users or a Specific Tournament
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 text-[11px] font-bold font-gaming text-sky-600 dark:text-sky-400 self-start sm:self-auto">
          {announcements.length} Active
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSendAnnouncement} className="space-y-4 text-xs">
        {/* Target Selector: Send to All Users OR Send to Specific Tournament */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2 uppercase tracking-wide">
            Select Audience *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTargetType('ALL_USERS')}
              className={`px-4 py-3 rounded-xl border font-bold font-gaming text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                targetType === 'ALL_USERS'
                  ? 'bg-sky-50 border-sky-500 text-sky-900 dark:bg-sky-500/20 dark:border-sky-400 dark:text-white shadow-md shadow-sky-500/15'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-[#111D35] dark:border-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Users
                className={`w-4 h-4 shrink-0 ${
                  targetType === 'ALL_USERS' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <span>Send to All Users</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('TOURNAMENT')}
              className={`px-4 py-3 rounded-xl border font-bold font-gaming text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                targetType === 'TOURNAMENT'
                  ? 'bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-500/20 dark:border-amber-400 dark:text-white shadow-md shadow-amber-500/15'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-[#111D35] dark:border-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Trophy
                className={`w-4 h-4 shrink-0 ${
                  targetType === 'TOURNAMENT'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <span>Send to Specific Tournament</span>
            </button>
          </div>
        </div>

        {/* Specific Tournament Dropdown */}
        {targetType === 'TOURNAMENT' && (
          <div>
            <label className="block text-amber-700 dark:text-amber-300 font-bold mb-1.5 uppercase tracking-wide">
              Select Specific Tournament *
            </label>
            {tournaments.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                No tournaments created yet. Create a tournament first or choose
                Send to All Users.
              </div>
            ) : (
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500 dark:focus:border-amber-400"
              >
                {tournaments.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title} ({tour.matchDate} • {tour.matchTime})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Message Textarea */}
        <div>
          <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 uppercase tracking-wide">
            Announcement Message *
          </label>
          <textarea
            rows={3}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Slot khali ache, sobai join koro / Match e problem hoise, 10 min deri hobe"
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm font-medium focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 resize-y"
          />
        </div>

        {/* Feedback Banner */}
        {statusFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              statusFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/35 dark:text-emerald-300'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-500/35 dark:text-red-300'
            }`}
          >
            {statusFeedback.type === 'success' && (
              <CheckCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusFeedback.text}</span>
          </div>
        )}

        {/* Send Button */}
        <div>
          <button
            type="submit"
            disabled={
              sending ||
              !message.trim() ||
              (targetType === 'TOURNAMENT' && tournaments.length === 0)
            }
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 disabled:opacity-50 text-white font-black font-gaming text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </form>

      {/* Active Announcements List with Delete Button */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Published Announcements ({announcements.length})
          </h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Visible to users until deleted
          </span>
        </div>

        {announcements.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            No announcements published yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((ann) => {
              const isTournamentTarget =
                ann.targetType === 'TOURNAMENT' && Boolean(ann.tournamentTitle);
              return (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-gaming uppercase ${
                          isTournamentTarget
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/30'
                            : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-500/30'
                        }`}
                      >
                        {isTournamentTarget ? (
                          <>
                            <Trophy className="w-3 h-3" />
                            <span>{ann.tournamentTitle}</span>
                          </>
                        ) : (
                          <>
                            <Users className="w-3 h-3" />
                            <span>All Users</span>
                          </>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                        <span>{formatAnnouncementTime(ann.createdAt)}</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words">
                      {ann.content}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id)}
                    disabled={deletingId === ann.id}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 font-bold font-gaming text-[11px] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deletingId === ann.id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
