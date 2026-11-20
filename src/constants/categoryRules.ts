import { MatchCategory, Tournament } from '../types';

export interface CategoryRuleSet {
  category: MatchCategory;
  title: string;
  lines: string[];
}

export const IMPORTANT_GLOBAL_RULES = [
  '1. (40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
  '2. (যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
];

export const MATCH_5_ROUND_TOP_RULE = '1. Match ti 5 Round e onusthito hobe.';

export const EDITABLE_RULE_CATEGORIES: { id: MatchCategory; label: string }[] = [
  { id: 'CS 1V1, 2V2', label: 'CS 1V1, CS 2V2' },
  { id: 'LONE WOLF HEADSHOT', label: 'Lone Wolf Headshot' },
  { id: 'LONE WOLF', label: 'Lone Wolf' },
  { id: 'BR MATCH', label: 'BR Match' },
  { id: 'LOST TO WIN', label: 'Lost To Win' },
  { id: 'FREE MATCH', label: 'Special Match' },
];

export const CATEGORY_RULES: Record<MatchCategory, CategoryRuleSet> = {
  'LONE WOLF': {
    category: 'LONE WOLF',
    title: 'Tx Tour BD: Lone Wolf Rules:',
    lines: [
      MATCH_5_ROUND_TOP_RULE,
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(CHARACTER SKILL ON থাকবে।)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(সকল প্লেয়ারকে Fair play Maintain করতে হবে!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে!)',
    ],
  },
  'LONE WOLF HEADSHOT': {
    category: 'LONE WOLF HEADSHOT',
    title: 'Tx Tour BD: Lone Wolf Headshot Rules:',
    lines: [
      MATCH_5_ROUND_TOP_RULE,
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(CHARACTER SKILL OFF থাকবে!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে)',
    ],
  },
  'BR MATCH': {
    category: 'BR MATCH',
    title: 'Tx Tour BD: BR MATCH Rules:',
    lines: [
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(গাড়ি বা মনস্টার ট্রাক চালানো যাবে না! চালালে পুরষ্কার পাবেন না!)',
      '(ডাবল ভিক্টোর ব্যবহার করা জাবে না! কোনো প্রকার SNIPER চালানো জাবে না!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
      '(BR MATCH Kill Unlimited Reward দেওয়া হবে!)',
      '(Rule Break করে কেউ কিল করলে ভিডিও নিয়ে Support এ Report করবেন!)',
      '(সকল প্লেয়ারকে Fair play Maintain করতে হবে!)',
      '(কোনো ধরনের Abuse/ Toxic Behaviour করলে Action নেওয়া হবে!)',
    ],
  },
  'CS 1V1, 2V2': {
    category: 'CS 1V1, 2V2',
    title: 'Tx Tour BD: CS 1 vs 1, 2 vs 2 Rules:',
    lines: [
      MATCH_5_ROUND_TOP_RULE,
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(* CHARACTER SKILL ON থাকবে! *)',
      '(কোনো প্লেয়ার নেটওয়ার্ক সমস্যা কারণে ম্যাচে না ঢুকাইলে রিফান্ড দিয়া হবে না!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
      '(আপনি যেই টিমমেট নিয়ে জয়েন করবেন তাদেরকে সাথে নিয়ে বসবেন! নিজের ইচ্ছা মত টিম Change করা যাবে না!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে!)',
    ],
  },
  'CS 4V4': {
    category: 'CS 4V4',
    title: 'Tx Tour BD: CS 4 vs 4 Rules:',
    lines: [
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(* CHARACTER SKILL ON থাকবে! *)',
      '(কোনো প্লেয়ার নেটওয়ার্ক সমস্যা কারণে ম্যাচে না ঢুকাইলে রিফান্ড দিয়া হবে না!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
      '(আপনি যেই টিমমেট নিয়ে জয়েন করবেন তাদেরকে সাথে নিয়ে বসবেন! নিজের ইচ্ছা মত টিম Change করা যাবে না!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে!)',
    ],
  },
  'LOST TO WIN': {
    category: 'LOST TO WIN',
    title: 'Tx Tour BD: Lost To win 2 vs 2. Rules:',
    lines: [
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(এই Mode এ যে Player ম্যাচ হারবে, সেই Player Reward পাবে!)',
      '(ম্যাচ চলাকালীন সকল প্লেয়ারকে ম্যাচের শেষ পর্যন্ত থাকতে হবে কোনো প্রকার Back দিতে পারবেন না!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে!)',
    ],
  },
  'LOSS TO WIN': {
    category: 'LOST TO WIN',
    title: 'Tx Tour BD: Lost To win 2 vs 2. Rules:',
    lines: [
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(এই Mode এ যে Player ম্যাচ হারবে, সেই Player Reward পাবে!)',
      '(ম্যাচ চলাকালীন সকল প্লেয়ারকে ম্যাচের শেষ পর্যন্ত থাকতে হবে কোনো প্রকার Back দিতে পারবেন না!)',
      '(ম্যাচ শেষ হওয়ার ৫-১০ মিনিট এর মধ্যে Winning Reward Account এ Add হয়ে যাবে!)',
    ],
  },
  'FREE MATCH': {
    category: 'FREE MATCH',
    title: 'Tx Tour BD: FREE MATCH Rules:',
    lines: [
      '(ম্যাচ সময়ের ২/৪ মিনিট আগে Room Details এ ক্লিক করে iD & Pass পাবেন! ম্যাচ শুরু হওয়ার ১/২ মিনিট আগে কাস্টম এ জয়েন হবেন! না করলে কোনো প্রকার রিফান্ড পাবেন না! দোয়া করে কেউ Notification এর আশায় বসে থাকবেন না! কারণ আপনার নেটওয়ার্ক সমস্যা করতে পারে তাহলে নোটিফিকেশন জাবে না!)',
      '(game ID Name Stylish হলে অবশ্যই Stylish নাম লিখে রেজিষ্ট্রেশন করতে হবে!)',
      '(সন্দেহজনক User কে কোন নোটিশ ছাড়া BAN করা হবে!)',
      '(ম্যাচে কোনো প্রকার গাড়ি বা মনস্টার ট্রাক চালানো জাবে না!)',
      '(40 লেভেলের কম Free Fire আইডি দিয়ে রুম জয়েন করলে রুম থেকে কিক দেওয়া হবে, কোন প্রকার Refund দেওয়া হবে না!)',
      '(যদি হ্যাক ইউজ এবং টিমিং করার সময় ধরা পড়ে, তাহলে TX TOUR BD থেকে বিনা নোটিশে BAN করা হবে!)',
    ],
  },
};

