'use client';

/**
 * MinnanoMondaiScreen.tsx
 * 変更点:
 * 1. 選択肢をランダムシャッフル（displayChoices / displayAnswerIndex を問題ごとに生成）
 * 2. タップ座標に魔法陣SVGアニメーションを展開 → 完了後に○×フィードバック表示
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Swords,
  Star,
  Users,
  Lock,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { AcademyUserQuestion } from '@/types';

// ============================================================
// 試験カテゴリ定義
// ============================================================

const EXAM_CATEGORIES: {
  label: string;
  ruby: string;
  icon: string;
  kanji: string;
  kanjiSub?: string;
  color: string;
  glow: string;
  border: string;
  description: string;
  ribbonColor: string;
  lightBg: string;
  lightBorder: string;
}[] = [
  {
    label: '文系学問',
    ruby: 'ぶんけい',
    icon: '📚',
    kanji: '文系',
    kanjiSub: '学問',
    color: 'from-amber-500 via-yellow-400 to-orange-400',
    glow: '#f59e0b',
    border: 'border-amber-400/60',
    description: '歴史・地理\n国語・倫理',
    ribbonColor: '#b45309',
    lightBg: 'linear-gradient(135deg, rgba(255,251,235,0.98) 0%, rgba(254,243,199,0.96) 100%)',
    lightBorder: 'rgba(245,158,11,0.28)',
  },
  {
    label: '理系学問',
    ruby: 'りけい',
    icon: '🔬',
    kanji: '理系',
    kanjiSub: '学問',
    color: 'from-cyan-500 via-sky-500 to-blue-500',
    glow: '#06b6d4',
    border: 'border-cyan-400/60',
    description: '数学・物理\n化学・生物',
    ribbonColor: '#0284c7',
    lightBg: 'linear-gradient(135deg, rgba(240,249,255,0.98) 0%, rgba(224,242,254,0.96) 100%)',
    lightBorder: 'rgba(6,182,212,0.28)',
  },
  {
    label: '言語',
    ruby: 'げんご',
    icon: '🌐',
    kanji: '言語',
    color: 'from-emerald-500 via-green-500 to-teal-400',
    glow: '#10b981',
    border: 'border-emerald-400/60',
    description: '英語・韓国語\n中国語',
    ribbonColor: '#059669',
    lightBg: 'linear-gradient(135deg, rgba(236,253,245,0.98) 0%, rgba(209,250,229,0.96) 100%)',
    lightBorder: 'rgba(16,185,129,0.28)',
  },
  {
    label: '資格',
    ruby: 'しかく',
    icon: '🏅',
    kanji: '資格',
    color: 'from-orange-500 via-red-500 to-rose-500',
    glow: '#f97316',
    border: 'border-orange-400/60',
    description: '宅建・簿記\nIT・英検',
    ribbonColor: '#dc2626',
    lightBg: 'linear-gradient(135deg, rgba(255,247,237,0.98) 0%, rgba(255,228,230,0.96) 100%)',
    lightBorder: 'rgba(249,115,22,0.28)',
  },
  {
    label: 'エンタメ',
    ruby: 'えんため',
    icon: '🎮',
    kanji: '娯楽',
    color: 'from-purple-600 via-fuchsia-500 to-pink-500',
    glow: '#d946ef',
    border: 'border-fuchsia-400/60',
    description: '漫画・アニメ\nゲーム・映画',
    ribbonColor: '#a21caf',
    lightBg: 'linear-gradient(135deg, rgba(253,244,255,0.96) 0%, rgba(250,232,255,0.96) 100%)',
    lightBorder: 'rgba(217,70,239,0.28)',
  },
  {
    label: '趣味・教養',
    ruby: 'しゅみ\nきょうよう',
    icon: '🎨',
    kanji: '教養',
    color: 'from-rose-500 via-pink-500 to-fuchsia-400',
    glow: '#ec4899',
    border: 'border-rose-400/60',
    description: '雑学・哲学\nスポーツ',
    ribbonColor: '#be185d',
    lightBg: 'linear-gradient(135deg, rgba(255,241,242,0.98) 0%, rgba(252,231,243,0.96) 100%)',
    lightBorder: 'rgba(236,72,153,0.28)',
  },
  {
    label: '生活',
    ruby: 'せいかつ',
    icon: '🏠',
    kanji: '生活',
    color: 'from-teal-500 via-cyan-500 to-sky-400',
    glow: '#14b8a6',
    border: 'border-teal-400/60',
    description: '常識・マナー\n社会',
    ribbonColor: '#0f766e',
    lightBg: 'linear-gradient(135deg, rgba(240,253,250,0.98) 0%, rgba(224,242,254,0.96) 100%)',
    lightBorder: 'rgba(20,184,166,0.28)',
  },
  {
    label: 'オリジナル',
    ruby: 'おりじなる',
    icon: '✨',
    kanji: '創作',
    color: 'from-indigo-500 via-violet-500 to-purple-500',
    glow: '#6366f1',
    border: 'border-indigo-400/60',
    description: 'ユーザー\n創作問題',
    ribbonColor: '#4f46e5',
    lightBg: 'linear-gradient(135deg, rgba(238,242,255,0.98) 0%, rgba(243,232,255,0.96) 100%)',
    lightBorder: 'rgba(99,102,241,0.28)',
  },
];

const QUIZ_QUESTION_COUNT = 5;
const QUIZ_TIME_LIMIT_SEC = 10;
const QUIZ_TIME_LIMIT_MS = QUIZ_TIME_LIMIT_SEC * 1000;
/** 魔法陣アニメーション完了後にフィードバック(○×)を表示するまでの遅延 */
const MAGIC_CIRCLE_DURATION_MS = 450;
/** ○×フィードバック表示後に次問題へ進むまでの待機 */
const QUIZ_FEEDBACK_ADVANCE_MS = 1000;
const ANSWER_LABELS = ['①', '②', '③', '④'] as const;

