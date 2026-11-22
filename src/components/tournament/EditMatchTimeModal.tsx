import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tournament } from '../../types';
import {
  addMinutesToSchedule,
  formatMatchTimeOnly,
  getDhakaTodayDateStr,
  getMatchTypeBadgeLabel,
  getTournamentCategory,
  parseMatchDateAndTime,
} from '../../constants/categoryRules';
import { updateMatchTimeWithNotification } from '../../services/tournamentService';
import { Clock, X, Minus, Plus, Check, AlertCircle } from 'lucide-react';

interface EditMatchTimeModalProps {
  isOpen: boolean;
  tournament: Tournament | null;
  onClose: () => void;
  onSuccess?: (updatedTournament: Tournament, message: string) => void;
}

const MAX_TIME_INCREASE_MINUTES = 15;
const QUICK_PRESET_OFFSETS = [5, 10, 15] as const;

export const EditMatchTimeModal: React.FC<EditMatchTimeModalProps> = ({
  isOpen,
  tournament,
  onClose,
  onSuccess,
}) => {
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayDhakaStr = getDhakaTodayDateStr();
  const anchorTimeStr = tournament
    ? (tournament.originalMatchTime || tournament.matchTime || '').trim()
    : '';
  const rawAnchorDateStr = tournament
    ? (tournament.originalMatchDate || tournament.matchDate || todayDhakaStr).trim()
    : '';

  const effectiveAnchorDateStr = (() => {
    if (!tournament) return '';
    const rawAnchorObj = parseMatchDateAndTime(rawAnchorDateStr, anchorTimeStr);
    const nowMs = Date.now();
    if (rawAnchorObj && rawAnchorObj.getTime() + MAX_TIME_INCREASE_MINUTES * 60000 <= nowMs) {
      const todayAnchorObj = parseMatchDateAndTime(todayDhakaStr, anchorTimeStr);
      if (
        todayAnchorObj &&
        todayAnchorObj.getTime() + MAX_TIME_INCREASE_MINUTES * 60000 > nowMs
      ) {
        return todayDhakaStr;
      }
    }
    return rawAnchorDateStr;
  })();

  useEffect(() => {
    if (!isOpen || !tournament) return;

    const anchorObj = parseMatchDateAndTime(effectiveAnchorDateStr, anchorTimeStr);
    const currentObj = parseMatchDateAndTime(tournament.matchDate, tournament.matchTime);
    let initialOffset = 0;

    if (anchorObj && currentObj) {
      let diff = Math.round((currentObj.getTime() - anchorObj.getTime()) / 60000);
      if ((diff < 0 || diff > 60) && tournament.matchDate) {
        const sameDayAnchor = parseMatchDateAndTime(tournament.matchDate, anchorTimeStr);
        if (sameDayAnchor) {
          diff = Math.round((currentObj.getTime() - sameDayAnchor.getTime()) / 60000);
        }
      }
      initialOffset = Math.max(0, Math.min(MAX_TIME_INCREASE_MINUTES, diff));
    }

    setOffsetMinutes(initialOffset);
    setErrorMsg(null);
    setSaving(false);
  }, [
    isOpen,
    tournament?.id,
    tournament?.matchTime,
    tournament?.matchDate,
    effectiveAnchorDateStr,
    anchorTimeStr,
  ]);

  if (!isOpen || !tournament) return null;

  const category = getTournamentCategory(tournament);
  const matchTypeLabel = getMatchTypeBadgeLabel(category);
  const anchorDisplayTime = formatMatchTimeOnly(anchorTimeStr || tournament.matchTime);
  const currentDisplayTime = formatMatchTimeOnly(tournament.matchTime);

  const previewSchedule = addMinutesToSchedule(
    effectiveAnchorDateStr || tournament.matchDate,
    anchorTimeStr || tournament.matchTime,
    offsetMinutes
  );
  const maxSchedule = addMinutesToSchedule(
    effectiveAnchorDateStr || tournament.matchDate,
    anchorTimeStr || tournament.matchTime,
    MAX_TIME_INCREASE_MINUTES
  );

  const handleStepMinus = () => {
    if (saving) return;
    if (offsetMinutes <= 0) {
      setErrorMsg(`মূল সময় (${anchorDisplayTime}) থেকে আর কমানো যাবে না।`);
      return;
    }
    setErrorMsg(null);
    setOffsetMinutes((prev) => Math.max(0, prev - 1));
  };

  const handleStepPlus = () => {
    if (saving) return;
    if (offsetMinutes >= MAX_TIME_INCREASE_MINUTES) {
      setErrorMsg(
        `সর্বোচ্চ ১৫ মিনিট পর্যন্ত (${maxSchedule.matchTime}) Time বাড়ানো যাবে! এর বেশি নয়।`
      );
      return;
    }
    setErrorMsg(null);
    setOffsetMinutes((prev) => Math.min(MAX_TIME_INCREASE_MINUTES, prev + 1));
  };

  const handleSaveTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await updateMatchTimeWithNotification({
        tournamentId: tournament.id,
        newMatchTime: previewSchedule.matchTime,
        newMatchDate: previewSchedule.matchDate,
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
      className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-time-modal-title"
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
              <div className="flex items-center gap-2">
                <h3
                  id="edit-time-modal-title"
                  className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate"
                >
                  Edit Match Time
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black font-gaming uppercase tracking-wider shrink-0">
                  {matchTypeLabel}
                </span>
              </div>
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
        <form onSubmit={handleSaveTime} className="p-5 space-y-5 bg-white dark:bg-[#0D1428]">
          {/* Schedule Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Original Time
              </span>
              <span className="text-xs sm:text-sm font-black font-gaming text-slate-700 dark:text-slate-200 tabular-nums">
                {anchorDisplayTime}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Current Card
              </span>
              <span className="text-xs sm:text-sm font-black font-gaming text-amber-700 dark:text-[#F4D77A] tabular-nums">
                {currentDisplayTime}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Max Limit
              </span>
              <span className="text-xs sm:text-sm font-black font-gaming text-sky-600 dark:text-sky-400 tabular-nums">
                {maxSchedule.matchTime}
              </span>
            </div>
          </div>

          {/* 1-Minute +/- Stepper */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 block text-center">
              Match Time (1 মিনিট করে বাড়ান বা কমান • সর্বোচ্চ +15 মিনিট)
            </label>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStepMinus}
                disabled={saving || offsetMinutes <= 0}
                aria-label="Decrease Match Time by 1 minute"
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-red-50 dark:bg-[#111D35] dark:hover:bg-red-950/60 border border-slate-300 dark:border-slate-700 hover:border-red-400 text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-300 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Minus className="w-5 h-5 stroke-[2.75]" />
                <span className="text-[9px] font-black font-gaming leading-none mt-0.5">1M</span>
              </button>

              <div className="flex-1 max-w-[200px] h-14 px-3 rounded-2xl bg-slate-50 dark:bg-[#070B18] border-2 border-amber-400/70 dark:border-[#CFA84B]/60 flex flex-col items-center justify-center">
                <span className="text-xl sm:text-2xl font-black font-gaming text-slate-900 dark:text-white tabular-nums leading-tight">
                  {previewSchedule.matchTime}
                </span>
                <span className="text-[10px] font-bold font-gaming text-amber-700 dark:text-amber-300 leading-none">
                  {offsetMinutes === 0 ? 'Original Time (+0m)' : `+${offsetMinutes} Min Delay`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleStepPlus}
                disabled={saving || offsetMinutes >= MAX_TIME_INCREASE_MINUTES}
                aria-label="Increase Match Time by 1 minute"
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-emerald-50 dark:bg-[#111D35] dark:hover:bg-emerald-950/60 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-300 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-5 h-5 stroke-[2.75]" />
                <span className="text-[9px] font-black font-gaming leading-none mt-0.5">1M</span>
              </button>
            </div>

            {/* Quick Presets (+5m, +10m, +15m from original time) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {QUICK_PRESET_OFFSETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setErrorMsg(null);
                    setOffsetMinutes(mins);
                  }}
                  className={`py-2 px-2 rounded-xl border font-black font-gaming text-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 ${
                    offsetMinutes === mins
                      ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                  }`}
                >
                  +{mins} Min
                </button>
              ))}
            </div>

            <p className="text-[11px] font-bangla text-slate-500 dark:text-slate-400 text-center">
              সেভ করলে সাথে সাথে Card-এ নতুন Time দেখাবে এবং জয়েন করা প্লেয়ারদের কাছে নোটিফিকেশন যাবে।
            </p>
          </div>

          {/* Error Feedback */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2"
            >
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
              className="min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] hover:brightness-110 text-black font-black font-gaming text-xs tracking-wider uppercase transition-all cursor-pointer border border-[#F4D77A]/60 flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{saving ? 'Saving...' : 'Save New Time'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
