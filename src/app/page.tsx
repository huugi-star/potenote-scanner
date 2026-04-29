'use client';

/**
 * Potenote Scanner v2 - Main Page
 * 
 * GamePhase管理とすべての画面を統合
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Gem, Crown, Coins, Zap, BookOpen, Shirt, Share2, Languages, Sword, Users, GraduationCap, MessageCircle, Scan, Camera, Loader2, AlertCircle, Play } from 'lucide-react';
import { useGameStore, selectRemainingScanCount } from '@/store/useGameStore';
import { getItemById } from '@/data/items';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { QuizRaw, TranslationResult, LectureHistory, QuizQuestionAttempt } from '@/types';
import { compressForAI, validateImageFile, preprocessImageForOCR } from '@/lib/imageUtils';
import { LIMITS } from '@/lib/constants';
import { getJstDateString } from '@/lib/dateUtils';

// Screens
import { ScanningScreen } from '@/components/screens/ScanningScreen';
import { QuizGameScreen, type QuizMode } from '@/components/screens/QuizGameScreen';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { GachaScreen } from '@/components/screens/GachaScreen';
import { ResearcherDexScreen } from '@/components/screens/ResearcherDexScreen';
import { DressUpScreen } from '@/components/screens/DressUpScreen';
import { FreeQuestScreen } from '@/components/screens/FreeQuestScreen';
import { QuizWordDexScreen } from '@/components/screens/QuizWordDexScreen';
import { TranslationResultScreen } from '@/components/screens/TranslationResultScreen';
import { TranslationHistoryScreen } from '@/components/screens/TranslationHistoryScreen';
import { LectureScreen } from '@/components/screens/LectureScreen';
import { LectureHistoryScreen } from '@/components/screens/LectureHistoryScreen';
import { SuhimochiRoomScreen } from '@/components/screens/SuhimochiRoomScreen';
import { AcademyScreen } from '@/components/screens/AcademyScreen';

// UI Components
import { LoginBonusModal } from '@/components/ui/LoginBonusModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthButton } from '@/components/ui/AuthButton';
import { OnboardingOverlay } from '@/components/ui/OnboardingOverlay';
import { ShareModal } from '@/components/ui/ShareModal';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';

import { vibrateLight } from '@/lib/haptics';
import { getRepairBookFragments, getRepairSpentFragments, migrateRepairProgressIfNeeded } from '@/lib/repairBookFragments';
import { calcBooksFromFragments, calcRankInfo } from '@/constants/rankSystem';

// ===== Types =====

type GamePhase = 
  | 'home'
  | 'mypage'
  | 'suhimochi_room'
  | 'academy'
  | 'adventure_menu'
  | 'scanning'
  | 'mode_select'
  | 'translation_mode_select' // 翻訳モード選択画面
  | 'quiz'
  | 'result'
  | 'gacha'
  | 'researcher_dex' // 研究員図鑑
  | 'dressup'
  | 'freequest'
  | 'worddex'
  | 'translation_result'
  | 'translation_history'
  | 'lecture'
  | 'lecture_history';

interface QuizSession {
  quiz: QuizRaw;
  imageUrl: string;
  mode: QuizMode;
  correctCount: number;
  speedRushTotalTime?: number; // speed rushモードでの正答の合計時間（秒）
  isFreeQuest?: boolean;
  batchId?: string;
  attempts?: QuizQuestionAttempt[];
}

const TEMP_DISPLAY_NAMES = ['すうひもち見習い', 'クイズ旅人', 'ポテノ研究員'] as const;

const pickTemporaryDisplayName = (): string => {
  return TEMP_DISPLAY_NAMES[Math.floor(Math.random() * TEMP_DISPLAY_NAMES.length)];
};

// ===== Sub Components =====

/**
 * 翻訳結果画面ラッパー（ストアから結果を取得）
 */
const TranslationResultScreenWrapper = ({ onBack }: { onBack: () => void }) => {
  const translationResult = useGameStore(state => state.translationResult);
  
  if (!translationResult) {
    return null;
  }
  
  return (
    <motion.div
      key="translation_result"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <TranslationResultScreen
        result={translationResult}
        onBack={onBack}
      />
    </motion.div>
  );
};

/**
 * 冒険メニュー画面
 * - 単コレ
 * - スキャンして冒険
 * - 英文解釈
 */