export function normalizeCategory(rawCategory?: string): MatchCategory {
  const c = (rawCategory || '').trim().toUpperCase();
  if (c === 'FREE MATCH' || c === 'SPECIAL MATCH' || c.includes('FREE') || c.includes('SPECIAL')) return 'FREE MATCH';
  if (c === 'LONE WOLF HEADSHOT' || c.includes('HEADSHOT') || c.includes('HS')) return 'LONE WOLF HEADSHOT';
  if (c === 'LOST TO WIN' || c === 'LOSS TO WIN' || c.includes('LOST') || c.includes('LOSS')) return 'LOST TO WIN';
  if (
    c.includes('CS') ||
    c.includes('CLASH') ||
    c.includes('4V4') ||
    c.includes('4 VS 4') ||
    c.includes('2V2') ||
    c.includes('2 VS 2')
  ) {
    return 'CS 1V1, 2V2';
  }
  if (c === 'LONE WOLF' || c.includes('WOLF') || c.includes('1V1')) return 'LONE WOLF';
  if (c === 'BR MATCH' || c.includes('BR') || c.includes('BATTLE')) return 'BR MATCH';
  return 'BR MATCH';
}

export function getTournamentCategory(t: Tournament): MatchCategory {
  if (t.category) {
    return normalizeCategory(t.category);
  }
  const title = (t.title || '').toUpperCase();
  if (t.entryFee === 0 || title.includes('FREE')) return 'FREE MATCH';
  if (title.includes('HEADSHOT') || title.includes('HS')) return 'LONE WOLF HEADSHOT';
  if (
    title.includes('LOST TO WIN') ||
    title.includes('LOST-TO-WIN') ||
    title.includes('LOST') ||
    title.includes('LOSS TO WIN') ||
    title.includes('LOSS-TO-WIN') ||
    title.includes('LOSS')
  ) {
    return 'LOST TO WIN';
  }
  if (
    t.gameMode === 'CLASH_SQUAD' ||
    title.includes('CS') ||
    title.includes('4V4') ||
    title.includes('4 VS 4') ||
    title.includes('2V2')
  ) {
    return 'CS 1V1, 2V2';
  }
  if (t.gameMode === 'LONE_WOLF' || title.includes('LONE WOLF') || title.includes('1V1') || title.includes('1 VS 1')) return 'LONE WOLF';
  return 'BR MATCH';
}

