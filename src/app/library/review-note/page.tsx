'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { AcademyReviewNoteEntry } from '@/store/useGameStore';
import type { AcademyUserQuestion } from '@/types';

type ReviewFilter = 'all' | 'wrong' | 'correct';

type ShuffledReviewQuestion = AcademyUserQuestion & {
  displayChoices: string[];
  displayAnswerIndex: number;
};

const FILTER_LABEL: Record<ReviewFilter, string> = {
  all: 'すべて',
  wrong: 'まちがえた',
  correct: '正解',
};

/** 永続データに filterBucket が無い旧形式は lastResult で表示用に補う */
function resolveFilterBucket(entry: AcademyReviewNoteEntry): 'wrong' | 'correct' {
  return entry.filterBucket ?? (entry.lastResult === 'wrong' ? 'wrong' : 'correct');
}

const reviewNoteRootBg = {
  backgroundImage:
    'radial-gradient(ellipse 120% 55% at 50% -8%, rgba(255, 220, 190, 0.06) 0%, transparent 58%), linear-gradient(to bottom, rgba(53,45,82,0.22) 0%, rgba(66,58,104,0.16) 45%, rgba(78,70,128,0.12) 100%)',
};

const reviewBackdropImageUrl = '/images/backgrounds/library.png';

const ReviewNoteBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <div
      className="absolute -inset-4 bg-cover bg-center"
      style={{
        backgroundImage: `url("${reviewBackdropImageUrl}")`,
        filter: 'blur(1px)',
      }}
    />
    <div
      className="absolute inset-0 z-[1]"
      style={{
        background:
          'linear-gradient(to bottom, rgba(255,255,255,0.38) 0%, rgba(248,245,252,0.38) 40%, rgba(242,238,250,0.38) 100%)',
      }}
    />
  </div>
);

const shuffleArray = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const withShuffledChoices = (q: AcademyUserQuestion): ShuffledReviewQuestion => {
  const indices = shuffleArray([0, 1, 2, 3].slice(0, q.choices.length));
  const displayChoices = indices.map((idx) => q.choices[idx]);
  const displayAnswerIndex = indices.indexOf(q.answerIndex);
  return {
    ...q,
    displayChoices,
    displayAnswerIndex: displayAnswerIndex >= 0 ? displayAnswerIndex : Math.max(0, Math.min(q.answerIndex, q.choices.length - 1)),
  };
};

