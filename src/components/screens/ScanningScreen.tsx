/**
 * ScanningScreen.tsx
 * 
 * スキャン画面
 * 画像をスキャンしてクイズを生成する
 * Free/VIPユーザーの制限管理
 * 
 * ★重要: スキャン回数はAPI成功時のみ消費する
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Scan, 
  Crown, 
  Play, 
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  ChevronLeft,
  Sparkles,
  History
} from 'lucide-react';
import { useGameStore, selectRemainingScanCount } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { ASPSalesModal } from '@/components/ui/ASPSalesModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { useToast } from '@/components/ui/Toast';
import { compressForAI, validateImageFile, preprocessImageForOCR } from '@/lib/imageUtils';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { LIMITS } from '@/lib/constants';
import { getJstDateString } from '@/lib/dateUtils';
import type { QuizRaw, StructuredOCR, QuizResult, TranslationResult } from '@/types';
import { PREPOSITION_QUIZ, PrepositionQuizItem } from '@/data/prepositionQuiz';

// ===== Types =====

interface ScanningScreenProps {
  onQuizReady: (quiz: QuizRaw, imageUrl: string, ocrText?: string, structuredOCR?: StructuredOCR) => void;
  onTranslationReady?: (result: TranslationResult, imageUrl: string) => void;
  onOpenFreeQuest?: () => void;
  onOpenWordDex?: () => void;
  onBack?: () => void;
}

type ScanState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';
type IdleView = 'hub' | 'upload';

// ===== Main Component =====

export const ScanningScreen = ({ onQuizReady, onTranslationReady, onOpenFreeQuest, onOpenWordDex, onBack }: ScanningScreenProps) => {
  // State
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [idleView, setIdleView] = useState<IdleView>('hub');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [showASPSalesModal, setShowASPSalesModal] = useState(false);
  const [aspAdRecommendation, setAspAdRecommendation] = useState<{ ad_id: string; reason: string } | null>(null);
  const [preQuiz, setPreQuiz] = useState<PrepositionQuizItem[]>([]);
  const [preQuizIndex, setPreQuizIndex] = useState(0);
  const [preQuizSelected, setPreQuizSelected] = useState<number | null>(null);
  // const [showShopModal, setShowShopModal] = useState(false); // 一時的に非表示
  // ストアから生成されたクイズを取得
  const generatedQuiz = useGameStore(state => state.generatedQuiz);
  const scanImageUrl = useGameStore(state => state.scanImageUrl);
  const scanOcrText = useGameStore(state => state.scanOcrText);
  const scanStructuredOCR = useGameStore(state => state.scanStructuredOCR);
  const setGeneratedQuiz = useGameStore(state => state.setGeneratedQuiz);
  const clearGeneratedQuiz = useGameStore(state => state.clearGeneratedQuiz);

  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const dailyScanCount = useGameStore(state => state.dailyScanCount);
  const lastScanDate = useGameStore(state => state.lastScanDate);
  const bonusScanBalance = useGameStore(state => state.bonusScanBalance);
  const quizHistoryCount = useGameStore(state => state.quizHistory.length);
  const scanType = useGameStore(state => state.scanType);
  const translationMode = useGameStore(state => state.translationMode);
  const englishLearningMode = useGameStore(state => state.englishLearningMode);
  const setEnglishLearningMode = useGameStore(state => state.setEnglishLearningMode);
  const remainingScans = useGameStore(selectRemainingScanCount);
  const checkScanLimit = useGameStore(state => state.checkScanLimit);
  const incrementScanCount = useGameStore(state => state.incrementScanCount);
  const incrementTranslationCount = useGameStore(state => state.incrementTranslationCount);
  const purchaseScanRecovery = useGameStore(state => state.purchaseScanRecovery);
  const saveQuizHistory = useGameStore(state => state.saveQuizHistory);
  const registerQuizBatchToWordDex = useGameStore(state => state.registerQuizBatchToWordDex);
  const setTranslationResult = useGameStore(state => state.setTranslationResult);
  const setLastScanQuizId = useGameStore(state => state.setLastScanQuizId);
  // const activateVIP = useGameStore(state => state.activateVIP); // 一時的に非表示

  // Toast
  const { addToast } = useToast();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  const canScan = isVIP || remainingScans > 0;
  const isQuizMode = scanType === 'quiz';
  // スキャン残数が0なら翻訳モードでもアップロード不可
  const canUpload = canScan;
  const today = getJstDateString();
  const usedToday = lastScanDate === today ? dailyScanCount : 0;
  const freeRemaining = Math.max(0, LIMITS.FREE_USER.DAILY_SCAN_LIMIT - usedToday);
  const bonusRemaining = Math.max(0, bonusScanBalance ?? 0);

  const displayProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const fallbackProgressLabel = scanState === 'uploading'
    ? '画像を送信中...'
    : scanState === 'processing'
      ? (scanType === 'translation'
        ? (translationMode === 'multilang' ? '多言語翻訳を実行中...' : '英文解釈を実行中...')
        : 'クイズを生成中...')
      : '';
  const effectiveProgressLabel = progressLabel || fallbackProgressLabel;

  const stopProgressTicker = useCallback((finalValue?: number) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (typeof finalValue === 'number') {
      setProgress(finalValue);
    }
  }, []);

  const startProgressTicker = useCallback(() => {
    stopProgressTicker();
    const step = scanType === 'translation' && translationMode === 'english_learning' ? 3 : 5;
    setProgress(step);
    progressTimerRef.current = window.setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + step, 95);
        if (next >= 95 && progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        return next;
      });
    }, 1000);
  }, [scanType, translationMode, stopProgressTicker]);

  useEffect(() => {
    return () => {
      stopProgressTicker();
    };
  }, [stopProgressTicker]);

  // ページ更新後にストアから復元されたクイズがある場合は、ready状態にする
  useEffect(() => {
    // 画面入場時に前回のスキャン状態をリセット
    clearGeneratedQuiz();
    setTranslationResult(null);
    setLastScanQuizId(null);
    setSelectedImage(null);
    setScanState('idle');
    setErrorMessage('');
    stopProgressTicker(0);
    setProgressLabel('');
    setAspAdRecommendation(null);
    setPreQuiz([]);
    setPreQuizIndex(0);
    setPreQuizSelected(null);
    setIdleView(scanType === 'quiz' ? 'hub' : 'upload');
  }, [clearGeneratedQuiz, setTranslationResult, setLastScanQuizId, stopProgressTicker, scanType]);

  useEffect(() => {
    if (generatedQuiz && scanImageUrl && scanState === 'idle') {
      setScanState('ready');
      setSelectedImage(scanImageUrl);
    }
  }, [generatedQuiz, scanImageUrl, scanState]);

  // 英語学習モード用：前置詞クイズをランダムにセット（50問）
  useEffect(() => {
    if (scanType === 'translation' && translationMode === 'english_learning') {
      const shuffled = [...PREPOSITION_QUIZ].sort(() => Math.random() - 0.5).slice(0, 50);
      setPreQuiz(shuffled);
      setPreQuizIndex(0);
      setPreQuizSelected(null);
    } else {
      setPreQuiz([]);
      setPreQuizIndex(0);
      setPreQuizSelected(null);
    }
  }, [scanType, translationMode]);

  const currentPreQuiz = useMemo(() => {
    if (preQuiz.length === 0) return null;
    return preQuiz[preQuizIndex % preQuiz.length];
  }, [preQuiz, preQuizIndex]);

  const handlePreQuizSelect = (idx: number) => {
    setPreQuizSelected(idx);
  };

  const handlePreQuizNext = () => {
    setPreQuizIndex((i) => (i + 1) % (preQuiz.length || 1));
    setPreQuizSelected(null);
  };

  // ページ更新後にストアから復元されたクイズがある場合は、ready状態にする
  useEffect(() => {
    if (generatedQuiz && scanImageUrl && scanState === 'idle') {
      setScanState('ready');
      setSelectedImage(scanImageUrl);
    }
  }, [generatedQuiz, scanImageUrl, scanState]);

  // スキャン中の語句表示を無効化（要望により非表示）
  useEffect(() => {
    // no-op: vocab表示廃止
  }, [scanState, scanType, translationMode]);

  // ファイル選択
  const handleFileSelect = useCallback(async (file: File) => {
    vibrateLight();

    startProgressTicker();
    setProgressLabel('画像を確認中...');

    // 制限チェック（消費はまだしない）- 翻訳モードでもスキャン残数を参照
    const limitCheck = checkScanLimit();
    if (!limitCheck.canScan) {
      setErrorMessage(limitCheck.error || 'スキャン回数の上限に達しました');
      setScanState('error');
      stopProgressTicker(0);
      setProgressLabel('');
      vibrateError();
      return;
    }

    // バリデーション
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || '無効なファイルです');
      setScanState('error');
      stopProgressTicker(0);
      setProgressLabel('');
      vibrateError();
      return;
    }

    setScanState('uploading');
    setErrorMessage('');
    setProgressLabel('プレビューを準備中...');
    try {
      // 1. 画像を圧縮（プレビュー用）
      const compressed = await compressForAI(file);
      setSelectedImage(compressed.dataUrl);
      setProgressLabel('画像を最適化中...');
      setScanState('processing');
      
      // 2. OCR用に画像補正（コントラスト・シャープネス強化）
      const enhancedImage = await preprocessImageForOCR(file);
      setProgressLabel('OCR用に補正中...');

      const controller = new AbortController();
      // 英語学習モードは処理に時間がかかるため、タイムアウトを120秒に延長
      const timeoutDuration = scanType === 'translation' && translationMode === 'english_learning' ? 120000 : 60000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      if (scanType === 'translation') {
        // 翻訳モード
        setProgressLabel(translationMode === 'multilang' ? '多言語翻訳をリクエスト中...' : '英文解釈をリクエスト中...');
        // 英語学習モードの場合は専用APIを使用
        const apiEndpoint = translationMode === 'english_learning' 
          ? '/api/translate-english' 
          : '/api/translate';

        // 通常のAPI呼び出し（ストリーミングなし）
        const translateResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: enhancedImage,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setProgressLabel('結果を解析中...');

        if (translateResponse.status === 429) {
          stopProgressTicker(0);
          setProgressLabel('');
          setScanState('idle');
          vibrateError();
          alert("🙏 申し訳ありません！\n\n本日のAI解析サーバーが混み合っており、1日の利用上限に達しました。\n（コスト制限のため、現在は1日限定数で運営しています）\n\n明日になるとリセットされますので、また明日お試しください！");
          return;
        }

        if (!translateResponse.ok) {
          const errorData = await translateResponse.json().catch(() => ({}));
          const errorMessage = errorData.details || errorData.error || `Translation error: ${translateResponse.status}`;
          console.error("Translation API error:", errorMessage);
          throw new Error(errorMessage);
        }

        const translateResult = await translateResponse.json();

        // 新しい形式（sentences配列）または旧形式に対応
        const hasSentencesFormat = translateResult.sentences && Array.isArray(translateResult.sentences) && translateResult.sentences.length > 0;
        const hasNewFormat = translateResult.marked_text && translateResult.japanese_translation;
        const hasOldFormat = translateResult.originalText && translateResult.translatedText;
        
        if (hasSentencesFormat || hasNewFormat || hasOldFormat) {
          // 進行度を100%にして翻訳結果を表示
          // ★成功時のみ翻訳回数とスキャン回数を消費
          incrementTranslationCount();
          incrementScanCount();
          stopProgressTicker(100);
          setProgressLabel('完了');
          
          if (onTranslationReady) {
            onTranslationReady(
              {
                originalText: translateResult.originalText || '',
                translatedText: translateResult.translatedText || translateResult.japanese_translation || '',
                marked_text: translateResult.marked_text,
                japanese_translation: translateResult.japanese_translation,
                sentences: translateResult.sentences, // 新形式（英文解釈モード用）
                chunks: translateResult.chunks,
                teacherComment: translateResult.teacherComment,
                // 多言語モード用のフィールド
                summary: translateResult.summary,
                textType: translateResult.textType,
                tone: translateResult.tone,
                technicalTerms: translateResult.technicalTerms,
                // カバレッジチェック: 欠落の可能性がある単語
                missing_tokens: translateResult.missing_tokens,
                // 全文（スキャン結果の完全なテキスト）
                clean_text: translateResult.clean_text,
              },
              compressed.dataUrl
            );
          }
          
          vibrateSuccess();
          addToast('success', '翻訳が完了しました！');
        } else if (translateResult.error) {
          const errorMsg = translateResult.details || translateResult.error || '翻訳に失敗しました';
          throw new Error(errorMsg);
        } else {
          console.error('翻訳レスポンス形式が不正:', translateResult);
          throw new Error('翻訳に失敗しました（レスポンス形式が不正です）');
        }
      } else {
        // クイズモード
        setProgressLabel('クイズ生成をリクエスト中...');
        const quizResponse = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: enhancedImage, // 補正済み画像を送信
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setProgressLabel('問題を組み立て中...');

        if (quizResponse.status === 429) {
          stopProgressTicker(0);
          setProgressLabel('');
          setScanState('idle');
          vibrateError();
          alert("🙏 申し訳ありません！\n\n本日のAI解析サーバーが混み合っており、1日の利用上限に達しました。\n（コスト制限のため、現在は1日限定数で運営しています）\n\n明日になるとリセットされますので、また明日お試しください！");
          return;
        }

        if (!quizResponse.ok) {
          throw new Error(`Quiz error: ${quizResponse.status}`);
        }

        const quizResult = await quizResponse.json();

        // APIは { quiz: ..., ocrText: ..., structuredOCR: ... } を返す
        if (quizResult.quiz && quizResult.quiz.questions && quizResult.quiz.questions.length > 0) {
          // ★成功時のみスキャン回数を消費
          incrementScanCount();
          stopProgressTicker(100);
          setProgressLabel('完了');

          // スキャンした時点でクイズを履歴に保存（まだ未プレイのテンプレートとして）
          const scanQuizId = `scan_${Date.now()}`;
          const initialResult: QuizResult = {
            quizId: scanQuizId,
            correctCount: 0,
            totalQuestions: quizResult.quiz.questions.length,
            isPerfect: false,
            earnedCoins: 0,
            earnedDistance: 0,
            isDoubled: false,
            timestamp: new Date(),
          };
          // ★スキャン時の quizId を記録（結果画面で重複防止に使用）
          useGameStore.getState().setLastScanQuizId(scanQuizId);
          // ★ここでクラウドへの書き込み完了まで await する
          console.log('[ScanningScreen] Calling saveQuizHistory...');
          await saveQuizHistory(quizResult.quiz, initialResult, quizResult.ocrText, quizResult.structuredOCR);
          console.log('[ScanningScreen] saveQuizHistory completed');
          registerQuizBatchToWordDex(quizResult.quiz, scanQuizId);

          // ストアに保存（ページ更新後も保持）
          setGeneratedQuiz(quizResult.quiz, compressed.dataUrl, quizResult.ocrText, quizResult.structuredOCR);
          
          // ASP広告推奨を保存（クイズ生成成功時のみ）
          if (quizResult.quiz.ad_recommendation) {
            setAspAdRecommendation(quizResult.quiz.ad_recommendation);
          }
          
          setScanState('ready');
          vibrateSuccess();
          addToast('success', 'クイズを生成しました！');
        } else if (quizResult.error) {
          throw new Error(quizResult.error);
        } else {
          throw new Error('クイズ生成に失敗しました');
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      // エラーの種類を判定
      let message = 'エラーが発生しました';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = '通信がタイムアウトしました。再度お試しください。';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          message = '通信エラーが発生しました。ネットワーク接続を確認してください。';
        } else {
          message = error.message;
        }
      }
      
      // ★エラー時はスキャン回数を消費しない
      setErrorMessage(message);
      setScanState('error');
      stopProgressTicker(0);
      setProgressLabel('');
      vibrateError();
      addToast('error', message);
    }
  }, [checkScanLimit, incrementScanCount, addToast, translationMode, scanType, onTranslationReady, saveQuizHistory, registerQuizBatchToWordDex, setGeneratedQuiz, setAspAdRecommendation, onQuizReady, startProgressTicker, stopProgressTicker]);

  // ファイル入力変更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // ドラッグ&ドロップ
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // クイズ開始
  const handleStartQuiz = () => {
    vibrateLight();
    if (generatedQuiz && scanImageUrl) {
      onQuizReady(generatedQuiz, scanImageUrl, scanOcrText, scanStructuredOCR);
      // クイズ画面へ遷移したらスキャン画面は初期状態に戻す
      setScanState('idle');
      setSelectedImage(null);
      clearGeneratedQuiz();
      setErrorMessage('');
      stopProgressTicker(0);
      setProgressLabel('');
      setAspAdRecommendation(null);
    }
  };

  // VIP購入（一時的に非表示）
  // const handleVIPPurchase = () => {
  //   const expiresAt = new Date();
  //   expiresAt.setMonth(expiresAt.getMonth() + 1);
  //   activateVIP(expiresAt);
  //   setShowShopModal(false);
  //   vibrateSuccess();
  //   addToast('success', 'VIPプランが有効になりました！');
  // };

  // リセット
  const handleReset = () => {
    vibrateLight();
    setScanState('idle');
    setIdleView(scanType === 'quiz' ? 'hub' : 'upload');
    setSelectedImage(null);
    clearGeneratedQuiz(); // ストアからもクリア
    setErrorMessage('');
    stopProgressTicker(0);
    setProgressLabel('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto pt-4 pb-4">
        <div className="flex items-center justify-between mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </button>
          )}
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scan className="w-6 h-6 text-cyan-400" />
            冒険の拠点
          </h1>
          
          {/* スキャン残り回数 */}
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            isVIP 
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
              : canScan
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {isVIP ? (
              <span className="flex items-center gap-1">
                <Crown className="w-4 h-4" />
                VIP Unlimited
              </span>
            ) : (
              <div className="leading-tight">
                <p>本日残り {remainingScans}回</p>
                <p className="text-[10px] opacity-80">無料：{freeRemaining} / ボーナス：{bonusRemaining}</p>
              </div>
            )}
          </div>
        </div>

        {/* ポテトアバター（拠点画面ではカード内に表示） */}
        {scanState !== 'idle' && (
          <div className="flex justify-center mb-6">
            <PotatoAvatar
              emotion={scanState === 'ready' ? 'happy' : scanState === 'error' ? 'confused' : 'normal'}
              size={100}
              ssrEffect={false}
            />
          </div>
        )}

        {/* 英文解釈モードの学習属性選択（スキャン前） */}
        {scanType === 'translation' && translationMode === 'english_learning' && (
          <div className="mb-6 bg-gray-800/80 border border-indigo-500/30 rounded-xl p-4 space-y-2">
            <p className="text-sm text-indigo-100 font-semibold">学習モードを選択してください</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEnglishLearningMode('STUDENT')}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  englishLearningMode === 'STUDENT'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                }`}
              >
                🎓 学生・受験
              </button>
              <button
                onClick={() => setEnglishLearningMode('TOEIC')}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  englishLearningMode === 'TOEIC'
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                }`}
              >
                🏢 社会人・TOEIC
              </button>
            </div>
          </div>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {/* アイドル状態: アップロードエリア */}
          {scanState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {isQuizMode && idleView === 'hub' ? (
                <div className="space-y-3">
                  <motion.button
                    onClick={() => {
                      vibrateLight();
                      setIdleView('upload');
                    }}
                    className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold text-lg flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Scan className="w-6 h-6" />
                    新しい冒険をスキャン
                  </motion.button>

                  <motion.button
                    onClick={() => {
                      if (!onOpenFreeQuest || quizHistoryCount <= 0) return;
                      vibrateLight();
                      onOpenFreeQuest();
                    }}
                    disabled={!onOpenFreeQuest || quizHistoryCount <= 0}
                    className={`w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 ${
                      quizHistoryCount > 0
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
                        : 'bg-gray-700/70 text-gray-400'
                    }`}
                    whileHover={quizHistoryCount > 0 ? { scale: 1.02 } : {}}
                    whileTap={quizHistoryCount > 0 ? { scale: 0.98 } : {}}
                  >
                    <History className="w-5 h-5" />
                    フリークエスト
                    <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {quizHistoryCount}
                    </span>
                  </motion.button>

                  <motion.button
                    onClick={() => {
                      if (!onOpenWordDex) return;
                      vibrateLight();
                      onOpenWordDex();
                    }}
                    disabled={!onOpenWordDex}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold flex items-center justify-center gap-2"
                    whileHover={onOpenWordDex ? { scale: 1.02 } : {}}
                    whileTap={onOpenWordDex ? { scale: 0.98 } : {}}
                  >
                    ことば図鑑
                  </motion.button>
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-800/50 border border-gray-700 p-4">
                  {isQuizMode && (
                    <button
                      onClick={() => {
                        vibrateLight();
                        setIdleView('hub');
                      }}
                      className="mb-3 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      冒険の拠点に戻る
                    </button>
                  )}

                  <div className="mb-3">
                    <h2 className="text-white font-bold text-lg">
                      {isQuizMode ? '' : '画像をアップロード'}
                    </h2>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    {isQuizMode
                      ? ''
                      : '翻訳したい画像をアップロードしてください。'}
                  </p>

                  <div
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                      canUpload 
                        ? 'border-gray-600 hover:border-cyan-500 cursor-pointer' 
                        : 'border-gray-700 bg-gray-800/50 cursor-not-allowed'
                    }`}
                    onDrop={canUpload ? handleDrop : undefined}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => {
                      if (canUpload) {
                        vibrateLight();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleInputChange}
                      disabled={!canUpload}
                    />

                    {canUpload ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-cyan-400" />
                        </div>
                        <p className="text-white font-medium mb-2">
                          {isQuizMode ? '画像を読み込んで、冒険開始' : '翻訳用の画像をアップロード'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          タップして選択、またはドラッグ＆ドロップ
                        </p>
                        
                        {/* 注意書き */}
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <p className="text-amber-400 text-xs font-medium flex items-center justify-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            1ページずつスキャンしてください
                          </p>
                          <p className="text-amber-400/70 text-xs mt-1">
                            見開き2ページは正しく読み取れません
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <p className="text-red-400 font-medium mb-2">
                          本日のスキャン回数上限（3回）
                        </p>
                        <p className="text-gray-500 text-sm">
                          回復オプションを購入するか、VIPプラン（1日50回まで）にアップグレードしてください（実装予定）。
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Freeユーザー向け回復オプション */}
              {!isVIP && scanType === 'quiz' && !canScan && (
                <div className="mt-6 space-y-3">
                  {/* ASP広告モーダル表示ボタン（ad_recommendationがある場合のみ） */}
                  {aspAdRecommendation && (
                    <motion.button
                      onClick={() => {
                        vibrateLight();
                        setShowASPSalesModal(true);
                      }}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Sparkles className="w-5 h-5" />
                      AI先生からのアドバイスを見る
                    </motion.button>
                  )}
                  
                  <motion.button
                    onClick={() => {
                      vibrateLight();
                      const res = purchaseScanRecovery();
                      if (res.success) {
                        addToast('success', res.message);
                        setScanState('idle');
                      } else {
                        addToast('error', res.message);
                      }
                    }}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-5 h-5" />
                    100コインで1回回復
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
            </motion.div>
          )}

          {/* ローディングゲーム表示（廃止） */}

          {/* アップロード/処理中（ゲーム表示有無にかかわらず進行度を表示） */}
          {(scanState === 'uploading' || scanState === 'processing') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12 space-y-6"
            >
              {selectedImage && (
                <div className="w-48 h-48 mx-auto mb-6 rounded-xl overflow-hidden border-2 border-cyan-500/50">
                  <img 
                    src={selectedImage} 
                    alt="Selected" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* ロードメーター（非表示要望により削除） */}
              <div className="max-w-md mx-auto mb-6">
                <div className="flex items-center justify-between text-sm text-cyan-100 mb-2 px-4">
                  <span className="text-left line-clamp-2">{effectiveProgressLabel}</span>
                  <span className="font-semibold">{displayProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-cyan-500/30">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${displayProgress}%` }}
                  />
                </div>
              </div>

              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-white font-medium text-lg mb-2">
                {scanState === 'uploading' 
                  ? '画像を処理中...' 
                  : scanType === 'translation'
                    ? (translationMode === 'multilang' ? '要約中...' : '英文解釈中...')
            : 'クイズ作成中...'}
              </p>

              {/* 暇つぶし前置詞クイズ（英語学習モードかつロード中のみ表示） */}
              {scanType === 'translation' && translationMode === 'english_learning' && currentPreQuiz && (
                <div className="mt-4 max-w-xl mx-auto text-left bg-gray-800/70 border border-gray-700 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-indigo-200">⏳ ローディング中の前置詞クイズ</div>
                    <div className="text-xs text-gray-400">{preQuizIndex + 1}/{Math.max(1, preQuiz.length)}</div>
                  </div>
                  <div className="text-white font-semibold leading-relaxed">{currentPreQuiz.q}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {currentPreQuiz.options.map((opt: string, i: number) => {
                      const isCorrect = preQuizSelected !== null && i === currentPreQuiz.a;
                      const isSelected = preQuizSelected === i;
                      return (
                        <button
                          key={i}
                          onClick={() => handlePreQuizSelect(i)}
                          className={`w-full px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                            isSelected
                              ? isCorrect
                                ? 'bg-green-600/30 border-green-400 text-green-200'
                                : 'bg-red-600/30 border-red-400 text-red-200'
                              : 'bg-gray-700/60 border-gray-600 text-gray-100 hover:border-cyan-400'
                          }`}
                          disabled={preQuizSelected !== null}
                        >
                          {String.fromCharCode(65 + i)}. {opt}
                        </button>
                      );
                    })}
                  </div>
                  {preQuizSelected !== null && (
                    <div className={`text-sm p-3 rounded-lg border ${preQuizSelected === currentPreQuiz.a ? 'border-green-500/50 bg-green-500/10 text-green-200' : 'border-red-500/50 bg-red-500/10 text-red-200'}`}>
                      正解: {currentPreQuiz.options[currentPreQuiz.a]} / 解説: {currentPreQuiz.explanation}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handlePreQuizNext}
                      className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      次の問題
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 準備完了 */}
          {scanState === 'ready' && generatedQuiz && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6">
                {(selectedImage || scanImageUrl) && (
                  <div className="w-full h-40 mb-4 rounded-xl overflow-hidden">
                    <img 
                      src={selectedImage || scanImageUrl || ''} 
                      alt="Scanned" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-white font-bold mb-1">クイズ準備完了！</h3>
                    <p className="text-gray-400 text-sm">{generatedQuiz.summary}</p>
                  </div>
                </div>

                {/* キーワード */}
                <div className="flex flex-wrap gap-2">
                  {generatedQuiz.keywords.map((keyword, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm"
                    >
                      #{keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <motion.button
                  onClick={handleStartQuiz}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold text-lg flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Play className="w-6 h-6" />
                  冒険を始める
                </motion.button>

                <button
                  onClick={handleReset}
                  className="w-full py-3 rounded-xl bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition-colors"
                >
                  別の画像をスキャン
                </button>
              </div>
            </motion.div>
          )}

          {/* エラー */}
          {scanState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-medium mb-2">エラーが発生しました</p>
              <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
              
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors"
              >
                やり直す
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* ASP広告モーダル */}
      <ASPSalesModal
        isOpen={showASPSalesModal}
        onClose={() => setShowASPSalesModal(false)}
        adRecommendation={aspAdRecommendation}
      />

      {/* ショップモーダル（一時的に非表示） */}
      {/* <ShopModal
        isOpen={showShopModal}
        onClose={() => setShowShopModal(false)}
        onPurchase={handleVIPPurchase}
        isVIP={isVIP}
      /> */}
    </div>
  );
};

export default ScanningScreen;
