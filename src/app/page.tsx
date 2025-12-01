'use client';

/**
 * Potenote Scanner v2 - Main Page
 * 
 * GamePhase管理とすべての画面を統合
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Gem, Map, Crown, Coins, Zap, BookOpen, Shirt, History, Languages } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getItemById } from '@/data/items';

// Screens
import { ScanningScreen } from '@/components/screens/ScanningScreen';
import { QuizGameScreen, type QuizMode } from '@/components/screens/QuizGameScreen';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { GachaScreen } from '@/components/screens/GachaScreen';
import { MapScreen } from '@/components/screens/MapScreen';
import { DressUpScreen } from '@/components/screens/DressUpScreen';
import { FreeQuestScreen } from '@/components/screens/FreeQuestScreen';
import { TranslationResultScreen } from '@/components/screens/TranslationResultScreen';
import { TranslationHistoryScreen } from '@/components/screens/TranslationHistoryScreen';

// UI Components
import { LoginBonusModal } from '@/components/ui/LoginBonusModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { BannerAd } from '@/components/ui/BannerAd';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthButton } from '@/components/ui/AuthButton';
import { OnboardingOverlay } from '@/components/ui/OnboardingOverlay';

import { vibrateLight } from '@/lib/haptics';
import type { QuizRaw, StructuredOCR } from '@/types';

// ===== Types =====

type GamePhase = 
  | 'home'
  | 'scanning'
  | 'mode_select'
  | 'quiz'
  | 'result'
  | 'gacha'
  | 'map'
  | 'dressup'
  | 'freequest'
  | 'translation_result'
  | 'translation_history';

interface QuizSession {
  quiz: QuizRaw;
  imageUrl: string;
  mode: QuizMode;
  correctCount: number;
  isFreeQuest?: boolean;
  ocrText?: string;
  structuredOCR?: StructuredOCR;
}

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
 * ホーム画面
 */
