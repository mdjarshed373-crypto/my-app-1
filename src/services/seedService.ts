import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  bkashNumber: '01602570739',
  bkashType: 'Personal (Send Money)',
  nagadNumber: '01602570739',
  nagadType: 'Personal (Send Money)',
  supportPhone: '+8801602570739',
  supportWhatsapp: '+8801602570739',
  supportEmail: 'support@txtourbd.com',
  noticeBanner: 'স্বাগতম TX TOUR BD-তে! নিয়মিত টুর্নামেন্ট খেলুন এবং জিতে নিন আকর্ষণীয় প্রাইজ!',
  noticeBannerBn: 'স্বাগতম TX TOUR BD-তে! নিয়মিত টুর্নামেন্ট খেলুন এবং জিতে নিন আকর্ষণীয় প্রাইজ!',
  scoringRules: {
    killPoints: 1,
    placements: {
      '1': 12,
      '2': 9,
      '3': 8,
      '4': 7,
      '5': 6,
      '6': 5,
      '7': 4,
      '8': 3,
      '9': 2,
      '10': 1,
    },
  },
  updatedAt: new Date().toISOString(),
};

export async function checkAndSeedInitialData() {
  try {
    // 1. Sync settings with 01602570739
    const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS);
    } else {
      const current = settingsDoc.data();
      if (
        current?.bkashNumber !== '01602570739' ||
        current?.nagadNumber !== '01602570739'
      ) {
        await setDoc(
          doc(db, 'settings', 'global'),
          {
            ...current,
            bkashNumber: '01602570739',
            nagadNumber: '01602570739',
            supportPhone: '+8801602570739',
            supportWhatsapp: '+8801602570739',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    // 2. PURGE ALL OLD DEMO TOURNAMENTS
    // Per user instruction: "সব ডেমো টুর্নামেন্ট ডিলিট করো। এখন কোনো টুর্নামেন্ট দেখাবে না যদি আমি না বানাই।"
    const demoSnap = await getDocs(collection(db, 'tournaments'));
    const demoPromises: Promise<void>[] = [];
    demoSnap.forEach((d) => {
      const data = d.data();
      // Delete any tournaments seeded originally without a real user author
      if (!data.createdBy || data.createdBy === 'system' || d.id.startsWith('tx_')) {
        demoPromises.push(deleteDoc(d.ref));
        demoPromises.push(deleteDoc(doc(db, 'rooms', d.id)));
      }
    });

    if (demoPromises.length > 0) {
      await Promise.all(demoPromises);
    }

    // 3. Remove the old seeded IMPORTANT RULES notice from Notice Board (keep all other notices & match rules intact)
    try {
      const rulesAnnRef = doc(db, 'announcements', 'important_rules_notice');
      const rulesAnnDoc = await getDoc(rulesAnnRef);
      if (rulesAnnDoc.exists()) {
        await deleteDoc(rulesAnnRef);
      }
      const allAnnSnap = await getDocs(collection(db, 'announcements'));
      const legacyDeletes: Promise<void>[] = [];
      allAnnSnap.forEach((d) => {
        const data = d.data();
        const content = String(data?.content || '');
        if (
          d.id === 'important_rules_notice' ||
          (content.includes('IMPORTANT RULES') &&
            content.includes('40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে'))
        ) {
          legacyDeletes.push(deleteDoc(d.ref));
        }
      });
      if (legacyDeletes.length > 0) {
        await Promise.all(legacyDeletes);
      }
    } catch {}
  } catch (err) {
    console.warn('Init check note:', err);
  }
}
