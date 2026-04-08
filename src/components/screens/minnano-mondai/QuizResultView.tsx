'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Flag } from 'lucide-react';
import type { QuizQuestionResult, ShuffledQuestion } from '../MinnanoMondaiScreen';

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

const RANK_CFG: Record<Rank, {
  color: string;
  shadow: string;
  bg: string;
  border: string;
  message: string;
  sub: string;
}> = {
  S: {
    color: '#fbbf24',
    shadow: '0 0 60px rgba(251,191,36,1), 0 0 120px rgba(251,191,36,0.55)',
    bg: 'radial-gradient(ellipse at 50% 25%, rgba(100,55,0,0.85) 0%, rgba(15,7,0,0.98) 100%)',
    border: 'rgba(251,191,36,0.75)',
    message: 'S判定だよ…かんぺきぃ',
    sub: '全問正解です！さすがですっ！',
  },
  A: {
    color: '#67e8f9',
    shadow: '0 0 50px rgba(103,232,249,0.9), 0 0 100px rgba(103,232,249,0.45)',
    bg: 'radial-gradient(ellipse at 50% 25%, rgba(0,45,65,0.85) 0%, rgba(0,8,22,0.98) 100%)',
    border: 'rgba(103,232,249,0.6)',
    message: 'すごいよ。A判定',
    sub: 'あと少しでSランクだったよ！',
  },
  B: {
    color: '#6ee7b7',
    shadow: '0 0 40px rgba(110,231,183,0.85), 0 0 80px rgba(110,231,183,0.4)',
    bg: 'radial-gradient(ellipse at 50% 25%, rgba(0,38,22,0.85) 0%, rgba(0,8,4,0.98) 100%)',
    border: 'rgba(110,231,183,0.55)',
    message: 'もうちょっとでAだよ',
    sub: 'あと数問！次は届くよ！',
  },
  C: {
    color: '#c4b5fd',
    shadow: '0 0 35px rgba(196,181,253,0.8), 0 0 70px rgba(196,181,253,0.35)',
    bg: 'radial-gradient(ellipse at 50% 25%, rgba(32,12,68,0.85) 0%, rgba(4,1,18,0.98) 100%)',
    border: 'rgba(196,181,253,0.45)',
    message: '…もう一度挑戦しない？',
    sub: 'きっといけるって信じてるよ。',
  },
};

const calcRank = (score: number): Rank => {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  return 'C';
};

const getKey = (q: ShuffledQuestion | undefined, i: number) => q?.id ?? `idx-${i}`;

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
// 背景パーティクル（固定シード）
// ============================================================

const PARTICLES = Array.from({ length: 38 }, (_, i) => ({
  id: i,
  w: 1 + (i % 3) * 0.7,
  left: (i * 47 + 13) % 100,
  top:  (i * 31 + 7)  % 100,
  dur:  2.2 + (i % 5) * 0.6,
  del:  (i * 0.37)    % 5,
}));

const BgFx = ({ borderColor }: { borderColor: string }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {PARTICLES.map((p) => (
      <div key={p.id} className="absolute rounded-full bg-white"
        style={{ width: p.w, height: p.w, left: `${p.left}%`, top: `${p.top}%`,
          opacity: .12, animation: `qrv-tw ${p.dur}s ease-in-out ${p.del}s infinite` }} />
    ))}
    <div className="absolute inset-0"
      style={{ background: `radial-gradient(ellipse at 50% 0%, ${borderColor}25 0%, transparent 55%)` }} />
  </div>
);

// ============================================================
// メインコンポーネント
// ============================================================

// ============================================================
// 通報理由定義
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

// ============================================================
// 通報モーダル
// ============================================================