export function isPlacementPrizeCategory(rawCategory?: string): boolean {
  const cat = normalizeCategory(rawCategory);
  return cat === 'BR MATCH' || cat === 'FREE MATCH';
}

export function supportsPerKillPrize(rawCategory?: string): boolean {
  const cat = normalizeCategory(rawCategory);
  return cat === 'BR MATCH' || cat === 'FREE MATCH';
}

export function formatGameModeLabel(gameMode?: string): string {
  switch ((gameMode || '').trim().toUpperCase()) {
    case 'LONE_WOLF':
      return 'Lone Wolf';
    case 'CLASH_SQUAD':
      return 'Clash Squad';
    case 'BATTLE_ROYALE':
    default:
      return 'Battle Royale';
  }
}

export function formatShortGameModeBadge(
  tournament: Pick<Tournament, 'gameMode' | 'category'>
): string {
  const mode = (tournament.gameMode || '').trim().toUpperCase();
  const cat = (tournament.category || '').trim().toUpperCase();
  if (mode === 'LONE_WOLF') return 'LONE WOLF';
  if (mode === 'CLASH_SQUAD') return 'CS';
  if (mode === 'BATTLE_ROYALE') {
    if (cat === 'LONE WOLF' || cat === 'LONE WOLF HEADSHOT') return 'LONE WOLF';
    return 'BR';
  }
  if (cat === 'LONE WOLF' || cat === 'LONE WOLF HEADSHOT') return 'LONE WOLF';
  if (cat === 'CS 4V4' || cat === 'CS 1V1, 2V2') return 'CS';
  return 'BR';
}

export function formatEntryTypeLabel(
  tournament: Pick<Tournament, 'gameMode' | 'type' | 'category'>
): string {
  const format = (tournament.type || '').trim().toUpperCase();
  const mode = (tournament.gameMode || '').trim().toUpperCase();
  const cat = (tournament.category || '').trim().toUpperCase();

  if (mode === 'LONE_WOLF') {
    return `LONE WOLF ${format || 'DUO'}`;
  }

  if (mode === 'CLASH_SQUAD') {
    return `CS ${format || 'SQUAD'}`;
  }

  if (cat === 'LONE WOLF' || cat === 'LONE WOLF HEADSHOT') {
    return `LONE WOLF ${format || 'DUO'}`;
  }

  if (mode === 'BATTLE_ROYALE') {
    return `${format || 'SQUAD'} (BR)`;
  }

  if (cat === 'CS 4V4' || cat === 'CS 1V1, 2V2') {
    return `CS ${format || 'SQUAD'}`;
  }

  return `${format || 'SQUAD'} (BR)`;
}

export function getCategoryRuleSet(rawCategory?: string): CategoryRuleSet {
  const cat = normalizeCategory(rawCategory);
  return CATEGORY_RULES[cat];
}

export function getCategoryRulesText(rawCategory?: string): string {
  const ruleSet = getCategoryRuleSet(rawCategory);
  return `${ruleSet.title}\n${ruleSet.lines.join('\n')}`;
}

export function getCategoryLogoUrl(rawCategory?: string): string {
  const cat = normalizeCategory(rawCategory);
  switch (cat) {
    case 'FREE MATCH':
      return '/assets/aistudio/IMG-20261119-WA4163_e7319484.jpg';
    case 'BR MATCH':
      return '/assets/categories/cat2_br_match.jpg';
    case 'LONE WOLF':
      return '/assets/categories/cat3_lone_wolf.jpg';
    case 'CS 1V1, 2V2':
    case 'CS 4V4':
      return '/assets/categories/cat4_cs_4v4.jpg';
    case 'LONE WOLF HEADSHOT':
      return '/assets/categories/cat5_lone_wolf_headshot.jpg';
    case 'LOST TO WIN':
    case 'LOSS TO WIN':
      return '/assets/categories/cat6_loss_to_win.jpg';
    default:
      return '/assets/categories/cat2_br_match.jpg';
  }
}

