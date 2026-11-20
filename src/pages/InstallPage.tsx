import React, { useEffect } from 'react';
import { TXLogo } from '../components/common/TXLogo';
import {
  Download,
  MoreVertical,
  PlusSquare,
  CheckCircle,
  Smartphone,
  ShieldCheck,
  Zap,
  Trophy,
  ArrowRight,
  Share2,
  ExternalLink,
} from 'lucide-react';

interface InstallPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const InstallPage: React.FC<InstallPageProps> = ({ onNavigate }) => {

  useEffect(() => {
    document.title = 'TX TOUR BD App Download - Free Fire Esports Tournament App';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#070B18] text-white selection:bg-orange-500 selection:text-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-10 touch-pan-y">
      {/* Top Header Card */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <TXLogo size="lg" />
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black font-gaming uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Official Android &amp; Chrome PWA WebAPK</span>
        </div>

        {/* Requested Heading */}
        <h1 className="text-3xl sm:text-5xl font-black font-gaming uppercase tracking-wider text-white">
          TX TOUR BD App Download
        </h1>

        <p className="text-sm sm:text-base text-slate-300 font-bangla max-w-2xl mx-auto leading-relaxed">
          বাংলাদেশের ১ নম্বর Free Fire esports টুর্নামেন্ট অ্যাপ। কোনো ঝামেলা ছাড়া সরাসরি Google Chrome থেকে আপনার মোবাইলের হোম স্ক্রিনে ইনস্টল করুন।
        </p>

        {/* Big Orange Download / Install Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/api/download-apk?v=3"
            download="TX-TOUR-BD-v3.apk"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B] hover:from-[#F97316] hover:to-[#FBBF24] active:scale-95 text-white font-black font-gaming text-base sm:text-lg tracking-wider uppercase shadow-2xl shadow-orange-600/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer border-2 border-amber-300/60"
          >
            <Download className="w-6 h-6 stroke-[3]" />
            <span>Download Android APK</span>
          </a>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-[#111D35] hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 font-black font-gaming text-sm tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Game Lobby</span>
            <ArrowRight className="w-4 h-4 text-sky-400" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400 font-gaming tracking-wider">
          100% Free • Safe &amp; Fast • No APK Download Risks • Auto-Updates
        </p>
      </div>

      {/* 3 Step Installation Guide Cards */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black font-gaming text-amber-400 uppercase tracking-wide">
            How to Install TX TOUR BD (৩টি সহজ ধাপ)
          </h2>
          <p className="text-xs text-slate-400 font-bangla">
            Google Chrome ব্রাউজারে নিচের ধাপগুলো অনুসরণ করে অ্যাপটি সেটআপ করুন
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="keep-dark-surface p-5 rounded-3xl bg-[#0D1428] border border-amber-500/30 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 text-white font-black font-gaming text-base flex items-center justify-center shadow-lg">
                  1
                </span>
                <MoreVertical className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-base font-black font-gaming text-white uppercase tracking-wide">
                Step 1: Tap the 3 Dots
              </h3>

              <p className="text-xs text-slate-300 font-bangla leading-relaxed">
                আপনার Google Chrome ব্রাউজারের উপরে ডানদিকের ৩টি ডটে (<span className="text-amber-400 font-bold">⋮</span>) ট্যাপ করুন।
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 bg-[#070B18] p-2 rounded-xl border border-slate-800">
              Chrome Menu &gt; More Options
            </div>
          </div>

          {/* Step 2 */}
          <div className="keep-dark-surface p-5 rounded-3xl bg-[#0D1428] border border-amber-500/30 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-white font-black font-gaming text-base flex items-center justify-center shadow-lg">
                  2
                </span>
                <PlusSquare className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-base font-black font-gaming text-white uppercase tracking-wide">
                Step 2: Tap &quot;Install App&quot;
              </h3>

              <p className="text-xs text-slate-300 font-bangla leading-relaxed">
                মেনু থেকে <span className="text-amber-400 font-bold">&quot;Install app&quot;</span> অথবা <span className="text-amber-400 font-bold">&quot;Install and create shortcut&quot;</span> অপশনে চাপুন।
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 bg-[#070B18] p-2 rounded-xl border border-slate-800">
              Install &amp; create shortcut
            </div>
          </div>

          {/* Step 3 */}
          <div className="keep-dark-surface p-5 rounded-3xl bg-[#0D1428] border border-amber-500/30 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-500 text-black font-black font-gaming text-base flex items-center justify-center shadow-lg">
                  3
                </span>
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>

              <h3 className="text-base font-black font-gaming text-white uppercase tracking-wide">
                Step 3: Confirm &quot;Install&quot;
              </h3>

              <p className="text-xs text-slate-300 font-bangla leading-relaxed">
                পপআপে <span className="text-emerald-400 font-bold">&quot;Install&quot;</span> বাটনে চাপুন। কয়েক সেকেন্ডের মধ্যে TX TOUR BD অ্যাপ মোবাইলের হোম স্ক্রিনে চলে আসবে।
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 bg-[#070B18] p-2 rounded-xl border border-slate-800">
              Ready on Home Screen!
            </div>
          </div>
        </div>
      </div>

      {/* iOS Safari Tip Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0D1428] border border-sky-500/30 flex items-start sm:items-center gap-3.5 shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5" />
        </div>
        <div className="text-xs sm:text-sm text-slate-300 font-bangla leading-relaxed">
          <b className="text-white font-gaming uppercase tracking-wider block">Apple iPhone / iPad ব্যবহারকারীদের জন্য:</b>
          Safari ব্রাউজারে নিচে <span className="text-sky-300 font-bold">Share (শেয়ার)</span> আইকনে চাপ দিন, এরপর স্ক্রল করে <span className="text-amber-400 font-bold">&quot;Add to Home Screen&quot;</span> নির্বাচন করুন।
        </div>
      </div>

      {/* Feature Highlights Grid for Google SEO & Players */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-2xl bg-[#0B1020] border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <Trophy className="w-5 h-5" />
            <h4 className="font-gaming font-bold text-sm uppercase">Daily Tournaments</h4>
          </div>
          <p className="text-xs text-slate-400 font-bangla">
            প্রতিদিন Solo, Duo, Squad, Lone Wolf এবং Clash Squad 4v4 ম্যাচ।
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B1020] border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap className="w-5 h-5" />
            <h4 className="font-gaming font-bold text-sm uppercase">Instant Room ID</h4>
          </div>
          <p className="text-xs text-slate-400 font-bangla">
            ম্যাচ শুরুর ১০-১৫ মিনিট আগে অ্যাপে অটোমেটিক রুম আইডি ও পাসওয়ার্ড পাওয়া যায়।
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B1020] border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-sky-400">
            <ShieldCheck className="w-5 h-5" />
            <h4 className="font-gaming font-bold text-sm uppercase">bKash &amp; Nagad</h4>
          </div>
          <p className="text-xs text-slate-400 font-bangla">
            দ্রুত ডিপোজিট এবং জয়ের টাকা সরাসরি বিকাশ ও নগদে উইথড্র সুবিধা।
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-red-950/60 via-[#111D35] to-amber-950/50 border border-amber-500/40 text-center space-y-4">
        <h3 className="text-xl sm:text-2xl font-black font-gaming text-white uppercase tracking-wide">
          Ready to Compete in Free Fire Esports?
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 font-bangla max-w-lg mx-auto">
          এখনই TX TOUR BD ইনস্টল করে যোগ দিন বাংলাদেশের হাজার হাজার গেমিং প্রো প্লেয়ারদের সাথে!
        </p>
        <a
          href="/api/download-apk?v=3"
          download="TX-TOUR-BD-v3.apk"
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 active:scale-95 text-black font-black font-gaming text-sm sm:text-base tracking-wider uppercase shadow-xl shadow-orange-500/30 transition-all inline-flex items-center gap-2 cursor-pointer border border-amber-300/50"
        >
          <Download className="w-5 h-5 stroke-[2.8]" />
          <span>Download TX TOUR BD APK</span>
        </a>
      </div>
    </div>
  );
};