const ReportModal = ({
  questionId,
  onClose,
}: {
  questionId: string;
  onClose: () => void;
}) => {
  const [checks, setChecks] = useState<Record<ReportReasonId, boolean>>({
    copyright: false, morals: false, wrong: false, spam: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = Object.values(checks).some(Boolean);

  const handleSubmit = () => {
    const selected = REPORT_REASONS.filter((r) => checks[r.id]).map((r) => r.label);
    console.log('[Report]', questionId, selected);
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <Flag className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-white font-black text-sm">問題を通報する</p>
            <p className="text-white/45 text-[10px] mt-0.5">該当する理由を選択してください（複数可）</p>
          </div>
        </div>

        {submitted ? (
          <div className="px-5 py-8 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-white font-black">通報を受け付けました</p>
            <p className="text-white/50 text-xs mt-1.5 mb-5">内容を確認の上、対応いたします。</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(220,210,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}
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
                  background: checks[r.id] ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  border: checks[r.id] ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checks[r.id]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                  className="mt-0.5 accent-red-500 shrink-0"
                />
                <div>
                  <p className="text-sm font-bold" style={{ color: checks[r.id] ? '#fca5a5' : 'rgba(220,210,255,0.9)' }}>
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

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={onClose}
                className="py-3 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: 'rgba(200,190,255,0.75)' }}
              >
                キャンセル
              </button>
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="py-3 rounded-xl text-sm font-black text-white disabled:opacity-35"
                style={{
                  background: canSubmit ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(255,255,255,0.08)',
                  boxShadow: canSubmit ? '0 0 18px rgba(239,68,68,0.5)' : 'none',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileTap={canSubmit ? { scale: 0.95 } : {}}
              >
                通報する
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ============================================================
// メインコンポーネント
// ============================================================

export const QuizResultView = ({
  cat, questions, results, onRetry, onBackToCategories,
}: QuizResultViewProps) => {

  const [activeTab,    setActiveTab]    = useState(0);
  const [reactions,    setReactions]    = useState<Record<string, QuestionReaction>>({});
  const [phase,        setPhase]        = useState<0 | 1 | 2>(0);
  const [reportTarget, setReportTarget] = useState<string | null>(null); // 通報対象の問題ID

  // ── 集計 ──
  const correctCount = results.filter((r) => r.isCorrect).length;
  const basePoint    = results.reduce((s, r) => s + r.basePoint,  0);
  const timeBonus    = results.reduce((s, r) => s + r.timeBonus, 0);
  const totalPoint   = basePoint + timeBonus;
  const accuracy     = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const rank         = calcRank(totalPoint);
  const cfg          = RANK_CFG[rank];

  // ── フェーズ制御 ──
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── カウントアップ ──
  const dispTotal   = useCountUp(totalPoint,   1000, 1000);
  const dispCorrect = useCountUp(correctCount,  700, 1000);
  const dispBonus   = useCountUp(timeBonus,     800, 1400);
  const dispAcc     = useCountUp(accuracy,       750, 1000);

  // ── レビュー用 ──
  const safeTab    = Math.min(Math.max(activeTab, 0), Math.max(questions.length - 1, 0));
  const activeQ    = questions[safeTab];
  const activeRes  = useMemo(
    () => results[safeTab] ?? results.find((r) => r.questionId === activeQ?.id),
    [activeQ, results, safeTab],
  );
  const activeKey      = getKey(activeQ, safeTab);
  const activeReaction = reactions[activeKey] ?? null;
  const selectedIdx    = activeRes?.selectedDisplayIndex ?? null;

  const toggleReaction = (next: QuestionReaction) =>
    setReactions((prev) => ({ ...prev, [activeKey]: prev[activeKey] === next ? null : next }));

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">

      <img
        src="/images/backgrounds/academy.png"
        className="absolute inset-0 h-full w-full object-cover object-center scale-105"
        style={{ filter: 'blur(1px)' }}
        alt=""
      />
      <div className="absolute inset-0" style={{ background: 'rgba(4,1,18,0.72)' }} />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${cfg.border}33 0%, transparent 55%)` }}
      />

      <style>{`
        @keyframes qrv-tw    { 0%,100%{opacity:.07;transform:scale(1)}50%{opacity:.55;transform:scale(1.9)} }
        @keyframes qrv-glow  { 0%,100%{filter:brightness(1)}50%{filter:brightness(1.45)} }
        @keyframes qrv-float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)} }
      `}</style>

      <BgFx borderColor={cfg.border} />

      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 space-y-4">

        {/* ━━━━━━━━ ① ランクカード ━━━━━━━━ */}
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0,   scale: 1 }}
          transition={{ duration: 0.45 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, boxShadow: cfg.shadow }}
        >
          {/* カテゴリ帯 */}
          <div className="px-5 py-2.5 flex items-center gap-2"
            style={{ background: `linear-gradient(90deg,${cat.ribbonColor}cc,${cat.glow}88)` }}>
            <span className="text-xl">{cat.icon}</span>
            <span className="text-white font-black text-sm tracking-widest">{cat.label}　試験結果</span>
          </div>

          <div className="px-6 pt-7 pb-8 flex flex-col items-center text-center">
            {/* RANK ラベル */}
            <p className="text-[10px] tracking-[0.38em] font-bold mb-1"
              style={{ color: cfg.color, opacity: 0.65 }}>RANK</p>

            {/* ★ ランク文字本体 ★ */}
            <motion.p
              initial={{ scale: 0, opacity: 0, rotate: -18 }}
              animate={{ scale: [0, 1.4, 0.88, 1.12, 1], opacity: 1, rotate: 0 }}
              transition={{ duration: 1.05, times: [0, 0.38, 0.6, 0.8, 1], delay: 0.12, ease: 'easeOut' }}
              className="font-black leading-none select-none mb-4"
              style={{
                fontSize: 118,
                color: cfg.color,
                textShadow: cfg.shadow,
                fontFamily: 'Georgia, serif',
                letterSpacing: '-0.02em',
                animation: 'qrv-glow 2.6s ease-in-out 1.3s infinite',
              }}
            >
              {rank}
            </motion.p>

            {/* キャラのセリフ */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.45 }}
              style={{ animation: 'qrv-float 3.2s ease-in-out 1.6s infinite' }}
            >
              <p className="font-black text-xl leading-snug" style={{ color: cfg.color }}>
                {cfg.message}
              </p>
              <p className="text-sm mt-1.5" style={{ color: 'rgba(220,210,255,0.6)' }}>
                {cfg.sub}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* ━━━━━━━━ ② スコアカード ━━━━━━━━ */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.045)', border: `1px solid ${cfg.border}`, backdropFilter: 'blur(14px)' }}
            >
              {/* 3カラムグリッド */}
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {[
                  { label: '正解数', value: `${dispCorrect}/${questions.length}` },
                  { label: '正答率', value: `${dispAcc}%` },
                  { label: '正解点', value: `${basePoint}pt` },
                ].map((s) => (
                  <div key={s.label} className="px-2 py-3 text-center">
                    <p className="text-[10px] mb-1" style={{ color: 'rgba(200,190,255,0.5)' }}>{s.label}</p>
                    <p className="text-base font-black text-white">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* 合計スコア行 */}
              <div className="px-5 py-4 flex items-center justify-between border-t border-white/10">
                <p className="text-xs" style={{ color: 'rgba(200,190,255,0.55)' }}>
                  正解点 {basePoint}pt
                  <span className="ml-2 font-bold" style={{ color: '#fbbf24' }}>
                    ＋ 時間ボーナス {dispBonus}pt
                  </span>
                </p>
                <div className="text-right">
                  <p className="text-[10px] mb-0.5" style={{ color: 'rgba(200,190,255,0.45)' }}>合計スコア</p>
                  <p className="font-black text-3xl leading-none"
                    style={{ color: cfg.color, textShadow: `0 0 18px ${cfg.color}` }}>
                    {dispTotal}
                    <span className="text-sm font-bold text-white/45 ml-1">点</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━━━━━ ③ ボタン ━━━━━━━━ */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="grid grid-cols-2 gap-3"
            >
              <motion.button
                onClick={onRetry}
                className="flex items-center justify-center gap-2 rounded-2xl py-4 text-white font-black text-sm"
                style={{
                  background: `linear-gradient(135deg,${cat.ribbonColor},${cat.glow})`,
                  boxShadow: `0 4px 24px ${cat.ribbonColor}77`,
                }}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.03, boxShadow: `0 6px 30px ${cat.ribbonColor}99` }}
              >
                <RotateCcw className="w-4 h-4" /> もう一度！
              </motion.button>
              <motion.button
                onClick={onBackToCategories}
                className="flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(220,210,255,0.88)' }}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.02 }}
              >
                <ArrowLeft className="w-4 h-4" /> カテゴリへ
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━━━━━ ④ 問題レビュー ━━━━━━━━ */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.08 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}
            >
              <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-center gap-2">
                <span>📋</span>
                <p className="text-white/90 font-black text-sm tracking-wide">問題レビュー</p>
              </div>

              {/* ⭕❌ タブ */}
              <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
                {questions.map((q, idx) => {
                  const isActive = idx === safeTab;
                  const res = results[idx] ?? results.find((r) => r.questionId === q.id);
                  const ok  = res?.isCorrect;
                  return (
                    <motion.button
                      key={getKey(q, idx)}
                      onClick={() => setActiveTab(idx)}
                      whileTap={{ scale: 0.85 }}
                      className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-black"
                      style={{
                        background: isActive ? `linear-gradient(135deg,${cat.ribbonColor},${cat.glow})` : 'rgba(255,255,255,0.07)',
                        borderColor: isActive ? 'rgba(255,255,255,0.45)'
                          : ok === true  ? 'rgba(52,211,153,0.5)'
                          : ok === false ? 'rgba(244,114,182,0.5)'
                          : 'rgba(255,255,255,0.12)',
                        boxShadow: isActive ? `0 0 14px ${cat.ribbonColor}88` : 'none',
                      }}
                    >
                      <span className="text-[10px]" style={{ color: isActive ? '#fff' : 'rgba(200,190,255,0.5)' }}>
                        {idx + 1}
                      </span>
                      <span className="text-lg leading-none">
                        {ok === true ? '⭕' : ok === false ? '❌' : '－'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* 問題内容 */}
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
                    {/* 問題文 */}
                    <div className="rounded-2xl p-3.5"
                      style={{
                        background: activeRes?.isCorrect ? 'rgba(16,185,129,0.13)' : 'rgba(244,114,182,0.1)',
                        border: activeRes?.isCorrect ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(244,114,182,0.4)',
                      }}
                    >
                      <p className="text-sm font-bold mb-1.5"
                        style={{ color: activeRes?.isCorrect ? '#6ee7b7' : '#f9a8d4' }}>
                        {activeRes?.isCorrect ? '⭕ 正解！' : '❌ 不正解…'}
                      </p>
                      <p className="text-white/95 text-sm font-semibold leading-relaxed">
                        {activeQ.question}
                      </p>
                    </div>

                    {/* 選択肢 */}
                    {activeQ.displayChoices.map((choice, idx) => {
                      const isAns = idx === activeQ.displayAnswerIndex;
                      const isSel = selectedIdx === idx;
                      return (
                        <div key={`${activeKey}-c${idx}`}
                          className="rounded-xl px-3 py-2.5 text-sm flex items-center gap-2"
                          style={{
                            background: isAns ? 'rgba(16,185,129,0.18)' : isSel ? 'rgba(167,85,247,0.18)' : 'rgba(255,255,255,0.05)',
                            border: isAns ? '1px solid rgba(52,211,153,0.5)' : isSel ? '1px solid rgba(167,85,247,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            color: isAns ? '#6ee7b7' : isSel ? '#d8b4fe' : 'rgba(220,210,255,0.8)',
                          }}
                        >
                          <span className="font-black opacity-50 shrink-0 text-xs">{idx + 1}.</span>
                          <span className="flex-1">{choice}</span>
                          {isAns && <span className="shrink-0 text-emerald-400 font-black text-xs">✓正解</span>}
                          {!isAns && isSel && <span className="shrink-0 text-violet-300 font-bold text-xs">あなた</span>}
                        </div>
                      );
                    })}

                    {/* 時間切れ案内 */}
                    {selectedIdx === null && (
                      <p className="text-xs text-center" style={{ color: 'rgba(200,190,255,0.45)' }}>
                        ⏱ 時間切れで未回答
                      </p>
                    )}

                    {/* ナイス / イマイチ ボタン */}
                    <div className="flex items-center gap-2 pt-1">
                      {([
                        { key: 'good' as QuestionReaction, label: '👍 ナイス問題', activeClr: 'rgba(16,185,129,0.35)', activeBd: 'rgba(52,211,153,0.75)', activeTx: '#6ee7b7' },
                        { key: 'bad'  as QuestionReaction, label: '👎 イマイチ',   activeClr: 'rgba(244,114,182,0.25)', activeBd: 'rgba(244,114,182,0.65)', activeTx: '#f9a8d4' },
                      ] as const).map((btn) => {
                        const on = activeReaction === btn.key;
                        return (
                          <motion.button
                            key={String(btn.key)}
                            onClick={() => toggleReaction(btn.key)}
                            className="px-3.5 py-2 rounded-full text-xs font-black border"
                            style={{
                              background:   on ? btn.activeClr : 'rgba(255,255,255,0.07)',
                              borderColor:  on ? btn.activeBd  : 'rgba(255,255,255,0.13)',
                              color:        on ? btn.activeTx  : 'rgba(200,190,255,0.6)',
                              boxShadow:    on ? `0 0 14px ${btn.activeBd}` : 'none',
                            }}
                            whileTap={{ scale: 1.28 }}
                            animate={on ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                            transition={{ duration: 0.25 }}
                          >
                            {btn.label}
                          </motion.button>
                        );
                      })}

                      {/* 通報ボタン：サブだが機能的に視認可能 */}
                      <button
                        onClick={() => setReportTarget(activeQ.id)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg transition-opacity opacity-40 hover:opacity-80"
                        style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(200,190,255,0.8)' }}
                      >
                        <Flag className="w-3 h-3" />
                        <span className="text-[10px] font-semibold">通報</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <p className="px-4 pb-4 text-sm text-white/30">レビュー対象がありません。</p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* 通報モーダル */}
      <AnimatePresence>
        {reportTarget && (
          <ReportModal
            questionId={reportTarget}
            onClose={() => setReportTarget(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
};
