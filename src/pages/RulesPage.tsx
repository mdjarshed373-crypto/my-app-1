import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ShieldAlert, Trophy, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';

export const RulesPage: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8 transition-colors">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
          <ShieldAlert className="w-4 h-4" />
          <span>Esports Code of Conduct</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-gaming text-slate-900 dark:text-white mt-1">
          {language === 'bn' ? 'টুর্নামেন্ট নিয়মাবলী ও নীতি' : 'Official Tournament Rules & Policies'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'TX TOUR BD-এর সকল প্রতিযোগিতা শতভাগ নিরপেক্ষ, সুরক্ষিত ও পেশাদার রাখতে নিচের নিয়মাবলী বাধ্যতামূলক।'
            : 'Standard tournament guidelines ensuring fair play, integrity, and safety for all Bangladeshi gamers.'}
        </p>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Anti-Cheat & Fair Play */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-3">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <AlertTriangle className="w-4 h-4" />
            ১. নো হ্যাক ও এমুলেটর নিষেধাজ্ঞা
          </h3>
          <ul className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 divide-y divide-slate-200/80 dark:divide-slate-800/80 leading-relaxed">
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">🚫</span>
              <span>শুধুমাত্র মোবাইল ডিভাইস (Android / iOS) দিয়ে খেলা যাবে। পিসি বা ব্লুস্ট্যাক্স এমুলেটর সম্পূর্ণ নিষিদ্ধ।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">❌</span>
              <span>কোনো প্রকার অটো-এম, ওয়ালহ্যাক, স্ক্রিপ্ট বা কনফিগ ফাইল ব্যবহার করলে তাৎক্ষণিক ডিভাইস ব্যান।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">⚠️</span>
              <span>সোলো টুর্নামেন্টে টিমিং (Teaming) করা গুরুতর অপরাধ। টিমিং ধরা পড়লে উভয়েরই প্রাইজ বাজেয়াপ্ত হবে।</span>
            </li>
          </ul>
        </div>

        {/* Room & Match Schedule */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-3">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <Smartphone className="w-4 h-4" />
            ২. রুম আইডি ও ম্যাচ উপস্থিতি
          </h3>
          <ul className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 divide-y divide-slate-200/80 dark:divide-slate-800/80 leading-relaxed">
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">🎮</span>
              <span>ম্যাচ শুরুর ঠিক ১০-১৫ মিনিট পূর্বে প্ল্যাটফর্মে রুম আইডি ও পাসওয়ার্ড প্রকাশ করা হবে।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">⏰</span>
              <span>স্লট নিশ্চিতকারী প্লেয়ারকে নির্ধারিত সময়ের কমপক্ষে ৫ মিনিট পূর্বে কাস্টম রুমে প্রবেশ করতে হবে।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">⚠️</span>
              <span>নির্ধারিত সময়ের পর ম্যাচ শুরু হয়ে গেলে কোনো প্লেয়ার না ঢুকতে পারলে এন্ট্রি ফি রিফান্ড হবে না।</span>
            </li>
          </ul>
        </div>

        {/* Prize Distribution & Verification */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-3">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <Trophy className="w-4 h-4" />
            ৩. ফলাফল প্রকাশ ও প্রাইজমানি
          </h3>
          <ul className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 divide-y divide-slate-200/80 dark:divide-slate-800/80 leading-relaxed">
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">✅</span>
              <span>ম্যাচ শেষে এডমিন ম্যাচ রেজাল্ট ও কিল সংখ্যা যাচাই করে অফিসিয়াল স্কোরকার্ড প্রকাশ করবেন।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">🏆</span>
              <span>স্কোরকার্ড প্রকাশের পর বিজয়ীদের ওয়ালেটে সরাসরি প্রাইজমানি যোগ করে দেওয়া হবে।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">💸</span>
              <span>ওয়ালেটের টাকা বিকাশ, নগদ বা রকেটের মাধ্যমে যেকোনো সময় উইথড্র করা যাবে।</span>
            </li>
          </ul>
        </div>

        {/* Refund Policy */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-3">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <CheckCircle className="w-4 h-4" />
            ৪. বাতিল ও রিফান্ড নীতি
          </h3>
          <ul className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 divide-y divide-slate-200/80 dark:divide-slate-800/80 leading-relaxed">
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">💰</span>
              <span>যদি কোনো অনিবার্য কারণে বা সার্ভার সমস্যার জন্য টুর্নামেন্ট বাতিল হয়, তবে সকল প্লেয়ারের এন্ট্রি ফি ওয়ালেটে ১০০% রিফান্ড করা হবে।</span>
            </li>
            <li className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5">
              <span aria-hidden="true" className="w-5 text-base leading-snug text-center shrink-0 select-none">✅</span>
              <span>পর্যাপ্ত স্লট পূর্ণ না হলেও টুর্নামেন্ট বাতিল করে পূর্ণ রিফান্ড নিশ্চিত করা হবে।</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Scoring System Reference */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/20 shadow-lg dark:shadow-xl space-y-4">
        <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-600 dark:text-sky-400">
          Official Battle Royale Point System
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-[#111D35] text-center border border-amber-300 dark:border-amber-500/30">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold block">1st Place (Booyah)</span>
            <span className="text-base font-black font-gaming text-slate-900 dark:text-white">12 Points</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] text-center border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold block">2nd Place</span>
            <span className="text-base font-black font-gaming text-slate-900 dark:text-white">9 Points</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111D35] text-center border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-bold block">3rd Place</span>
            <span className="text-base font-black font-gaming text-slate-900 dark:text-white">8 Points</span>
          </div>
          <div className="p-3 rounded-xl bg-red-50/70 dark:bg-[#111D35] text-center border border-red-200 dark:border-red-500/30">
            <span className="text-[10px] text-red-600 dark:text-red-400 uppercase font-bold block">Every Kill</span>
            <span className="text-base font-black font-gaming text-slate-900 dark:text-white">+1 Point</span>
          </div>
        </div>
      </div>

      {/* ⚠️ IMPORTANT RULES ⚠️ at bottom */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-red-50 via-rose-50 to-red-50 dark:from-red-950/80 dark:via-[#200B0B] dark:to-red-950/80 border-2 border-red-300 dark:border-red-500/60 shadow-lg dark:shadow-2xl dark:shadow-red-950/40 space-y-3">
        <div className="flex items-center gap-2 text-red-700 dark:text-amber-300 font-black font-gaming text-base sm:text-lg tracking-wider uppercase pb-2 border-b border-red-200/80 dark:border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-amber-400 shrink-0 animate-pulse" />
          <span>⚠️ IMPORTANT RULES ⚠️</span>
        </div>
        <div className="divide-y divide-red-200/80 dark:divide-red-500/30 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold leading-relaxed">
          <div className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
            <span aria-hidden="true" className="w-6 text-lg leading-snug text-center shrink-0 select-none">⚠️</span>
            <span>(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)</span>
          </div>
          <div className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
            <span aria-hidden="true" className="w-6 text-lg leading-snug text-center shrink-0 select-none">🚫</span>
            <span>(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
