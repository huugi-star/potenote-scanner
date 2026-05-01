'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { normalizeReading } from '@/lib/normalizeReading';
import { addRepairBookFragments } from '@/lib/repairBookFragments';
import type { KanColeCard, KanColeEnemy, KanColeScan } from '@/types';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { compressForAI, preprocessImageForOCR, validateImageFile } from '@/lib/imageUtils';
import { KanDexScreen } from '@/components/kancole/KanDexScreen';
import { KanDexVolScreen } from '@/components/kancole/KanDexVolScreen';
import { KanDexDetailScreen } from '@/components/kancole/KanDexDetailScreen';

type View = 'hub' | 'log' | 'scan' | 'battle' | 'result' | 'dex' | 'dexVol' | 'dexDetail';
type ScanPhase = 'idle' | 'uploading' | 'processing' | 'error';
type QuestMode = 'explore' | 'retry';
type BattleState = 'play' | 'feedback';
type MissedWord = { word: KanColeEnemy; missCount: number };

const QUESTIONS_PER_ROUND = 7;
const TIME_LIMIT_SEC = 10;
const FEEDBACK_EXTRA_MS = 400;
/** 正解札の animate times[1]。単語割裂はこのタイミングで開始し、視覚的に札が単語へ当たる瞬間と揃える */
const SEAL_CARD_OK_DURATION_S = 0.48;
const SEAL_CARD_OK_IMPACT_AT = SEAL_CARD_OK_DURATION_S * 0.78;

/** 漢コレリザルト（Ac*）と FreeQuest と揃える AC 配色 */
const AC = {
  sky:'#c8eaf5', green:'#5cb85c', darkGreen:'#3a7a3a',
  leaf:'#8dc63f', cream:'#fef9ee', tan:'#f0e6c8',
  sand:'#e8d5a3', brown:'#8b5e3c', text:'#4a3728',
  muted:'#9b7f6e', teal:'#7dd4c0', yellow:'#ffd966',
  amber:'#f5a623', red:'#e05555', blue:'#5b9bd5',
};

function AcBtn({ label, emoji, from, shadow, onClick, disabled, small }:{
  label:string; emoji?:string; from:string; shadow:string;
  onClick:()=>void; disabled?:boolean; small?:boolean;
}) {
  const [p,setP] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)}
      style={{
        width:'100%', padding: small ? '10px 16px' : '13px 20px', borderRadius:99,
        background:`linear-gradient(180deg,${from} 0%,${shadow} 100%)`,
        border:'2px solid rgba(255,255,255,0.28)',
        borderBottom: p ? `2px solid ${shadow}` : `5px solid ${shadow}`,
        transform: p ? 'translateY(3px)' : 'translateY(0)',
        boxShadow: p ? 'none' : `0 5px 14px ${from}66`,
        color:'#fff', fontSize: small ? 13 : 15, fontWeight:900,
        display:'flex', alignItems:'center', justifyContent:'center', gap:7,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition:'border-bottom .07s,transform .07s', WebkitTapHighlightColor:'transparent',
      }}
    >
      {emoji && <span style={{fontSize: small ? 16 : 18}}>{emoji}</span>}
      {label}
    </button>
  );
}

function AcHeader({ title, sub, onBack, backLabel='もどる' }:{
  title:string; sub?:string; onBack:()=>void; backLabel?:string;
}) {
  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 16px',
      background:'rgba(255,255,255,0.68)', backdropFilter:'blur(8px)',
      borderBottom:`3px solid ${AC.darkGreen}`,
      boxShadow:`0 3px 0 ${AC.leaf}55`,
      position:'sticky', top:0, zIndex:20,
    }}>
      <motion.button type="button" onClick={() => { vibrateLight(); onBack(); }} whileTap={{scale:0.9}}
        style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'5px 12px 5px 8px', borderRadius:99,
          background:AC.green, color:'#fff',
          border:`2px solid ${AC.darkGreen}`, boxShadow:`0 3px 0 ${AC.darkGreen}`,
          fontSize:13, fontWeight:900, cursor:'pointer', WebkitTapHighlightColor:'transparent',
        }}
      ><ChevronLeft style={{width:16,height:16}}/>{backLabel}</motion.button>
      <div style={{textAlign:'center'}}>
        {sub && <div style={{fontSize:9,fontWeight:900,letterSpacing:'0.18em',color:AC.darkGreen}}>✦ {sub} ✦</div>}
        <h1 style={{fontSize:18,fontWeight:900,margin:0,color:AC.text}}>{title}</h1>
      </div>
      <div style={{width:52}}/>
    </header>
  );
}

function AcPage({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight:'100dvh', display:'flex', flexDirection:'column',
      background:`linear-gradient(180deg,${AC.sky} 0%,#daf0e8 28%,${AC.cream} 60%,${AC.tan} 100%)`,
      color:AC.text, position:'relative', overflow:'hidden',
    }}>
      {/* 葉っぱ装飾 */}
      {[
        { e: '🍃', t: '5%', l: '3%', s: 22, rot: -20, d: 0 },
        { e: '🌿', t: '9%', r: '4%', s: 18, rot: 15, d: 0.4 },
        { e: '⭐', t: '6%', l: '45%', s: 13, rot: 5, d: 0.7 },
      ].map((d, i) => (
        <motion.span key={i} style={{
          position:'absolute',fontSize:d.s,opacity:0.38,top:d.t,
          left:d.l, right:d.r, rotate:d.rot, pointerEvents:'none', zIndex:0,
        }}
          animate={{y:[0,-6,0]}}
          transition={{duration:3.2+i*0.3,delay:d.d,repeat:Infinity,ease:'easeInOut'}}
        >{d.e}</motion.span>
      ))}
      {children}
    </div>
  );
}

/** 拠点2列タイル。ループ内で useState するとビュー切替で KanColeScreen の hooks 数が変わるため子に分離する */
function HubTwinTile({
  emoji,
  label,
  sub,
  from,
  shadow,
  onClick,
  delay,
}: {
  emoji: string;
  label: string;
  sub: string;
  from: string;
  shadow: string;
  onClick: () => void;
  delay: number;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        padding: '16px 10px 14px',
        borderRadius: 20,
        background: `linear-gradient(180deg, ${from} 0%, ${shadow} 100%)`,
        border: '2px solid rgba(255,255,255,0.25)',
        borderBottom: pressed ? `2px solid ${shadow}` : `5px solid ${shadow}`,
        transform: pressed ? 'translateY(3px)' : 'translateY(0)',
        boxShadow: pressed ? 'none' : `0 5px 14px ${from}55`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-bottom .07s, transform .07s',
      }}
    >
      <span style={{ fontSize: 28 }}>{emoji}</span>
      <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.7)',
          background: 'rgba(0,0,0,0.15)',
          padding: '2px 10px',
          borderRadius: 99,
        }}
      >
        {sub}
      </span>
    </motion.button>
  );
}

/** 戦闘エリア（right:8% bottom:12% の札）→ flex 中央の単語へ向かう translate キーフレーム。端末幅に追従 */
type SealCardKeyframePaths = {
  ok: { x: number[]; y: number[] };
  miss: { x: number[]; y: number[] };
};

