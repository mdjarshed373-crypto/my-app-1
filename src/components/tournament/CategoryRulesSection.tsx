import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  CategoryRulesOverrides,
  resolveCategoryRuleSet,
  subscribeCategoryRules,
} from '../../services/rulesService';

interface CategoryRulesSectionProps {
  category?: string;
}

export function getRuleEmoji(line: string): string {
  const lower = line.toLowerCase();

  if (lower.includes('5 round') || lower.includes('round e onusthito')) {
    return '🔥';
  }

  if (
    lower.includes('room details') ||
    lower.includes('id & pass') ||
    lower.includes('ম্যাচ সময়ের') ||
    lower.includes('কাস্টম এ জয়েন')
  ) {
    return '⏰';
  }

  if (lower.includes('stylish') || lower.includes('game id name')) {
    return '✍️';
  }

  if (lower.includes('character skill')) {
    return '🎮';
  }

  if (lower.includes('observe') || lower.includes('অবজার্ব')) {
    return '👀';
  }

  if (
    lower.includes('বিকাশ') ||
    lower.includes('নগদ') ||
    lower.includes('উইথড্র') ||
    lower.includes('withdraw')
  ) {
    return '💸';
  }

  if (
    lower.includes('পুরস্কার') &&
    !lower.includes('পাবেন না')
  ) {
    return '🏆';
  }

  if (lower.includes('kill unlimited') || lower.includes('reward দেওয়া হবে')) {
    return '💥';
  }

  if (lower.includes('ভিডিও') || lower.includes('report') || lower.includes('rule break')) {
    return '📹';
  }

  if (lower.includes('fair play') || lower.includes('maintain')) {
    return '🤝';
  }

  if (lower.includes('abuse') || lower.includes('toxic') || lower.includes('action নেওয়া')) {
    return '🚫';
  }

  if (lower.includes('টিমমেট') || lower.includes('টিম change')) {
    return '👥';
  }

  if (lower.includes('winning reward') || lower.includes('৫-১০ মিনিট')) {
    return '💰';
  }

  if (
    lower.includes('40 লেভেলের কম') ||
    lower.includes('নেটওয়ার্ক সমস্যা') ||
    lower.includes('2 vs 1')
  ) {
    return '⚠️';
  }

  if (
    lower.includes('গাড়ি') ||
    lower.includes('মনস্টার ট্রাক') ||
    lower.includes('ডাবল ভিক্টোর') ||
    lower.includes('sniper') ||
    lower.includes('চালানো যাবে না') ||
    lower.includes('চালানো জাবে না')
  ) {
    return '❌';
  }

  if (
    lower.includes('ban') ||
    lower.includes('হ্যাক') ||
    lower.includes('টিমিং') ||
    lower.includes('সন্দেহজনক') ||
    lower.includes('কিক')
  ) {
    return '🚫';
  }

  return '⚠️';
}

export const CategoryRulesSection: React.FC<CategoryRulesSectionProps> = ({ category }) => {
  const [overrides, setOverrides] = useState<CategoryRulesOverrides | undefined>(undefined);

  useEffect(() => {
    const unsub = subscribeCategoryRules(setOverrides);
    return () => unsub();
  }, []);

  const ruleSet = resolveCategoryRuleSet(category, overrides);

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0D1428] border border-slate-200 dark:border-sky-500/25 shadow-lg dark:shadow-xl space-y-4 transition-colors">
      {/* Top Card Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-sky-500/15 border border-amber-200 dark:border-sky-400/30 flex items-center justify-center text-amber-600 dark:text-sky-400 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h3 className="text-base sm:text-lg font-black font-gaming uppercase tracking-wider text-slate-900 dark:text-white">
            Rules
          </h3>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 text-[10px] sm:text-xs font-bold font-gaming uppercase tracking-wider">
          {ruleSet.category}
        </span>
      </div>

      {/* Category Rules Title + Clean Emoji List with Gaps & Subtle Lines */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-[#111D35]/70 border border-slate-200 dark:border-slate-800 space-y-3">
        <h4 className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400 leading-snug pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
          {ruleSet.title}
        </h4>

        <div className="flex flex-col divide-y divide-slate-200/80 dark:divide-slate-700/60">
          {ruleSet.lines.map((line, idx) => (
            <div
              key={idx}
              className="py-3 first:pt-1 last:pb-1 flex items-start gap-3 text-xs sm:text-[13.5px] text-slate-800 dark:text-slate-100 leading-relaxed"
            >
              <span
                aria-hidden="true"
                className="w-6 text-base sm:text-[17px] leading-snug text-center shrink-0 select-none"
              >
                {getRuleEmoji(line)}
              </span>
              <span className="break-words font-medium flex-1">{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
