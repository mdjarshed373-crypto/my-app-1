import React, { useState, useEffect } from 'react';
import { PlatformAnnouncement, Tournament } from '../../types';
import {
  subscribeAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  formatAnnouncementTime,
} from '../../services/announcementService';
import { fetchTournaments } from '../../services/tournamentService';
import {
  Megaphone,
  Send,
  Trash2,
  Users,
  Trophy,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface NoticeManagerSectionProps {
  onClose?: () => void;
  adminEmail?: string;
}

const QUICK_SUGGESTIONS = [
  'আজকের স্পেশাল টুর্নামেন্ট রাত ৯:০০ টায় শুরু হবে!',
  'রুম আইডি এবং পাসওয়ার্ড ম্যাচ শুরুর ১৫ মিনিট পূর্বে প্রকাশ করা হবে।',
  'সকল উইনারদের প্রাইজ মানি ওয়ালেটে যুক্ত করা হয়েছে।',
  'সতর্কতা: হ্যাকিং বা টিমিং করলে একাউন্ট স্থায়ীভাবে ব্যান করা হবে!',
];

export const NoticeManagerSection: React.FC<NoticeManagerSectionProps> = ({
  onClose,
  adminEmail,
}) => {
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'ALL_USERS' | 'TOURNAMENT'>('ALL_USERS');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);

  // Real-time subscription to notices in Firestore
  useEffect(() => {
    const unsub = subscribeAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  // Fetch tournaments if admin wants to target a specific tournament
  useEffect(() => {
    fetchTournaments()
      .then((list) => {
        setTournaments(list);
        if (list.length > 0) {
          setSelectedTournamentId((prev) => prev || list[0].id);
        }
      })
      .catch(() => {
        // non-blocking
      });
  }, []);

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setFeedback({
        type: 'error',
        text: 'অনুগ্রহ করে নোটিশের মেসেজটি লিখুন।',
      });
      return;
    }

    if (targetType === 'TOURNAMENT' && !selectedTournamentId) {
      setFeedback({
        type: 'error',
        text: 'অনুগ্রহ করে একটি টুর্নামেন্ট সিলেক্ট করুন।',
      });
      return;
    }

    const selectedTour = tournaments.find((t) => t.id === selectedTournamentId);
    setSending(true);
    setFeedback(null);

    try {
      await createAnnouncement({
        content: trimmed,
        targetType,
        tournamentId: targetType === 'TOURNAMENT' ? selectedTournamentId : undefined,
        tournamentTitle: targetType === 'TOURNAMENT' ? selectedTour?.title : undefined,
        createdBy: adminEmail || 'Admin',
      });

      setContent('');
      setFeedback({
        type: 'success',
        text: 'নোটিশ সফলভাবে পাঠানো হয়েছে! এটি এখন সকল ইউজারের হোম পেজের উপরে দেখা যাচ্ছে।',
      });

      // Clear success feedback after 5 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'নোটিশ পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
      setFeedback({
        type: 'success',
        text: 'নোটিশটি সফলভাবে মুছে ফেলা হয়েছে।',
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'নোটিশ মুছতে ব্যর্থ হয়েছে।',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleApplySuggestion = (text: string) => {
    setContent(text);
  };

  return (
    <div
      role="region"
      aria-label="Notice Manager"
      className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#0D1428] border-2 border-amber-400/75 dark:border-amber-500/50 shadow-xl dark:shadow-2xl dark:shadow-amber-500/10 space-y-6 animate-in fade-in duration-200"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/25 shrink-0">
            <Megaphone className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black font-gaming uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <span>Send Notice / Notice</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-bold">
                নোটিশ পাঠান
              </span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              এখানে নোটিশ পাঠালে তা সাথে সাথে সকল ইউজারের হোম পেজের উপরে দেখা যাবে
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Notice Manager"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#111D35] dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Status Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs sm:text-sm animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/50 dark:text-emerald-200 shadow-md dark:shadow-emerald-900/20'
              : 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/70 dark:border-red-500/50 dark:text-red-200 shadow-md dark:shadow-red-900/20'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <span className="font-semibold leading-relaxed">{feedback.text}</span>
        </div>
      )}

      {/* Compose Notice Form */}
      <form onSubmit={handleSendNotice} className="space-y-4">
        {/* Quick Suggestion Chips */}
        <div>
          <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>দ্রুত সাজেস্ট করা নোটিশ (Quick Fill)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplySuggestion(item)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-amber-50 dark:bg-[#111D35] dark:hover:bg-[#1a2b4f] border border-amber-300/70 dark:border-amber-500/25 hover:border-amber-500 dark:hover:border-amber-400 text-[11px] text-slate-700 hover:text-amber-900 dark:text-slate-300 dark:hover:text-amber-300 text-left transition-colors cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              নোটিশ মেসেজ লিখুন (Notice Message) *
            </label>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {content.length} / 500
            </span>
          </div>
          <textarea
            required
            rows={3}
            maxLength={500}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="এখানে আপনার নোটিশ লিখুন... যেমনঃ 'আজকে রাত ৯টায় ফ্রি ফায়ার স্পেশাল টুর্নামেন্ট শুরু হবে, সবাই প্রস্তুত থাকুন!'"
            className="w-full p-3.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-2xl text-slate-900 dark:text-white text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all leading-relaxed"
          />
        </div>

        {/* Target Audience Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            টার্গেট ইউজার (Target Audience)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTargetType('ALL_USERS')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                targetType === 'ALL_USERS'
                  ? 'bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-500/15 dark:border-amber-500 dark:text-amber-300 shadow-md shadow-amber-500/10'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-[#111D35] dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block text-slate-900 dark:text-white">
                  📢 সকল ইউজার (Home Page)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  হোম পেজের উপরে সকল প্লেয়ার দেখতে পারবে
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('TOURNAMENT')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                targetType === 'TOURNAMENT'
                  ? 'bg-sky-50 border-sky-500 text-sky-900 dark:bg-sky-500/15 dark:border-sky-500 dark:text-sky-300 shadow-md shadow-sky-500/10'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-[#111D35] dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <Trophy className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block text-slate-900 dark:text-white">
                  🏆 নির্দিষ্ট টুর্নামেন্ট
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  একটি নির্দিষ্ট টুর্নামেন্টের জন্য নোটিশ
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Specific Tournament Dropdown (if tournament target selected) */}
        {targetType === 'TOURNAMENT' && (
          <div className="animate-in fade-in space-y-1">
            <label className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider block">
              টুর্নামেন্ট সিলেক্ট করুন
            </label>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 focus:border-sky-500 dark:focus:border-sky-400 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.type} - ৳{t.entryFee})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-[0.99] text-black font-black font-gaming text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 border-yellow-300"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>নোটিশ পাঠানো হচ্ছে...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 stroke-[2.5]" />
              <span>Send Notice (নোটিশ পাঠান)</span>
            </>
          )}
        </button>
      </form>

      {/* Notice History & Delete Section */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wider">
              পুরানো নোটিশ সমূহ (Notice History)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#111D35] border border-slate-200 dark:border-slate-700 text-[11px] font-bold font-gaming text-amber-700 dark:text-amber-400">
            {announcements.length} টি নোটিশ
          </span>
        </div>

        {announcements.length === 0 ? (
          <div className="py-6 px-4 rounded-2xl bg-slate-50 dark:bg-[#111D35]/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              বর্তমানে কোনো নোটিশ সক্রিয় নেই।
            </p>
            <p className="text-[11px] text-slate-500">
              উপরের ফর্ম পূরণ করে নোটিশ পাঠালে তা এখানে এবং হোম পেজে দেখা যাবে।
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {announcements.map((ann) => {
              const isTournament =
                ann.targetType === 'TOURNAMENT' && Boolean(ann.tournamentTitle);
              const isDeleting = deletingId === ann.id;

              return (
                <div
                  key={ann.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111D35] border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors space-y-2.5 relative group"
                >
                  {/* Top row: Target badge, Time, and Delete Button */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-gaming uppercase tracking-wider border ${
                          isTournament
                            ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-500/40'
                            : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-500/40'
                        }`}
                      >
                        {isTournament ? ann.tournamentTitle : '📢 All Users'}
                      </span>

                      <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                        {formatAnnouncementTime(ann.createdAt)}
                      </span>
                    </div>

                    {/* Inline Confirm Delete Controls */}
                    {confirmDeleteId === ann.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteNotice(ann.id)}
                          disabled={isDeleting}
                          className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>নিশ্চিত ডিলিট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          বাতিল
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(ann.id)}
                        disabled={isDeleting}
                        title="Delete this notice"
                        className="px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900 border border-red-200 dark:border-red-500/40 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-3 h-3 border-2 border-red-500 dark:border-red-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                        <span>মুছে ফেলুন</span>
                      </button>
                    )}
                  </div>

                  {/* Notice Content */}
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed whitespace-pre-line break-words bg-white dark:bg-[#0A0E1A] p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    {ann.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
