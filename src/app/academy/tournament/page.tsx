'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { PotatoAvatar, type PotatoEmotion } from '@/components/ui/PotatoAvatar';
import { ALL_ITEMS, getItemById, type Item } from '@/data/items';
import type { AcademyUserQuestion } from '@/types';
import { useGameStore } from '@/store/useGameStore';

// ─── Types ───────────────────────────────────────────────────────────────────
type GamePhase =
  | 'lobby'
  | 'quiz'
  | 'result'
  | 'semifinal_category'
  | 'final_category'
  | 'tournament_final_result';
type CpuStatus = 'thinking' | 'answered' | 'correct' | 'wrong';

type Round = 'round1' | 'semi' | 'final';

type TournamentReach =
  | 'none'
  | 'round1_eliminated'
  | 'semi_eliminated'
  | 'runner_up'
  | 'champion';

type TournamentQuestion = {
  id: string;
  genre: string;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  correctRate: number | null;
  authorLabel: string;
};

type EquippedSet = {
  head?: Item;
  body?: Item;
  face?: Item;
  accessory?: Item;
};

type CpuPlayer = {
  id: string;
  name: string;
  accuracy: number;
  score: number;
  status: CpuStatus;
  equipped: EquippedSet;
  correctCount: number;
  answerTimesMs: number[];
  /** ユーザー回答前にCPUが答えた場合、ここに結果を一時保持して発表タイミングで加算する */
  pending?: { isCorrect: boolean; points: number; elapsedMs: number } | null;
};

type RankingEntry = {
  id: string;
  name: string;
  score: number;
  isPlayer: boolean;
  equipped?: EquippedSet;
  correctCount: number;
  avgAnswerMs: number;
  qualified: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_QUESTIONS = 10;
const PREFERRED_QUESTIONS = 5;
const TIME_LIMIT_MS = 10_000;
const BASE_SCORE = 10;
const CPU_NAME_CANDIDATES = ['コトノ', 'リブラ', 'ユラ', 'ノート', 'シグ', 'ミモ', 'レフ', 'トワ', 'セナ', 'アルク'];
const MAGIC_CIRCLE_DURATION_MS = 450;
const FEEDBACK_ADVANCE_MS = 1000;

// 1問あたり最大100点（残り10秒でも 10 + 90 = 100）
function calcPoints(isCorrect: boolean, remainingSec: number): RoundPoints {
  if (!isCorrect) return { total: 0, base: 0, bonus: 0 };
  const base = BASE_SCORE;
  const bonus = Math.max(0, remainingSec - 1) * 10; // max 90
  const total = Math.min(100, base + bonus);
  return { total, base, bonus: Math.min(90, bonus) };
}

// ─── Background (same vibe as MinnanoMondai play) ────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomIntBelow(max: number): number {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = 0x100000000 - (0x100000000 % max);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickOne<T>(items: T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}
function extractGenre(q: AcademyUserQuestion): string {
  return q.bigCategory || q.subCategory || q.subjectText || q.detailText || q.keywords[0] || 'その他';
}
function toTournamentQuestion(q: AcademyUserQuestion): TournamentQuestion | null {
  if (!Array.isArray(q.choices) || q.choices.length < 4) return null;
  if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) return null;
  const base = q.choices.slice(0, 4);
  const ansIdx = base.indexOf(q.choices[q.answerIndex]);
  if (ansIdx < 0) return null;
  const perm = shuffle([0, 1, 2, 3]);
  const shuffled: [string, string, string, string] = [base[perm[0]!], base[perm[1]!], base[perm[2]!], base[perm[3]!]];
  const displayAnswerIndex = perm.indexOf(ansIdx);
  const play = Math.max(0, Number(q.playCount ?? 0));
  const cor  = Math.max(0, Number(q.correctCount ?? 0));
  const correctRate = play > 0 ? Math.max(0, Math.min(100, Math.floor((cor / play) * 100))) : null;
  const rawAuthor = String(q.authorName ?? '').trim();
  return {
    id: q.id, genre: extractGenre(q), question: q.question,
    choices: displayAnswerIndex >= 0 ? shuffled : [base[0], base[1], base[2], base[3]],
    answerIndex: displayAnswerIndex >= 0 ? displayAnswerIndex : ansIdx,
    correctRate, authorLabel: !rawAuthor || rawAuthor === '匿名ユーザー' ? '匿名' : rawAuthor,
  };
}
function getPreferredGenres(questions: AcademyUserQuestion[]): string[] {
  const map = new Map<string, number>();
  for (const q of questions) {
    const play = Math.max(0, Number(q.playCount ?? 0));
    if (play <= 0) continue;
    const g = extractGenre(q);
    map.set(g, (map.get(g) ?? 0) + play);
  }
  if (map.size === 0) {
    const cnt = new Map<string, number>();
    for (const q of questions) { const g = extractGenre(q); cnt.set(g, (cnt.get(g) ?? 0) + 1); }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
}
function buildQuestions(src: AcademyUserQuestion[], preferred: string[]): TournamentQuestion[] {
  const all = Array.from(new Map(src.map(toTournamentQuestion).filter((q): q is TournamentQuestion => !!q).map(q => [q.id, q])).values());
  const pref = shuffle(all.filter(q => preferred.includes(q.genre))).slice(0, PREFERRED_QUESTIONS);
  const prefIds = new Set(pref.map(q => q.id));
  const rand = shuffle(all.filter(q => !prefIds.has(q.id))).slice(0, TOTAL_QUESTIONS - pref.length);
  const sel = [...pref, ...rand];
  if (sel.length < TOTAL_QUESTIONS) {
    const selIds = new Set(sel.map(q => q.id));
    sel.push(...shuffle(all.filter(q => !selIds.has(q.id))).slice(0, TOTAL_QUESTIONS - sel.length));
  }
  return shuffle(sel).slice(0, TOTAL_QUESTIONS);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function pickRandomDistinct<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
}

function buildQuestionsForGenre(
  src: AcademyUserQuestion[],
  genre: string,
  genreCount: number,
  randomCount: number
): TournamentQuestion[] {
  const all = Array.from(
    new Map(
      src
        .map(toTournamentQuestion)
        .filter((q): q is TournamentQuestion => !!q)
        .map((q) => [q.id, q])
    ).values()
  );
  const genrePool = all.filter((q) => q.genre === genre);
  const pickedGenre = shuffle(genrePool).slice(0, genreCount);
  const pickedIds = new Set(pickedGenre.map((q) => q.id));
  const randomPool = all.filter((q) => !pickedIds.has(q.id));
  const pickedRandom = shuffle(randomPool).slice(0, randomCount);
  return shuffle([...pickedGenre, ...pickedRandom]).slice(0, genreCount + randomCount);
}
function randomCpuEquipment(): EquippedSet {
  const items = ALL_ITEMS.filter(i => i.type === 'equipment' && !!i.category && !i.gachaExcluded);
  return {
    head:      pickOne(items.filter(i => i.category === 'head')),
    body:      pickOne(items.filter(i => i.category === 'body')),
    face:      pickOne(items.filter(i => i.category === 'face')),
    accessory: pickOne(items.filter(i => i.category === 'accessory')),
  };
}
function createCpuPlayers(): CpuPlayer[] {
  return shuffle(CPU_NAME_CANDIDATES).slice(0, 4).map((name, i) => ({
    id: `cpu-${i + 1}`, name,
    // 強すぎ対策：正答率を控えめに（将来は難易度で調整）
    accuracy: Number((0.5 + Math.random() * 0.25).toFixed(2)), // 0.50〜0.75
    score: 0, status: 'thinking' as CpuStatus,
    equipped: randomCpuEquipment(),
    correctCount: 0,
    answerTimesMs: [],
    pending: null,
  }));
}

// ─── 順位テキスト（進出/敗退の進行表示）────────────────────────────────────
function getRankText(
  rank: number,
  round: Round,
  qualificationSlots: number
): {
  headline: string;
  sub: string;
  color: string;
  advance: boolean;
} {
  const advance = rank >= 0 && rank < qualificationSlots;

  if (round === 'round1') {
    if (rank === 0) return { headline: '1位通過！', sub: '準決勝進出おめでとう！', color: '#fde68a', advance: true };
    if (rank === 1) return { headline: '2位通過！', sub: '準決勝進出！', color: '#e2e8f0', advance: true };
    if (rank === 2) return { headline: '3位通過！', sub: '準決勝進出！', color: '#fb923c', advance: true };
    if (rank === 3) return { headline: '4位 敗退…', sub: '惜しくも一回戦敗退', color: '#94a3b8', advance: false };
    return { headline: '5位 敗退…', sub: 'また挑戦してみよう！', color: '#94a3b8', advance: false };
  }

  // 準決勝（上位2通過→決勝）
  if (round === 'semi') {
    if (rank === 0) return { headline: '1位通過！', sub: '決勝進出おめでとう！', color: '#fde68a', advance: true };
    if (rank === 1) return { headline: '2位通過！', sub: '決勝進出！', color: '#e2e8f0', advance: true };
    return { headline: '敗退…', sub: '惜しくも準決勝敗退', color: '#94a3b8', advance: false };
  }

  // 決勝は tournament_final_result に行くので、ここは保険
  return {
    headline: advance ? '通過！' : '敗退…',
    sub: '',
    color: advance ? '#fde68a' : '#94a3b8',
    advance,
  };
}

// ② RANK_EMOJI（数字バッジ）
const RANK_EMOJI = ['🥇', '🥈', '🥉', '4', '5'];

// ─── Status ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<CpuStatus, string> = { thinking: '考え中…', answered: '回答済み', correct: '正解！', wrong: '不正解' };
const STATUS_COLOR: Record<CpuStatus, string> = { thinking: '#94a3b8', answered: 'rgba(250,204,21,0.85)', correct: '#34d399', wrong: '#f87171' };

// ─── Magic Circle ────────────────────────────────────────────────────────────
type MagicCircleState = { id: number; x: number; y: number; isCorrect: boolean };
type RoundPoints = { total: number; base: number; bonus: number };

const MagicCircleBurst = ({ id, x, y, isCorrect, onComplete }: { id: number; x: number; y: number; isCorrect: boolean; onComplete: (id: number) => void }) => {
  const color = isCorrect ? '#22c55e' : '#ef4444';
  const size = 320;
  const rings = [32, 58, 82, 106, 124];
  const hexPoints = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return `${Math.cos(a) * 72},${Math.sin(a) * 72}`; }).join(' ');
  const tri1 = Array.from({ length: 3 }, (_, i) => { const a = (i / 3) * Math.PI * 2; return `${Math.cos(a) * 92},${Math.sin(a) * 92}`; }).join(' ');
  const tri2 = Array.from({ length: 3 }, (_, i) => { const a = (i / 3) * Math.PI * 2 + Math.PI; return `${Math.cos(a) * 92},${Math.sin(a) * 92}`; }).join(' ');
  const spokeAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  const dots = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; const r = 56 + (i % 3) * 22; return { cx: Math.cos(a) * r, cy: Math.sin(a) * r }; });
  return (
    <motion.div className="absolute" style={{ left: x, top: y, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ scale: 0.05, opacity: 0, rotate: -30 }}
      animate={{ scale: 1, opacity: [0, 1, 1, 0.55], rotate: isCorrect ? 90 : -90 }}
      transition={{ duration: MAGIC_CIRCLE_DURATION_MS / 1000, ease: 'easeOut' }}
      onAnimationComplete={() => onComplete(id)}
    >
      <svg width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
        <radialGradient id={`mg-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.70" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <circle r={38} fill={`url(#mg-${id})`} />
        {rings.map((r, i) => <circle key={r} r={r} fill="none" stroke={color} strokeWidth={i === rings.length-1 ? 2.5 : 1.2} strokeOpacity={i === rings.length-1 ? 1.0 : 0.65} strokeDasharray={i%2===0?'5 4':'2 6'} />)}
        {spokeAngles.map((a, i) => <line key={i} x1={Math.cos(a)*32} y1={Math.sin(a)*32} x2={Math.cos(a)*116} y2={Math.sin(a)*116} stroke={color} strokeOpacity="0.45" strokeWidth="1.2" />)}
        <polygon points={hexPoints} fill="none" stroke={color} strokeOpacity="0.85" strokeWidth="2" />
        <polygon points={tri1} fill="none" stroke={color} strokeOpacity="0.65" strokeWidth="1.5" />
        <polygon points={tri2} fill="none" stroke={color} strokeOpacity="0.65" strokeWidth="1.5" />
        {dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r="4" fill={color} opacity="1.0" />)}
      </svg>
    </motion.div>
  );
};

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#fbbf24','#34d399','#60a5fa','#f472b6','#a78bfa','#fb923c'];
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 1.0,
    dur: 1.8 + Math.random() * 1.4,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(p => (
        <motion.div key={p.id} style={{ position:'absolute', top:-20, left:`${p.x}%`, width:p.size, height:p.size, background:p.color, borderRadius:2 }}
          animate={{ y:['0vh','110vh'], rotate:[0, 360*3], opacity:[1,1,0] }}
          transition={{ duration:p.dur, delay:p.delay, ease:'easeIn' }}
        />
      ))}
    </div>
  );
}

