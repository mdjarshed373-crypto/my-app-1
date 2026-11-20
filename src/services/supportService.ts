import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { SupportTicket, SupportTicketReply } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export async function createTicket(
  userId: string,
  userName: string,
  userEmail: string,
  subject: string,
  category: 'PAYMENT' | 'TOURNAMENT' | 'ACCOUNT' | 'REPORT_PLAYER' | 'OTHER',
  message: string
): Promise<{ success: boolean; message: string; ticketId?: string }> {
  try {
    const ticketId = 'tkt_' + Math.random().toString(36).substring(2, 9);
    const newTicket: SupportTicket = {
      id: ticketId,
      userId,
      userName,
      userEmail,
      subject,
      category,
      message,
      status: 'OPEN',
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'supportTickets', ticketId), newTicket);
    return {
      success: true,
      message: 'আপনার সাপোর্ট টিকিট জমা হয়েছে! খুব দ্রুত এডমিন টিম উত্তর দেবেন।',
      ticketId,
    };
  } catch (err: unknown) {
    if (err instanceof Error) return { success: false, message: err.message };
    return { success: false, message: 'টিকিট সাবমিট করতে সমস্যা হয়েছে।' };
  }
}

export async function fetchUserTickets(userId: string): Promise<SupportTicket[]> {
  try {
    const q = query(collection(db, 'supportTickets'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: SupportTicket[] = [];
    snap.forEach((d) => list.push(d.data() as SupportTicket));
    return list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'supportTickets');
  }
}

export async function fetchAllTickets(): Promise<SupportTicket[]> {
  try {
    const snap = await getDocs(collection(db, 'supportTickets'));
    const list: SupportTicket[] = [];
    snap.forEach((d) => list.push(d.data() as SupportTicket));
    return list.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'supportTickets');
  }
}

export async function replyToTicket(
  ticketId: string,
  reply: Omit<SupportTicketReply, 'id' | 'createdAt'>,
  newStatus?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
): Promise<void> {
  try {
    const docRef = doc(db, 'supportTickets', ticketId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as SupportTicket;
    const fullReply: SupportTicketReply = {
      ...reply,
      id: 'rep_' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
    };

    await updateDoc(docRef, {
      replies: [...(data.replies || []), fullReply],
      status: newStatus || data.status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticketId}`);
  }
}