export const MATCH_TYPE_BANNER_URLS: Record<MatchCategory, string> = {
  'FREE MATCH': '/assets/match-banners/free_match.jpg',
  'BR MATCH': '/assets/match-banners/br_match.jpg',
  'LONE WOLF': '/assets/aistudio/IMG_20261115_162205_757e4f2d.jpg',
  'LONE WOLF HEADSHOT': '/assets/aistudio/IMG-20261115-WA4224_90e1a792.jpg',
  'CS 1V1, 2V2': '/assets/aistudio/IMG-20261115-WA0329_ca82af70.jpg',
  'CS 4V4': '/assets/aistudio/IMG-20261115-WA0329_ca82af70.jpg',
  'LOST TO WIN': '/assets/aistudio/IMG-20261115-WA4986_a542a108.jpg',
  'LOSS TO WIN': '/assets/aistudio/IMG-20261115-WA4986_a542a108.jpg',
};

export function getMatchBannerUrl(rawCategory?: string): string {
  const cat = normalizeCategory(rawCategory);
  return MATCH_TYPE_BANNER_URLS[cat] || '/assets/match-banners/br_match.jpg';
}

export function isPlaceholderBannerUrl(url?: string | null): boolean {
  const clean = (url || '').trim().toLowerCase();
  if (!clean) return true;
  if (clean.includes('images.unsplash.com')) return true;
  return false;
}

export function isBuiltInCategoryBannerUrl(url?: string | null): boolean {
  const clean = (url || '').trim().toLowerCase();
  if (!clean) return true;
  return (
    clean.startsWith('/assets/match-banners/') ||
    clean.startsWith('/assets/categories/') ||
    clean.startsWith('/assets/aistudio/')
  );
}

export function resolveTournamentBannerUrl(tournament: Partial<Tournament>): string {
  const category = tournament.category
    ? normalizeCategory(tournament.category)
    : tournament.id
    ? getTournamentCategory(tournament as Tournament)
    : 'BR MATCH';
  const rawBanner = (tournament.bannerUrl || '').trim();
  if (!isPlaceholderBannerUrl(rawBanner) && !isBuiltInCategoryBannerUrl(rawBanner)) {
    return rawBanner;
  }
  return getMatchBannerUrl(category);
}

export function getMatchTypeBadgeLabel(category: MatchCategory): string {
  switch (category) {
    case 'LONE WOLF':
      return 'LONE WOLF';
    case 'LONE WOLF HEADSHOT':
      return 'LONE WOLF HEADSHOT';
    case 'CS 1V1, 2V2':
    case 'CS 4V4':
      return 'CS MATCH';
    case 'FREE MATCH':
      return 'SPECIAL MATCH';
    case 'LOST TO WIN':
    case 'LOSS TO WIN':
      return 'LOST TO WIN';
    case 'BR MATCH':
    default:
      return 'BR MATCH';
  }
}

const MAP_BN_LABELS: Record<string, string> = {
  bermuda: 'Bermuda (বারমুডা)',
  purgatory: 'Purgatory (পার্গেটোরি)',
  kalahari: 'Kalahari (কালাহারি)',
  alpine: 'Alpine (আলপাইন)',
  nextra: 'Nextra (নেক্সট্রা)',
  nextera: 'Nextra (নেক্সট্রা)',
  'iron cage': 'Iron Cage (আইরন কেজ)',
};

export function formatMatchMapLabel(mapName?: string, category?: MatchCategory): string {
  const trimmed = (mapName || '').trim();
  if (!trimmed) {
    return category === 'LONE WOLF' || category === 'LONE WOLF HEADSHOT'
      ? 'Iron Cage (আইরন কেজ)'
      : 'Bermuda (বারমুডা)';
  }
  if (trimmed.includes('(')) return trimmed;
  const matched = MAP_BN_LABELS[trimmed.toLowerCase()];
  return matched || trimmed;
}

export function formatMatchTimeOnly(timeStr?: string): string {
  const cleanTime = (timeStr || '').trim();
  if (!cleanTime) return 'TBA';
  const tMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (tMatch) {
    const h = parseInt(tMatch[1], 10);
    const m = tMatch[2];
    const mer = tMatch[3]?.toUpperCase();
    if (mer) {
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${String(h12).padStart(2, '0')}:${m} ${mer}`;
    }
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${m} ${period}`;
  }
  return cleanTime;
}

const BANGLA_DIGITS_MAP: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

export function toBanglaDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => BANGLA_DIGITS_MAP[d] ?? d);
}

