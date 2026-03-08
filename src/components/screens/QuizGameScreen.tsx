/**
 * QuizGameScreen.tsx
 * 
 * クイズゲーム画面
 * Speed Rush / Potato Pupil のデュアルモード対応
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Zap, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { PotatoAvatar, type PotatoEmotion } from '@/components/ui/PotatoAvatar';
import { vibrateLight, vibrateSuccess, vibrateError, vibratePerfect } from '@/lib/haptics';
import { confettiPerfect } from '@/lib/confetti';
import type { QuizRaw, QuizQuestion, QuizQuestionAttempt } from '@/types';
import { LIMITS } from '@/lib/constants';
import type { Item } from '@/data/items';

// ===== Types =====

export type QuizMode = 'speed_rush' | 'potato_pupil';

interface QuizGameScreenProps {
  quiz: QuizRaw;
  mode: QuizMode;
  onComplete: (correctCount: number, totalQuestions: number, speedRushTotalTime?: number, attempts?: QuizQuestionAttempt[]) => void;
  equipped?: {
    head?: Item;
    body?: Item;
    face?: Item;
    accessory?: Item;
  };
}

interface QuizState {
  currentIndex: number;
  correctCount: number;
  selectedAnswer: number | null;
  showResult: boolean;
  timeLeft: number;
  answers: (number | null)[];
  questionStartTime: number; // 現在の問題の開始時刻（speed rush用）
  correctAnswerTimes: number[]; // 正解した問題の回答時間（秒）の配列（speed rush用）
}

// ===== Constants =====

const TIME_LIMIT = LIMITS.QUIZ.TIME_LIMIT_SECONDS;

// ===== Sub Components =====

/**
 * Speed Rush モード用コンポーネント
 */
