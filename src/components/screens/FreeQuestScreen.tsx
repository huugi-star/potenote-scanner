/**
 * FreeQuestScreen.tsx
 * 
 * フリークエスト画面
 * 過去にスキャンしたクイズを復習する（トークン消費なし）
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  BookOpen, 
  Play, 
  Calendar,
  CheckCircle,
  Star,
  Search,
  History
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { vibrateLight } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import type { QuizHistory, QuizRaw } from '@/types';

// ===== Types =====

interface FreeQuestScreenProps {
  onBack: () => void;
  onStartQuiz: (quiz: QuizRaw) => void;
}

// ===== Main Component =====

export const FreeQuestScreen = ({ onBack, onStartQuiz }: FreeQuestScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<QuizHistory | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  
  // Store
  const quizHistory = useGameStore(state => state.quizHistory);
  const addQuestionsToHistory = useGameStore(state => state.addQuestionsToHistory);
  const { addToast } = useToast();

  // フィルタリング
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return quizHistory;
    
    const query = searchQuery.toLowerCase();
    return quizHistory.filter(h => 
      h.quiz.summary.toLowerCase().includes(query) ||
      h.quiz.keywords.some(k => k.toLowerCase().includes(query))
    );
  }, [quizHistory, searchQuery]);

  // 新しい問題に挑戦
  const handleNewQuiz = async (history: QuizHistory) => {
    vibrateLight();
    
    if (history.ocrText) {
      setIsGenerating(true);
      setGeneratingId(history.id);
      
      try {
        // 既存の問題と正解を「正しい事実」として渡す
        const existingQA = history.quiz.questions.map(q => 
          `問: ${q.q} → 正解: ${q.options[q.a]}`
        ).join('\n');
        
        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: history.ocrText,
            verifiedFacts: existingQA
          }),
        });
        
        if (!response.ok) throw new Error('Failed to generate quiz');
        
        const result = await response.json();
        // APIは { quiz: ..., ocrText: ... } を返す
        const newQuiz = result.quiz;
        
        if (newQuiz && newQuiz.questions && newQuiz.questions.length > 0) {
          // 新しい問題を履歴に追加（再挑戦用）
          addQuestionsToHistory(history.id, newQuiz.questions);
          addToast('success', '新しい問題を生成しました！');
          onStartQuiz(newQuiz);
        } else {
          throw new Error('No questions generated');
        }
      } catch (error) {
        console.error('Quiz generation error:', error);
        addToast('error', '新問題の生成に失敗。既存問題で挑戦します');
        onStartQuiz(history.quiz);
      } finally {
        setIsGenerating(false);
        setGeneratingId(null);
      }
    } else {
      addToast('info', 'OCRテキストがないため既存問題で挑戦します');
      onStartQuiz(history.quiz);
    }
  };

  // 過去の問題に再挑戦（ランダム順）
  const handleRetryQuiz = (history: QuizHistory) => {
    vibrateLight();
    
    // 問題をシャッフル
    const shuffledQuestions = [...history.quiz.questions].sort(() => Math.random() - 0.5);
    const retryQuiz: QuizRaw = {
      ...history.quiz,
      questions: shuffledQuestions.slice(0, 5), // 最大5問
    };
    
    onStartQuiz(retryQuiz);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-emerald-900/20 to-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between py-4 mb-4">
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            フリークエスト
          </h1>

          <div className="w-16" />
        </div>

        {/* 説明 */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <PotatoAvatar emotion="smart" size={50} />
            <div>
              <p className="text-emerald-300 font-medium">復習モード</p>
              <p className="text-gray-400 text-sm">
                過去にスキャンした内容を何度でも復習できます。
                スキャン回数は消費しません！
              </p>
            </div>
          </div>
        </div>

        {/* 検索 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="キーワードで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* 履歴数 */}
        <p className="text-sm text-gray-400 mb-3">
          {filteredHistory.length} 件のクイズ
        </p>

        {/* クイズ一覧 */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery ? '該当するクイズがありません' : 'まだクイズ履歴がありません'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery ? '別のキーワードで検索してください' : 'スキャンしてクイズを作成しよう！'}
              </p>
            </div>
          ) : (
            filteredHistory.map((history) => (
              <motion.div
                key={history.id}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium line-clamp-2 mb-1">
                      {history.quiz.summary}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(history.createdAt)}
                    </div>
                  </div>
                  
                  {/* 成績 */}
                  <div className="flex items-center gap-1 ml-3">
                    {history.result.isPerfect ? (
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className={`text-sm font-bold ${
                      history.result.isPerfect ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {history.result.correctCount}/{history.result.totalQuestions}
                    </span>
                  </div>
                </div>

                {/* キーワード */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {history.quiz.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>

                {/* アクション */}
                <div className="flex gap-2">
                  {/* 再挑戦ボタン */}
                  <motion.button
                    onClick={() => handleRetryQuiz(history)}
                    disabled={isGenerating}
                    className="flex-1 py-2.5 rounded-lg bg-gray-700 text-white font-medium flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <History className="w-4 h-4" />
                    再挑戦
                  </motion.button>

                  {/* 新しい問題ボタン */}
                  <motion.button
                    onClick={() => handleNewQuiz(history)}
                    disabled={isGenerating || !history.ocrText}
                    className={`flex-1 py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                      isGenerating && generatingId === history.id
                        ? 'bg-gray-600'
                        : history.ocrText
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                          : 'bg-gray-600 opacity-50'
                    }`}
                    whileHover={!isGenerating && history.ocrText ? { scale: 1.02 } : {}}
                    whileTap={!isGenerating && history.ocrText ? { scale: 0.98 } : {}}
                  >
                    {isGenerating && generatingId === history.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        新問題
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* クイズ詳細モーダル */}
      <AnimatePresence>
        {selectedQuiz && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedQuiz(null)}
            />
            
            <motion.div
              className="relative w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  {selectedQuiz.quiz.summary}
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">前回の成績</span>
                    <span className="text-white font-bold">
                      {selectedQuiz.result.correctCount}/{selectedQuiz.result.totalQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">プレイ日時</span>
                    <span className="text-white">
                      {formatDate(selectedQuiz.createdAt)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleStartQuiz(selectedQuiz);
                    setSelectedQuiz(null);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold"
                >
                  挑戦する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FreeQuestScreen;

