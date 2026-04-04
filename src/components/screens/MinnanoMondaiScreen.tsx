'use client';

/**
 * MinnanoMondaiScreen.tsx
 * 白ベース版「みんなの問題 > 試験カテゴリ選択」画面
 * - 上部のみダーク
 * - 本文は薄い紫白グラデ
 * - カードは白基調
 */

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  /** 見出しで `kanji` の直後に小さく付ける文字（例: 文系＋学問） */
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

    <div
      className="absolute inset-0"
      style={{ backgroundColor: 'rgba(245,242,250,0.68)' }}
    />

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
          <p
            className="text-[9px] tracking-[0.35em] uppercase mb-0.5"
            style={{ color: 'rgba(230,195,96,0.72)' }}
          >
            Magic Academy
          </p>
          <p className="text-white font-black text-sm tracking-wider">
            受講カテゴリー
          </p>
          <div
            className="mx-auto mt-1 h-[1px] w-24"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(255,200,60,0.8), transparent)',
            }}
          />
        </div>

        <div className="text-right">
          <p className="text-[9px]" style={{ color: 'rgba(230,195,96,0.66)' }}>
            総問題数
          </p>
          <p className="font-black text-sm" style={{ color: '#fde68a' }}>
            {totalCount}
            <span
              className="text-xs font-normal"
              style={{ color: 'rgba(220,220,220,0.55)' }}
            >
              {' '}
              問
            </span>
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
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(246,242,255,0.96) 100%)',
          border: '1px solid rgba(167,139,250,0.20)',
          boxShadow:
            '0 8px 24px rgba(80,60,160,0.08), 0 0 0 1px rgba(255,255,255,0.80) inset',
        }}
      >
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, rgba(255,220,120,0.28) 0%, rgba(180,120,20,0.10) 100%)',
            border: '1px solid rgba(255,200,60,0.35)',
          }}
        >
          <Trophy className="w-4 h-4" style={{ color: '#a16207' }} />
        </div>
        <div>
          <p
            className="text-xs font-bold"
            style={{ color: 'rgba(55,38,105,0.96)' }}
          >
            受講カテゴリーを選択してください
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{ color: 'rgba(108,88,164,0.74)' }}
          >
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
          ? '0 10px 28px rgba(80,60,160,0.10), 0 0 0 1px rgba(255,255,255,0.88) inset, 0 0 0 1px rgba(255,210,120,0.18)'
          : '0 8px 22px rgba(60,60,100,0.06), 0 0 0 1px rgba(255,255,255,0.78) inset',
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
      whileHover={isOpen ? { scale: 1.02, y: -2 } : { y: -1 }}
      whileTap={isOpen ? { scale: 0.98 } : {}}
    >
      <div
        className={`h-[6px] w-full bg-gradient-to-r ${cat.color}`}
        style={{ opacity: isOpen ? 1 : 0.42 }}
      />

      {isOpen && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${cat.color}`}
          style={{ opacity: 0.045 }}
        />
      )}

      <div className="relative p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0">
              <span
                className="font-black leading-none"
                style={{
                  fontSize: '28px',
                  letterSpacing: '0.02em',
                  color: isOpen ? '#3b245f' : '#716187',
                }}
              >
                {cat.kanji}
              </span>
              {cat.kanjiSub ? (
                <span
                  className="font-bold leading-none"
                  style={{
                    fontSize: '13px',
                    letterSpacing: '0.06em',
                    color: isOpen ? 'rgba(59,36,95,0.78)' : 'rgba(113,97,135,0.78)',
                  }}
                >
                  {cat.kanjiSub}
                </span>
              ) : null}
            </div>
            <p
              className="text-[8px] tracking-widest mt-0.5"
              style={{
                color: isOpen ? 'rgba(100,86,140,0.78)' : 'rgba(120,120,145,0.68)',
                whiteSpace: 'pre',
              }}
            >
              {cat.ruby}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span style={{ fontSize: '22px', opacity: isOpen ? 0.95 : 0.62 }}>
              {cat.icon}
            </span>
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{
                background: isOpen
                  ? `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})`
                  : 'rgba(120,120,150,0.18)',
                color: isOpen ? '#fff' : 'rgba(100,100,130,0.80)',
                border: isOpen
                  ? '1px solid rgba(255,255,255,0.24)'
                  : '1px solid rgba(150,150,180,0.18)',
                boxShadow: isOpen ? `0 6px 16px ${cat.glow}30` : 'none',
              }}
            >
              {count}問
            </span>
          </div>
        </div>

        <p
          className="text-[10px] leading-relaxed mb-2"
          style={{
            color: isOpen ? 'rgba(67,54,98,0.92)' : 'rgba(100,100,120,0.72)',
            whiteSpace: 'pre',
          }}
        >
          {cat.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-2.5 h-2.5 ${
                  i <= difficulty && isOpen
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>

          {isOpen ? (
            <div
              className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})`,
                boxShadow: `0 8px 18px ${cat.glow}28`,
              }}
            >
              <Swords className="w-2.5 h-2.5" />
              入室
            </div>
          ) : (
            <div
              className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px]"
              style={{
                background: 'rgba(120,120,150,0.14)',
                color: 'rgba(100,100,130,0.76)',
                border: '1px solid rgba(150,150,180,0.16)',
              }}
            >
              <Lock className="w-2.5 h-2.5" />
              募集中
            </div>
          )}
        </div>

        {isOpen && (
          <div
            className="flex items-center gap-1 mt-2 pt-2"
            style={{ borderTop: '1px solid rgba(120,100,180,0.10)' }}
          >
            <Users className="w-2.5 h-2.5" style={{ color: 'rgba(108,88,164,0.58)' }} />
            <span className="text-[9px]" style={{ color: 'rgba(108,88,164,0.66)' }}>
              {totalPlays}人が挑戦済み
            </span>
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
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: `linear-gradient(to right, transparent, ${cat.glow}cc 30%, #fff 50%, ${cat.glow}cc 70%, transparent)`,
            }}
          />

          <motion.button
            onClick={onBack}
            className="mb-4 flex items-center gap-1 text-sm"
            style={{ color: 'rgba(255,236,180,0.96)' }}
            whileTap={{ scale: 0.96 }}
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </motion.button>

          <div className="flex items-end justify-between max-w-md mx-auto">
            <div>
              <p
                className="text-[9px] tracking-[0.35em] mb-1"
                style={{ color: 'rgba(255,236,180,0.74)' }}
              >
                試験室
              </p>
              <div className="flex flex-wrap items-end gap-x-1 gap-y-0">
                <p
                  className="font-black text-5xl tracking-wide text-white leading-none"
                  style={{ textShadow: '0 6px 18px rgba(0,0,0,0.18)' }}
                >
                  {cat.kanji}
                </p>
                {cat.kanjiSub ? (
                  <span
                    className="font-black text-2xl tracking-wide text-white/90 pb-0.5"
                    style={{ textShadow: '0 4px 14px rgba(0,0,0,0.16)' }}
                  >
                    {cat.kanjiSub}
                  </span>
                ) : null}
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
            style={{
              background: `linear-gradient(135deg, ${cat.ribbonColor}, ${cat.glow})`,
            }}
            animate={
              glowing
                ? {
                    boxShadow: [
                      `0 0 20px ${cat.glow}35, inset 0 1px 0 rgba(255,255,255,0.2)`,
                      `0 0 38px ${cat.glow}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
                      `0 0 20px ${cat.glow}35, inset 0 1px 0 rgba(255,255,255,0.2)`,
                    ],
                  }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center gap-3">
              <Swords className="w-6 h-6" />
              試験開始
              <span className="text-sm font-normal opacity-80">
                （{Math.min(questions.length, 10)}問）
              </span>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </motion.button>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(160,150,210,0.20)',
              background: 'rgba(255,255,255,0.90)',
              boxShadow: '0 12px 28px rgba(80,60,160,0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(160,150,210,0.16)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <p className="text-xs font-bold" style={{ color: 'rgba(67,54,98,0.94)' }}>
                収録問題 {questions.length}問
              </p>
            </div>

            {questions.map((q, i) => (
              <motion.div
                key={q.id}
                className="flex items-center justify-between px-4 py-2.5"
                style={{
                  borderBottom:
                    i < questions.length - 1
                      ? '1px solid rgba(120,100,180,0.08)'
                      : 'none',
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-5 text-center text-xs font-bold"
                    style={{ color: 'rgba(108,88,164,0.56)' }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(67,54,98,0.88)' }}>
                      {q.subCategory ?? q.bigCategory}
                      {q.subjectText ? ` ・ ${q.subjectText}` : ''}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(108,88,164,0.60)' }}>
                      {(q.keywords ?? []).slice(0, 2).map((k) => `#${k}`).join(' ')}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono" style={{ color: 'rgba(108,88,164,0.52)' }}>
                  ？？？
                </span>
              </motion.div>
            ))}
          </div>
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

  const questionsByCategory = useMemo(() => {
    const map: Record<string, AcademyUserQuestion[]> = {};
    for (const cat of EXAM_CATEGORIES) {
      map[cat.label] = academyUserQuestions
        .filter((q) => q.bigCategory === cat.label)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [academyUserQuestions]);

  const recentQuestions = useMemo(
    () =>
      [...academyUserQuestions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [academyUserQuestions]
  );

  const handleChallenge = (_questions: AcademyUserQuestion[]) => {
    alert('試験開始機能は実装予定です');
  };

  if (selectedCat) {
    return (
      <ExamRoomInside
        cat={selectedCat}
        questions={questionsByCategory[selectedCat.label] ?? []}
        onBack={() => setSelectedCat(null)}
        onChallenge={handleChallenge}
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
          <div
            className="h-[1px] flex-1"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(200,160,60,0.32))',
            }}
          />
          <p
            className="text-[9px] tracking-[0.3em] uppercase"
            style={{ color: 'rgba(170,130,50,0.68)' }}
          >
            Select Exam Category
          </p>
          <div
            className="h-[1px] flex-1"
            style={{
              background:
                'linear-gradient(to left, transparent, rgba(200,160,60,0.32))',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {EXAM_CATEGORIES.map((cat, i) => (
            <CategoryCard
              key={cat.label}
              cat={cat}
              count={questionsByCategory[cat.label]?.length ?? 0}
              totalPlays={
                questionsByCategory[cat.label]?.reduce(
                  (s, q) => s + (q.playCount ?? 0),
                  0
                ) ?? 0
              }
              onSelect={() => setSelectedCat(cat)}
              index={i}
            />
          ))}
        </div>

        {recentQuestions.length > 0 && (
          <motion.div
            className="mt-4 rounded-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(160,150,210,0.18)',
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 14px 28px rgba(80,60,160,0.08)',
              backdropFilter: 'blur(10px)',
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(160,150,210,0.16)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <p className="text-xs font-bold" style={{ color: 'rgba(67,54,98,0.94)' }}>
                最近追加された問題
              </p>
            </div>

            {recentQuestions.map((q, idx) => {
              const cat = EXAM_CATEGORIES.find((c) => c.label === q.bigCategory);
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderBottom:
                      idx < recentQuestions.length - 1
                        ? '1px solid rgba(120,100,180,0.08)'
                        : 'none',
                  }}
                >
                  <span className="shrink-0" style={{ fontSize: '16px' }}>
                    {cat?.icon ?? '❓'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: 'rgba(67,54,98,0.92)' }}
                    >
                      {q.question}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(108,88,164,0.62)' }}>
                      {q.bigCategory} / {q.subCategory}
                      {q.subjectText ? ` ・ ${q.subjectText}` : ''}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[10px]"
                    style={{ color: 'rgba(108,88,164,0.58)' }}
                  >
                    {new Date(q.createdAt).toLocaleDateString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}

        <div
          className="mt-6 h-[1px] mx-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255,248,220,0.72) 0%, rgba(255,255,255,0.92) 100%)',
            borderBottom: '1px solid rgba(160,150,210,0.16)',
          }}
        />
      </div>
    </div>
  );
};