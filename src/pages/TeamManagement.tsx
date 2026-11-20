import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Team, TeamInvitation } from '../types';
import {
  createTeam,
  fetchUserTeam,
  invitePlayerToTeam,
  fetchUserInvitations,
  respondToInvitation,
  leaveTeam,
} from '../services/teamService';
import {
  Users,
  Shield,
  UserPlus,
  Trophy,
  Flame,
  Check,
  X,
  Crown,
  LogOut,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const TeamManagement: React.FC = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const { language, t } = useLanguage();

  const [team, setTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Team state
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createLogo, setCreateLogo] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Invite state
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadTeamData();
    }
  }, [currentUser, userProfile]);

  const loadTeamData = async () => {
    if (!currentUser) return;
    try {
      if (userProfile?.teamId) {
        const tData = await fetchUserTeam(userProfile.teamId);
        setTeam(tData);
      } else {
        setTeam(null);
      }

      const invs = await fetchUserInvitations(currentUser.uid);
      setInvitations(invs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    setCreateLoading(true);
    setCreateError(null);

    const res = await createTeam(
      currentUser.uid,
      userProfile.displayName,
      createName,
      createTag,
      createLogo,
      userProfile.freeFireUid,
      userProfile.inGameName
    );

    setCreateLoading(false);
    if (res.success && res.teamId) {
      await refreshProfile();
      loadTeamData();
    } else {
      setCreateError(res.message);
    }
  };

  const handleInvitePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !currentUser) return;

    setInviteLoading(true);
    setInviteMessage(null);

    const res = await invitePlayerToTeam(
      team.id,
      team.name,
      currentUser.uid,
      inviteInput
    );

    setInviteLoading(false);
    if (res.success) {
      setInviteMessage({ type: 'success', text: res.message });
      setInviteInput('');
    } else {
      setInviteMessage({ type: 'error', text: res.message });
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'ACCEPTED' | 'REJECTED') => {
    if (!currentUser || !userProfile) return;
    const res = await respondToInvitation(invitationId, action, {
      uid: currentUser.uid,
      displayName: userProfile.displayName,
      freeFireUid: userProfile.freeFireUid,
      inGameName: userProfile.inGameName,
    });
    if (res.success) {
      await refreshProfile();
      loadTeamData();
    }
  };

  const handleLeaveTeam = async () => {
    if (!currentUser || !team) return;
    if (!window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই টিম ছাড়তে চান?' : 'Are you sure you want to leave this team?')) {
      return;
    }
    try {
      await leaveTeam(currentUser.uid, team.id);
      await refreshProfile();
      loadTeamData();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
          <Users className="w-4 h-4" />
          <span>{language === 'bn' ? 'স্কোয়াড ও ক্ল্যান হাব' : 'Esports Clan Headquarters'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-gaming text-white mt-1">
          {language === 'bn' ? 'আমার টিম ও স্কোয়াড' : 'My Team & Squad'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {language === 'bn'
            ? 'টিম তৈরি করুন, বন্ধুদের ইনভাইট করুন এবং স্কোয়াড টুর্নামেন্টে একসাথে লড়ুন।'
            : 'Assemble your 4-player competitive roster and dominate Squad tournaments together.'}
        </p>
      </div>

      {/* Pending Team Invitations Alert */}
      {invitations.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#0D1428] border border-sky-500/30 shadow-xl space-y-3">
          <h3 className="text-xs font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {language === 'bn' ? 'প্রাপ্ত টিম আমন্ত্রণ' : 'Pending Squad Invitations'} ({invitations.length})
          </h3>

          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-white text-sm">{inv.teamName}</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {language === 'bn'
                      ? `${inv.teamName}-এ যোগদানের জন্য আপনাকে আমন্ত্রণ জানানো হয়েছে।`
                      : `You have been invited to join ${inv.teamName}.`}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleRespondInvitation(inv.id, 'ACCEPTED')}
                    className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {language === 'bn' ? 'গ্রহণ করুন' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleRespondInvitation(inv.id, 'REJECTED')}
                    className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {language === 'bn' ? 'প্রত্যাখ্যান' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Team View or Create View */}
      {team ? (
        <div className="space-y-6">
          {/* Team Banner Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0D1428] via-[#111D35] to-[#0D1428] border border-sky-500/25 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-950 border border-sky-500/40 flex items-center justify-center font-black font-gaming text-2xl text-sky-400 uppercase shadow-lg">
                {team.tag || team.name.substring(0, 3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black font-gaming tracking-wide text-white">
                    {team.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-gaming bg-blue-600 text-white">
                    [{team.tag}]
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Team Leader: <span className="text-sky-300 font-semibold">{team.leaderName}</span> • Members: {team.members.length}/6
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-4 text-center">
                <div className="p-2.5 rounded-xl bg-[#070B18] border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Wins</span>
                  <span className="text-base font-black font-gaming text-amber-400">{team.wins}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#070B18] border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Matches</span>
                  <span className="text-base font-black font-gaming text-white">{team.matches}</span>
                </div>
              </div>

              <button
                onClick={handleLeaveTeam}
                className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'bn' ? 'টিম ছাড়ুন' : 'Leave Team'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Squad Roster */}
            <div className="md:col-span-2 p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-lg space-y-4">
              <h3 className="text-xs font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {language === 'bn' ? 'স্কোয়াড রোস্টার' : 'Official Squad Roster'}
              </h3>

              <div className="space-y-2.5">
                {team.members.map((member, i) => (
                  <div
                    key={member.uid}
                    className="p-3.5 rounded-xl bg-[#111D35] border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-950 text-sky-400 font-bold font-gaming flex items-center justify-center border border-sky-500/30">
                        #{i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {member.inGameName || member.name}
                          </span>
                          {member.role === 'LEADER' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Crown className="w-3 h-3" /> Leader
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          FF UID: {member.freeFireUid || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Players Box (if leader) */}
            <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-lg space-y-4">
              <h3 className="text-xs font-bold font-gaming uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                {language === 'bn' ? 'সদস্য ইনভাইট করুন' : 'Invite Teammate'}
              </h3>

              {inviteMessage && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                    inviteMessage.type === 'success'
                      ? 'bg-green-950/60 border-green-500/40 text-green-200'
                      : 'bg-red-950/60 border-red-500/40 text-red-200'
                  }`}
                >
                  {inviteMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>{inviteMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleInvitePlayer} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {language === 'bn' ? 'প্লেয়ারের ইউজারনেম বা ইমেইল' : 'Player Username or Email'}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="e.g. gamer_tx"
                    className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-sky-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading || team.members.length >= 6}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming tracking-wider text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {inviteLoading ? t('common.loading') : language === 'bn' ? 'ইনভাইট পাঠান' : 'Send Invitation'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Create Team Section */
        <div className="max-w-xl mx-auto p-8 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black font-gaming tracking-wide text-white">
              {language === 'bn' ? 'নতুন স্কোয়াড বা ক্ল্যান তৈরি করুন' : 'Create Your Esports Squad'}
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'bn'
                ? 'একটি দল তৈরি করে আপনার রোস্টার পূর্ণ করুন এবং যেকোনো স্কোয়াড টুর্নামেন্টে এক ক্লিকে জয়েন করুন।'
                : 'Form a squad, recruit your dream lineup, and easily enter team tournaments.'}
            </p>
          </div>

          {createError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {language === 'bn' ? 'টিমের পুরো নাম' : 'Squad Name'} *
              </label>
              <input
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. TEAM XTREME BD"
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {language === 'bn' ? 'টিম ট্যাগ (সংক্ষিপ্ত ৩-৪ অক্ষর)' : 'Clan Tag (3-4 Chars)'} *
              </label>
              <input
                type="text"
                maxLength={5}
                required
                value={createTag}
                onChange={(e) => setCreateTag(e.target.value)}
                placeholder="e.g. TXB"
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-400 uppercase font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming tracking-wider text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {createLoading ? t('common.loading') : language === 'bn' ? 'টিম তৈরি সম্পন্ন করুন' : 'Confirm & Create Squad'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
