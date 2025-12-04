/**
 * IdiomMatchScreen.tsx
 * 
 * アイコン合わせ（熟語イメージゲーム）
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { IDIOM_MATCHES, type IdiomMatch } from '@/consts/idiomMatchData';

interface IdiomMatchScreenProps {
  onComplete?: () => void;
}

export const IdiomMatchScreen = ({ onComplete }: IdiomMatchScreenProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  // 次へボタンの処理
  const handleNext = useCallback(() => {
    vibrateLight();
    const nextIndex = (currentIndex + 1) % shuffled.length;
    setCurrentIndex(nextIndex);
    setSelectedIcon(null);
    setShowResult(false);
  }, [currentIndex, shuffled.length]);

  const [shuffled] = useState(() => {
    const shuffled = [...IDIOM_MATCHES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const current = shuffled[currentIndex];

  // 選択肢をシャッフル
  const [options] = useState(() => {
    const allIcons = [current.correctIcon, ...current.wrongIcons];
    const shuffled = [...allIcons];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const handleSelect = useCallback((icon: string) => {
    if (selectedIcon !== null) return;
    
    vibrateLight();
    setSelectedIcon(icon);
    const correct = icon === current.correctIcon;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      vibrateSuccess();
      setScore(prev => prev + 1);
    } else {
      vibrateError();
    }
  }, [selectedIcon, current]);

  // 自動進行はしない（次へボタンで進む）

  // 新しい問題で選択肢をシャッフル
  useEffect(() => {
    const allIcons = [shuffled[currentIndex].correctIcon, ...shuffled[currentIndex].wrongIcons];
    const shuffledIcons = [...allIcons];
    for (let i = shuffledIcons.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIcons[i], shuffledIcons[j]] = [shuffledIcons[j], shuffledIcons[i]];
    }
  }, [currentIndex, shuffled]);

  const currentOptions = [current.correctIcon, ...current.wrongIcons].sort(() => Math.random() - 0.5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-900 via-orange-900 to-yellow-900 p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* スコア表示 */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-yellow-400">
          <span className="text-yellow-400 font-bold text-lg">
            {score} / {currentIndex + 1}
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* 熟語表示 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentIndex}
          className="text-center mb-8"
        >
          <div className="bg-black/50 backdrop-blur-sm rounded-3xl p-8 border-4 border-yellow-400/50 shadow-[0_0_50px_rgba(234,179,8,0.3)] mb-6">
            <p className="text-white text-3xl md:text-4xl font-bold mb-2">{current.idiom}</p>
            <p className="text-yellow-400 text-xl">{current.meaning}</p>
          </div>
        </motion.div>

        {/* アイコン選択肢 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {currentOptions.map((icon, index) => {
            const isSelected = selectedIcon === icon;
            const isCorrectOption = icon === current.correctIcon;
            const showCorrect = showResult && isCorrectOption;

            return (
              <motion.button
                key={`${icon}-${index}`}
                onClick={() => handleSelect(icon)}
                disabled={selectedIcon !== null}
                className={`
                  relative p-8 rounded-2xl text-6xl md:text-7xl
                  transition-all duration-200
                  ${isSelected
                    ? isCorrect
                      ? 'bg-green-500/30 border-4 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-105'
                      : 'bg-red-500/30 border-4 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-105'
                    : showCorrect
                      ? 'bg-green-500/30 border-4 border-green-400'
                      : 'bg-black/50 border-4 border-yellow-400/50 hover:border-yellow-400 hover:bg-yellow-400/20'
                  }
                  ${selectedIcon !== null ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
                whileHover={selectedIcon === null ? { scale: 1.05 } : {}}
                whileTap={selectedIcon === null ? { scale: 0.95 } : {}}
              >
                {icon}
                {showCorrect && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2"
                  >
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* 結果表示 */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`p-6 rounded-2xl text-center ${
                isCorrect ? 'bg-green-500/20 border-4 border-green-400' : 'bg-red-500/20 border-4 border-red-400'
              }`}
            >
              {isCorrect ? (
                <>
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-bold text-2xl">Perfect!</p>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-red-400 font-bold text-2xl">Try again!</p>
                  <p className="text-white text-lg mt-2">正解は {current.correctIcon} です</p>
                </>
              )}
              
              {/* 次へボタン */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={handleNext}
                className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

