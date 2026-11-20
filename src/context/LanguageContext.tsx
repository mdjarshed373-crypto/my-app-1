import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'bn' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  formatBDT: (amount: number) => string;
}

const translations: Record<Language, Record<string, string>> = {
  bn: {
    // Navigation
    'nav.home': 'হোম',
    'nav.tournaments': 'টুর্নামেন্টস',
    'nav.myMatches': 'আমার ম্যাচ',
    'nav.myTeam': 'আমার টিম',
    'nav.wallet': 'ওয়ালেট',
    'nav.leaderboard': 'লিডারবোর্ড',
    'nav.rules': 'নিয়মাবলী',
    'nav.faq': 'জিজ্ঞাসা (FAQ)',
    'nav.support': 'সাপোর্ট',
    'nav.login': 'লগইন',
    'nav.register': 'রেজিস্টার',
    'nav.dashboard': 'ড্যাশবোর্ড',
    'nav.profile': 'প্রোফাইল',
    'nav.adminPanel': 'এডমিন প্যানেল',
    'nav.logout': 'লগআউট',

    // Hero Section
    'hero.badge': 'বাংলাদেশের #১ ফ্রি ফায়ার টুর্নামেন্ট প্ল্যাটফর্ম',
    'hero.title1': 'DOMINATE THE BATTLE.',
    'hero.title2': 'BECOME THE CHAMPION.',
    'hero.subtitle': 'প্রতিদিনের কাস্টম রুম টুর্নামেন্টে অংশ নিন, স্কিল দেখান এবং বিকাশ ও নগদে জিতে নিন নগদ টাকা।',
    'hero.joinBtn': 'টুর্নামেন্টে জয়েন করুন',
    'hero.browseBtn': 'সব টুর্নামেন্ট দেখুন',
    'hero.activeTournaments': 'চলমান টুর্নামেন্ট',
    'hero.totalPrizes': 'মোট প্রাইজ বিতরণ',
    'hero.registeredPlayers': 'নিবন্ধিত গেমার',
    'hero.dailyMatches': 'দৈনিক ম্যাচ',

    // Tournaments
    'tournaments.title': 'ফ্রি ফায়ার টুর্নামেন্ট তালিকা',
    'tournaments.subtitle': 'আপনার পছন্দের মোড এবং স্কোয়াড নিয়ে এখনই স্লট বুক করুন',
    'tournaments.filter.all': 'সব টুর্নামেন্ট',
    'tournaments.filter.solo': 'সোলো (Solo)',
    'tournaments.filter.duo': 'ডুও (Duo)',
    'tournaments.filter.squad': 'স্কোয়াড (Squad)',
    'tournaments.filter.statusAll': 'সব স্ট্যাটাস',
    'tournaments.filter.open': 'রেজিস্ট্রেশন চলছে',
    'tournaments.filter.ongoing': 'চলমান',
    'tournaments.filter.completed': 'সমাপ্ত',
    'tournaments.entryFee': 'এন্ট্রি ফি',
    'tournaments.prizePool': 'প্রাইজপুল',
    'tournaments.perKill': 'প্রতি কিল',
    'tournaments.slots': 'স্লট পূরণ',
    'tournaments.details': 'বিস্তারিত দেখুন',
    'tournaments.joinNow': 'জয়েন করুন',
    'tournaments.full': 'স্লট ফুল',
    'tournaments.completed': 'ম্যাচ সমাপ্ত',
    'tournaments.free': 'ফ্রি এন্ট্রি',

    // Details & Room
    'room.title': 'কাস্টম রুম তথ্য (Room Credentials)',
    'room.warning': 'রুম আইডি ও পাসওয়ার্ড কেবল নিশ্চিত রেজিস্ট্রেশনকারী খেলোয়াড়দের দেওয়া হয়।',
    'room.id': 'রুম আইডি',
    'room.password': 'পাসওয়ার্ড',
    'room.copy': 'কপি করুন',
    'room.copied': 'কপি হয়েছে!',
    'room.waiting': 'ম্যাচ শুরুর ১০-১৫ মিনিট আগে রুম আইডি এবং পাসওয়ার্ড প্রকাশ করা হবে।',
    'room.releaseAt': 'রিলিজের সময়:',

    // Wallet
    'wallet.title': 'মাই ওয়ালেট ব্যালেন্স',
    'wallet.available': 'বর্তমান ব্যালেন্স',
    'wallet.pending': 'পেন্ডিং ডিপোজিট',
    'wallet.withdrawn': 'মোট উইথড্র',
    'wallet.winnings': 'টুর্নামেন্ট জয়',
    'wallet.deposit': 'টাকা ডিপোজিট',
    'wallet.withdraw': 'টাকা উইথড্র',
    'wallet.transactions': 'লেনদেনের বিবরণী',
    'wallet.selectMethod': 'পেমেন্ট মেথড নির্বাচন করুন',
    'wallet.senderNumber': 'প্রেরক মোবাইল নম্বর',
    'wallet.trxId': 'ট্রানজেকশন আইডি (TrxID)',
    'wallet.amount': 'টাকার পরিমাণ (৳)',
    'wallet.screenshot': 'পেমেন্ট স্ক্রিনশট ইউআরএল (ঐচ্ছিক)',
    'wallet.submitDeposit': 'ডিপোজিট রিকোয়েস্ট পাঠান',
    'wallet.accountNumber': 'আপনার একাউন্ট নম্বর',
    'wallet.submitWithdraw': 'উইথড্র রিকোয়েস্ট পাঠান',
    'wallet.sendMoneyNotice': 'নিচের নাম্বারে টাকা পাঠিয়ে TrxID এবং সেন্ডার নম্বর লিখে সাবমিট করুন। এডমিন যাচাই করে ৫-১৫ মিনিটের মধ্যে ব্যালেন্স যোগ করবেন।',

    // Common
    'common.search': 'খুঁজুন...',
    'common.loading': 'লোড হচ্ছে...',
    'common.save': 'সংরক্ষণ করুন',
    'common.cancel': 'বাতিল',
    'common.status': 'স্ট্যাটাস',
    'common.date': 'তারিখ',
    'common.time': 'সময়',
    'common.rank': 'র‍্যাংক',
    'common.player': 'খেলোয়াড়',
    'common.team': 'টিম',
    'common.points': 'পয়েন্ট',
    'common.kills': 'কিল',
    'common.actions': 'অ্যাকশন',
  },
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.tournaments': 'Tournaments',
    'nav.myMatches': 'My Matches',
    'nav.myTeam': 'My Team',
    'nav.wallet': 'Wallet',
    'nav.leaderboard': 'Leaderboard',
    'nav.rules': 'Rules',
    'nav.faq': 'FAQ',
    'nav.support': 'Support',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    'nav.adminPanel': 'Admin Panel',
    'nav.logout': 'Logout',

    // Hero Section
    'hero.badge': "Bangladesh's #1 Free Fire Esports Tournament Platform",
    'hero.title1': 'DOMINATE THE BATTLE.',
    'hero.title2': 'BECOME THE CHAMPION.',
    'hero.subtitle': 'Compete in daily Free Fire custom room tournaments, showcase your esports skills, and win real cash prize payouts via bKash and Nagad.',
    'hero.joinBtn': 'Join Tournament',
    'hero.browseBtn': 'Browse Tournaments',
    'hero.activeTournaments': 'Active Tournaments',
    'hero.totalPrizes': 'Total Prize Distributed',
    'hero.registeredPlayers': 'Registered Gamers',
    'hero.dailyMatches': 'Daily Matches',

    // Tournaments
    'tournaments.title': 'Free Fire Tournament Roster',
    'tournaments.subtitle': 'Pick your preferred game mode and secure your match slot now',
    'tournaments.filter.all': 'All Modes',
    'tournaments.filter.solo': 'Solo',
    'tournaments.filter.duo': 'Duo',
    'tournaments.filter.squad': 'Squad',
    'tournaments.filter.statusAll': 'All Statuses',
    'tournaments.filter.open': 'Registration Open',
    'tournaments.filter.ongoing': 'Ongoing',
    'tournaments.filter.completed': 'Completed',
    'tournaments.entryFee': 'Entry Fee',
    'tournaments.prizePool': 'Prize Pool',
    'tournaments.perKill': 'Per Kill',
    'tournaments.slots': 'Slot Capacity',
    'tournaments.details': 'View Details',
    'tournaments.joinNow': 'Join Now',
    'tournaments.full': 'Slots Full',
    'tournaments.completed': 'Completed',
    'tournaments.free': 'Free Entry',

    // Details & Room
    'room.title': 'Match Room Credentials',
    'room.warning': 'Room ID and Password are only visible to confirmed registered participants.',
    'room.id': 'Room ID',
    'room.password': 'Password',
    'room.copy': 'Copy',
    'room.copied': 'Copied!',
    'room.waiting': 'Room ID and Password will be published 10-15 minutes before the match start time.',
    'room.releaseAt': 'Release Time:',

    // Wallet
    'wallet.title': 'My Wallet Balance',
    'wallet.available': 'Available Balance',
    'wallet.pending': 'Pending Deposit',
    'wallet.withdrawn': 'Total Withdrawn',
    'wallet.winnings': 'Tournament Winnings',
    'wallet.deposit': 'Deposit Funds',
    'wallet.withdraw': 'Withdraw Earnings',
    'wallet.transactions': 'Transaction History',
    'wallet.selectMethod': 'Select Payment Method',
    'wallet.senderNumber': 'Sender Mobile Number',
    'wallet.trxId': 'Transaction ID (TrxID)',
    'wallet.amount': 'Amount (৳)',
    'wallet.screenshot': 'Payment Screenshot URL (Optional)',
    'wallet.submitDeposit': 'Submit Deposit Request',
    'wallet.accountNumber': 'Your Mobile Wallet Account Number',
    'wallet.submitWithdraw': 'Submit Withdrawal Request',
    'wallet.sendMoneyNotice': 'Send money to our official number, then submit your sender phone number and TrxID. Balance will be approved within 5-15 minutes.',

    // Common
    'common.search': 'Search...',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.time': 'Time',
    'common.rank': 'Rank',
    'common.player': 'Player',
    'common.team': 'Team',
    'common.points': 'Points',
    'common.kills': 'Kills',
    'common.actions': 'Actions',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('bn');

  useEffect(() => {
    const saved = localStorage.getItem('tx_tour_lang') as Language;
    if (saved === 'bn' || saved === 'en') {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('tx_tour_lang', lang);
  };

  const toggleLanguage = () => {
    handleSetLanguage(language === 'bn' ? 'en' : 'bn');
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const formatBDT = (amount: number): string => {
    const safeAmount = Number(amount ?? 0);
    return `৳${(Number.isNaN(safeAmount) ? 0 : safeAmount).toLocaleString('en-BD')}`;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        toggleLanguage,
        t,
        formatBDT,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
