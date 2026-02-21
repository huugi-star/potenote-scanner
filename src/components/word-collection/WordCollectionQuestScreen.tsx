/**
 * WordCollectionQuestScreen.tsx
 *
 * 単コレ：クエスト戦闘（意味4択・テンポ重視）
 * 携帯機バトル画面風（ゲーム機フレーム＋戦闘フィールド＋コマンド）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { WordEnemy, WordCollectionScan } from '@/types';

const QUESTIONS_PER_ROUND = 7;
const TIME_LIMIT_SEC = 5.5;

// ===== Types =====

export type QuestMode = 'explore' | 'retry';

export interface MissedWord {
  word: WordEnemy;
  missCount: number;
}

export interface BattleResultData {
  capturedWords: WordEnemy[];
  defeatedWords: WordEnemy[];
  defeatedCount: number;
  misses: number;
  missedWords: MissedWord[];   // 取り逃がした単語（ミスした単語）
}

interface WordCollectionQuestScreenProps {
  scan: WordCollectionScan;
  questMode: QuestMode;
  onComplete: (result: BattleResultData) => void;
  onBack: () => void;
}

// ===== Selection Logic =====

function selectQuestions(scan: WordCollectionScan, questMode: QuestMode, dexWords: string[]): WordEnemy[] {
  const dexSet = new Set(dexWords);
  const withMeaning = scan.words.filter((w) => w.meaning && w.meaning.trim());
  if (withMeaning.length === 0) return [];

  const activeSet = new Set(scan.activeEnemyWords ?? []);
  const activeWords =
    activeSet.size > 0
      ? withMeaning.filter((w) => activeSet.has(w.word))
      : withMeaning;

  let pool: WordEnemy[];
  if (questMode === 'explore') {
    const unregistered = activeWords.filter((w) => w.hp > 0 && !dexSet.has(w.word));
    // 未登録を優先。ただし空なら未捕獲語でフォールバック（出題ゼロ回避）
    pool = unregistered.length > 0 ? unregistered : activeWords.filter((w) => w.hp > 0);
  } else {
    // 再戦でも捕獲済み（hp===0）は出題しない
    const unregistered = activeWords.filter((w) => w.hp > 0 && !dexSet.has(w.word));
    pool = unregistered.length > 0 ? unregistered : activeWords.filter((w) => w.hp > 0);
  }

  if (pool.length === 0) return [];

  const sorted = [...pool].sort((a, b) => {
    if (questMode === 'explore') {
      if (a.asked !== b.asked) return a.asked ? 1 : -1;
      if (a.hp !== b.hp) return b.hp - a.hp;
      if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
    } else {
      if (a.hp !== b.hp) return a.hp - b.hp;
      if (a.asked !== b.asked) return a.asked ? 1 : -1;
      if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
    }
    return Math.random() - 0.5;
  });

  const picked: WordEnemy[] = [];
  const used = new Set<string>();
  for (const w of sorted) {
    if (picked.length >= QUESTIONS_PER_ROUND) break;
    if (!used.has(w.word)) {
      used.add(w.word);
      picked.push(w);
    }
  }
  return picked;
}

// ===== 4-choice generation =====

function buildChoices(correct: WordEnemy, allWithMeaning: WordEnemy[]): string[] {
  const correctMeaning = correct.meaning!.trim();
  const others = allWithMeaning
    .filter((w) => w.word !== correct.word && w.meaning?.trim())
    .map((w) => w.meaning!.trim())
    .filter((m) => m !== correctMeaning);

  const wrongPool = [...new Set(others)];
  const wrong: string[] = [];
  while (wrong.length < 3) {
    if (wrongPool.length > 0) {
      const i = Math.floor(Math.random() * wrongPool.length);
      wrong.push(wrongPool.splice(i, 1)[0]);
    } else {
      wrong.push('（選択肢）');
    }
  }

  const choices = [correctMeaning, ...wrong];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

// ===== Main Component =====

export const WordCollectionQuestScreen = ({ scan, questMode, onComplete, onBack }: WordCollectionQuestScreenProps) => {
  const updateWordEnemyState = useGameStore((s) => s.updateWordEnemyState);
  const registerWordDexWords = useGameStore((s) => s.registerWordDexWords);
  const wordDexOrder = useGameStore((s) => s.wordDexOrder);

  // 選択肢は問題ごとに初期化時に固定（ストア更新で再生成されないようにする）
  const [questionsWithChoices] = useState(() => {
    const qs = selectQuestions(scan, questMode, wordDexOrder);
    const allWithMeaning = scan.words.filter((w) => w.meaning?.trim()) as Array<WordEnemy & { meaning: string }>;
    return qs.map((q) => {
      const choices = buildChoices(q, allWithMeaning);
      const correctIndex = choices.indexOf(q.meaning!.trim());
      return { word: q, choices, correctIndex: correctIndex >= 0 ? correctIndex : 0 };
    });
  });

  // 図鑑登録タイミング：出題候補になった時点で登録（???演出用）
  useEffect(() => {
    registerWordDexWords(questionsWithChoices.map((q) => q.word.word));
  }, [questionsWithChoices, registerWordDexWords]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SEC);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [capturedWords, setCapturedWords] = useState<WordEnemy[]>([]);
  const [defeatedWords, setDefeatedWords] = useState<WordEnemy[]>([]);
  const [missedWords, setMissedWords] = useState<Array<{ word: WordEnemy; missCount: number }>>([]);
  const [missCount, setMissCount] = useState(0);
  const [battleLog, setBattleLog] = useState<{ text: string; key: number } | null>(null);

  const [cardThrow, setCardThrow] = useState<{ isCorrect: boolean; key: number } | null>(null);
  const [hitType, setHitType] = useState<'shake' | 'split' | 'seal' | null>(null);
  const [sealArrived, setSealArrived] = useState(false);
  const [sealPhase, setSealPhase] = useState<'idle' | 'throw' | 'stick' | 'seal'>('idle');
  const sealTimersRef = useRef<number[]>([]);
  // Timing constants for seal animation
  const SEAL_THROW_MS = 520;
  const SEAL_STICK_MS = 120;
  const SEAL_RINGS_MS = 250;
  // refs intentionally removed for simplified, robust animation

  const currentItem = questionsWithChoices[currentIndex];
  const currentWord = currentItem?.word;
  const choices = currentItem?.choices ?? [];
  const correctIndex = currentItem?.correctIndex ?? -1;

  const isCorrectAnswer = selectedAnswer !== null && selectedAnswer !== -1 && selectedAnswer === correctIndex;
  const displayHp =
    showResult && isCorrectAnswer && currentWord
      ? Math.max(0, currentWord.hp - 1)
      : (currentWord?.hp ?? 0);

  const handleSelect = useCallback(
    (idx: number) => {
      if (showResult || selectedAnswer !== null) return;
      vibrateLight();
      setSelectedAnswer(idx);
      const isCorrect = idx === correctIndex;
      setShowResult(true);

      setBattleLog({
        text: isCorrect
          ? (currentWord!.hp === 1 ? '封印した！' : 'ワードカード！')
          : 'はじかれた…',
        key: Date.now(),
      });
      

      if (isCorrect) {
        vibrateSuccess();
        // 成功時は撃破カウントを増やす（捕獲時も数値として残す）
        setDefeatedCount((d) => d + 1);
        const newHp = Math.max(0, currentWord!.hp - 1);
        if (currentWord!.hp === 1) {
          setCapturedWords((c) => [...c, { ...currentWord!, hp: 0 }]);
        } else {
          setDefeatedWords((d) =>
            d.some((w) => w.word === currentWord!.word) ? d : [...d, { ...currentWord!, hp: currentWord!.hp - 1 }]
          );
        }
        // 二回目の倒す演出（'split'）を一回目から表示する
        if (currentWord!.hp === 3) setHitType('split');
        else if (currentWord!.hp === 2) setHitType('split');
        else if (currentWord!.hp === 1) setHitType('seal');
        updateWordEnemyState(scan.id, currentWord!.word, {
          hp: newHp,
          asked: true,
        });
        // trigger card throw after hitType/update to ensure correct animation branch
        setCardThrow({ isCorrect, key: Date.now() });
      } else {
        vibrateError();
        setMissCount((m) => m + 1);
        setMissedWords((prev) => {
          const idx = prev.findIndex((x) => x.word.word === currentWord!.word);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], missCount: next[idx].missCount + 1 };
            return next;
          }
          return [...prev, { word: { ...currentWord! }, missCount: 1 }];
        });
        updateWordEnemyState(scan.id, currentWord!.word, {
          asked: true,
          wrongCount: (currentWord!.wrongCount ?? 0) + 1,
        });
        setCardThrow({ isCorrect, key: Date.now() });
      }
    },
    [showResult, selectedAnswer, correctIndex, currentWord, scan.id, updateWordEnemyState]
  );

  const goNext = useCallback(() => {
    setHitType(null);
    setBattleLog(null);
    setCardThrow(null);
    setSealArrived(false);
    setSealPhase('idle');
    sealTimersRef.current.forEach((id: number) => clearTimeout(id));
    sealTimersRef.current = [];
    if (currentIndex + 1 >= questionsWithChoices.length) {
      onComplete({
        capturedWords,
        defeatedWords,
        defeatedCount,
        misses: missCount,
        missedWords,
      });
      return;
    }
    setCurrentIndex((i) => i + 1);
    setTimeLeft(TIME_LIMIT_SEC);
    setSelectedAnswer(null);
    setShowResult(false);
  }, [currentIndex, questionsWithChoices, onComplete, capturedWords, defeatedWords, defeatedCount, missCount, missedWords]);

  // 5.5秒タイマー（0.5秒刻み）
  useEffect(() => {
    if (showResult) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.5) {
          clearInterval(t);
          return 0;
        }
        return prev - 0.5;
      });
    }, 500);
    return () => clearInterval(t);
  }, [currentIndex, showResult]);

  // 時間切れ = 不正解
  useEffect(() => {
    if (timeLeft === 0 && !showResult && selectedAnswer === null) {
      if (!currentWord) return;
      setSelectedAnswer(-1);
      setShowResult(true);
      setMissCount((m) => m + 1);
      setMissedWords((prev) => {
        const idx = prev.findIndex((x) => x.word.word === currentWord.word);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], missCount: next[idx].missCount + 1 };
          return next;
        }
        return [...prev, { word: { ...currentWord }, missCount: 1 }];
      });
      setBattleLog({ text: 'はじかれた…', key: Date.now() });
      vibrateError();
      updateWordEnemyState(scan.id, currentWord.word, {
        asked: true,
        wrongCount: (currentWord.wrongCount ?? 0) + 1,
      });
    }
  }, [timeLeft, showResult, selectedAnswer, scan.id, currentWord, updateWordEnemyState]);

  // 正誤表示後すぐ次へ（通常400ms、捕獲演出は1s確保）
  useEffect(() => {
    if (!showResult) return;
    // 調整: 投擲はそのまま遅め（1000ms）、封印のタイミングとリング長を変更
    // 新スケジュール: throw = 1000ms, stick = 120ms, seal rings = 250ms
    const SEAL_TOTAL_MS = SEAL_THROW_MS + SEAL_STICK_MS + SEAL_RINGS_MS; // 1370ms
    const delay = hitType === 'seal' ? SEAL_TOTAL_MS + 80 : 600;
    const id = setTimeout(goNext, delay);
    return () => clearTimeout(id);
  }, [showResult, goNext, hitType]);
  // Seal animation orchestration when a seal-card throw happens
  useEffect(() => {
    // start sequence only for seal throws
    if (cardThrow && cardThrow.isCorrect && hitType === 'seal') {
    // Phase timings (adjusted):
    // throw: 1000ms
    // stick: 120ms
    // seal (rings): 250ms
    setSealPhase('throw');
    const t1 = window.setTimeout(() => setSealPhase('stick'), SEAL_THROW_MS);
    const t2 = window.setTimeout(() => setSealPhase('seal'), SEAL_THROW_MS + SEAL_STICK_MS);
    const t3 = window.setTimeout(() => setSealArrived(true), SEAL_THROW_MS + SEAL_STICK_MS + SEAL_RINGS_MS);
      sealTimersRef.current = [t1, t2, t3];
      return () => {
        sealTimersRef.current.forEach((id: number) => clearTimeout(id));
        sealTimersRef.current = [];
      };
    }
    return;
  }, [cardThrow, hitType]);
  // Simple, deterministic card animation targets to avoid fragile DOM calculations.

  if (questionsWithChoices.length === 0) {
    const activeSet = new Set(scan.activeEnemyWords ?? []);
    const activeWords = activeSet.size > 0 ? scan.words.filter((w) => activeSet.has(w.word)) : scan.words;
    const undefeatedCount = activeWords.filter((w) => w.hp > 0).length;
    const noUndefeated = questMode === 'explore' && undefeatedCount === 0;
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-md mx-auto pt-8 text-center">
          <p className="text-gray-400 mb-4">
            {noUndefeated ? '未討伐の単語がありません。' : '出題できる単語がありません。'}
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {noUndefeated
              ? 'クエストクリアです。'
              : undefeatedCount > 0
                ? 'クエストクリア'
                : 'vocab_list に意味が登録された単語が必要です。'}
          </p>
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="px-6 py-3 rounded-xl bg-gray-700 text-white"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  const timePct = (timeLeft / TIME_LIMIT_SEC) * 100;
  const isTimeWarning = timeLeft <= 1;
  const hpBarPct = displayHp / 3;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0e17] to-[#0d1321] p-4">
      <style jsx global>{`
        /* World parallax (background, subtle) */
        @keyframes worldMove {
          0% { transform: translateY(-0.5px); }
          50% { transform: translateY(0.5px); }
          100% { transform: translateY(-0.5px); }
        }
        .world-parallax { animation: worldMove 8s ease-in-out infinite; will-change: transform; opacity: 0.42; filter: saturate(1.25) brightness(0.95); }

        /* Word float (enemy) */
        @keyframes wordFloat {
          0% { transform: translateY(-2px); }
          50% { transform: translateY(2px); }
          100% { transform: translateY(-2px); }
        }
        .animate-word-float { animation: wordFloat 3.5s ease-in-out infinite; will-change: transform; }

        /* Floor shadow subtle pulse */
        @keyframes shadowPulse {
          0% { transform: scaleX(2) scaleY(1); opacity: 0.5; }
          50% { transform: scaleX(1.8) scaleY(0.95); opacity: 0.36; }
          100% { transform: scaleX(2) scaleY(1); opacity: 0.5; }
        }
        .shadow-floor { filter: blur(4px); transform-origin: center; animation: shadowPulse 3.5s ease-in-out infinite; will-change: transform, opacity; }

        /* Shake (light hit) */
        @keyframes wordShake {
          0% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-4px) rotate(-2deg); }
          60% { transform: translateY(0) rotate(2deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .animate-word-shake { animation: wordShake 0.48s ease-in-out both; will-change: transform; }

        /* Split (partial hit) */
        @keyframes splitLeft {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(-8px) scale(0.98); opacity: 0.98; }
        }
        @keyframes splitRight {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(8px) scale(0.98); opacity: 0.98; }
        }
        .animate-word-split-left { display:inline-block; animation: splitLeft 0.36s ease-out both; }
        .animate-word-split-right { display:inline-block; animation: splitRight 0.36s ease-out both; }

        /* Seal (capture) glow */
        @keyframes sealGlow {
          0% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .animate-word-seal { animation: sealGlow 0.9s ease-in-out both; }
        .animate-word-seal-glow { animation: sealGlow 0.9s ease-in-out both; filter: blur(8px); }

        /* Enemy word styling: subtle text-shadow for pseudo-3D */
        .enemy-word {
          /* white glow + blue-ish deeper shadow for legibility against background */
          text-shadow:
            0 0 8px rgba(255,255,255,0.06),
            0 6px 10px rgba(2,6,23,0.6),
            0 10px 20px rgba(10,24,46,0.45);
          transform: translateZ(0);
        }
        /* enemy backdrop: radial dark vignette behind the word to separate from background */
        .enemy-backdrop {
          width: 140px;
          height: 56px;
          border-radius: 999px;
          background: radial-gradient(ellipse at center, rgba(2,6,12,0.10) 0%, rgba(2,6,12,0.03) 55%, rgba(2,6,12,0) 100%);
          filter: blur(4px);
          transform: translateY(3px);
          pointer-events: none;
        }
        /* Midground forest layers (behind the enemy word) */
        @keyframes midgroundMove {
          0% { transform: translateY(0.5px); }
          50% { transform: translateY(-0.5px); }
          100% { transform: translateY(0.5px); }
        }
        .midground-forest { will-change: transform, opacity; animation: midgroundMove 7.5s ease-in-out infinite; opacity: 0.55; filter: saturate(1.25) brightness(0.95); }
        .midground-layer-1 {
          background: linear-gradient(180deg, rgba(18,36,28,0.0) 0%, rgba(8,88,42,0.62) 60%);
          clip-path: polygon(0 100%,10% 60%,20% 80%,30% 55%,40% 75%,50% 50%,60% 78%,70% 58%,80% 75%,90% 65%,100% 100%);
          filter: blur(1px);
          opacity: 0.78;
        }
        .midground-layer-2 {
          background: linear-gradient(180deg, rgba(16,40,30,0.0) 0%, rgba(10,64,36,0.40) 60%);
          clip-path: polygon(0 100%,8% 70%,18% 85%,33% 62%,48% 82%,63% 60%,78% 85%,92% 70%,100% 100%);
          filter: blur(1px);
          opacity: 0.62;
        }
        /* Seal card styling */
        .seal-throw { width: 2.5rem; height: 4.5rem; display: flex; align-items: center; justify-content: center; z-index: 30; }
        .seal-card { width: 100%; height: 100%; background: linear-gradient(#fff8ec,#f6efd8); border-radius: 6px; box-shadow: 0 6px 18px rgba(2,6,23,0.28); border-left: 2px solid rgba(10,24,46,0.12); border-right: 2px solid rgba(10,24,46,0.06); display:flex; flex-direction:column; align-items:center; justify-content:space-between; overflow:hidden; }
        .seal-border-top, .seal-border-bottom { width:100%; height:3px; background: linear-gradient(90deg, rgba(30,30,30,0.9), rgba(200,160,60,0.9)); opacity:0.9; }
        .seal-center { flex:1; display:flex; align-items:center; justify-content:center; padding:6px; }
        .seal-symbol { width:28px; height:28px; }
        /* small seal variant for toss / capture */
        .small-seal-symbol { width:100%; height:100%; object-fit:contain; display:block; }
        /* Absorb animation for enemy word */
        @keyframes absorbOut {
          0% { transform: scale(1); opacity: 1; filter: blur(0); }
          60% { transform: scale(0.6); opacity: 0.8; filter: blur(0); }
          100% { transform: scale(0.2); opacity: 0; filter: blur(0); }
        }
        .animate-absorb { animation: absorbOut 0.56s ease-in forwards; transform-origin: center; }
        /* 封印時：単語が札（右側）へ吸い込まれる */
        @keyframes absorbToCard {
          0% { transform: translateX(0) translateY(0) scale(1); opacity: 1; filter: blur(0); }
          45% { transform: translateX(20px) translateY(-3px) scale(0.75); opacity: 0.9; filter: blur(0); }
          100% { transform: translateX(42px) translateY(-6px) scale(0.18); opacity: 0; filter: blur(0.6px); }
        }
        .animate-absorb-to-card { animation: absorbToCard 0.56s ease-in forwards; transform-origin: center; }
        /* Seal rings color tweak */
        .seal-ring { stroke: rgba(120,200,255,0.95); }
      `}</style>
      {/* やめるボタン（フレーム外・左上） */}
      <button
        onClick={() => {
          vibrateLight();
          onBack();
        }}
        className="absolute top-4 left-4 z-20 flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        やめる
      </button>

      {/* ===== ゲーム機フレーム（9:16・角丸・厚み・影） ===== */}
      <div className="relative w-full max-w-[min(360px,90vw)] aspect-[9/16] rounded-[2rem] p-3 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_0_0_4px_rgba(55,65,81,0.8),0_0_0_8px_rgba(31,41,55,0.6),0_25px_50px_-12px_rgba(0,0,0,0.6)]">
        {/* 内側のバトル画面コンテナ（中央を透過して背景を見せる） */}
        <div className="relative w-full h-full rounded-[1.25rem] overflow-hidden bg-transparent flex flex-col">
          {/* タイマーバー（画面上端） */}
          <div className="absolute top-0 left-0 right-0 h-1 z-10 bg-black/60">
            <motion.div
              className={`h-full ${isTimeWarning ? 'bg-red-600' : 'bg-amber-500'}`}
              initial={{ width: '100%' }}
              animate={{ width: `${timePct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>

          {/* ===== 上半分：バトルフィールド ===== */}
          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* 背景群を battle-background コンテナにまとめ（必ず最下層に描画される） */}
            <div className="absolute inset-0 z-0 battle-background" aria-hidden>
              {/* 背景画像（public/backgrounds/forest.png） */}
              <div
                className="absolute inset-0"
                aria-hidden
                style={{
                  backgroundImage: "url('/images/backgrounds/forest.png')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  filter: 'saturate(1.05) brightness(0.92) blur(0.6px)',
                }}
              />
              {/* オーバーレイ（画像のコントラスト調整） */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(8,12,10,0.32) 0%, rgba(8,12,10,0.06) 28%, rgba(8,12,10,0.0) 42%, rgba(8,12,10,0.0) 58%, rgba(8,12,10,0.06) 72%, rgba(8,12,10,0.32) 100%)',
                }}
              />
              {/* 下部への自然な暗転（線の代わり） */}
              <div
                className="absolute left-0 right-0 bottom-0 h-[32%]"
                style={{
                  background:
                    'linear-gradient(to top, rgba(8,12,10,0.38) 0%, rgba(8,12,10,0.18) 30%, rgba(8,12,10,0.06) 60%, rgba(8,12,10,0.0) 100%)',
                }}
              />

              {/* 遠景シルエット（山・森の抽象形状・ぼかし弱め） */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[45%] opacity-20 world-parallax"
                style={{
                  background: 'linear-gradient(to top, #062a18 0%, transparent 60%)',
                  clipPath:
                    'polygon(0 100%, 5% 70%, 15% 85%, 25% 60%, 35% 78%, 45% 65%, 55% 82%, 65% 68%, 75% 80%, 85% 72%, 95% 75%, 100% 100%)',
                  filter: 'blur(1px)',
                }}
              />

              {/* 中景：森林シルエット（単語の背後に配置、RPG感） */}
              <div className="absolute inset-x-0 bottom-[30%] h-[26%] opacity-40 midground-forest">
                <div className="absolute inset-0 midground-layer-1" />
                <div className="absolute inset-0 midground-layer-2" />
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 h-[35%] opacity-15 world-parallax"
                style={{
                  background: 'linear-gradient(to top, #0b3420 0%, transparent 70%)',
                  clipPath:
                    'polygon(0 100%, 10% 80%, 22% 90%, 38% 75%, 50% 88%, 62% 78%, 78% 85%, 90% 80%, 100% 100%)',
                  filter: 'blur(0.5px)',
                }}
              />
            </div>

            {/* 敵ステータスボックス（左上・クラシック枠線） */}
            <div className="absolute top-6 left-3 z-20 rounded-md border-2 border-amber-700/80 bg-black/60 px-3 py-2 shadow-lg">
              <div className="text-amber-200 font-mono text-xs tracking-widest mb-1.5">
                {(currentWord?.word ?? '').toUpperCase().padEnd(10, ' ').slice(0, 10)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 text-[10px] font-mono">HP</span>
                <div className="w-20 h-2 rounded-sm bg-gray-800 border border-amber-800/60 overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500"
                    initial={false}
                    animate={{ width: `${hpBarPct * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            </div>

            {/* タイマー・プログレス（右上） */}
            <div className="absolute top-6 right-3 z-20 flex items-center gap-2">
              <div className="flex gap-0.5">
                {questionsWithChoices.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-1 rounded-full ${
                      i < currentIndex ? 'bg-amber-500' : i === currentIndex ? 'bg-amber-500/70' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isTimeWarning ? 'bg-red-900/60 text-red-400' : 'bg-black/40 text-amber-300'
                }`}
              >
                {Math.max(0, Math.round(timeLeft * 2) / 2)}s
              </span>
            </div>

            {/* 敵（単語）：やや上寄り・中央より少し上・寄り構図 */}
            <div className="relative flex-1 flex flex-col items-center justify-center pt-8 pb-2" style={{ zIndex: 10 }}>
              <div className="relative flex flex-col items-center">
                {/* 楕円の影（足元） */}
                <div
                  className="absolute -bottom-1.5 w-20 h-3 rounded-full bg-black/50 shadow-floor"
                  aria-hidden
                />
                {/* 単語（出現・待機・被弾アニメ） */}
                <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, y: 16, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative text-center"
                  >
                    {/* 背後の暗幕（単語と背景の分離用） */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="enemy-backdrop" aria-hidden />
                    </div>
                    <div
                      className={`${!hitType ? 'animate-word-float' : ''} ${hitType === 'shake' ? 'animate-word-shake' : ''} ${
                        hitType === 'seal' ? 'animate-word-seal' : ''
                      }`}
                    >
                      {hitType === 'split' && currentWord ? (
                        <div className="flex justify-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                          <span className="inline-block animate-word-split-left text-2xl font-bold text-white tracking-wider">
                            {currentWord.word.slice(0, Math.ceil(currentWord.word.length / 2))}
                          </span>
                          <span className="inline-block animate-word-split-right text-2xl font-bold text-white tracking-wider">
                            {currentWord.word.slice(Math.ceil(currentWord.word.length / 2))}
                          </span>
                        </div>
                      ) : (
                        <p className={`text-2xl font-bold text-white tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] enemy-word ${sealArrived && hitType === 'seal' ? 'animate-absorb-to-card' : ''}`}>
                          {currentWord?.word}
                        </p>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* 捕獲演出 */}
              {hitType === 'seal' && currentWord && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="absolute w-20 h-20 rounded-full bg-amber-400/30 animate-word-seal-glow" />
                  {sealPhase === 'seal' && (
                    <motion.svg className="absolute" width="180" height="180" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="22"
                        stroke="rgba(120,200,255,0.9)"
                        strokeWidth="1.8"
                        initial={{ scale: 0.65, opacity: 0.95 }}
                        animate={{ scale: 1.1, opacity: 0.45 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="30"
                        stroke="rgba(120,200,255,0.7)"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                        initial={{ scale: 0.65, opacity: 0.7 }}
                        animate={{ scale: 1.12, opacity: 0.3 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </motion.svg>
                  )}
                </div>
              )}

              {/* ワードカード投擲アニメ */}
              <AnimatePresence>
                {cardThrow && (
                  <motion.div
                    key={cardThrow.key}
                    className="absolute inset-0 pointer-events-none overflow-visible"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                  {(cardThrow && cardThrow.isCorrect && sealPhase !== 'idle') ? (
                      /* Seal-card throw animation (from bottom-right to center) */
                      <motion.div
                        className="absolute seal-throw"
                        style={{
                          right: '8%',
                          bottom: '12%',
                          width: '2.4rem',
                          height: '3.8rem',
                          // 投擲中は前面、封印待機中は単語の背面へ
                          zIndex: sealPhase === 'throw' ? 30 : 1,
                        }}
                        initial={{ x: 0, y: 0, rotateZ: 0, rotateY: 0, opacity: 1, scale: 0.9 }}
                        animate={
                          sealPhase === 'throw'
                            ? { 
                                // 直撃（中央付近）へ向かう放物線
                                x: ['0px', '-90px', '-145px'], 
                                y: ['0px', '-185px', '-145px'], 
                                rotateZ: [0, 1080], 
                                rotateY: [0, 70], 
                                scale: [0.9, 1.05] 
                              }
                            : sealPhase === 'stick'
                            // 直撃後、単語の中央（背面）で正面向きに静止
                            ? { x: '-145px', y: '-145px', rotateZ: 1080, rotateY: 0, scale: [1.06, 1] }
                            : sealPhase === 'seal'
                            ? { x: '-145px', y: '-145px', rotateZ: 1080, rotateY: 0, scale: 1 }
                            : { x: '-145px', y: '-145px', rotateZ: 1080, rotateY: 0, scale: 1 }
                        }
                        transition={{ duration: sealPhase === 'throw' ? 0.52 : sealPhase === 'stick' ? 0.12 : sealPhase === 'seal' ? 0.25 : 0.01, ease: 'easeOut' }}
                      >
                        <img src="/cards/seal-card.svg" className="small-seal-symbol" alt="seal" />
                      </motion.div>
                    ) : (
                      /* default small card toss for non-seal cases */
                      <motion.div
                        className="absolute"
                        style={{ right: '8%', bottom: '12%', width: '2.4rem', height: '3.8rem' }}
                        initial={{ x: 0, y: 0, rotateZ: 0, opacity: 1, scale: 0.9 }}
                        animate={
                          cardThrow.isCorrect
                            // 撃破時は単語を突き抜けて奥へ飛ばす
                            ? {
                                // 単語を貫いた直後にフェードアウト
                                x: ['0px', '-120px', '-185px', '-245px'],
                                y: ['0px', '-145px', '-155px', '-175px'],
                                rotateZ: [0, 960, 1200, 1320],
                                opacity: [1, 1, 0, 0],
                                scale: [0.9, 1, 0.72, 0.35],
                              }
                            : { x: ['0px', '-40px', 0], y: [0, -10, 40], opacity: [1, 1, 0] }
                        }
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      >
                        <img src="/cards/seal-card.svg" className="small-seal-symbol" alt="seal" />
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
             
            </div>
          </div>

          {/* ===== 下部1/3：コマンドエリア ===== */}
          <div className="shrink-0 border-t-2 border-amber-900/60 bg-[#0a0e14] p-3">
            {/* 戦闘ログ */}
            <div className="min-h-[1.25rem] flex items-center justify-center mb-2">
              <AnimatePresence>
                {battleLog && (
                  <motion.p
                    key={battleLog.key}
                    className="text-center text-xs text-amber-200/90"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    {battleLog.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* 4択：2×2・パネル型・押すと凹む */}
            <div className="grid grid-cols-2 gap-1.5">
              {choices.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = correctIndex === i;
                const showCorrect = showResult && isCorrect && selectedAnswer !== -1;
                const showWrong = showResult && ((isSelected && !isCorrect) || (selectedAnswer === -1 && isCorrect));

                return (
                  <motion.button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={showResult}
                    whileTap={!showResult ? { scale: 0.97 } : {}}
                    className={`py-2.5 px-2.5 rounded-lg text-left text-xs font-medium border-2 transition-all ${
                      showCorrect
                        ? 'bg-emerald-800/90 text-emerald-100 border-emerald-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]'
                        : ''
                    } ${
                      showWrong
                        ? 'bg-red-900/80 text-red-100 border-red-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]'
                        : ''
                    } ${
                      !showResult && !showWrong && !showCorrect
                        ? 'bg-gray-800/90 text-gray-200 border-gray-600 hover:border-amber-600/50 active:scale-[0.97] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]'
                        : ''
                    }`}
                  >
                    <span className="line-clamp-2">{opt}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
