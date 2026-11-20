import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tournament } from '../../types';
import {
  addMinutesToSchedule,
  applyTimeInputToSchedule,
  format24HourToInputValue,
  formatMatchTimeOnly,
  parseTimeTo24Hour,
} from '../../constants/categoryRules';
import { updateMatchTimeWithNotification } from '../../services/tournamentService';
import { Clock, X, Timer, Check, AlertCircle } from 'lucide-react';

interface EditMatchTimeModalProps {
  isOpen: boolean;
  tournament: Tournament | null;
  onClose: () => void;
  onSuccess?: (updatedTournament: Tournament, message: string) => void;
}

const QUICK_DELAY_OPTIONS = [5, 10, 15] as const;

export const EditMatchTimeModal: React.FC<EditMatchTimeModalProps> = ({
  isOpen,
  tournament,
  onClose,
  onSuccess,
}) => {
  const [timeInput, setTimeInput] = useState<string>('20:00');
  const [saving, setSaving] = useState<boolean>(false);
  const [activeDelay, setActiveDelay] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !tournament) return;
    const { hours, minutes } = parseTimeTo24Hour(tournament.matchTime);
    setTimeInput(format24HourToInputValue(hours, minutes));
    setErrorMsg(null);
    setActiveDelay(null);
    setSaving(false);
  }, [isOpen, tournament?.id, tournament?.matchTime]);

  if (!isOpen || !tournament) return null;

  const currentDisplayTime = formatMatchTimeOnly(tournament.matchTime);
  const previewSchedule = applyTimeInputToSchedule(tournament.matchDate, timeInput);

  const handleQuickDelay = async (deltaMinutes: number) => {
    if (saving) return;
    setErrorMsg(null);
    setActiveDelay(deltaMinutes);
    setSaving(true);
    try {
      const nextSchedule = addMinutesToSchedule(
        tournament.matchDate,
        tournament.matchTime,
        deltaMinutes
      );
      setTimeInput(nextSchedule.timeInputValue);

      const res = await updateMatchTimeWithNotification({
        tournamentId: tournament.id,
        newMatchTime: nextSchedule.matchTime,
        newMatchDate: nextSchedule.matchDate,
      });

      if (!res.success || !res.updatedTournament) {
        setErrorMsg(res.message);
        return;
      }

      onSuccess?.(res.updatedTournament, res.message);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ম্যাচের সময় আপডেট করতে সমস্যা হয়েছে।'
      );
    } finally {
      setSaving(false);
      setActiveDelay(null);
    }
  };

  const handleSaveCustomTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!timeInput || !/^\d{1,2}:\d{2}$/.test(timeInput.trim())) {
      setErrorMsg('দয়া করে সঠিক সময় নির্বাচন করুন।');
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    try {
      const schedule = applyTimeInputToSchedule(tournament.matchDate, timeInput);
      const res = await updateMatchTimeWithNotification({
        tournamentId: tournament.id,
        newMatchTime: schedule.matchTime,
        newMatchDate: schedule.matchDate,
      });

      if (!res.success || !res.updatedTournament) {
        setErrorMsg(res.message);
        return;
      }

      onSuccess?.(res.updatedTournament, res.message);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ম্যাচের সময় পরিবর্তন করতে সমস্যা হয়েছে।'
      );
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      onClick={() => {
        if (!saving) onClose();
      }}
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0D1428] border border-amber-400/70 dark:border-[#CFA84B]/50 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-[#CFA84B]/15 border border-amber-300 dark:border-[#CFA84B]/40 flex items-center justify-center text-amber-700 dark:text-[#F4D77A] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate">
                Edit Match Time
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {tournament.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSaveCustomTime} className="p-5 space-y-5 bg-white dark:bg-[#0D1428]">
          {/* Current Schedule Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Current Time
              </span>
              <span className="text-sm font-black font-gaming text-amber-700 dark:text-[#F4D77A] tabular-nums">
                {currentDisplayTime}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Match Date
              </span>
              <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                {tournament.matchDate || 'Today'}
              </span>
            </div>
          </div>

          {/* 3 Quick Delay Buttons */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Quick Delay (১ ক্লিকে সময় বাড়ান)</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK_DELAY_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={saving}
                  onClick={() => handleQuickDelay(mins)}
                  className="py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white dark:bg-sky-500/15 dark:hover:bg-sky-600 dark:text-sky-300 dark:hover:text-white border border-sky-300 dark:border-sky-500/40 font-black font-gaming text-xs tracking-wide transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  {activeDelay === mins && saving ? 'Saving...' : `+${mins} Min`}
                </button>
              ))}
            </div>
          </div>

          {/* Minute-precision Time Picker */}
          <div className="space-y-2">
            <label
              htmlFor="match-time-picker"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block"
            >
              Custom Time Picker (যেকোনো মিনিট বা ঘন্টা সেট করুন)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="match-time-picker"
                type="time"
                step={60}
                value={timeInput}
                onChange={(e) => {
                  setTimeInput(e.target.value);
                  setErrorMsg(null);
                }}
                disabled={saving}
                required
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-[#F4D77A] text-slate-900 dark:text-white font-gaming font-bold text-sm focus:outline-none tabular-nums"
              />
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-[#111D35] border border-amber-300 dark:border-amber-500/35 text-center shrink-0 min-w-[92px]">
                <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300 block leading-none mb-0.5">
                  New Time
                </span>
                <span className="text-xs font-black font-gaming text-slate-900 dark:text-white tabular-nums">
                  {previewSchedule.matchTime}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              সেভ করলে Home Page, My Matches ও Slot List-এ সাথে সাথে আপডেট হবে এবং জয়েন করা প্লেয়ারদের কাছে নোটিফিকেশন যাবে।
            </p>
          </div>

          {/* Error Feedback */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit & Cancel Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider uppercase transition-all cursor-pointer border border-[#F4D77A]/60 flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{saving && activeDelay === null ? 'Updating...' : 'Save New Time'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
