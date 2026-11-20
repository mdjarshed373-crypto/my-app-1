import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SupportTicket } from '../types';
import { createTicket, fetchUserTickets } from '../services/supportService';
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const SupportCenter: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { language, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'faq' | 'ticket' | 'myTickets'>('faq');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);

  // New ticket state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'PAYMENT' | 'TOURNAMENT' | 'ACCOUNT' | 'REPORT_PLAYER' | 'OTHER'>('PAYMENT');
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // FAQ open item
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (currentUser && activeTab === 'myTickets') {
      loadTickets();
    }
  }, [currentUser, activeTab]);

  const loadTickets = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const list = await fetchUserTickets(currentUser.uid);
      setTickets(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    setSubmitLoading(true);
    setStatusMessage(null);

    const res = await createTicket(
      currentUser.uid,
      userProfile.displayName,
      currentUser.email || '',
      subject,
      category,
      message
    );

    setSubmitLoading(false);
    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
      setSubject('');
      setMessage('');
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  const faqs = [
    {
      q: language === 'bn' ? 'কাস্টম রুম আইডি ও পাসওয়ার্ড কিভাবে পাবো?' : 'How do I receive the Room ID & Password?',
      a: language === 'bn'
        ? 'টুর্নামেন্টে স্লট বুক করার পর ম্যাচ শুরুর ১০ থেকে ১৫ মিনিট পূর্বে "আমার ম্যাচ (My Matches)" পেজে রুম আইডি ও পাসওয়ার্ড প্রকাশ করা হয়।'
        : 'After registering for a match, the Room ID & Password will be published 10-15 minutes prior to start time on your "My Matches" page.',
    },
    {
      q: language === 'bn' ? 'ডিপোজিট ব্যালেন্স যোগ হতে কতক্ষণ সময় লাগে?' : 'How long does wallet deposit verification take?',
      a: language === 'bn'
        ? 'বিকাশ বা নগদে টাকা পাঠানোর পর TrxID সাবমিট করলে আমাদের এডমিন টিম ৫ থেকে ১৫ মিনিটের মধ্যে যাচাই করে ব্যালেন্স যোগ করে দেন।'
        : 'Deposits via bKash and Nagad are manually reviewed and credited within 5 to 15 minutes upon submitting your Transaction ID (TrxID).',
    },
    {
      q: language === 'bn' ? 'টুর্নামেন্ট জয়ের পর প্রাইজমানি কিভাবে পাবো?' : 'How are tournament winnings paid out?',
      a: language === 'bn'
        ? 'ম্যাচ শেষ হওয়ার পর এডমিন ফলাফল ভেরিফাই করে বিজয়ী খেলোয়াড়দের ওয়ালেটে সরাসরি প্রাইজ ক্রেডিট করে দেন। এরপর বিকাশ বা নগদে উইথড্র করতে পারবেন।'
        : 'Once match results are officially verified, prizes are credited directly to winner wallets, ready for instant withdrawal to bKash or Nagad.',
    },
    {
      q: language === 'bn' ? 'এমুলেটর বা হ্যাক ব্যবহার করলে কি শাস্তি হবে?' : 'What is the anti-cheat & emulator policy?',
      a: language === 'bn'
        ? 'কোনো প্রকার এমুলেটর, পিসি, স্ক্রিপ্ট বা হ্যাক সম্পূর্ণ নিষিদ্ধ। আইন অমান্য করলে একাউন্ট স্থায়ীভাবে ব্যান এবং সকল ব্যালেন্স বাজেয়াপ্ত করা হবে।'
        : 'PC emulators and third-party scripts are strictly prohibited. Violators face immediate permanent account hardware ban and balance forfeiture.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B18] py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sky-400 text-xs font-bold font-gaming uppercase tracking-widest">
          <HelpCircle className="w-4 h-4" />
          <span>Helpdesk & Support</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-gaming text-white mt-1">
          {language === 'bn' ? 'সাপোর্ট ও সাহায্য কেন্দ্র' : 'Player Support Center'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {language === 'bn'
            ? 'যেকোনো জিজ্ঞাসা, পেমেন্ট সংক্রান্ত সমস্যা বা রিপোর্টের জন্য আমাদের সাথে যোগাযোগ করুন।'
            : 'Get assistance with match queries, payments, or report game issues directly to moderators.'}
        </p>
      </div>

      {/* Official Direct Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">WhatsApp Support</span>
            <span className="text-xs font-bold text-white">+880 1602-570739</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Official Email</span>
            <span className="text-xs font-bold text-white">support@txtourbd.com</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D1428] border border-sky-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Working Hours</span>
            <span className="text-xs font-bold text-white">10:00 AM - 12:00 AM</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-gaming tracking-wider">
        <button
          onClick={() => setActiveTab('faq')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'faq'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {language === 'bn' ? 'সাধারণ জিজ্ঞাসা (FAQ)' : 'Frequently Asked Questions'}
        </button>
        <button
          onClick={() => setActiveTab('ticket')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'ticket'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {language === 'bn' ? 'সাপোর্ট টিকিট পাঠান' : 'Submit Ticket'}
        </button>
        <button
          onClick={() => setActiveTab('myTickets')}
          className={`py-3 font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'myTickets'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          {language === 'bn' ? 'আমার টিকিট সমূহ' : 'My Support Tickets'}
        </button>
      </div>

      {/* FAQ TAB */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-[#0D1428] border border-sky-500/20 overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 flex justify-between items-center text-left text-xs font-bold text-white hover:text-sky-300 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? <ChevronUp className="w-4 h-4 text-sky-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SUBMIT TICKET TAB */}
      {activeTab === 'ticket' && (
        <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-xl space-y-4">
          <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
            {language === 'bn' ? 'নতুন সাপোর্ট টিকিট তৈরি করুন' : 'Submit New Inquiry'}
          </h3>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-green-950/60 border-green-500/40 text-green-200'
                  : 'bg-red-950/60 border-red-500/40 text-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleTicketSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'bn' ? 'ক্যাটাগরি' : 'Category'} *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-sky-400"
                >
                  <option value="PAYMENT">{language === 'bn' ? 'পেমেন্ট ও ওয়ালেট' : 'Payment & Wallet'}</option>
                  <option value="TOURNAMENT">{language === 'bn' ? 'টুর্নামেন্ট ও রুম' : 'Tournament & Room'}</option>
                  <option value="ACCOUNT">{language === 'bn' ? 'একাউন্ট সমস্যা' : 'Account Issue'}</option>
                  <option value="REPORT_PLAYER">{language === 'bn' ? 'প্লেয়ার রিপোর্ট (হ্যাক/চিট)' : 'Report Player / Hack'}</option>
                  <option value="OTHER">{language === 'bn' ? 'অন্যান্য' : 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'bn' ? 'বিষয় (Subject)' : 'Subject'} *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={language === 'bn' ? 'সংক্ষেপে সমস্যা লিখুন' : 'Brief subject summary'}
                  className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {language === 'bn' ? 'বিস্তারিত বিবরণ' : 'Detailed Message'} *
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={language === 'bn' ? 'আপনার সমস্যার বিস্তারিত তথ্য লিখুন...' : 'Describe your issue in detail...'}
                className="w-full px-3 py-2 bg-[#111D35] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-sky-400"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="py-3 px-6 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming tracking-wider text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitLoading ? t('common.loading') : language === 'bn' ? 'টিকিট জমা দিন' : 'Submit Ticket'}
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* MY TICKETS TAB */}
      {activeTab === 'myTickets' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-40 rounded-2xl bg-[#0D1428] animate-pulse"></div>
          ) : tickets.length === 0 ? (
            <p className="text-center py-10 text-xs text-slate-400 bg-[#0D1428] rounded-2xl border border-slate-800">
              {language === 'bn' ? 'আপনার কোনো সাপোর্ট টিকিট নেই।' : 'No tickets submitted yet.'}
            </p>
          ) : (
            tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-5 rounded-2xl bg-[#0D1428] border border-sky-500/20 shadow-md space-y-3"
              >
                <div className="flex justify-between items-start text-xs">
                  <div>
                    <span className="font-bold text-white text-sm block">{tkt.subject}</span>
                    <span className="text-[10px] text-slate-400">
                      Category: {tkt.category} • {new Date(tkt.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tkt.status === 'RESOLVED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : tkt.status === 'IN_PROGRESS'
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {tkt.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 bg-[#111D35] p-3 rounded-xl border border-slate-800">
                  {tkt.message}
                </p>

                {/* Admin Replies */}
                {tkt.replies && tkt.replies.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                      Admin Responses:
                    </span>
                    {tkt.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs"
                      >
                        <div className="flex justify-between text-[10px] text-sky-300 font-semibold mb-1">
                          <span>{rep.senderName} ({rep.senderRole})</span>
                          <span>{new Date(rep.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-white">{rep.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
