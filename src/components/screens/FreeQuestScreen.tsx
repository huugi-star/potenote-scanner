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
  History,
  AlertCircle,
  Crown,
  Trash2,
  FileDown
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { AdsModal } from '@/components/ui/AdsModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { LIMITS } from '@/lib/constants';
import { generateQuizPDF } from '@/lib/pdfUtils';
import type { QuizHistory, QuizRaw, QuizResult } from '@/types';

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
  const [showAdsModal, setShowAdsModal] = useState(false);
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());
  // const [showShopModal, setShowShopModal] = useState(false); // 一時的に非表示
  
  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const quizHistory = useGameStore(state => state.quizHistory);
  const addQuestionsToHistory = useGameStore(state => state.addQuestionsToHistory);
  const deleteQuizHistory = useGameStore(state => state.deleteQuizHistory);
  const saveQuizHistory = useGameStore(state => state.saveQuizHistory);
  const checkFreeQuestGenerationLimit = useGameStore(state => state.checkFreeQuestGenerationLimit);
  const incrementFreeQuestGenerationCount = useGameStore(state => state.incrementFreeQuestGenerationCount);
  const recoverFreeQuestGenerationCount = useGameStore(state => state.recoverFreeQuestGenerationCount);
  // const activateVIP = useGameStore(state => state.activateVIP); // 一時的に非表示
  const { addToast } = useToast();
  
  // 制限チェック
  const limitCheck = checkFreeQuestGenerationLimit();
  const canGenerate = isVIP || limitCheck.canGenerate;
  const remainingGenerations = isVIP 
    ? LIMITS.VIP_USER.DAILY_FREE_QUEST_GENERATION_LIMIT 
    : limitCheck.remaining;

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
    
    // 制限チェック
    if (!canGenerate) {
      addToast('error', limitCheck.error || '新問題生成回数の上限に達しました');
      return;
    }
    
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
        // APIは { quiz: ..., ocrText: ..., tokenUsage: ... } を返す
        const newQuiz = result.quiz;
        
        if (newQuiz && newQuiz.questions && newQuiz.questions.length > 0) {
          // ★成功時のみ生成回数を消費
          incrementFreeQuestGenerationCount();
          // 新しい問題を履歴に追加（再挑戦用）
          addQuestionsToHistory(history.id, newQuiz.questions);
          
          // 新しく生成した問題を新しいクイズ履歴エントリとして保存（ページ更新後も保持するため）
          const newQuizId = `freequest_new_${Date.now()}`;
          
          // タイトルに「②」を追加して識別しやすくする
          const newQuizWithTitle: QuizRaw = {
            ...newQuiz,
            summary: `② ${newQuiz.summary}`,
          };
          
          const tempResult: QuizResult = {
            quizId: newQuizId,
            correctCount: 0,
            totalQuestions: newQuiz.questions.length,
            isPerfect: false,
            earnedCoins: 0,
            earnedDistance: 0,
            isDoubled: false,
            timestamp: new Date(),
          };
          
          // 新しいクイズ履歴として保存（ocrTextとstructuredOCRは元の履歴から継承）
          await saveQuizHistory(
            newQuizWithTitle,
            tempResult,
            history.ocrText,
            history.structuredOCR
          );
          
          addToast('success', '新しい問題を生成しました！');
          onStartQuiz(newQuizWithTitle);
        } else {
          throw new Error('No questions generated');
        }
      } catch (error) {
        console.error('Quiz generation error:', error);
        // ★エラー時は生成回数を消費しない
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
  
  // 広告視聴完了
  const handleAdRewardClaimed = (adType: 'scan_recovery' | 'coin_doubler') => {
    if (adType === 'scan_recovery') {
      recoverFreeQuestGenerationCount();
      setShowAdsModal(false);
      vibrateSuccess();
      addToast('success', '新問題生成回数が3回回復しました！');
    }
  };
  
  // VIP購入（一時的に非表示）
  // const handleVIPPurchase = () => {
  //   const expiresAt = new Date();
  //   expiresAt.setMonth(expiresAt.getMonth() + 1);
  //   activateVIP(expiresAt);
  //   setShowShopModal(false);
  //   vibrateSuccess();
  //   addToast('success', 'VIPプランが有効になりました！1日100回まで生成可能です。');
  // };

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

  // クイズ履歴の削除
  const handleDeleteQuiz = async (historyId: string) => {
    if (!confirm('このクイズを削除しますか？')) {
      return;
    }
    
    vibrateLight();
    try {
      await deleteQuizHistory(historyId);
      vibrateSuccess();
      addToast('success', 'クイズを削除しました');
    } catch (error) {
      console.error('Delete quiz error:', error);
      addToast('error', '削除に失敗しました');
    }
  };

  // PDF化（単一）
  const handleExportPDF = async (history: QuizHistory) => {
    vibrateLight();
    try {
      await generateQuizPDF([history]);
      vibrateSuccess();
      addToast('success', 'PDFを生成しました');
    } catch (error) {
      console.error('PDF generation error:', error);
      addToast('error', 'PDFの生成に失敗しました');
    }
  };

  // 選択状態のトグル
  const toggleQuizSelection = (quizId: string) => {
    vibrateLight();
    setSelectedQuizIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quizId)) {
        newSet.delete(quizId);
      } else {
        newSet.add(quizId);
      }
      return newSet;
    });
  };

  // 全選択/全解除
  const toggleSelectAll = () => {
    vibrateLight();
    if (selectedQuizIds.size === filteredHistory.length) {
      setSelectedQuizIds(new Set());
    } else {
      setSelectedQuizIds(new Set(filteredHistory.map(h => h.id)));
    }
  };

  // 選択した問題をまとめてPDF化
  const handleExportSelectedPDFs = async () => {
    if (selectedQuizIds.size === 0) {
      addToast('info', 'PDF化する問題を選択してください');
      return;
    }
    
    vibrateLight();
    try {
      const selectedHistories = filteredHistory.filter(h => selectedQuizIds.has(h.id));
      await generateQuizPDF(selectedHistories);
      vibrateSuccess();
      addToast('success', `${selectedHistories.length}件のクイズをPDF化しました`);
      setSelectedQuizIds(new Set()); // 選択をクリア
    } catch (error) {
      console.error('PDF generation error:', error);
      addToast('error', 'PDFの生成に失敗しました');
    }
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
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
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
        
        {/* 新問題生成制限表示 */}
        <div className={`rounded-xl p-3 mb-4 border ${
          isVIP 
            ? 'bg-yellow-500/10 border-yellow-500/30' 
            : canGenerate
              ? 'bg-cyan-500/10 border-cyan-500/30'
              : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVIP ? (
                <>
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 text-sm font-medium">
                    VIP: 1日100回まで生成可能
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className={`w-4 h-4 ${canGenerate ? 'text-cyan-400' : 'text-red-400'}`} />
                  <span className={`text-sm font-medium ${canGenerate ? 'text-cyan-400' : 'text-red-400'}`}>
                    新問題生成: 残り {remainingGenerations}/{LIMITS.FREE_USER.DAILY_FREE_QUEST_GENERATION_LIMIT} 回
                  </span>
                </>
              )}
            </div>
          </div>
          {!isVIP && !canGenerate && (
            <p className="text-red-400/70 text-xs mt-2">
              広告を視聴して3回回復するか、VIPプラン（1日100回まで）にアップグレードしてください
            </p>
          )}
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

        {/* 履歴数と選択機能 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-400">
            {filteredHistory.length} 件のクイズ
          </p>
          {filteredHistory.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {selectedQuizIds.size === filteredHistory.length ? '全解除' : '全選択'}
            </button>
          )}
        </div>

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
                className={`bg-gray-800/50 rounded-xl p-4 border ${
                  selectedQuizIds.has(history.id) ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* チェックボックス */}
                    <input
                      type="checkbox"
                      checked={selectedQuizIds.has(history.id)}
                      onChange={() => toggleQuizSelection(history.id)}
                      className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-2"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium line-clamp-2 mb-1">
                        {history.quiz.summary}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {formatDate(history.createdAt)}
                      </div>
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
                    disabled={isGenerating || !history.ocrText || !canGenerate}
                    className={`flex-1 py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                      isGenerating && generatingId === history.id
                        ? 'bg-gray-600'
                        : !canGenerate
                          ? 'bg-gray-600 opacity-50'
                          : history.ocrText
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                            : 'bg-gray-600 opacity-50'
                    }`}
                    whileHover={!isGenerating && history.ocrText && canGenerate ? { scale: 1.02 } : {}}
                    whileTap={!isGenerating && history.ocrText && canGenerate ? { scale: 0.98 } : {}}
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

                  {/* PDF化ボタン */}
                  <motion.button
                    onClick={() => handleExportPDF(history)}
                    disabled={isGenerating}
                    className="px-3 py-2.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="PDF化"
                  >
                    <FileDown className="w-4 h-4" />
                  </motion.button>

                  {/* 削除ボタン */}
                  <motion.button
                    onClick={() => handleDeleteQuiz(history.id)}
                    disabled={isGenerating}
                    className="px-3 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
        
        {/* 制限に達した時の回復オプション */}
        {!isVIP && !canGenerate && (
          <div className="mt-6 space-y-3">
            <motion.button
              onClick={() => {
                vibrateLight();
                setShowAdsModal(true);
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-5 h-5" />
              動画を見て3回回復
            </motion.button>

            {/* VIP購入ボタン（一時的に非表示） */}
            {/* <motion.button
              onClick={() => {
                vibrateLight();
                setShowShopModal(true);
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Crown className="w-5 h-5" />
              ¥550で1日100回まで
            </motion.button> */}
          </div>
        )}
      </div>

      {/* 広告モーダル */}
      <AdsModal
        isOpen={showAdsModal}
        onClose={() => setShowAdsModal(false)}
        adType="scan_recovery"
        onRewardClaimed={handleAdRewardClaimed}
      />

      {/* ショップモーダル（一時的に非表示） */}
      {/* <ShopModal
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
        onPurchase={handleVIPPurchase}
        isVIP={isVIP}
      /> */}

      {/* 選択した問題をPDF化するボタン（固定フッター） */}
      {selectedQuizIds.size > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4 z-50"
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="text-white font-medium">
              {selectedQuizIds.size} 件選択中
            </span>
            <motion.button
              onClick={handleExportSelectedPDFs}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileDown className="w-5 h-5" />
              選択した問題をPDF化
            </motion.button>
          </div>
        </motion.div>
      )}

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
                    onStartQuiz(selectedQuiz.quiz);
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