const SpeedRushUI = ({
  question,
  questionIndex,
  totalQuestions,
  timeLeft,
  selectedAnswer,
  showResult,
  isCorrect,
  onSelectAnswer,
  onNext,
}: {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  selectedAnswer: number | null;
  showResult: boolean;
  isCorrect: boolean;
  onSelectAnswer: (index: number) => void;
  onNext: () => void;
}) => {
  const timePercentage = (timeLeft / TIME_LIMIT) * 100;
  const isTimeWarning = timeLeft <= 10;

  // 自動進行（1.5秒後）
  useEffect(() => {
    if (showResult) {
      const timer = setTimeout(() => {
        onNext();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showResult, onNext]);

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      {/* タイマーバー */}
      <div className="fixed top-0 left-0 right-0 h-2 bg-slate-800">
        <motion.div
          className={`h-full ${isTimeWarning ? 'bg-red-500' : 'bg-cyan-400'}`}
          initial={{ width: '100%' }}
          animate={{ width: `${timePercentage}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* ヘッダー */}
      <div className="max-w-lg mx-auto pt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-cyan-400" />
            <span className="text-cyan-400 font-bold text-lg">
              Question {questionIndex + 1}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            isTimeWarning ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-white'
          }`}>
            <Timer className="w-4 h-4" />
            <span className="font-mono font-bold">{timeLeft}s</span>
          </div>
        </div>

        {/* プログレス */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < questionIndex 
                  ? 'bg-cyan-400' 
                  : i === questionIndex 
                    ? 'bg-cyan-400/50' 
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* 問題文 */}
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-800 rounded-2xl p-6 mb-6 border border-slate-700"
        >
          <p className="text-white text-lg leading-relaxed">
            {question.q}
          </p>
        </motion.div>

        {/* 選択肢 */}
        <div className="space-y-3">
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrectAnswer = question.a === i;
            const showCorrect = showResult && isCorrectAnswer;
            const showWrong = showResult && isSelected && !isCorrectAnswer;

            return (
              <motion.button
                key={i}
                onClick={() => !showResult && onSelectAnswer(i)}
                disabled={showResult}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  showCorrect
                    ? 'bg-green-500 text-white border-2 border-green-400'
                    : showWrong
                      ? 'bg-red-500 text-white border-2 border-red-400'
                      : isSelected
                        ? 'bg-cyan-500 text-white border-2 border-cyan-400'
                        : 'bg-slate-800 text-white border-2 border-slate-700 hover:border-cyan-500'
                }`}
                whileHover={!showResult ? { scale: 1.02 } : {}}
                whileTap={!showResult ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    showCorrect || (isSelected && !showResult)
                      ? 'bg-white/20'
                      : 'bg-slate-700'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {showCorrect && <CheckCircle className="w-6 h-6" />}
                  {showWrong && <XCircle className="w-6 h-6" />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Attack! エフェクト */}
        <AnimatePresence>
          {showResult && isCorrect && (
            <motion.div
              className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: [0, 1.5, 1.2], rotate: [0, 10, 0] }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-6xl font-black text-cyan-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]"
                style={{ textShadow: '0 0 40px rgba(34,211,238,0.8)' }}
              >
                Attack!
              </motion.div>
              
              {/* パーティクル */}
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-cyan-400 rounded-full"
                  initial={{ 
                    x: 0, 
                    y: 0, 
                    scale: 1,
                    opacity: 1 
                  }}
                  animate={{ 
                    x: (Math.random() - 0.5) * 400,
                    y: (Math.random() - 0.5) * 400,
                    scale: 0,
                    opacity: 0
                  }}
                  transition={{ 
                    duration: 0.8,
                    delay: Math.random() * 0.2
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Potato Pupil モード用コンポーネント
 */
const PotatoPupilUI = ({
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  showResult,
  isCorrect,
  onSelectAnswer,
  onNext,
  isLastQuestion,
  equipped,
}: {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  showResult: boolean;
  isCorrect: boolean;
  onSelectAnswer: (index: number) => void;
  onNext: () => void;
  isLastQuestion: boolean;
  equipped?: {
    head?: Item;
    body?: Item;
    face?: Item;
    accessory?: Item;
  };
}) => {
  const [potatoEmotion, setPotatoEmotion] = useState<PotatoEmotion>('confused');
  const [speechBubble, setSpeechBubble] = useState('先生、これ教えて！');

  useEffect(() => {
    if (showResult) {
      if (isCorrect) {
        setPotatoEmotion('smart');
        setSpeechBubble('なるほど！わかった！');
      } else {
        setPotatoEmotion('confused');
        setSpeechBubble('うーん、難しいな...');
      }
    } else {
      setPotatoEmotion('confused');
      setSpeechBubble(questionIndex === 0 ? '先生、これ教えて！' : '答えはどれ？');
    }
  }, [showResult, isCorrect, questionIndex]);

  return (
    <div 
      className="min-h-screen p-4"
      style={{ 
        background: 'linear-gradient(180deg, #1a3c28 0%, #2d5a3f 50%, #1a3c28 100%)' 
      }}
    >
      {/* 黒板風ヘッダー */}
      <div className="max-w-lg mx-auto pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-300" />
            <span 
              className="text-orange-300 font-bold text-lg"
              style={{ fontFamily: 'cursive, sans-serif' }}
            >
              もんだい {questionIndex + 1}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < questionIndex 
                    ? 'bg-orange-400' 
                    : i === questionIndex 
                      ? 'bg-orange-300' 
                      : 'bg-green-900'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ポテトとスピーチバブル */}
        <div className="flex flex-col items-center mb-6">
          <motion.div
            key={`${showResult}-${isCorrect}`}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <PotatoAvatar
              emotion={potatoEmotion}
              size={140}
              equipped={equipped}
            />
          </motion.div>
          
          {/* スピーチバブル */}
          <motion.div
            key={speechBubble}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-2xl px-6 py-3 mt-4 shadow-lg"
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45" />
            <p 
              className="text-gray-800 font-medium relative z-10"
              style={{ fontFamily: 'cursive, sans-serif' }}
            >
              {speechBubble}
            </p>
          </motion.div>
        </div>

        {/* 問題文（黒板風） */}
        <motion.div
          key={questionIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#2a4a38] rounded-xl p-5 mb-5 border-4 border-[#4a6a58] shadow-inner"
        >
          <p 
            className="text-orange-100 text-lg leading-relaxed"
            style={{ fontFamily: 'cursive, sans-serif' }}
          >
            {question.q}
          </p>
        </motion.div>

        {/* 選択肢 */}
        <div className="space-y-3">
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrectAnswer = question.a === i;
            const showCorrect = showResult && isCorrectAnswer;
            const showWrong = showResult && isSelected && !isCorrectAnswer;

            return (
              <motion.button
                key={i}
                onClick={() => !showResult && onSelectAnswer(i)}
                disabled={showResult}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  showCorrect
                    ? 'bg-green-500 text-white border-2 border-green-300'
                    : showWrong
                      ? 'bg-red-500 text-white border-2 border-red-300'
                      : isSelected
                        ? 'bg-orange-500 text-white border-2 border-orange-300'
                        : 'bg-[#f5e6d3] text-gray-800 border-2 border-[#d4c4b0] hover:border-orange-400'
                }`}
                style={{ fontFamily: 'cursive, sans-serif' }}
                whileHover={!showResult ? { scale: 1.02 } : {}}
                whileTap={!showResult ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    showCorrect || showWrong || isSelected
                      ? 'bg-white/30'
                      : 'bg-orange-200 text-orange-800'
                  }`}>
                    {['ア', 'イ', 'ウ', 'エ'][i]}
                  </span>
                  <span className="flex-1">{option}</span>
                  {showCorrect && <CheckCircle className="w-6 h-6" />}
                  {showWrong && <XCircle className="w-6 h-6" />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* 解説（結果表示時） */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-[#f5e6d3] rounded-xl p-4 border-2 border-[#d4c4b0]"
            >
              <p 
                className="text-gray-700"
                style={{ fontFamily: 'cursive, sans-serif' }}
              >
                💡 {question.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 次へボタン */}
        {showResult && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onNext}
            className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg"
            style={{ fontFamily: 'cursive, sans-serif' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLastQuestion ? '結果を見る' : '次の問題へ →'}
          </motion.button>
        )}
      </div>
    </div>
  );
};

// ===== Main Component =====

export const QuizGameScreen = ({
  quiz,
  mode,
  onComplete,
  equipped,
}: QuizGameScreenProps) => {
  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    correctCount: 0,
    selectedAnswer: null,
    showResult: false,
    timeLeft: TIME_LIMIT,
    answers: [],
    questionStartTime: Date.now(),
    correctAnswerTimes: [],
  });

  const currentQuestion = quiz.questions[state.currentIndex];
  const isCorrect = state.selectedAnswer === currentQuestion?.a;
  const isLastQuestion = state.currentIndex === quiz.questions.length - 1;

  // 問題開始時刻を記録（Speed Rushモードのみ）
  useEffect(() => {
    if (mode === 'speed_rush') {
      setState(prev => ({
        ...prev,
        questionStartTime: Date.now(),
      }));
    }
  }, [mode, state.currentIndex]);

  // タイマー（Speed Rushモードのみ）
  useEffect(() => {
    if (mode !== 'speed_rush' || state.showResult) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 1) {
          // 時間切れ = 不正解扱い
          clearInterval(timer);
          return { ...prev, timeLeft: 0, showResult: true, selectedAnswer: -1 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, state.currentIndex, state.showResult]);

  // 回答選択
  const handleSelectAnswer = useCallback((answerIndex: number) => {
    if (state.showResult) return;

    vibrateLight();
    const correct = answerIndex === currentQuestion.a;
    
    // 正解/不正解のハプティクス
    if (correct) {
      vibrateSuccess();
    } else {
      vibrateError();
    }
    
    // Speed Rushモードで正解した場合、実際の経過時間をミリ秒単位で正確に記録
    let answerTime: number | undefined = undefined;
    if (mode === 'speed_rush' && correct) {
      const elapsedMs = Date.now() - state.questionStartTime;
      // ミリ秒を秒に変換（小数点以下も正確に保持）
      answerTime = elapsedMs / 1000;
    }
    
    setState(prev => ({
      ...prev,
      selectedAnswer: answerIndex,
      showResult: true,
      correctCount: correct ? prev.correctCount + 1 : prev.correctCount,
      answers: [...prev.answers, answerIndex],
      correctAnswerTimes: answerTime !== undefined 
        ? [...prev.correctAnswerTimes, answerTime]
        : prev.correctAnswerTimes,
    }));
  }, [state.showResult, currentQuestion, mode, state.questionStartTime]);

  // 次の問題へ / 完了（ボタンクリック時）
  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      const finalCorrectCount = state.correctCount;
      const isPerfect = finalCorrectCount === quiz.questions.length;
      
      // パーフェクト時の演出
      if (isPerfect) {
        vibratePerfect();
        confettiPerfect();
      }
      
      // Speed Rushモードの場合、正解した問題の合計時間を計算
      const speedRushTotalTime = mode === 'speed_rush' && state.correctAnswerTimes.length > 0
        ? state.correctAnswerTimes.reduce((sum, time) => sum + time, 0)
        : undefined;

      const attempts: QuizQuestionAttempt[] = quiz.questions.map((q, idx) => {
        const rawAnswer = state.answers[idx] ?? (idx === state.currentIndex ? state.selectedAnswer : null);
        const selectedAnswer = rawAnswer !== null && rawAnswer >= 0 ? rawAnswer : null;
        return {
          questionIndex: idx,
          selectedAnswer,
          isCorrect: selectedAnswer === q.a,
        };
      });

      onComplete(finalCorrectCount, quiz.questions.length, speedRushTotalTime, attempts);
    } else {
      setState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        selectedAnswer: null,
        showResult: false,
        timeLeft: TIME_LIMIT,
        questionStartTime: Date.now(), // 次の問題の開始時刻を記録
      }));
    }
  }, [isLastQuestion, state.correctCount, state.correctAnswerTimes, quiz.questions.length, mode, onComplete]);

  if (!currentQuestion) return null;

  return mode === 'speed_rush' ? (
    <SpeedRushUI
      question={currentQuestion}
      questionIndex={state.currentIndex}
      totalQuestions={quiz.questions.length}
      timeLeft={state.timeLeft}
      selectedAnswer={state.selectedAnswer}
      showResult={state.showResult}
      isCorrect={isCorrect}
      onSelectAnswer={handleSelectAnswer}
      onNext={handleNext}
    />
  ) : (
    <PotatoPupilUI
      question={currentQuestion}
      questionIndex={state.currentIndex}
      totalQuestions={quiz.questions.length}
      selectedAnswer={state.selectedAnswer}
      showResult={state.showResult}
      isCorrect={isCorrect}
      onSelectAnswer={handleSelectAnswer}
      onNext={handleNext}
      isLastQuestion={isLastQuestion}
      equipped={equipped}
    />
  );
};

export default QuizGameScreen;