const HomeScreen = ({
  onNavigate,
}: {
  onNavigate: (phase: GamePhase) => void;
}) => {
  const coins = useGameStore(state => state.coins);
  const isVIP = useGameStore(state => state.isVIP);
  const totalDistance = useGameStore(state => state.journey.totalDistance);
  const totalQuizzes = useGameStore(state => state.totalQuizzes);
  const quizHistoryCount = useGameStore(state => state.quizHistory.length);
  const translationHistoryCount = useGameStore(state => state.translationHistory.length);
  const equipment = useGameStore(state => state.equipment);
  // const [showShop, setShowShop] = useState(false); // 一時的に非表示
  // const activateVIP = useGameStore(state => state.activateVIP); // 一時的に非表示

  // ホーム表示時にスクロール位置を先頭にリセット
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  // 装備アイテムの詳細を取得（useMemoで安定化）
  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  // VIP購入（一時的に非表示）
  // const handleVIPPurchase = () => {
  //   const expiresAt = new Date();
  //   expiresAt.setMonth(expiresAt.getMonth() + 1);
  //   activateVIP(expiresAt);
  //   setShowShop(false);
  // };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold gradient-text">
              Potenote Scanner
            </h1>
            {/* VIPバッジ（購入ボタンは一時的に非表示） */}
            {isVIP && (
              <div className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Crown className="w-3 h-3 text-yellow-400" />
                VIP
              </div>
            )}
          </div>
          {/* 右上: Googleログインボタン */}
          <AuthButton />
          {/* <button
            onClick={() => {
              vibrateLight();
              setShowShop(true);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 ${
              isVIP 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Crown className={`w-4 h-4 ${isVIP ? 'text-yellow-400' : ''}`} />
            {isVIP ? 'VIP' : 'VIPになる'}
          </button> */}
        </div>

        {/* ステータスバー */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold">{coins}</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
            <Map className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-bold">{totalDistance.toFixed(1)}<span className="text-xs text-gray-400">km</span></span>
          </div>
        </div>

        {/* ポテトアバター（タップで着せ替え） */}
        <motion.button 
          className="flex justify-center mb-4 mx-auto relative"
          onClick={() => {
            vibrateLight();
            onNavigate('dressup');
          }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <PotatoAvatar
            equipped={equippedDetails}
            emotion="happy"
            size={160}
            ssrEffect={isVIP}
          />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-pink-500/80 text-white text-xs rounded-full flex items-center gap-1">
            <Shirt className="w-3 h-3" />
            着せ替え
          </div>
        </motion.button>

        {/* 統計 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-3xl font-bold text-white">{totalQuizzes}</p>
            <p className="text-sm text-gray-400">クイズ完了</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
            <p className="text-3xl font-bold text-white">
              {Math.floor(totalDistance / 100)}
            </p>
            <p className="text-sm text-gray-400">到達した島</p>
          </div>
        </div>

        {/* メインアクション */}
        <motion.button
          onClick={() => {
            vibrateLight();
            useGameStore.getState().setScanType('quiz');
            onNavigate('scanning');
          }}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-cyan-500/25"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Scan className="w-7 h-7" />
          スキャンして学ぶ（クイズ）
        </motion.button>

        {/* スキャン翻訳ボタン */}
        <motion.button
          onClick={() => {
            vibrateLight();
            const checkLimit = useGameStore.getState().checkTranslationLimit();
            if (!checkLimit.canTranslate) {
              // 制限オーバーの場合はエラーメッセージを表示（将来的に広告モーダルを表示）
              alert(checkLimit.error || '翻訳回数の上限に達しました');
              return;
            }
            useGameStore.getState().setScanType('translation');
            onNavigate('scanning');
          }}
          className="w-full mt-3 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Languages className="w-5 h-5" />
          スキャン翻訳
        </motion.button>

        {/* フリークエスト */}
        {quizHistoryCount > 0 && (
          <motion.button
            onClick={() => {
              vibrateLight();
              onNavigate('freequest');
            }}
            className="w-full mt-3 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <History className="w-5 h-5" />
            フリークエスト
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {quizHistoryCount}
            </span>
          </motion.button>
        )}

        {/* サブアクション */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <motion.button
            onClick={() => {
              vibrateLight();
              onNavigate('gacha');
            }}
            className="py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Gem className="w-5 h-5" />
            ガチャ
          </motion.button>

          <motion.button
            onClick={() => {
              vibrateLight();
              onNavigate('map');
            }}
            className="py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Map className="w-5 h-5" />
            マップ
          </motion.button>
        </div>

        {/* 翻訳履歴ボタン */}
        {translationHistoryCount > 0 && (
          <motion.button
            onClick={() => {
              vibrateLight();
              onNavigate('translation_history');
            }}
            className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Languages className="w-5 h-5" />
            翻訳履歴を見る
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {translationHistoryCount}
            </span>
          </motion.button>
        )}
      </div>

      {/* ショップモーダル（一時的に非表示） */}
      {/* <ShopModal
        isOpen={showShop}
        onClose={() => setShowShop(false)}
        onPurchase={handleVIPPurchase}
        isVIP={isVIP}
      /> */}
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
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusData, setLoginBonusData] = useState({ coins: 0, days: 1 });
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Store
  const isVIP = useGameStore(state => state.isVIP);

  // 初回起動時のログインチェック（1回のみ）
  useEffect(() => {
    const loginCheck = useGameStore.getState().loginCheck;
    const launched = useGameStore.getState().hasLaunched;
    
    const result = loginCheck();
    if (result.isNewDay && result.bonusCoins > 0) {
      setLoginBonusData({
        coins: result.bonusCoins,
        days: useGameStore.getState().consecutiveLoginDays,
      });
      setShowLoginBonus(true);
    }

    // 初回起動時のオンボーディング
    if (!launched) {
      setShowOnboarding(true);
    }
  }, []); // 空の依存配列で1回のみ実行

  // オンボーディング終了
  const handleDismissOnboarding = useCallback(() => {
    vibrateLight();
    setShowOnboarding(false);
    useGameStore.getState().setHasLaunched();
  }, []);

  // クイズ準備完了
  const handleQuizReady = useCallback((quiz: QuizRaw, imageUrl: string, ocrText?: string, structuredOCR?: StructuredOCR) => {
    setQuizSession({
      quiz,
      imageUrl,
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: false,
      ocrText,
      structuredOCR,
    });
    setPhase('mode_select');
  }, []);

  // 翻訳準備完了
  const handleTranslationReady = useCallback((result: { originalText: string; translatedText: string }, imageUrl?: string) => {
    const store = useGameStore.getState();
    store.setTranslationResult({
      originalText: result.originalText,
      translatedText: result.translatedText,
    });
    // 翻訳履歴に保存（imageUrlも含む）
    store.saveTranslationHistory(result, imageUrl);
    setPhase('translation_result');
  }, []);

  // フリークエスト開始
  const handleFreeQuestStart = useCallback((quiz: QuizRaw) => {
    setQuizSession({
      quiz,
      imageUrl: '',
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: true,
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
  const handleQuizComplete = useCallback((correctCount: number) => {
    if (quizSession) {
      setQuizSession({ ...quizSession, correctCount });
      setPhase('result');
    }
  }, [quizSession]);

  // ナビゲーション
  const handleNavigate = useCallback((newPhase: GamePhase) => {
    // 画面遷移時にスクロール位置をリセット
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    setPhase(newPhase);
  }, []);

  // ホームに戻る
  const handleBackToHome = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    setPhase('home');
    setQuizSession(null);
  }, []);

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
            <HomeScreen onNavigate={handleNavigate} />
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
              onBack={handleBackToHome}
            />
          </motion.div>
        )}

        {phase === 'translation_result' && (
          <TranslationResultScreenWrapper onBack={handleBackToHome} />
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
              onViewMap={() => setPhase('map')}
              isFreeQuest={quizSession.isFreeQuest}
              ocrText={quizSession.ocrText}
              structuredOCR={quizSession.structuredOCR}
            />
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

        {phase === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <MapScreen onBack={handleBackToHome} />
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
      </AnimatePresence>

      {/* バナー広告（Freeユーザー・ホーム画面のみ） */}
      <BannerAd
        isVisible={!isVIP && phase === 'home'}
      />

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