// ============================================================
// 型定義
// ============================================================

type QuizQuestionResult = {
  questionId: string;
  isCorrect: boolean;
  elapsedSec: number;
  basePoint: number;
  timeBonus: number;
  totalPoint: number;
};

/**
 * シャッフル済み選択肢情報。
 * displayChoices: 表示順の選択肢テキスト配列
 * displayAnswerIndex: displayChoices における正解のインデックス
 */
type ShuffledQuestion = AcademyUserQuestion & {
  displayChoices: string[];
  displayAnswerIndex: number;
};

/** 魔法陣エフェクトの状態 */
type MagicCircleState = {
  id: number;
  x: number;
  y: number;
  isCorrect: boolean;
};

// ============================================================
// ユーティリティ
// ============================================================

/** Fisher-Yates シャッフル */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 選択肢をシャッフルし displayChoices / displayAnswerIndex を付与 */
function withShuffledChoices(q: AcademyUserQuestion): ShuffledQuestion {
  const indices = shuffleArray([0, 1, 2, 3].slice(0, q.choices.length));
  const displayChoices = indices.map((i) => q.choices[i]);
  const displayAnswerIndex = indices.indexOf(q.answerIndex);
  return { ...q, displayChoices, displayAnswerIndex };
}

function shuffleQuestions(items: AcademyUserQuestion[]): AcademyUserQuestion[] {
  return shuffleArray(items);
}

function buildQuizQuestions(
  categoryQuestions: AcademyUserQuestion[],
  allQuestions: AcademyUserQuestion[],
  count = QUIZ_QUESTION_COUNT
): ShuffledQuestion[] {
  const chosen = shuffleQuestions(categoryQuestions).slice(0, count);
  const filled =
    chosen.length >= count
      ? chosen
      : (() => {
          const chosenIds = new Set(chosen.map((q) => q.id));
          const fillers = shuffleQuestions(
            allQuestions.filter((q) => !chosenIds.has(q.id))
          ).slice(0, count - chosen.length);
          return [...chosen, ...fillers].slice(0, count);
        })();

  // 各問題に対してシャッフル済み選択肢を付与
  return filled.map(withShuffledChoices);
}

const persistAcademyAnswerAggregate = async (questionId: string, isCorrect: boolean): Promise<void> => {
  console.log(`[academy-answer] sending: questionId=${questionId} isCorrect=${isCorrect}`);
  try {
    const res = await fetch('/api/academy-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionId, isCorrect }),
    });

    type AcademyAnswerApiResponse = {
      success?: boolean;
      persisted?: boolean;
      createdFromSeed?: boolean;
      reason?: string;
      error?: string;
    };

    let body: AcademyAnswerApiResponse = {};
    try { body = (await res.json()) as AcademyAnswerApiResponse; } catch { /* ignore */ }

    if (!res.ok) {
      console.error(`[academy-answer] persist failed: status=${res.status} body=`, body);
      return;
    }

    console.log(`[academy-answer] persist ok: status=${res.status} body=`, body);

    if (body?.persisted === false && body?.reason === 'not_found') {
      console.warn(`[academy-answer] aggregate not persisted (not_found): questionId=${questionId}`);
    }
  } catch (error) {
    console.error('[academy-answer] persist request failed:', error);
  }
};

const calcRank = (score: number): 'S' | 'A' | 'B' | 'C' => {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  return 'C';
};

// ============================================================
// 魔法陣 SVG コンポーネント
// ============================================================

/**
 * タップ位置に展開する魔法陣エフェクト。
 * position: fixed で画面全体に被せるオーバーレイ上にレンダリングする。
 */
