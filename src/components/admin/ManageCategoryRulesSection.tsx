import React, { useEffect, useState } from 'react';
import { MatchCategory } from '../../types';
import {
  CATEGORY_RULES,
  EDITABLE_RULE_CATEGORIES,
} from '../../constants/categoryRules';
import {
  CategoryRulesOverrides,
  resetCategoryRulesToDefault,
  resolveCategoryRuleSet,
  saveCategoryRules,
  subscribeCategoryRules,
} from '../../services/rulesService';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';

export const ManageCategoryRulesSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] =
    useState<MatchCategory>('CS 1V1, 2V2');
  const [overrides, setOverrides] = useState<CategoryRulesOverrides>({});
  const [titleInput, setTitleInput] = useState('');
  const [linesInput, setLinesInput] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeCategoryRules((data) => {
      setOverrides(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const resolved = resolveCategoryRuleSet(selectedCategory, overrides);
    setTitleInput(resolved.title);
    setLinesInput([...resolved.lines]);
    setFeedback(null);
  }, [selectedCategory, overrides]);

  const handleLineChange = (index: number, value: string) => {
    setLinesInput((prev) => prev.map((line, i) => (i === index ? value : line)));
  };

  const handleMoveLine = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= linesInput.length) return;
    setLinesInput((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleRemoveLine = (index: number) => {
    if (linesInput.length <= 1) return;
    setLinesInput((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLine = () => {
    setLinesInput((prev) => [...prev, '']);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await saveCategoryRules(selectedCategory, titleInput, linesInput);
      setFeedback({
        type: 'success',
        text: `${selectedCategory} এর Rules সফলভাবে আপডেট করা হয়েছে! প্লেয়াররা এখন নতুন Rules দেখতে পাবে।`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Rules save করতে সমস্যা হয়েছে।',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await resetCategoryRulesToDefault(selectedCategory);
      const def = CATEGORY_RULES[selectedCategory];
      setTitleInput(def.title);
      setLinesInput([...def.lines]);
      setFeedback({
        type: 'success',
        text: `${selectedCategory} এর Rules ডিফল্ট অবস্থায় রিসেট করা হয়েছে।`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Reset করতে সমস্যা হয়েছে।',
      });
    } finally {
      setSaving(false);
    }
  };

  const isCustomized = Boolean(overrides[selectedCategory]);

  return (
    <div className="p-6 rounded-2xl bg-[#0D1428] border border-sky-500/20 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-gaming uppercase tracking-wider text-sky-400">
              Match &amp; Slot Box Rules Manager
            </h3>
            <p className="text-[11px] text-slate-400">
              CS 1V1, CS 2V2, Lone Wolf Headshot, Lone Wolf সহ সব ক্যাটাগরির Rules এখান থেকে পরিবর্তন করুন।
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={saving || !isCustomized}
          className="px-3.5 py-2 rounded-xl bg-[#111D35] hover:bg-slate-800 disabled:opacity-45 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Default</span>
        </button>
      </div>

      {/* Category Selector */}
      <div className="flex flex-wrap gap-2">
        {EDITABLE_RULE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          const modified = Boolean(overrides[cat.id]);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-gaming transition-all cursor-pointer flex items-center gap-1.5 border ${
                active
                  ? 'bg-gradient-to-r from-[#CFA84B] via-[#F4D77A] to-[#CFA84B] text-black border-[#F4D77A]'
                  : 'bg-[#111D35] text-slate-300 hover:text-white border-slate-700'
              }`}
            >
              <span>{cat.label}</span>
              {modified && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    active ? 'bg-black' : 'bg-emerald-400'
                  }`}
                  title="Customized"
                />
              )}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/60 border-red-500/40 text-red-300'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Rules Header Title
          </label>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="e.g. Tx Tour BD: Lone Wolf Rules:"
            className="w-full px-3.5 py-2.5 bg-[#111D35] border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-sky-400"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Rules List (উপরে ১ নম্বর থেকে শুরু হবে)
            </label>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </button>
          </div>

          {linesInput.map((line, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2.5 rounded-xl bg-[#111D35]/75 border border-slate-800"
            >
              <span className="w-7 h-7 rounded-lg bg-[#070B18] border border-slate-700 text-amber-400 font-black font-gaming text-xs flex items-center justify-center shrink-0 mt-1">
                {idx + 1}
              </span>
              <textarea
                rows={2}
                value={line}
                onChange={(e) => handleLineChange(idx, e.target.value)}
                placeholder={`Rule #${idx + 1}`}
                className="flex-1 px-3 py-2 bg-[#070B18] border border-slate-700 rounded-lg text-white text-xs leading-relaxed focus:outline-none focus:border-sky-400 resize-y"
              />
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveLine(idx, -1)}
                  disabled={idx === 0}
                  title="Move Up"
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveLine(idx, 1)}
                  disabled={idx === linesInput.length - 1}
                  title="Move Down"
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveLine(idx)}
                  disabled={linesInput.length <= 1}
                  title="Delete Rule"
                  className="p-1.5 rounded bg-red-950/60 hover:bg-red-900/80 disabled:opacity-35 text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 text-white font-bold font-gaming text-xs shadow-lg shadow-sky-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Rules (সংরক্ষণ করুন)'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
