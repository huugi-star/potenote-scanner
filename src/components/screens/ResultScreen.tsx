/**
 * ResultScreen.tsx
 * 
 * 結果画面
 * スコア表示、報酬計算、フラッグ保存
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Coins, 
  MapPin, 
  Play, 
  Crown, 
  CheckCircle,
  Star,
  Sparkles,
  ChevronRight,
  Timer,
  Zap
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { AdsModal } from '@/components/ui/AdsModal';
import { AffiliateSection } from '@/components/ui/AffiliateSection';
import { useToast } from '@/components/ui/Toast';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { confettiIslandClear } from '@/lib/confetti';
import { DISTANCE } from '@/lib/constants';
import type { QuizRaw, QuizResult, StructuredOCR } from '@/types';

// ===== Types =====

interface ResultScreenProps {
  quiz: QuizRaw;
  correctCount: number;
  totalQuestions: number;
  onContinue: () => void;
  onViewMap: () => void;
  isFreeQuest?: boolean;
  ocrText?: string;
  structuredOCR?: StructuredOCR;
  mode?: 'speed_rush' | 'potato_pupil'; // クイズモード
  speedRushTotalTime?: number; // speed rushモードでの正答の合計時間（秒）
}

// ===== Constants =====

const ISLAND_DISTANCE = 100;

// ===== Main Component =====

export const ResultScreen = ({
  quiz,
  correctCount,
  totalQuestions,
  onContinue,
  onViewMap,
  isFreeQuest = false,
  ocrText,
  structuredOCR,
  mode,
  speedRushTotalTime,
}: ResultScreenProps) => {
  // State
  const [showAdsModal, setShowAdsModal] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showIslandClear, setShowIslandClear] = useState(false);
  const hasAppliedResult = useRef(false);

  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const totalDistance = useGameStore(state => state.journey.totalDistance);
  const totalQuizClears = useGameStore(state => state.totalQuizClears);
  const calculateResult = useGameStore(state => state.calculateResult);
  const applyQuizResult = useGameStore(state => state.applyQuizResult);
  const addFlag = useGameStore(state => state.addFlag);
  const saveQuizHistory = useGameStore(state => state.saveQuizHistory);
  const updateSpeedRushBestTime = useGameStore(state => state.updateSpeedRushBestTime);
  const getSpeedRushBestTime = useGameStore(state => state.getSpeedRushBestTime);

  // Toast
  const { addToast } = useToast();

  const isPerfect = correctCount === totalQuestions;
  const scorePercentage = (correctCount / totalQuestions) * 100;
  
  // Speed Rushベストタイムを取得（表示用）
  const bestTime = useMemo(() => {
    if (mode === 'speed_rush' && result) {
      return getSpeedRushBestTime(result.quizId);
    }
    return undefined;
  }, [mode, result, getSpeedRushBestTime]);

  // アフィリエイト表示判定（3回に1回）
  const shouldShowAffiliate = useMemo(() => {
    return totalQuizClears > 0 && totalQuizClears % 3 === 0;
  }, [totalQuizClears]);

  // 結果計算（初回のみ）
  useEffect(() => {
    if (hasAppliedResult.current) return;
    
    let quizResult: QuizResult;
    
    if (isFreeQuest) {
      // フリークエスト: 基本3コイン、満点+2、正解1km、満点+3km
      const coins = isPerfect ? (3 + 2) : 3;
      const distance = correctCount * DISTANCE.CORRECT_ANSWER + (isPerfect ? DISTANCE.PERFECT_BONUS : 0);
      quizResult = {
        quizId: `freequest_${Date.now()}`,
        correctCount,
        totalQuestions,
        isPerfect,
        earnedCoins: coins,
        earnedDistance: Math.round(distance * 100) / 100,
        isDoubled: false,
        timestamp: new Date(),
      };
    } else {
      quizResult = calculateResult(correctCount, totalQuestions, adWatched);
    }
    
    setResult(quizResult);
    
    // Speed Rushモードで正答の合計時間がある場合、ベストタイムを更新
    if (mode === 'speed_rush' && speedRushTotalTime !== undefined) {
      updateSpeedRushBestTime(quizResult.quizId, speedRushTotalTime);
    }
    
    if (isFreeQuest) {
      // フリークエスト: コインと距離のみ付与
      useGameStore.getState().addCoins(quizResult.earnedCoins);
      const state = useGameStore.getState();
      useGameStore.setState({
        journey: {
          ...state.journey,
          totalDistance: state.journey.totalDistance + quizResult.earnedDistance,
        },
        totalDistance: state.totalDistance + quizResult.earnedDistance,
        totalQuizClears: state.totalQuizClears + 1, // クリア回数もカウント
      });
    } else {
      // 通常クエスト: 結果を適用（1回のみ）
      applyQuizResult(quizResult);
      
      // フラッグを追加
      addFlag(quizResult.quizId, quiz.keywords, quizResult.earnedDistance);
      
      // クイズ履歴を保存（構造化OCR付き）
      saveQuizHistory(quiz, quizResult, ocrText, structuredOCR);
      
      // 島クリア判定
      const newTotalDistance = totalDistance + quizResult.earnedDistance;
      if (totalDistance < ISLAND_DISTANCE && newTotalDistance >= ISLAND_DISTANCE) {
        setTimeout(() => {
          setShowIslandClear(true);
          confettiIslandClear();
        }, 1500);
      }
    }
    
    hasAppliedResult.current = true;
  }, [mode, speedRushTotalTime, updateSpeedRushBestTime, isFreeQuest, correctCount, totalQuestions, adWatched, calculateResult, applyQuizResult, addFlag, saveQuizHistory, quiz, ocrText, structuredOCR, totalDistance]); // 依存配列を更新

  // 広告視聴で2倍にする場合の追加コイン
  const handleAdRewardClaimed = () => {
    if (result) {
      // 追加コインを付与（元のコインと同額）
      const bonusCoins = result.earnedCoins;
      useGameStore.getState().addCoins(bonusCoins);
      setResult({ ...result, earnedCoins: result.earnedCoins * 2, isDoubled: true });
    }
    setAdWatched(true);
    setShowAdsModal(false);
    vibrateSuccess();
    addToast('success', 'コインが2倍になりました！');
  };

  // 感情を決定
  const emotion = useMemo(() => {
    if (isPerfect) return 'happy';
    if (scorePercentage >= 60) return 'smart';
    return 'confused';
  }, [isPerfect, scorePercentage]);

  if (!result) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-indigo-900/30 to-gray-900 p-4">
      {/* 島クリア演出 */}
      <AnimatePresence>
        {showIslandClear && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <motion.div
                className="text-8xl mb-6"
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 1, repeat: 2 }}
              >
                🏝️
              </motion.div>
              <h2 className="text-3xl font-bold text-white mb-4">
                島に到着！
              </h2>
              <p className="text-gray-300 mb-2">
                累計 {ISLAND_DISTANCE}km を突破しました！
              </p>
              <div className="inline-block px-4 py-2 bg-cyan-500/20 rounded-full text-cyan-400 font-medium">
                #{quiz.keywords[0]} の知識を獲得
              </div>
              
              <motion.button
                onClick={() => setShowIslandClear(false)}
                className="block mx-auto mt-8 px-8 py-3 bg-white text-gray-900 rounded-xl font-bold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                続ける
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto pt-8">
        {/* ヘッダー */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">
            {isPerfect ? 'パーフェクト！' : 'クイズ完了！'}
          </h1>
        </motion.div>

        {/* ポテトとスコア */}
        <motion.div
          className="flex flex-col items-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <PotatoAvatar
            emotion={emotion}
            size={120}
            ssrEffect={isPerfect}
          />
          
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {i < correctCount ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-gray-600" />
                )}
              </motion.div>
            ))}
          </div>
          
          <p className="text-2xl font-bold text-white mt-4">
            {correctCount} / {totalQuestions} 正解
          </p>
        </motion.div>

        {/* 報酬カード */}
        <motion.div
          className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            獲得報酬
          </h3>

          {/* コイン */}
          <div className="flex items-center justify-between py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-yellow-400" />
              <span className="text-gray-300">コイン</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.span
                className="text-2xl font-bold text-yellow-400"
                initial={{ scale: 1 }}
                animate={result.isDoubled ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                +{result.earnedCoins}
              </motion.span>
              {result.isDoubled && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                  {isVIP ? 'VIP' : '2倍'}
                </span>
              )}
            </div>
          </div>

          {/* 距離 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-cyan-400" />
              <span className="text-gray-300">移動距離</span>
            </div>
            <span className="text-xl font-bold text-cyan-400">
              +{result.earnedDistance.toFixed(1)} km
            </span>
          </div>

          {/* Speed Rushタイム（speed rushモードの場合のみ表示） */}
          {mode === 'speed_rush' && speedRushTotalTime !== undefined && (
            <>
              <div className="flex items-center justify-between py-3 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <Zap className="w-6 h-6 text-cyan-400" />
                  <span className="text-gray-300">正答の合計時間</span>
                </div>
                <span className="text-xl font-bold text-cyan-400">
                  {speedRushTotalTime.toFixed(2)} 秒
                </span>
              </div>
              {(() => {
                // ベストタイムが存在し、今回のタイムがそれより速い場合、または今回がベストタイムと等しい場合
                const isNewRecord = bestTime === undefined || speedRushTotalTime < bestTime;
                const isBestTime = bestTime !== undefined && speedRushTotalTime === bestTime;
                const previousBest = bestTime !== undefined && speedRushTotalTime !== bestTime ? bestTime : undefined;
                
                return (
                  <div className="mt-3 space-y-2 text-sm">
                    {isNewRecord && speedRushTotalTime < (bestTime || Infinity) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-bold">新記録！</span>
                      </div>
                    )}
                    {previousBest !== undefined && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          前回のベストタイム
                        </span>
                        <span>{previousBest.toFixed(1)} 秒</span>
                      </div>
                    )}
                    {isBestTime && (
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-yellow-400" />
                          ベストタイム
                        </span>
                        <span className="text-yellow-400 font-bold">{bestTime.toFixed(2)} 秒</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* ボーナス詳細 */}
          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>基本報酬</span>
              <span>3 コイン</span>
            </div>
            {correctCount > 0 && (
              <div className="flex justify-between">
                <span>正解ボーナス</span>
                <span>+{(correctCount * DISTANCE.CORRECT_ANSWER).toFixed(1)} km</span>
              </div>
            )}
            {isPerfect && (
              <div className="flex justify-between text-yellow-400">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  パーフェクトボーナス
                </span>
                <span>+2 コイン + {DISTANCE.PERFECT_BONUS.toFixed(1)} km</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* 広告視聴ボタン（Freeユーザー・未視聴時のみ） */}
        {!isVIP && !adWatched && (
          <motion.button
            onClick={() => setShowAdsModal(true)}
            className="w-full py-4 mb-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-5 h-5" />
            コインを2倍にする
          </motion.button>
        )}

        {/* VIPバッジ */}
        {isVIP && (
          <motion.div
            className="flex items-center justify-center gap-2 py-3 mb-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Crown className="w-5 h-5 text-yellow-500" />
            <span className="text-yellow-400 font-medium">VIP特典: コイン常時2倍</span>
          </motion.div>
        )}

        {/* アフィリエイトセクション（3回に1回表示） */}
        {shouldShowAffiliate && (
          <AffiliateSection milestoneCount={totalQuizClears} keywordHint={quiz.keywords?.[0]} />
        )}

        {/* キーワードフラッグ */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <p className="text-sm text-gray-400 mb-2">獲得したキーワード</p>
          <div className="flex flex-wrap gap-2">
            {quiz.keywords.map((keyword, i) => (
              <span
                key={i}
                className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-medium border border-indigo-500/30"
              >
                🚩 {keyword}
              </span>
            ))}
          </div>
        </motion.div>

        {/* アクションボタン */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <button
            onClick={() => {
              vibrateLight();
              onContinue();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2"
          >
            続ける
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              vibrateLight();
              onViewMap();
            }}
            className="w-full py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            マップを見る
          </button>
        </motion.div>
      </div>

      {/* 広告モーダル */}
      <AdsModal
        isOpen={showAdsModal}
        onClose={() => setShowAdsModal(false)}
        adType="coin_doubler"
        onRewardClaimed={handleAdRewardClaimed}
      />
    </div>
  );
};

export default ResultScreen;