const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bLONE\s+WOLF\b/gi, 'লোন উলফ'],
  [/\bBR\s+MATCH\b/gi, 'বিআর ম্যাচ'],
  [/\bFULL\s+MAP\b/gi, 'ফুল ম্যাপ'],
  [/\bFREE\s+MATCH\b/gi, 'ফ্রি ম্যাচ'],
  [/\bFREE\s+FIRE\b/gi, 'ফ্রি ফায়ার'],
  [/\bCLASH\s+SQUAD\b/gi, 'ক্ল্যাশ স্কোয়াড'],
  [/\bBATTLE\s+ROYALE\b/gi, 'ব্যাটল রয়্যাল'],
  [/\bCUSTOM\s+ROOM\b/gi, 'কাস্টম রুম'],
  [/\bIRON\s+CAGE\b/gi, 'আইরন কেজ'],
  [/\bLOSS\s+TO\s+WIN\b/gi, 'লস টু উইন'],
  [/\bLOST\s+TO\s+WIN\b/gi, 'লস টু উইন'],
  [/\bONE\s+TAP\b/gi, 'ওয়ান ট্যাপ'],
  [/\bDESERT\s+EAGLE\b/gi, 'ডেজার্ট ঈগল'],
  [/\bPER\s+KILL\b/gi, 'প্রতি কিল'],
];

const WORD_TRANSLATIONS: Record<string, string> = {
  HEADSHOT: 'হেডশট',
  HS: 'হেডশট',
  SOLO: 'সোলো',
  DUO: 'ডুয়ো',
  SQUAD: 'স্কোয়াড',
  CS: 'সিএস',
  BR: 'বিআর',
  MATCH: 'ম্যাচ',
  FULL: 'ফুল',
  MAP: 'ম্যাপ',
  WOLF: 'উলফ',
  LONE: 'লোন',
  FREE: 'ফ্রি',
  VS: 'বনাম',
  V: 'বনাম',
  TOURNAMENT: 'টুর্নামেন্ট',
  CUSTOM: 'কাস্টম',
  ROOM: 'রুম',
  BERMUDA: 'বারমুডা',
  PURGATORY: 'পার্গেটোরি',
  KALAHARI: 'কালাহারি',
  ALPINE: 'আলপাইন',
  NEXTRA: 'নেক্সট্রা',
  NEXTERA: 'নেক্সট্রা',
  ONLY: 'অনলি',
  UNLIMITED: 'আনলিমিটেড',
  AMMO: 'অ্যামো',
  CHALLENGE: 'চ্যালেঞ্জ',
  PRO: 'প্রো',
  KING: 'কিং',
  MASTER: 'মাস্টার',
  NIGHT: 'নাইট',
  MORNING: 'মর্নিং',
  EVENING: 'ইভিনিং',
  DAILY: 'ডেইলি',
  WEEKLY: 'উইকলি',
  SPECIAL: 'স্পেশাল',
  MEGA: 'মেগা',
  GRAND: 'গ্র্যান্ড',
  FINAL: 'ফাইনাল',
  CUP: 'কাপ',
  CHAMPION: 'চ্যাম্পিয়ন',
  CHAMPIONSHIP: 'চ্যাম্পিয়নশিপ',
  LEAGUE: 'লিগ',
  SERIES: 'সিরিজ',
  SEASON: 'সিজন',
  KILL: 'কিল',
  WIN: 'উইন',
  BOOYAH: 'বুইয়াহ',
  ROYAL: 'রয়্যাল',
  ROYALE: 'রয়্যাল',
  CLASH: 'ক্ল্যাশ',
  BATTLE: 'ব্যাটল',
  GUN: 'গান',
  SNIPER: 'স্নাইপার',
  SHOTGUN: 'শটগান',
  CLASSIC: 'ক্লাসিক',
  RANKED: 'র‍্যাংকড',
  RANK: 'র‍্যাংক',
  GAME: 'গেম',
  PLAY: 'প্লে',
  PLAYER: 'প্লেয়ার',
  PLAYERS: 'প্লেয়ার্স',
  TEAM: 'টিম',
  NO: 'নো',
  WITH: 'উইথ',
  AND: 'অ্যান্ড',
  THE: 'দ্য',
  OF: 'অফ',
  IN: 'ইন',
  FOR: 'ফর',
  TO: 'টু',
  TX: 'টিএক্স',
  BD: 'বিডি',
  FF: 'এফএফ',
  BG: 'বিজি',
};