const AdventureMenuScreen = ({
  onBack,
  onOpenScanAdventure,
  onOpenEnglishReading,
  onQuickQuizReady,
}: {
  onBack: () => void;
  onOpenScanAdventure: () => void;
  onOpenEnglishReading: () => void;
  onQuickQuizReady: (quiz: QuizRaw, imageUrl: string) => void;
}) => {
  const uid = useGameStore((s) => s.uid);
  const isVIP = useGameStore((s) => s.isVIP);
  const dailyScanCount = useGameStore((s) => s.dailyScanCount);
  const lastScanDate = useGameStore((s) => s.lastScanDate);
  const bonusScanBalance = useGameStore((s) => s.bonusScanBalance);
  const remainingScans = useGameStore(selectRemainingScanCount);
  const checkScanLimit = useGameStore((s) => s.checkScanLimit);
  const incrementScanCount = useGameStore((s) => s.incrementScanCount);
  const saveQuizHistory = useGameStore((s) => s.saveQuizHistory);
  const registerQuizBatchToWordDex = useGameStore((s) => s.registerQuizBatchToWordDex);
  const setGeneratedQuiz = useGameStore((s) => s.setGeneratedQuiz);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [quickScanState, setQuickScanState] = useState<'idle' | 'processing' | 'error'>('idle');
  const [quickScanPreview, setQuickScanPreview] = useState<string | null>(null);
  const [quickScanError, setQuickScanError] = useState<string>('');
  const [quickProgress, setQuickProgress] = useState<number>(0);
  const [quickProgressLabel, setQuickProgressLabel] = useState<string>('');
  const quickProgressTimerRef = useRef<number | null>(null);

  const openQuickFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const stopQuickProgressTicker = useCallback((finalValue?: number) => {
    if (quickProgressTimerRef.current) {
      clearInterval(quickProgressTimerRef.current);
      quickProgressTimerRef.current = null;
    }
    if (typeof finalValue === 'number') {
      setQuickProgress(finalValue);
    }
  }, []);

  const startQuickProgressTicker = useCallback(() => {
    stopQuickProgressTicker();
    const step = 5; // ScanningScreen(quiz) と同じ
    setQuickProgress(step);
    quickProgressTimerRef.current = window.setInterval(() => {
      setQuickProgress((prev) => {
        const next = Math.min(prev + step, 95);
        if (next >= 95 && quickProgressTimerRef.current) {
          clearInterval(quickProgressTimerRef.current);
          quickProgressTimerRef.current = null;
        }
        return next;
      });
    }, 1000);
  }, [stopQuickProgressTicker]);

  useEffect(() => {
    return () => {
      stopQuickProgressTicker();
    };
  }, [stopQuickProgressTicker]);

  const quickDisplayProgress = Math.min(100, Math.max(0, Math.round(quickProgress)));
  const quickEffectiveProgressLabel =
    quickProgressLabel || (quickScanState === 'processing' ? 'クイズを生成中...' : '');

  const today = getJstDateString();
  const usedToday = lastScanDate === today ? dailyScanCount : 0;
  const freeRemaining = Math.max(0, LIMITS.FREE_USER.DAILY_SCAN_LIMIT - usedToday);
  const bonusRemaining = Math.max(0, bonusScanBalance ?? 0);

  const handleQuickScanFile = useCallback(async (file: File) => {
    vibrateLight();
    // 「新しい冒険をスキャン」と同仕様（クイズスキャン）
    useGameStore.getState().setScanType('quiz');

    // 制限チェック（消費は成功時のみ）
    const limitCheck = checkScanLimit();
    if (!limitCheck.canScan) {
      setQuickScanError(limitCheck.error || 'スキャン回数の上限に達しました');
      setQuickScanState('error');
      return;
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setQuickScanError(validation.error || '無効なファイルです');
      setQuickScanState('error');
      return;
    }

    setQuickScanState('processing');
    setQuickScanError('');
    startQuickProgressTicker();
    setQuickProgressLabel('画像を確認中...');

    try {
      // 1) プレビュー用に圧縮
      const compressed = await compressForAI(file);
      setQuickScanPreview(compressed.dataUrl);
      setQuickProgressLabel('画像を最適化中...');

      // 2) OCR用に補正
      setQuickProgressLabel('OCR用に補正中...');
      const enhancedImage = await preprocessImageForOCR(file);

      // 3) クイズ生成
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60000);
      setQuickProgressLabel('クイズ生成をリクエスト中...');
      const quizResponse = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: enhancedImage,
          uid: uid ?? undefined,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      setQuickProgressLabel('問題を組み立て中...');

      if (quizResponse.status === 429) {
        setQuickScanState('idle');
        setQuickScanPreview(null);
        stopQuickProgressTicker(0);
        setQuickProgressLabel('');
        alert(
          "🙏 申し訳ありません！\n\n本日のAI解析サーバーが混み合っており、1日の利用上限に達しました。\n（コスト制限のため、現在は1日限定数で運営しています）\n\n明日になるとリセットされますので、また明日お試しください！"
        );
        return;
      }

      if (!quizResponse.ok) {
        throw new Error(`Quiz error: ${quizResponse.status}`);
      }

      const quizResult = await quizResponse.json();
      if (!quizResult?.quiz?.questions?.length) {
        throw new Error(quizResult?.error || 'クイズ生成に失敗しました');
      }

      // ★成功時のみ消費・履歴保存
      incrementScanCount();
      stopQuickProgressTicker(100);
      setQuickProgressLabel('完了');
      const scanQuizId = `scan_${Date.now()}`;
      useGameStore.getState().setLastScanQuizId(scanQuizId);
      await saveQuizHistory(quizResult.quiz, {
        quizId: scanQuizId,
        correctCount: 0,
        totalQuestions: quizResult.quiz.questions.length,
        isPerfect: false,
        earnedCoins: 0,
        earnedDistance: 0,
        isDoubled: false,
        timestamp: new Date(),
      });
      registerQuizBatchToWordDex(quizResult.quiz, scanQuizId);
      // ScanningScreen と同様にストアへ保存（ページ更新後も保持）
      setGeneratedQuiz(quizResult.quiz, compressed.dataUrl);

      setQuickScanState('idle');
      setQuickScanPreview(null);
      setQuickProgressLabel('');

      // すぐモード選択へ（ここからクイズ開始できる）
      onQuickQuizReady(quizResult.quiz, compressed.dataUrl);
    } catch (e) {
      const msg =
        e instanceof Error
          ? (e.name === 'AbortError'
            ? '通信がタイムアウトしました。再度お試しください。'
            : e.message)
          : 'エラーが発生しました';
      setQuickScanError(msg);
      setQuickScanState('error');
      stopQuickProgressTicker(0);
      setQuickProgressLabel('');
    }
  }, [checkScanLimit, incrementScanCount, onQuickQuizReady, registerQuizBatchToWordDex, saveQuizHistory, setGeneratedQuiz, startQuickProgressTicker, stopQuickProgressTicker, uid]);

  const handleQuickDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (quickScanState === 'processing') return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleQuickScanFile(file);
  }, [handleQuickScanFile, quickScanState]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-md mx-auto pt-6">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">ことばを読み取る</h2>

        {/* すぐスキャン（画像を置いたら即クイズ生成） */}
        <div className="mb-4 rounded-2xl border border-cyan-500/25 bg-gray-800/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-white font-bold flex items-center gap-2">
                <Scan className="w-4 h-4 text-cyan-300" />
                すぐスキャンしてクイズ
              </div>
              <div className="text-gray-400 text-xs mt-1">
                画像を置くと、そのままクイズ生成まで進みます
              </div>
            </div>
            {/* スキャン残り回数（ScanningScreenと同形式） */}
            <div
              className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                isVIP
                  ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25'
                  : remainingScans > 0
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/25'
                    : 'bg-red-500/15 text-red-200 border-red-500/25'
              }`}
              style={{ lineHeight: 1.15 }}
            >
              {isVIP ? (
                <span className="flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  VIP Unlimited
                </span>
              ) : (
                <div>
                  <div>本日残り {remainingScans}回</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    無料：{freeRemaining} / ボーナス：{bonusRemaining}
                  </div>
                </div>
              )}
            </div>
            {quickScanState === 'processing' ? (
              <div className="flex items-center gap-2 text-cyan-200 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                処理中…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { vibrateLight(); cameraInputRef.current?.click(); }}
                className="shrink-0 px-3 py-2 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-200 text-xs font-bold hover:bg-cyan-600/30"
              >
                <span className="inline-flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  写真を撮る
                </span>
              </button>
            )}
          </div>

          <div
            onDrop={handleQuickDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => {
              if (quickScanState === 'processing') return;
              vibrateLight();
              openQuickFilePicker();
            }}
            className={`rounded-2xl border-2 border-dashed p-4 text-center transition-colors ${
              quickScanState === 'processing'
                ? 'border-gray-700 bg-gray-900/40 cursor-wait'
                : 'border-cyan-500/35 bg-gray-900/20 hover:border-cyan-400 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleQuickScanFile(file);
                // 同じファイルを連続で選べるように
                e.currentTarget.value = '';
              }}
              disabled={quickScanState === 'processing'}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                handleQuickScanFile(file);
                e.currentTarget.value = '';
              }}
              disabled={quickScanState === 'processing'}
            />

            {quickScanPreview ? (
              <div className="mx-auto w-full max-w-[260px]">
                <div className="rounded-xl overflow-hidden border border-cyan-500/30">
                  <img src={quickScanPreview} alt="preview" className="w-full h-40 object-cover" />
                </div>
                {quickScanState === 'processing' && (
                  <div className="mt-3">
                    {/* ScanningScreen と同じ進行度表示 */}
                    <div className="max-w-md mx-auto mb-3">
                      <div className="flex items-center justify-between text-sm text-cyan-100 mb-2 px-1">
                        <span className="text-left line-clamp-2">{quickEffectiveProgressLabel}</span>
                        <span className="font-semibold">{quickDisplayProgress}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-cyan-500/30">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 transition-[width] duration-300 ease-out"
                          style={{ width: `${quickDisplayProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 text-gray-200">
                      <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                      <span className="text-sm font-semibold">クイズ作成中...</span>
                    </div>
                  </div>
                )}
                {quickScanState !== 'processing' && (
                  <div className="mt-2 text-xs text-gray-300">タップで別の画像に変更</div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center">
                  {quickScanState === 'processing' ? (
                    <Loader2 className="w-6 h-6 text-cyan-300 animate-spin" />
                  ) : (
                    <Play className="w-6 h-6 text-cyan-300" />
                  )}
                </div>
                <div className="text-white font-semibold text-sm">
                  タップして選択 / ドラッグ&ドロップ
                </div>
                <div className="text-gray-400 text-xs flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  1ページずつスキャンしてください
                </div>
              </div>
            )}
          </div>

          {quickScanState === 'error' && quickScanError && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {quickScanError}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Link href="/word-collection" onClick={() => vibrateLight()}>
            <motion.div
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sword className="w-5 h-5" />
              単コレ
            </motion.div>
          </Link>

          <motion.button
            onClick={() => {
              vibrateLight();
              onOpenScanAdventure();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            スキャンして学ぶ
          </motion.button>

          <motion.button
            onClick={() => {
              vibrateLight();
              onOpenEnglishReading();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Languages className="w-5 h-5" />
            英文解釈
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 w-full py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════
// RPGボタン（ホーム用 v5）
// ════════════════════════════════════
// ─── RpgButton ───────────────────────────────────────────────────────────────
const RpgButton = ({
  onClick,
  fromColor,
  toColor,
  glowColor,
  shadowColor,
  icon,
  label,
  small = false,
}: {
  onClick: () => void;
  fromColor: string;
  toColor: string;
  glowColor: string;
  shadowColor: string;
  icon: ReactNode;
  label: string;
  small?: boolean;
}) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        padding: small ? '11px 8px' : '14px 16px',
        borderRadius: 14,
        background: `linear-gradient(180deg,${toColor} 0%,${fromColor} 100%)`,
        borderTop: '2px solid rgba(255,255,255,0.28)',
        borderLeft: '1px solid rgba(255,255,255,0.10)',
        borderRight: '1px solid rgba(0,0,0,0.20)',
        borderBottom: pressed ? `3px solid ${shadowColor}` : `5px solid ${shadowColor}`,
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        boxShadow: pressed
          ? `0 2px 8px ${glowColor}`
          : `0 6px 18px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.22)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: small ? 5 : 8,
        color: '#fff',
        fontWeight: 900,
        fontSize: small ? 14 : 17,
        letterSpacing: '0.02em',
        textShadow: '0 1px 4px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-bottom .07s,transform .07s,box-shadow .07s',
        outline: 'none',
        border: 'none', // reset then re-add below via individual props
      }}
    >
      {/* 上縁ハイライト */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)',
          pointerEvents: 'none',
        }}
      />
      {/* shimmer */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)',
          pointerEvents: 'none',
        }}
        animate={{ x: ['-150%', '250%'] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 6 }}
      />
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: small ? 5 : 8 }}>
        {icon}
        {label}
      </span>
    </button>
  );
};