export default function LibraryReviewNotePage() {
  const academyUserQuestions = useGameStore((s) => s.academyUserQuestions);
  const academyReviewNoteByQuestionId = useGameStore((s) => s.academyReviewNoteByQuestionId);
  const recordAcademyReviewAttempts = useGameStore((s) => s.recordAcademyReviewAttempts);
  const removeAcademyReviewQuestion = useGameStore((s) => s.removeAcademyReviewQuestion);
  const setAcademyReviewNoteFilterBucket = useGameStore((s) => s.setAcademyReviewNoteFilterBucket);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [playing, setPlaying] = useState<ShuffledReviewQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const questionById = useMemo(() => {
    return new Map(academyUserQuestions.map((q) => [q.id, q]));
  }, [academyUserQuestions]);

  const activeEntries = useMemo(() => {
    return Object.values(academyReviewNoteByQuestionId)
      .filter((entry) => !entry.removedAt && questionById.has(entry.questionId))
      .sort((a, b) => new Date(b.lastSolvedAt).getTime() - new Date(a.lastSolvedAt).getTime());
  }, [academyReviewNoteByQuestionId, questionById]);

  const counts = useMemo(() => {
    const all = activeEntries.length;
    const wrong = activeEntries.filter((entry) => resolveFilterBucket(entry) === 'wrong').length;
    const correct = activeEntries.filter((entry) => resolveFilterBucket(entry) === 'correct').length;
    return { all, wrong, correct };
  }, [activeEntries]);

  const visibleEntries = useMemo(() => {
    if (filter === 'all') return activeEntries;
    return activeEntries.filter((entry) =>
      resolveFilterBucket(entry) === (filter === 'wrong' ? 'wrong' : 'correct')
    );
  }, [activeEntries, filter]);

  const startRetry = (questionId: string) => {
    const source = questionById.get(questionId);
    if (!source) return;
    setPlaying(withShuffledChoices(source));
    setSelectedIndex(null);
    setIsCorrect(null);
  };

  const answer = (displayIndex: number) => {
    if (!playing || selectedIndex !== null) return;
    const correct = displayIndex === playing.displayAnswerIndex;
    setSelectedIndex(displayIndex);
    setIsCorrect(correct);
    recordAcademyReviewAttempts([{ questionId: playing.id, isCorrect: correct }]);
  };

  const retryNoteRow =
    playing && selectedIndex !== null ? academyReviewNoteByQuestionId[playing.id] : undefined;
  const retryOfferPromoteToCorrect =
    !!retryNoteRow && isCorrect === true && resolveFilterBucket(retryNoteRow) === 'wrong';

  return (
    <div className="relative min-h-screen pb-24" style={reviewNoteRootBg}>
      <ReviewNoteBackdrop />
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/50 bg-white/80 px-3 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          aria-label="戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-bold text-slate-800">復習ノート</h1>
      </header>

      <main className="relative z-10 mx-auto max-w-md space-y-4 px-4 pt-4 text-slate-900">
        <div className="grid grid-cols-3 gap-2">
          {(['all', 'wrong', 'correct'] as const).map((key) => {
            const active = filter === key;
            const count = key === 'all' ? counts.all : key === 'wrong' ? counts.wrong : counts.correct;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="rounded-xl border px-2 py-2 text-xs font-bold"
                style={{
                  background: active ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'white',
                  color: active ? 'white' : '#334155',
                  borderColor: active ? '#4f46e5' : '#cbd5e1',
                }}
              >
                {FILTER_LABEL[key]}
                <span className="ml-1 tabular-nums opacity-90">{count}</span>
              </button>
            );
          })}
        </div>

        {playing && (
          <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm text-slate-900">
            <p className="mb-2 text-xs font-bold text-violet-700">再挑戦中</p>
            <p className="mb-3 text-sm font-semibold leading-relaxed text-slate-800">{playing.question}</p>
            <div className="space-y-2">
              {playing.displayChoices.map((choice, idx) => {
                const answered = selectedIndex !== null;
                const correctChoice = idx === playing.displayAnswerIndex;
                const selected = idx === selectedIndex;
                const bg = answered
                  ? correctChoice
                    ? 'rgba(220,252,231,0.9)'
                    : selected
                      ? 'rgba(254,226,226,0.9)'
                      : '#ffffff'
                  : '#ffffff';
                return (
                  <button
                    key={`${playing.id}-${idx}`}
                    type="button"
                    onClick={() => answer(idx)}
                    disabled={answered}
                    className="w-full rounded-xl border px-3 py-2 text-left text-sm font-medium text-slate-900 disabled:opacity-95"
                    style={{
                      background: bg,
                      borderColor: correctChoice && answered ? '#22c55e' : selected && answered ? '#ef4444' : '#cbd5e1',
                      color: '#0f172a',
                    }}
                  >
                    {idx + 1}. {choice}
                  </button>
                );
              })}
            </div>
            {selectedIndex !== null && playing && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-bold" style={{ color: isCorrect ? '#15803d' : '#be123c' }}>
                  {isCorrect ? '正解！' : '不正解'}
                </p>
                {retryOfferPromoteToCorrect && (
                  <p className="text-[11px] leading-relaxed text-slate-600">
                  </p>
                )}
                <p className="text-xs text-slate-600">{playing.explanation || 'この問題には解説がありません。'}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {retryOfferPromoteToCorrect && (
                    <button
                      type="button"
                      onClick={() => {
                        setAcademyReviewNoteFilterBucket(playing.id, 'correct');
                        setPlaying(null);
                        setSelectedIndex(null);
                        setIsCorrect(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      正解に移す
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(null);
                      setSelectedIndex(null);
                      setIsCorrect(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    復習ノートに戻る
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {visibleEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-600">
            該当する問題はありません。
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => {
              const q = questionById.get(entry.questionId);
              if (!q) return null;
              const bucket = resolveFilterBucket(entry);
              const inWrongFrame = bucket === 'wrong';
              const showPromote = inWrongFrame && entry.lastResult === 'correct';
              return (
                <article
                  key={entry.questionId}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    inWrongFrame
                      ? 'border-rose-300/90 bg-gradient-to-br from-rose-50/90 to-white'
                      : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 to-white'
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${
                        inWrongFrame ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {inWrongFrame ? 'まちがえた' : '正解'}
                    </span>
                    {showPromote && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-200/80">
                        再挑戦は正解
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-800">{q.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 ring-1 ring-slate-200/80">
                      挑戦 {entry.totalAttempts}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">正解 {entry.correctCount}</span>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">不正解 {entry.wrongCount}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                      最新: {entry.lastResult === 'correct' ? '正解' : '不正解'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startRetry(entry.questionId)}
                      className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      もう一度解く
                    </button>
                    {showPromote && (
                      <button
                        type="button"
                        onClick={() => setAcademyReviewNoteFilterBucket(entry.questionId, 'correct')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        正解に移す
                      </button>
                    )}
                    {bucket === 'correct' && (
                      <button
                        type="button"
                        onClick={() => setAcademyReviewNoteFilterBucket(entry.questionId, 'wrong')}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-800"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        まちがえたに移す
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAcademyReviewQuestion(entry.questionId)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ノートから外す
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