const MagicCircleEffect = ({
  circles,
  onComplete,
}: {
  circles: MagicCircleState[];
  onComplete: (id: number) => void;
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {circles.map((circle) => (
        <MagicCircleBurst
          key={circle.id}
          id={circle.id}
          x={circle.x}
          y={circle.y}
          isCorrect={circle.isCorrect}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
};

const MagicCircleBurst = ({
  id,
  x,
  y,
  isCorrect,
  onComplete,
}: {
  id: number;
  x: number;
  y: number;
  isCorrect: boolean;
  onComplete: (id: number) => void;
}) => {
  const color = isCorrect ? '#22c55e' : '#ef4444';
  const size = 320;

  const rings = [32, 58, 82, 106, 124];

  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return `${Math.cos(a) * 72},${Math.sin(a) * 72}`;
  }).join(' ');

  const tri1 = Array.from({ length: 3 }, (_, i) => {
    const a = (i / 3) * Math.PI * 2;
    return `${Math.cos(a) * 92},${Math.sin(a) * 92}`;
  }).join(' ');

  const tri2 = Array.from({ length: 3 }, (_, i) => {
    const a = (i / 3) * Math.PI * 2 + Math.PI;
    return `${Math.cos(a) * 92},${Math.sin(a) * 92}`;
  }).join(' ');

  const spokeAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const r = 56 + (i % 3) * 22;
    return { cx: Math.cos(a) * r, cy: Math.sin(a) * r };
  });

  return (
    <motion.div
      className="absolute"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      initial={{ scale: 0.05, opacity: 0, rotate: -30 }}
      animate={{
        scale: 1,
        opacity: [0, 1, 1, 0.55],
        rotate: isCorrect ? 90 : -90,
      }}
      transition={{ duration: MAGIC_CIRCLE_DURATION_MS / 1000, ease: 'easeOut' }}
      onAnimationComplete={() => onComplete(id)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <radialGradient id={`mg-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.70" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <circle r={38} fill={`url(#mg-${id})`} />

        {rings.map((r, i) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={i === rings.length - 1 ? 2.5 : 1.2}
            strokeOpacity={i === rings.length - 1 ? 1.0 : 0.65}
            strokeDasharray={i % 2 === 0 ? '5 4' : '2 6'}
          />
        ))}

        {spokeAngles.map((a, i) => (
          <line
            key={i}
            x1={Math.cos(a) * 32}
            y1={Math.sin(a) * 32}
            x2={Math.cos(a) * 116}
            y2={Math.sin(a) * 116}
            stroke={color}
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
        ))}

        <polygon
          points={hexPoints}
          fill="none"
          stroke={color}
          strokeOpacity="0.85"
          strokeWidth="2"
        />

        <polygon points={tri1} fill="none" stroke={color} strokeOpacity="0.65" strokeWidth="1.5" />
        <polygon points={tri2} fill="none" stroke={color} strokeOpacity="0.65" strokeWidth="1.5" />

        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r="4" fill={color} opacity="1.0" />
        ))}
      </svg>
    </motion.div>
  );
};

// ============================================================
// ライト背景
// ============================================================

const academyBackdropImageUrl = '/images/backgrounds/academy.png';

const LightAcademyBackground = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <img
      src={academyBackdropImageUrl}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full scale-105 object-cover object-center"
      style={{ filter: 'blur(1px)' }}
      decoding="async"
      fetchPriority="high"
    />
    <div className="absolute inset-0" style={{ backgroundColor: 'rgba(245,242,250,0.68)' }} />
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 55% 30% at 50% 18%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.1) 46%, transparent 74%)',
      }}
    />
  </div>
);

// ============================================================
// ダークヘッダー
// ============================================================

const CeremonyHeader = ({
  totalCount,
  loginDays,
  onBack,
}: {
  totalCount: number;
  loginDays: number;
  onBack: () => void;
}) => (
  <div className="relative z-10">
    <div
      className="relative px-4 pt-5 pb-4"
      style={{
        background:
          'linear-gradient(to bottom, rgba(17,11,44,0.98) 0%, rgba(25,17,58,0.95) 100%)',
        borderBottom: '1px solid rgba(200,160,40,0.28)',
        boxShadow: '0 8px 28px rgba(30,20,80,0.18)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background:
            'linear-gradient(to right, transparent 0%, rgba(255,200,60,0.7) 20%, rgba(255,220,100,1) 50%, rgba(255,200,60,0.7) 80%, transparent 100%)',
        }}
      />
      <div className="flex items-center justify-between max-w-md mx-auto">
        <motion.button
          onClick={onBack}
          className="flex items-center gap-1 text-sm"
          style={{ color: 'rgba(240,214,130,0.96)' }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>戻る</span>
        </motion.button>
        <div className="text-center">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(230,195,96,0.72)' }}>
            Magic Academy
          </p>
          <p className="text-white font-black text-sm tracking-wider">受講カテゴリー</p>
          <div
            className="mx-auto mt-1 h-[1px] w-24"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,200,60,0.8), transparent)' }}
          />
        </div>
        <div className="text-right">
          <p className="text-[9px]" style={{ color: 'rgba(230,195,96,0.66)' }}>総問題数</p>
          <p className="font-black text-sm" style={{ color: '#fde68a' }}>
            {totalCount}
            <span className="text-xs font-normal" style={{ color: 'rgba(220,220,220,0.55)' }}> 問</span>
          </p>
        </div>
      </div>
    </div>

    <motion.div
      className="max-w-md mx-auto px-4 pt-3"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(246,242,255,0.96) 100%)',
          border: '1px solid rgba(167,139,250,0.20)',
          boxShadow: '0 8px 24px rgba(80,60,160,0.08), 0 0 0 1px rgba(255,255,255,0.80) inset',
        }}
      >
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(255,220,120,0.28) 0%, rgba(180,120,20,0.10) 100%)',
            border: '1px solid rgba(255,200,60,0.35)',
          }}
        >
          <Trophy className="w-4 h-4" style={{ color: '#a16207' }} />
        </div>
        <div>
          <p className="text-xs font-bold" style={{ color: 'rgba(55,38,105,0.96)' }}>
            受講カテゴリーを選択してください
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(108,88,164,0.74)' }}>
            {loginDays}日連続出席 ・ {totalCount}問の知識が待つ
          </p>
        </div>
      </div>
    </motion.div>
  </div>
);

// ============================================================
// 白カード
// ============================================================

