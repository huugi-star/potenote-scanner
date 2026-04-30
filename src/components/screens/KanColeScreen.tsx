'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, Camera, AlertCircle, BookOpen, Sword, ChevronRight, CheckCircle, XCircle, ChevronDown, Coins } from 'lucide-react';
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
  const [cardThrow, setCardThrow] = useState<{ isCorrect: boolean; key: number } | null>(null);
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

  const [dexVolIndex, setDexVolIndex] = useState(0);
  const [dexTerm, setDexTerm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const ignoreFilePickerUntilRef = useRef(0);
  const SUPPRESS_FILE_PICKER_MS = 8000;

  const current = roundItems[idx];
  const timePct = Math.min(100, Math.max(0, (timeLeft / TIME_LIMIT_SEC) * 100));
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
    setProgress(3);
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
      setCardThrow({ isCorrect: true, key: Date.now() });
    } else {
      vibrateError();
      updateKanColeEnemyState(selectedScanId, current.term, { asked: true, wrongCount: (current.wrongCount ?? 0) + 1 });
      recordWrong(current);
      setMisses((m) => m + 1);
      setLastSealed(false);
      setBattleLog('はじかれた…');
      setHitType('shake');
      setCardThrow({ isCorrect: false, key: Date.now() });
      setMissedWords((prev) => {
        const found = prev.find((x) => x.word.term === current.term);
        if (!found) return [...prev, { word: current, missCount: 1 }];
        return prev.map((x) => (x.word.term === current.term ? { ...x, missCount: x.missCount + 1 } : x));
      });
    }
    setBattleState('feedback');
  }, [answer, battleState, current, selectedScanId, updateKanColeEnemyState, markCorrect, recordWrong]);

  // 2回目正解（封印）時のリング/吸い込み演出
  useEffect(() => {
    if (view !== 'battle') return;
    if (battleState !== 'feedback') return;
    if (hitType !== 'seal') return;
    if (!cardThrow?.isCorrect) return;

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
    // 封印（2回目正解）は吸い込み完了後すぐ次へ。通常は解説を少し長めに見せる。
    const delayMs = lastSealed ? 1250 : 1500;
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

  // hub
  if (view === 'hub') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white p-4">
        <div className="max-w-lg mx-auto pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => { vibrateLight(); onBack(); }} className="flex items-center gap-1 text-gray-400 hover:text-white"><ChevronLeft className="w-5 h-5" />戻る</button>
            <h1 className="text-xl font-bold">漢コレ拠点</h1>
            <div className="w-16" />
          </div>
          <button onClick={() => { vibrateLight(); setScanPhase('idle'); setView('scan'); }} className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2">
            <Camera className="w-5 h-5" /> 新しい本文をスキャン
          </button>
          <button onClick={() => { vibrateLight(); setView('log'); }} className="w-full rounded-xl border border-gray-600/80 bg-gray-800/60 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3"><BookOpen className="w-5 h-5 text-amber-400" /><div><p className="font-bold">冒険ログ</p><p className="text-xs text-gray-500">{kanColeScans.length}件</p></div></div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
          <button
            onClick={() => {
              vibrateLight();
              setDexTerm(null);
              setDexVolIndex(0);
              setView('dex');
            }}
            className="w-full rounded-xl border border-gray-600/80 bg-gray-800/60 px-4 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <div>
                <p className="font-bold">漢字図鑑</p>
                <p className="text-xs text-gray-500">登録 {kanDexOrder.length}件</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  if (view === 'dex') {
    return (
      <KanDexScreen
        kanDexOrder={kanDexOrder}
        scans={kanColeScans}
        onSelectVol={(volIndex) => {
          setDexVolIndex(volIndex);
          setView('dexVol');
        }}
        onBack={() => setView('hub')}
      />
    );
  }

  if (view === 'dexVol') {
    return (
      <KanDexVolScreen
        volIndex={dexVolIndex}
        kanDexOrder={kanDexOrder}
        scans={kanColeScans}
        onSelectTerm={(term) => {
          setDexTerm(term);
          setView('dexDetail');
        }}
        onBack={() => setView('dex')}
      />
    );
  }

  if (view === 'dexDetail' && dexTerm) {
    const dexNo = Math.max(1, kanDexOrder.indexOf(dexTerm) + 1);
    return (
      <KanDexDetailScreen term={dexTerm} dexNo={dexNo} scans={kanColeScans} onBack={() => setView('dexVol')} />
    );
  }

  if (view === 'log') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white p-4">
        <div className="max-w-lg mx-auto pt-4">
          <button onClick={() => { vibrateLight(); setView('hub'); }} className="flex items-center gap-1 text-gray-400 hover:text-white mb-4"><ChevronLeft className="w-5 h-5" />戻る</button>
          {scansForDisplay.length === 0 ? (
            <div className="text-center text-gray-500 py-10">まだ冒険ログがありません</div>
          ) : (
            <div className="space-y-3">
              {scansForDisplay.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-600/80 bg-gray-800/70 p-4">
                  <div className="font-bold mb-2">{s.title}</div>
                  <div className="text-xs text-gray-300 mb-3">捕獲 {s.captured}/{s.total} ・ 撃破 {s.defeated} ・ 残り {s.remaining}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { vibrateLight(); startQuest(s.id, 'explore'); }} className="py-2 rounded-lg bg-amber-600 text-white text-sm font-bold">続きを探索</button>
                    <button onClick={() => { vibrateLight(); startQuest(s.id, 'retry'); }} className="py-2 rounded-lg border border-gray-500 text-gray-200 text-sm font-bold">再戦する</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'scan') {
    const displayProgress = Math.min(100, Math.max(0, Math.round(progress)));
    return (
      <div className="min-h-screen p-4 relative overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-md mx-auto pt-4 pb-4">
          <button onClick={() => { vibrateLight(); setView('hub'); }} className="flex items-center gap-1 text-gray-400 hover:text-white mb-4"><ChevronLeft className="w-5 h-5" />戻る</button>
          {(scanPhase === 'idle' || scanPhase === 'error') && (
            <div className="space-y-3">
              {scanPhase === 'error' ? (
                <div className="text-center py-8"><div className="text-red-300 mb-4">{error}</div><button onClick={() => setScanPhase('idle')} className="px-6 py-3 rounded-xl bg-gray-700 text-white font-bold">やり直す</button></div>
              ) : (
                <div className="relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors border-gray-600 hover:border-slate-300 cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f); }}
                  onClick={() => { if (Date.now() < ignoreFilePickerUntilRef.current) return; fileInputRef.current?.click(); }}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { ignoreFilePickerUntilRef.current = Date.now() + SUPPRESS_FILE_PICKER_MS; const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-200/15 flex items-center justify-center"><Camera className="w-8 h-8 text-slate-200" /></div>
                  <div className="text-white font-bold mb-2">画像をアップロード</div>
                  <div className="text-gray-400 text-sm">タップまたはドラッグ＆ドロップ</div>
                  <div className="mt-4 p-3 bg-slate-200/10 border border-slate-200/20 rounded-lg"><p className="text-slate-200 text-xs font-medium flex items-center justify-center gap-1"><AlertCircle className="w-3.5 h-3.5" />1ページずつスキャンしてください</p></div>
                </div>
              )}
            </div>
          )}
          {(scanPhase === 'uploading' || scanPhase === 'processing') && (
            <div className="text-center py-12 space-y-6">
              {selectedImage && <div className="w-48 h-48 mx-auto rounded-xl overflow-hidden border-2 border-slate-200/30"><img src={selectedImage} alt="Selected" className="w-full h-full object-cover" /></div>}
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between text-sm text-slate-200 mb-2 px-4"><span>{progressLabel}</span><span>{displayProgress}%</span></div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-slate-200/20"><div className="h-full bg-gradient-to-r from-slate-200 via-slate-100 to-white transition-[width] duration-300 ease-out" style={{ width: `${displayProgress}%` }} /></div>
              </div>
              <Loader2 className="w-12 h-12 text-slate-200 mx-auto animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'result') {
    const hasCaptured = capturedWords.length > 0;
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e17] via-[#0d1321] to-[#0a0e17] text-white p-4">
        <div className="max-w-md mx-auto pt-4 space-y-4">
          <section className="mb-2">
            <h2 className="text-base font-bold text-amber-400 mb-1">⚔ 戦闘終了！</h2>
            {hasCaptured && (
              <p className="text-4xl font-extrabold text-amber-300 mb-1">
                捕獲 <span className="text-5xl">{capturedWords.length}</span> 体
              </p>
            )}
            <p className="text-2xl font-bold text-gray-100">
              撃破 <span className="text-3xl text-gray-100">{displayDefeatedCount}</span> 回
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-sm font-semibold text-amber-300">
              <Coins className="w-4 h-4" />
              今回獲得 +{earnedCoins} コイン
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-300 ml-2">
              今回獲得 +{earnedLeaves} ことの葉
            </p>
            {misses > 0 && <p className="text-sm text-gray-200 mt-1">ミス {misses}回</p>}
          </section>

          {hasCaptured && (
            <section className="mb-4">
              <h3 className="text-lg font-extrabold text-amber-400 mb-3">✨ 新たに捕獲！</h3>
              <div className="space-y-2">
                {capturedWords.slice(0, 3).map((w) => (
                  <div key={w.term} className="relative rounded-xl border-2 border-amber-300/30 bg-gradient-to-b from-amber-200/6 to-amber-700/4 px-5 pt-5 pb-4">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-200/50 via-amber-300/40 to-transparent opacity-90" />
                    <div className="text-amber-300 text-sm font-bold mb-1">★ GET</div>
                    <div className="font-mono font-extrabold text-amber-200 text-xl tracking-wider">{w.term}</div>
                    <div className="text-amber-200/80 text-xs mt-0.5">よみ: {w.reading}</div>
                    <div className="text-gray-100 text-sm mt-0.5">— {w.meaning || '—'}</div>
                    <div className="text-gray-400 text-[11px] mt-1">★ 図鑑登録</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {defeatedWords.length > 0 && (
            <section className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">⚔ 撃破した単語</p>
              <div className="space-y-2">
                {defeatedWords.slice(0, 5).map((w) => (
                  <div key={w.term} className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-gray-800/80 to-gray-900/80 text-center px-3 py-2">
                    <p className="font-mono font-bold text-amber-200 uppercase tracking-wider text-sm">{w.term}</p>
                    <p className="text-amber-200/80 mt-0.5 text-[10px]">よみ: {w.reading}</p>
                    <p className="text-gray-100 mt-1 text-[10px]">— {w.meaning || '—'}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {missedWords.length > 0 ? (
            <section className="mb-5">
              <button
                onClick={() => {
                  vibrateLight();
                  setMissedListOpen((o) => !o);
                }}
                className="w-full flex items-center justify-between py-2 text-left text-sm text-gray-100"
              >
                <span>▼ ミスした単語（{missedWords.length}体）</span>
                <motion.span animate={{ rotate: missedListOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4" />
                </motion.span>
              </button>
              <AnimatePresence>
                {missedListOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-1.5">
                      {missedWords.map(({ word, missCount }) => (
                        <div key={word.term} className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-amber-200/80 text-sm uppercase">{word.term}</span>
                            <span className="text-amber-200/75 text-xs ml-2">（{word.reading}）</span>
                            <span className="text-gray-200 text-xs ml-2">— {word.meaning || '—'}</span>
                          </div>
                          {missCount > 1 && <span className="text-orange-400/80 text-xs shrink-0">×{missCount}</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-gray-200 text-xs mt-2">次の探索ではミスした単語が優先的に出現します</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          ) : (
            <section className="mb-5">
              <p className="text-center text-amber-500/70 text-sm">取り逃がしなし！</p>
            </section>
          )}

          <button onClick={() => selectedScanId && startQuest(selectedScanId, 'explore')} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2"><Sword className="w-4 h-4" />続けて探索する</button>
          <button onClick={() => selectedScanId && startQuest(selectedScanId, 'retry', retryPriorityTerms.length > 0 ? retryPriorityTerms : askedTerms)} className="w-full py-3 rounded-xl border border-gray-600 text-gray-300 font-bold">再戦する</button>
          <button onClick={() => { setView('hub'); setSelectedScanId(null); }} className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-400">拠点へ戻る</button>
        </div>
      </div>
    );
  }

  // battle
  if (!current) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">問題がありません</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0e17] to-[#0d1321] p-4">
      <style jsx global>{`
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
      <button onClick={() => { vibrateLight(); setView('hub'); }} className="absolute top-4 left-4 z-20 flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm"><ChevronLeft className="w-4 h-4" />やめる</button>
      <div className="relative w-full max-w-[min(360px,90vw)] aspect-[9/16] rounded-[2rem] p-3 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_0_0_4px_rgba(55,65,81,0.8),0_0_0_8px_rgba(31,41,55,0.6),0_25px_50px_-12px_rgba(0,0,0,0.6)]">
        <div className="relative w-full h-full rounded-[1.25rem] overflow-hidden bg-transparent flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-black/60"><motion.div className={`${isTimeWarning ? 'bg-red-600' : 'bg-amber-500'} h-full`} animate={{ width: `${timePct}%` }} transition={{ duration: 0.2 }} /></div>
          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="absolute inset-0 z-0" style={{ backgroundImage: "url('/images/backgrounds/forest.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute inset-0 z-0 bg-black/30" />
            <div className="absolute top-6 left-3 z-20 rounded-md border-2 border-amber-700/80 bg-black/60 px-3 py-2 shadow-lg"><div className="text-amber-200 font-mono text-xs tracking-widest">{current.term}</div></div>
            <div className="absolute top-6 right-3 z-20 flex items-center gap-2"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isTimeWarning ? 'bg-red-900/60 text-red-400' : 'bg-black/40 text-amber-300'}`}>{Math.max(0, Math.round(timeLeft * 2) / 2)}s</span></div>
            <div className="relative flex-1 flex items-center justify-center pt-8 pb-2 z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${idx}-${current.term}`}
                  animate={{ y: (1 - timeLeft / TIME_LIMIT_SEC) * 20, scale: 1 + (1 - timeLeft / TIME_LIMIT_SEC) * 0.25 }}
                  transition={{ duration: 0.2 }}
                  className={`text-3xl font-bold text-white tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
                    hitType === 'shake' ? 'animate-pulse' : ''
                  }`}
                >
                  {hitType === 'split' ? (
                    <div className="flex items-center justify-center gap-1">
                      <motion.span
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: -12, opacity: 0.96 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      >
                        {current.term.slice(0, Math.ceil(current.term.length / 2))}
                      </motion.span>
                      <motion.span
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: 12, opacity: 0.96 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      >
                        {current.term.slice(Math.ceil(current.term.length / 2))}
                      </motion.span>
                    </div>
                  ) : (
                    <span className={hitType === 'seal' && sealPhase === 'seal' ? 'animate-absorb-to-card' : undefined}>
                      {current.term}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* 封印リング（2回目正解のみ） */}
              {hitType === 'seal' && sealPhase === 'seal' && (
  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
    {/* 背景の残光 */}
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: [0.3, 1.25, 0.8], opacity: [0, 0.9, 0] }}
      transition={{ duration: 0.34, ease: 'easeOut' }}
      className="absolute w-20 h-20 rounded-full bg-cyan-400/30 blur-lg"
    />

    <motion.svg
      className="absolute overflow-visible"
      width="120"
      height="120"
      viewBox="0 0 100 100"
      fill="none"
      initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 1.08, 0.9],
        rotate: [-45, 0, 8, 0],
      }}
      transition={{
        duration: 0.42,
        times: [0, 0.25, 0.72, 1],
        ease: 'easeOut',
      }}
    >
      {/* 外周リング：一瞬だけ回転 */}
      <motion.circle
        cx="50"
        cy="50"
        r="45"
        stroke="rgba(100, 210, 255, 0.5)"
        strokeWidth="0.8"
        strokeDasharray="2 6"
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: -180, opacity: [0, 1, 0] }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />

      {/* メイン魔法陣：一瞬だけ回転 */}
      <motion.circle
        cx="50"
        cy="50"
        r="36"
        stroke="rgba(120, 230, 255, 0.8)"
        strokeWidth="2"
        strokeDasharray="25 10"
        style={{ filter: 'drop-shadow(0 0 2px rgba(0, 150, 255, 0.9))' }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 220, opacity: [0, 1, 0] }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
      />

      {/* 幾何学模様 */}
      <motion.path
        d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z"
        stroke="rgba(150, 240, 255, 0.6)"
        strokeWidth="1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0, 1, 0] }}
        transition={{ duration: 0.28, delay: 0.04, ease: 'easeOut' }}
      />

      {/* 中心に収束する内円 */}
      <motion.circle
        cx="50"
        cy="50"
        r="12"
        stroke="white"
        strokeWidth="2.5"
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: [1.5, 1, 0.7], opacity: [0, 1, 0] }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(0 0 4px #fff)' }}
      />
    </motion.svg>

    {/* 中心部のコアフラッシュ */}
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.3, 0.7], opacity: [0, 1, 0] }}
      transition={{ duration: 0.28, times: [0, 0.45, 1], ease: 'easeOut' }}
      className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_15px_3px_rgba(255,255,255,0.9)]"
    />
  </div>
)}

              <AnimatePresence>
                {cardThrow && (
                  <motion.div
                    key={cardThrow.key}
                    className="absolute inset-0 pointer-events-none overflow-visible"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="absolute"
                      style={{ right: '8%', bottom: '12%', width: '2.4rem', height: '3.8rem' }}
                      initial={{ x: 0, y: 0, rotateZ: 0, rotateY: 0, opacity: 1, scale: 0.92, filter: 'blur(0px)' }}
                      animate={
                        cardThrow.isCorrect
                          ? {
                              x: ['0px', '-105px', '-138px'],
                              y: ['0px', '-115px', '-140px'],
                              rotateZ: [0, 520, 680],
                              rotateY: [0, 18, 24],
                              opacity: [1, 1, 0],
                              scale: [0.92, 1.05, 0.9],
                              filter: ['blur(0px)', 'blur(0px)', 'blur(0.35px)'],
                            }
                          : {
                              x: ['0px', '-98px', '-52px', '8px'],
                              y: ['0px', '-118px', '-60px', '14px'],
                              rotateZ: [0, 520, 240, -20],
                              rotateY: [0, 18, 8, -3],
                              opacity: [1, 1, 0.9, 0],
                              scale: [0.92, 1.05, 0.96, 0.86],
                              filter: ['blur(0px)', 'blur(0px)', 'blur(0.15px)', 'blur(0.55px)'],
                            }
                      }
                      transition={{
                        duration: cardThrow.isCorrect ? 0.48 : 0.62,
                        ease: 'linear',
                        times: cardThrow.isCorrect ? [0, 0.78, 1] : [0, 0.48, 0.76, 1],
                      }}
                    >
                      <img src="/cards/seal-card.svg" className="w-full h-full object-contain" alt="seal" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="shrink-0 border-t-2 border-amber-900/60 bg-[#0a0e14] p-3">
            <div className="min-h-[1.25rem] flex items-center justify-center mb-2">{battleLog && <p className="text-center text-xs text-amber-200/90">{battleLog}</p>}</div>
            <div className="space-y-2">
              <div className="text-[11px] text-gray-300 font-bold">次の漢字の読みを入力してください</div>
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={battleState === 'feedback'} className="w-full rounded-lg border-2 border-gray-600 bg-gray-800/90 px-3 py-2 text-sm text-gray-100 outline-none" placeholder="ひらがなで入力" />
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
  );
}

