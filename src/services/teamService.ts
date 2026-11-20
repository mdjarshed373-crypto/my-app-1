import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Team, TeamInvitation, TeamMember } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export async function createTeam(
  leaderId: string,
  leaderName: string,
  name: string,
  tag: string,
  logoUrl?: string,
  freeFireUid?: string,
  inGameName?: string
): Promise<{ success: boolean; message: string; teamId?: string }> {
  try {
    const teamId = 'team_' + Math.random().toString(36).substring(2, 9);
    const teamDocRef = doc(db, 'teams', teamId);
    const userDocRef = doc(db, 'users', leaderId);

    const leaderMember: TeamMember = {
      uid: leaderId,
      name: leaderName,
      freeFireUid: freeFireUid || '',
      inGameName: inGameName || leaderName,
      role: 'LEADER',
    };

    const teamData: Team = {
      id: teamId,
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      logoUrl: logoUrl || '',
      leaderId,
      leaderName,
      memberIds: [leaderId],
      members: [leaderMember],
      wins: 0,
      matches: 0,
      kills: 0,
      createdAt: new Date().toISOString(),
    };

    await setDoc(teamDocRef, teamData);
    await updateDoc(userDocRef, {
      teamId,
      teamName: name.trim(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: 'টিম সফলভাবে তৈরি করা হয়েছে!', teamId };
  } catch (err: unknown) {
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'টিম তৈরিতে সমস্যা হয়েছে।' };
  }
}

export async function fetchUserTeam(teamId: string): Promise<Team | null> {
  try {
    const snap = await getDoc(doc(db, 'teams', teamId));
    if (snap.exists()) {
      return snap.data() as Team;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `teams/${teamId}`);
  }
}

export async function invitePlayerToTeam(
  teamId: string,
  teamName: string,
  leaderId: string,
  targetUsernameOrEmail: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Search for user by email or username
    const cleanSearch = targetUsernameOrEmail.trim().toLowerCase();
    let q = query(collection(db, 'users'), where('email', '==', cleanSearch));
    let snap = await getDocs(q);

    if (snap.empty) {
      q = query(collection(db, 'users'), where('username', '==', cleanSearch));
      snap = await getDocs(q);
    }

    if (snap.empty) {
      return { success: false, message: 'এই ইউজারনেম বা ইমেইলের কোনো প্লেয়ার পাওয়া যায়নি।' };
    }

    const targetUser = snap.docs[0].data();
    if (targetUser.teamId) {
      return { success: false, message: 'এই খেলোয়াড় ইতিমধ্যে অন্য একটি টিমে যুক্ত আছেন।' };
    }

    const invitationId = 'inv_' + Math.random().toString(36).substring(2, 9);
    const invData: TeamInvitation = {
      id: invitationId,
      teamId,
      teamName,
      leaderId,
      invitedUserId: targetUser.uid,
      invitedUsername: targetUser.username || targetUser.displayName,
      invitedUserEmail: targetUser.email,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'teamInvitations', invitationId), invData);
    return { success: true, message: `সফলভাবে ${targetUser.displayName}-কে আমন্ত্রণ পাঠানো হয়েছে!` };
  } catch (err: unknown) {
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'আমন্ত্রণ পাঠাতে সমস্যা হয়েছে।' };
  }
}

export async function fetchUserInvitations(userId: string): Promise<TeamInvitation[]> {
  try {
    const q = query(
      collection(db, 'teamInvitations'),
      where('invitedUserId', '==', userId),
      where('status', '==', 'PENDING')
    );
    const snap = await getDocs(q);
    const list: TeamInvitation[] = [];
    snap.forEach((d) => list.push(d.data() as TeamInvitation));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'teamInvitations');
  }
}

export async function respondToInvitation(
  invitationId: string,
  action: 'ACCEPTED' | 'REJECTED',
  user: { uid: string; displayName: string; freeFireUid?: string; inGameName?: string }
): Promise<{ success: boolean; message: string }> {
  const invRef = doc(db, 'teamInvitations', invitationId);

  try {
    return await runTransaction(db, async (txn) => {
      const invSnap = await txn.get(invRef);
      if (!invSnap.exists()) throw new Error('আমন্ত্রণ পাওয়া যায়নি!');
      const inv = invSnap.data() as TeamInvitation;

      if (action === 'REJECTED') {
        txn.update(invRef, { status: 'REJECTED' });
        return { success: true, message: 'আমন্ত্রণ প্রত্যাখ্যান করা হয়েছে।' };
      }

      // ACCEPT: add to team
      const teamRef = doc(db, 'teams', inv.teamId);
      const teamSnap = await txn.get(teamRef);
      if (!teamSnap.exists()) throw new Error('টিমটি আর বিদ্যমান নেই!');
      const team = teamSnap.data() as Team;

      if (team.members.length >= 6) {
        throw new Error('টিমের সদস্য সীমা পূর্ণ (সর্বোচ্চ ৬ জন)।');
      }

      const newMember: TeamMember = {
        uid: user.uid,
        name: user.displayName,
        freeFireUid: user.freeFireUid || '',
        inGameName: user.inGameName || user.displayName,
        role: 'MEMBER',
      };

      txn.update(teamRef, {
        memberIds: [...team.memberIds, user.uid],
        members: [...team.members, newMember],
      });

      txn.update(doc(db, 'users', user.uid), {
        teamId: inv.teamId,
        teamName: inv.teamName,
        updatedAt: new Date().toISOString(),
      });

      txn.update(invRef, { status: 'ACCEPTED' });

      return { success: true, message: 'অভিনন্দন! আপনি সফলভাবে টিমে যোগ দিয়েছেন।' };
    });
  } catch (err: unknown) {
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'প্রক্রিয়াকরণে সমস্যা হয়েছে।' };
  }
}

export async function leaveTeam(userId: string, teamId: string): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (txn) => {
    const teamSnap = await txn.get(teamRef);
    if (!teamSnap.exists()) return;
    const team = teamSnap.data() as Team;

    if (team.leaderId === userId && team.members.length > 1) {
      throw new Error('টিম লিডার টিম ছাড়ার পূর্বে অন্য কোনো সদস্যকে লিডার নির্বাচন করুন।');
    }

    if (team.members.length <= 1) {
      // Delete team if sole member leaves
      txn.delete(teamRef);
    } else {
      const updatedMembers = team.members.filter((m) => m.uid !== userId);
      const updatedMemberIds = team.memberIds.filter((id) => id !== userId);
      txn.update(teamRef, { members: updatedMembers, memberIds: updatedMemberIds });
    }

    txn.update(userRef, { teamId: '', teamName: '', updatedAt: new Date().toISOString() });
  });
}