function transliterateEnglishWordToBangla(rawWord: string): string {
  const upper = rawWord.toUpperCase();
  if (WORD_TRANSLATIONS[upper]) {
    return WORD_TRANSLATIONS[upper];
  }
  if (/^\d+$/.test(rawWord)) {
    return toBanglaDigits(rawWord);
  }
  if (!/[A-Za-z]/.test(rawWord)) {
    return toBanglaDigits(rawWord);
  }

  let w = rawWord.toLowerCase();
  // Common suffix/cluster normalizations
  w = w
    .replace(/tion\b/g, 'shon')
    .replace(/sion\b/g, 'shon')
    .replace(/ight/g, 'ait')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks');

  const independentVowels: Record<string, string> = {
    aa: 'আ',
    ai: 'আই',
    au: 'আউ',
    aw: 'অ',
    ay: 'এ',
    ea: 'ই',
    ee: 'ই',
    ei: 'এই',
    ey: 'এ',
    ie: 'ই',
    oa: 'ও',
    oi: 'অই',
    oo: 'উ',
    ou: 'আউ',
    ow: 'আও',
    oy: 'অয়',
    a: 'অ্যা',
    e: 'ই',
    i: 'ই',
    o: 'ও',
    u: 'আ',
  };

  const vowelSigns: Record<string, string> = {
    aa: 'া',
    ai: 'াই',
    au: 'াউ',
    aw: 'ো',
    ay: 'ে',
    ea: 'ি',
    ee: 'ী',
    ei: 'েই',
    ey: 'ে',
    ie: 'ি',
    oa: 'ো',
    oi: 'ই',
    oo: 'ু',
    ou: 'াউ',
    ow: 'াও',
    oy: 'য়',
    a: 'া',
    e: 'ে',
    i: 'ি',
    o: 'ো',
    u: 'ু',
  };

  const consonants: Record<string, string> = {
    sh: 'শ',
    ch: 'চ',
    th: 'থ',
    kh: 'খ',
    gh: 'ঘ',
    bh: 'ভ',
    dh: 'ধ',
    jh: 'ঝ',
    ng: 'ং',
    b: 'ব',
    c: 'ক',
    d: 'ড',
    f: 'ফ',
    g: 'গ',
    h: 'হ',
    j: 'জ',
    k: 'ক',
    l: 'ল',
    m: 'ম',
    n: 'ন',
    p: 'প',
    q: 'ক',
    r: 'র',
    s: 'স',
    t: 'ট',
    v: 'ভ',
    w: 'ও',
    y: 'ই',
    z: 'জ',
  };

  let out = '';
  let i = 0;
  let prevWasConsonant = false;

  while (i < w.length) {
    const ch = w[i];
    if (/[0-9]/.test(ch)) {
      out += BANGLA_DIGITS_MAP[ch] ?? ch;
      prevWasConsonant = false;
      i += 1;
      continue;
    }

    const two = w.slice(i, i + 2);

    // Check consonant digraphs
    if (two in consonants) {
      out += consonants[two];
      prevWasConsonant = true;
      i += 2;
      continue;
    }

    // Soft 'c' before e/i/y -> স
    if (ch === 'c' && (w[i + 1] === 'e' || w[i + 1] === 'i' || w[i + 1] === 'y')) {
      out += 'স';
      prevWasConsonant = true;
      i += 1;
      continue;
    }

    // Skip silent trailing 'e' after consonant if word length > 2
    if (ch === 'e' && i === w.length - 1 && w.length > 2 && prevWasConsonant) {
      i += 1;
      continue;
    }

    // Two-letter vowels
    if (two in vowelSigns) {
      out += prevWasConsonant ? vowelSigns[two] : independentVowels[two];
      prevWasConsonant = false;
      i += 2;
      continue;
    }

    // Single vowel
    if (ch in vowelSigns) {
      if (ch === 'y' && prevWasConsonant && i === w.length - 1) {
        out += 'ি';
      } else {
        out += prevWasConsonant ? vowelSigns[ch] : independentVowels[ch];
      }
      prevWasConsonant = false;
      i += 1;
      continue;
    }

    // Double consonant (e.g. 'll', 'tt', 'ss') -> emit once for cleaner Bangla readability
    if (ch in consonants) {
      if (w[i + 1] === ch) {
        out += consonants[ch];
        prevWasConsonant = true;
        i += 2;
        continue;
      }
      out += consonants[ch];
      prevWasConsonant = true;
      i += 1;
      continue;
    }

    out += ch;
    prevWasConsonant = false;
    i += 1;
  }

  return out;
}