const CategoryCard = ({
  cat,
  count,
  totalPlays,
  onSelect,
  index,
}: {
  cat: typeof EXAM_CATEGORIES[number];
  count: number;
  totalPlays: number;
  onSelect: () => void;
  index: number;
}) => {
  const isOpen = count > 0;
  const difficulty = Math.min(5, Math.max(1, Math.ceil(count / 2)));

  return (
    <motion.button
      onClick={isOpen ? onSelect : undefined}
      className="relative w-full overflow-hidden text-left"
      style={{
        borderRadius: '18px',
        border: `1px solid ${isOpen ? cat.lightBorder : 'rgba(160,160,190,0.22)'}`,
        background: isOpen
          ? cat.lightBg
          : 'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(244,241,251,0.88) 100%)',
        boxShadow: isOpen
          ? '0 10px 28px rgba(80,60,160,0.10), 0 0 0 1px rgba(255,255,255,0.88) inset'
          : '0 8px 22px rgba(60,60,100,0.06), 0 0 0 1px rgba(255,255,255,0.78) inset',
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
      whileHover={isOpen ? { scale: 1.02, y: -2 } : { y: -1 }}
      whileTap={isOpen ? { scale: 0.98 } : {}}
    >
      <div className={`h-[6px] w-full bg-gradient-to-r ${cat.color}`} style={{ opacity: isOpen ? 1 : 0.42 }} />
      {isOpen && (
        <div className={`absolute inset-0 bg-gradient-to-br ${cat.color}`} style={{ opacity: 0.045 }} />
      )}
      <div className="relative p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0">
              <span
                className="font-black leading-none"
                style={{ fontSize: '28px', letterSpacing: '0.02em', color: isOpen ? '#3b245f' : '#716187' }}
              >
                {cat.kanji}
              </span>
              {cat.kanjiSub && (
                <span
                  className="font-bold leading-none"
                  style={{ fontSize: '13px', letterSpacing: '0.06em', color: isOpen ? 'rgba(59,36,95,0.78)' : 'rgba(113,97,135,0.78)' }}
                >
                  {cat.kanjiSub}
                </span>
              )}
            </div>
            <p className="text-[8px] tracking-widest mt-0.5" style={{ color: isOpen ? 'rgba(100,86,140,0.78)' : 'rgba(120,120,145,0.68)', whiteSpace: 'pre' }}>
              {cat.ruby}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span style={{ fontSize: '22px', opacity: isOpen ? 0.95 : 0.62 }}>{cat.icon}</span>
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{
                background: isOpen ? `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})` : 'rgba(120,120,150,0.18)',
                color: isOpen ? '#fff' : 'rgba(100,100,130,0.80)',
                border: isOpen ? '1px solid rgba(255,255,255,0.24)' : '1px solid rgba(150,150,180,0.18)',
                boxShadow: isOpen ? `0 6px 16px ${cat.glow}30` : 'none',
              }}
            >
              {count}問
            </span>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed mb-2" style={{ color: isOpen ? 'rgba(67,54,98,0.92)' : 'rgba(100,100,120,0.72)', whiteSpace: 'pre' }}>
          {cat.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`w-2.5 h-2.5 ${i <= difficulty && isOpen ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
            ))}
          </div>
          {isOpen ? (
            <div className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})`, boxShadow: `0 8px 18px ${cat.glow}28` }}>
              <Swords className="w-2.5 h-2.5" />
              入室
            </div>
          ) : (
            <div className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'rgba(120,120,150,0.14)', color: 'rgba(100,100,130,0.76)', border: '1px solid rgba(150,150,180,0.16)' }}>
              <Lock className="w-2.5 h-2.5" />
              募集中
            </div>
          )}
        </div>
        {isOpen && (
          <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(120,100,180,0.10)' }}>
            <Users className="w-2.5 h-2.5" style={{ color: 'rgba(108,88,164,0.58)' }} />
            <span className="text-[9px]" style={{ color: 'rgba(108,88,164,0.66)' }}>{totalPlays}人が挑戦済み</span>
          </div>
        )}
      </div>
    </motion.button>
  );
};

// ============================================================
// 入室後画面
// ============================================================