// ─── RpgButton ────────────────────────────────────────────────────────────────
const RpgButton = ({ onClick, label, fromColor, toColor, shadowColor, glowColor, icon }: {
  onClick: () => void; label: string;
  fromColor: string; toColor: string; shadowColor: string; glowColor: string;
  icon?: string;
}) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        width:'100%', padding:'16px', borderRadius:14,
        background:`linear-gradient(180deg,${toColor} 0%,${fromColor} 100%)`,
        borderTop:'2px solid rgba(255,255,255,0.28)', borderLeft:'1px solid rgba(255,255,255,0.10)',
        borderRight:'1px solid rgba(0,0,0,0.20)',
        borderBottom: pressed ? `3px solid ${shadowColor}` : `6px solid ${shadowColor}`,
        transform: pressed ? 'translateY(3px)' : 'translateY(0)',
        boxShadow: pressed ? `0 2px 10px ${glowColor}` : `0 8px 24px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.22)`,
        color:'#fff', fontSize:17, fontWeight:900, letterSpacing:'0.03em',
        textShadow:'0 1px 4px rgba(0,0,0,0.5)',
        cursor:'pointer', WebkitTapHighlightColor:'transparent',
        transition:'border-bottom .07s,transform .07s,box-shadow .07s',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      }}
    >
      {icon && <span style={{fontSize:18}}>{icon}</span>}
      {label}
    </button>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TournamentPage() {
  const academyUserQuestions = useGameStore(s => s.academyUserQuestions);
  const refreshAcademyQuestions = useGameStore(s => s.refreshAcademyQuestions);
  const equipment = useGameStore(s => s.equipment);

  const equippedDetails: EquippedSet = useMemo(() => ({
    head:      equipment.head      ? getItemById(equipment.head)      : undefined,
    body:      equipment.body      ? getItemById(equipment.body)      : undefined,
    face:      equipment.face      ? getItemById(equipment.face)      : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [round, setRound] = useState<Round>('round1');
  const [questions, setQuestions]     = useState<TournamentQuestion[]>([]);
  const [qIndex, setQIndex]           = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [playerAnswered, setPlayerAnswered] = useState(false);
  const [playerResult, setPlayerResult]     = useState<'correct'|'wrong'|'thinking'>('thinking');
  const [playerCorrectCount, setPlayerCorrectCount] = useState(0);
  const [playerAnswerTimesMs, setPlayerAnswerTimesMs] = useState<number[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs]   = useState(TIME_LIMIT_MS);
  const [cpus, setCpus]               = useState<CpuPlayer[]>([]);
  const [lobbyInitCpus]               = useState<CpuPlayer[]>(() => createCpuPlayers());
  const [ranking, setRanking]         = useState<RankingEntry[]>([]);
  const [_qualified, setQualified]     = useState<RankingEntry[]>([]);
  const [_eliminated, setEliminated]   = useState<RankingEntry[]>([]);
  const [_playerQualified, setPlayerQualified] = useState<boolean | null>(null);
  const [_proceedNextRound, setProceedNextRound] = useState(false);
  const [semiCategoryCandidates, setSemiCategoryCandidates] = useState<string[]>([]);
  const [_semiSelectedCategory, setSemiSelectedCategory] = useState<string | null>(null);
  const [finalGenreCandidates, setFinalGenreCandidates] = useState<string[]>([]);
  const [_finalSelectedGenre, setFinalSelectedGenre] = useState<string | null>(null);
  const [tournamentReach, setTournamentReach] = useState<TournamentReach>('none');
  const [finalWinnerName, setFinalWinnerName] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showRuleInfo, setShowRuleInfo] = useState(false);
  const [magicCircles, setMagicCircles] = useState<MagicCircleState[]>([]);
  const [isResolvingAnswer, setIsResolvingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback]       = useState<'correct'|'wrong'|null>(null);
  const [roundPoints, setRoundPoints]             = useState<RoundPoints | null>(null);
  const magicIdRef   = useRef(0);
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const cpuRefs      = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextQRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerAnsweredRef = useRef(playerAnswered);
  const timeLeftMsRef     = useRef(timeLeftMs);
  const questionStartedAtRef = useRef<number>(0);

  const preferredGenres  = useMemo(() => getPreferredGenres(academyUserQuestions), [academyUserQuestions]);
  const currentQuestion  = useMemo(() => questions[qIndex] ?? null, [questions, qIndex]);
  const qualificationSlots = round === 'round1' ? 3 : round === 'semi' ? 2 : 1;

  const preferredGenreCandidates = useMemo(() => {
    // 得意ジャンル候補（現状は履歴ベースの推定、将来ここをユーザー設定に置き換え可能）
    return preferredGenres.length > 0 ? preferredGenres.slice(0, 3) : [];
  }, [preferredGenres]);

  useEffect(() => { void refreshAcademyQuestions(); }, [refreshAcademyQuestions]);
  useEffect(() => { playerAnsweredRef.current = playerAnswered; }, [playerAnswered]);
  useEffect(() => { timeLeftMsRef.current = timeLeftMs; }, [timeLeftMs]);

  const clearTimers = () => {
    if (timerRef.current)  { clearInterval(timerRef.current); timerRef.current = null; }
    cpuRefs.current.forEach(clearTimeout); cpuRefs.current = [];
    if (nextQRef.current)  { clearTimeout(nextQRef.current);  nextQRef.current = null; }
    if (resolveTimer.current) { clearTimeout(resolveTimer.current); resolveTimer.current = null; }
  };

  const settleCpu = (cpuId: string) => {
    setCpus(prev => prev.map(cpu => {
      if (cpu.id !== cpuId || cpu.status !== 'thinking') return cpu;
      const isCorrect = Math.random() < cpu.accuracy;
      const elapsed = Math.min(TIME_LIMIT_MS, Math.max(0, Date.now() - questionStartedAtRef.current));
      const remSec = Math.max(0, Math.ceil((TIME_LIMIT_MS - elapsed) / 1000));
      const pts = calcPoints(isCorrect, remSec);
      // ユーザー回答前：正誤・得点は保持のみ（表示は「回答済み」）
      if (!playerAnsweredRef.current) {
        return {
          ...cpu,
          status: 'answered',
          pending: { isCorrect, points: pts.total, elapsedMs: elapsed },
        };
      }
      // ユーザー回答後：即換算して発表してOK
      return {
        ...cpu,
        status: isCorrect ? 'correct' : 'wrong',
        score: cpu.score + pts.total,
        correctCount: cpu.correctCount + (isCorrect ? 1 : 0),
        answerTimesMs: [...cpu.answerTimesMs, elapsed],
        pending: null,
      };
    }));
  };

  // ユーザーが答えたタイミングで、CPUの保留ポイントを一斉換算して正誤発表へ
  useEffect(() => {
    if (phase !== 'quiz' || !playerAnswered) return;
    setCpus((prev) =>
      prev.map((cpu) => {
        if (cpu.status !== 'answered' || !cpu.pending) return cpu;
        const elapsedMs = Math.min(TIME_LIMIT_MS, Math.max(0, cpu.pending.elapsedMs));
        return {
          ...cpu,
          status: cpu.pending.isCorrect ? 'correct' : 'wrong',
          score: cpu.score + (cpu.pending.isCorrect ? cpu.pending.points : 0),
          correctCount: cpu.correctCount + (cpu.pending.isCorrect ? 1 : 0),
          answerTimesMs: [...cpu.answerTimesMs, elapsedMs],
          pending: null,
        };
      })
    );
  }, [phase, playerAnswered]);

  useEffect(() => () => clearTimers(), []);

  // ── Quiz round setup
  useEffect(() => {
    if (phase !== 'quiz' || !currentQuestion) return;
    clearTimers();
    setTimeLeftMs(TIME_LIMIT_MS);
    setPlayerAnswered(false);
    setPlayerResult('thinking');
    setSelectedChoice(null);
    setMagicCircles([]);
    setIsResolvingAnswer(false);
    setAnswerFeedback(null);
    setRoundPoints(null);
    setCpus(prev => prev.map(c => ({ ...c, status: 'thinking', pending: null })));

    const startAt = Date.now();
    questionStartedAtRef.current = startAt;
    timerRef.current = setInterval(() => {
      const rem = Math.max(0, TIME_LIMIT_MS - (Date.now() - startAt));
      setTimeLeftMs(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current!); timerRef.current = null;
        if (!playerAnsweredRef.current) {
          setPlayerAnswered(true); setPlayerResult('wrong'); setAnswerFeedback('wrong'); setRoundPoints(null);
          setPlayerAnswerTimesMs((prev) => [...prev, TIME_LIMIT_MS]);
        }
      }
    }, 80);

    // CPUは数秒待ってから回答（強すぎ＆早すぎ対策）
    cpuRefs.current = cpus.map(cpu => {
      const delay = Math.floor(2500 + Math.random() * 6500); // 2.5s〜9.0s
      return setTimeout(() => settleCpu(cpu.id), delay);
    });
    return () => clearTimers();
  }, [phase, currentQuestion, qIndex]);

  // ── Force CPUs after player answers
  useEffect(() => {
    if (phase !== 'quiz' || !playerAnswered) return;
    cpuRefs.current.forEach(clearTimeout); cpuRefs.current = [];
    const thinking = cpus.filter(c => c.status === 'thinking');
    cpuRefs.current = thinking.map(cpu => {
      // ユーザー回答後は1.5秒以内に回答させる（ただし得点計算は実経過時間で行う）
      const delay = Math.floor(400 + Math.random() * 1100); // 0.4s〜1.5s
      return setTimeout(() => settleCpu(cpu.id), delay);
    });
  }, [playerAnswered]);

  // ── Advance question / go to result
  useEffect(() => {
    if (phase !== 'quiz' || !playerAnswered || cpus.some(c => c.status === 'thinking')) return;
    nextQRef.current = setTimeout(() => {
      setAnswerFeedback(null); setRoundPoints(null);
      const next = qIndex + 1;
      if (next < questions.length) {
        setQIndex(next);
      } else {
        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : TIME_LIMIT_MS;

        const base: Omit<RankingEntry, 'qualified'>[] = [
          {
            id: 'player',
            name: 'あなた',
            score: playerScore,
            isPlayer: true,
            equipped: equippedDetails,
            correctCount: playerCorrectCount,
            avgAnswerMs: avg(playerAnswerTimesMs),
          },
          ...cpus.map((c) => ({
            id: c.id,
            name: c.name,
            score: c.score,
            isPlayer: false,
            equipped: c.equipped,
            correctCount: c.correctCount,
            avgAnswerMs: avg(c.answerTimesMs),
          })),
        ];

        // tie-break: score desc -> correct desc -> avgMs asc -> random
        const sorted = base
          .map((e) => ({ e, tie: randomIntBelow(1_000_000) }))
          .sort((a, b) => {
            if (b.e.score !== a.e.score) return b.e.score - a.e.score;
            if (b.e.correctCount !== a.e.correctCount) return b.e.correctCount - a.e.correctCount;
            if (a.e.avgAnswerMs !== b.e.avgAnswerMs) return a.e.avgAnswerMs - b.e.avgAnswerMs;
            return a.tie - b.tie;
          })
          .map((x) => x.e)
          .map((e, idx) => ({ ...e, qualified: idx < qualificationSlots }));

        setRanking(sorted);
        setQualified(sorted.filter((e) => e.qualified));
        setEliminated(sorted.filter((e) => !e.qualified));
        const pq = sorted.find((e) => e.isPlayer)?.qualified ?? false;
        setPlayerQualified(pq);
        setPhase('result');

        // 到達結果（final result 画面用）
        if (round === 'round1' && !pq) setTournamentReach('round1_eliminated');
        if (round === 'semi' && !pq) setTournamentReach('semi_eliminated');

        if (round === 'final') {
          const winner = sorted[0];
          setFinalWinnerName(winner?.name ?? null);
          const playerRankIdx = sorted.findIndex((e) => e.isPlayer);
          if (playerRankIdx === 0) setTournamentReach('champion');
          else setTournamentReach('runner_up');
          setPhase('tournament_final_result');
          setShowConfetti(true);
          return;
        }

        if (pq) setShowConfetti(true);
      }
    }, FEEDBACK_ADVANCE_MS);
    return () => { if (nextQRef.current) { clearTimeout(nextQRef.current); nextQRef.current = null; } };
  }, [phase, playerAnswered, cpus, qIndex, questions.length, playerScore, playerCorrectCount, playerAnswerTimesMs, equippedDetails, qualificationSlots, round]);

  // ── Go to lobby (new CPUs)
  const goToLobby = () => {
    clearTimers();
    setPhase('lobby');
    setShowConfetti(false);
    setQuestions([]);
    setQIndex(0);
    setPlayerScore(0);
    setPlayerCorrectCount(0);
    setPlayerAnswerTimesMs([]);
    setRanking([]);
    setQualified([]);
    setEliminated([]);
    setPlayerQualified(null);
    setProceedNextRound(false);
    setRound('round1');
    setSemiCategoryCandidates([]);
    setSemiSelectedCategory(null);
    setFinalGenreCandidates([]);
    setFinalSelectedGenre(null);
    setTournamentReach('none');
    setFinalWinnerName(null);
    setCpus([]);
  };

  const goToSemifinalCategory = () => {
    // 1回戦上位3人のみ（プレイヤー通過時のみ呼ばれる想定）
    const qualifiers = ranking.filter((e) => e.qualified);
    const cpuQualifiers = qualifiers.filter((e) => !e.isPlayer).slice(0, 2);
    const nextCpus = cpuQualifiers
      .map((e) => cpus.find((c) => c.id === e.id))
      .filter((c): c is CpuPlayer => !!c)
      .map((c) => ({ ...c, status: 'thinking' as CpuStatus, pending: null }));

    const allGenres = unique(academyUserQuestions.map(extractGenre).filter((g) => !!g));
    const picked = pickRandomDistinct(allGenres, 3);

    setCpus(nextCpus);
    setRound('semi');
    setSemiCategoryCandidates(picked);
    setSemiSelectedCategory(null);
    setProceedNextRound(true);
    setPhase('semifinal_category');
  };

  const startSemifinal = (genre: string) => {
    const picked = buildQuestionsForGenre(academyUserQuestions, genre, 5, 5);
    if (picked.length < 10) {
      window.alert('準決勝の問題が不足しています（選択カテゴリの問題数が足りない可能性があります）。');
      return;
    }
    setSemiSelectedCategory(genre);
    setQuestions(picked);
    setQIndex(0);
    setPhase('quiz');
  };

  const goToFinalCategory = () => {
    // 準決勝の上位2人のみ（プレイヤー通過済みの時のみ呼ばれる想定）
    const qualifiers = ranking.filter((e) => e.qualified);
    const cpuQualifier = qualifiers.find((e) => !e.isPlayer);
    const finalistCpu = cpuQualifier ? cpus.find((c) => c.id === cpuQualifier.id) : undefined;
    if (!finalistCpu) {
      window.alert('決勝のCPU参加者が見つかりませんでした。');
      return;
    }

    setCpus([{ ...finalistCpu, status: 'thinking' as CpuStatus, pending: null }]);
    setRound('final');

    // 決勝の得意ジャンル候補（現状は推定データ）
    const candidates = preferredGenreCandidates.length > 0
      ? preferredGenreCandidates
      : pickRandomDistinct(unique(academyUserQuestions.map(extractGenre).filter((g) => !!g)), 3);
    setFinalGenreCandidates(candidates.slice(0, 3));
    setFinalSelectedGenre(null);
    setPhase('final_category');
  };

  const startFinal = (genre: string) => {
    const picked = buildQuestionsForGenre(academyUserQuestions, genre, 5, 5);
    if (picked.length < 10) {
      window.alert('決勝の問題が不足しています（選択ジャンルの問題数が足りない可能性があります）。');
      return;
    }
    setFinalSelectedGenre(genre);
    setQuestions(picked);
    setQIndex(0);
    setPhase('quiz');
  };

  const startTournament = () => {
    const selected = buildQuestions(academyUserQuestions, preferredGenres);
    if (selected.length < TOTAL_QUESTIONS) {
      window.alert('みんなの問題が不足しています。4択の問題を10問以上用意してください。');
      return;
    }
    setQuestions(selected);
    setQIndex(0);
    setPlayerScore(0);
    setPlayerCorrectCount(0);
    setPlayerAnswerTimesMs([]);
    setRanking([]);
    setQualified([]);
    setEliminated([]);
    setPlayerQualified(null);
    setProceedNextRound(false);
    setShowConfetti(false);
    setCpus(createCpuPlayers());
    setRound('round1');
    setSemiCategoryCandidates([]);
    setSemiSelectedCategory(null);
    setPhase('quiz');
  };

  const onChoiceClick = (choiceIdx: number, e: MouseEvent<HTMLButtonElement>) => {
    if (!currentQuestion || playerAnswered || isResolvingAnswer) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSelectedChoice(choiceIdx);
    const isCorrect = choiceIdx === currentQuestion.answerIndex;
    const id = ++magicIdRef.current;
    setMagicCircles(prev => [...prev, { id, x: e.clientX, y: e.clientY, isCorrect }]);
    setIsResolvingAnswer(true);
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    const elapsedMsAtClick = Math.min(TIME_LIMIT_MS, Math.max(0, TIME_LIMIT_MS - timeLeftMsRef.current));
    resolveTimer.current = setTimeout(() => {
      resolveTimer.current = null;
      const remSec = Math.max(0, Math.ceil(timeLeftMsRef.current / 1000));
      const pts = calcPoints(isCorrect, remSec);
      setPlayerScore(prev => prev + pts.total);
      setPlayerAnswered(true);
      setPlayerResult(isCorrect ? 'correct' : 'wrong');
      setAnswerFeedback(isCorrect ? 'correct' : 'wrong');
      setRoundPoints(isCorrect ? pts : null);
      setPlayerCorrectCount((prev) => prev + (isCorrect ? 1 : 0));
      setPlayerAnswerTimesMs((prev) => [...prev, elapsedMsAtClick]);
      setIsResolvingAnswer(false);
    }, MAGIC_CIRCLE_DURATION_MS);
  };

  const timerSec  = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const timerPct  = Math.max(0, Math.min(100, (timeLeftMs / TIME_LIMIT_MS) * 100));
  const isUrgent  = timerSec <= 3 && !playerAnswered && !isResolvingAnswer && !answerFeedback && phase === 'quiz';
  const playerEmotion: PotatoEmotion = playerResult === 'correct' ? 'happy' : playerResult === 'wrong' ? 'confused' : 'smart';
  const playerRank = ranking.findIndex(e => e.isPlayer);
  const rankInfo   = playerRank >= 0 ? getRankText(playerRank, round, qualificationSlots) : null;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden pb-24 text-slate-100">
      <LightAcademyBackground />
      {showConfetti && <Confetti />}

      {/* Magic circles */}
      {phase === 'quiz' && (
        <div className="pointer-events-none fixed inset-0 z-[50]">
          {magicCircles.map(c => (
            <MagicCircleBurst key={c.id} {...c} onComplete={id => setMagicCircles(p => p.filter(x => x.id !== id))} />
          ))}
        </div>
      )}

      {/* ○× フィードバック */}
      <AnimatePresence>
        {phase === 'quiz' && answerFeedback && (
          <motion.div className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          >
            <motion.div style={{ fontSize: 120, lineHeight: 1 }}
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >{answerFeedback === 'correct' ? '⭕️' : '❌'}</motion.div>
            {answerFeedback === 'correct' && roundPoints && (
              <motion.div className="mt-4 flex flex-col items-center gap-2"
                initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.05 }}
              >
                <div style={{ fontSize: 40, fontWeight: 900, color: '#fef08a', textShadow: '0 0 24px rgba(250,204,21,0.7)' }}>
                  +{roundPoints.total} pt
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 20,
                  background: 'linear-gradient(135deg,rgba(255,251,235,0.96),rgba(254,240,200,0.93))',
                  border: '1px solid rgba(202,138,4,0.5)', color: '#4c1d95',
                }}>
                  正解 {roundPoints.base} ＋ 秒数ボーナス {roundPoints.bonus}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 緊急ビネット */}
      <AnimatePresence>
        {isUrgent && (
          <motion.div className="pointer-events-none fixed inset-0 z-40"
            animate={{ boxShadow: ['inset 0 0 0px rgba(239,68,68,0)', 'inset 0 0 90px rgba(239,68,68,0.5)', 'inset 0 0 0px rgba(239,68,68,0)'] }}
            transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-5">

        {/* ヘッダー */}
        <div className="mb-4 flex items-center gap-2">
          <span style={{ fontSize: 22 }}>⚔️</span>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#e0d7ff', letterSpacing: '0.02em' }}>ことば図書館 トーナメント</h1>
            <p style={{ fontSize: 11, color: 'rgba(180,170,240,0.55)', marginTop: 1 }}>みんなの問題から出題 / 1回戦のみ / 10問勝負</p>
          </div>
        </div>

        {/* ══ LOBBY ══════════════════════════════════════════════════════════════ */}
        {phase === 'lobby' && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

            {/* 対戦カード */}
            <div style={{
              borderRadius: 20, padding: '18px 16px',
              background: 'linear-gradient(135deg,rgba(28,18,65,0.97),rgba(18,12,48,0.97))',
              border: '1.5px solid rgba(160,130,255,0.28)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)', marginBottom: 12,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 12, fontWeight: 800, letterSpacing: '0.22em', color: 'rgba(160,130,255,0.6)' }}>
                ─ 対戦相手 ─
              </div>

              {/* CPU 4体 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {lobbyInitCpus.map((cpu, i) => (
                  <motion.div key={cpu.id}
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 220 }}
                    style={{
                      borderRadius: 14, padding: '10px 10px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(160,130,255,0.18)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <PotatoAvatar equipped={cpu.equipped} emotion="smart" size={60} ssrEffect={false} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#e0d7ff' }}>{cpu.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(160,130,255,0.6)', marginTop: 1 }}>正答率 {Math.round(cpu.accuracy * 100)}%</div>
                      <div style={{ marginTop: 4, display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: 'rgba(99,102,241,0.18)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.28)' }}>CPU</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 区切り線 VS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.25)' }} />
                <div style={{ fontSize: 18, fontWeight: 900, color: '#818cf8', letterSpacing: '0.1em' }}>VS</div>
                <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.25)' }} />
              </div>

              {/* あなた */}
              <div style={{
                borderRadius: 12, padding: '10px 12px',
                background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.14))',
                border: '1px solid rgba(99,102,241,0.38)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <PotatoAvatar equipped={equippedDetails} emotion="happy" size={56} ssrEffect={false} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#c4b5fd' }}>あなた</div>
                  <div style={{ fontSize: 10, color: 'rgba(196,181,253,0.55)', marginTop: 1 }}>プレイヤー</div>
                </div>
              </div>
            </div>

            {/* ルール（折りたたみ） */}
            <div style={{ borderRadius: 12, marginBottom: 12, overflow: 'hidden', border: '1px solid rgba(160,130,255,0.16)', background: 'rgba(18,12,45,0.85)' }}>
              <button onClick={() => setShowRuleInfo(v => !v)}
                style={{ width: '100%', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: 'rgba(180,170,240,0.65)', fontSize: 12, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                <span>📋 ルール・問題情報</span>
                <span>{showRuleInfo ? '▲' : '▼'}</span>
              </button>
              <AnimatePresence>
                {showRuleInfo && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '0 14px 12px', fontSize: 12, color: 'rgba(180,170,240,0.6)', lineHeight: 2.0 }}>
                      <div>📚 利用可能な問題数: <span style={{ color: '#a78bfa', fontWeight: 700 }}>{academyUserQuestions.length}問</span></div>
                      <div>🎯 よく解くジャンル: <span style={{ color: '#a78bfa', fontWeight: 700 }}>{preferredGenres.length ? preferredGenres.join(' / ') : '未判定'}</span></div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8, paddingTop: 8 }}>
                        <div>⏱ 制限時間 10秒 / 4択</div>
                        <div>✅ 正解: 10点 + 残り秒数×10点</div>
                        <div>❌ 不正解 / 時間切れ: 0点</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <RpgButton onClick={startTournament} label="トーナメント開始" icon="⚔️"
              fromColor="#4338ca" toColor="#7c3aed" shadowColor="rgba(30,15,80,0.95)" glowColor="rgba(99,102,241,0.45)"
            />
          </motion.section>
        )}

        {/* ══ QUIZ ═══════════════════════════════════════════════════════════════ */}
        {phase === 'quiz' && currentQuestion && (
          <motion.section key={`q-${qIndex}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28 }}>

            {/* タイマー行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
                  <div key={i} style={{ width: i === qIndex ? 14 : 5, height: 5, borderRadius: 3, transition: 'width 0.3s', background: i < qIndex ? '#6366f1' : i === qIndex ? '#a78bfa' : 'rgba(255,255,255,0.2)' }} />
                ))}
              </div>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <motion.div style={{ height: '100%', borderRadius: 99, background: isUrgent ? 'linear-gradient(90deg,#ef4444,#fbbf24)' : 'linear-gradient(90deg,#8b5cf6,#6366f1)', boxShadow: isUrgent ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 5px rgba(139,92,246,0.4)' }}
                  animate={{ width: `${timerPct}%` }} transition={{ duration: 0.08 }}
                />
              </div>
              <motion.span style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: isUrgent ? '#ef4444' : '#a78bfa', minWidth: 40, textAlign: 'right', flexShrink: 0, letterSpacing: '-0.03em', textShadow: isUrgent ? '0 0 16px rgba(239,68,68,0.7)' : 'none' }}
                animate={isUrgent ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={isUrgent ? { duration: 0.5, repeat: Infinity } : {}}
              >{timerSec}<span style={{ fontSize: 12 }}>s</span></motion.span>
            </div>

            {/* 問題カード */}
            <div style={{ borderRadius: 14, padding: '12px 14px 10px', marginBottom: 8, background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(140,120,220,0.18)', boxShadow: '0 4px 16px rgba(80,60,160,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6d28d9' }}>ジャンル: {currentQuestion.genre}</span>
                {currentQuestion.correctRate !== null && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 7, background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid rgba(180,130,20,0.4)', color: '#4c1d95' }}>
                    正答率 {currentQuestion.correctRate}%
                  </span>
                )}
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.6, color: '#1e1040', margin: 0 }}>{currentQuestion.question}</p>
              <p style={{ fontSize: 9, color: '#7c3aed99', marginTop: 4, textAlign: 'right' }}>出題者: {currentQuestion.authorLabel}</p>
            </div>

            {/* 選択肢 2×2 グリッド（QMA風） */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {currentQuestion.choices.map((choice, idx) => {
                const isSelected      = selectedChoice === idx;
                const isCorrectChoice = playerAnswered && idx === currentQuestion.answerIndex;
                const isWrongSel      = isSelected && playerAnswered && playerResult === 'wrong';

                let bg     = 'rgba(255,255,255,0.95)';
                let border = '1.5px solid rgba(140,120,220,0.22)';
                let color  = '#1e1040';
                let bBot   = '3px solid rgba(100,80,200,0.22)';

                if (isCorrectChoice) { bg = 'linear-gradient(135deg,#d1fae5,#a7f3d0)'; border = '1.5px solid rgba(34,197,94,0.5)'; bBot = '3px solid rgba(21,128,61,0.5)'; color = '#14532d'; }
                else if (isWrongSel) { bg = 'linear-gradient(135deg,#fee2e2,#fecaca)'; border = '1.5px solid rgba(239,68,68,0.5)'; bBot = '3px solid rgba(153,27,27,0.5)'; color = '#7f1d1d'; }

                return (
                  <motion.button key={`${currentQuestion.id}-${idx}`} type="button"
                    disabled={playerAnswered || isResolvingAnswer}
                    onClick={(e) => onChoiceClick(idx, e)}
                    whileHover={!playerAnswered && !isResolvingAnswer ? { scale: 1.02 } : {}}
                    animate={isCorrectChoice ? { scale: [1, 1.04, 1] } : isWrongSel ? { x: [0,-4,4,-3,3,0] } : {}}
                    transition={{ duration: 0.32 }}
                    style={{ padding: '10px 8px', borderRadius: 11, background: bg, border, borderBottom: bBot, color, cursor: playerAnswered || isResolvingAnswer ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, WebkitTapHighlightColor: 'transparent', minHeight: 54, textAlign: 'left' }}
                  >
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: isCorrectChoice ? '#22c55e' : isWrongSel ? '#ef4444' : 'rgba(99,102,241,0.15)', border: `1.5px solid ${isCorrectChoice ? '#16a34a' : isWrongSel ? '#dc2626' : 'rgba(99,102,241,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: isCorrectChoice || isWrongSel ? '#fff' : '#6366f1' }}>
                      {['A','B','C','D'][idx]}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{choice}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* ═══ バトルアリーナ（参加者を常に表示） ═══ */}
            <div style={{ borderRadius: 16, padding: '10px 10px 8px', background: 'rgba(6,3,22,0.92)', border: '1px solid rgba(99,102,241,0.28)', boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.22em', color: 'rgba(160,140,255,0.5)', textAlign: 'center', marginBottom: 8 }}>
                ⚔ バトルアリーナ ⚔
              </div>

              {/* グリッド：プレイヤー1 + CPU(可変) */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + cpus.length}, 1fr)`, gap: 5 }}>

                {/* プレイヤー */}
                <div style={{ textAlign: 'center', borderRadius: 10, padding: '7px 4px 5px', background: 'linear-gradient(135deg,rgba(99,102,241,0.30),rgba(139,92,246,0.18))', border: `1.5px solid ${playerResult === 'correct' ? 'rgba(52,211,153,0.7)' : playerResult === 'wrong' ? 'rgba(248,113,113,0.5)' : 'rgba(99,102,241,0.55)'}` }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <PotatoAvatar equipped={equippedDetails} emotion={playerEmotion} size={54} ssrEffect={false} />
                    {playerResult === 'correct' && (
                      <motion.span className="pointer-events-none absolute -right-1 -top-1" style={{ fontSize: 14 }}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: [0,1,0], y: [4,-10,-18] }}
                        transition={{ duration: 0.9 }}
                      >⭕️</motion.span>
                    )}
                    {playerResult === 'wrong' && (
                      <motion.span className="pointer-events-none absolute -right-1 top-0" style={{ fontSize: 12 }}
                        initial={{ opacity: 0 }} animate={{ opacity: [0,1,0], y: [0,4,10] }}
                        transition={{ duration: 1 }}
                      >❌</motion.span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#c4b5fd', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>あなた</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: playerResult === 'correct' ? '#34d399' : playerResult === 'wrong' ? '#f87171' : '#94a3b8', marginTop: 1 }}>
                    {playerResult === 'correct' ? '✓正解' : playerResult === 'wrong' ? '✗不正解' : '考え中…'}
                  </div>
                  <div style={{ fontSize: 11, color: '#fde68a', fontWeight: 900, marginTop: 2 }}>{playerScore}pt</div>
                </div>

                {/* CPU 4体 */}
                {cpus.map((cpu) => {
                  const isCpuAnswered = cpu.status !== 'thinking';
                  const revealCpu = playerAnswered; // ユーザー回答後に正誤発表
                  const emotion: PotatoEmotion =
                    revealCpu
                      ? (cpu.status === 'correct' ? 'happy' : cpu.status === 'wrong' ? 'confused' : 'smart')
                      : (isCpuAnswered ? 'smart' : 'smart');
                  const borderColor =
                    revealCpu
                      ? (cpu.status === 'correct'
                          ? 'rgba(52,211,153,0.6)'
                          : cpu.status === 'wrong'
                            ? 'rgba(248,113,113,0.5)'
                            : 'rgba(99,102,241,0.22)')
                      : (isCpuAnswered ? 'rgba(250,204,21,0.28)' : 'rgba(99,102,241,0.22)');
                  const cpuLabel = !isCpuAnswered
                    ? '考え中…'
                    : revealCpu
                      ? STATUS_LABEL[cpu.status]
                      : '回答済み';
                  const cpuLabelColor = !isCpuAnswered
                    ? '#94a3b8'
                    : revealCpu
                      ? STATUS_COLOR[cpu.status]
                      : 'rgba(250,204,21,0.85)';
                  return (
                    <motion.div key={cpu.id}
                      animate={revealCpu && cpu.status === 'correct' ? { scale: [1, 1.05, 1] } : revealCpu && cpu.status === 'wrong' ? { x: [0,-3,3,-2,2,0] } : {}}
                      transition={{ duration: 0.38 }}
                      style={{ textAlign: 'center', borderRadius: 10, padding: '7px 4px 5px', background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${borderColor}` }}
                    >
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <PotatoAvatar equipped={cpu.equipped} emotion={emotion} size={54} ssrEffect={false} />
                        {revealCpu && cpu.status === 'correct' && (
                          <motion.span className="pointer-events-none absolute -right-1 -top-1" style={{ fontSize: 14 }}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: [0,1,0], y: [4,-10,-18] }}
                            transition={{ duration: 0.9 }}
                          >⭕️</motion.span>
                        )}
                        {revealCpu && cpu.status === 'wrong' && (
                          <motion.span className="pointer-events-none absolute -right-1 top-0" style={{ fontSize: 12 }}
                            initial={{ opacity: 0 }} animate={{ opacity: [0,1,0], y: [0,4,10] }}
                            transition={{ duration: 1 }}
                          >❌</motion.span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#e0d7ff', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cpu.name}</div>
                      <div style={{ fontSize: 9, fontWeight: 900, color: cpuLabelColor, marginTop: 1 }}>{cpuLabel}</div>
                      
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}

        {/* ══ RESULT ═════════════════════════════════════════════════════════════ */}
        {phase === 'result' && rankInfo && (
          <motion.section
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
          >
            {/* ── ヒーロー カード ───────────────────────────────────────────── */}
            <div
              style={{
                borderRadius: 20,
                padding: '22px 20px',
                marginBottom: 14,
                textAlign: 'center',
                background: rankInfo.advance
                  ? playerRank === 0
                    ? 'linear-gradient(135deg,rgba(60,40,5,0.97),rgba(80,58,8,0.97))'
                    : 'linear-gradient(135deg,rgba(22,18,58,0.97),rgba(30,22,68,0.97))'
                  : 'linear-gradient(135deg,rgba(20,10,30,0.97),rgba(25,14,38,0.97))',
                border: `2px solid ${
                  rankInfo.advance
                    ? playerRank === 0
                      ? 'rgba(250,200,30,0.55)'
                      : 'rgba(99,102,241,0.42)'
                    : 'rgba(100,80,130,0.28)'
                }`,
                boxShadow: rankInfo.advance
                  ? playerRank === 0
                    ? '0 0 55px rgba(250,180,20,0.32)'
                    : '0 0 30px rgba(99,102,241,0.2)'
                  : '0 12px 40px rgba(0,0,0,0.6)',
              }}
            >
              {/* 順位バッジ（大） */}
              <motion.div
                style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
              >
                {RANK_EMOJI[Math.min(playerRank, 4)]}
              </motion.div>

              {/* 進出 / 敗退 バナー */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                style={{
                  display: 'inline-block',
                  padding: '6px 22px',
                  borderRadius: 99,
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  background: rankInfo.advance
                    ? 'linear-gradient(135deg,rgba(52,211,153,0.25),rgba(16,185,129,0.15))'
                    : 'linear-gradient(135deg,rgba(248,113,113,0.22),rgba(239,68,68,0.12))',
                  border: `1.5px solid ${rankInfo.advance ? 'rgba(52,211,153,0.55)' : 'rgba(248,113,113,0.45)'}`,
                  color: rankInfo.advance ? '#34d399' : '#f87171',
                }}
              >
                {rankInfo.advance
                  ? round === 'round1'
                    ? '✦ 準決勝進出 ✦'
                    : '✦ 決勝進出 ✦'
                  : round === 'round1'
                    ? '━ 一回戦敗退 ━'
                    : '━ 準決勝敗退 ━'}
              </motion.div>

              {/* 順位テキスト */}
              <motion.div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color: rankInfo.color,
                  textShadow: playerRank === 0 ? '0 0 24px rgba(250,200,30,0.65)' : 'none',
                }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                {rankInfo.headline}
              </motion.div>

              <motion.div
                style={{ fontSize: 13, color: 'rgba(200,190,255,0.65)', marginTop: 4 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {rankInfo.sub}
              </motion.div>

              <div style={{ marginTop: 4, fontSize: 14, color: 'rgba(200,190,255,0.55)' }}>
                最終スコア{' '}
                <span style={{ color: '#fde68a', fontWeight: 900, fontSize: 22 }}>
                  {ranking.find((e) => e.isPlayer)?.score ?? 0}
                </span>
                点
              </div>

              <div style={{ marginTop: 10 }}>
                <PotatoAvatar equipped={equippedDetails} emotion={rankInfo.advance ? 'happy' : 'confused'} size={80} ssrEffect={false} />
              </div>
            </div>

            {/* ── ランキング表（通過 / 敗退バッジ付き）──────────────────────── */}
            <div
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid rgba(99,102,241,0.22)',
                marginBottom: 14,
              }}
            >
              {ranking.map((entry, i) => {
                const entryAdvance = entry.qualified;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.06 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      background: entry.isPlayer
                        ? 'linear-gradient(135deg,rgba(99,102,241,0.28),rgba(139,92,246,0.2))'
                        : i % 2 === 0
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.15)',
                      borderBottom: i < ranking.length - 1 ? '1px solid rgba(99,102,241,0.1)' : 'none',
                      borderLeft: entry.isPlayer ? '3px solid #818cf8' : '3px solid transparent',
                    }}
                  >
                    {/* アバター */}
                    <div style={{ flexShrink: 0 }}>
                      <PotatoAvatar
                        equipped={entry.isPlayer ? equippedDetails : entry.equipped}
                        emotion={entry.isPlayer ? (rankInfo.advance ? 'happy' : 'confused') : 'smart'}
                        size={38}
                        ssrEffect={false}
                      />
                    </div>

                    {/* 順位絵文字 */}
                    <span style={{ fontSize: i < 3 ? 17 : 12, minWidth: 20, textAlign: 'center', flexShrink: 0 }}>
                      {i < 3 ? RANK_EMOJI[i] : `${i + 1}`}
                    </span>

                    {/* 名前 */}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: entry.isPlayer ? 900 : 600,
                        color: entry.isPlayer ? '#c4b5fd' : '#e0d7ff',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.name}
                      {entry.isPlayer ? ' 👈' : ''}
                    </span>

                    {/* スコア */}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                        color: i === 0 ? '#fde68a' : entry.isPlayer ? '#a78bfa' : '#64748b',
                        flexShrink: 0,
                        marginRight: 8,
                      }}
                    >
                      {entry.score}
                      <span style={{ fontSize: 9, marginLeft: 2 }}>点</span>
                    </span>

                    {/* 通過 / 敗退バッジ */}
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: 99,
                        background: entryAdvance ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
                        border: `1px solid ${entryAdvance ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.45)'}`,
                        color: entryAdvance ? '#34d399' : '#f87171',
                      }}
                    >
                      {entryAdvance ? '通過' : '敗退'}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* ── ボタン群 ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rankInfo.advance ? (
                <RpgButton
                  onClick={round === 'round1' ? goToSemifinalCategory : goToFinalCategory}
                  label={round === 'round1' ? '準決勝へ進む' : '決勝へ進む'}
                  icon={round === 'round1' ? '🏟' : '🏆'}
                  fromColor="#065f46"
                  toColor="#10b981"
                  shadowColor="rgba(4,60,38,0.95)"
                  glowColor="rgba(16,185,129,0.5)"
                />
              ) : (
                <RpgButton
                  onClick={startTournament}
                  label="もう一度挑戦する"
                  icon="🔁"
                  fromColor="#4338ca"
                  toColor="#7c3aed"
                  shadowColor="rgba(30,15,80,0.95)"
                  glowColor="rgba(99,102,241,0.45)"
                />
              )}

              <RpgButton
                onClick={goToLobby}
                label="ロビーに戻る"
                icon="🏠"
                fromColor="#1e1b4b"
                toColor="#4338ca"
                shadowColor="rgba(15,10,60,0.95)"
                glowColor="rgba(67,56,202,0.4)"
              />
            </div>
          </motion.section>
        )}

        {/* ══ SEMIFINAL: category select ════════════════════════════════════════ */}
        {phase === 'semifinal_category' && (
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div
              style={{
                borderRadius: 18,
                padding: '18px 16px',
                background: 'rgba(18,12,45,0.88)',
                border: '1px solid rgba(160,130,255,0.22)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#e0d7ff' }}>準決勝のジャンルを選んでください</div>
                <div style={{ fontSize: 12, color: 'rgba(180,170,240,0.65)', marginTop: 6, lineHeight: 1.8 }}>
                  選んだジャンルから5問＋全ジャンルからランダム5問（計10問）
                </div>
                <div style={{ fontSize: 11, color: 'rgba(180,170,240,0.55)', marginTop: 6 }}>
                  参加者は上位3人（あなた＋CPU2人）です
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {semiCategoryCandidates.map((g) => (
                  <RpgButton
                    key={g}
                    onClick={() => startSemifinal(g)}
                    label={g}
                    icon="📚"
                    fromColor="#4338ca"
                    toColor="#7c3aed"
                    shadowColor="rgba(30,15,80,0.95)"
                    glowColor="rgba(99,102,241,0.45)"
                  />
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <RpgButton
                  onClick={goToLobby}
                  label="ロビーに戻る"
                  icon="🏠"
                  fromColor="#0f172a"
                  toColor="#334155"
                  shadowColor="rgba(0,0,0,0.75)"
                  glowColor="rgba(148,163,184,0.25)"
                />
              </div>
            </div>
          </motion.section>
        )}

        {/* ══ FINAL: genre select ═══════════════════════════════════════════════ */}
        {phase === 'final_category' && (
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div
              style={{
                borderRadius: 18,
                padding: '18px 16px',
                background: 'rgba(18,12,45,0.90)',
                border: '1px solid rgba(250,204,21,0.22)',
                boxShadow: '0 14px 46px rgba(0,0,0,0.55)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fde68a' }}>決勝で使う得意ジャンルを選んでください</div>
                <div style={{ fontSize: 12, color: 'rgba(250,230,170,0.70)', marginTop: 6, lineHeight: 1.8 }}>
                  選んだジャンルから5問＋全ジャンルからランダム5問（計10問）
                </div>
                <div style={{ fontSize: 11, color: 'rgba(200,190,255,0.55)', marginTop: 6 }}>
                  参加者は2人（あなた＋CPU1人）です
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {finalGenreCandidates.map((g) => (
                  <RpgButton
                    key={g}
                    onClick={() => startFinal(g)}
                    label={g}
                    icon="⭐"
                    fromColor="#92400e"
                    toColor="#f59e0b"
                    shadowColor="rgba(70,28,4,0.95)"
                    glowColor="rgba(245,158,11,0.35)"
                  />
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <RpgButton
                  onClick={goToLobby}
                  label="ロビーに戻る"
                  icon="🏠"
                  fromColor="#0f172a"
                  toColor="#334155"
                  shadowColor="rgba(0,0,0,0.75)"
                  glowColor="rgba(148,163,184,0.25)"
                />
              </div>
            </div>
          </motion.section>
        )}

        {/* ══ TOURNAMENT FINAL RESULT ═══════════════════════════════════════════ */}
        {phase === 'tournament_final_result' && (() => {
  const maxScore = Math.max(...ranking.map(e => e.score), 1);
  const MAX_BAR_H = 190;
  const sorted = [...ranking].sort((a, b) => a.score - b.score); // 低い順（右が優勝者）
  const isChampion = tournamentReach === 'champion';

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>

      {/* ─── タイトル ─── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 16 }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.28em', color: 'rgba(250,204,21,0.6)', marginBottom: 6 }}>
          ── 決 勝 最 終 結 果 ──
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.8, type: 'spring', stiffness: 200 }}
          style={{
            fontSize: 30, fontWeight: 900, letterSpacing: '0.06em',
            color: isChampion ? '#fde68a' : '#e0d7ff',
            textShadow: isChampion ? '0 0 32px rgba(250,204,21,0.9), 0 0 60px rgba(250,204,21,0.4)' : 'none',
          }}
        >
          {isChampion ? '🏆 あなたの優勝！' : `${finalWinnerName ?? 'CPU'} の優勝！`}
        </motion.div>
      </motion.div>

      {/* ─── バーチャート ─── */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(6,3,22,0.98) 0%, rgba(14,8,38,0.98) 100%)',
        border: `1.5px solid ${isChampion ? 'rgba(250,204,21,0.35)' : 'rgba(99,102,241,0.3)'}`,
        boxShadow: isChampion ? '0 0 50px rgba(250,180,20,0.25), 0 16px 48px rgba(0,0,0,0.7)' : '0 16px 48px rgba(0,0,0,0.65)',
        padding: '20px 16px 0',
        marginBottom: 14,
        position: 'relative',
      }}>

        {/* 背景キラキラ（優勝時） */}
        {isChampion && [
          {top:'12%',left:'7%',delay:2.9,dur:2.6,size:16},
          {top:'8%',left:'88%',delay:3.3,dur:3.1,size:12},
          {top:'35%',left:'5%',delay:3.6,dur:2.4,size:10},
          {top:'30%',left:'91%',delay:3.0,dur:2.9,size:14},
          {top:'55%',left:'12%',delay:3.8,dur:2.7,size:9},
          {top:'50%',left:'85%',delay:3.2,dur:3.3,size:11},
        ].map((p, i) => (
          <motion.div key={i} style={{
            position: 'absolute', top: p.top, left: p.left,
            fontSize: p.size, color: '#fde68a', pointerEvents: 'none', zIndex: 1,
            textShadow: '0 0 8px rgba(250,204,21,0.9)',
          }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.5] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          >✦</motion.div>
        ))}

        {/* グリッド目盛り線 */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {[0.25, 0.5, 0.75, 1.0].map(r => (
            <div key={r} style={{
              position: 'absolute',
              bottom: Math.round(r * MAX_BAR_H),
              left: 0, right: 0, height: 1,
              background: r === 1.0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              zIndex: 0,
            }} />
          ))}

          {/* バー + アバター */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 16,
            height: MAX_BAR_H + 180,
            position: 'relative', zIndex: 1,
          }}>
            {sorted.map((entry, i) => {
              const isWinner = i === sorted.length - 1;
              const barH = Math.max(24, Math.round((entry.score / maxScore) * MAX_BAR_H));
              const emotion: PotatoEmotion = isWinner ? 'happy' : 'confused';

              const barBg = isWinner
                ? 'linear-gradient(180deg,#fef08a 0%,#f59e0b 45%,#b45309 100%)'
                : entry.isPlayer
                  ? 'linear-gradient(180deg,#c4b5fd 0%,#7c3aed 50%,#4c1d95 100%)'
                  : 'linear-gradient(180deg,#94a3b8 0%,#475569 50%,#334155 100%)';

              return (
                <div key={entry.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  flex: 1, maxWidth: 140,
                }}>
                  {/* 王冠スペース（高さを揃えるため全員分確保） */}
                  <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 4 }}>
                    <motion.div
                      initial={{ opacity: 0, y: -24, scale: 0.4 }}
                      animate={isWinner ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0 }}
                      transition={{ delay: 3.0, type: 'spring', stiffness: 280, damping: 16 }}
                      style={{ fontSize: 30 }}
                    >
                      {isWinner ? '👑' : ''}
                    </motion.div>
                  </div>

                  {/* アバター */}
                  <motion.div
                    animate={isWinner ? { y: [0, -7, 0] } : {}}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 3.5 }}
                  >
                    <PotatoAvatar
                      equipped={entry.isPlayer ? equippedDetails : entry.equipped}
                      emotion={emotion}
                      size={isWinner ? 70 : 58}
                      ssrEffect={false}
                    />
                  </motion.div>

                  {/* スコア（バーが伸びきった後に出現） */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6 + i * 0.25 }}
                    style={{
                      fontSize: isWinner ? 18 : 14,
                      fontWeight: 900,
                      color: isWinner ? '#fde68a' : entry.isPlayer ? '#c4b5fd' : 'rgba(180,170,220,0.7)',
                      textShadow: isWinner ? '0 0 14px rgba(250,204,21,0.7)' : 'none',
                      margin: '5px 0 6px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {entry.score}pt
                  </motion.div>

                  {/* バー本体 */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: barH }}
                    transition={{
                      duration: 1.5,
                      delay: 0.4 + i * 0.25,
                      ease: [0.22, 1.2, 0.36, 1],
                    }}
                    style={{
                      width: '100%',
                      background: barBg,
                      borderRadius: '8px 8px 0 0',
                      flexShrink: 0,
                      border: `1px solid ${isWinner ? 'rgba(250,204,21,0.55)' : 'rgba(255,255,255,0.1)'}`,
                      borderBottom: 'none',
                      boxShadow: isWinner
                        ? '0 0 28px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,200,0.5)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.12)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* シマー（優勝バーのみ） */}
                    {isWinner && (
                      <motion.div
                        style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(180deg, rgba(255,255,200,0.35) 0%, transparent 55%)',
                          pointerEvents: 'none',
                        }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
                      />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 名前行 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '10px 0 16px', position: 'relative', zIndex: 2 }}>
          {sorted.map((entry, i) => {
            const isWinner = i === sorted.length - 1;
            return (
              <div key={entry.id} style={{ flex: 1, maxWidth: 140, textAlign: 'center' }}>
                <div style={{
                  fontSize: 13, fontWeight: 900,
                  color: isWinner ? '#fde68a' : entry.isPlayer ? '#c4b5fd' : '#94a3b8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.name}{entry.isPlayer ? ' 👈' : ''}
                </div>
                {isWinner && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1 }}
                    style={{ fontSize: 10, color: 'rgba(250,204,21,0.8)', fontWeight: 800, marginTop: 2 }}
                  >
                    WINNER
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 結果メッセージ ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.2 }}
        style={{
          textAlign: 'center', padding: '16px 20px', borderRadius: 16, marginBottom: 16,
          background: isChampion
            ? 'linear-gradient(135deg, rgba(60,40,5,0.97), rgba(80,58,8,0.97))'
            : 'linear-gradient(135deg, rgba(18,14,45,0.97), rgba(24,18,55,0.97))',
          border: `1.5px solid ${isChampion ? 'rgba(250,200,30,0.5)' : 'rgba(99,102,241,0.35)'}`,
          boxShadow: isChampion ? '0 0 40px rgba(250,180,20,0.2)' : 'none',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 6 }}>
          {isChampion ? '🎉🏆🎉' : '💪'}
        </div>
        <div style={{
          fontSize: 20, fontWeight: 900,
          color: isChampion ? '#fde68a' : '#e0d7ff',
          textShadow: isChampion ? '0 0 20px rgba(250,204,21,0.6)' : 'none',
          marginBottom: 4,
        }}>
          {isChampion ? 'トーナメント優勝！' : '惜しくも準優勝…'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(200,190,255,0.6)' }}>
          {isChampion
            ? 'すべての対戦を制覇しました！'
            : `${finalWinnerName ?? 'CPU'} に敗れました`}
        </div>
      </motion.div>

      {/* ─── ボタン ─── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <RpgButton
          onClick={startTournament} label="もう一度挑戦する" icon="🔁"
          fromColor="#4338ca" toColor="#7c3aed"
          shadowColor="rgba(30,15,80,0.95)" glowColor="rgba(99,102,241,0.45)"
        />
        <RpgButton
          onClick={goToLobby} label="ロビーに戻る" icon="🏠"
          fromColor="#0f172a" toColor="#334155"
          shadowColor="rgba(0,0,0,0.75)" glowColor="rgba(148,163,184,0.25)"
        />
      </motion.div>
    </motion.section>
  );
})()}
      </div>
    </main>
  );
}