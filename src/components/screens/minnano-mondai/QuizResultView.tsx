'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Flag, Check } from 'lucide-react';
import type { QuizQuestionResult, ShuffledQuestion } from '../MinnanoMondaiScreen';
import { useGameStore } from '@/store/useGameStore';

// ============================================================
// 型
// ============================================================

type QuizResultCategory = {
  label: string;
  icon: string;
  ribbonColor: string;
  glow: string;
};

type QuestionReaction = 'good' | 'bad' | null;

type QuizResultViewProps = {
  cat: QuizResultCategory;
  questions: ShuffledQuestion[];
  results: QuizQuestionResult[];
  onRetry: () => void;
  onBackToCategories: () => void;
};

type Rank = 'S' | 'A' | 'B' | 'C';

// ============================================================
// ランク設定
// ============================================================

const RANK_CFG: Record<
  Rank,
  {
    color: string;
    shadow: string;
    bg: string;
    border: string;
    ambient: string;
    messageTextColor: string;
    message: string;
    sub: string;
  }
> = {
  S: {
    color: '#fbbf24',
    shadow:
      '0 4px 28px rgba(251,191,36,0.22), 0 0 40px rgba(251,191,36,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
    bg: 'radial-gradient(ellipse at 50% 32%, rgba(58,50,40,0.98) 0%, rgba(42,38,34,0.96) 100%)',
    border: 'rgba(251,191,36,0.28)',
    ambient: 'rgba(251,191,36,0.10)',
    messageTextColor: '#f3e8d4',
    message: 'S判定だよ…かんぺきぃ',
    sub: '全問正解です！さすがですっ！',
  },
  A: {
    color: '#67e8f9',
    shadow:
      '0 4px 24px rgba(103,232,249,0.18), 0 0 36px rgba(103,232,249,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
    bg: 'radial-gradient(ellipse at 50% 32%, rgba(32,44,56,0.98) 0%, rgba(24,36,46,0.96) 100%)',
    border: 'rgba(103,232,249,0.28)',
    ambient: 'rgba(103,232,249,0.10)',
    messageTextColor: '#bae6fd',
    message: 'すごいよ。A判定',
    sub: 'あと少しでSランクだったよ！',
  },
  B: {
    color: '#6ee7b7',
    shadow:
      '0 4px 22px rgba(110,231,183,0.15), 0 0 32px rgba(110,231,183,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
    bg: 'radial-gradient(ellipse at 50% 32%, rgba(32,50,44,0.98) 0%, rgba(26,40,36,0.96) 100%)',
    border: 'rgba(110,231,183,0.26)',
    ambient: 'rgba(110,231,183,0.10)',
    messageTextColor: '#a7f3d0',
    message: 'もうちょっとでAだよ',
    sub: 'あと数問！次は届くよ！',
  },
  C: {
    color: '#c4b5fd',
    shadow:
      '0 4px 20px rgba(196,181,253,0.14), 0 0 28px rgba(196,181,253,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
    bg: 'radial-gradient(ellipse at 50% 32%, rgba(46,38,62,0.98) 0%, rgba(34,30,48,0.96) 100%)',
    border: 'rgba(196,181,253,0.28)',
    ambient: 'rgba(196,181,253,0.10)',
    messageTextColor: '#ddd6fe',
    message: '…もう一度挑戦しない？',
    sub: 'きっといけるって信じてるよ。',
  },
};

const rankLetterTextShadow = (glow: string) =>
  [
    '0 0 1px rgba(12,8,6,0.95)',
    '0 0 2px rgba(12,8,6,0.82)',
    '0 0 4px rgba(12,8,6,0.55)',
    '0 1px 3px rgba(0,0,0,0.32)',
    '0 2px 10px rgba(0,0,0,0.14)',
    glow,
  ].join(', ');

const calcRank = (score: number): Rank => {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  return 'C';
};

const getKey = (q: ShuffledQuestion | undefined, i: number) => q?.id ?? `idx-${i}`;
const getChoicePickCount = (q: ShuffledQuestion, choiceIndex: number): number => {
  if (choiceIndex === 0) return Math.max(0, Number(q.choicePick0 ?? 0));
  if (choiceIndex === 1) return Math.max(0, Number(q.choicePick1 ?? 0));
  if (choiceIndex === 2) return Math.max(0, Number(q.choicePick2 ?? 0));
  if (choiceIndex === 3) return Math.max(0, Number(q.choicePick3 ?? 0));
  return 0;
};
const calcPercent = (numerator: number, denominator: number): number =>
  denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
