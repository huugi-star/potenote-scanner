'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import {
  addRepairBookFragments,
  getRepairBookFragments,
} from '@/lib/repairBookFragments';
import { PotatoAvatar, type PotatoEmotion } from '@/components/ui/PotatoAvatar';
import { getItemById } from '@/data/items';
import { useGameStore } from '@/store/useGameStore';
import {
  calcRankInfo,
  calcBooksFromFragments,
  getTierUpMessage,
  RANK_TIERS,
  TOTAL_TIERS,
  TOTAL_BOOKS_MAX,
  FRAGMENTS_PER_BOOK_BY_TIER,
} from '@/constants/rankSystem';

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────
const HERO_SIZE   = 310;
const BOOK_HEIGHT = 56;
const TOTAL_SOCKETS = 30; // 3リング × 10

const BOOK_THEMES = [
  { bg: ['#f9c5c5','#e89090'], spine: '#d47070', emblem: '✦' },
  { bg: ['#c5d9f9','#8aaee8'], spine: '#6a94d4', emblem: '◈' },
  { bg: ['#c5f0c8','#87c98d'], spine: '#5ea865', emblem: '❋' },
  { bg: ['#e5c5f9','#c08ae8'], spine: '#9b6ad4', emblem: '✧' },
  { bg: ['#f9e8c5','#e8c07a'], spine: '#c89640', emblem: '⊕' },
  { bg: ['#c5f5f5','#7adada'], spine: '#3aacac', emblem: '◇' },
  { bg: ['#f5c5e8','#e87ac8'], spine: '#d44aaa', emblem: '✿' },
  { bg: ['#e8f5c5','#b8d87a'], spine: '#7aaa3a', emblem: '❀' },
  { bg: ['#f5e8c5','#d8c07a'], spine: '#b89030', emblem: '☽' },
  { bg: ['#d8c5f9','#a87ae8'], spine: '#7a4ad4', emblem: '⋆' },
];

const IDLE_MSGS = [
  'ことばを集めて、図書館を取り戻そう！',
  '今日もここへ来てくれたんだね。うれしい。',
  '本の声が、ちゃんと届いているよ。',
  'ゆっくりでいい。一枚一枚でいい。',
  '紙片は、思い出のかけらだよ。',
  '図書館がね、また少し息を吹き返した。',
  '君がいるだけで、ここが明るくなる。',
  '本棚が寂しそうにしてたよ。助けてあげて。',
  '集めた言葉は、消えないよ。ずっとここにある。',
  '頑張ってるね。ちゃんと見てるよ。',
  '急がなくていいよ。ここはどこにも行かないから。',
  '修繕した本たちが、喜んでるよ。',
  '今日の一枚が、明日の一冊になる。',
  'また来てくれた。ありがとう、本当に。',
];
const randIdle = () => IDLE_MSGS[Math.floor(Math.random() * IDLE_MSGS.length)];

// 決定論的な背景ドット（再レンダリングで変わらない）
const BG_DOTS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  size: ((i * 7 + 3) % 18 + 4) / 10,
  left: (i * 41 + 9) % 100,
  top:  (i * 57 + 5) % 85,
  opa:  ((i * 11 + 3) % 4) / 10 + 0.04,
  dur:  2.5 + (i % 5),
  del:  (i * 17 % 44) / 10,
}));

const vibrate = (p: number | number[]) => {
  if (typeof window === 'undefined') return;
  const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try { nav.vibrate?.(p); } catch { /* noop */ }
};

type Flyer = { id: number; fromX: number; fromY: number; rot: number };
const makeFlyer = (id: number): Flyer => {
  const side = Math.floor(Math.random() * 4);
  const t = Math.random();
  const pos = (() => {
    switch (side) {
      case 0: return { fromX: t,     fromY: -0.05 };
      case 1: return { fromX: 1.05,  fromY: t };
      case 2: return { fromX: t,     fromY: 1.05 };
      default:return { fromX: -0.05, fromY: t };
    }
  })();
  return { id, ...pos, rot: Math.floor(Math.random() * 90 - 45) };
};