export function generateAutoBanglaTitle(englishTitle?: string): string {
  const clean = (englishTitle || '').trim();
  if (!clean) return '';

  let working = clean.replace(
    /(\d+)\s*V(?:S)?\.?\s*(\d+)/gi,
    (_match: string, a: string, b: string) => `${toBanglaDigits(a)} বনাম ${toBanglaDigits(b)}`
  );
  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) {
    working = working.replace(pattern, replacement);
  }

  // Convert remaining English words and digits while preserving punctuation/spaces
  const tokens = working.split(/([A-Za-z0-9]+)/);
  const converted = tokens
    .map((tok) => {
      if (!tok) return '';
      if (/^[A-Za-z0-9]+$/.test(tok)) {
        return transliterateEnglishWordToBangla(tok);
      }
      return toBanglaDigits(tok);
    })
    .join('');

  return converted.replace(/\s+/g, ' ').trim();
}

export function getDefaultBanglaSubtitle(
  tournament: Partial<Tournament>,
  category: MatchCategory
): string {
  if (tournament.title && tournament.title.trim().length > 0) {
    const autoBn = generateAutoBanglaTitle(tournament.title);
    if (autoBn) {
      return autoBn;
    }
  }
  if (tournament.titleBn && /[\u0980-\u09FF]/.test(tournament.titleBn)) {
    return tournament.titleBn.trim();
  }
  const format = (tournament.type || 'SOLO').toUpperCase();
  const formatBn =
    format === 'SOLO'
      ? 'সোলো ম্যাচ'
      : format === 'DUO'
      ? 'ডুয়ো ম্যাচ'
      : 'স্কোয়াড ম্যাচ';

  switch (category) {
    case 'LONE WOLF':
      return format === 'DUO'
        ? 'লোন উলফ ২ বনাম ২ চ্যালেঞ্জ'
        : 'লোন উলফ ১ বনাম ১ চ্যালেঞ্জ';
    case 'LONE WOLF HEADSHOT':
      return format === 'DUO'
        ? 'লোন উলফ ২ বনাম ২ হেডশট'
        : 'লোন উলফ ১ বনাম ১ হেডশট';
    case 'CS 1V1, 2V2':
    case 'CS 4V4':
      return `ক্ল্যাশ স্কোয়াড • ${formatBn}`;
    case 'FREE MATCH':
      return `ফ্রি এন্ট্রি টুর্নামেন্ট • ${formatBn}`;
    case 'LOST TO WIN':
    case 'LOSS TO WIN':
      return `লস টু উইন চ্যালেঞ্জ • ${formatBn}`;
    case 'BR MATCH':
    default:
      return `ব্যাটল রয়্যাল টুর্নামেন্ট • ${formatBn}`;
  }
}

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatMatchDateTimeLabel(dateStr?: string, timeStr?: string): string {
  const cleanDate = (dateStr || '').trim();
  const cleanTime = (timeStr || '').trim();

  let formattedDate = cleanDate;
  const ymd = cleanDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const year = ymd[1];
    const monthIdx = Math.max(0, Math.min(11, parseInt(ymd[2], 10) - 1));
    const day = ymd[3].padStart(2, '0');
    formattedDate = `${day} ${MONTH_SHORT_NAMES[monthIdx]} ${year}`;
  } else if (cleanDate) {
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const monthName = MONTH_SHORT_NAMES[parsed.getMonth()];
      const year = parsed.getFullYear();
      formattedDate = `${day} ${monthName} ${year}`;
    }
  }

  let formattedTime = cleanTime;
  const tMatch = cleanTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (tMatch) {
    let h = parseInt(tMatch[1], 10);
    const m = tMatch[2];
    const mer = tMatch[3]?.toUpperCase();
    if (mer) {
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      formattedTime = `${String(h12).padStart(2, '0')}:${m} ${mer}`;
    } else {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      formattedTime = `${String(h12).padStart(2, '0')}:${m} ${period}`;
    }
  }

  if (formattedDate && formattedTime) {
    return `${formattedDate} ${formattedTime}`;
  }
  return formattedDate || formattedTime || 'TBA';
}