// ─── HomeScreen ───────────────────────────────────────────────────────────────
const HomeScreen = ({
  onNavigate,
  onShowShare,
  onOpenMyPage,
}: {
  onNavigate: (phase: GamePhase) => void;
  onShowShare: () => void;
  onOpenMyPage: () => void;
}) => {
  const coins     = useGameStore(s => s.coins);
  const isVIP     = useGameStore(s => s.isVIP);
  const equipment = useGameStore(s => s.equipment);

  const equippedDetails = useMemo(() => ({
    head:      equipment.head      ? getItemById(equipment.head)      : undefined,
    body:      equipment.body      ? getItemById(equipment.body)      : undefined,
    face:      equipment.face      ? getItemById(equipment.face)      : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head,equipment.body,equipment.face,equipment.accessory]);

  const [kotobaLeafCount,  setKotobaLeafCount]  = useState(0);
  const [repairSpentCount, setRepairSpentCount] = useState(0);
  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    migrateRepairProgressIfNeeded();
    const sync = () => {
      setKotobaLeafCount(getRepairBookFragments());
      setRepairSpentCount(getRepairSpentFragments());
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const onVis = () => { if (document.visibilityState==='visible') sync(); };
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(sync, 800);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, []);

  const libraryRankInfo = useMemo(() => {
    const { totalBooks } = calcBooksFromFragments(repairSpentCount);
    return { ...calcRankInfo(totalBooks), totalBooks };
  }, [repairSpentCount]);

  const booksToNext: number   = (libraryRankInfo as any).booksToNext   ?? 0;
  const nextThreshold: number = (libraryRankInfo as any).nextThreshold ?? 20;
  const isMaxRank             = booksToNext === 0 && nextThreshold === 0;
  const isAlmostRankUp        = !isMaxRank && booksToNext <= 3;
  const progressRatio         = nextThreshold > 0
    ? Math.min(1,(nextThreshold - booksToNext)/nextThreshold) : 1;
  const GLOW = libraryRankInfo.tier.glow;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100dvh',
      overflowX: 'hidden',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style jsx>{`
        .homeBg {
          background-position: center top;
        }
        /* スマホだけ：背景を少し下へ（アバター見せ） */
        @media (max-width: 480px) {
          .homeBg {
            background-position: center 70px;
          }
        }
        .avatarButton {
          /* アバターが上方向にはみ出しても、直前カードに当たらない余白を確保 */
          margin-top: 6px;
          height: clamp(160px, 22vh, 220px);
        }
        @media (min-width: 481px) {
          .avatarButton {
            margin-top: 10px;
            height: max(230px, 26vh);
          }
        }
      `}</style>
      <div className="homeBg" style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'url(/images/backgrounds/home.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}/>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: [
          'linear-gradient(180deg,rgba(8,5,20,0.50) 0%,rgba(8,5,20,0.05) 18%)',
          'linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(8,5,20,0.82) 85%,rgba(8,5,20,0.95) 100%)',
        ].join(','),
        pointerEvents: 'none',
      }}/>

      {[
        {top:'12%',left:'6%', delay:0,   dur:3.4,size:10},
        {top:'25%',left:'88%',delay:0.9, dur:2.7,size:8 },
        {top:'7%', left:'76%',delay:1.5, dur:4.0,size:12},
        {top:'35%',left:'4%', delay:0.4, dur:3.1,size:7 },
      ].map((p,i)=>(
        <motion.span key={i} style={{
          pointerEvents:'none',position:'absolute',zIndex:2,userSelect:'none',
          top:p.top,left:p.left,fontSize:p.size,
          color:GLOW,textShadow:`0 0 8px ${GLOW},0 0 20px ${GLOW}66`,
        }}
          animate={{y:[0,-12,0],opacity:[0,0.8,0]}}
          transition={{duration:p.dur,delay:p.delay,repeat:Infinity,ease:'easeInOut'}}
        >✦</motion.span>
      ))}

      <div style={{
        position: 'relative', zIndex: 10,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px 16px',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        gap: 8,
        justifyContent: 'flex-start',
      }}>
        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:6}}>
          <button onClick={()=>{vibrateLight();onOpenMyPage();}} style={{
            padding:'6px 13px',borderRadius:18,fontSize:12,fontWeight:700,
            color:'rgba(255,255,255,0.85)',
            background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.14)',
            backdropFilter:'blur(8px)',cursor:'pointer',WebkitTapHighlightColor:'transparent',
          }}>マイページ</button>
          <button onClick={()=>{vibrateLight();onShowShare();}} style={{
            width:30,height:30,borderRadius:'50%',
            display:'flex',alignItems:'center',justifyContent:'center',
            background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.14)',
            color:'rgba(255,255,255,0.75)',cursor:'pointer',backdropFilter:'blur(8px)',
            WebkitTapHighlightColor:'transparent',
          }}><Share2 style={{width:13,height:13}}/></button>
          <AuthButton/>
        </div>

        {/* ── ゴールドバナー ── */}
        <motion.div
          initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          transition={{duration:0.4}}
          style={{position:'relative'}}
        >
          {/* 三重縁 */}
          <div style={{
            borderRadius:16,padding:2,
            background:'linear-gradient(180deg,#8b6008 0%,#5a3d04 100%)',
            boxShadow:'0 4px 18px rgba(0,0,0,0.65)',
          }}>
            <div style={{
              borderRadius:14,padding:'2px 2px 2px',
              background:'linear-gradient(180deg,#f5d060 0%,#d4a010 45%,#f5d060 100%)',
            }}>
              <div style={{
                borderRadius:12,padding:'8px 12px',
                background:'linear-gradient(180deg,#5c3a06 0%,#7a5010 40%,#5c3a06 100%)',
                boxShadow:'inset 0 2px 5px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,240,140,0.18)',
                display:'flex',alignItems:'center',justifyContent:'space-between',
              }}>
                {/* 左 */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{
                    width:36,height:36,borderRadius:9,flexShrink:0,
                    background:'linear-gradient(135deg,#ffe566,#b87800)',
                    border:'2px solid rgba(255,240,140,0.4)',
                    boxShadow:'0 2px 8px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,200,0.45)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
                  }}>⚔️</div>
                  {isVIP && (
                    <div style={{
                      display:'inline-flex',alignItems:'center',gap:2,
                      background:'rgba(255,200,0,0.18)',border:'1px solid rgba(255,220,60,0.35)',
                      borderRadius:8,padding:'1px 6px',fontSize:9,fontWeight:700,color:'#ffe070',
                    }}><Crown style={{width:9,height:9}}/>VIP</div>
                  )}
                  <div style={{
                    fontSize:19,fontWeight:900,letterSpacing:'0.04em',
                    color:'#fff8d0',
                    textShadow:'0 1px 0 rgba(0,0,0,0.8),0 0 14px rgba(255,230,80,0.5)',
                  }}>{libraryRankInfo.fullTitle}</div>
                </div>
                {/* 右：コイン */}
                <div style={{
                  display:'flex',alignItems:'center',gap:5,
                  background:'rgba(0,0,0,0.4)',borderRadius:18,padding:'5px 11px',
                  border:'1px solid rgba(240,208,80,0.35)',
                }}>
                  <div style={{
                    width:18,height:18,borderRadius:'50%',flexShrink:0,fontSize:10,
                    background:'linear-gradient(135deg,#ffe566,#b87800)',
                    border:'1.5px solid rgba(255,240,140,0.5)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>🪙</div>
                  <span style={{
                    fontSize:15,fontWeight:900,fontVariantNumeric:'tabular-nums',
                    color:'#fff8a0',textShadow:'0 1px 4px rgba(0,0,0,0.7)',
                  }}>{coins.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          {/* 左右◆ */}
          {['left','right'].map(s=>(
            <div key={s} style={{
              position:'absolute',top:'50%',[s]:-1,transform:'translateY(-50%)',
              fontSize:14,color:'#f0d060',
              textShadow:'0 0 6px #c89000,0 1px 2px rgba(0,0,0,0.8)',
              pointerEvents:'none',
            }}>◆</div>
          ))}
        </motion.div>

        {/* ── ランクカード（コンパクト横長版）── */}
        <motion.div
          initial={{opacity:0,scale:0.96,y:8}}
          animate={{opacity:1,scale:1,y:0}}
          transition={{duration:0.4,delay:0.1}}
          style={{
            position:'relative',overflow:'hidden',borderRadius:18,
            background:'linear-gradient(140deg,rgba(15,10,38,0.92),rgba(25,16,55,0.88),rgba(12,8,30,0.92))',
            border:`2px solid ${GLOW}77`,
            boxShadow:`0 0 0 1px ${GLOW}22,0 8px 28px rgba(0,0,0,0.55),0 0 30px ${GLOW}14`,
          }}
        >
          {/* 四隅装飾 */}
          {[
            {top:0,left:0,br:'0 0 10px 0'},{top:0,right:0,br:'0 0 0 10px'},
            {bottom:0,left:0,br:'0 10px 0 0'},{bottom:0,right:0,br:'10px 0 0 0'},
          ].map((c,i)=>(
            <div key={i} style={{
              position:'absolute',width:16,height:16,
              background:GLOW,opacity:0.4,borderRadius:c.br,pointerEvents:'none',
              ...(c.top    !==undefined?{top:c.top}:{}),
              ...(c.bottom !==undefined?{bottom:c.bottom}:{}),
              ...(c.left   !==undefined?{left:c.left}:{}),
              ...(c.right  !==undefined?{right:c.right}:{}),
            }}/>
          ))}

          <div style={{padding:'12px 14px 10px'}}>
            {/* 上段 */}
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <span style={{fontSize:10,fontWeight:800,letterSpacing:'0.18em',color:'rgba(255,255,255,0.45)'}}>
                    図書館ランク
                  </span>
                  <motion.div style={{
                    width:7,height:7,borderRadius:'50%',
                    background:GLOW,boxShadow:`0 0 0 3px ${GLOW}44`,
                  }}
                    animate={{boxShadow:[`0 0 0 2px ${GLOW}55`,`0 0 0 6px ${GLOW}00`]}}
                    transition={{duration:1.6,repeat:Infinity,ease:'easeOut'}}
                  />
                </div>
                <div style={{
                  fontSize:24,fontWeight:900,letterSpacing:'0.04em',lineHeight:1.05,
                  color:libraryRankInfo.tier.light,
                  textShadow:`0 0 20px ${GLOW}88,0 2px 10px rgba(0,0,0,0.8)`,
                }}>{libraryRankInfo.fullTitle}</div>
              </div>

              {/* 昇級まで */}
              <motion.div
                animate={isAlmostRankUp?{
                  borderColor:['rgba(239,68,68,0.4)','rgba(239,68,68,0.9)','rgba(239,68,68,0.4)'],
                  boxShadow:['0 0 0 0 transparent',`0 0 14px 2px rgba(239,68,68,0.4)`,'0 0 0 0 transparent'],
                }:{}}
                transition={{duration:1.4,repeat:Infinity}}
                style={{
                  flexShrink:0,minWidth:82,textAlign:'center',
                  background:'rgba(0,0,0,0.42)',borderRadius:14,padding:'8px 10px',
                  border:`1.5px solid ${isAlmostRankUp?'rgba(239,68,68,0.6)':'rgba(255,255,255,0.16)'}`,
                }}
              >
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:2}}>
                  <span style={{fontSize:13}}>🏆</span>
                  <span style={{fontSize:9,fontWeight:800,letterSpacing:'0.08em',color:'rgba(255,255,255,0.48)'}}>昇級まで</span>
                </div>
                {isMaxRank?(
                  <div style={{fontSize:13,fontWeight:900,color:'#fde68a'}}>MAX!</div>
                ):(
                  <div style={{lineHeight:1,display:'flex',alignItems:'baseline',justifyContent:'center',gap:1}}>
                    <motion.span
                      key={booksToNext}
                      initial={{scale:1.4,opacity:0}} animate={{scale:1,opacity:1}}
                      style={{
                        fontSize:34,fontWeight:900,fontVariantNumeric:'tabular-nums',letterSpacing:'-0.03em',
                        color:isAlmostRankUp?'#fca5a5':'#fde68a',
                        textShadow:isAlmostRankUp?'0 0 18px rgba(239,68,68,0.8)':'0 0 18px rgba(251,191,36,0.6)',
                      }}
                    >{booksToNext}</motion.span>
                    <span style={{fontSize:12,color:'rgba(255,255,255,0.28)',marginBottom:2}}>/{nextThreshold}</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ことの葉 + プログレスバー（横並び） */}
            <div style={{
              display:'flex',alignItems:'center',gap:10,
              background:'rgba(16,185,129,0.10)',borderRadius:12,padding:'8px 12px',marginBottom:8,
              border:'1.5px solid rgba(16,185,129,0.28)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                <span style={{fontSize:16}}>🍃</span>
                <span style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.55)'}}>ことの葉</span>
                <div style={{display:'flex',alignItems:'baseline',gap:2}}>
                  <span style={{
                    fontSize:22,fontWeight:900,fontVariantNumeric:'tabular-nums',
                    color:'#6ee7b7',textShadow:'0 0 12px rgba(52,211,153,0.5)',
                  }}>{kotobaLeafCount}</span>
                  <span style={{fontSize:11,fontWeight:700,color:'rgba(110,231,183,0.55)'}}>枚</span>
                </div>
              </div>

              {/* プログレスバー */}
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)'}}>修繕進捗</span>
                  <span style={{fontSize:9,fontWeight:700,color:isAlmostRankUp?'#fca5a5':'rgba(255,255,255,0.35)'}}>
                    {Math.round(progressRatio*100)}%
                  </span>
                </div>
                <div style={{
                  width:'100%',height:9,borderRadius:99,
                  background:'rgba(0,0,0,0.45)',border:'1px solid rgba(255,255,255,0.1)',
                  overflow:'hidden',
                }}>
                  <motion.div
                    initial={{width:0}}
                    animate={{width:`${progressRatio*100}%`}}
                    transition={{duration:1.1,delay:0.4,ease:'easeOut'}}
                    style={{
                      height:'100%',borderRadius:99,position:'relative',overflow:'hidden',
                      background:isAlmostRankUp
                        ?'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)'
                        :`linear-gradient(90deg,${GLOW},${libraryRankInfo.tier.light})`,
                      boxShadow:`0 0 8px ${isAlmostRankUp?'rgba(239,68,68,0.7)':GLOW+'88'}`,
                    }}
                  >
                    <motion.div
                      style={{
                        position:'absolute',inset:0,
                        background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
                      }}
                      animate={{x:['-130%','230%']}}
                      transition={{duration:2,repeat:Infinity,ease:'easeInOut',repeatDelay:2}}
                    />
                  </motion.div>
                </div>
              </div>
            </div>

            {/* リボン */}
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              background:`linear-gradient(135deg,${GLOW}14,rgba(255,255,255,0.02))`,
              borderRadius:10,padding:'5px 10px',
              border:`1px solid ${GLOW}25`,
            }}>
              <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.45)'}}>修繕してランクアップ</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.18)'}}>|</span>
              <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.45)'}}>クイズでことの葉を集めよう</span>
            </div>
          </div>
        </motion.div>

        {/* ── ポテトアバター（コンパクト）── */}
        <motion.button
          onClick={()=>{vibrateLight();onNavigate('dressup');}}
          whileTap={{scale:0.97}}
          className="avatarButton"
          style={{
            display:'flex',justifyContent:'center',alignItems:'flex-end',
            position:'relative',background:'none',border:'none',
            cursor:'pointer',WebkitTapHighlightColor:'transparent',
            flex:'0 0 auto',
            overflow:'visible',
          }}
        >
          {/* グロー床 */}
          <div style={{
            position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',
            width:160,height:20,borderRadius:'50%',
            background:`${GLOW}30`,filter:'blur(14px)',pointerEvents:'none',
          }}/>
          <PotatoAvatar
            equipped={equippedDetails} emotion="happy"
            size={180}   /* ← clampより小さめの固定値でOK、表示領域に合わせる */
            ssrEffect={false}
          />
          {/* 着せ替えボタン */}
          <div style={{
            position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
            background:'linear-gradient(90deg,#ec4899,#f43f5e)',
            borderRadius:18,padding:'4px 14px',
            display:'flex',alignItems:'center',gap:4,
            fontSize:11,fontWeight:800,color:'#fff',
            boxShadow:'0 3px 10px rgba(236,72,153,0.5),0 2px 0 rgba(0,0,0,0.3)',
            whiteSpace:'nowrap',
          }}>
            <Shirt style={{width:11,height:11}}/>着せ替え
          </div>
        </motion.button>

        {/* ── ボタン群 ── */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <RpgButton
            onClick={()=>{vibrateLight();onNavigate('suhimochi_room');}}
            fromColor="#065f46" toColor="#10b981"
            glowColor="rgba(16,185,129,0.4)" shadowColor="rgba(3,40,26,0.95)"
            icon={<MessageCircle style={{width:22,height:22}}/>}
            label="すうひもちのお部屋"
          />
          <RpgButton
            onClick={()=>{vibrateLight();onNavigate('academy');}}
            fromColor="#312e81" toColor="#6366f1"
            glowColor="rgba(99,102,241,0.4)" shadowColor="rgba(25,22,80,0.95)"
            icon={<BookOpen style={{width:22,height:22}}/>}
            label="図書館を復興する"
          />
          <RpgButton
            onClick={()=>{vibrateLight();onNavigate('adventure_menu');}}
            fromColor="#92400e" toColor="#f59e0b"
            glowColor="rgba(245,158,11,0.4)" shadowColor="rgba(70,28,4,0.95)"
            icon={<Scan style={{width:22,height:22}}/>}
            label="ことばを読み取る"
          />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <RpgButton
              onClick={()=>{vibrateLight();onNavigate('gacha');}}
              fromColor="#4c1d95" toColor="#8b5cf6"
              glowColor="rgba(139,92,246,0.4)" shadowColor="rgba(35,12,80,0.95)"
              icon={<Gem style={{width:17,height:17}}/>}
              label="ガチャ" small
            />
            <RpgButton
              onClick={()=>{vibrateLight();onNavigate('researcher_dex');}}
              fromColor="#78350f" toColor="#d97706"
              glowColor="rgba(217,119,6,0.4)" shadowColor="rgba(55,22,3,0.95)"
              icon={<Users style={{width:17,height:17}}/>}
              label="研究員図鑑" small
            />
          </div>
        </div>
      </div>

      <button
        onClick={()=>{vibrateLight();setShowSupportModal(true);}}
        style={{
          position:'fixed',bottom:20,right:16,zIndex:50,
          width:44,height:44,borderRadius:'50%',
          background:'linear-gradient(135deg,rgba(20,12,40,0.92),rgba(30,18,55,0.92))',
          border:'1.5px solid rgba(200,160,30,0.4)',
          boxShadow:'0 4px 16px rgba(0,0,0,0.55),0 0 12px rgba(200,160,30,0.2)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:20,cursor:'pointer',WebkitTapHighlightColor:'transparent',
          backdropFilter:'blur(8px)',
        }}
      >🧪</button>

      <AnimatePresence>
        {showSupportModal && (
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{
              position:'fixed',inset:0,zIndex:60,
              background:'rgba(0,0,0,0.72)',
              display:'flex',alignItems:'flex-end',justifyContent:'center',
              padding:'0 0 16px',
            }}
            onClick={()=>setShowSupportModal(false)}
          >
            <motion.div
              initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
              transition={{type:'spring',damping:28}}
              onClick={e=>e.stopPropagation()}
              style={{
                width:'100%',maxWidth:480,
                background:'linear-gradient(135deg,rgba(16,10,36,0.98),rgba(22,14,48,0.98))',
                borderRadius:'24px 24px 16px 16px',
                border:'1px solid rgba(200,160,30,0.25)',
                padding:'20px 18px 24px',
                boxShadow:'0 -8px 40px rgba(0,0,0,0.6)',
                margin:'0 14px',
              }}
            >
              <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)',margin:'0 auto 16px'}}/>
              <div style={{textAlign:'center',marginBottom:12}}>
                <div style={{fontSize:22,marginBottom:4}}>🧪✨</div>
                <div style={{fontSize:15,fontWeight:900,color:'#e8d5a0',textShadow:'0 0 12px rgba(200,160,30,0.4)'}}>
                  すうひもちコレクションを応援する
                </div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.38)',marginTop:2,fontWeight:600}}>
                  【あなたに寄り添う、言の葉の世界】
                </div>
              </div>
              <div style={{
                fontSize:12.5,color:'rgba(255,255,255,0.5)',lineHeight:1.75,
                borderTop:'1px solid rgba(255,255,255,0.08)',
                borderBottom:'1px solid rgba(255,255,255,0.08)',
                padding:'10px 0',marginBottom:14,
              }}>
                すうひもちコレクションは、失われたことば図書館を少しずつ復興していく学習RPGです。
                AI利用料や開発費を個人で負担しながら開発・運営しています。
                「面白い」「続いてほしい」と感じていただけたら、noteからのご支援が大きな力になります。
              </div>
              <DeveloperSupport/>
              <button
                onClick={()=>setShowSupportModal(false)}
                style={{
                  display:'block',width:'100%',marginTop:12,
                  padding:'10px',borderRadius:12,
                  background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',
                  color:'rgba(255,255,255,0.5)',fontSize:13,fontWeight:600,
                  cursor:'pointer',WebkitTapHighlightColor:'transparent',
                }}
              >閉じる</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ホーム画面（Complete RPG v4）
 */
