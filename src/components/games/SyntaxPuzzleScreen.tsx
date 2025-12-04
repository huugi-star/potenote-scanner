/**
 * SyntaxPuzzleScreen.tsx
 * 
 * SVOビルダー（語順整序ゲーム）
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { SYNTAX_PUZZLES, type SyntaxPuzzle } from '@/consts/syntaxPuzzleData';

interface SyntaxPuzzleScreenProps {
  onComplete?: () => void;
}

export const SyntaxPuzzleScreen = ({ onComplete }: SyntaxPuzzleScreenProps) => {
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [availableWords, setAvailableWords] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const [shuffledPuzzles] = useState(() => {
    const shuffled = [...SYNTAX_PUZZLES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const currentPuzzle = shuffledPuzzles[currentPuzzleIndex];

  // 次へボタンの処理
  const handleNext = useCallback(() => {
    vibrateLight();
    const nextIndex = (currentPuzzleIndex + 1) % shuffledPuzzles.length;
    setCurrentPuzzleIndex(nextIndex);
    setSelectedWords([]);
    setShowResult(false);
  }, [currentPuzzleIndex, shuffledPuzzles.length]);

  // パズル初期化
  useEffect(() => {
    const shuffled = [...Array(currentPuzzle.words.length).keys()];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setAvailableWords(shuffled);
    setSelectedWords([]);
    setShowResult(false);
  }, [currentPuzzleIndex, currentPuzzle.words.length]);

  // 単語を選択
  const handleWordClick = useCallback((wordIndex: number) => {
    if (showResult) return;
    
    vibrateLight();
    setSelectedWords(prev => [...prev, wordIndex]);
    setAvailableWords(prev => prev.filter(i => i !== wordIndex));
  }, [showResult]);

  // 選択をリセット
  const handleReset = useCallback(() => {
    vibrateLight();
    const allIndices = [...Array(currentPuzzle.words.length).keys()];
    const shuffled = [...allIndices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setAvailableWords(shuffled);
    setSelectedWords([]);
    setShowResult(false);
  }, [currentPuzzle.words.length]);

  // 選択を1つ戻す
  const handleUndo = useCallback(() => {
    if (selectedWords.length === 0 || showResult) return;
    
    vibrateLight();
    const lastWord = selectedWords[selectedWords.length - 1];
    setSelectedWords(prev => prev.slice(0, -1));
    setAvailableWords(prev => [...prev, lastWord]);
  }, [selectedWords, showResult]);

  // 自動判定
  useEffect(() => {
    if (selectedWords.length === currentPuzzle.words.length && !showResult) {
      const correct = JSON.stringify(selectedWords) === JSON.stringify(currentPuzzle.correctOrder);
      setIsCorrect(correct);
      setShowResult(true);
      
      if (correct) {
        vibrateSuccess();
        setScore(prev => prev + 1);
      } else {
        vibrateError();
      }

      // 自動進行はしない（次へボタンで進む）
    }
  }, [selectedWords, currentPuzzle, showResult, currentPuzzleIndex, shuffledPuzzles.length, onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-900 to-blue-900 p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* スコア表示 */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-blue-400">
          <span className="text-blue-400 font-bold text-lg">
            {score} / {currentPuzzleIndex + 1}
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* 問題文 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentPuzzleIndex}
          className="text-center mb-8"
        >
          <h2 className="text-gray-300 text-sm mb-4 font-medium">単語を順番に並べてください</h2>
          
          {/* 回答エリア */}
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] min-h-[120px] mb-6">
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {selectedWords.length === 0 ? (
                <span className="text-gray-500 text-lg">ここに単語を並べてください</span>
              ) : (
                selectedWords.map((wordIndex, index) => (
                  <motion.div
                    key={`${wordIndex}-${index}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-lg border-2 border-blue-400"
                  >
                    {currentPuzzle.words[wordIndex]}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* 結果表示 */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`mb-4 p-4 rounded-xl ${
                  isCorrect ? 'bg-green-500/20 border-2 border-green-400' : 'bg-red-500/20 border-2 border-red-400'
                }`}
              >
                {isCorrect ? (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400 font-bold text-xl mb-1">Perfect!</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 font-bold text-xl mb-1">Try again!</p>
                  </>
                )}
                <p className="text-white text-lg">{currentPuzzle.sentence}</p>
                <p className="text-gray-300 text-sm mt-1">{currentPuzzle.translation}</p>
                
                {/* 次へボタン */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={handleNext}
                  className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
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
        </motion.div>

        {/* 利用可能な単語 */}
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          {availableWords.map((wordIndex) => (
            <motion.button
              key={wordIndex}
              onClick={() => handleWordClick(wordIndex)}
              disabled={showResult}
              className="bg-black/50 text-white px-6 py-3 rounded-xl font-bold text-lg border-2 border-blue-400/50 hover:border-blue-400 hover:bg-blue-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={!showResult ? { scale: 1.05 } : {}}
              whileTap={!showResult ? { scale: 0.95 } : {}}
            >
              {currentPuzzle.words[wordIndex]}
            </motion.button>
          ))}
        </div>

        {/* 操作ボタン */}
        <div className="flex gap-4 justify-center">
          <motion.button
            onClick={handleUndo}
            disabled={selectedWords.length === 0 || showResult}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg font-medium border-2 border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={selectedWords.length > 0 && !showResult ? { scale: 1.05 } : {}}
            whileTap={selectedWords.length > 0 && !showResult ? { scale: 0.95 } : {}}
          >
            戻す
          </motion.button>
          <motion.button
            onClick={handleReset}
            disabled={showResult}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg font-medium border-2 border-gray-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!showResult ? { scale: 1.05 } : {}}
            whileTap={!showResult ? { scale: 0.95 } : {}}
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </motion.button>
        </div>
      </div>
    </div>
  );
};

