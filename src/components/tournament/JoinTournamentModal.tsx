import React, { useState, useEffect, useRef } from 'react';
import { Tournament, PlayerSlotInfo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { joinTournamentInstant } from '../../services/tournamentService';
import {
  getPendingBalanceDeduction,
  isJoinLockedOrJoined,
} from '../../services/optimisticJoinStore';
import { getWalletBreakdown } from '../../services/walletService';
import {
  countsPlayersPerSlotForCategory,
  formatEntryTypeLabel,
  getSlotWeightForRegistration,
} from '../../constants/categoryRules';
import { requestBrowserNotificationPermission } from '../../services/pushNotificationService';
import {
  X,
  AlertCircle,
  User,
  ArrowRight,
} from 'lucide-react';
import { useLockBodyScroll } from '../../utils/scrollLock';
import { isUserCurrentlyBanned, getBanErrorMessage } from '../../services/banService';

interface JoinTournamentModalProps {
  tournament: Tournament | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (regId: string, playerName?: string) => void;
  onDepositRedirect: () => void;
}

export const JoinTournamentModal: React.FC<JoinTournamentModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onSuccess,
  onDepositRedirect,
}) => {
  useLockBodyScroll(isOpen);
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { language, t, formatBDT } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Form states: Player Names
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [player3Name, setPlayer3Name] = useState('');
  const [player4Name, setPlayer4Name] = useState('');

  useEffect(() => {
    if (!isOpen || !tournament) return;

    submittingRef.current = false;
    setLoading(false);
    setError(null);
    setPlayer1Name('');
    setPlayer2Name('');
    setPlayer3Name('');
    setPlayer4Name('');
  }, [isOpen, tournament?.id]);

  if (!isOpen || !tournament || !userProfile) return null;

  const userBalance = Math.max(
    0,
    getWalletBreakdown(userProfile).availableBalance -
      getPendingBalanceDeduction(userProfile.uid)
  );
  const alreadyJoinedOrLocked = isJoinLockedOrJoined(userProfile.uid, tournament.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) {
      return;
    }
    setError(null);

    if (isJoinLockedOrJoined(userProfile.uid, tournament.id)) {
      setError('আপনি ইতিমধ্যে এই টুর্নামেন্টে জয়েন করেছেন!');
      return;
    }

    if (isUserCurrentlyBanned(userProfile)) {
      setError(getBanErrorMessage(userProfile));
      return;
    }

    // 1. Validate Player 1 Name (Must be manually entered)
    if (!player1Name.trim()) {
      setError('Apnar Game er Name Likhu');
      return;
    }

    // 2. Validate Duo / Squad fields
    // NOTE: For DUO, Player 2 is OPTIONAL (user can join alone as Solo in DUO).
    if (tournament.type === 'SQUAD') {
      if (!player2Name.trim() || !player3Name.trim() || !player4Name.trim()) {
        setError(
          language === 'bn'
            ? 'অনুগ্রহ করে স্কোয়াডের বাকি ৩ জন খেলোয়াড়ের নাম লিখুন!'
            : 'Please enter all 4 player names for Squad!'
        );
        return;
      }
    }

    // 3. Balance check on Join Now click
    if (tournament.entryFee > 0 && userBalance < tournament.entryFee) {
      setError(
        language === 'bn'
          ? `পর্যাপ্ত ব্যালেন্স নেই! আপনার প্রয়োজন ৳${tournament.entryFee}, বর্তমান ব্যালেন্স ৳${userBalance}। দয়া করে ওয়ালেটে টাকা ডিপোজিট করুন।`
          : `Insufficient balance! You need ৳${tournament.entryFee}, current balance is ৳${userBalance}. Please deposit funds.`
      );
      return;
    }

    const hasPlayer2 = Boolean(player2Name.trim());
    const isDuoSolo = tournament.type === 'DUO' && !hasPlayer2;

    // Build player roster
    const playersList: PlayerSlotInfo[] = [];

    if (isDuoSolo) {
      // DUO joined as Solo: 1 person alone joins DUO match
      playersList.push({
        uid: currentUser?.uid,
        name: `${player1Name.trim()} (Solo)`,
        inGameName: `${player1Name.trim()} (Solo)`,
        freeFireUid: userProfile.freeFireUid || `${currentUser?.uid?.substring(0, 8)}`,
      });
      playersList.push({
        name: 'Partner: - / Solo',
        inGameName: 'Partner: - / Solo',
        freeFireUid: '-',
      });
    } else {
      playersList.push({
        uid: currentUser?.uid,
        name: player1Name.trim(),
        inGameName: player1Name.trim(),
        freeFireUid: userProfile.freeFireUid || `${currentUser?.uid?.substring(0, 8)}`,
      });

      if (tournament.type === 'DUO' || tournament.type === 'SQUAD') {
        if (hasPlayer2) {
          playersList.push({
            name: player2Name.trim(),
            inGameName: player2Name.trim(),
            freeFireUid: `FF_${Math.floor(10000000 + Math.random() * 90000000)}`,
          });
        }
      }

      if (tournament.type === 'SQUAD') {
        playersList.push(
          {
            name: player3Name.trim(),
            inGameName: player3Name.trim(),
            freeFireUid: `FF_${Math.floor(10000000 + Math.random() * 90000000)}`,
          },
          {
            name: player4Name.trim(),
            inGameName: player4Name.trim(),
            freeFireUid: `FF_${Math.floor(10000000 + Math.random() * 90000000)}`,
          }
        );
      }
    }

    const slotWeight = getSlotWeightForRegistration(tournament, playersList);
    const remainingSlots = Math.max(
      0,
      (Number(tournament.maxSlots) || 0) - (Number(tournament.registeredCount) || 0)
    );
    if (slotWeight > remainingSlots) {
      setError(
        language === 'bn'
          ? `দুঃখিত! এই ম্যাচে মাত্র ${remainingSlots} টি স্লট খালি আছে, তাই ${slotWeight} জনের নাম দিয়ে জয়েন করা যাবে না!`
          : `Sorry! Only ${remainingSlots} slot(s) remaining in this match, cannot join with ${slotWeight} players!`
      );
      return;
    }

    const finalUserName = isDuoSolo ? `${player1Name.trim()} (Solo)` : player1Name.trim();
    const finalTeamName = isDuoSolo
      ? `${player1Name.trim()} (Solo)`
      : player2Name.trim()
      ? `${player1Name.trim()} & ${player2Name.trim()}`
      : player1Name.trim();

    // Lock submit synchronously immediately to eliminate double-join even on double taps
    submittingRef.current = true;
    setLoading(true);

    // Non-blocking notification permission check
    void requestBrowserNotificationPermission().catch(() => {});

    const instantResult = joinTournamentInstant({
      tournament,
      userId: userProfile.uid,
      userName: finalUserName,
      players: playersList,
      teamName: finalTeamName,
      teamId: userProfile.teamId,
      onBackgroundConfirmed: () => {
        void refreshProfile().catch(() => {});
      },
      onBackgroundFailed: () => {
        void refreshProfile().catch(() => {});
      },
    });

    if (!instantResult.started) {
      submittingRef.current = false;
      setLoading(false);
      setError(instantResult.message);
      return;
    }

    // Complete UI immediately (<100ms): modal closes, button shows JOINED, Slot List updates instantly
    onSuccess(instantResult.registration.id, finalUserName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-[#0D1428] border border-sky-200 dark:border-sky-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#111D35]">
          <div>
            <span className="text-[10px] font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
              STEP 2: JOIN MATCH
            </span>
            <h2 className="text-base font-bold font-gaming tracking-wide text-slate-900 dark:text-white">
              {tournament.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs bg-white dark:bg-[#0D1428]">
          {/* Match Quick Specs */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070B18] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">ENTRY FEE</span>
              <span className="text-sm font-extrabold font-gaming text-emerald-600 dark:text-emerald-400">
                {tournament.entryFee > 0 ? formatBDT(tournament.entryFee) : 'FREE'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">ENTRY TYPE</span>
              <span className="text-xs font-bold font-gaming text-sky-600 dark:text-sky-400">
                {formatEntryTypeLabel(tournament)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">YOUR BALANCE</span>
              <span className="text-xs font-bold font-gaming text-slate-900 dark:text-white">
                {formatBDT(userBalance)}
              </span>
            </div>
          </div>

          {/* Orange Helper Notice */}
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-500/40 text-orange-800 dark:text-orange-300 font-semibold text-xs leading-relaxed">
            *অবশ্যই এখানে আপনার গেমের নামটি দিয়ে জয়েন করবেন
          </div>

          {/* Error Message with Deposit Quick Button */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-500/50 flex flex-col gap-2 text-red-800 dark:text-red-200 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {error.includes('ব্যালেন্স') && (
                <button
                  type="button"
                  onClick={onDepositRedirect}
                  className="self-end px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  {t('wallet.deposit')} (টাকা জমা দিন)
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* Player 1 Name */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Player 1 Name *</span>
                </label>
              </div>
              <input
                type="text"
                autoComplete="off"
                value={player1Name}
                onChange={(e) => {
                  setPlayer1Name(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="আপনার Free Fire গেমের নাম লিখুন"
                className={`w-full px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border rounded-xl text-slate-900 dark:text-white font-bold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none shadow-inner ${
                  error === 'Apnar Game er Name Likhu'
                    ? 'border-red-500 dark:border-red-500 focus:border-red-500'
                    : 'border-sky-300 dark:border-sky-500/40 focus:border-sky-500 dark:focus:border-sky-400'
                }`}
              />
              {error === 'Apnar Game er Name Likhu' && (
                <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                  Apnar Game er Name Likhu
                </p>
              )}
            </div>

            {/* Player 2 Name for DUO (Optional) */}
            {tournament.type === 'DUO' && (
              <div>
                <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                  Player 2 Name (Optional)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder="Partner থাকলে নাম লিখুন, না থাকলে খালি রাখুন"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 font-medium"
                />
              </div>
            )}

            {/* Player 2 Name for SQUAD (Required) */}
            {tournament.type === 'SQUAD' && (
              <div>
                <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                  Player 2 Name *
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={player2Name}
                  onChange={(e) => {
                    setPlayer2Name(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Player 2 এর গেমের নাম লিখুন"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400"
                />
              </div>
            )}

            {/* Players 3 and 4 Name (for Squad) */}
            {tournament.type === 'SQUAD' && (
              <>
                <div>
                  <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                    Player 3 Name *
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={player3Name}
                    onChange={(e) => {
                      setPlayer3Name(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Player 3 এর গেমের নাম লিখুন"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 dark:text-slate-200 font-bold mb-1">
                    Player 4 Name *
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={player4Name}
                    onChange={(e) => {
                      setPlayer4Name(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Player 4 এর গেমের নাম লিখুন"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#111D35] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400"
                  />
                </div>
              </>
            )}

            {/* Live Slot Booking Count Hint for Multi-Player Categories */}
            {countsPlayersPerSlotForCategory(tournament) &&
              (tournament.type === 'DUO' || tournament.type === 'SQUAD') && (
                <div className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-[#111D35] border border-sky-200 dark:border-sky-500/30 flex items-center justify-between text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                  <span>
                    {language === 'bn' ? 'মোট বুকিং স্লট সংখ্যা:' : 'Slots to be booked:'}
                  </span>
                  <span className="font-black font-gaming text-sky-600 dark:text-sky-400">
                    {tournament.type === 'SQUAD'
                      ? '4 Players (4 Slots)'
                      : player2Name.trim()
                      ? '2 Players (2 Slots)'
                      : '1 Player (1 Slot)'}
                  </span>
                </div>
              )}

            {/* Big Join Now Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || alreadyJoinedOrLocked}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-black font-gaming tracking-widest text-sm shadow-xl shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alreadyJoinedOrLocked
                  ? 'JOINED'
                  : loading
                  ? 'JOINED!'
                  : 'Join Now!'}
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