const HomeScreen_v4_old = ({
  onNavigate,
  onShowShare,
  onOpenMyPage,
}: {
  onNavigate: (phase: GamePhase) => void;
  onShowShare: () => void;
  onOpenMyPage: () => void;
}) => {
  const coins = useGameStore(state => state.coins);
  const isVIP = useGameStore(state => state.isVIP);
  const equipment = useGameStore(state => state.equipment);

  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  const [kotobaLeafCount, setKotobaLeafCount] = useState(0);
  const [repairSpentCount, setRepairSpentCount] = useState(0);

  useEffect(() => {
    migrateRepairProgressIfNeeded();
    const sync = () => {
      setKotobaLeafCount(getRepairBookFragments());
      setRepairSpentCount(getRepairSpentFragments());
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(sync, 800);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, []);

  const libraryRankInfo = useMemo(() => {
    const { totalBooks } = calcBooksFromFragments(repairSpentCount);
    return { ...calcRankInfo(totalBooks), totalBooks };
  }, [repairSpentCount]);

  const booksToNext = libraryRankInfo.booksToNext;
  const nextThreshold = libraryRankInfo.nextThreshold;
  const isMaxRank = libraryRankInfo.isMaxRank;
  const isAlmostRankUp = !isMaxRank && booksToNext > 0 && booksToNext <= 3;
  const progressRatio = nextThreshold > 0
    ? Math.min(1, Math.max(0, (nextThreshold - booksToNext) / nextThreshold))
    : 1;
  const GLOW = libraryRankInfo.tier.glow;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: 0 }}>

      <div
        style={{
          pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/images/backgrounds/home.png)',
          backgroundSize: 'cover', backgroundPosition: 'center top',
        }}
      />
      <div style={{
        pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 0,
        background: [
          'linear-gradient(180deg,rgba(6,4,16,0.55) 0%,rgba(6,4,16,0.0) 20%)',
          'linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(6,4,16,0.80) 65%,rgba(6,4,16,1.00) 100%)',
        ].join(','),
      }}
      />
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, background: '#0d0b1a' }} />

      {[
        { top: '13%', left: '7%', delay: 0, dur: 3.4, size: 11 },
        { top: '28%', left: '89%', delay: 0.9, dur: 2.7, size: 9 },
        { top: '8%', left: '77%', delay: 1.5, dur: 4.1, size: 13 },
        { top: '39%', left: '4%', delay: 0.4, dur: 3.0, size: 7 },
        { top: '19%', left: '52%', delay: 2.2, dur: 3.7, size: 8 },
      ].map((p, i) => (
        <motion.span
          key={i}
          style={{
            pointerEvents: 'none', position: 'absolute', zIndex: 10, userSelect: 'none',
            top: p.top, left: p.left, fontSize: p.size,
            color: GLOW,
            textShadow: `0 0 8px ${GLOW}, 0 0 20px ${GLOW}66`,
          }}
          animate={{ y: [0, -14, 0], opacity: [0, 0.85, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          ✦
        </motion.span>
      ))}

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' }}>

        <div className="flex justify-end items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => { vibrateLight(); onOpenMyPage(); }}
            className="px-3 py-1.5 text-sm font-bold text-gray-200 transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20,
              backdropFilter: 'blur(8px)',
            }}
          >
            マイページ
          </button>
          <button
            type="button"
            onClick={() => { vibrateLight(); onShowShare(); }}
            className="p-2 text-gray-300 transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <AuthButton />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative mb-3"
        >
          <div style={{
            background: 'linear-gradient(180deg,#a07010 0%,#6b4a08 100%)',
            borderRadius: 18,
            padding: 2,
            boxShadow: '0 6px 24px rgba(0,0,0,0.7), 0 2px 0 #c8a02088 inset',
          }}
          >
            <div style={{
              background: 'linear-gradient(180deg,#f5d060 0%,#c8920a 50%,#f5d060 100%)',
              borderRadius: 16,
              padding: '2px 2px 3px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,200,0.6)',
            }}
            >
              <div style={{
                background: 'linear-gradient(180deg,#6b4a08 0%,#8a6010 40%,#6b4a08 100%)',
                borderRadius: 14,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,240,140,0.2)',
              }}
              >

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 40, height: 40,
                    background: 'linear-gradient(135deg,#ffe566 0%,#c88c00 100%)',
                    borderRadius: 10,
                    border: '2px solid #fff8a055',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,200,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}
                  >
                    ⚔️
                  </div>

                  <div style={{ minWidth: 0 }}>
                    {isVIP && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: 'rgba(255,200,0,0.18)', borderRadius: 10,
                        padding: '1px 7px', marginBottom: 2,
                        border: '1px solid rgba(255,220,60,0.35)',
                        fontSize: 10, fontWeight: 700, color: '#ffe070',
                      }}
                      >
                        <Crown style={{ width: 10, height: 10 }} />
                        VIP
                      </div>
                    )}
                    <div style={{
                      fontSize: 21, fontWeight: 900, letterSpacing: '0.05em',
                      color: '#fff8d0',
                      textShadow: '0 1px 0 rgba(0,0,0,0.8), 0 0 14px rgba(255,230,80,0.5)',
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    >
                      {libraryRankInfo.fullTitle}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 20, padding: '6px 13px',
                  border: '1px solid rgba(255,220,60,0.35)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                  flexShrink: 0,
                }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#ffe566,#c88c00)',
                    border: '1.5px solid #fff8a066',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, flexShrink: 0,
                  }}
                  >
                    🪙
                  </div>
                  <span style={{
                    fontSize: 16, fontWeight: 900,
                    color: '#fff8a0',
                    textShadow: '0 1px 5px rgba(0,0,0,0.7)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  >
                    {coins.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(['left', 'right'] as const).map((side) => (
            <div
              key={side}
              style={{
                position: 'absolute',
                top: '50%',
                ...(side === 'left' ? { left: -2 } : { right: -2 }),
                transform: 'translateY(-50%)',
                fontSize: 16,
                color: '#f5d060',
                textShadow: '0 0 6px #c89000, 0 1px 2px rgba(0,0,0,0.8)',
                pointerEvents: 'none',
              }}
            >
              ◆
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="relative mb-5 w-full max-w-sm mx-auto"
          style={{
            background: 'linear-gradient(135deg,rgba(18,14,40,0.92),rgba(28,20,60,0.88),rgba(14,12,34,0.92))',
            borderRadius: 22,
            border: `2px solid ${GLOW}88`,
            boxShadow: [
              `0 0 0 1px ${GLOW}22`,
              '0 8px 32px rgba(0,0,0,0.6)',
              `0 0 40px ${GLOW}18`,
            ].join(','),
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: -20, left: '50%',
            transform: 'translateX(-50%)',
            width: 200, height: 40, borderRadius: '50%',
            background: `${GLOW}30`,
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }}
          />

          {[
            { top: 0, left: 0, br: '0 0 10px 0' as const },
            { top: 0, right: 0, br: '0 0 0 10px' as const },
            { bottom: 0, left: 0, br: '0 10px 0 0' as const },
            { bottom: 0, right: 0, br: '10px 0 0 0' as const },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...(c.top !== undefined ? { top: c.top } : {}),
                ...(c.bottom !== undefined ? { bottom: c.bottom } : {}),
                ...(c.left !== undefined ? { left: c.left } : {}),
                ...(c.right !== undefined ? { right: c.right } : {}),
                width: 18, height: 18,
                background: GLOW,
                borderRadius: c.br,
                opacity: 0.55,
                pointerEvents: 'none',
              }}
            />
          ))}

          <div style={{ padding: '16px 18px 14px' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)' }}>
                    図書館ランク
                  </span>
                  <motion.div
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: GLOW,
                      boxShadow: `0 0 0 3px ${GLOW}44`,
                    }}
                    animate={{ boxShadow: [`0 0 0 2px ${GLOW}55`, `0 0 0 6px ${GLOW}00`] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1.05,
                  color: libraryRankInfo.tier.light,
                  textShadow: `0 0 24px ${GLOW}88, 0 2px 12px rgba(0,0,0,0.7), 0 0 48px ${GLOW}44`,
                }}
                >
                  {libraryRankInfo.fullTitle}
                </div>
              </div>

              <motion.div
                animate={isAlmostRankUp ? {
                  borderColor: ['rgba(239,68,68,0.4)', 'rgba(239,68,68,0.9)', 'rgba(239,68,68,0.4)'],
                  boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 12px 2px rgba(239,68,68,0.35)', '0 0 0 0 rgba(239,68,68,0)'],
                } : {}}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{
                  flexShrink: 0, minWidth: 90,
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 16, padding: '10px 14px',
                  border: `1.5px solid ${isAlmostRankUp ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.18)'}`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 15 }}>🏆</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
                    昇級まで
                  </span>
                </div>
                {isMaxRank ? (
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#fde68a' }}>MAX!</div>
                ) : (
                  <div style={{ lineHeight: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                    <motion.span
                      key={booksToNext}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        fontSize: 36, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                        color: isAlmostRankUp ? '#fca5a5' : '#fde68a',
                        textShadow: isAlmostRankUp
                          ? '0 0 16px rgba(239,68,68,0.7)'
                          : '0 0 16px rgba(251,191,36,0.5), 0 2px 4px rgba(0,0,0,0.5)',
                      }}
                    >
                      {booksToNext}
                    </motion.span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
                      /
                      {nextThreshold}
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(16,185,129,0.1)',
              borderRadius: 14, padding: '10px 14px', marginBottom: 12,
              border: '1.5px solid rgba(16,185,129,0.28)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(16,185,129,0.2)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}
                >
                  🍃
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                  ことの葉（所持）
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <motion.span
                  key={kotobaLeafCount}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    fontSize: 26, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                    color: '#6ee7b7',
                    textShadow: '0 0 12px rgba(52,211,153,0.5)',
                  }}
                >
                  {kotobaLeafCount}
                </motion.span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(110,231,183,0.6)' }}>枚</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>修繕進捗</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: isAlmostRankUp ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>
                  {Math.round(progressRatio * 100)}
                  %
                </span>
              </div>
              <div style={{
                width: '100%', height: 10, borderRadius: 99,
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
              }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressRatio * 100}%` }}
                  transition={{ duration: 1.2, delay: 0.35, ease: 'easeOut' }}
                  className="relative h-full overflow-hidden rounded-[99px]"
                  style={{
                    background: isAlmostRankUp
                      ? 'linear-gradient(90deg,#ef4444,#f97316,#fbbf24)'
                      : `linear-gradient(90deg,${GLOW},${libraryRankInfo.tier.light},#ffffff88)`,
                    boxShadow: `0 0 8px ${isAlmostRankUp ? '#ef444488' : `${GLOW}88`}`,
                  }}
                >
                  <motion.div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.55) 50%,transparent 100%)',
                    }}
                    animate={{ x: ['-120%', '220%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                  />
                </motion.div>
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `linear-gradient(135deg,${GLOW}18,rgba(255,255,255,0.04))`,
              borderRadius: 12, padding: '7px 12px',
              border: `1px solid ${GLOW}30`,
            }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>修繕してランクアップ</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>|</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>クイズでことの葉を集めよう</span>
            </div>
          </div>
        </motion.div>

        <motion.button
          type="button"
          style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 8px', position: 'relative', background: 'none', border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          onClick={() => { vibrateLight(); onNavigate('dressup'); }}
          whileTap={{ scale: 0.97 }}
        >
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            width: 180, height: 24, borderRadius: '50%',
            background: `${GLOW}35`,
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
          />
          <PotatoAvatar equipped={equippedDetails} emotion="happy" size={240} ssrEffect={false} />
          <div style={{
            position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg,#ec4899,#f43f5e)',
            borderRadius: 20, padding: '5px 16px',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px rgba(236,72,153,0.55), 0 2px 0 rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
          >
            <Shirt style={{ width: 12, height: 12 }} />
            着せ替え
          </div>
        </motion.button>

      </div>

      <div style={{
        position: 'relative', zIndex: 10,
        background: 'linear-gradient(180deg,rgba(8,6,20,0) 0%,rgba(8,6,20,0.88) 12%,rgba(8,6,20,0.97) 100%)',
        padding: '24px 16px 32px',
        borderTop: '1px solid rgba(200,160,30,0)',
      }}
      >
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(200,160,30,0.35),transparent)',
          pointerEvents: 'none',
        }}
        />

        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RpgButton
            onClick={() => { vibrateLight(); onNavigate('suhimochi_room'); }}
            fromColor="#065f46"
            toColor="#10b981"
            glowColor="rgba(16,185,129,0.45)"
            shadowColor="rgba(4,60,38,0.9)"
            icon={<Languages style={{ width: 24, height: 24 }} />}
            label="すうひもちと会話する"
          />
          <RpgButton
            onClick={() => { vibrateLight(); onNavigate('academy'); }}
            fromColor="#312e81"
            toColor="#6366f1"
            glowColor="rgba(99,102,241,0.45)"
            shadowColor="rgba(30,27,90,0.9)"
            icon={<GraduationCap style={{ width: 24, height: 24 }} />}
            label="ことば図書館"
          />
          <RpgButton
            onClick={() => { vibrateLight(); onNavigate('adventure_menu'); }}
            fromColor="#92400e"
            toColor="#f59e0b"
            glowColor="rgba(245,158,11,0.45)"
            shadowColor="rgba(80,35,5,0.9)"
            icon={<Sword style={{ width: 24, height: 24 }} />}
            label="スキャンする"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <RpgButton
              onClick={() => { vibrateLight(); onNavigate('gacha'); }}
              fromColor="#4c1d95"
              toColor="#8b5cf6"
              glowColor="rgba(139,92,246,0.45)"
              shadowColor="rgba(40,15,90,0.9)"
              icon={<Gem style={{ width: 18, height: 18 }} />}
              label="ガチャ"
              small
            />
            <RpgButton
              onClick={() => { vibrateLight(); onNavigate('researcher_dex'); }}
              fromColor="#78350f"
              toColor="#d97706"
              glowColor="rgba(217,119,6,0.45)"
              shadowColor="rgba(60,28,5,0.9)"
              icon={<Users style={{ width: 18, height: 18 }} />}
              label="研究員図鑑"
              small
            />
          </div>
        </div>
      </div>

      <div style={{
        background: '#080614', padding: '0 16px 48px',
        position: 'relative', zIndex: 10,
      }}
      >
        <div style={{
          height: 1, marginBottom: 20,
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',
        }}
        />
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{
            borderRadius: 20,
            border: '1px solid rgba(200,160,30,0.2)',
            background: 'linear-gradient(135deg,rgba(18,12,38,0.98),rgba(24,16,50,0.98))',
            padding: '20px 18px',
            boxShadow: 'inset 0 1px 0 rgba(200,160,30,0.12), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
          >
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 24, marginBottom: 5 }}>🧪✨</div>
              <div style={{
                fontSize: 15, fontWeight: 900, letterSpacing: '0.03em',
                color: '#e8d5a0', textShadow: '0 0 14px rgba(200,160,30,0.4)',
              }}
              >
                すうひもちコレクションを応援する
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 3, fontWeight: 600 }}>
                【あなたに寄り添う、言の葉の世界】
              </div>
            </div>
            <div style={{
              fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '12px 0', marginBottom: 14,
            }}
            >
              すうひもちコレクションは、失われたことば図書館を少しずつ復興していく学習RPGです。
              現在AI利用料や開発費を負担しながら、個人で開発・運営しています。
              「面白い」「続いてほしい」と感じていただけたら、noteからのご支援が開発継続の大きな力になります。
            </div>
            <DeveloperSupport />
          </div>
        </div>
      </div>
    </div>
  );
};

