import React from 'react';
import {
  Download,
  Smartphone,
  Trophy,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Users,
  Gamepad2,
  Calendar,
  Clock,
  Flame,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Award,
  Play,
  Lock,
} from 'lucide-react';
import { TXLogo } from '../components/common/TXLogo';

interface LandingPageProps {
  onOpenApp?: () => void;
  onSelectTournament?: (id?: string) => void;
}

const WHATSAPP_CONTACT_URL =
  'https://wa.me/8801602570739?text=Hello%20TX%20TOUR%20BD%20Support%2C%20I%20want%20to%20join%20tournaments';

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenApp,
  onSelectTournament,
}) => {
  const dummyTournaments = [
    {
      id: 'tour-fullmap-1',
      title: 'BR SQUAD BATTLE ROYALE',
      titleBn: 'ফুল ম্যাপ স্কোয়াড টুর্নামেন্ট',
      category: 'Full Map',
      map: 'Bermuda (বারমুডা)',
      date: 'TODAY',
      time: '08:30 PM',
      entryFee: '৳50',
      prizePool: '৳1,200',
      firstPrize: '৳600',
      perKill: '৳25',
      showPerKill: true,
      slots: '38/48',
      progress: 79,
      status: 'SLOTS FILLING FAST',
      image: '/assets/categories/cat2_br_match.jpg',
    },
    {
      id: 'tour-lonewolf-2',
      title: 'LONE WOLF 1V1 HEADSHOT',
      titleBn: 'লোন উলফ ১ বনাম ১ হেডশট',
      category: 'Lone Wolf',
      map: 'Iron Cage (আইরন কেজ)',
      date: 'TODAY',
      time: '09:15 PM',
      entryFee: '৳30',
      prizePool: '৳500',
      firstPrize: '৳350',
      perKill: '৳0',
      showPerKill: false,
      slots: '14/16',
      progress: 88,
      status: 'FEW SLOTS LEFT',
      image: '/assets/categories/cat3_lone_wolf.jpg',
    },
    {
      id: 'tour-custom-3',
      title: 'CUSTOM ROOM CS 4V4 CLASH',
      titleBn: 'কাস্টম রুম ক্ল্যাশ স্কোয়াড ৪ বনাম ৪',
      category: 'Custom Room',
      map: 'Bermuda Clash (বারমুডা)',
      date: 'TONIGHT',
      time: '10:00 PM',
      entryFee: '৳100',
      prizePool: '৳1,600',
      firstPrize: '৳1,000',
      perKill: '৳0',
      showPerKill: false,
      slots: '6/8',
      progress: 75,
      status: 'HIGH VOLTAGE',
      image: '/assets/categories/cat4_cs_4v4.jpg',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050811] text-[#F8FAFC] selection:bg-red-600 selection:text-white touch-pan-y font-sans">
      {/* Top Floating App Bar */}
      <header className="sticky top-0 z-50 w-full bg-[#050811]/90 backdrop-blur-md border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TXLogo size="md" />
            <div className="hidden sm:block">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block font-gaming">
                Official Esports Platform
              </span>
              <span className="text-xs text-slate-400 font-bangla">
                বাংলাদেশ ফ্রি ফায়ার টুর্নামেন্ট
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {onOpenApp && (
              <button
                type="button"
                onClick={onOpenApp}
                className="px-3.5 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-sky-500/30 text-sky-400 hover:text-white font-bold font-gaming text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>ওয়েবে খেলুন</span>
              </button>
            )}

            <a
              href="/api/download-apk?v=3"
              download="TX-TOUR-BD-v3.apk"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 hover:from-red-500 hover:to-amber-300 text-white font-black font-gaming text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-red-600/30 hover:shadow-orange-500/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              <span>DOWNLOAD APP</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glow Spheres */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 sm:w-[550px] sm:h-[550px] bg-gradient-to-tr from-red-600/20 via-orange-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          {/* Live Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-950/70 border border-red-500/40 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-red-400 font-black font-gaming text-xs tracking-widest uppercase">
              BANGLADESH #1 ESPORTS TOURNAMENT APP
            </span>
          </div>

          {/* Big Logo Title */}
          <div className="pt-2">
            <p className="text-2xl sm:text-3xl font-black font-gaming tracking-[0.2em] text-amber-400 uppercase">
              TX TOUR BD
            </p>
          </div>

          {/* Big Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-bangla text-white tracking-tight leading-tight sm:leading-tight">
            <span className="sr-only">TX TOUR BD Free Fire Esports Tournament Bangladesh — </span>
            আপনি কি একজন <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-amber-300">eSports প্লেয়ার?</span>
          </h1>

          {/* Sub Heading */}
          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto font-bangla leading-relaxed">
            বাংলাদেশের সেরা Free Fire টুর্নামেন্ট অ্যাপ। প্রতিদিন টুর্নামেন্ট খেলুন আর টাকা জিতুন।
          </p>

          {/* Big CTA Download Button (Red to Yellow Gradient) */}
          <div className="pt-4 flex flex-col items-center justify-center space-y-3.5">
            <a
              href="/api/download-apk?v=3"
              download="TX-TOUR-BD-v3.apk"
              className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] px-8 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#EA580C] to-[#F59E0B] hover:from-[#EF4444] hover:via-[#F97316] hover:to-[#FBBF24] active:scale-[0.98] text-white font-black font-gaming text-lg sm:text-2xl tracking-wider uppercase shadow-2xl shadow-red-600/40 hover:shadow-orange-500/60 border-2 border-amber-300/60 transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <Download className="w-7 h-7 stroke-[3] group-hover:translate-y-0.5 transition-transform" />
              <span>⬇️ DOWNLOAD APP</span>
            </a>

            {/* Small text below button */}
            <p className="text-xs sm:text-sm text-slate-400 font-gaming tracking-wide">
              <span className="text-emerald-400 font-bold">100% Free Install</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-sky-300 font-bold">50,000+ Players</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-amber-300 font-bold">Android APK</span>
            </p>

            {/* Quick Web Version Link */}
            {onOpenApp && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenApp}
                  className="text-xs sm:text-sm text-slate-400 hover:text-sky-400 font-gaming tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer underline underline-offset-4"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>বা ডাউনলোড না করে সরাসরি ওয়েবসাইটে খেলুন (Play Online) &rarr;</span>
                </button>
              </div>
            )}
          </div>

          {/* Payment Trust Bar */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-gaming text-slate-400">
            <span className="uppercase text-[11px] font-bold text-slate-500">
              Supported Payment &amp; Withdraw:
            </span>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-[#E2136E]/15 border border-[#E2136E]/40 text-[#E2136E] font-black">
                bKash (বিকাশ)
              </span>
              <span className="px-3 py-1 rounded-lg bg-[#F7941D]/15 border border-[#F7941D]/40 text-[#F7941D] font-black">
                Nagad (নগদ)
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-black">
                ⚡ Instant Cashout
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Second Section - কেন Tx Tour BD সেরা? */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#070B18] border-y border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold font-gaming uppercase tracking-[0.25em] text-red-500 block">
              WHY CHOOSE US
            </span>
            <h2 className="text-2xl sm:text-4xl font-black font-bangla text-white">
              কেন <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">Tx Tour BD</span> সেরা?
            </h2>
            <p className="text-sm sm:text-base text-slate-400 font-bangla max-w-xl mx-auto">
              বাংলাদেশের গেমারদের জন্য সবচেয়ে বিশ্বস্ত, নিরাপদ এবং দ্রুততম ফ্রি ফায়ার টুর্নামেন্ট নেটওয়ার্ক।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Box 1: প্রতিদিন টুর্নামেন্ট */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-amber-500/25 hover:border-amber-400/60 shadow-xl space-y-3.5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black font-bangla text-white">
                ১. প্রতিদিন টুর্নামেন্ট
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                সকাল থেকে রাত পর্যন্ত বিরতিহীন টুর্নামেন্ট। Full Map, CS 4v4 এবং Lone Wolf হেডশট ম্যাচ যখন ইচ্ছা তখন খেলুন।
              </p>
            </div>

            {/* Box 2: ইনস্ট্যান্ট পেমেন্ট - বিকাশ / নগদ */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-emerald-500/25 hover:border-emerald-400/60 shadow-xl space-y-3.5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black font-bangla text-white">
                ২. ইনস্ট্যান্ট পেমেন্ট - বিকাশ / নগদ
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                ম্যাচ জয়ের সাথে সাথে প্রাইজের টাকা ওয়ালেটে জমা হয়। বিকাশ অথবা নগদ নাম্বারে ৫-১০ মিনিটে ক্যাশআউট পান।
              </p>
            </div>

            {/* Box 3: 100% বিশ্বস্ত */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-sky-500/25 hover:border-sky-400/60 shadow-xl space-y-3.5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-600/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black font-bangla text-white">
                ৩. 100% বিশ্বস্ত
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                ৫০,০০০+ সক্রিয় প্লেয়ারের ভরসা। কোনো হ্যাকার এলাউড নেই, ফেয়ার প্লে এবং ২৪ ঘণ্টা ডেডিকেটেড এডমিন সাপোর্ট।
              </p>
            </div>

            {/* Box 4: লাইভ রেজাল্ট */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-orange-500/25 hover:border-orange-400/60 shadow-xl space-y-3.5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black font-bangla text-white">
                ৪. লাইভ রেজাল্ট
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                ম্যাচ শেষ হতেই স্বয়ংক্রিয় স্কোরবোর্ড, কিল পয়েন্ট এবং লিডারবোর্ড আপডেট। প্রতিটি কিলের সঠিক পুরস্কার নিশ্চিত।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Third Section - কিভাবে খেলবেন? */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold font-gaming uppercase tracking-[0.25em] text-amber-400 block">
              EASY 4-STEP GUIDE
            </span>
            <h2 className="text-2xl sm:text-4xl font-black font-bangla text-white">
              কিভাবে <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">খেলবেন?</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 font-bangla max-w-lg mx-auto">
              মাত্র ৪টি সহজ ধাপে টুর্নামেন্টে যোগ দিন এবং জিতে নিন প্রতিদিন হাজার টাকা প্রাইজ।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-slate-800 hover:border-red-500/50 transition-all space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 font-black font-gaming text-lg flex items-center justify-center">
                01
              </div>
              <h3 className="text-lg font-bold font-bangla text-white">
                Step 1: অ্যাপ ডাউনলোড করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                ওয়েবসাইট থেকে সরাসরি Tx Tour BD অফিসিয়াল APK ফাইলটি মাত্র ১৫ মেগাবাইটে ডাউনলোড করুন।
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-slate-800 hover:border-orange-500/50 transition-all space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 font-black font-gaming text-lg flex items-center justify-center">
                02
              </div>
              <h3 className="text-lg font-bold font-bangla text-white">
                Step 2: অ্যাকাউন্ট খুলুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                আপনার মোবাইল নাম্বার অথবা ইমেইল দিয়ে ৩০ সেকেন্ডে একটি ফ্রি প্লেয়ার একাউন্ট তৈরি করুন।
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-slate-800 hover:border-amber-500/50 transition-all space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-400 font-black font-gaming text-lg flex items-center justify-center">
                03
              </div>
              <h3 className="text-lg font-bold font-bangla text-white">
                Step 3: টুর্নামেন্টে জয়েন করুন
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                পছন্দের মোড বেছে নিন, আপনার Free Fire IGN দিন এবং বিকাশ/নগদে এন্ট্রি ফি দিয়ে স্লট বুক করুন।
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-3xl bg-[#0D1428] border border-slate-800 hover:border-emerald-500/50 transition-all space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 font-black font-gaming text-lg flex items-center justify-center">
                04
              </div>
              <h3 className="text-lg font-bold font-bangla text-white">
                Step 4: জিতুন আর টাকা নিন
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-bangla leading-relaxed">
                রুম আইডি নিয়ে গেমে ঢুকে Booyah করুন আর কিলের প্রাইজ টাকা সাথে সাথে বিকাশ বা নগদে তুলে নিন।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fourth Section - Live Tournaments List */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-[#070B18] border-y border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold font-gaming uppercase tracking-[0.25em] text-red-500 block">
                FEATURED MATCHES
              </span>
              <h2 className="text-2xl sm:text-4xl font-black font-bangla text-white">
                Live <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">Tournaments List</span>
              </h2>
              <p className="text-sm text-slate-400 font-bangla">
                বর্তমানে চলমান এবং আসন্ন সেরা ৩টি টুর্নামেন্ট স্লট — এখনই যোগ দিন!
              </p>
            </div>

            {onOpenApp && (
              <button
                type="button"
                onClick={onOpenApp}
                className="px-4 py-2 rounded-xl bg-[#0D1428] hover:bg-[#111D35] border border-sky-500/30 text-sky-400 font-bold font-gaming text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>সব টুর্নামেন্ট দেখুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dummyTournaments.map((tour) => (
              <div
                key={tour.id}
                className="rounded-3xl bg-[#0D1428] border border-slate-800 hover:border-amber-500/50 shadow-2xl overflow-hidden flex flex-col justify-between transition-all group"
              >
                {/* Image & Header */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={tour.image}
                    alt={tour.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D1428] via-transparent to-black/60" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold font-gaming">
                    <span className="px-2.5 py-1 rounded-md bg-red-600 text-white uppercase tracking-wider shadow">
                      {tour.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/90 text-black uppercase tracking-wider font-black">
                      {tour.status}
                    </span>
                  </div>

                  {/* Bottom Map & Time overlay */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-slate-300 font-gaming">
                    <span className="flex items-center gap-1 text-sky-400 font-bold">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {tour.map}
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {tour.time}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-black font-gaming tracking-wide text-white">
                      {tour.title}
                    </h3>
                    <p className="text-xs text-sky-300 font-bangla font-semibold mt-0.5">
                      {tour.titleBn}
                    </p>
                  </div>

                  {/* Metric Mini Boxes: PRIZE, FEE (+ PER KILL only for BR Match) */}
                  <div
                    className={`grid ${
                      tour.showPerKill ? 'grid-cols-3' : 'grid-cols-2'
                    } gap-2 py-1 text-center font-gaming`}
                  >
                    <div className="p-2 rounded-xl bg-[#070B18] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">PRIZE</span>
                      <span className="text-xs font-black text-emerald-400">{tour.prizePool}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#070B18] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">FEE</span>
                      <span className="text-xs font-black text-amber-300">{tour.entryFee}</span>
                    </div>
                    {tour.showPerKill && (
                      <div className="p-2 rounded-xl bg-[#070B18] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">PER KILL</span>
                        <span className="text-xs font-black text-sky-300">{tour.perKill}</span>
                      </div>
                    )}
                  </div>

                  {/* Registration Progress */}
                  <div className="space-y-1.5 font-gaming">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Registration</span>
                      <span className="font-bold text-amber-400">{tour.slots}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 rounded-full"
                        style={{ width: `${tour.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    {onOpenApp ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectTournament) {
                            onSelectTournament(tour.id);
                          } else {
                            onOpenApp();
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black font-gaming text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>জয়েন করুন (Join Match)</span>
                      </button>
                    ) : (
                      <a
                        href="/api/download-apk?v=3"
                        download="TX-TOUR-BD-v3.apk"
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black font-gaming text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ডাউনলোড অ্যাপ</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Download Section & WhatsApp Support */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-b from-[#050811] via-[#0D1428] to-[#050811]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="space-y-3">
            <span className="text-xs font-bold font-gaming uppercase tracking-[0.25em] text-amber-400 block">
              READY TO BECOME AN ESPORTS CHAMPION?
            </span>
            <h2 className="text-3xl sm:text-5xl font-black font-bangla text-white">
              দেরি না করে এখনই ডাউনলোড করুন
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-bangla max-w-xl mx-auto">
              বাংলাদেশে ফ্রি ফায়ার খেলে টাকা জেতার সবচেয়ে সহজ ও বিশ্বস্ত মাধ্যম Tx Tour BD।
            </p>
          </div>

          {/* Big Download Button Again */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <a
              href="/api/download-apk?v=3"
              download="TX-TOUR-BD-v3.apk"
              className="w-full sm:w-auto min-w-[300px] sm:min-w-[380px] px-8 py-5 rounded-2xl bg-gradient-to-r from-[#DC2626] via-[#EA580C] to-[#F59E0B] hover:from-[#EF4444] hover:via-[#F97316] hover:to-[#FBBF24] active:scale-[0.98] text-white font-black font-gaming text-xl sm:text-2xl tracking-wider uppercase shadow-2xl shadow-red-600/50 hover:shadow-orange-500/70 border-2 border-amber-300/60 transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <Download className="w-7 h-7 stroke-[3] group-hover:translate-y-0.5 transition-transform" />
              <span>DOWNLOAD APP (APK)</span>
            </a>

            {/* WhatsApp Contact Button */}
            <a
              href={WHATSAPP_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto min-w-[280px] px-6 py-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:text-emerald-200 font-bold font-gaming text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
              <span>WhatsApp এ কথা বলুন (Live Support)</span>
            </a>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-gaming">
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              100% Safe APK
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Zero Adware / No Virus
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              24/7 Helpline: 01602570739
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#03060E] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <TXLogo size="sm" />
            <span className="font-gaming font-bold text-white tracking-wider">
              TX TOUR BD
            </span>
          </div>

          <p className="font-gaming">
            © 2026 Tx Tour BD - All Rights Reserved
          </p>

          <div className="flex items-center gap-4 text-slate-400 font-bangla text-xs">
            <a
              href={WHATSAPP_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>সরাসরি হোয়াটসঅ্যাপ</span>
            </a>
            {onOpenApp && (
              <button
                type="button"
                onClick={onOpenApp}
                className="hover:text-sky-400 transition-colors cursor-pointer"
              >
                ওয়েব অ্যাপে প্রবেশ
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