function computeSealCardKeyframePaths(arenaEl: HTMLElement | null): SealCardKeyframePaths {
  const REF_W = 360;
  const REF_H = 620;
  const W = arenaEl && arenaEl.clientWidth >= 12 ? arenaEl.clientWidth : REF_W;
  const H = arenaEl && arenaEl.clientHeight >= 12 ? arenaEl.clientHeight : REF_H;
  const cs = arenaEl ? getComputedStyle(arenaEl) : null;
  const padT = cs ? parseFloat(cs.paddingTop) || 0 : 32;
  const padB = cs ? parseFloat(cs.paddingBottom) || 0 : 8;
  const remPx = typeof window !== 'undefined' ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;
  const cardW = 2.4 * remPx;
  const cardH = 3.8 * remPx;

  const innerH = H - padT - padB;
  const cx0 = W * (1 - 0.08) - cardW / 2;
  const cy0 = H * (1 - 0.12) - cardH / 2;
  const cx1 = W / 2;
  const cy1 = padT + innerH / 2;
  const dx = cx1 - cx0;
  const dy = cy1 - cy0;

  const sx = W / REF_W;
  const sy = H / REF_H;

  return {
    ok: {
      x: [0, dx * (105 / 138), dx],
      y: [0, dy * (115 / 140), dy],
    },
    miss: {
      x: [0, -98 * sx, -52 * sx, 8 * sx],
      y: [0, -118 * sy, -60 * sy, 14 * sy],
    },
  };
}

function selectKanColeQuestions(scan: KanColeScan, mode: QuestMode, retryPriorityTerms: string[] = []): KanColeEnemy[] {
  const activeSet = new Set(scan.activeEnemyTerms ?? scan.words.map((w) => w.term));
  const poolBase = scan.words.filter((w) => activeSet.has(w.term) && w.hp > 0);
  if (poolBase.length === 0) return [];

  const priorityMap = new Map<string, number>(retryPriorityTerms.map((t, i) => [t, i]));
  const sorted = [...poolBase].sort((a, b) => {
    if (mode === 'retry') {
      const ap = priorityMap.get(a.term);
      const bp = priorityMap.get(b.term);
      const ai = ap !== undefined;
      const bi = bp !== undefined;
      if (ai !== bi) return ai ? -1 : 1;
      if (ai && bi && ap !== bp) return (ap as number) - (bp as number);
      if (a.hp !== b.hp) return a.hp - b.hp;
      if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
      return Math.random() - 0.5;
    }
    if (a.asked !== b.asked) return a.asked ? 1 : -1;
    if (a.hp !== b.hp) return b.hp - a.hp;
    if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
    return Math.random() - 0.5;
  });

  return sorted.slice(0, QUESTIONS_PER_ROUND);
}

