/**
 * PrepositionGameScreen.tsx
 * 
 * 前置詞シューティングゲーム
 * スキャン中の待機時間を利用したミニゲーム
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { PREPOSITION_QUIZZES, type PrepositionQuiz } from '@/consts/prepositionQuizData';

interface PrepositionGameScreenProps {
  onComplete?: () => void;
}

export const PrepositionGameScreen = ({ onComplete }: PrepositionGameScreenProps) => {
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  // ランダムに問題をシャッフル
  const [shuffledQuizzes] = useState(() => {
    const shuffled = [...PREPOSITION_QUIZZES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const currentQuiz = shuffledQuizzes[currentQuizIndex];

  // 選択肢をクリック
  const handleSelect = useCallback((option: string) => {
    if (selectedAnswer !== null) return; // 既に選択済み

    vibrateLight();
    setSelectedAnswer(option);
    const correct = option === currentQuiz.correct;
    setIsCorrect(correct);

    if (correct) {
      vibrateSuccess();
      setScore(prev => prev + 1);
      // 正解時は解説を表示
      setShowExplanation(true);
    } else {
      vibrateError();
      // 不正解時も解説を表示（正解を教える）
      setShowExplanation(true);
    }
  }, [selectedAnswer, currentQuiz]);

  // 次へボタンの処理
  const handleNext = useCallback(() => {
    vibrateLight();
    const nextIndex = (currentQuizIndex + 1) % shuffledQuizzes.length;
    setCurrentQuizIndex(nextIndex);
    setSelectedAnswer(null);
    setShowExplanation(false);
  }, [currentQuizIndex, shuffledQuizzes.length]);

  // 問題文を穴埋め形式で表示
  const displaySentence = currentQuiz.sentence.replace('___', '___');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-purple-900 p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* スコア表示 */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-cyan-400">
          <span className="text-cyan-400 font-bold text-lg">
            <Sparkles className="inline w-4 h-4 mr-1" />
            {score} / {currentQuizIndex + 1}
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* 問題文 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentQuizIndex}
          className="text-center mb-8"
        >
          <h2 className="text-gray-300 text-sm mb-4 font-medium">前置詞を選んでください</h2>
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border-2 border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
            <p className="text-white text-3xl md:text-4xl font-bold leading-relaxed">
              {currentQuiz.sentence.split('___').map((part, index, array) => (
                <span key={index}>
                  {part}
                  {index < array.length - 1 && (
                    <span className="text-cyan-400 mx-2 px-3 py-1 bg-cyan-400/20 rounded border-2 border-cyan-400 border-dashed">
                      ?
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>
        </motion.div>

        {/* 選択肢 */}
        <AnimatePresence mode="wait">
          {!showExplanation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-3 gap-4 mb-8"
            >
              {currentQuiz.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === currentQuiz.correct;
                const showCorrect = selectedAnswer !== null && isCorrectOption;

                return (
                  <motion.button
                    key={option}
                    onClick={() => handleSelect(option)}
                    disabled={selectedAnswer !== null}
                    className={`
                      relative p-6 rounded-xl font-bold text-xl md:text-2xl
                      transition-all duration-200
                      ${isSelected
                        ? isCorrect
                          ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-105'
                          : 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-105'
                        : showCorrect
                          ? 'bg-green-500/30 text-green-400 border-2 border-green-400'
                          : 'bg-black/50 text-white border-2 border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-400/20'
                      }
                      ${selectedAnswer !== null ? 'cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    whileHover={selectedAnswer === null ? { scale: 1.05 } : {}}
                    whileTap={selectedAnswer === null ? { scale: 0.95 } : {}}
                  >
                    {option}
                    {showCorrect && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2"
                      >
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

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
                className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 md:p-12 max-w-lg w-full border-4 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.5)]"
              >
                {/* アイコン */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="text-center mb-6"
                >
                  <div className="text-8xl mb-4">{currentQuiz.explanation.imageIcon}</div>
                  {isCorrect ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <XCircle className="w-16 h-16 text-red-400 mx-auto" />
                    </motion.div>
                  )}
                </motion.div>

                {/* コア・イメージ */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-center mb-4"
                >
                  <div className="inline-block bg-cyan-400/20 border-2 border-cyan-400 rounded-full px-6 py-2">
                    <span className="text-cyan-400 font-bold text-xl">
                      {currentQuiz.explanation.coreMeaning}
                    </span>
                  </div>
                </motion.div>

                {/* 詳細解説 */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white text-lg md:text-xl leading-relaxed text-center"
                >
                  {currentQuiz.explanation.detail}
                </motion.p>

                {/* 正解表示 */}
                {!isCorrect && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 text-center"
                  >
                    <p className="text-gray-400 text-sm mb-2">正解は</p>
                    <div className="inline-block bg-green-500/20 border-2 border-green-400 rounded-lg px-6 py-2">
                      <span className="text-green-400 font-bold text-2xl">
                        {currentQuiz.correct}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* 次へボタン */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  onClick={handleNext}
                  className="mt-8 w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
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