const getSourceChoiceIndex = (q: ShuffledQuestion, displayIndex: number): number | null => {
  const mapped = q.displayChoiceSourceIndices?.[displayIndex];
  if (typeof mapped === 'number' && mapped >= 0 && mapped <= 3) return mapped;
  const displayChoice = q.displayChoices?.[displayIndex];
  if (typeof displayChoice !== 'string') return null;
  const byText = q.choices.findIndex((c) => c === displayChoice);
  return byText >= 0 ? byText : null;
};

type ReactionCounter = { good: number; bad: number };

const REACTION_GUEST_KEY = 'academy_reaction_guest_key';
const createGuestReactionKey = (): string => {
  try {
    const stored = window.localStorage.getItem(REACTION_GUEST_KEY);
    if (stored && stored.trim()) return stored;
    const generated = `g_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(REACTION_GUEST_KEY, generated);
    return generated;
  } catch {
    return `g_fallback_${Date.now().toString(36)}`;
  }
};

const persistAcademyReaction = async (payload: {
  questionId: string;
  voterKey: string;
  nextReaction: QuestionReaction;
}): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const res = await fetch('/api/academy-reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let reason = `status_${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) reason = `${reason}:${body.error}`;
      } catch {
        // ignore
      }
      return { ok: false, reason };
    }
    const body = (await res.json()) as { persisted?: boolean; reason?: string };
    if (body?.persisted === false && body?.reason) return { ok: false, reason: body.reason };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String((error as Error)?.message ?? error ?? 'unknown') };
  }
};

// ============================================================
// カウントアップ
// ============================================================