export function parseTimeTo24Hour(timeStr?: string): { hours: number; minutes: number } {
  const clean = (timeStr || '').trim();
  if (!clean) return { hours: 20, minutes: 0 };

  const match = clean.match(/(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*(AM|PM|a\.m\.|p\.m\.))?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = Math.max(0, Math.min(59, parseInt(match[2], 10)));
    const lower = clean.toLowerCase();
    const token = (match[3] || '').replace(/\./g, '').toLowerCase();
    const isPM = token === 'pm' || (!token && /\bp\.?m\.?\b/i.test(lower));
    const isAM = token === 'am' || (!token && /\ba\.?m\.?\b/i.test(lower));

    if (isPM && hours < 12) hours += 12;
    else if (isAM && hours === 12) hours = 0;

    return {
      hours: Math.max(0, Math.min(23, hours)),
      minutes,
    };
  }

  const hourOnly = clean.match(/\b(\d{1,2})\s*(AM|PM)\b/i);
  if (hourOnly) {
    let hours = parseInt(hourOnly[1], 10);
    const mer = hourOnly[2].toUpperCase();
    if (mer === 'PM' && hours < 12) hours += 12;
    if (mer === 'AM' && hours === 12) hours = 0;
    return { hours: Math.max(0, Math.min(23, hours)), minutes: 0 };
  }

  return { hours: 20, minutes: 0 };
}

export function format24HourToInputValue(hours24: number, minutes: number): string {
  const h = String(Math.max(0, Math.min(23, hours24))).padStart(2, '0');
  const m = String(Math.max(0, Math.min(59, minutes))).padStart(2, '0');
  return `${h}:${m}`;
}

export function format24HourToDisplayTime(hours24: number, minutes: number): string {
  const hNorm = ((hours24 % 24) + 24) % 24;
  const mNorm = Math.max(0, Math.min(59, minutes));
  const period = hNorm >= 12 ? 'PM' : 'AM';
  const h12 = hNorm % 12 === 0 ? 12 : hNorm % 12;
  return `${h12}:${String(mNorm).padStart(2, '0')} ${period}`;
}

export function parseMatchDateAndTime(dateStr?: string, timeStr?: string): Date | null {
  const rawDate = (dateStr || '').trim();
  if (!rawDate) return null;

  let year: number;
  let month: number;
  let day: number;

  const ymd = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    year = parseInt(ymd[1], 10);
    month = parseInt(ymd[2], 10) - 1;
    day = parseInt(ymd[3], 10);
  } else {
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return null;
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  const { hours, minutes } = parseTimeTo24Hour(timeStr);
  return new Date(year, month, day, hours, minutes, 0, 0);
}

export function addMinutesToSchedule(
  matchDate: string | undefined,
  matchTime: string | undefined,
  deltaMinutes: number
): { matchDate: string; matchTime: string; timeInputValue: string } {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const baseDateStr = (matchDate || '').trim() || todayStr;
  const baseDate = parseMatchDateAndTime(baseDateStr, matchTime) || new Date();
  const next = new Date(baseDate.getTime() + deltaMinutes * 60 * 1000);

  const nextY = next.getFullYear();
  const nextM = String(next.getMonth() + 1).padStart(2, '0');
  const nextD = String(next.getDate()).padStart(2, '0');
  const nextHours = next.getHours();
  const nextMinutes = next.getMinutes();

  return {
    matchDate: `${nextY}-${nextM}-${nextD}`,
    matchTime: format24HourToDisplayTime(nextHours, nextMinutes),
    timeInputValue: format24HourToInputValue(nextHours, nextMinutes),
  };
}

export function applyTimeInputToSchedule(
  matchDate: string | undefined,
  hhmmValue: string
): { matchDate: string; matchTime: string } {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const parts = (hhmmValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  const hours24 = parts ? Math.max(0, Math.min(23, parseInt(parts[1], 10))) : 20;
  const minutes = parts ? Math.max(0, Math.min(59, parseInt(parts[2], 10))) : 0;

  return {
    matchDate: (matchDate || '').trim() || todayStr,
    matchTime: format24HourToDisplayTime(hours24, minutes),
  };
}


