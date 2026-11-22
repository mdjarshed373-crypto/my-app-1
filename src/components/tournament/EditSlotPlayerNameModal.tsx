import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tournament, TournamentRegistration } from '../../types';
import {
  getMatchTypeBadgeLabel,
  getTournamentCategory,
} from '../../constants/categoryRules';
import { updateRegistrationPlayerName } from '../../services/tournamentService';
import { User, X, Check, AlertCircle } from 'lucide-react';

interface EditSlotPlayerNameModalProps {
  isOpen: boolean;
  tournament: Tournament | null;
  registration: TournamentRegistration | null;
  actorUserId?: string;
  playerIndex?: number;
  onClose: () => void;
  onSuccess?: (updatedRegistration: TournamentRegistration, message: string) => void;
}

export const EditSlotPlayerNameModal: React.FC<EditSlotPlayerNameModalProps> = ({
  isOpen,
  tournament,
  registration,
  actorUserId,
  playerIndex = 0,
  onClose,
  onSuccess,
}) => {
  const [newName, setNewName] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const targetPlayer = registration?.players?.[playerIndex];
  const currentPlayerName = (
    targetPlayer?.inGameName ||
    targetPlayer?.name ||
    (playerIndex === 0 ? registration?.userName : '') ||
    ''
  ).trim();
  const displayUid =
    targetPlayer?.freeFireUid &&
    targetPlayer.freeFireUid !== '-' &&
    !targetPlayer.freeFireUid.startsWith('FF_')
      ? targetPlayer.freeFireUid
      : '';

  useEffect(() => {
    if (!isOpen || !registration) return;
    setNewName(currentPlayerName);
    setErrorMsg(null);
    setSaving(false);
  }, [isOpen, registration?.id, playerIndex, currentPlayerName]);

  if (!isOpen || !tournament || !registration) return null;

  const category = getTournamentCategory(tournament);
  const matchTypeLabel = getMatchTypeBadgeLabel(category);
  const playerLabel = `Player ${playerIndex + 1}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg('অনুগ্রহ করে নতুন গেমের নাম লিখুন!');
      return;
    }
    if (trimmed.length > 40) {
      setErrorMsg('নাম সর্বোচ্চ ৪০ অক্ষরের মধ্যে হতে হবে!');
      return;
    }
    if (!actorUserId || registration.userId !== actorUserId) {
      setErrorMsg('শুধুমাত্র যিনি এই Slot জয়েন করেছেন, তিনিই নিজের নাম পরিবর্তন করতে পারবেন!');
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    try {
      const res = await updateRegistrationPlayerName({
        registrationId: registration.id,
        tournamentId: tournament.id,
        actorUserId,
        playerIndex,
        newPlayerName: trimmed,
      });

      if (!res.success || !res.updatedRegistration) {
        setErrorMsg(res.message);
        return;
      }

      onSuccess?.(res.updatedRegistration, res.message);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'নাম পরিবর্তন করতে সমস্যা হয়েছে।'
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
        aria-labelledby="edit-slot-player-name-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0D1428] border border-amber-400/70 dark:border-[#CFA84B]/50 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-[#111D35] px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-[#CFA84B]/15 border border-amber-300 dark:border-[#CFA84B]/40 flex items-center justify-center text-amber-700 dark:text-[#F4D77A] shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  id="edit-slot-player-name-title"
                  className="text-sm font-black font-gaming text-slate-900 dark:text-white uppercase tracking-wide truncate"
                >
                  Edit {playerLabel} Name
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black font-gaming uppercase tracking-wider shrink-0">
                  {matchTypeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {tournament.title} • Slot #{registration.slotNumber}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-[#0D1428]">
          {/* Current Slot Info Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                আগের নাম (Previous)
              </span>
              <span className="text-sm font-black font-gaming text-amber-700 dark:text-[#F4D77A] break-all">
                {currentPlayerName || '-'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Slot / UID
              </span>
              <span className="text-xs font-bold font-mono text-sky-700 dark:text-sky-400 block">
                Slot #{registration.slotNumber}
              </span>
              {displayUid && (
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                  UID: {displayUid}
                </span>
              )}
            </div>
          </div>

          {/* New Name Input */}
          <div className="space-y-2">
            <label
              htmlFor="edit-slot-player-name-input"
              className="text-xs font-bold text-slate-800 dark:text-slate-200 block"
            >
              নতুন {playerLabel} নাম লিখুন (New Name) *
            </label>
            <input
              id="edit-slot-player-name-input"
              type="text"
              autoFocus
              maxLength={40}
              disabled={saving}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="আপনার নতুন Free Fire নাম লিখুন"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111D35] border-2 border-amber-400/70 dark:border-[#CFA84B]/60 focus:border-sky-500 dark:focus:border-sky-400 text-slate-900 dark:text-white font-bold text-sm focus:outline-none shadow-inner disabled:opacity-60"
            />
            <p className="text-[11px] font-bangla text-slate-500 dark:text-slate-400">
              সেভ করলে সাথে সাথে Slot লিস্টে নতুন নাম দেখাবে। UID, Slot Number ও Confirmed স্ট্যাটাস অপরিবর্তিত থাকবে।
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

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
              <span>{saving ? 'Saving...' : 'Save Name'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