const useCountUp = (target: number, duration = 1100, delay = 0) => {
  const [val, setVal] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    ran.current = false;
    setVal(0);

    const t = setTimeout(() => {
      if (ran.current) return;
      ran.current = true;
      const s = performance.now();

      const tick = (now: number) => {
        const p = Math.min((now - s) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, delay);

    return () => clearTimeout(t);
  }, [target, duration, delay]);

  return val;
};

// ============================================================
// 背景パーティクル
// ============================================================

const PARTICLES = Array.from({ length: 38 }, (_, i) => ({
  id: i,
  w: 1 + (i % 3) * 0.7,
  left: (i * 47 + 13) % 100,
  top: (i * 31 + 7) % 100,
  dur: 2.2 + (i % 5) * 0.6,
  del: (i * 0.37) % 5,
}));

const BgFx = ({ ambient }: { ambient: string }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {PARTICLES.map((p) => (
      <div
        key={p.id}
        className="absolute rounded-full bg-white"
        style={{
          width: p.w,
          height: p.w,
          left: `${p.left}%`,
          top: `${p.top}%`,
          opacity: 0.07,
          animation: `qrv-tw ${p.dur}s ease-in-out ${p.del}s infinite`,
        }}
      />
    ))}
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${ambient} 0%, transparent 55%)`,
      }}
    />
  </div>
);

// ============================================================
// 通報
// ============================================================

const REPORT_REASONS = [
  {
    id: 'copyright',
    label: '著作権の侵害',
    detail: '書籍・Web・試験問題などの無断転載が含まれていると思われる',
  },
  {
    id: 'morals',
    label: '公序良俗に反する内容',
    detail: '差別・暴力・わいせつなど不適切な表現が含まれている',
  },
  {
    id: 'wrong',
    label: '問題・解答が明らかに誤っている',
    detail: '正解が間違っている、または問題文が意味をなさない',
  },
  {
    id: 'spam',
    label: 'スパム・無関係なコンテンツ',
    detail: '広告・宣伝・まったく関係のない内容が含まれている',
  },
] as const;

type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

const ReportModal = ({
  questionId,
  reporterKey,
  onClose,
}: {
  questionId: string;
  reporterKey: string;
  onClose: () => void;
}) => {
  const [checks, setChecks] = useState<Record<ReportReasonId, boolean>>({
    copyright: false,
    morals: false,
    wrong: false,
    spam: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canSubmit = Object.values(checks).some(Boolean);

  const handleSubmit = async () => {
    if (!reporterKey.trim()) {
      setSubmitError('通信の準備中です。しばらくしてからお試しください。');
      return;
    }

    const reasons = REPORT_REASONS.filter((r) => checks[r.id]).map((r) => r.id);

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/academy-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, reasons, reporterKey }),
      });

      let body: { success?: boolean; error?: string; message?: string } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        // ignore
      }

      if (!res.ok) {
        if (res.status === 404 && body?.error === 'QUESTION_NOT_FOUND') {
          setSubmitError('問題が見つかりませんでした。');
        } else if (res.status === 409 && body?.error === 'REPORT_ALREADY_CLOSED') {
          setSubmitError(body?.message ?? 'この通報はすでに対応済みです。');
        } else {
          setSubmitError('送信に失敗しました。時間をおいて再度お試しください。');
        }
        return;
      }

      if (!body?.success) {
        setSubmitError('送信に失敗しました。');
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(25,10,55,0.98) 0%, rgba(8,3,22,0.99) 100%)',
          border: '1px solid rgba(196,181,253,0.3)',
          boxShadow: '0 0 40px rgba(139,92,246,0.35)',
        }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <Flag className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-white font-black text-sm">問題を通報する</p>
            <p className="text-white/45 text-[10px] mt-0.5">
              該当する理由を選択してください（複数可）
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-8 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-white font-black">通報を受け付けました</p>
            <p className="text-white/50 text-xs mt-1.5 mb-5">
              内容を確認の上、対応いたします。
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(220,210,255,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              閉じる
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.id}
                className="flex items-start gap-3 rounded-xl p-3 cursor-pointer transition-colors"
                style={{
                  background: checks[r.id]
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: checks[r.id]
                    ? '1px solid rgba(239,68,68,0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checks[r.id]}
                  onChange={(e) =>
                    setChecks((prev) => ({ ...prev, [r.id]: e.target.checked }))
                  }
                  className="mt-0.5 accent-red-500 shrink-0"
                />
                <div>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: checks[r.id] ? '#fca5a5' : 'rgba(220,210,255,0.9)',
                    }}
                  >
                    {r.label}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(200,190,255,0.45)' }}>
                    {r.detail}
                  </p>
                </div>
              </label>
            ))}

            <p className="text-[10px] text-center pt-1" style={{ color: 'rgba(200,190,255,0.35)' }}>
              虚偽の通報はご遠慮ください。内容は運営が確認します。
            </p>

            {submitError && (
              <p className="text-[11px] text-center text-red-300/90 pt-1">{submitError}</p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="py-3 rounded-xl text-sm font-bold disabled:opacity-45"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  color: 'rgba(200,190,255,0.75)',
                }}
              >
                キャンセル
              </button>
              <motion.button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit || submitting}
                className="py-3 rounded-xl text-sm font-black text-white disabled:opacity-35"
                style={{
                  background:
                    canSubmit && !submitting
                      ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                      : 'rgba(255,255,255,0.08)',
                  boxShadow:
                    canSubmit && !submitting ? '0 0 18px rgba(239,68,68,0.5)' : 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileTap={canSubmit && !submitting ? { scale: 0.95 } : {}}
              >
                {submitting ? '送信中…' : '通報する'}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ============================================================
// レビュー配色
// ============================================================

const REVIEW_SURFACE = {
  panelBg: 'rgba(15, 23, 42, 0.92)',
  panelBorder: '1px solid rgba(148, 163, 184, 0.16)',
  panelShadow: '0 14px 40px rgba(0,0,0,0.36)',

  headerBorder: '1px solid rgba(255,255,255,0.08)',
  title: '#f8fafc',
  text: '#e2e8f0',
  textSoft: '#94a3b8',
  textMuted: '#64748b',

  slot: 'rgba(51,65,85,0.58)',
  slotBorder: '1.5px solid rgba(148,163,184,0.15)',
  slotText: '#cbd5e1',

  correctBg: 'rgba(34,197,94,0.14)',
  correctBorder: '1.5px solid rgba(74,222,128,0.38)',
  correctText: '#86efac',
  correctBar: 'linear-gradient(90deg,#4ade80,#16a34a)',

  wrongBg: 'rgba(244,63,94,0.14)',
  wrongBorder: '1.5px solid rgba(251,113,133,0.38)',
  wrongText: '#fda4af',
  wrongBar: 'linear-gradient(90deg,#fb7185,#e11d48)',

  selectedBg: 'rgba(168,85,247,0.16)',
  selectedBorder: '1.5px solid rgba(192,132,252,0.36)',
  selectedText: '#d8b4fe',
  selectedBar: 'linear-gradient(90deg,#a78bfa,#7c3aed)',

  statGreenBg: 'rgba(34,197,94,0.12)',
  statGreenBorder: '1.5px solid rgba(74,222,128,0.28)',
  statGreenText: '#86efac',

  statGoldBg: 'rgba(250,204,21,0.12)',
  statGoldBorder: '1.5px solid rgba(250,204,21,0.26)',
  statGoldText: '#fcd34d',

  explanationBg: 'rgba(30, 41, 59, 0.78)',
  explanationBorder: '1.5px solid rgba(148, 163, 184, 0.18)',
  explanationLabel: '#94a3b8',
  explanationText: '#e2e8f0',

  buttonBg: 'rgba(255,255,255,0.05)',
  buttonBorder: '1px solid rgba(148,163,184,0.2)',
};

// ============================================================
// メインコンポーネント
// ============================================================

export const QuizResultView = ({
  cat,
  questions,
  results,
  onRetry,
  onBackToCategories,
}: QuizResultViewProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [reactions, setReactions] = useState<Record<string, QuestionReaction>>({});
  const [reactionCountsByQuestionId, setReactionCountsByQuestionId] = useState<
    Record<string, ReactionCounter>
  >({});
  const [savingReactionByQuestionId, setSavingReactionByQuestionId] = useState<
    Record<string, boolean>
  >({});
  const [voterKey, setVoterKey] = useState<string>('');
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const uid = useGameStore((s) => s.uid);

  const correctCount = results.filter((r) => r.isCorrect).length;
  const basePoint = results.reduce((s, r) => s + r.basePoint, 0);
  const timeBonus = results.reduce((s, r) => s + r.timeBonus, 0);
  const totalPoint = basePoint + timeBonus;
  const accuracy =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const maxPossibleTotal = questions.length > 0 ? questions.length * 20 : 0;
  const rankScore =
    maxPossibleTotal > 0 ? Math.min(100, Math.round((totalPoint / maxPossibleTotal) * 100)) : 0;
  const rank = calcRank(rankScore);
  const cfg = RANK_CFG[rank];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const next: Record<string, ReactionCounter> = {};
    for (const q of questions) {
      next[q.id] = {
        good: Math.max(0, Number(q.goodCount ?? 0)),
        bad: Math.max(0, Number(q.badCount ?? 0)),
      };
    }
    setReactionCountsByQuestionId(next);
  }, [questions]);

  useEffect(() => {
    if (uid) {
      setVoterKey(`uid:${uid}`);
      return;
    }
    setVoterKey(createGuestReactionKey());
  }, [uid]);

  useEffect(() => {
    if (!voterKey) return;

    const questionIds = questions.map((q) => q.id).filter(Boolean);
    if (questionIds.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/academy-reaction-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voterKey, questionIds }),
        });
        if (!res.ok) return;

        const body = (await res.json()) as { reactions?: Record<string, QuestionReaction> };
        const next = body?.reactions ?? {};

        if (cancelled) return;

        setReactions((prev) => {
          const clone = { ...prev };
          for (const qid of questionIds) clone[qid] = next[qid] ?? null;
          return clone;
        });
      } catch (error) {
        console.warn('[academy-reaction-state] fetch failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [questions, voterKey]);

  const dispTotal = useCountUp(totalPoint, 1000, 1000);
  const dispCorrect = useCountUp(correctCount, 700, 1000);
  const dispBonus = useCountUp(timeBonus, 800, 1400);
  const dispAcc = useCountUp(accuracy, 750, 1000);

  const safeTab = Math.min(Math.max(activeTab, 0), Math.max(questions.length - 1, 0));
  const activeQ = questions[safeTab];
  const activeRes = useMemo(
    () => results[safeTab] ?? results.find((r) => r.questionId === activeQ?.id),
    [activeQ, results, safeTab]
  );
  const activeKey = getKey(activeQ, safeTab);

  const activeReaction = activeQ ? reactions[activeQ.id] ?? null : null;
  const selectedIdx = activeRes?.selectedDisplayIndex ?? null;
  const selectedSourceIdx =
    activeQ && typeof selectedIdx === 'number' ? getSourceChoiceIndex(activeQ, selectedIdx) : null;

  const activePlayCountBase = Math.max(0, Number(activeQ?.playCount ?? 0));
  const activeCorrectCountBase = Math.max(0, Number(activeQ?.correctCount ?? 0));
  const activePlayCount = activePlayCountBase + (activeRes ? 1 : 0);
  const activeCorrectCount = activeCorrectCountBase + (activeRes?.isCorrect ? 1 : 0);
  const activeAccuracy = calcPercent(activeCorrectCount, activePlayCount);

  const activeReactionCounts = activeQ ? reactionCountsByQuestionId[activeQ.id] : undefined;
  const activeGoodCount =
    activeReactionCounts?.good ?? Math.max(0, Number(activeQ?.goodCount ?? 0));
  const isActiveReactionSaving = activeQ ? !!savingReactionByQuestionId[activeQ.id] : false;

  const toggleReaction = async (next: QuestionReaction) => {
    if (!activeQ || isActiveReactionSaving || !voterKey) return;

    const questionId = activeQ.id;
    const previousReaction = reactions[questionId] ?? null;
    const nextReaction = previousReaction === next ? null : next;

    if (previousReaction === nextReaction) return;

    const goodDelta =
      (nextReaction === 'good' ? 1 : 0) - (previousReaction === 'good' ? 1 : 0);
    const badDelta =
      (nextReaction === 'bad' ? 1 : 0) - (previousReaction === 'bad' ? 1 : 0);

    const prevCounts = reactionCountsByQuestionId[questionId] ?? {
      good: Math.max(0, Number(activeQ.goodCount ?? 0)),
      bad: Math.max(0, Number(activeQ.badCount ?? 0)),
    };

    const nextCounts: ReactionCounter = {
      good: Math.max(0, prevCounts.good + goodDelta),
      bad: Math.max(0, prevCounts.bad + badDelta),
    };

    setReactions((prev) => ({ ...prev, [questionId]: nextReaction }));
    setReactionCountsByQuestionId((prev) => ({ ...prev, [questionId]: nextCounts }));
    setSavingReactionByQuestionId((prev) => ({ ...prev, [questionId]: true }));

    const persisted = await persistAcademyReaction({ questionId, voterKey, nextReaction });

    if (!persisted.ok) {
      console.warn('[academy-reaction] persist failed:', persisted.reason);
      setReactions((prev) => ({ ...prev, [questionId]: previousReaction }));
      setReactionCountsByQuestionId((prev) => ({ ...prev, [questionId]: prevCounts }));
    } else {
      void useGameStore.getState().refreshAcademyQuestions();
    }

    setSavingReactionByQuestionId((prev) => ({ ...prev, [questionId]: false }));
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <img
        src="/images/backgrounds/academy.png"
        className="absolute inset-0 h-full w-full object-cover object-center scale-105"
        style={{ filter: 'blur(1px)' }}
        alt=""
      />
      <div className="absolute inset-0" style={{ background: 'rgba(6,10,20,0.84)' }} />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${cfg.border}22 0%, transparent 55%)`,
        }}
      />

      <style>{`
        @keyframes qrv-tw { 0%,100%{opacity:.07;transform:scale(1)}50%{opacity:.55;transform:scale(1.9)} }
        @keyframes qrv-glow { 0%,100%{filter:brightness(1)}50%{filter:brightness(1.45)} }
        @keyframes qrv-float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)} }
      `}</style>

      <BgFx ambient={cfg.ambient} />

      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, boxShadow: cfg.shadow }}
        >
          <div
            className="px-5 py-2.5 flex items-center gap-2"
            style={{ background: `linear-gradient(90deg,${cat.ribbonColor}cc,${cat.glow}88)` }}
          >
            <span className="text-xl">{cat.icon}</span>
            <span className="text-white font-black text-sm tracking-widest">
              {cat.label}　試験結果
            </span>
          </div>

          <div className="px-6 pt-7 pb-8 flex flex-col items-center text-center">
            <p
              className="text-[10px] tracking-[0.38em] font-bold mb-1"
              style={{
                color: cfg.color,
                opacity: 0.92,
                textShadow:
                  '0 0 1px rgba(12,8,6,0.75), 0 0 2px rgba(12,8,6,0.45), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              RANK
            </p>

            <motion.p
              initial={{ scale: 0, opacity: 0, rotate: -18 }}
              animate={{ scale: [0, 1.4, 0.88, 1.12, 1], opacity: 1, rotate: 0 }}
              transition={{
                duration: 1.05,
                times: [0, 0.38, 0.6, 0.8, 1],
                delay: 0.12,
                ease: 'easeOut',
              }}
              className="font-black leading-none select-none mb-4"
              style={{
                fontSize: 118,
                color: cfg.color,
                textShadow: rankLetterTextShadow(cfg.shadow),
                fontFamily: 'Georgia, serif',
                letterSpacing: '-0.02em',
                animation: 'qrv-glow 2.6s ease-in-out 1.3s infinite',
              }}
            >
              {rank}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.45 }}
              style={{ animation: 'qrv-float 3.2s ease-in-out 1.6s infinite' }}
            >
              <p className="font-black text-xl leading-snug" style={{ color: cfg.messageTextColor }}>
                {cfg.message}
              </p>
              <p
                className="text-sm mt-1.5"
                style={{ color: cfg.messageTextColor, opacity: 0.82 }}
              >
                {cfg.sub}
              </p>
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
              className="px-1"
            >
              <div className="flex items-stretch justify-center">
                <div className="flex-1 min-w-0 text-center px-2 sm:px-3">
                  <p
                    className="text-[10px] font-bold tracking-widest mb-1.5"
                    style={{ color: 'rgba(226,232,240,0.78)' }}
                  >
                    正解数
                  </p>
                  <p
                    className="font-black tabular-nums leading-none text-[1.65rem] sm:text-[1.85rem]"
                    style={{
                      color: 'rgba(248,250,252,0.9)',
                      textShadow:
                        '0 1px 2px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    {dispCorrect}
                    <span
                      className="font-bold text-[1.05rem] sm:text-[1.15rem]"
                      style={{
                        color: 'rgba(226,232,240,0.55)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      /{questions.length}
                    </span>
                  </p>
                </div>

                <div className="w-px shrink-0 bg-white/12 self-stretch my-1" aria-hidden />

                <div className="flex-1 min-w-0 text-center px-2 sm:px-3">
                  <p
                    className="text-[10px] font-bold tracking-widest mb-1.5"
                    style={{ color: 'rgba(226,232,240,0.78)' }}
                  >
                    正答率
                  </p>
                  <p
                    className="font-black tabular-nums leading-none text-[1.65rem] sm:text-[1.85rem]"
                    style={{
                      color: 'rgba(248,250,252,0.9)',
                      textShadow:
                        '0 1px 2px rgba(0,0,0,0.65), 0 0 12px rgba(0,0,0,0.35)',
                    }}
                  >
                    {dispAcc}
                    <span
                      className="font-bold text-lg"
                      style={{
                        color: 'rgba(226,232,240,0.6)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      %
                    </span>
                  </p>
                </div>

                <div className="w-px shrink-0 bg-white/12 self-stretch my-1" aria-hidden />

                <div className="flex-1 min-w-0 text-center px-2 sm:px-3">
                  <p
                    className="text-[10px] font-bold tracking-widest mb-1.5"
                    style={{ color: 'rgba(226,232,240,0.78)' }}
                  >
                    合計スコア
                  </p>
                  <p
                    className="font-black tabular-nums leading-none"
                    style={{
                      fontSize: 36,
                      color: '#f5d78a',
                      textShadow:
                        '0 1px 3px rgba(0,0,0,0.75), 0 0 18px rgba(251,191,36,0.28), 0 2px 10px rgba(0,0,0,0.45)',
                    }}
                  >
                    {dispTotal}
                    <span
                      className="text-sm font-bold ml-0.5"
                      style={{
                        color: 'rgba(253,230,138,0.82)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                      }}
                    >
                      点
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-center mt-3">
                <p
                  className="text-xs"
                  style={{
                    color: 'rgba(226,232,240,0.82)',
                    background: 'rgba(2,6,23,0.72)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    display: 'inline-block',
                    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                  }}
                >
                  正解点{' '}
                  <span className="font-semibold" style={{ color: 'rgba(248,250,252,0.92)' }}>
                    {basePoint}pt
                  </span>
                  <span className="mx-1.5" style={{ color: 'rgba(148,163,184,0.45)' }}>
                    |
                  </span>
                  時間ボーナス{' '}
                  <span className="font-semibold" style={{ color: 'rgba(253,224,71,0.9)' }}>
                    {dispBonus}pt
                  </span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="flex flex-col items-stretch gap-3"
            >
              <motion.button
                onClick={onRetry}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 sm:py-5 text-white font-black text-base"
                style={{
                  background: `linear-gradient(135deg,${cat.ribbonColor},${cat.glow})`,
                  boxShadow: `0 6px 28px ${cat.ribbonColor}88`,
                }}
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01, boxShadow: `0 8px 34px ${cat.ribbonColor}aa` }}
              >
                <RotateCcw className="w-5 h-5 shrink-0" />
                もう一度！
              </motion.button>

              <button
                type="button"
                onClick={onBackToCategories}
                className="self-center flex items-center gap-1.5 py-1 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ color: 'rgba(200,190,255,0.65)' }}
              >
                <ArrowLeft className="w-3.5 h-3.5 opacity-70" />
                カテゴリへ戻る
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.08 }}
              className="rounded-3xl overflow-hidden"
              style={{
                background: REVIEW_SURFACE.panelBg,
                border: REVIEW_SURFACE.panelBorder,
                boxShadow: REVIEW_SURFACE.panelShadow,
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="px-4 pt-4 pb-3 flex items-center gap-2"
                style={{ borderBottom: REVIEW_SURFACE.headerBorder }}
              >
                <span>📋</span>
                <p className="font-black text-sm" style={{ color: REVIEW_SURFACE.title }}>
                  結果発表
                </p>
              </div>

              <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
                {questions.map((q, idx) => {
                  const isActive = idx === safeTab;
                  const res = results[idx] ?? results.find((r) => r.questionId === q.id);
                  const ok = res?.isCorrect;

                  return (
                    <motion.button
                      key={getKey(q, idx)}
                      onClick={() => setActiveTab(idx)}
                      whileTap={{ scale: 0.85 }}
                      className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black"
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg,${cat.ribbonColor},${cat.glow})`
                          : ok === true
                            ? 'rgba(34,197,94,0.14)'
                            : ok === false
                              ? 'rgba(244,63,94,0.14)'
                              : 'rgba(51,65,85,0.58)',
                        border: isActive
                          ? `2px solid ${cat.ribbonColor}`
                          : ok === true
                            ? '2px solid rgba(74,222,128,0.38)'
                            : ok === false
                              ? '2px solid rgba(251,113,133,0.38)'
                              : '2px solid rgba(148,163,184,0.18)',
                        boxShadow: isActive ? `0 0 14px ${cat.ribbonColor}55` : 'none',
                      }}
                    >
                      <span
                        className="text-[10px]"
                        style={{ color: isActive ? '#fff' : REVIEW_SURFACE.textSoft }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-lg leading-none">
                        {ok === true ? '⭕' : ok === false ? '❌' : '－'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {activeQ ? (
                  <motion.div
                    key={activeKey}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.18 }}
                    className="px-4 pb-5 space-y-2.5"
                  >
                    <div
                      className="rounded-2xl p-3.5"
                      style={{
                        background: activeRes?.isCorrect
                          ? REVIEW_SURFACE.correctBg
                          : REVIEW_SURFACE.wrongBg,
                        border: activeRes?.isCorrect
                          ? REVIEW_SURFACE.correctBorder
                          : REVIEW_SURFACE.wrongBorder,
                      }}
                    >
                      <p
                        className="text-sm font-bold mb-1.5"
                        style={{
                          color: activeRes?.isCorrect
                            ? REVIEW_SURFACE.correctText
                            : REVIEW_SURFACE.wrongText,
                        }}
                      >
                        {activeRes?.isCorrect ? '⭕ 正解！' : '❌ 不正解…'}
                      </p>
                      <p
                        className="text-sm font-semibold leading-relaxed"
                        style={{ color: REVIEW_SURFACE.text }}
                      >
                        {activeQ.question}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="rounded-xl px-3 py-2.5"
                        style={{
                          background: REVIEW_SURFACE.statGreenBg,
                          border: REVIEW_SURFACE.statGreenBorder,
                        }}
                      >
                        <p
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: REVIEW_SURFACE.statGreenText }}
                        >
                          正答率
                        </p>
                        <p
                          className="text-sm font-black mt-1"
                          style={{ color: REVIEW_SURFACE.statGreenText }}
                        >
                          {activeAccuracy.toFixed(1)}%
                        </p>
                      </div>

                      <div
                        className="rounded-xl px-3 py-2.5"
                        style={{
                          background: REVIEW_SURFACE.statGoldBg,
                          border: REVIEW_SURFACE.statGoldBorder,
                        }}
                      >
                        <p
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: REVIEW_SURFACE.statGoldText }}
                        >
                          👍 ナイス問題
                        </p>
                        <p
                          className="text-sm font-black mt-1"
                          style={{ color: REVIEW_SURFACE.statGoldText }}
                        >
                          {activeGoodCount}件
                        </p>
                      </div>
                    </div>

                    {activeQ.displayChoices.map((choice, idx) => {
                      const sourceChoiceIndex = getSourceChoiceIndex(activeQ, idx);
                      const basePickCount =
                        sourceChoiceIndex === null ? 0 : getChoicePickCount(activeQ, sourceChoiceIndex);
                      const pickCount =
                        basePickCount +
                        (sourceChoiceIndex !== null && selectedSourceIdx === sourceChoiceIndex ? 1 : 0);

                      const totalChoiceCountBase =
                        getChoicePickCount(activeQ, 0) +
                        getChoicePickCount(activeQ, 1) +
                        getChoicePickCount(activeQ, 2) +
                        getChoicePickCount(activeQ, 3);

                      const totalChoiceCount =
                        totalChoiceCountBase + (selectedSourceIdx !== null ? 1 : 0);

                      const pickPercent = calcPercent(pickCount, totalChoiceCount);
                      const isAns = idx === activeQ.displayAnswerIndex;
                      const isSel = selectedIdx === idx;

                      const rowBg = isAns
                        ? REVIEW_SURFACE.correctBg
                        : isSel
                          ? REVIEW_SURFACE.selectedBg
                          : REVIEW_SURFACE.slot;

                      const rowBorder = isAns
                        ? REVIEW_SURFACE.correctBorder
                        : isSel
                          ? REVIEW_SURFACE.selectedBorder
                          : REVIEW_SURFACE.slotBorder;

                      const rowText = isAns
                        ? REVIEW_SURFACE.correctText
                        : isSel
                          ? REVIEW_SURFACE.selectedText
                          : REVIEW_SURFACE.text;

                      const progress = isAns
                        ? REVIEW_SURFACE.correctBar
                        : isSel
                          ? REVIEW_SURFACE.selectedBar
                          : 'linear-gradient(90deg,#64748b,#94a3b8)';

                      return (
                        <div
                          key={`${activeKey}-c${idx}`}
                          className="rounded-xl px-3 py-2.5 text-sm"
                          style={{
                            background: rowBg,
                            border: rowBorder,
                            color: rowText,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="font-black shrink-0 text-xs"
                              style={{ color: REVIEW_SURFACE.textSoft }}
                            >
                              {idx + 1}.
                            </span>

                            <span className="flex-1 min-w-0 font-medium">{choice}</span>

                            {isAns && (
                              <span
                                className="shrink-0 flex items-center justify-center rounded-full p-1"
                                style={{
                                  background: 'rgba(34,197,94,0.18)',
                                  border: '1.5px solid rgba(74,222,128,0.38)',
                                }}
                                aria-hidden
                              >
                                <Check
                                  className="w-4 h-4"
                                  style={{ color: REVIEW_SURFACE.correctText }}
                                  strokeWidth={3}
                                />
                              </span>
                            )}

                            <span
                              className="shrink-0 text-xs font-black tabular-nums"
                              style={{ color: REVIEW_SURFACE.textSoft }}
                            >
                              {pickPercent.toFixed(1)}%
                            </span>

                            {!isAns && isSel && (
                              <span
                                className="shrink-0 text-xs font-bold"
                                style={{ color: REVIEW_SURFACE.selectedText }}
                              >
                                あなた
                              </span>
                            )}
                          </div>

                          <div className="mt-2">
                            <div
                              className="h-2.5 rounded-full overflow-hidden"
                              style={{ background: 'rgba(255,255,255,0.08)' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pickPercent}%`,
                                  background: progress,
                                  boxShadow: isAns
                                    ? '0 0 10px rgba(34,197,94,0.22)'
                                    : isSel
                                      ? '0 0 10px rgba(168,85,247,0.18)'
                                      : 'none',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {selectedIdx === null && (
                      <p
                        className="text-xs text-center"
                        style={{ color: REVIEW_SURFACE.textSoft }}
                      >
                        ⏱ 時間切れで未回答
                      </p>
                    )}

                    <div
                      className="rounded-2xl p-3.5"
                      style={{
                        background: REVIEW_SURFACE.explanationBg,
                        border: REVIEW_SURFACE.explanationBorder,
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      <p
                        className="text-[10px] font-black tracking-wide mb-1.5"
                        style={{ color: REVIEW_SURFACE.explanationLabel }}
                      >
                        解説
                      </p>

                      {typeof activeQ.explanation === 'string' && activeQ.explanation.trim() ? (
                        <p
                          className="text-sm font-semibold leading-relaxed"
                          style={{ color: REVIEW_SURFACE.explanationText }}
                        >
                          {activeQ.explanation}
                        </p>
                      ) : (
                        <p className="text-xs" style={{ color: REVIEW_SURFACE.explanationLabel }}>
                          この問題には解説がありません。
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {([
                        {
                          key: 'good' as QuestionReaction,
                          label: '👍 ナイス問題',
                          activeBg: 'rgba(34,197,94,0.14)',
                          activeBd: 'rgba(74,222,128,0.38)',
                          activeTx: '#86efac',
                          inactiveBd: 'rgba(148,163,184,0.2)',
                          inactiveTx: '#cbd5e1',
                        },
                        {
                          key: 'bad' as QuestionReaction,
                          label: '👎 イマイチ',
                          activeBg: 'rgba(244,63,94,0.14)',
                          activeBd: 'rgba(251,113,133,0.38)',
                          activeTx: '#fda4af',
                          inactiveBd: 'rgba(148,163,184,0.2)',
                          inactiveTx: '#cbd5e1',
                        },
                      ] as const).map((btn) => {
                        const on = activeReaction === btn.key;
                        return (
                          <motion.button
                            key={String(btn.key)}
                            onClick={() => toggleReaction(btn.key)}
                            disabled={isActiveReactionSaving}
                            className="px-5 py-2.5 rounded-full text-sm font-black border min-h-[44px]"
                            style={{
                              background: on ? btn.activeBg : REVIEW_SURFACE.buttonBg,
                              borderColor: on ? btn.activeBd : btn.inactiveBd,
                              color: on ? btn.activeTx : btn.inactiveTx,
                              boxShadow: on ? `0 0 10px ${btn.activeBd}` : '0 1px 4px rgba(0,0,0,0.16)',
                              opacity: isActiveReactionSaving ? 0.6 : 1,
                            }}
                            whileTap={{ scale: 1.05 }}
                            animate={on ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                            transition={{ duration: 0.25 }}
                          >
                            {btn.label}
                          </motion.button>
                        );
                      })}

                      <button
                        onClick={() => setReportTarget(activeQ.id)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg transition-opacity"
                        style={{
                          border: '1px solid rgba(148,163,184,0.2)',
                          color: REVIEW_SURFACE.textSoft,
                          background: REVIEW_SURFACE.buttonBg,
                          opacity: 0.9,
                        }}
                      >
                        <Flag className="w-3 h-3" />
                        <span className="text-[10px] font-semibold">通報</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <p className="px-4 pb-4 text-sm" style={{ color: REVIEW_SURFACE.textSoft }}>
                    レビュー対象がありません。
                  </p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {reportTarget && (
          <ReportModal
            questionId={reportTarget}
            reporterKey={voterKey}
            onClose={() => setReportTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};