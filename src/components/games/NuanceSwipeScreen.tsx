/**
 * NuanceSwipeScreen.tsx
 * 
 * どっちが自然？（ネイティブ判定ゲーム）
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { NUANCE_SWIPES } from '@/consts/nuanceSwipeData';

interface NuanceSwipeScreenProps {
  onComplete?: () => void;
}

export const NuanceSwipeScreen = ({ onComplete }: NuanceSwipeScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<'natural' | 'unnatural' | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [showNatural, setShowNatural] = useState(true); // trueならnatural、falseならunnaturalを表示

  const [shuffled] = useState(() => {
    const shuffled = [...NUANCE_SWIPES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const current = shuffled[currentIndex];

  // 次へボタンの処理
  const handleNext = useCallback(() => {
    vibrateLight();
    const nextIndex = (currentIndex + 1) % shuffled.length;
    setCurrentIndex(nextIndex);
    setSelectedAnswer(null);
    setShowExplanation(false);
  }, [currentIndex, shuffled.length]);

  // ランダムにどちらを表示するか決定
  useEffect(() => {
    setShowNatural(Math.random() < 0.5);
    setSelectedAnswer(null);
    setShowExplanation(false);
  }, [currentIndex]);

  const handleSelect = useCallback((answer: 'natural' | 'unnatural') => {
    if (selectedAnswer !== null) return;
    
    vibrateLight();
    setSelectedAnswer(answer);
    const correct = (answer === 'natural' && showNatural) || (answer === 'unnatural' && !showNatural);
    setIsCorrect(correct);
    setShowExplanation(true);

    if (correct) {
      vibrateSuccess();
      setScore(prev => prev + 1);
    } else {
      vibrateError();
    }
  }, [selectedAnswer, showNatural]);

  // 自動進行はしない（次へボタンで進む）

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 via-slate-900 to-slate-800 p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* スコア表示 */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-blue-400">
          <span className="text-blue-400 font-bold text-lg">
            {score} / {currentIndex + 1}
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* 問題カード */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="mb-8"
          >
            <h2 className="text-gray-300 text-sm mb-4 text-center font-medium">
              この文は自然ですか？
            </h2>
            
            <div className="bg-black/50 backdrop-blur-sm rounded-3xl p-8 border-4 border-blue-400/50 shadow-[0_0_50px_rgba(59,130,246,0.3)] min-h-[200px] flex items-center justify-center">
              <p className="text-white text-2xl md:text-3xl font-bold text-center leading-relaxed">
                {showNatural ? current.natural : current.unnatural}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 選択ボタン */}
        {!showExplanation && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.button
              onClick={() => handleSelect('natural')}
              disabled={selectedAnswer !== null}
              className="bg-green-500/20 border-4 border-green-400 text-green-400 p-6 rounded-2xl font-bold text-xl hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              whileHover={selectedAnswer === null ? { scale: 1.05 } : {}}
              whileTap={selectedAnswer === null ? { scale: 0.95 } : {}}
            >
              <ArrowRight className="w-6 h-6" />
              Natural
            </motion.button>
            <motion.button
              onClick={() => handleSelect('unnatural')}
              disabled={selectedAnswer !== null}
              className="bg-red-500/20 border-4 border-red-400 text-red-400 p-6 rounded-2xl font-bold text-xl hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              whileHover={selectedAnswer === null ? { scale: 1.05 } : {}}
              whileTap={selectedAnswer === null ? { scale: 0.95 } : {}}
            >
              <ArrowLeft className="w-6 h-6" />
              Unnatural
            </motion.button>
          </div>
        )}

        {/* 解説オーバーレイ */}
        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 md:p-12 max-w-lg w-full border-4 border-blue-400 shadow-[0_0_50px_rgba(59,130,246,0.5)]"
              >
                {/* 結果アイコン */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="text-center mb-6"
                >
                  {isCorrect ? (
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                  ) : (
                    <XCircle className="w-16 h-16 text-red-400 mx-auto" />
                  )}
                </motion.div>

                {/* 正しい文と間違った文 */}
                <div className="space-y-4 mb-6">
                  <div className="bg-green-500/20 border-2 border-green-400 rounded-xl p-4">
                    <p className="text-green-400 text-xs mb-1 font-medium">✓ Natural</p>
                    <p className="text-white text-lg">{current.natural}</p>
                  </div>
                  <div className="bg-red-500/20 border-2 border-red-400 rounded-xl p-4">
                    <p className="text-red-400 text-xs mb-1 font-medium">✗ Unnatural</p>
                    <p className="text-white text-lg">{current.unnatural}</p>
                  </div>
                </div>

                {/* 解説 */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white text-lg leading-relaxed text-center bg-blue-500/20 border-2 border-blue-400 rounded-xl p-4"
                >
                  {current.explanation}
                </motion.p>

                {/* 次へボタン */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={handleNext}
                  className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>次へ</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    →
                  </motion.span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