const ExamRoomInside = ({
  cat,
  questions,
  onBack,
  onChallenge,
}: {
  cat: typeof EXAM_CATEGORIES[number];
  questions: AcademyUserQuestion[];
  onBack: () => void;
  onChallenge: (q: AcademyUserQuestion[]) => void;
}) => {
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGlowing(true), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      <LightAcademyBackground />
      <div className="relative z-10">
        <div
          className="relative px-4 pb-8 pt-6"
          style={{
            background: `linear-gradient(to bottom, ${cat.ribbonColor}ee 0%, ${cat.ribbonColor}22 72%, transparent 100%)`,
            boxShadow: `0 10px 40px ${cat.glow}22`,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(to right, transparent, ${cat.glow}cc 30%, #fff 50%, ${cat.glow}cc 70%, transparent)` }} />
          <motion.button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm" style={{ color: 'rgba(255,236,180,0.96)' }} whileTap={{ scale: 0.96 }}>
            <ArrowLeft className="w-4 h-4" />
            戻る
          </motion.button>
          <div className="flex items-end justify-between max-w-md mx-auto">
            <div>
              <p className="text-[9px] tracking-[0.35em] mb-1" style={{ color: 'rgba(255,236,180,0.74)' }}>講義室</p>
              <div className="flex flex-wrap items-end gap-x-1 gap-y-0">
                <p className="font-black text-5xl tracking-wide text-white leading-none" style={{ textShadow: '0 6px 18px rgba(0,0,0,0.18)' }}>{cat.kanji}</p>
                {cat.kanjiSub && <span className="font-black text-2xl tracking-wide text-white/90 pb-0.5" style={{ textShadow: '0 4px 14px rgba(0,0,0,0.16)' }}>{cat.kanjiSub}</span>}
              </div>
              <p className="text-white/95 font-bold text-xl mt-1">{cat.label}</p>
            </div>
            <span className="text-7xl opacity-90">{cat.icon}</span>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pt-5 space-y-4">
          <motion.button
            onClick={() => onChallenge(questions)}
            className="relative w-full overflow-hidden rounded-2xl py-5 font-black text-white text-xl"
            style={{ background: `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})` }}
            animate={glowing ? { boxShadow: [`0 0 20px ${cat.glow}35, inset 0 1px 0 rgba(255,255,255,0.2)`, `0 0 38px ${cat.glow}55, inset 0 1px 0 rgba(255,255,255,0.2)`, `0 0 20px ${cat.glow}35, inset 0 1px 0 rgba(255,255,255,0.2)`] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center gap-3">
              <Swords className="w-6 h-6" />
              講義開始
              <span className="text-sm font-normal opacity-80">（{QUIZ_QUESTION_COUNT}問）</span>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </motion.button>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(160,150,210,0.20)', background: 'rgba(255,255,255,0.90)', boxShadow: '0 12px 28px rgba(80,60,160,0.08)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(160,150,210,0.16)' }}>
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <p className="text-xs font-bold" style={{ color: 'rgba(67,54,98,0.94)' }}>収録問題 {questions.length}問</p>
            </div>
            {questions.map((q, i) => (
              <motion.div key={q.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: i < questions.length - 1 ? '1px solid rgba(120,100,180,0.08)' : 'none' }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold" style={{ color: 'rgba(108,88,164,0.56)' }}>{i + 1}</span>
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(67,54,98,0.88)' }}>{q.subCategory ?? q.bigCategory}{q.subjectText ? ` ・ ${q.subjectText}` : ''}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(108,88,164,0.60)' }}>{(q.keywords ?? []).slice(0, 2).map((k) => `#${k}`).join(' ')}</p>
                  </div>
                </div>
                <span className="text-xs font-mono" style={{ color: 'rgba(108,88,164,0.52)' }}>？？？</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// クイズ回答画面（魔法陣エフェクト＋シャッフル対応）
// ============================================================

const QuizPlayView = ({
  cat,
  questions,
  currentQuestionIndex,
  timeLeftMs,
  selectedDisplayIndex,
  isLocked,
  answerFeedback,
  magicCircles,
  onRemoveMagicCircle,
  onAnswer,
  onBackToRoom,
}: {
  cat: typeof EXAM_CATEGORIES[number];
  questions: ShuffledQuestion[];
  currentQuestionIndex: number;
  timeLeftMs: number;
  selectedDisplayIndex: number | null;
  isLocked: boolean;
  answerFeedback: 'correct' | 'wrong' | null;
  magicCircles: MagicCircleState[];
  onRemoveMagicCircle: (id: number) => void;
  /** displayIndex（表示上のインデックス）を渡す */
  onAnswer: (displayIndex: number, clientX: number, clientY: number) => void;
  onBackToRoom: () => void;
}) => {
  const current = questions[currentQuestionIndex];
  const timeLeftSec = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const progress = Math.max(0, Math.min(100, (timeLeftMs / QUIZ_TIME_LIMIT_MS) * 100));
  const safePlayCount = typeof current?.playCount === 'number' ? Math.max(0, current.playCount) : 0;
  const safeCorrectCount = typeof current?.correctCount === 'number' ? Math.max(0, current.correctCount) : 0;
  const correctRate = safePlayCount > 0
    ? Math.max(0, Math.min(100, Math.floor((safeCorrectCount / safePlayCount) * 100)))
    : null;
  const rawAuthorName = String(current?.authorName ?? '').trim();
  const authorLabel =
    !rawAuthorName || rawAuthorName === '匿名ユーザー' ? '匿名' : rawAuthorName;

  if (!current) return null;

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      <LightAcademyBackground />

      {/* 魔法陣オーバーレイ */}
      <MagicCircleEffect circles={magicCircles} onComplete={onRemoveMagicCircle} />

      {/* ○× フィードバック */}
      <AnimatePresence>
        {answerFeedback && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              style={{ fontSize: '120px', lineHeight: 1, filter: 'drop-shadow(0 0 24px rgba(0,0,0,0.2))' }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              {answerFeedback === 'correct' ? '⭕️' : '❌'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-md mx-auto px-4 pt-6">
        {/* ヘッダー行 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBackToRoom} className="text-xs font-bold" style={{ color: 'rgba(108,88,164,0.84)' }}>
            ← 講義室へ戻る
          </button>
          <span className="text-xs font-bold" style={{ color: 'rgba(67,54,98,0.78)' }}>
            {currentQuestionIndex + 1} / {questions.length}
          </span>
        </div>

        {/* 問題文（正答率:右上 / 出題者:右下） */}
        <div
          className="relative rounded-2xl p-4 mb-3 pb-7"
          style={{ border: '1px solid rgba(160,150,210,0.22)', background: 'rgba(255,255,255,0.94)', boxShadow: '0 12px 28px rgba(80,60,160,0.08)' }}
        >
          <div
            className="absolute top-2.5 right-2.5 z-[1] rounded-lg px-2.5 py-1 text-xs font-black tabular-nums shadow-md"
            style={{
              color: '#4c1d95',
              background: 'linear-gradient(135deg, rgba(253,230,138,0.95) 0%, rgba(250,204,21,0.88) 100%)',
              border: '1px solid rgba(180,130,20,0.45)',
              boxShadow: '0 4px 14px rgba(234,179,8,0.35), 0 0 0 1px rgba(255,255,255,0.5) inset',
            }}
          >
            正答率 {correctRate === null ? '--' : `${correctRate}%`}
          </div>

          <p className="text-[10px] font-bold mb-2 pr-[7.5rem]" style={{ color: 'rgba(108,88,164,0.7)' }}>
            {cat.icon} {cat.label}
          </p>

          <p className="text-base font-bold leading-relaxed pr-1" style={{ color: 'rgba(55,38,105,0.96)' }}>
            {current.question}
          </p>

          <p
            className="absolute bottom-2 right-3 max-w-[70%] text-right text-[9px] font-normal leading-tight truncate"
            style={{ color: 'rgba(108,88,164,0.52)' }}
            title={authorLabel}
          >
            出題者 {authorLabel}
          </p>
        </div>

        {/* タイマー */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold" style={{ color: 'rgba(67,54,98,0.74)' }}>制限時間</span>
            <span className="text-sm font-black" style={{ color: timeLeftSec <= 3 ? '#dc2626' : '#6d28d9' }}>
              {timeLeftSec}s
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/70 border border-violet-200 overflow-hidden">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                background: timeLeftSec <= 3 ? 'linear-gradient(90deg, #fb7185, #ef4444)' : 'linear-gradient(90deg, #8b5cf6, #6366f1)',
              }}
            />
          </div>
        </div>

        {/* 選択肢（シャッフル済み displayChoices を使用） */}
        <div className="space-y-2.5">
          {current.displayChoices.map((choiceText, displayIdx) => {
            const isSelected = selectedDisplayIndex === displayIdx;
            const isCorrectDisplay = displayIdx === current.displayAnswerIndex;

            let bg = 'rgba(255,255,255,0.92)';
            let border = '1px solid rgba(160,150,210,0.24)';
            let shadow = '0 8px 16px rgba(80,60,160,0.06)';
            let textColor = 'rgba(55,38,105,0.95)';

            if (answerFeedback && isLocked) {
              if (isCorrectDisplay) {
                bg = 'linear-gradient(135deg, rgba(220,252,231,0.98), rgba(187,247,208,0.98))';
                border = '1.5px solid rgba(34,197,94,0.60)';
                shadow = '0 10px 24px rgba(34,197,94,0.20)';
                textColor = '#14532d';
              } else if (isSelected && answerFeedback === 'wrong') {
                bg = 'linear-gradient(135deg, rgba(254,226,226,0.98), rgba(252,165,165,0.90))';
                border = '1.5px solid rgba(239,68,68,0.55)';
                shadow = '0 10px 24px rgba(239,68,68,0.18)';
                textColor = '#7f1d1d';
              }
            } else if (isSelected) {
              bg = 'linear-gradient(135deg, rgba(238,242,255,0.96), rgba(224,231,255,0.96))';
              border = '1px solid rgba(99,102,241,0.66)';
              shadow = '0 10px 20px rgba(99,102,241,0.16)';
            }

            return (
              <motion.button
                key={`${current.id}-display-${displayIdx}`}
                onClick={(e) => {
                  if (isLocked) return;
                  onAnswer(displayIdx, e.clientX, e.clientY);
                }}
                className="w-full rounded-2xl px-4 py-3 text-left transition-colors duration-200"
                style={{ border, background: bg, boxShadow: shadow, color: textColor, cursor: isLocked ? 'default' : 'pointer' }}
                animate={answerFeedback && isCorrectDisplay ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm font-black mr-2">{ANSWER_LABELS[displayIdx]}</span>
                <span className="text-sm font-semibold">{choiceText}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// リザルト画面
// ============================================================

const QuizResultView = ({
  cat,
  questions,
  results,
  onRetry,
  onBackToCategories,
}: {
  cat: typeof EXAM_CATEGORIES[number];
  questions: ShuffledQuestion[];
  results: QuizQuestionResult[];
  onRetry: () => void;
  onBackToCategories: () => void;
}) => {
  const correctCount = results.filter((r) => r.isCorrect).length;
  const basePoint = results.reduce((sum, r) => sum + r.basePoint, 0);
  const timeBonus = results.reduce((sum, r) => sum + r.timeBonus, 0);
  const totalPoint = basePoint + timeBonus;
  const rank = calcRank(totalPoint);

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      <LightAcademyBackground />
      <div className="relative z-10 max-w-md mx-auto px-4 pt-8">
        <div className="rounded-3xl p-5 mb-4" style={{ border: '1px solid rgba(160,150,210,0.24)', background: 'rgba(255,255,255,0.94)', boxShadow: '0 14px 30px rgba(80,60,160,0.1)' }}>
          <p className="text-[10px] tracking-[0.25em] mb-1" style={{ color: 'rgba(108,88,164,0.74)' }}>RESULT</p>
          <p className="text-lg font-black mb-3" style={{ color: 'rgba(55,38,105,0.96)' }}>{cat.icon} {cat.label} 試験結果</p>
          <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: 'rgba(237,233,254,0.56)' }}>
            <p className="text-xs font-bold mb-1" style={{ color: 'rgba(76,29,149,0.84)' }}>ランク</p>
            <p className="text-5xl font-black leading-none" style={{ color: '#6d28d9' }}>{rank}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(250,245,255,0.92)' }}>
              <p className="text-[11px]" style={{ color: 'rgba(108,88,164,0.72)' }}>正解数</p>
              <p className="text-lg font-black" style={{ color: 'rgba(55,38,105,0.96)' }}>{correctCount} / {questions.length}</p>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(250,245,255,0.92)' }}>
              <p className="text-[11px]" style={{ color: 'rgba(108,88,164,0.72)' }}>合計点</p>
              <p className="text-lg font-black" style={{ color: 'rgba(55,38,105,0.96)' }}>{totalPoint} 点</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm" style={{ color: 'rgba(67,54,98,0.9)' }}>
            <p>正解点: {basePoint} 点</p>
            <p>時間ボーナス: {timeBonus} 点</p>
            <p>合計点: {totalPoint} 点</p>
          </div>
        </div>
        <div className="space-y-2">
          <button onClick={onRetry} className="w-full rounded-2xl py-3 text-white font-black" style={{ background: `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})` }}>
            もう一度挑戦
          </button>
          <button onClick={onBackToCategories} className="w-full rounded-2xl py-3 font-bold" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(160,150,210,0.24)', color: 'rgba(67,54,98,0.9)' }}>
            受講カテゴリーへ戻る
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// メイン
// ============================================================

export const MinnanoMondaiScreen = ({ onBack }: { onBack: () => void }) => {
  const academyUserQuestions = useGameStore((s) => s.academyUserQuestions);
  const consecutiveLoginDays = useGameStore((s) => s.consecutiveLoginDays);

  const [selectedCat, setSelectedCat] = useState<typeof EXAM_CATEGORIES[number] | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<ShuffledQuestion[]>([]);
  const [quizPhase, setQuizPhase] = useState<'idle' | 'playing' | 'result'>('idle');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(QUIZ_TIME_LIMIT_MS);
  /** 表示インデックス（displayChoices 上のインデックス） */
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizQuestionResult[]>([]);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [magicCircles, setMagicCircles] = useState<MagicCircleState[]>([]);
  const magicIdRef = useRef(0);
  const feedbackAdvanceTimerRef = useRef<number | null>(null);

  const questionsByCategory = useMemo(() => {
    const map: Record<string, AcademyUserQuestion[]> = {};
    for (const cat of EXAM_CATEGORIES) {
      map[cat.label] = academyUserQuestions
        .filter((q) => q.bigCategory === cat.label)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [academyUserQuestions]);

  const recentQuestions = useMemo(() => {
    const posted = academyUserQuestions.filter((q) => !!q.authorUid);
    const source = posted.length > 0 ? posted : academyUserQuestions;
    return [...source]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [academyUserQuestions]);

  const startQuiz = useCallback(
    (categoryQuestions: AcademyUserQuestion[]) => {
      const picked = buildQuizQuestions(categoryQuestions, academyUserQuestions, QUIZ_QUESTION_COUNT);
      if (picked.length < QUIZ_QUESTION_COUNT) {
        alert('問題数が不足しています。5問以上登録してください。');
        return;
      }
      setQuizQuestions(picked);
      setQuizResults([]);
      setCurrentQuestionIndex(0);
      setSelectedDisplayIndex(null);
      setIsLocked(false);
      setTimeLeftMs(QUIZ_TIME_LIMIT_MS);
      setQuestionStartedAt(Date.now());
      setAnswerFeedback(null);
      setMagicCircles([]);
      setQuizPhase('playing');
    },
    [academyUserQuestions]
  );

  /**
   * 魔法陣を画面に追加し、アニメーション完了後に○×フィードバックを表示する。
   * displayIndex が null の場合はタイムアウト（タップなし）。
   */
  const finishCurrentAndMove = useCallback(
    (displayIndex: number | null, clientX = 0, clientY = 0) => {
      if (quizPhase !== 'playing' || isLocked) return;
      const current = quizQuestions[currentQuestionIndex];
      if (!current) return;

      setIsLocked(true);
      setSelectedDisplayIndex(displayIndex);

      const elapsedSec = Math.min(QUIZ_TIME_LIMIT_SEC, Math.floor((Date.now() - questionStartedAt) / 1000));
      const isCorrect = displayIndex !== null && displayIndex === current.displayAnswerIndex;
      const basePoint = isCorrect ? 10 : 0;
      const timeBonus = isCorrect ? Math.max(0, 10 - elapsedSec) : 0;
      const totalPoint = basePoint + timeBonus;

      // 正答率表示用の統計をローカル状態に即時反映（公式seed/ユーザー投稿の両方に適用）
      useGameStore.setState((state) => ({
        academyUserQuestions: state.academyUserQuestions.map((q) => {
          if (q.id !== current.id) return q;
          const nextPlayCount = Math.max(0, Number(q.playCount ?? 0)) + 1;
          const nextCorrectCount = Math.max(0, Number(q.correctCount ?? 0)) + (isCorrect ? 1 : 0);
          return {
            ...q,
            playCount: nextPlayCount,
            correctCount: nextCorrectCount,
          };
        }),
      }));
      void persistAcademyAnswerAggregate(current.id, isCorrect);

      setQuizResults((prev) => [
        ...prev,
        { questionId: current.id, isCorrect, elapsedSec, basePoint, timeBonus, totalPoint },
      ]);

      if (displayIndex !== null) {
        // タップあり → 魔法陣を展開してから○×表示
        const id = ++magicIdRef.current;
        setMagicCircles((prev) => [...prev, { id, x: clientX, y: clientY, isCorrect }]);

        // 魔法陣アニメーション完了後に○×を表示
        const magicTimer = window.setTimeout(() => {
          setAnswerFeedback(isCorrect ? 'correct' : 'wrong');
          scheduleAdvance();
        }, MAGIC_CIRCLE_DURATION_MS);

        return () => window.clearTimeout(magicTimer);
      } else {
        // タイムアウト → 即座に表示
        setAnswerFeedback(isCorrect ? 'correct' : 'wrong');
        scheduleAdvance();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentQuestionIndex, isLocked, questionStartedAt, quizPhase, quizQuestions]
  );

  /** ○×表示後に次問題へ進む */
  const scheduleAdvance = () => {
    if (feedbackAdvanceTimerRef.current !== null) window.clearTimeout(feedbackAdvanceTimerRef.current);
    feedbackAdvanceTimerRef.current = window.setTimeout(() => {
      feedbackAdvanceTimerRef.current = null;
      setAnswerFeedback(null);
      setMagicCircles([]);

      setCurrentQuestionIndex((prev) => {
        const next = prev + 1;
        if (next >= QUIZ_QUESTION_COUNT) {
          setQuizPhase('result');
          return prev;
        }
        setSelectedDisplayIndex(null);
        setIsLocked(false);
        setTimeLeftMs(QUIZ_TIME_LIMIT_MS);
        setQuestionStartedAt(Date.now());
        return next;
      });
    }, QUIZ_FEEDBACK_ADVANCE_MS);
  };

  // タイマー
  useEffect(() => {
    if (quizPhase !== 'playing' || isLocked) return;
    const id = window.setInterval(() => {
      const left = QUIZ_TIME_LIMIT_MS - (Date.now() - questionStartedAt);
      if (left <= 0) {
        setTimeLeftMs(0);
        finishCurrentAndMove(null);
        return;
      }
      setTimeLeftMs(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [finishCurrentAndMove, isLocked, questionStartedAt, quizPhase]);

  const handleBackToRoom = () => {
    if (feedbackAdvanceTimerRef.current !== null) {
      window.clearTimeout(feedbackAdvanceTimerRef.current);
      feedbackAdvanceTimerRef.current = null;
    }
    setQuizPhase('idle');
    setQuizQuestions([]);
    setQuizResults([]);
    setCurrentQuestionIndex(0);
    setSelectedDisplayIndex(null);
    setIsLocked(false);
    setTimeLeftMs(QUIZ_TIME_LIMIT_MS);
    setQuestionStartedAt(0);
    setAnswerFeedback(null);
    setMagicCircles([]);
  };

  const handleBackToCategories = () => {
    handleBackToRoom();
    setSelectedCat(null);
  };

  // ============================================================
  // 画面分岐
  // ============================================================

  if (selectedCat) {
    if (quizPhase === 'playing') {
      return (
        <QuizPlayView
          cat={selectedCat}
          questions={quizQuestions}
          currentQuestionIndex={currentQuestionIndex}
          timeLeftMs={timeLeftMs}
          selectedDisplayIndex={selectedDisplayIndex}
          isLocked={isLocked}
          answerFeedback={answerFeedback}
          magicCircles={magicCircles}
          onRemoveMagicCircle={(id) => setMagicCircles((prev) => prev.filter((c) => c.id !== id))}
          onAnswer={(displayIdx, cx, cy) => finishCurrentAndMove(displayIdx, cx, cy)}
          onBackToRoom={handleBackToRoom}
        />
      );
    }

    if (quizPhase === 'result') {
      return (
        <QuizResultView
          cat={selectedCat}
          questions={quizQuestions}
          results={quizResults}
          onRetry={() => startQuiz(questionsByCategory[selectedCat.label] ?? [])}
          onBackToCategories={handleBackToCategories}
        />
      );
    }

    return (
      <ExamRoomInside
        cat={selectedCat}
        questions={questionsByCategory[selectedCat.label] ?? []}
        onBack={() => setSelectedCat(null)}
        onChallenge={(q) => startQuiz(q)}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <LightAcademyBackground />

      <div className="sticky top-0 z-20">
        <CeremonyHeader
          totalCount={academyUserQuestions.length}
          loginDays={consecutiveLoginDays}
          onBack={onBack}
        />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(200,160,60,0.32))' }} />
          <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: 'rgba(170,130,50,0.68)' }}>Select Exam Category</p>
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(200,160,60,0.32))' }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {EXAM_CATEGORIES.map((cat, i) => (
            <CategoryCard
              key={cat.label}
              cat={cat}
              count={questionsByCategory[cat.label]?.length ?? 0}
              totalPlays={questionsByCategory[cat.label]?.reduce((s, q) => s + (q.playCount ?? 0), 0) ?? 0}
              onSelect={() => setSelectedCat(cat)}
              index={i}
            />
          ))}
        </div>

        {recentQuestions.length > 0 && (
          <motion.div
            className="mt-4 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(160,150,210,0.18)', background: 'rgba(255,255,255,0.92)', boxShadow: '0 14px 28px rgba(80,60,160,0.08)', backdropFilter: 'blur(10px)' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(160,150,210,0.16)' }}>
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <p className="text-xs font-bold" style={{ color: 'rgba(67,54,98,0.94)' }}>最近追加された問題</p>
            </div>
            {recentQuestions.map((q, idx) => {
              const cat = EXAM_CATEGORIES.find((c) => c.label === q.bigCategory);
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: idx < recentQuestions.length - 1 ? '1px solid rgba(120,100,180,0.08)' : 'none' }}
                >
                  <span className="shrink-0" style={{ fontSize: '16px' }}>{cat?.icon ?? '❓'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" style={{ color: 'rgba(67,54,98,0.92)' }}>{q.question}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(108,88,164,0.62)' }}>
                      {q.bigCategory} / {q.subCategory}{q.subjectText ? ` ・ ${q.subjectText}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px]" style={{ color: 'rgba(108,88,164,0.58)' }}>
                    {new Date(q.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};