// ─────────────────────────────────────────
// 背景（ライト）
// ─────────────────────────────────────────
function Background({ glow, color, light }: { glow: string; color: string; light: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0"
        style={{ background: `linear-gradient(170deg,#ffffff 0%,${light} 45%,#fdfbf6 100%)` }} />
      <div className="absolute inset-x-0 top-0"
        style={{ height: 300, background: `radial-gradient(ellipse 85% 50% at 50% 0%,${glow}1e 0%,transparent 70%)` }} />
      {BG_DOTS.map(d => (
        <motion.div key={d.id} className="absolute rounded-full"
          style={{ width: d.size, height: d.size, left: `${d.left}%`, top: `${d.top}%`, background: glow, opacity: d.opa }}
          animate={{ opacity: [d.opa, d.opa * 4, d.opa], scale: [1, 1.6, 1] }}
          transition={{ duration: d.dur, delay: d.del, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
      {/* 装飾リング */}
      <motion.div className="absolute pointer-events-none"
        style={{ left: '50%', top: '40%', marginLeft: -180, marginTop: -180 }}
        animate={{ rotate: 360 }} transition={{ duration: 140, ease: 'linear', repeat: Infinity }}>
        <svg width="360" height="360" viewBox="0 0 360 360" fill="none">
          <circle cx="180" cy="180" r="172" stroke={glow} strokeWidth="0.7" strokeOpacity="0.10" strokeDasharray="10 8" />
          <circle cx="180" cy="180" r="140" stroke={color} strokeWidth="0.5" strokeOpacity="0.07" strokeDasharray="5 11" />
        </svg>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────
// 魔導書 SVG
// ─────────────────────────────────────────
function GrimoireBook({ glow, color, pulseKey, flash }: {
  glow: string; color: string; pulseKey: number; flash: number;
}) {
  return (
    <motion.div className="flex items-center justify-center"
      key={`bk-${flash}`}
      animate={{
        scale:  flash > 0 ? [1, 1.2, 0.92, 1.05, 1] : [1, 1.022, 1],
        rotate: flash > 0 ? [0, -4, 4, -2, 0] : 0,
      }}
      transition={{ duration: flash > 0 ? 0.62 : 3.4, repeat: flash > 0 ? 0 : Infinity, ease: 'easeInOut' }}>
      {/* オーラ */}
      <motion.div className="absolute rounded-full"
        style={{ width: 110, height: 110, background: `radial-gradient(circle,${glow}25 0%,transparent 70%)` }}
        key={`a-${pulseKey}`}
        animate={{ scale: [0.86, 1.1, 1], opacity: [0.25, 0.75, 0.45] }}
        transition={{ duration: 0.65 }} />
      <svg width="102" height="123" viewBox="0 0 118 148" fill="none"
        style={{ filter: `drop-shadow(0 0 16px ${glow}99) drop-shadow(0 7px 18px rgba(0,0,0,0.22))`, position: 'relative', zIndex: 1 }}>
        <defs>
          <linearGradient id="cov" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2e1060" /><stop offset="40%" stopColor="#1e0850" /><stop offset="100%" stopColor="#150640" />
          </linearGradient>
          <linearGradient id="sp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a0840" /><stop offset="100%" stopColor="#2a1060" />
          </linearGradient>
          <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8e98a" /><stop offset="50%" stopColor={glow} /><stop offset="100%" stopColor="#c8880a" />
          </linearGradient>
          <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" /><stop offset="30%" stopColor={glow} /><stop offset="100%" stopColor={color} />
          </linearGradient>
          <radialGradient id="sh" cx="35%" cy="25%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" /><stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="gf"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <ellipse cx="66" cy="147" rx="44" ry="5" fill="rgba(0,0,0,0.12)" />
        <rect x="0" y="4" width="18" height="138" rx="3" fill="url(#sp)" />
        <rect x="14" y="4" width="2" height="138" fill="rgba(255,255,255,0.08)" />
        {[22, 74, 126].map(y => <rect key={y} x="2" y={y} width="14" height="1.5" rx="0.75" fill="url(#gd)" opacity="0.7" />)}
        <rect x="16" y="2" width="100" height="144" rx="4" fill="url(#cov)" />
        <rect x="16" y="2" width="100" height="144" rx="4" fill="url(#sh)" />
        <rect x="20" y="6" width="92" height="136" rx="3" fill="none" stroke="url(#gd)" strokeWidth="1.5" opacity="0.8" />
        <rect x="24" y="10" width="84" height="128" rx="2" fill="none" stroke={glow} strokeWidth="0.5" opacity="0.5" />
        {[{ cx: 24, cy: 10 }, { cx: 108, cy: 10 }, { cx: 24, cy: 138 }, { cx: 108, cy: 138 }].map(({ cx, cy }) => (
          <g key={`${cx}-${cy}`} opacity="0.9" filter="url(#gf)">
            <circle cx={cx} cy={cy} r="4" fill="none" stroke="url(#gd)" strokeWidth="1.2" />
            <circle cx={cx} cy={cy} r="1.5" fill={glow} />
            <line x1={cx + (cx < 66 ? 4 : -4)} y1={cy} x2={cx + (cx < 66 ? 12 : -12)} y2={cy} stroke="url(#gd)" strokeWidth="1" />
            <line x1={cx} y1={cy + (cy < 74 ? 4 : -4)} x2={cx} y2={cy + (cy < 74 ? 12 : -12)} stroke="url(#gd)" strokeWidth="1" />
          </g>
        ))}
        <g transform="translate(66,70)" filter="url(#gf)">
          <circle cx="0" cy="0" r="34" fill="none" stroke={glow} strokeWidth="0.8" opacity="0.6" strokeDasharray="4 3" />
          <circle cx="0" cy="0" r="26" fill="none" stroke={glow} strokeWidth="0.6" opacity="0.4" />
          <polygon points="0,-22 19,11 -19,11" fill="none" stroke="url(#gd)" strokeWidth="1" opacity="0.7" />
          <polygon points="0,22 19,-11 -19,-11" fill="none" stroke="url(#gd)" strokeWidth="1" opacity="0.7" />
          <circle cx="0" cy="0" r="14" fill={`${color}44`} stroke="url(#gd)" strokeWidth="1.5" />
          <polygon points="0,-10 8,0 0,10 -8,0" fill="url(#gm)" stroke={glow} strokeWidth="0.8" />
          <polygon points="0,-10 8,0 0,4" fill="rgba(255,255,255,0.3)" />
          <circle cx="-3" cy="-4" r="2" fill="rgba(255,255,255,0.4)" />
        </g>
        <g transform="translate(66,24)">
          <rect x="-20" y="-4" width="40" height="8" rx="4" fill="url(#gd)" opacity="0.85" />
          <circle cx="0" cy="0" r="3" fill={glow} />
        </g>
        <g transform="translate(66,120)">
          <rect x="-20" y="-4" width="40" height="8" rx="4" fill="url(#gd)" opacity="0.85" />
          <circle cx="0" cy="0" r="3" fill={glow} />
        </g>
        <text x="66" y="137" textAnchor="middle" fontSize="7" fill={glow} opacity="0.8" fontFamily="serif" letterSpacing="3">ARCANUM</text>
        <rect x="18" y="4" width="6" height="140" rx="3" fill="rgba(255,255,255,0.04)" />
      </svg>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// 本棚の1冊
// ─────────────────────────────────────────
function BookSpine({ index, isNew }: { index: number; isNew: boolean }) {
  const t = BOOK_THEMES[index % BOOK_THEMES.length];
  return (
    <motion.div className="relative shrink-0" style={{ width: 30, height: BOOK_HEIGHT }}
      initial={{ scale: 0.2, y: 18, opacity: 0, rotate: -10 }}
      animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 18 }}>
      <svg width="30" height={BOOK_HEIGHT} viewBox={`0 0 30 ${BOOK_HEIGHT}`} fill="none"
        style={{ filter: isNew ? `drop-shadow(0 0 10px ${t.spine})` : 'none' }}>
        <defs>
          <linearGradient id={`bg${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.bg[0]} /><stop offset="100%" stopColor={t.bg[1]} />
          </linearGradient>
          <linearGradient id={`sv${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.spine} /><stop offset="100%" stopColor={t.bg[1]} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="5" height={BOOK_HEIGHT} rx="2" fill={`url(#sv${index})`} />
        <rect x="4" y="0" width="25" height={BOOK_HEIGHT} rx="2" fill={`url(#bg${index})`} />
        <rect x="4" y="0" width="25" height="3.5" rx="2" fill="rgba(255,255,255,0.5)" />
        <text x="16" y={BOOK_HEIGHT / 2 + 5} textAnchor="middle" fontSize="12" fill={t.spine} opacity="0.8" fontFamily="serif">{t.emblem}</text>
        <rect x="7" y="9"  width="16" height="1" rx="0.5" fill={t.spine} opacity="0.35" />
        <rect x="7" y={BOOK_HEIGHT - 11} width="16" height="1" rx="0.5" fill={t.spine} opacity="0.35" />
        <rect x="26" y="0" width="4" height={BOOK_HEIGHT} rx="1" fill="rgba(255,255,255,0.18)" />
      </svg>
      {isNew && (
        <motion.div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xl"
          initial={{ y: 4, opacity: 0, scale: 0.5 }} animate={{ y: 0, opacity: 1, scale: 1 }}>✨</motion.div>
      )}
    </motion.div>
  );
}

function EmptySlot() {
  return (
    <div className="shrink-0 rounded-t-sm"
      style={{ width: 30, height: BOOK_HEIGHT, border: '1.5px dashed rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.025)' }} />
  );
}

// ─────────────────────────────────────────
// トースト
// ─────────────────────────────────────────
function FragmentToast({ visible, glow }: { visible: boolean; glow: string }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="pointer-events-none fixed left-1/2 z-50" style={{ top: 60 }}
          initial={{ opacity: 0, y: -10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -8, x: '-50%' }} transition={{ duration: 0.2 }}>
          <div className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black"
            style={{ background: 'rgba(255,255,255,0.98)', border: `1.5px solid ${glow}`, color: '#6a3800', boxShadow: `0 3px 20px rgba(0,0,0,0.12),0 0 14px ${glow}44` }}>
            📄 <span>紙片を回収！</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────
// すうひもちセリフ
// ─────────────────────────────────────────
function SuhimochiSpeech({ message, emotion, color }: {
  message: string; emotion: PotatoEmotion; color: string;
}) {
  const equipment = useGameStore(s => s.equipment);
  const equipped = useMemo(() => ({
    head:      equipment.head      ? getItemById(equipment.head)      : undefined,
    body:      equipment.body      ? getItemById(equipment.body)      : undefined,
    face:      equipment.face      ? getItemById(equipment.face)      : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment]);

  return (
    <motion.div className="flex items-end gap-3 px-1"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <motion.div className="shrink-0"
        animate={emotion === 'happy' ? { y: [0, -8, 0] } : emotion === 'confused' ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] } : { y: [0, -3, 0] }}
        transition={{ duration: emotion === 'happy' ? 0.45 : 2.4, repeat: Infinity, ease: 'easeInOut' }}>
        <PotatoAvatar equipped={equipped} emotion={emotion} size={58} ssrEffect={false} showShadow={false} />
      </motion.div>
      <motion.div className="relative flex-1 rounded-2xl rounded-bl-sm px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.92)', border: `1.5px solid ${color}44`, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}
        key={message} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}>
        <p className="text-sm font-bold leading-snug" style={{ color: '#3a2800' }}>{message}</p>
        {/* フキダシの三角 */}
        <div className="absolute bottom-3" style={{ left: -8, width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `9px solid ${color}44` }} />
        <div className="absolute bottom-3" style={{ left: -6, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '8px solid rgba(255,255,255,0.92)' }} />
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// ランク/級アップ演出
// ─────────────────────────────────────────
function RankUpOverlay({ tierIndex, gradeLabel, isNewTier, onClose }: {
  tierIndex: number; gradeLabel: string; isNewTier: boolean; onClose: () => void;
}) {
  const tier = RANK_TIERS[Math.min(tierIndex, RANK_TIERS.length - 1)];
  const msg  = isNewTier ? getTierUpMessage(tier.name) : null;

  return (
    <motion.div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.92)' }} />
      <motion.div className="absolute inset-0"
        style={{ background: `conic-gradient(from 0deg,${tier.glow}44 0deg,transparent 22deg,${tier.glow}22 44deg,transparent 66deg)`, maskImage: 'radial-gradient(circle at 50% 50%,black 12%,transparent 70%)', WebkitMaskImage: 'radial-gradient(circle at 50% 50%,black 12%,transparent 70%)' }}
        animate={{ rotate: 360 }} transition={{ duration: 7, ease: 'linear', repeat: Infinity }} />
      <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 48, height: 48, border: `3px solid ${tier.glow}`, boxShadow: `0 0 40px ${tier.glow}` }}
        initial={{ scale: 0, opacity: 0.9 }} animate={{ scale: 16, opacity: 0 }} transition={{ duration: 1.0, ease: 'easeOut' }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-[10px] font-black tracking-[0.55em]" style={{ color: tier.color }}>
          ― {isNewTier ? 'T I E R  U P' : 'G R A D E  U P'} ―
        </motion.div>

        <div className="mt-3 flex gap-2">
          {(isNewTier ? [0, 1, 2] : [0]).map(i => (
            <motion.span key={i} className={isNewTier ? 'text-4xl' : 'text-3xl'}
              initial={{ scale: 0, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.14, type: 'spring', stiffness: 320, damping: 16 }}
              style={{ color: tier.glow, textShadow: `0 0 16px ${tier.glow}` }}>★</motion.span>
          ))}
        </div>

        {isNewTier && (
          <motion.div className="mt-3 text-4xl font-black tracking-widest"
            style={{ color: tier.color, textShadow: `0 0 28px ${tier.glow}55` }}
            initial={{ y: 12, opacity: 0, scale: 0.75 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.62, type: 'spring', stiffness: 180, damping: 14 }}>
            {tier.name}
          </motion.div>
        )}

        <motion.div
          className={isNewTier ? 'mt-1 text-2xl font-black' : 'mt-4 text-5xl font-black tracking-widest'}
          style={{ color: isNewTier ? tier.glow : tier.color }}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: isNewTier ? 0.80 : 0.45, type: 'spring' }}>
          {gradeLabel}
        </motion.div>

        {msg && (
          <motion.div className="mt-5 max-w-[280px] rounded-2xl px-5 py-4"
            style={{ background: 'rgba(255,255,255,0.98)', border: `1px solid ${tier.glow}66`, boxShadow: '0 6px 28px rgba(0,0,0,0.10)' }}
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.05 }}>
            <div className="text-[9px] tracking-widest mb-2" style={{ color: `${tier.color}88` }}>― すうひもち ―</div>
            <div className="text-sm font-bold leading-relaxed" style={{ color: '#3a2800' }}>「{msg}」</div>
          </motion.div>
        )}

        <motion.button type="button"
          className="pointer-events-auto mt-5 rounded-full px-10 py-3 text-sm font-black tracking-widest"
          style={{ background: `linear-gradient(135deg,${tier.color},${tier.glow})`, color: '#fff', boxShadow: `0 4px 18px ${tier.glow}55` }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: msg ? 1.48 : 0.88 }}
          onClick={onClose} whileTap={{ scale: 0.97 }}>
          つづける
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// メイン
// ─────────────────────────────────────────
export function RepairBookScreen({ onBack, onStartQuiz }: { onBack: () => void; onStartQuiz: () => void }) {
  const [fragments,     setFragments]     = useState(0);
  const [flyers,        setFlyers]        = useState<Flyer[]>([]);
  const [flash,         setFlash]         = useState(0);
  const [newBookInTier, setNewBookInTier] = useState<number | null>(null);
  const [rankUpInfo,    setRankUpInfo]    = useState<{ tierIndex: number; gradeLabel: string; isNewTier: boolean; key: number } | null>(null);
  const [pulseKey,      setPulseKey]      = useState(0);
  const [toastVisible,  setToastVisible]  = useState(false);
  const [emotion,       setEmotion_]      = useState<PotatoEmotion>('normal');
  const [avatarMsg,     setAvatarMsg]     = useState(randIdle);

  const heroRef       = useRef<HTMLDivElement>(null);
  const targetRef     = useRef(0);
  const toastTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emotionTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBooksRef  = useRef(0);
  const nextFlyerId   = useRef(1);
  const flyerInFlight = useRef(false);
  const shakeCtrl     = useAnimation();

  const showToast = useCallback(() => {
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1400);
  }, []);

  const setEmotionMsg = useCallback((e: PotatoEmotion, msg: string, ms = 2200) => {
    setEmotion_(e); setAvatarMsg(msg);
    if (emotionTimer.current) clearTimeout(emotionTimer.current);
    emotionTimer.current = setTimeout(() => { setEmotion_('normal'); setAvatarMsg(randIdle()); }, ms);
  }, []);

  useEffect(() => {
    const v = getRepairBookFragments();
    targetRef.current = v;
    setFragments(v);
    prevBooksRef.current = calcBooksFromFragments(v).totalBooks;
  }, []);

  useEffect(() => {
    const refresh = () => { const l = getRepairBookFragments(); if (l !== targetRef.current) targetRef.current = l; };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(refresh, 500);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVis); window.clearInterval(iv); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setFragments(cur => {
        const target = targetRef.current;
        if (cur >= target) return cur;
        const next = cur + 1;

        if (!flyerInFlight.current) {
          flyerInFlight.current = true;
          const id = nextFlyerId.current++;
          setFlyers(fs => [...fs, makeFlyer(id)]);
          showToast();
          setEmotionMsg('happy', 'いいね！紙片がまた集まった！', 1800);
          window.setTimeout(() => { setFlyers(fs => fs.filter(f => f.id !== id)); flyerInFlight.current = false; }, 760);
        }
        setPulseKey(k => k + 1);

        const prevData = calcBooksFromFragments(cur);
        const nextData = calcBooksFromFragments(next);
        if (nextData.totalBooks > prevData.totalBooks) {
          const newBooks     = nextData.totalBooks;
          const prevRankInfo = calcRankInfo(prevBooksRef.current);
          const newRankInfo  = calcRankInfo(newBooks);

          window.setTimeout(() => {
            setFlash(k => k + 1);
            setNewBookInTier(newRankInfo.booksInTier - 1);
            window.setTimeout(() => setNewBookInTier(null), 1100);
            vibrate([12, 40, 14]);
            void shakeCtrl.start({ x: [0, -6, 7, -5, 4, 0], transition: { duration: 0.45 } });

            const isNewTier = newRankInfo.tierIndex > prevRankInfo.tierIndex;
            setEmotionMsg('confused', isNewTier
              ? `${newRankInfo.tier.name}に昇格した！すごい！`
              : `${newRankInfo.tier.name} ${newRankInfo.gradeLabel}に上がった！`, 3200);

            window.setTimeout(() => {
              setRankUpInfo({ tierIndex: newRankInfo.tierIndex, gradeLabel: newRankInfo.gradeLabel, isNewTier, key: Date.now() });
              vibrate(isNewTier ? [20, 40, 20, 40, 40] : [10, 30, 10]);
            }, 500);

            prevBooksRef.current = newBooks;
          }, 340);
        }

        return next;
      });
    };
    const iv = window.setInterval(tick, 260);
    return () => { cancelled = true; window.clearInterval(iv); };
  }, [shakeCtrl, showToast, setEmotionMsg]);

  // ── 表示計算 ──
  const { totalBooks, fragmentsInCurrentBook: inBook, currentFragsPerBook } = useMemo(
    () => calcBooksFromFragments(fragments), [fragments],
  );
  const pctInBook = (inBook / currentFragsPerBook) * 100;
  const rankInfo  = calcRankInfo(totalBooks);
  const { tier, gradeLabel, booksInTier, booksForTier, booksUntilNextTier, isMaxRank } = rankInfo;

  // ソケット：現在の紙片数分だけ点灯（最大30）
  // 現在ランクの currentFragsPerBook が 10/20/30 のどれかによって
  // 使用リング数が変わる（10枚→内リングのみ、20枚→内+中、30枚→全3リング）
  const litCount = Math.min(inBook, TOTAL_SOCKETS);
  const activeSocketCount = Math.min(currentFragsPerBook, TOTAL_SOCKETS); // 今のtierで使うソケット数

  const sockets = useMemo(() => {
    const rings = [
      { r: 95,  count: 10, size: 20 },
      { r: 122, count: 10, size: 20 },
      { r: 150, count: 10, size: 20 },
    ];
    const result: { globalIdx: number; x: number; y: number; size: number; ringIdx: number }[] = [];
    let globalIdx = 0;
    for (let ri = 0; ri < rings.length; ri++) {
      const { r, count, size } = rings[ri];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // 真上から開始
        result.push({
          globalIdx,
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
          size,
          ringIdx: ri,
        });
        globalIdx++;
      }
    }
    return result;
  }, []);
  const bookList   = useMemo(() => Array.from({ length: booksInTier }, (_, i) => i), [booksInTier]);
  const emptySlots = useMemo(() => Array.from({ length: Math.max(0, booksForTier - booksInTier) }, (_, i) => i), [booksInTier, booksForTier]);

  const getBookCenter = useCallback((): { left: string; top: string } => {
    if (!heroRef.current) return { left: '50%', top: '42%' };
    const r = heroRef.current.getBoundingClientRect();
    return { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` };
  }, []);

  const demoAdd = useCallback(() => { const n = addRepairBookFragments(1); targetRef.current = n; }, []);

  // 次ランク名
  const nextTierName = isMaxRank ? null : RANK_TIERS[Math.min(rankInfo.tierIndex + 1, TOTAL_TIERS - 1)].name;

  return (
    <div className="relative min-h-screen overflow-hidden"
      style={{ fontFamily: "'Hiragino Mincho ProN','Yu Mincho',serif" }}>

      <Background glow={tier.glow} color={tier.color} light={tier.light} />
      <FragmentToast visible={toastVisible} glow={tier.glow} />

      <AnimatePresence>
        {rankUpInfo && (
          <RankUpOverlay key={rankUpInfo.key}
            tierIndex={rankUpInfo.tierIndex} gradeLabel={rankUpInfo.gradeLabel}
            isNewTier={rankUpInfo.isNewTier} onClose={() => setRankUpInfo(null)} />
        )}
      </AnimatePresence>

      {/* 紙片フライヤー */}
      <AnimatePresence>
        {flyers.map(f => {
          const dest = getBookCenter();
          return (
            <motion.div key={f.id} className="pointer-events-none fixed z-30"
              style={{ left: `${f.fromX * 100}%`, top: `${f.fromY * 100}%`, fontSize: '3rem', filter: `drop-shadow(0 0 14px ${tier.glow}cc)`, translateX: '-50%', translateY: '-50%' }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.1, 0.65], left: dest.left, top: dest.top, rotate: f.rot + 180 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.76, ease: [0.22, 0.61, 0.36, 1] }}>📄</motion.div>
          );
        })}
      </AnimatePresence>

      {/* フラッシュ */}
      <AnimatePresence>
        {flash > 0 && (
          <motion.div key={flash} className="pointer-events-none fixed inset-0 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 0.38, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }}
            style={{ background: `radial-gradient(circle at 50% 42%,${tier.glow}88 0%,transparent 60%)` }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash > 0 && (
          <motion.div key={`rng-${flash}`} className="pointer-events-none fixed left-1/2 z-40 rounded-full"
            style={{ top: '42%', width: 64, height: 64, marginLeft: -32, marginTop: -32, border: `3px solid ${tier.glow}`, boxShadow: `0 0 24px ${tier.glow}` }}
            initial={{ scale: 0, opacity: 0.9 }} animate={{ scale: 9, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.82, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash > 0 && (
          <motion.div key={`conf-${flash}`} className="pointer-events-none fixed inset-0 z-40">
            {Array.from({ length: 22 }, (_, i) => {
              const ang = (i / 22) * Math.PI * 2, dist = 100 + (i % 3) * 50, hue = 32 + (i % 7) * 10;
              return (
                <motion.div key={i} className="absolute left-1/2 h-2.5 w-2.5 rounded-sm"
                  style={{ top: '42%', background: `hsl(${hue},82%,58%)` }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, opacity: 0, rotate: 360 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }} />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── コンテンツ ── */}
      <motion.div animate={shakeCtrl} className="relative z-10 mx-auto max-w-md px-4 pb-24 pt-4 flex flex-col">

        {/* 戻る */}
        <div className="mb-4 flex items-center">
          <motion.button type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.80)', color: tier.color, border: `1px solid ${tier.color}44`, boxShadow: '0 1px 5px rgba(0,0,0,0.07)' }}
            whileTap={{ scale: 0.95 }}>
            <ArrowLeft className="h-4 w-4" />戻る
          </motion.button>
        </div>

        {/* ① ランクカード（シンプル化）*/}
        <motion.div className="mb-5 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.88)', border: `1.5px solid ${tier.glow}55`, boxShadow: `0 2px 14px ${tier.glow}1a` }}
          key={`rank-${rankInfo.tierIndex}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="px-5 py-4" style={{ background: `linear-gradient(135deg,${tier.light} 0%,rgba(255,255,255,0.88) 100%)` }}>
            <div className="flex items-center justify-between">
              {/* 左：役職名＋級 */}
              <div>
                <div className="text-[9px] tracking-widest font-bold mb-0.5" style={{ color: `${tier.color}88` }}>現在のランク</div>
                <div className="text-xl font-black leading-none" style={{ color: tier.color }}>{tier.name}</div>
                <motion.div className="text-4xl font-black leading-tight tabular-nums"
                  style={{ color: tier.glow, textShadow: `0 0 14px ${tier.glow}44` }}
                  key={gradeLabel}
                  initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                  {gradeLabel}
                </motion.div>
              </div>
              {/* 右：次の級まで */}
              {!isMaxRank && (
                <div className="text-right">
                  <div className="text-[9px] tracking-widest font-bold mb-0.5" style={{ color: 'rgba(80,50,10,0.50)' }}>次の級まで</div>
                  <motion.div className="text-3xl font-black tabular-nums" style={{ color: tier.color }}
                    key={booksUntilNextTier}
                    initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18 }}>
                    あと{booksUntilNextTier}冊
                  </motion.div>
                  {nextTierName && booksUntilNextTier <= 2 && (
                    <motion.div className="text-[10px] font-bold mt-0.5" style={{ color: tier.glow }}
                      animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      → {nextTierName}へ！
                    </motion.div>
                  )}
                </div>
              )}
              {isMaxRank && (
                <div className="text-2xl font-black" style={{ color: tier.glow }}>🎉 MAX</div>
              )}
            </div>
            {/* 進捗バー（本単位） */}
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full" style={{ background: `${tier.color}18` }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg,${tier.color},${tier.glow})`, boxShadow: `0 0 8px ${tier.glow}88` }}
                  animate={{ width: `${(booksInTier / booksForTier) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] font-bold" style={{ color: `${tier.color}66` }}>0冊</span>
                <span className="text-[9px] font-bold" style={{ color: `${tier.color}66` }}>{booksForTier}冊で次のランクへ</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ② ヒーロー（本＋昇級の輪）*/}
        <div className="flex flex-col items-center mb-0">
          <div ref={heroRef} className="relative" style={{ width: HERO_SIZE, height: HERO_SIZE }}>
            {/* リングガイドライン */}
            {sockets.length > 0 && [
             { r: 95,  ri: 0 },
             { r: 122, ri: 1 },
             { r: 150, ri: 2 },
            ].map(({ r, ri }) => {
              const ringStart = ri * 10;
              const isActive = ringStart < activeSocketCount;
              return (
                <motion.div key={ri} className="absolute rounded-full pointer-events-none"
                  style={{
                    width: r * 2, height: r * 2,
                    left: '50%', top: '50%',
                    marginLeft: -r, marginTop: -r,
                    border: isActive
                      ? `1px dashed ${tier.glow}${ri === 0 ? '55' : ri === 1 ? '40' : '2a'}`
                      : '1px dashed rgba(0,0,0,0.05)',
                  }}
                  animate={{ rotate: ri % 2 === 0 ? 360 : -360 }}
                  transition={{ duration: 28 + ri * 12, ease: 'linear', repeat: Infinity }} />
              );
            })}

            {/* ソケット（30個） */}
            {sockets.map(s => {
              const filled   = s.globalIdx < litCount;
              const isLatest = s.globalIdx === litCount - 1 && litCount > 0;
              const isActive = s.globalIdx < activeSocketCount;
              return (
                <motion.div key={s.globalIdx}
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    width: s.size, height: s.size,
                    left: `calc(50% + ${s.x}px - ${s.size / 2}px)`,
                    top:  `calc(50% + ${s.y}px - ${s.size / 2}px)`,
                    background: filled
                      ? `radial-gradient(circle,${tier.glow} 0%,${tier.color} 80%)`
                      : isActive ? 'rgba(0,0,0,0.055)' : 'rgba(0,0,0,0.018)',
                    border: filled
                      ? `1.5px solid ${tier.glow}cc`
                      : isActive ? `1px solid rgba(0,0,0,0.10)` : `1px solid rgba(0,0,0,0.04)`,
                    boxShadow: isLatest
                      ? `0 0 18px ${tier.glow}ee, 0 0 6px ${tier.glow}`
                      : filled ? `0 0 9px ${tier.glow}88` : 'none',
                    zIndex: 2,
                    opacity: isActive ? 1 : 0.12,
                  }}
                  animate={isLatest ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                  transition={{ duration: 0.38 }}>
                  {filled && (
                    <span style={{ fontSize: s.size > 22 ? 11 : 9, lineHeight: 1 }}>📄</span>
                  )}
                </motion.div>
              );
            })}

            {/* 本体 */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
              <GrimoireBook glow={tier.glow} color={tier.color} pulseKey={pulseKey} flash={flash} />
            </div>
          </div>
        </div>

        {/* ③ すうひもち ← ヒーロー直下に移動 */}
        <div className="mb-3">
          <SuhimochiSpeech message={avatarMsg} emotion={emotion} color={tier.color} />
        </div>

        {/* ④ 昇級の輪ラベル ← アバターの下に移動 */}
        <motion.div className="flex flex-col items-center gap-1 mb-5"
          key={`label-${inBook}-${currentFragsPerBook}`}>
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{ background: 'rgba(255,255,255,0.88)', border: `1.5px solid ${tier.glow}55`, boxShadow: `0 2px 10px ${tier.glow}22` }}>
            <span style={{ fontSize: 13 }}>📄</span>
            <span className="text-sm font-black" style={{ color: tier.color }}>昇級の輪</span>
            <span className="text-xs font-bold" style={{ color: 'rgba(80,50,10,0.45)' }}>|</span>
            <motion.span className="text-base font-black tabular-nums" style={{ color: tier.glow }}
              key={inBook} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              {inBook}
            </motion.span>
            <span className="text-xs font-bold" style={{ color: 'rgba(80,50,10,0.40)' }}>/ {currentFragsPerBook} 葉</span>
          </div>
          <div className="text-[10px] font-bold" style={{ color: 'rgba(80,50,10,0.40)' }}>
            {currentFragsPerBook}枚で輪が完成 → 1冊修繕 → 1級アップ
          </div>
        </motion.div>

        {/* ⑤ 本棚 */}
        <div className="mb-5 overflow-hidden rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.88)', border: `1px solid ${tier.color}2a`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <span>📚</span>
              <span className="text-sm font-bold" style={{ color: '#4a3010' }}>このランクの本棚</span>
            </div>
            <motion.div key={`bc-${booksInTier}`} className="rounded-full px-3 py-1"
              style={{ background: `${tier.color}18`, border: `1px solid ${tier.glow}55` }}
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4 }}>
              <span className="text-sm font-black" style={{ color: tier.color }}>{booksInTier} / {booksForTier} 冊</span>
            </motion.div>
          </div>
          <div className="px-3 pb-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-t-sm"
                style={{ background: 'linear-gradient(180deg,rgba(235,215,185,0.55) 0%,rgba(210,185,145,0.45) 100%)' }} />
              <div className="relative flex flex-nowrap items-end gap-1.5 px-2 pt-4"
                style={{ height: BOOK_HEIGHT + 18, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {bookList.map(i => <BookSpine key={i} index={i} isNew={newBookInTier === i} />)}
                {emptySlots.map((_, i) => <EmptySlot key={`e-${i}`} />)}
              </div>
              <div className="h-3.5 rounded-sm"
                style={{ background: 'linear-gradient(180deg,#c49a60 0%,#a07840 55%,#7a5820 100%)', boxShadow: 'inset 0 2px 0 rgba(220,175,95,0.45),0 3px 8px rgba(0,0,0,0.13)' }} />
              <div className="h-2" style={{ background: 'linear-gradient(180deg,#7a5820 0%,#5a3c10 100%)' }} />
            </div>
          </div>
          <div className="mx-3 mb-3 mt-1 h-2 rounded-sm"
            style={{ background: 'linear-gradient(180deg,#a07840 0%,#7a5820 100%)', boxShadow: 'inset 0 1px 0 rgba(200,158,78,0.28)' }} />
        </div>

        {/* ⑤ 修繕開始ボタン */}
        <motion.button type="button" onClick={onStartQuiz}
          className="flex w-full items-center justify-center gap-3 rounded-2xl py-5 text-lg font-black tracking-widest mb-3"
          style={{ background: `linear-gradient(135deg,${tier.color},${tier.glow})`, color: '#fff', border: 'none', letterSpacing: '0.12em' }}
          animate={{ boxShadow: [`0 6px 28px ${tier.glow}44`, `0 8px 42px ${tier.glow}77`, `0 6px 28px ${tier.glow}44`] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}>
          📖 修繕開始！
        </motion.button>

        {/* 累計 */}
        <div className="text-center mb-2">
          <span className="text-xs font-medium" style={{ color: 'rgba(80,50,10,0.38)' }}>
            累計 {fragments} 枚 ・ 修繕済み {totalBooks} 冊
            {!isMaxRank && ` ・ 言詠士まであと ${TOTAL_BOOKS_MAX - totalBooks} 冊`}
          </span>
        </div>

       {/* 戻る */}
       <div className="mb-4 flex items-center justify-between">
          <motion.button type="button" onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.80)', color: tier.color, border: `1px solid ${tier.color}44`, boxShadow: '0 1px 5px rgba(0,0,0,0.07)' }}
            whileTap={{ scale: 0.95 }}>
            <ArrowLeft className="h-4 w-4" />戻る
          </motion.button>

          <div className="flex gap-2">
            <motion.button type="button"
              onClick={() => { const n = addRepairBookFragments(1); targetRef.current = n; }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.80)', color: tier.color, border: `1px solid ${tier.color}44`, boxShadow: '0 1px 5px rgba(0,0,0,0.07)' }}
              whileTap={{ scale: 0.95 }}>
              📄+1
            </motion.button>
            <motion.button type="button"
              onClick={() => { const n = addRepairBookFragments(10); targetRef.current = n; }}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: `linear-gradient(135deg,${tier.color}22,${tier.glow}33)`, color: tier.color, border: `1px solid ${tier.color}66`, boxShadow: '0 1px 5px rgba(0,0,0,0.07)' }}
              whileTap={{ scale: 0.95 }}>
              📄+5
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}