export function KanColeScreen({ onBack }: { onBack: () => void }) {
  const addCoins = useGameStore((s) => s.addCoins);
  const markCorrect = useGameStore((s) => s.markKanColeCorrect);
  const recordWrong = useGameStore((s) => s.recordKanColeWrong);
  const kanColeScans = useGameStore((s) => s.kanColeScans);
  const saveKanColeScan = useGameStore((s) => s.saveKanColeScan);
  const getKanColeScanById = useGameStore((s) => s.getKanColeScanById);
  const updateKanColeEnemyState = useGameStore((s) => s.updateKanColeEnemyState);
  const saveKanColeAdventureSnapshot = useGameStore((s) => s.saveKanColeAdventureSnapshot);
  const kanDexOrder = useGameStore((s) => s.kanDexOrder);

  const [view, setView] = useState<View>('hub');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [battleState, setBattleState] = useState<BattleState>('play');
  const [, setQuestMode] = useState<QuestMode>('explore');
  const [retryPriorityTerms, setRetryPriorityTerms] = useState<string[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [roundItems, setRoundItems] = useState<KanColeEnemy[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');

  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const [battleLog, setBattleLog] = useState('');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [lastSealed, setLastSealed] = useState(false);
  const [cardThrow, setCardThrow] = useState<{ isCorrect: boolean; key: number; kf: SealCardKeyframePaths } | null>(
    null,
  );
  const [hitType, setHitType] = useState<'shake' | 'split' | 'seal' | null>(null);
  const [, setSealArrived] = useState(false);
  const [sealPhase, setSealPhase] = useState<'idle' | 'throw' | 'seal'>('idle');
  const sealTimersRef = useRef<number[]>([]);

  const [capturedWords, setCapturedWords] = useState<KanColeEnemy[]>([]);
  const [defeatedWords, setDefeatedWords] = useState<KanColeEnemy[]>([]);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [misses, setMisses] = useState(0);
  const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
  const [askedTerms, setAskedTerms] = useState<string[]>([]);

  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedLeaves, setEarnedLeaves] = useState(0);
  const [missedListOpen, setMissedListOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const [dexVolIndex, setDexVolIndex] = useState(0);
  const [dexTerm, setDexTerm] = useState<string | null>(null);

  const answerInputRef = useRef<HTMLInputElement>(null);
  const battleArenaRef = useRef<HTMLDivElement>(null);
  const scrollLockYRef = useRef(0);

  const lockScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const body = document.body;
    if (body.style.position === 'fixed') return;
    const y = window.scrollY || window.pageYOffset || 0;
    scrollLockYRef.current = y;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  }, []);

  const unlockScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const body = document.body;
    if (body.style.position !== 'fixed') return;
    const y = scrollLockYRef.current || 0;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    window.scrollTo(0, y);
  }, []);

  useEffect(() => {
    if (view !== 'battle') {
      unlockScroll();
      setKeyboardInset(0);
      return;
    }

    // battle中は常時ロックして、フォーカス時のスクロールを防ぐ
    lockScroll();
    window.scrollTo(0, 0);

    const vv = window.visualViewport;
    if (!vv) {
      return () => {
        unlockScroll();
        setKeyboardInset(0);
      };
    }

    const syncKeyboardInset = () => {
      // Android Chrome: キーボード表示時は visualViewport が縮む
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
      if (document.activeElement === answerInputRef.current) {
        window.scrollTo(0, 0);
      }
    };

    vv.addEventListener('resize', syncKeyboardInset);
    vv.addEventListener('scroll', syncKeyboardInset);
    syncKeyboardInset();

    return () => {
      vv.removeEventListener('resize', syncKeyboardInset);
      vv.removeEventListener('scroll', syncKeyboardInset);
      unlockScroll();
      setKeyboardInset(0);
    };
  }, [lockScroll, unlockScroll, view]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const ignoreFilePickerUntilRef = useRef(0);
  const SUPPRESS_FILE_PICKER_MS = 8000;

  const current = roundItems[idx];
  /** 戦闘画面上部バー: 経過した割合（0→100%、制限時間いっぱいで満タン） */
  const timeElapsedBarPct = Math.min(100, Math.max(0, ((TIME_LIMIT_SEC - timeLeft) / TIME_LIMIT_SEC) * 100));
  const isTimeWarning = timeLeft <= 2;
  const displayDefeatedCount = useMemo(() => defeatedCount, [defeatedCount]);

  const scansForDisplay = useMemo(() => {
    return kanColeScans.map((scan) => {
      if (scan.lastAdventureSnapshot) {
        const snap = scan.lastAdventureSnapshot;
        return { id: scan.id, title: scan.title, captured: snap.capturedCount, defeated: snap.defeatedCount, remaining: snap.remainingCount, total: snap.total };
      }
      const activeTerms = scan.activeEnemyTerms ?? scan.words.map((w) => w.term);
      const activeTotal = scan.activeEnemyTotal ?? activeTerms.length;
      const activeWords = activeTerms.map((t) => scan.words.find((w) => w.term === t)).filter(Boolean) as KanColeEnemy[];
      const captured = activeWords.filter((w) => w.hp === 0).length;
      const defeated = activeWords.filter((w) => w.hp === 1).length;
      return { id: scan.id, title: scan.title, captured, defeated, remaining: Math.max(0, activeTotal - captured - defeated), total: activeTotal > 0 ? activeTotal : 1 };
    });
  }, [kanColeScans]);

  const stopProgressTicker = useCallback((finalValue?: number) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (typeof finalValue === 'number') setProgress(finalValue);
  }, []);
  
  const startProgressTicker = useCallback(() => {
    stopProgressTicker();
    setProgress(0);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => Math.min(95, p + 4));
    }, 1000);
  }, [stopProgressTicker]);

  useEffect(() => () => stopProgressTicker(), [stopProgressTicker]);

  const startQuest = useCallback((scanId: string, mode: QuestMode, priority: string[] = []) => {
    const scan = getKanColeScanById(scanId);
    if (!scan) return;
    const picked = selectKanColeQuestions(scan, mode, priority);
    if (picked.length === 0) {
      setError('出題できる問題がありません。');
      setView('hub');
      return;
    }
    setSelectedScanId(scanId);
    setQuestMode(mode);
    setRetryPriorityTerms(priority);
    setRoundItems(picked);
    setIdx(0);
    setAnswer('');
    setTimeLeft(TIME_LIMIT_SEC);
    setBattleState('play');
    setBattleLog('');
    setLastCorrect(null);
    setLastSealed(false);
    setCardThrow(null);
    setHitType(null);
    setSealArrived(false);
    setSealPhase('idle');
    sealTimersRef.current.forEach((id) => window.clearTimeout(id));
    sealTimersRef.current = [];
    setCapturedWords([]);
    setDefeatedWords([]);
    setDefeatedCount(0);
    setMisses(0);
    setMissedWords([]);
    setAskedTerms([]);
    setView('battle');
  }, [getKanColeScanById]);

  const handleFileSelect = useCallback(async (file: File) => {
    vibrateLight();
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || '無効なファイルです');
      setScanPhase('error');
      return;
    }
    setError('');
    setScanPhase('uploading');
    setProgressLabel('画像を確認中...');
    startProgressTicker();
    try {
      const compressed = await compressForAI(file);
      setSelectedImage(compressed.dataUrl);
      setScanPhase('processing');
      setProgressLabel('本文を読み取り中...');
      const enhancedImage = await preprocessImageForOCR(file);
      const res = await fetch('/api/kancole-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: enhancedImage, count: 20 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error: ${res.status}`);
      const cards = Array.isArray(data.items) ? (data.items as KanColeCard[]) : [];
      if (cards.length === 0) throw new Error('問題生成に失敗しました');
      const scanId = saveKanColeScan(cards, compressed.dataUrl);
      if (!scanId) throw new Error('保存に失敗しました');
      stopProgressTicker(100);
      vibrateSuccess();
      startQuest(scanId, 'explore');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'スキャンに失敗しました');
      setScanPhase('error');
      stopProgressTicker(0);
      vibrateError();
    }
  }, [saveKanColeScan, startProgressTicker, stopProgressTicker, startQuest]);

  const judge = useCallback(() => {
    if (!current || battleState !== 'play' || !selectedScanId) return;
    const kf = computeSealCardKeyframePaths(battleArenaRef.current);
    vibrateLight();
    const ok = normalizeReading(answer) === normalizeReading(current.reading) && normalizeReading(answer).length > 0;
    setLastCorrect(ok);
    setAskedTerms((prev) => (prev.includes(current.term) ? prev : [...prev, current.term]));
    if (ok) {
      vibrateSuccess();
      const newHp = Math.max(0, current.hp - 1);
      updateKanColeEnemyState(selectedScanId, current.term, { hp: newHp, asked: true });
      markCorrect(current);
      setDefeatedCount((d) => d + 1);
      if (newHp === 0) {
        setCapturedWords((arr) => (arr.some((w) => w.term === current.term) ? arr : [...arr, { ...current, hp: 0 }]));
        setLastSealed(true);
        setBattleLog('封印した！');
        setHitType('seal');
      } else {
        setDefeatedWords((arr) => (arr.some((w) => w.term === current.term) ? arr : [...arr, { ...current, hp: newHp }]));
        setLastSealed(false);
        setBattleLog('封印札ヒット！');
        setHitType('split');
      }
      setCardThrow({ isCorrect: true, key: Date.now(), kf });
    } else {
      vibrateError();
      updateKanColeEnemyState(selectedScanId, current.term, { asked: true, wrongCount: (current.wrongCount ?? 0) + 1 });
      recordWrong(current);
      setMisses((m) => m + 1);
      setLastSealed(false);
      setBattleLog('はじかれた…');
      setHitType('shake');
      setCardThrow({ isCorrect: false, key: Date.now(), kf });
      setMissedWords((prev) => {
        const found = prev.find((x) => x.word.term === current.term);
        if (!found) return [...prev, { word: current, missCount: 1 }];
        return prev.map((x) => (x.word.term === current.term ? { ...x, missCount: x.missCount + 1 } : x));
      });
    }
    setBattleState('feedback');
  }, [answer, battleState, current, selectedScanId, updateKanColeEnemyState, markCorrect, recordWrong]);

  // リング演出制御
  useEffect(() => {
    if (view !== 'battle' || battleState !== 'feedback' || hitType !== 'seal' || !cardThrow?.isCorrect) return;

    setSealArrived(false);
    setSealPhase('throw');
    sealTimersRef.current.forEach((id) => window.clearTimeout(id));
    sealTimersRef.current = [];

    const t1 = window.setTimeout(() => setSealPhase('seal'), 520);
    const t2 = window.setTimeout(() => setSealArrived(true), 900);
    sealTimersRef.current = [t1, t2];

    return () => {
      sealTimersRef.current.forEach((id) => window.clearTimeout(id));
      sealTimersRef.current = [];
    };
  }, [view, battleState, hitType, cardThrow]);

  useEffect(() => {
    if (view !== 'battle' || battleState !== 'play') return;
    const t = window.setInterval(() => setTimeLeft((p) => Math.max(0, Number((p - 0.5).toFixed(1)))), 500);
    return () => clearInterval(t);
  }, [view, battleState, idx]);

  useEffect(() => {
    if (view !== 'battle' || battleState !== 'play' || timeLeft > 0) return;
    judge();
  }, [view, battleState, timeLeft, judge]);

  useEffect(() => {
    if (view !== 'battle' || battleState !== 'feedback') return;
    const delayMs = (lastSealed ? 1250 : 1500) + FEEDBACK_EXTRA_MS;
    const id = window.setTimeout(() => {
      if (!selectedScanId) return;
      if (idx + 1 >= roundItems.length) {
        const leaves = defeatedCount + capturedWords.length;
        const coins = defeatedCount;
        if (leaves > 0) addRepairBookFragments(leaves);
        if (coins > 0) addCoins(coins);
        setEarnedLeaves(leaves);
        setEarnedCoins(coins);

        const latest = getKanColeScanById(selectedScanId);
        if (latest) {
          const activeTerms = latest.activeEnemyTerms ?? latest.words.map((w) => w.term);
          const total = latest.activeEnemyTotal ?? activeTerms.length;
          const activeWords = activeTerms.map((t) => latest.words.find((w) => w.term === t)).filter(Boolean) as KanColeEnemy[];
          saveKanColeAdventureSnapshot(selectedScanId, {
            timestamp: new Date().toISOString(),
            capturedCount: activeWords.filter((w) => w.hp === 0).length,
            defeatedCount: activeWords.filter((w) => w.hp === 1).length,
            remainingCount: Math.max(0, total - activeWords.filter((w) => w.hp === 0).length - activeWords.filter((w) => w.hp === 1).length),
            total: total > 0 ? total : 1,
            capturedWords: activeWords.filter((w) => w.hp === 0),
            defeatedWords: activeWords.filter((w) => w.hp === 1),
          });
        }
        setView('result');
        return;
      }
      setIdx((i) => i + 1);
      setAnswer('');
      setTimeLeft(TIME_LIMIT_SEC);
      setBattleState('play');
      setBattleLog('');
      setLastCorrect(null);
      setLastSealed(false);
      setCardThrow(null);
      setHitType(null);
      setSealArrived(false);
      setSealPhase('idle');
      sealTimersRef.current.forEach((id) => window.clearTimeout(id));
      sealTimersRef.current = [];
    }, delayMs);
    return () => clearTimeout(id);
  }, [view, battleState, idx, roundItems.length, selectedScanId, defeatedCount, capturedWords.length, addCoins, getKanColeScanById, saveKanColeAdventureSnapshot, lastSealed]);

  /** スキャン完了後など progress が残ると、アップロード時にバーが100→下がって見える。待機／エラーに戻したらリセットして0から伸ばす */
  useEffect(() => {
    if (view !== 'scan') return;
    if (scanPhase !== 'idle' && scanPhase !== 'error') return;
    stopProgressTicker();
    setProgress(0);
  }, [view, scanPhase, stopProgressTicker]);

  // ==========================================
  // Render: Hub / Log / Scan / Result / Dex ...
  // ==========================================

  if (view === 'hub') {
    return (
      <AcPage>
        <AcHeader title="漢コレ拠点" sub="かんコレ" onBack={()=>{vibrateLight();onBack();}} backLabel="もどる"/>
        <div style={{flex:1,padding:'16px 14px 40px',maxWidth:480,margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:12,position:'relative',zIndex:1}}>
  
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}>
            <AcBtn label="新しい本文をスキャン" emoji="📷"
              from={AC.amber} shadow="#c07800"
              onClick={()=>{
                vibrateLight();
                setScanPhase('idle');
                stopProgressTicker();
                setProgress(0);
                setView('scan');
              }}
            />
          </motion.div>
  
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {emoji:'📖',label:'冒険ログ',sub:`${kanColeScans.length}件`,from:AC.teal,shadow:'#4aaa96',onClick:()=>{vibrateLight();setView('log');}},
              {emoji:'📚',label:'漢字図鑑',sub:`${kanDexOrder.length}件`,from:AC.blue,shadow:'#3a6fa0',onClick:()=>{vibrateLight();setDexTerm(null);setDexVolIndex(0);setView('dex');}},
            ].map((btn, i) => (
              <HubTwinTile
                key={i}
                emoji={btn.emoji}
                label={btn.label}
                sub={btn.sub}
                from={btn.from}
                shadow={btn.shadow}
                onClick={btn.onClick}
                delay={0.08 + i * 0.06}
              />
            ))}
          </div>
  
          {/* 最近の冒険プレビュー */}
          {scansForDisplay.length > 0 && (
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.18}}
              style={{borderRadius:20,overflow:'hidden',background:'rgba(255,255,255,0.78)',border:`2px solid ${AC.sand}`,boxShadow:`0 4px 0 ${AC.sand}`}}
            >
              <div style={{padding:'8px 14px 6px',fontSize:9,fontWeight:900,letterSpacing:'0.18em',color:AC.darkGreen,borderBottom:`1px solid ${AC.sand}`,background:`${AC.leaf}18`}}>
                ✦ さいきんの冒険
              </div>
              {scansForDisplay.slice(0,2).map((s,i)=>{
                const pct=Math.round((s.captured/Math.max(1,s.total))*100);
                return (
                  <div key={s.id} style={{padding:'10px 14px',borderTop:i>0?`1px solid ${AC.sand}`:undefined}}>
                    <div style={{fontSize:13,fontWeight:900,color:AC.text,marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.title}</div>
                    <div style={{height:8,borderRadius:99,background:AC.tan,overflow:'hidden',marginBottom:6}}>
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${AC.amber},${AC.leaf})` }}
                      />
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:10,color:AC.muted,fontWeight:700}}>捕獲 {s.captured}/{s.total} ・残り {s.remaining}</span>
                      <motion.button type="button" whileTap={{scale:0.93}}
                        onClick={()=>{vibrateLight();startQuest(s.id,'explore');}}
                        style={{fontSize:11,fontWeight:900,color:'#fff',padding:'4px 14px',borderRadius:99,background:`linear-gradient(180deg,${AC.green},${AC.darkGreen})`,border:`1.5px solid ${AC.darkGreen}`,boxShadow:`0 2px 0 ${AC.darkGreen}`,cursor:'pointer',WebkitTapHighlightColor:'transparent'}}
                      >続ける ▶</motion.button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      </AcPage>
    );
  }

  if (view === 'dex') {
    return <KanDexScreen kanDexOrder={kanDexOrder} scans={kanColeScans} onSelectVol={(volIndex) => { setDexVolIndex(volIndex); setView('dexVol'); }} onBack={() => setView('hub')} />;
  }

  if (view === 'dexVol') {
    return <KanDexVolScreen volIndex={dexVolIndex} kanDexOrder={kanDexOrder} scans={kanColeScans} onSelectTerm={(term) => { setDexTerm(term); setView('dexDetail'); }} onBack={() => setView('dex')} />;
  }

  if (view === 'dexDetail' && dexTerm) {
    const dexNo = Math.max(1, kanDexOrder.indexOf(dexTerm) + 1);
    return <KanDexDetailScreen term={dexTerm} dexNo={dexNo} scans={kanColeScans} onBack={() => setView('dexVol')} />;
  }

  if (view === 'log') {
    return (
      <AcPage>
        <AcHeader title="冒険ログ" sub="きろく" onBack={()=>{vibrateLight();setView('hub');}}/>
        <div style={{flex:1,padding:'16px 14px 40px',maxWidth:480,margin:'0 auto',width:'100%',position:'relative',zIndex:1}}>
          {scansForDisplay.length === 0 ? (
            <motion.div initial={{opacity:0}} animate={{opacity:1}}
              style={{textAlign:'center',padding:'50px 20px',borderRadius:24,background:'rgba(255,255,255,0.6)',border:`2px dashed ${AC.sand}`,marginTop:16}}
            >
              <div style={{fontSize:52,marginBottom:12}}>📭</div>
              <div style={{fontSize:15,fontWeight:900,color:AC.text}}>まだ冒険ログがないよ</div>
              <div style={{fontSize:12,color:AC.muted,marginTop:4}}>本文をスキャンして冒険を始めよう！</div>
            </motion.div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {scansForDisplay.map((s,i)=>{
                const pct=Math.round((s.captured/Math.max(1,s.total))*100);
                return (
                  <motion.div key={s.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                    style={{borderRadius:20,overflow:'hidden',background:'rgba(255,255,255,0.82)',border:`2px solid ${AC.sand}`,boxShadow:`0 4px 0 ${AC.sand}`}}
                  >
                    <div style={{padding:'10px 14px 8px',borderBottom:`1px solid ${AC.sand}`,background:`${AC.leaf}18`}}>
                      <div style={{fontSize:13,fontWeight:900,color:AC.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.title}</div>
                    </div>
                    <div style={{padding:'10px 14px 14px'}}>
                      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
                        {[
                          {label:`🔮 捕獲 ${s.captured}体`,bg:`${AC.amber}33`,border:AC.amber,color:AC.brown},
                          {label:`⚔️ 撃破 ${s.defeated}体`,bg:`${AC.teal}33`,border:AC.teal,color:AC.darkGreen},
                          {label:`📌 残り ${s.remaining}体`,bg:AC.tan,border:AC.sand,color:AC.muted},
                        ].map((badge,j)=>(
                          <span key={j} style={{fontSize:10,fontWeight:900,padding:'3px 10px',borderRadius:99,background:badge.bg,border:`1.5px solid ${badge.border}`,color:badge.color}}>{badge.label}</span>
                        ))}
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <span style={{fontSize:9,fontWeight:900,color:AC.muted}}>捕獲進捗</span>
                          <span style={{fontSize:9,fontWeight:900,color:AC.darkGreen}}>{pct}%</span>
                        </div>
                        <div style={{height:10,borderRadius:99,background:AC.tan,border:`1px solid ${AC.sand}`,overflow:'hidden'}}>
                          <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                            style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${AC.amber},${AC.leaf})`, boxShadow: `0 0 6px ${AC.amber}77` }}
                          />
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <AcBtn label="続きを探索" emoji="⚔️" from={AC.amber} shadow="#c07800" small
                          onClick={()=>{vibrateLight();startQuest(s.id,'explore');}}/>
                        <AcBtn label="再戦する" emoji="🔁" from={AC.teal} shadow="#4aaa96" small
                          onClick={()=>{vibrateLight();startQuest(s.id,'retry');}}/>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </AcPage>
    );
  }

  if (view === 'scan') {
    const displayProgress = Math.min(100,Math.max(0,Math.round(progress)));
    return (
      <AcPage>
        <AcHeader title="スキャン" sub="ほんぶんをよみこむ" onBack={()=>{vibrateLight();setView('hub');}}/>
        <div style={{flex:1,padding:'20px 14px 40px',maxWidth:480,margin:'0 auto',width:'100%',position:'relative',zIndex:1,display:'flex',flexDirection:'column',gap:12}}>
  
          {(scanPhase==='idle'||scanPhase==='error') && (
            <>
              {scanPhase==='error' ? (
                <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                  style={{borderRadius:24,padding:'32px 20px',textAlign:'center',background:'rgba(255,255,255,0.82)',border:`2px solid ${AC.red}88`,boxShadow:`0 4px 0 ${AC.red}44`}}
                >
                  <div style={{fontSize:48,marginBottom:12}}>😢</div>
                  <div style={{fontSize:14,fontWeight:900,color:AC.red,marginBottom:16}}>{error}</div>
                  <AcBtn label="もう一度試す" emoji="🔄" from={AC.teal} shadow="#4aaa96" onClick={()=>setScanPhase('idle')}/>
                </motion.div>
              ) : (
                <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                  style={{borderRadius:24,overflow:'hidden',background:'rgba(255,255,255,0.82)',border:`2px dashed ${AC.sand}`,boxShadow:`0 4px 0 ${AC.sand}`}}
                >
                  {/* ドロップゾーン */}
                  <div
                    style={{padding:'40px 20px',textAlign:'center',cursor:'pointer'}}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)handleFileSelect(f);}}
                    onClick={()=>{if(Date.now()<ignoreFilePickerUntilRef.current)return;fileInputRef.current?.click();}}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e=>{const f=e.target.files?.[0];if(f)handleFileSelect(f);e.target.value='';}}/>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e=>{ignoreFilePickerUntilRef.current=Date.now()+SUPPRESS_FILE_PICKER_MS;const f=e.target.files?.[0];if(f)handleFileSelect(f);e.target.value='';}}/>
                    <motion.div style={{fontSize:56,marginBottom:12}}
                      animate={{y:[0,-8,0]}} transition={{duration:2.4,repeat:Infinity,ease:'easeInOut'}}
                    >📷</motion.div>
                    <div style={{fontSize:15,fontWeight:900,color:AC.text,marginBottom:4}}>画像をアップロード</div>
                    <div style={{fontSize:12,color:AC.muted}}>タップまたはドラッグ＆ドロップ</div>
                  </div>
  
                  {/* 注意書き */}
                  <div style={{margin:'0 16px 16px',padding:'10px 14px',borderRadius:14,background:`${AC.yellow}44`,border:`1.5px solid ${AC.amber}88`,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>⚠️</span>
                    <span style={{fontSize:11,fontWeight:700,color:AC.brown}}>1ページずつスキャンしてください</span>
                  </div>
  
                  {/* カメラボタン */}
                  <div style={{padding:'0 16px 16px'}}>
                    <AcBtn label="カメラで撮影" emoji="📸" from={AC.green} shadow={AC.darkGreen}
                      onClick={()=>{ignoreFilePickerUntilRef.current=Date.now()+SUPPRESS_FILE_PICKER_MS;cameraInputRef.current?.click();}}/>
                  </div>
                </motion.div>
              )}
            </>
          )}
  
          {(scanPhase==='uploading'||scanPhase==='processing') && (
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
              style={{borderRadius:24,padding:'32px 20px',textAlign:'center',background:'rgba(255,255,255,0.82)',border:`2px solid ${AC.sand}`,boxShadow:`0 4px 0 ${AC.sand}`}}
            >
              {selectedImage && (
                <div style={{width:120,height:120,margin:'0 auto 20px',borderRadius:16,overflow:'hidden',border:`3px solid ${AC.sand}`,boxShadow:`0 4px 0 ${AC.sand}`}}>
                  <img src={selectedImage} alt="Selected" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
              )}
              <motion.div style={{fontSize:42,marginBottom:12}}
                animate={{rotate:[0,10,-10,0]}} transition={{duration:1.2,repeat:Infinity,ease:'easeInOut'}}
              >📖</motion.div>
              <div style={{fontSize:14,fontWeight:900,color:AC.text,marginBottom:16}}>{progressLabel}</div>
              <div style={{height:12,borderRadius:99,background:AC.tan,border:`1.5px solid ${AC.sand}`,overflow:'hidden',marginBottom:8}}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${displayProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg,${AC.amber},${AC.leaf})`, boxShadow: `0 0 8px ${AC.amber}77` }}
                />
              </div>
              <div style={{fontSize:12,fontWeight:900,color:AC.muted}}>{displayProgress}%</div>
            </motion.div>
          )}
        </div>
      </AcPage>
    );
  }

  if (view === 'result') {
    const hasCaptured=capturedWords.length>0;
    const perfectRound=misses===0&&defeatedCount>0;
    return (
      <AcPage>
        <AcHeader title="リザルト" sub="せんとうしゅうりょう" onBack={()=>{setView('hub');setSelectedScanId(null);}}/>
        <div style={{flex:1,padding:'16px 14px 80px',maxWidth:480,margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',gap:12,position:'relative',zIndex:1,overflowY:'auto'}}>
  
          {/* 紙吹雪 */}
          {perfectRound && [...Array(10)].map((_,i)=>(
            <motion.div key={i} style={{position:'fixed',top:-20,left:`${8+i*9}%`,width:7+i%3*3,height:7+i%3*3,borderRadius:2,background:[AC.yellow,AC.leaf,AC.teal,AC.amber,AC.blue][i%5],pointerEvents:'none',zIndex:0}}
              animate={{y:['0vh','110vh'],rotate:[0,360*2],opacity:[1,1,0]}}
              transition={{duration:2+i*0.25,delay:i*0.12,ease:'easeIn'}}
            />
          ))}
  
          {/* ヒーローカード */}
          <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{type:'spring',stiffness:220,delay:0.1}}
            style={{
              borderRadius:24,padding:'20px 20px 16px',textAlign:'center',
              background:perfectRound?`linear-gradient(135deg,${AC.yellow}55,rgba(255,255,255,0.92))`:'rgba(255,255,255,0.87)',
              border:`3px solid ${perfectRound?AC.amber:AC.sand}`,
              boxShadow:perfectRound?`0 6px 0 #c07800aa,0 10px 28px ${AC.amber}44`:`0 5px 0 ${AC.sand}`,
            }}
          >
            <motion.div style={{fontSize:64,lineHeight:1,marginBottom:8}}
              animate={perfectRound?{rotate:[0,-10,10,-8,8,0]}:{}}
              transition={{duration:0.7,delay:0.4}}
            >
              {perfectRound?'🏆':hasCaptured?'⭐':'⭐'}
            </motion.div>
            <div style={{fontSize:22,fontWeight:900,color:perfectRound?AC.brown:AC.text,marginBottom:4}}>
              {perfectRound?'かんぺき！':hasCaptured?'結果だよ':'結果発表'}
            </div>
  
            {/* スコア3列 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:12}}>
              {[
                {emoji:'🔮',label:'捕獲',val:capturedWords.length,color:AC.amber},
                {emoji:'⚔️',label:'撃破',val:displayDefeatedCount,color:AC.teal},
                {emoji:'💧',label:'ミス',val:misses,color:misses===0?AC.green:AC.red},
              ].map((stat,i)=>(
                <motion.div key={i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.2+i*0.08}}
                  style={{borderRadius:14,padding:'10px 6px 8px',background:`${stat.color}22`,border:`2px solid ${stat.color}55`,boxShadow:`0 3px 0 ${stat.color}44`}}
                >
                  <div style={{fontSize:20}}>{stat.emoji}</div>
                  <div style={{fontSize:22,fontWeight:900,color:AC.text,margin:'2px 0'}}>{stat.val}</div>
                  <div style={{fontSize:9,fontWeight:900,color:AC.muted,letterSpacing:'0.1em'}}>{stat.label}</div>
                </motion.div>
              ))}
            </div>
  
            {/* 報酬バッジ */}
            <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:12,flexWrap:'wrap'}}>
              <motion.span initial={{scale:0}} animate={{scale:1}} transition={{delay:0.45,type:'spring',stiffness:300}}
                style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:900,padding:'6px 14px',borderRadius:99,background:`${AC.yellow}55`,border:`2px solid ${AC.amber}`,color:AC.brown,boxShadow:`0 2px 0 ${AC.amber}77`}}
              >🪙 +{earnedCoins} コイン</motion.span>
              <motion.span initial={{scale:0}} animate={{scale:1}} transition={{delay:0.52,type:'spring',stiffness:300}}
                style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:900,padding:'6px 14px',borderRadius:99,background:`${AC.leaf}33`,border:`2px solid ${AC.leaf}`,color:AC.darkGreen,boxShadow:`0 2px 0 ${AC.darkGreen}55`}}
              >🍃 +{earnedLeaves} ことの葉</motion.span>
            </div>
          </motion.div>
  
          {/* 捕獲漢字 */}
          {hasCaptured && (
            <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
              style={{borderRadius:20,overflow:'hidden',background:'rgba(255,255,255,0.82)',border:`2px solid ${AC.amber}88`,boxShadow:`0 4px 0 ${AC.amber}44`}}
            >
              <div style={{padding:'9px 14px 7px',borderBottom:`1px solid ${AC.sand}`,background:`${AC.amber}22`,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:15}}>✨</span>
                <span style={{fontSize:11,fontWeight:900,color:AC.brown,letterSpacing:'0.1em'}}>新たに捕獲！</span>
                <span style={{marginLeft:'auto',fontSize:11,fontWeight:900,padding:'2px 10px',borderRadius:99,background:AC.amber,color:'#fff',boxShadow:`0 2px 0 #c07800`}}>{capturedWords.length}体</span>
              </div>
              <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {capturedWords.slice(0,4).map((w,i)=>(
                  <motion.div key={w.term} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:0.35+i*0.07}}
                    style={{borderRadius:14,padding:'10px 12px',background:`linear-gradient(135deg,${AC.yellow}22,rgba(255,255,255,0.7))`,border:`2px solid ${AC.amber}55`,boxShadow:`0 3px 0 ${AC.amber}33`,display:'flex',alignItems:'center',gap:10}}
                  >
                    <div style={{width:44,height:44,borderRadius:12,background:`${AC.amber}33`,border:`2px solid ${AC.amber}88`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,fontFamily:'serif',color:AC.brown,flexShrink:0}}>
                      {w.term}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:AC.muted}}>よみ：{normalizeReading(w.reading)||w.reading}</div>
                      <div style={{fontSize:12,fontWeight:700,color:AC.text,lineHeight:1.4}}>{w.meaning||'—'}</div>
                    </div>
                    <motion.div initial={{scale:0,rotate:-20}} animate={{scale:1,rotate:-12}} transition={{delay:0.4+i*0.07,type:'spring',stiffness:400}}
                      style={{width:26,height:26,borderRadius:'50%',background:AC.amber,border:'2px solid #fff',boxShadow:`0 2px 6px ${AC.amber}88`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}
                    >⭐</motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
  
          {/* 撃破単語 */}
          {defeatedWords.length > 0 && (
            <div style={{borderRadius:20,background:'rgba(255,255,255,0.72)',border:`2px solid ${AC.sand}`,boxShadow:`0 3px 0 ${AC.sand}`,overflow:'hidden'}}>
              <div style={{padding:'8px 14px 6px',borderBottom:`1px solid ${AC.sand}`,background:`${AC.teal}22`,display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:13}}>⚔️</span>
                <span style={{fontSize:11,fontWeight:900,color:AC.darkGreen,letterSpacing:'0.1em'}}>撃破した単語</span>
              </div>
              <div style={{padding:'10px 12px',display:'flex',flexWrap:'wrap',gap:6}}>
                {defeatedWords.slice(0,8).map(w=>(
                  <span key={w.term} style={{fontSize:13,fontWeight:900,padding:'5px 12px',borderRadius:99,background:`${AC.teal}33`,border:`1.5px solid ${AC.teal}`,color:AC.darkGreen,boxShadow:`0 2px 0 ${AC.teal}55`}}>
                    {w.term}
                    <span style={{fontSize:10,color:AC.muted,marginLeft:4}}>（{normalizeReading(w.reading)||w.reading}）</span>
                  </span>
                ))}
              </div>
            </div>
          )}
  
          {/* ミス一覧 */}
          {missedWords.length > 0 ? (
            <div style={{borderRadius:20,background:'rgba(255,255,255,0.72)',border:`2px solid ${AC.sand}`,boxShadow:`0 3px 0 ${AC.sand}`,overflow:'hidden'}}>
              <button type="button" onClick={()=>{vibrateLight();setMissedListOpen(o=>!o);}}
                style={{width:'100%',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',background:`rgba(224,85,85,0.1)`,border:'none',cursor:'pointer',WebkitTapHighlightColor:'transparent',borderBottom:missedListOpen?`1px solid ${AC.sand}`:'none'}}
              >
                <span style={{fontSize:12,fontWeight:900,color:AC.red,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:14}}>💧</span>ミスした単語（{missedWords.length}体）
                </span>
                <motion.span animate={{rotate:missedListOpen?180:0}} style={{color:AC.muted}}>▼</motion.span>
              </button>
              <AnimatePresence>
                {missedListOpen && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden'}}>
                    <div style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:6}}>
                      {missedWords.map(({word,missCount})=>(
                        <div key={word.term} style={{borderRadius:12,padding:'8px 12px',background:'rgba(224,85,85,0.08)',border:'1.5px solid rgba(224,85,85,0.25)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <div>
                            <span style={{fontSize:15,fontWeight:900,color:AC.text}}>{word.term}</span>
                            <span style={{fontSize:11,color:AC.muted,marginLeft:6}}>（{normalizeReading(word.reading)||word.reading}）</span>
                            <div style={{fontSize:11,color:AC.text,marginTop:2}}>{word.meaning||'—'}</div>
                          </div>
                          {missCount>1&&<span style={{fontSize:12,fontWeight:900,color:AC.red,flexShrink:0}}>×{missCount}</span>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div style={{textAlign:'center',fontSize:13,fontWeight:700,color:AC.green,padding:'4px 0'}}>
              🍀 取り逃がしなし！すごい！
            </div>
          )}
  
          {/* アクションボタン */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <AcBtn label="続けて探索する" emoji="⚔️" from={AC.amber} shadow="#c07800"
              onClick={()=>selectedScanId&&startQuest(selectedScanId,'explore')}/>
            <AcBtn label="再戦する" emoji="🔁" from={AC.teal} shadow="#4aaa96"
              onClick={()=>selectedScanId&&startQuest(selectedScanId,'retry',retryPriorityTerms.length>0?retryPriorityTerms:askedTerms)}/>
            <AcBtn label="拠点へもどる" emoji="🏠" from={AC.muted} shadow={AC.brown}
              onClick={()=>{setView('hub');setSelectedScanId(null);}}/>
          </div>
        </div>
      </AcPage>
    );
  }

  // ==========================================
  // Battle View
  // ==========================================
  if (!current) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">問題がありません</div>;
  }

  return (
    <div className="fixed inset-0 h-[100dvh] overflow-hidden bg-gradient-to-b from-[#0a0e17] to-[#0d1321]">
      <style jsx global>{`
        html, body { height: 100%; }
        @keyframes sealGlow {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .animate-word-seal-glow { animation: sealGlow 0.9s ease-in-out both; filter: blur(8px); }
        @keyframes absorbToCard {
          0% { transform: translateX(0) translateY(0) scale(1); opacity: 1; filter: blur(0); }
          35% { transform: translateX(14px) translateY(-2px) scale(0.82); opacity: 0.75; filter: blur(0.1px); }
          70% { transform: translateX(28px) translateY(-4px) scale(0.5); opacity: 0.35; filter: blur(0.35px); }
          100% { transform: translateX(42px) translateY(-6px) scale(0.18); opacity: 0; filter: blur(0.8px); }
        }
        .animate-absorb-to-card { animation: absorbToCard 0.62s ease-in forwards; transform-origin: center; }
      `}</style>
      <button
        onClick={() => {
          vibrateLight();
          unlockScroll();
          setView('hub');
        }}
        className="fixed top-4 left-4 z-30 flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm"
      >
        <ChevronLeft className="w-4 h-4" /> やめる
      </button>

      <div
        className="absolute inset-0 flex min-h-0 items-center justify-center overflow-y-auto p-2 sm:p-4"
        style={{
          paddingBottom: keyboardInset > 0 ? `${keyboardInset + 8}px` : undefined,
        }}
      >
        {/* 縦溢出防止: aspect 9:16 と max-h。封印札軌道は戦闘エリアを測って単語中央へ */}
        <div
          className="relative mx-auto box-border flex aspect-[9/16] h-auto max-h-[calc(100dvh-6rem)] w-[min(400px,calc(100vw-2rem))] max-w-[min(400px,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-gray-800 to-gray-900 p-2 shadow-[0_0_0_4px_rgba(55,65,81,0.8),0_0_0_8px_rgba(31,41,55,0.6),0_25px_50px_-12px_rgba(0,0,0,0.6)] sm:rounded-[2rem] sm:p-3"
        >
          <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl sm:rounded-[1.25rem] bg-transparent">
            <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-black/60"><motion.div className={`${isTimeWarning ? 'bg-red-600' : 'bg-amber-500'} h-full`} animate={{ width: `${timeElapsedBarPct}%` }} transition={{ duration: 0.2 }} /></div>
            
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/images/backgrounds/forest.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="absolute inset-0 z-0 bg-black/30" />
              <div className="absolute top-4 left-3 z-20 rounded-md border-2 border-amber-700/80 bg-black/60 px-3 py-1.5 shadow-lg"><div className="text-amber-200 font-mono text-xs tracking-widest">{current.term}</div></div>
              <div className="absolute top-4 right-3 z-20 flex items-center gap-2"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isTimeWarning ? 'bg-red-900/60 text-red-400' : 'bg-black/40 text-amber-300'}`}>{Math.max(0, Math.round(timeLeft * 2) / 2)}s</span></div>
              
              <div ref={battleArenaRef} className="relative flex-1 flex items-center justify-center pt-8 pb-2 z-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${idx}-${current.term}`}
                    animate={{ y: (1 - timeLeft / TIME_LIMIT_SEC) * 20, scale: 1 + (1 - timeLeft / TIME_LIMIT_SEC) * 0.25 }}
                    transition={{ duration: 0.2 }}
                    className={`text-3xl font-bold text-white tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${hitType === 'shake' ? 'animate-pulse' : ''}`}
                  >
                    {hitType === 'split' ? (
                      <div className="flex items-center justify-center gap-1">
                        <motion.span
                          initial={{ x: 0, opacity: 1 }}
                          animate={{ x: -12, opacity: 0.96 }}
                          transition={{ delay: SEAL_CARD_OK_IMPACT_AT, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                        >
                          {current.term.slice(0, Math.ceil(current.term.length / 2))}
                        </motion.span>
                        <motion.span
                          initial={{ x: 0, opacity: 1 }}
                          animate={{ x: 12, opacity: 0.96 }}
                          transition={{ delay: SEAL_CARD_OK_IMPACT_AT, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                        >
                          {current.term.slice(Math.ceil(current.term.length / 2))}
                        </motion.span>
                      </div>
                    ) : (
                      <span className={hitType === 'seal' && sealPhase === 'seal' ? 'animate-absorb-to-card' : undefined}>{current.term}</span>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* 封印リング */}
                {hitType === 'seal' && sealPhase === 'seal' && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.25, 0.8], opacity: [0, 0.9, 0] }} transition={{ duration: 0.34, ease: 'easeOut' }} className="absolute w-20 h-20 rounded-full bg-cyan-400/30 blur-lg" />
                    <motion.svg className="absolute overflow-visible" width="120" height="120" viewBox="0 0 100 100" fill="none" initial={{ opacity: 0, scale: 0.5, rotate: -45 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1.08, 0.9], rotate: [-45, 0, 8, 0] }} transition={{ duration: 0.42, times: [0, 0.25, 0.72, 1], ease: 'easeOut' }}>
                      <motion.circle cx="50" cy="50" r="45" stroke="rgba(100, 210, 255, 0.5)" strokeWidth="0.8" strokeDasharray="2 6" initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: -180, opacity: [0, 1, 0] }} transition={{ duration: 0.28, ease: 'easeOut' }} />
                      <motion.circle cx="50" cy="50" r="36" stroke="rgba(120, 230, 255, 0.8)" strokeWidth="2" strokeDasharray="25 10" style={{ filter: 'drop-shadow(0 0 2px rgba(0, 150, 255, 0.9))' }} initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 220, opacity: [0, 1, 0] }} transition={{ duration: 0.32, ease: 'easeOut' }} />
                      <motion.path d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z" stroke="rgba(150, 240, 255, 0.6)" strokeWidth="1" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 0] }} transition={{ duration: 0.28, delay: 0.04, ease: 'easeOut' }} />
                      <motion.circle cx="50" cy="50" r="12" stroke="white" strokeWidth="2.5" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: [1.5, 1, 0.7], opacity: [0, 1, 0] }} transition={{ duration: 0.3, ease: 'easeOut' }} style={{ filter: 'drop-shadow(0 0 4px #fff)' }} />
                    </motion.svg>
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 0.7], opacity: [0, 1, 0] }} transition={{ duration: 0.28, times: [0, 0.45, 1], ease: 'easeOut' }} className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_15px_3px_rgba(255,255,255,0.9)]" />
                  </div>
                )}

                <AnimatePresence>
                  {cardThrow && (
                    <motion.div key={cardThrow.key} className="absolute inset-0 pointer-events-none overflow-visible" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.div
                        className="absolute"
                        style={{ right: '8%', bottom: '12%', width: '2.4rem', height: '3.8rem' }}
                        initial={{ x: 0, y: 0, rotateZ: 0, rotateY: 0, opacity: 1, scale: 0.92, filter: 'blur(0px)' }}
                        animate={
                          cardThrow.isCorrect
                            ? {
                                x: cardThrow.kf.ok.x,
                                y: cardThrow.kf.ok.y,
                                rotateZ: [0, 520, 680],
                                rotateY: [0, 18, 24],
                                opacity: [1, 1, 0],
                                scale: [0.92, 1.05, 0.9],
                                filter: ['blur(0px)', 'blur(0px)', 'blur(0.35px)'],
                              }
                            : {
                                x: cardThrow.kf.miss.x,
                                y: cardThrow.kf.miss.y,
                                rotateZ: [0, 520, 240, -20],
                                rotateY: [0, 18, 8, -3],
                                opacity: [1, 1, 0.9, 0],
                                scale: [0.92, 1.05, 0.96, 0.86],
                                filter: ['blur(0px)', 'blur(0px)', 'blur(0.15px)', 'blur(0.55px)'],
                              }
                        }
                        transition={{ duration: cardThrow.isCorrect ? 0.48 : 0.62, ease: 'linear', times: cardThrow.isCorrect ? [0, 0.78, 1] : [0, 0.48, 0.76, 1] }}
                      >
                        <img src="/cards/seal-card.svg" className="w-full h-full object-contain" alt="seal" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div
              className="relative shrink-0 border-t-2 border-amber-900/60 p-3 overflow-hidden"
              style={{
                transform: keyboardInset > 0 ? `translateY(-${Math.min(120, keyboardInset * 0.35)}px)` : undefined,
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: "url('/images/backgrounds/forest.png')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center bottom',
                }}
              />
              <div className="relative z-10 min-h-[1.25rem] flex items-center justify-center mb-1">{battleLog && <p className="text-center text-xs text-amber-200/90">{battleLog}</p>}</div>
              <div className="relative z-10 space-y-2">
                <div className="text-[11px] text-gray-300 font-bold">次の漢字の読みを入力してください</div>
                <input
                  ref={answerInputRef}
                  value={answer}
                  onFocus={() => {
                  // Android Chromeの自動スクロールを最小化
                    setTimeout(() => window.scrollTo(0, 0), 0);
                  }}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={battleState === 'feedback'}
                  inputMode="text"
                  lang="ja"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-lg border-2 border-gray-600 bg-gray-800/90 px-3 py-2 text-base text-gray-100 outline-none"
                  placeholder="ひらがなで入力"
                />
                {battleState === 'feedback' ? (
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-xs text-gray-200">
                    <div className="flex items-center gap-2 mb-1">{lastCorrect ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}{lastCorrect ? '正解' : '不正解'}</div>
                    <div>読み: {current.reading}</div><div className="mt-1">意味: {current.meaning}</div><div className="mt-1 text-gray-300">{current.explanation}</div>
                  </div>
                ) : (
                  <button onClick={judge} disabled={!answer.trim()} className="w-full py-2.5 rounded-lg text-sm font-bold border-2 bg-gray-800/90 text-gray-200 border-gray-600 hover:border-amber-600/50 disabled:opacity-50">封印札を放つ</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}