void HomeScreen_v4_old;

const MyPageScreen = ({
  displayName,
  onBack,
  onEditName,
}: {
  displayName: string;
  onBack: () => void;
  onEditName: () => void;
}) => {
  const totalScans = useGameStore((s) => s.totalScans);
  const totalQuizzes = useGameStore((s) => s.totalQuizzes);
  const totalMessages = useGameStore((s) => s.suhimochiIntimacy.totalMessages);
  const intimacyLevel = useGameStore((s) => s.suhimochiIntimacy.level);
  const intimacyPoints = useGameStore((s) => s.suhimochiIntimacy.points);
  const consecutiveDays = useGameStore((s) => s.consecutiveLoginDays);
  const isVIP = useGameStore((s) => s.isVIP);
  const coins = useGameStore((s) => s.coins);
  const equipment = useGameStore((s) => s.equipment);

  const equippedDetails = useMemo(
    () => ({
      head: equipment.head ? getItemById(equipment.head) : undefined,
      body: equipment.body ? getItemById(equipment.body) : undefined,
      face: equipment.face ? getItemById(equipment.face) : undefined,
      accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
    }),
    [equipment.head, equipment.body, equipment.face, equipment.accessory]
  );


  const INTIMACY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'はじめまして',
    2: 'なかよし',
    3: 'ともだち',
    4: 'しんゆう',
    5: 'ずっといっしょ',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-gray-900/80 backdrop-blur border-b border-gray-700/50">
        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-white font-bold text-base">マイページ</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <PotatoAvatar
                equipped={equippedDetails}
                emotion="happy"
                size={80}
                ssrEffect={false}
                showShadow={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white text-xl font-bold truncate max-w-[180px]">
                  {displayName || '未設定'}
                </p>
                {isVIP && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    👑 VIP
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-1">{consecutiveDays}日連続ログイン中</p>
              <div className="mt-1 flex items-center gap-1 text-yellow-400 text-sm font-semibold">
                <Coins className="w-3.5 h-3.5" />
                {coins} コイン
              </div>
            </div>
          </div>

          <motion.button
            onClick={() => {
              vibrateLight();
              onEditName();
            }}
            className="mt-4 w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            whileTap={{ scale: 0.98 }}
          >
            ✏️ 名前を変更
          </motion.button>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧸</span>
            <h2 className="text-rose-200 font-bold text-sm">すうひもちとの関係</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-2xl font-bold">
                {INTIMACY_LABELS[intimacyLevel as 1 | 2 | 3 | 4 | 5]}
              </p>
              <p className="text-rose-300/70 text-xs mt-0.5">{totalMessages}回会話した</p>
            </div>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5] as const).map((lv) => (
                <div
                  key={lv}
                  className={`rounded-full transition-all ${
                    lv <= intimacyLevel ? 'w-3 h-3 bg-rose-400' : 'w-2.5 h-2.5 bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (intimacyPoints / 1000) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs text-rose-400/60 mt-1">Lv.{intimacyLevel} / 5</p>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📊</span>
            <h2 className="text-gray-200 font-bold text-sm">学習の記録</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'スキャン回数', value: totalScans, unit: '回' },
              { label: 'クイズ回答数', value: totalQuizzes, unit: '問' },
              { label: '会話回数', value: totalMessages, unit: '回' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-gray-700/50 px-4 py-3 text-center">
                <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
                <p className="text-white text-2xl font-bold">
                  {stat.value}
                  <span className="text-gray-400 text-sm font-normal ml-0.5">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔐</span>
            <h2 className="text-gray-200 font-bold text-sm">アカウント</h2>
          </div>
          <p className="text-gray-400 text-xs mb-4">
            Googleアカウントでログインすると、データが複数の端末で引き継げます。
          </p>
          <AuthButton />
        </div>
      </div>
    </div>
  );
};

/**
 * 翻訳モード選択画面
 */
const TranslationModeSelectScreen = ({
  onSelectMode,
  onBack,
  onOpenHistory,
}: {
  onSelectMode: (mode: 'english_learning' | 'multilang') => void;
  onBack: () => void;
  onOpenHistory: () => void;
}) => {
  const translationHistoryCount = useGameStore(state => state.translationHistory.length);
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-md mx-auto pt-6">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">翻訳モードを選択</h2>
        <p className="text-gray-400 text-sm text-center mb-6">目的に合わせてモードを選んでください</p>

        {/* 翻訳履歴へのショートカット */}
        {translationHistoryCount > 0 && (
          <div className="mb-4 flex justify-center">
            <motion.button
              onClick={() => {
                vibrateLight();
                onOpenHistory();
              }}
              className="px-3 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-200 text-xs flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Languages className="w-3 h-3" />
              翻訳履歴を見る
              <span className="ml-1 px-2 py-0.5 bg-white/10 rounded-full text-[10px]">
                {translationHistoryCount}
              </span>
            </motion.button>
          </div>
        )}

        <div className="space-y-4">
          {/* 英語学習・構造解析モード */}
          <motion.button
            onClick={() => {
              vibrateLight();
              useGameStore.getState().setTranslationMode('english_learning');
              useGameStore.getState().setScanType('translation');
              onSelectMode('english_learning');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-left shadow-lg shadow-blue-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎓</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">英語学習・構造解析モード</h3>
                <p className="text-sm text-blue-100 leading-relaxed">
                  初学者からTOEIC学習者まで、英文の骨格（S+V+O）や修飾関係を可視化し、直読直解の練習をサポートします。
                  <br />
                  語順のまま理解するための構造カードとシンプルな解説で、文法の要点を押さえながら読み進められます。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">初学者</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">TOEIC対応</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">構造解析</span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* 多言語・翻訳モード */}
          <motion.button
            onClick={() => {
              vibrateLight();
              useGameStore.getState().setTranslationMode('multilang');
              useGameStore.getState().setScanType('translation');
              onSelectMode('multilang');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 text-white text-left shadow-lg shadow-green-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">🌏</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">多言語・翻訳モード</h3>
                <p className="text-sm text-green-100 leading-relaxed">
                  全世界の言語に対応。文脈を読み取り、自然で分かりやすい日本語に意訳します。
                  <br />
                  論文の要約や、第二外国語の勉強、海外製品の説明書などに。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">多言語対応</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">自然な日本語</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">文脈理解</span>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 w-full py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

/**
 * モード選択画面
 */
const ModeSelectScreen = ({
  onSelectMode,
  onBack,
}: {
  onSelectMode: (mode: QuizMode) => void;
  onBack: () => void;
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 flex flex-col">
      <div className="max-w-md mx-auto flex-1 flex flex-col justify-center">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          モードを選択
        </h2>

        <div className="space-y-4">
          {/* Speed Rush */}
          <motion.button
            onClick={() => {
              vibrateLight();
              onSelectMode('speed_rush');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 text-left hover:border-cyan-400 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Speed Rush</h3>
                <p className="text-gray-400 text-sm">
                  タイムアタック！素早く答えて敵を倒せ
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">タイマーあり</span>
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">ハイスコア</span>
            </div>
          </motion.button>

          {/* Potato Pupil */}
          <motion.button
            onClick={() => {
              vibrateLight();
              onSelectMode('potato_pupil');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-[#1a3c28] to-[#2d5a3f] border-2 border-orange-500/50 text-left hover:border-orange-400 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Potato Pupil</h3>
                <p className="text-gray-300 text-sm">
                  ポテトと一緒に楽しく学ぼう
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">解説付き</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">初心者向け</span>
            </div>
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

// ===== Main App Content =====

const AppContent = () => {
  // State
  const [phase, setPhase] = useState<GamePhase>('home');
  const [wordDexBackPhase, setWordDexBackPhase] = useState<GamePhase>('scanning');
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusData, setLoginBonusData] = useState({ coins: 0, days: 1 });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedLectureHistory, setSelectedLectureHistory] = useState<LectureHistory | null>(null);

  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const displayName = useGameStore(state => state.displayName);
  const setDisplayName = useGameStore(state => state.setDisplayName);
  const setUserId = useGameStore(state => state.setUserId);
  const equipment = useGameStore(state => state.equipment);
  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  // 初回起動時のログインチェック & Firebase認証状態の反映（1回のみ）
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // 初回のみ実行
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const loginCheck = useGameStore.getState().loginCheck;
    const launched = useGameStore.getState().hasLaunched;

    // 1. ローカルのログインボーナスなど（初回のみ）
    const result = loginCheck();
    if (result.isNewDay && result.bonusCoins > 0) {
      setLoginBonusData({
        coins: result.bonusCoins,
        days: useGameStore.getState().consecutiveLoginDays,
      });
      setShowLoginBonus(true);
    }

    if (!launched) {
      setShowOnboarding(true);
    }

    // 2. Firebase Auth のログイン状態をストアに反映（リロード後もログイン継続）
    if (auth) {
      const authInstance = auth;
      let disposed = false;
      let nullUserTimer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (disposed) return;

        // user がいれば即時反映
        if (user) {
          if (nullUserTimer) {
            clearTimeout(nullUserTimer);
            nullUserTimer = null;
          }
          await setUserId(user.uid);
          return;
        }

        // リロード直後に一瞬 null が来る環境向け:
        // 少し待って currentUser を再確認してからログアウト扱いにする
        if (nullUserTimer) {
          clearTimeout(nullUserTimer);
        }
        nullUserTimer = setTimeout(async () => {
          if (disposed) return;
          const restoredUser = authInstance.currentUser;
          await setUserId(restoredUser ? restoredUser.uid : null);
        }, 400);
      });
      return () => {
        disposed = true;
        if (nullUserTimer) {
          clearTimeout(nullUserTimer);
          nullUserTimer = null;
        }
        unsubscribe();
      };
    }

    return;
  }, [setUserId]);

  // オンボーディング終了
  const handleDismissOnboarding = useCallback(() => {
    vibrateLight();
    setShowOnboarding(false);
    useGameStore.getState().setHasLaunched();
    const currentDisplayName = useGameStore.getState().displayName;
    if (!String(currentDisplayName ?? '').trim()) {
      setDisplayNameDraft('');
      setIsEditingDisplayName(false);
      setShowDisplayNameModal(true);
    }
  }, []);

  const handleSaveDisplayName = useCallback(() => {
    const normalized = displayNameDraft.trim().slice(0, 12);
    if (!normalized) return;
    setDisplayName(normalized);
    setShowDisplayNameModal(false);
    setIsEditingDisplayName(false);
  }, [displayNameDraft, setDisplayName]);

  const handleSkipDisplayName = useCallback(() => {
    const tempName = pickTemporaryDisplayName();
    setDisplayName(tempName);
    setDisplayNameDraft(tempName);
    setShowDisplayNameModal(false);
    setIsEditingDisplayName(false);
  }, [setDisplayName]);

  const handleOpenDisplayNameEdit = useCallback(() => {
    setDisplayNameDraft(displayName || '');
    setIsEditingDisplayName(true);
    setShowDisplayNameModal(true);
  }, [displayName]);

  // クイズ準備完了
  const handleQuizReady = useCallback((quiz: QuizRaw, imageUrl: string) => {
    const batchId = useGameStore.getState().lastScanQuizId ?? undefined;
    setQuizSession({
      quiz,
      imageUrl,
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: false,
      batchId,
    });
    setPhase('mode_select');
  }, []);

  // 翻訳準備完了
  const handleTranslationReady = useCallback((result: TranslationResult, imageUrl?: string) => {
    const store = useGameStore.getState();
    store.setTranslationResult(result);
    // 翻訳履歴に保存（imageUrlも含む）
    store.saveTranslationHistory(result, imageUrl);
    setPhase('translation_result');
  }, []);

  // フリークエスト開始
  const handleFreeQuestStart = useCallback((quiz: QuizRaw, sourceHistoryId?: string) => {
    // フリークエストは既存履歴を上書き更新するため、開始元履歴IDを保持する
    useGameStore.getState().setLastScanQuizId(sourceHistoryId ?? null);
    setQuizSession({
      quiz,
      imageUrl: '',
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: true,
      batchId: sourceHistoryId,
    });
    setPhase('mode_select');
  }, []);

  // モード選択
  const handleModeSelect = useCallback((mode: QuizMode) => {
    if (quizSession) {
      setQuizSession({ ...quizSession, mode });
      setPhase('quiz');
    }
  }, [quizSession]);

  // クイズ完了
  const handleQuizComplete = useCallback((correctCount: number, _totalQuestions: number, speedRushTotalTime?: number, attempts?: QuizQuestionAttempt[]) => {
    if (quizSession) {
      setQuizSession({ ...quizSession, correctCount, speedRushTotalTime, attempts });
      setPhase('result');
    }
  }, [quizSession]);

  // ナビゲーション
  const handleNavigate = useCallback((newPhase: GamePhase) => {
    setPhase(newPhase);
  }, []);

  const handleOpenWordDex = useCallback((backPhase: GamePhase) => {
    setWordDexBackPhase(backPhase);
    setPhase('worddex');
  }, []);

  // ホームに戻る
  const handleBackToHome = useCallback(() => {
    setPhase('home');
    setQuizSession(null);
  }, []);

  // フェーズ変更時に必ずスクロール位置を先頭に戻す
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [phase]);

  return (
    <main className="relative">
      <AnimatePresence mode="wait">
        {phase === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HomeScreen 
              onNavigate={handleNavigate} 
              onShowShare={() => setShowShareModal(true)}
              onOpenMyPage={() => handleNavigate('mypage')}
            />
          </motion.div>
        )}

        {phase === 'mypage' && (
          <motion.div
            key="mypage"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <MyPageScreen
              displayName={displayName}
              onBack={handleBackToHome}
              onEditName={handleOpenDisplayNameEdit}
            />
          </motion.div>
        )}

        {phase === 'translation_mode_select' && (
          <motion.div
            key="translation_mode_select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TranslationModeSelectScreen
              onSelectMode={() => {
                handleNavigate('scanning');
              }}
              onBack={() => handleNavigate('home')}
              onOpenHistory={() => handleNavigate('translation_history')}
            />
          </motion.div>
        )}

        {phase === 'adventure_menu' && (
          <motion.div
            key="adventure_menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AdventureMenuScreen
              onBack={() => handleNavigate('home')}
              onOpenScanAdventure={() => {
                useGameStore.getState().setScanType('quiz');
                handleNavigate('scanning');
              }}
              onOpenEnglishReading={() => {
                useGameStore.getState().setTranslationMode('english_learning');
                useGameStore.getState().setScanType('translation');
                handleNavigate('scanning');
              }}
              onQuickQuizReady={(quiz, imageUrl) => {
                setQuizSession({
                  quiz,
                  imageUrl,
                  mode: 'potato_pupil',
                  correctCount: 0,
                  isFreeQuest: false,
                });
                setPhase('mode_select');
              }}
            />
          </motion.div>
        )}

        {phase === 'suhimochi_room' && (
          <motion.div
            key="suhimochi_room"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SuhimochiRoomScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'academy' && (
          <motion.div
            key="academy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <AcademyScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ScanningScreen 
              onQuizReady={handleQuizReady}
              onTranslationReady={handleTranslationReady}
              onOpenFreeQuest={() => handleNavigate('freequest')}
              onOpenWordDex={() => handleOpenWordDex('scanning')}
              onBack={handleBackToHome}
            />
          </motion.div>
        )}

        {phase === 'translation_result' && (
          <TranslationResultScreenWrapper 
            onBack={handleBackToHome}
          />
        )}

        {phase === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ModeSelectScreen
              onSelectMode={handleModeSelect}
              onBack={() => quizSession?.isFreeQuest ? setPhase('freequest') : setPhase('scanning')}
            />
          </motion.div>
        )}

        {phase === 'quiz' && quizSession && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <QuizGameScreen
              quiz={quizSession.quiz}
              mode={quizSession.mode}
              onComplete={handleQuizComplete}
              equipped={equippedDetails}
            />
          </motion.div>
        )}

        {phase === 'result' && quizSession && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultScreen
              quiz={quizSession.quiz}
              correctCount={quizSession.correctCount}
              totalQuestions={quizSession.quiz.questions.length}
              onContinue={handleBackToHome}
              onContinueFreeQuest={quizSession.isFreeQuest ? () => setPhase('freequest') : undefined}
              onOpenWordDex={() => handleOpenWordDex('scanning')}
              isFreeQuest={quizSession.isFreeQuest}
              batchId={quizSession.batchId}
              attempts={quizSession.attempts}
              mode={quizSession.mode}
              speedRushTotalTime={quizSession.speedRushTotalTime}
            />
          </motion.div>
        )}

        {phase === 'worddex' && (
          <motion.div
            key="worddex"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <QuizWordDexScreen onBack={() => setPhase(wordDexBackPhase)} />
          </motion.div>
        )}

        {phase === 'gacha' && (
          <motion.div
            key="gacha"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GachaScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'researcher_dex' && (
          <motion.div
            key="researcher_dex"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ResearcherDexScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'dressup' && (
          <motion.div
            key="dressup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <DressUpScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'freequest' && (
          <motion.div
            key="freequest"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <FreeQuestScreen 
              onBack={handleBackToHome}
              onStartQuiz={handleFreeQuestStart}
            />
          </motion.div>
        )}

        {phase === 'translation_history' && (
          <motion.div
            key="translation_history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TranslationHistoryScreen 
              onBack={handleBackToHome}
            />
          </motion.div>
        )}

        {phase === 'lecture' && (
          <motion.div
            key="lecture"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <LectureScreen 
              onBack={() => {
                setSelectedLectureHistory(null);
                handleBackToHome();
              }}
              initialHistory={selectedLectureHistory || undefined}
            />
          </motion.div>
        )}

        {phase === 'lecture_history' && (
          <motion.div
            key="lecture_history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <LectureHistoryScreen 
              onBack={handleBackToHome}
              onSelectLecture={(history) => {
                // 講義履歴から選択した場合は、講義画面に遷移してその講義を表示
                setSelectedLectureHistory(history);
                handleNavigate('lecture');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ログインボーナスモーダル */}
      <LoginBonusModal
        isOpen={showLoginBonus}
        onClose={() => setShowLoginBonus(false)}
        bonusCoins={loginBonusData.coins}
        consecutiveDays={loginBonusData.days}
        isVIP={isVIP}
      />

      {/* オンボーディングオーバーレイ */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay onDismiss={handleDismissOnboarding} />
        )}
      </AnimatePresence>

      {/* 表示名設定モーダル（初回/編集） */}
      <AnimatePresence>
        {showDisplayNameModal && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-5"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
            >
              <h3 className="text-white text-lg font-bold mb-2">
                {isEditingDisplayName ? '表示名を変更' : '表示名を決めよう'}
              </h3>
              <p className="text-gray-300 text-sm mb-4">あとで変更できます</p>

              <input
                type="text"
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value.slice(0, 12))}
                placeholder="1〜12文字で入力"
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                maxLength={12}
              />
              <p className="text-right text-xs text-gray-400 mt-1">{displayNameDraft.length}/12</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    vibrateLight();
                    if (isEditingDisplayName) {
                      setShowDisplayNameModal(false);
                      setIsEditingDisplayName(false);
                      return;
                    }
                    handleSkipDisplayName();
                  }}
                  className="py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold"
                >
                  {isEditingDisplayName ? 'キャンセル' : 'スキップ'}
                </button>
                <button
                  onClick={() => {
                    vibrateLight();
                    handleSaveDisplayName();
                  }}
                  disabled={!displayNameDraft.trim()}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* シェアモーダル */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </main>
  );
};

// ===== Main Component =====

export default function Home() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
