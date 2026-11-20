import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { MatchCategory } from '../types';
import {
  CATEGORY_RULES,
  CategoryRuleSet,
  normalizeCategory,
} from '../constants/categoryRules';
import { handleFirestoreError, OperationType } from './firestoreError';

export type CategoryRulesOverrides = Partial<
  Record<
    MatchCategory,
    {
      title: string;
      lines: string[];
    }
  >
>;

const CATEGORY_RULES_DOC_ID = 'categoryRules';
const LOCAL_CACHE_KEY = 'tx_category_rules_overrides_v1';

let memoryOverrides: CategoryRulesOverrides | null = null;

function readCachedOverrides(): CategoryRulesOverrides {
  if (memoryOverrides) return memoryOverrides;
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CategoryRulesOverrides;
    if (parsed && typeof parsed === 'object') {
      memoryOverrides = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

function writeCachedOverrides(overrides: CategoryRulesOverrides): void {
  memoryOverrides = overrides;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore storage errors
  }
}

export function resolveCategoryRuleSet(
  rawCategory?: string,
  overrides?: CategoryRulesOverrides
): CategoryRuleSet {
  const cat = normalizeCategory(rawCategory);
  const base = CATEGORY_RULES[cat] || CATEGORY_RULES['BR MATCH'];
  const effectiveOverrides = overrides ?? readCachedOverrides();
  const custom = effectiveOverrides?.[cat];

  if (custom && Array.isArray(custom.lines) && custom.lines.length > 0) {
    return {
      category: cat,
      title: (custom.title || '').trim() || base.title,
      lines: custom.lines.map((l) => String(l).trim()).filter(Boolean),
    };
  }

  return base;
}

export function getLiveCategoryRulesText(rawCategory?: string): string {
  const ruleSet = resolveCategoryRuleSet(rawCategory);
  return `${ruleSet.title}\n${ruleSet.lines.join('\n')}`;
}

export async function fetchCategoryRulesOverrides(): Promise<CategoryRulesOverrides> {
  try {
    const snap = await getDoc(doc(db, 'settings', CATEGORY_RULES_DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as { categories?: CategoryRulesOverrides };
      const overrides = data?.categories || {};
      writeCachedOverrides(overrides);
      return overrides;
    }
    return {};
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `settings/${CATEGORY_RULES_DOC_ID}`);
    return readCachedOverrides();
  }
}

export function subscribeCategoryRules(
  callback: (overrides: CategoryRulesOverrides) => void
): () => void {
  // Emit cached rules immediately for instant UI rendering
  callback(readCachedOverrides());

  const docRef = doc(db, 'settings', CATEGORY_RULES_DOC_ID);
  const unsub = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { categories?: CategoryRulesOverrides };
        const overrides = data?.categories || {};
        writeCachedOverrides(overrides);
        callback(overrides);
      } else {
        writeCachedOverrides({});
        callback({});
      }
    },
    (err) => {
      console.error('Category rules snapshot error:', err);
    }
  );

  return unsub;
}

export async function saveCategoryRules(
  category: MatchCategory,
  title: string,
  lines: string[]
): Promise<void> {
  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  if (cleanLines.length === 0) {
    throw new Error('কমপক্ষে ১টি Rule থাকতে হবে! (At least 1 rule line is required)');
  }

  const normalizedCat = normalizeCategory(category);
  const base = CATEGORY_RULES[normalizedCat];
  const cleanTitle = title.trim() || base.title;

  const current = { ...readCachedOverrides() };
  current[normalizedCat] = {
    title: cleanTitle,
    lines: cleanLines,
  };

  try {
    await setDoc(
      doc(db, 'settings', CATEGORY_RULES_DOC_ID),
      {
        id: CATEGORY_RULES_DOC_ID,
        categories: current,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    writeCachedOverrides(current);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `settings/${CATEGORY_RULES_DOC_ID}`);
  }
}

export async function resetCategoryRulesToDefault(
  category: MatchCategory
): Promise<void> {
  const normalizedCat = normalizeCategory(category);
  const current = { ...readCachedOverrides() };
  delete current[normalizedCat];

  try {
    await setDoc(
      doc(db, 'settings', CATEGORY_RULES_DOC_ID),
      {
        id: CATEGORY_RULES_DOC_ID,
        categories: current,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    writeCachedOverrides(current);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `settings/${CATEGORY_RULES_DOC_ID}`);
  }
}
