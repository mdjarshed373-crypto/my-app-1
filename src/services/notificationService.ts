import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification } from '../types';
import { handleFirestoreError, OperationType } from './firestoreError';

export async function fetchUserNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: AppNotification[] = [];
    snap.forEach((d) => list.push(d.data() as AppNotification));
    return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'notifications');
  }
}

export function subscribeUserNotifications(
  userId: string,
  callback: (items: AppNotification[]) => void
): () => void {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list: AppNotification[] = [];
      snap.forEach((d) => {
        const data = d.data() as AppNotification;
        list.push({ ...data, id: data.id || d.id });
      });
      list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      callback(list);
    },
    (err) => {
      console.error('Notifications subscription error:', err);
    }
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => updateDoc(d.ref, { read: true }));
    await Promise.all(promises);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'notifications');
  }
}

export async function createUserNotification(
  userId: string,
  title: string,
  titleBn: string,
  message: string,
  messageBn: string,
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT' = 'INFO',
  link?: string
): Promise<void> {
  try {
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      userId,
      title,
      titleBn,
      message,
      messageBn,
      type,
      link: link || '',
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'notifications');
  }
}
