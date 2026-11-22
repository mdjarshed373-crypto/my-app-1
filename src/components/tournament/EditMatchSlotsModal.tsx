import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tournament } from '../../types';
import {
  getMaxSlotLimitForCategory,
  getMatchTypeBadgeLabel,
  getTournamentCategory,
} from '../../constants/categoryRules';
import { updateTournamentMaxSlots } from '../../services/tournamentService';
import { Users, X, Minus, Plus, Check, AlertCircle } from 'lucide-react';

interface EditMatchSlotsModalProps {
  isOpen: boolean;
  tournament: Tournament | null;
  onClose: () => void;
  onSuccess?: (updatedTournament: Tournament, message: string) => void;
}

export const EditMatchSlotsModal: React.FC<EditMatchSlotsModalProps> = ({
  isOpen,
  tournament,
  onClose,
  onSuccess,
}) => {
  const [slotInput, setSlotInput] = useState<string>('20');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !tournament) return;
    const currentMax = Math.max(1, Math.floor(Number(tournament.maxSlots) || 1));
    setSlotInput(String(currentMax));
    setErrorMsg(null);
    setSaving(false);
  }, [isOpen, tournament?.id, tournament?.maxSlots]);

  if (!isOpen || !tournament) return null;

  const category = getTournamentCategory(tournament);
  const matchTypeLabel = getMatchTypeBadgeLabel(category);
  const maxAllowed = getMaxSlotLimitForCategory(category);
  const joinedCount = Math.max(0, Math.floor(Number(tournament.registeredCount) || 0));
  const minAllowed = Math.max(1, joinedCount);
  const currentMaxSlots = Math.max(1, Math.floor(Number(tournament.maxSlots) || 1));

  const parsedValue = Number.parseInt(slotInput, 10);
  const effectiveSlots = Number.isFinite(parsedValue) ? parsedValue : currentMaxSlots;

  const handleDecrement = () => {
    if (saving) return;
    const current = Number.isFinite(parsedValue) ? parsedValue : currentMaxSlots;
    if (current <= minAllowed) {
      setErrorMsg(
        joinedCount > 0
          ? `Already ${joinedCount} জন জয়েন করেছে — এর থেকে কম Slot করা যাবে না।`
          : 'Slot সংখ্যা কমপক্ষে 1 হতে হবে।'
      );
      return;
    }
    setErrorMsg(null);
    setSlotInput(String(current - 1));
  };

  const handleIncrement = () => {
    if (saving) return;
    const current = Number.isFinite(parsedValue) ? parsedValue : currentMaxSlots;
    if (maxAllowed !== null && current >= maxAllowed) {
      setErrorMsg(`${matchTypeLabel}-এ সর্বোচ্চ ${maxAllowed} পর্যন্ত Slot করা যাবে।`);
      return;
    }
    setErrorMsg(null);
    setSlotInput(String(current + 1));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const nextSlots = Number.parseInt(slotInput, 10);
    if (!Number.isFinite(nextSlots) || nextSlots < 1) {
      setErrorMsg('সঠিক Total Slot সংখ্যা লিখুন।');
      return;
    }

    if (nextSlots < minAllowed) {
      setErrorMsg(
        joinedCount > 0
          ? `Already ${joinedCount} জন জয়েন করেছে! ${joinedCount} এর কম Slot করা যাবে না।`
          : 'Slot সংখ্যা কমপক্ষে 1 হতে হবে!'
      );
      return;
    }

    if (maxAllowed !== null && nextSlots > maxAllowed) {
      setErrorMsg(`${matchTypeLabel}-এ সর্বোচ্চ ${maxAllowed} পর্যন্ত Slot বাড়ানো যাবে!`);
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await updateTournamentMaxSlots({
        tournamentId: tournament.id,
        newMaxSlots: nextSlots,
      });

      if (!res.success || !res.updatedTournament) {
        setErrorMsg(res.message);
        return;
      }

      onSuccess?.(res.updatedTournament, res.message);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Slot আপডেট করতে সমস্যা হয়েছে।'
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
        aria-labelledby="edit-slots-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0D1428] border border-amber-400/70 dark:border-[#CFA84B]/50 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-[#CFA84B]/15 border border-amber-300 dark:border-[#CFA84B]/40 flex items-center justify-center text-amber-700 dark:text-[#F4D77A] shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  id="edit-slots-modal-title"
                  className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate"
                >
                  Edit Match Slots
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
        <form onSubmit={handleSave} className="p-5 space-y-5 bg-white dark:bg-[#0D1428]">
          {/* Current Status Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Already Joined
              </span>
              <span className="text-sm font-black font-gaming text-emerald-600 dark:text-emerald-400 tabular-nums">
                {joinedCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Current Total
              </span>
              <span className="text-sm font-black font-gaming text-amber-700 dark:text-[#F4D77A] tabular-nums">
                {currentMaxSlots}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Max Limit
              </span>
              <span className="text-sm font-black font-gaming text-sky-600 dark:text-sky-400 tabular-nums">
                {maxAllowed !== null ? maxAllowed : 'Unlimited'}
              </span>
            </div>
          </div>

          {/* + / - Stepper & Total Slot Input */}
          <div className="space-y-2.5">
            <label
              htmlFor="edit-total-slot-input"
              className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 block text-center"
            >
              Total Slot (1 করে বাড়ান বা কমান)
            </label>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={saving || effectiveSlots <= minAllowed}
                aria-label="Decrease Total Slot by 1"
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-red-50 dark:bg-[#111D35] dark:hover:bg-red-950/60 border border-slate-300 dark:border-slate-700 hover:border-red-400 text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Minus className="w-6 h-6 stroke-[2.75]" />
              </button>

              <div className="flex-1 max-w-[170px] relative">
                <input
                  id="edit-total-slot-input"
                  type="number"
                  inputMode="numeric"
                  min={minAllowed}
                  max={maxAllowed ?? undefined}
                  step={1}
                  value={slotInput}
                  disabled={saving}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setSlotInput(val);
                      setErrorMsg(null);
                    }
                  }}
                  className="w-full h-14 px-3 rounded-2xl bg-slate-50 dark:bg-[#070B18] border-2 border-amber-400/70 dark:border-[#CFA84B]/60 focus:border-amber-500 dark:focus:border-[#F4D77A] text-center text-2xl sm:text-3xl font-black font-gaming text-slate-900 dark:text-white focus:outline-none tabular-nums"
                />
              </div>

              <button
                type="button"
                onClick={handleIncrement}
                disabled={saving || (maxAllowed !== null && effectiveSlots >= maxAllowed)}
                aria-label="Increase Total Slot by 1"
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-emerald-50 dark:bg-[#111D35] dark:hover:bg-emerald-950/60 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus className="w-6 h-6 stroke-[2.75]" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs font-bold font-gaming text-amber-700 dark:text-amber-300 tabular-nums">
                Card Preview: {joinedCount}/{Number.isFinite(parsedValue) ? parsedValue : currentMaxSlots}
              </p>
              <p className="text-[11px] font-bangla text-slate-500 dark:text-slate-400">
                সর্বনিম্ন: <b className="text-slate-700 dark:text-slate-200">{minAllowed}</b> (Already Joined: {joinedCount})
                {maxAllowed !== null && (
                  <>
                    {' '}• সর্বোচ্চ: <b className="text-slate-700 dark:text-slate-200">{maxAllowed}</b>
                  </>
                )}
              </p>
            </div>
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

          {/* Actions */}
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
              <span>{saving ? 'Saving...' : 'Save Slots'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
