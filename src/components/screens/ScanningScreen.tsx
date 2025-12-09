/**
 * ScanningScreen.tsx
 * 
 * スキャン画面
 * 画像をスキャンしてクイズを生成する
 * Free/VIPユーザーの制限管理
 * 
 * ★重要: スキャン回数はAPI成功時のみ消費する
 */

import { useState, useRef, useCallback, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { useGameStore, selectRemainingScanCount } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { ASPSalesModal } from '@/components/ui/ASPSalesModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { useToast } from '@/components/ui/Toast';
import { compressForAI, validateImageFile, preprocessImageForOCR } from '@/lib/imageUtils';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { LIMITS } from '@/lib/constants';
import type { QuizRaw, StructuredOCR, QuizResult, TranslationResult } from '@/types';
import { LoadingGameManager } from '@/components/games/LoadingGameManager';

// ===== Types =====

interface ScanningScreenProps {
  onQuizReady: (quiz: QuizRaw, imageUrl: string, ocrText?: string, structuredOCR?: StructuredOCR) => void;
  onTranslationReady?: (result: TranslationResult, imageUrl: string) => void;
  onBack?: () => void;
}

type ScanState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

// ===== Main Component =====

export const ScanningScreen = ({ onQuizReady, onTranslationReady, onBack }: ScanningScreenProps) => {
  // State
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showASPSalesModal, setShowASPSalesModal] = useState(false);
  const [aspAdRecommendation, setAspAdRecommendation] = useState<{ ad_id: string; reason: string } | null>(null);
  const [currentVocab, setCurrentVocab] = useState<{ word: string; meaning: string; options: string[]; correctIndex: number; explanation?: string; isIdiom?: boolean } | null>(null);
  const [selectedVocabAnswer, setSelectedVocabAnswer] = useState<number | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showPrepositionGame, setShowPrepositionGame] = useState(false);
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
  const scanType = useGameStore(state => state.scanType);
  const translationMode = useGameStore(state => state.translationMode);
  const remainingScans = useGameStore(selectRemainingScanCount);
  const checkScanLimit = useGameStore(state => state.checkScanLimit);
  const checkTranslationLimit = useGameStore(state => state.checkTranslationLimit);
  const incrementScanCount = useGameStore(state => state.incrementScanCount);
  const incrementTranslationCount = useGameStore(state => state.incrementTranslationCount);
  // const recoverScanCount = useGameStore(state => state.recoverScanCount);
  const saveQuizHistory = useGameStore(state => state.saveQuizHistory);
  // const activateVIP = useGameStore(state => state.activateVIP); // 一時的に非表示

  // Toast
  const { addToast } = useToast();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canScan = isVIP || remainingScans > 0;

  // ページ更新後にストアから復元されたクイズがある場合は、ready状態にする
  useEffect(() => {
    if (generatedQuiz && scanImageUrl && scanState === 'idle') {
      setScanState('ready');
      setSelectedImage(scanImageUrl);
    }
  }, [generatedQuiz, scanImageUrl, scanState]);

  // ページ更新後にストアから復元されたクイズがある場合は、ready状態にする
  useEffect(() => {
    if (generatedQuiz && scanImageUrl && scanState === 'idle') {
      setScanState('ready');
      setSelectedImage(scanImageUrl);
    }
  }, [generatedQuiz, scanImageUrl, scanState]);

  // ロードメーターの進行度を一定のペースでアニメーション
  useEffect(() => {
    if (scanState !== 'processing') {
      setLoadProgress(0);
      return;
    }

    // 一定のペースで進行度を増加（約50秒で100%に到達）
    const duration = 50000; // 50秒
    const interval = 100; // 100msごとに更新
    const increment = (100 / duration) * interval; // 1回あたりの増加量

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + increment, 95); // 95%まで自動進行
      setLoadProgress(currentProgress);
    }, interval);

    return () => clearInterval(progressInterval);
  }, [scanState]);

  // スキャン中に過去の重要語句をランダム表示（二択問題形式、多言語モードでは表示しない）
  useEffect(() => {
    if (scanState !== 'processing' || scanType !== 'translation' || translationMode !== 'english_learning') {
      setCurrentVocab(null);
      setSelectedVocabAnswer(null);
      return;
    }

    // 一般的な重要語句と選択肢を生成
    const generateVocabQuestion = () => {
      const vocabList = [
        // 句動詞（Phrasal Verbs）
        { word: 'keep up with', meaning: '～に追いつく', isIdiom: false },
        { word: 'take advantage of', meaning: '～を利用する', isIdiom: false },
        { word: 'come up with', meaning: '～を思いつく', isIdiom: false },
        { word: 'look forward to', meaning: '～を楽しみにする', isIdiom: false },
        { word: 'get along with', meaning: '～と仲良くする', isIdiom: false },
        { word: 'deal with', meaning: '～に対処する', isIdiom: false },
        { word: 'put up with', meaning: '～を我慢する', isIdiom: false },
        { word: 'run out of', meaning: '～を使い果たす', isIdiom: false },
        { word: 'give up', meaning: '～を諦める', isIdiom: false },
        { word: 'look after', meaning: '～の世話をする', isIdiom: false },
        // イディオム（Idioms）
        { 
          word: 'break the ice', 
          meaning: '場の雰囲気を和らげる',
          explanation: '緊張した雰囲気を和らげることを意味します。',
          isIdiom: true 
        },
        { 
          word: 'hit the nail on the head', 
          meaning: '的確に言い当てる',
          explanation: '物事の核心を正確に捉えることを表します。',
          isIdiom: true 
        },
        { 
          word: 'once in a blue moon', 
          meaning: 'めったにない',
          explanation: '非常に稀な出来事を表します。',
          isIdiom: true 
        },
        { 
          word: 'the ball is in your court', 
          meaning: 'あなた次第だ',
          explanation: '次の行動は相手次第という意味です。',
          isIdiom: true 
        },
        { 
          word: 'bite the bullet', 
          meaning: '困難に耐える',
          explanation: '困難に耐えることを意味します。',
          isIdiom: true 
        },
        { 
          word: 'piece of cake', 
          meaning: 'とても簡単なこと',
          explanation: 'とても簡単なことを表します。',
          isIdiom: true 
        },
        { 
          word: 'under the weather', 
          meaning: '体調が悪い',
          explanation: '体調が悪いことを意味します。',
          isIdiom: true 
        },
        { 
          word: 'spill the beans', 
          meaning: '秘密を漏らす',
          explanation: '秘密を漏らすことを意味します。',
          isIdiom: true 
        },
        { 
          word: 'cost an arm and a leg', 
          meaning: '非常に高価だ',
          explanation: '非常に高価であることを表します。',
          isIdiom: true 
        },
        { 
          word: 'break a leg', 
          meaning: '頑張って（幸運を祈る）',
          explanation: '頑張って（幸運を祈る）という意味です。',
          isIdiom: true 
        },
        { 
          word: 'let the cat out of the bag', 
          meaning: '秘密を漏らす',
          explanation: '秘密を漏らすことを意味します。',
          isIdiom: true 
        },
        { 
          word: 'kill two birds with one stone', 
          meaning: '一石二鳥',
          explanation: '一つの行動で二つの目的を達成することを表します。',
          isIdiom: true 
        },
        { 
          word: 'the last straw', 
          meaning: '我慢の限界',
          explanation: '我慢の限界を表します。',
          isIdiom: true 
        },
        { 
          word: 'when pigs fly', 
          meaning: 'ありえない（絶対にない）',
          explanation: '絶対に起こらないことを表します。',
          isIdiom: true 
        },
        { 
          word: 'raining cats and dogs', 
          meaning: '土砂降り',
          explanation: '土砂降りを意味します。',
          isIdiom: true 
        },
      ];

      const wrongMeanings = [
        '～を避ける', '～を破壊する', '～を無視する', '～を拒否する',
        '～を開始する', '～を終了する', '～を延期する', '～を加速する',
        '～を減らす', '～を増やす', '～を変更する', '～を維持する',
      ];

      const randomVocab = vocabList[Math.floor(Math.random() * vocabList.length)];
      const wrongMeaning = wrongMeanings[Math.floor(Math.random() * wrongMeanings.length)];
      
      // 正解の位置をランダムに（0または1）
      const correctIndex = Math.floor(Math.random() * 2);
      const options = correctIndex === 0 
        ? [randomVocab.meaning, wrongMeaning]
        : [wrongMeaning, randomVocab.meaning];

      return {
        word: randomVocab.word,
        meaning: randomVocab.meaning,
        options,
        correctIndex,
        explanation: randomVocab.explanation,
        isIdiom: randomVocab.isIdiom,
      };
    };
    
    // 最初の問題を設定
    setCurrentVocab(generateVocabQuestion());
    setSelectedVocabAnswer(null);

    // 5秒ごとに問題を変更
    const interval = setInterval(() => {
      setCurrentVocab(generateVocabQuestion());
      setSelectedVocabAnswer(null);
    }, 5000);

    return () => clearInterval(interval);
  }, [scanState, scanType]);

  // ファイル選択
  const handleFileSelect = useCallback(async (file: File) => {
    vibrateLight();

    // 制限チェック（消費はまだしない）
    if (scanType === 'translation') {
      const limitCheck = checkTranslationLimit();
      if (!limitCheck.canTranslate) {
        setErrorMessage(limitCheck.error || '翻訳回数の上限に達しました');
        setScanState('error');
        vibrateError();
        return;
      }
    } else {
      const limitCheck = checkScanLimit();
      if (!limitCheck.canScan) {
        setErrorMessage(limitCheck.error || 'スキャン回数の上限に達しました');
        setScanState('error');
        vibrateError();
        return;
      }
    }

    // バリデーション
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || '無効なファイルです');
      setScanState('error');
      vibrateError();
      return;
    }

    setScanState('uploading');
    setErrorMessage('');
    setLoadProgress(0);

    try {
      // 1. 画像を圧縮（プレビュー用）
      const compressed = await compressForAI(file);
      setSelectedImage(compressed.dataUrl);
      setScanState('processing');
      
      // 翻訳モード（英語学習モードのみ）の場合、前置詞ゲームを開始
      if (scanType === 'translation' && translationMode === 'english_learning') {
        setShowPrepositionGame(true);
      }

      // 2. OCR用に画像補正（コントラスト・シャープネス強化）
      const enhancedImage = await preprocessImageForOCR(file);

      const controller = new AbortController();
      // 英語学習モードは処理に時間がかかるため、タイムアウトを120秒に延長
      const timeoutDuration = scanType === 'translation' && translationMode === 'english_learning' ? 120000 : 60000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      if (scanType === 'translation') {
        // 翻訳モード
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
          setLoadProgress(100);
          
          // 少し待ってから翻訳結果を表示（100%表示を確認できるように）
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // ★成功時のみ翻訳回数を消費
          incrementTranslationCount();
          
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
        const quizResponse = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: enhancedImage, // 補正済み画像を送信
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!quizResponse.ok) {
          throw new Error(`Quiz error: ${quizResponse.status}`);
        }

        const quizResult = await quizResponse.json();

        // APIは { quiz: ..., ocrText: ..., structuredOCR: ... } を返す
        if (quizResult.quiz && quizResult.quiz.questions && quizResult.quiz.questions.length > 0) {
          // ★成功時のみスキャン回数を消費
          incrementScanCount();

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
      
      // エラー時は進行度をリセット
      setLoadProgress(0);
      
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
      vibrateError();
      addToast('error', message);
    }
  }, [checkScanLimit, incrementScanCount, addToast]);

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
    setSelectedImage(null);
    clearGeneratedQuiz(); // ストアからもクリア
    setErrorMessage('');
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
            スキャン
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
              `残り ${remainingScans}/${LIMITS.FREE_USER.DAILY_SCAN_LIMIT} 回`
            )}
          </div>
        </div>

        {/* ポテトアバター */}
        <div className="flex justify-center mb-6">
          <PotatoAvatar
            emotion={scanState === 'ready' ? 'happy' : scanState === 'error' ? 'confused' : 'normal'}
            size={100}
            ssrEffect={isVIP}
          />
        </div>
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
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                  canScan 
                    ? 'border-gray-600 hover:border-cyan-500 cursor-pointer' 
                    : 'border-gray-700 bg-gray-800/50 cursor-not-allowed'
                }`}
                onDrop={canScan ? handleDrop : undefined}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => {
                  if (canScan) {
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
                  disabled={!canScan}
                />

                {canScan ? (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className="text-white font-medium mb-2">
                      画像をアップロード
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
                      本日のスキャン回数上限（5回）
                    </p>
                    <p className="text-gray-500 text-sm">
                      広告を視聴して3回回復するか、VIPプラン（1日100回まで）にアップグレードしてください
                    </p>
                  </>
                )}
              </div>

              {/* Freeユーザー向け回復オプション */}
              {!isVIP && !canScan && (
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
                    disabled
                    className="w-full py-4 rounded-xl bg-gray-700 text-gray-400 font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Play className="w-5 h-5" />
                    回復オプションは利用できません
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

          {/* ローディングゲーム表示（翻訳モードで処理中の場合、ただし多言語モードでは表示しない） */}
          {showPrepositionGame && scanState === 'processing' && scanType === 'translation' && translationMode === 'english_learning' && (
            <LoadingGameManager
              onComplete={() => setShowPrepositionGame(false)}
              progress={loadProgress}
            />
          )}

          {/* アップロード/処理中 */}
          {(scanState === 'uploading' || scanState === 'processing') && !showPrepositionGame && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12"
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
              
              {/* ロードメーター（翻訳モードのみ表示） */}
              {scanType === 'translation' && (
                <div className="w-full max-w-xs mx-auto mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">処理中...</span>
                    <span className="text-cyan-400 font-bold text-sm">{Math.round(loadProgress)}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${loadProgress}%` }}
                      transition={{
                        duration: 0.3,
                        ease: "easeOut"
                      }}
                    />
                  </div>
                </div>
              )}
              
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-white font-medium text-lg mb-2">
                {scanState === 'uploading' 
                  ? '画像を処理中...' 
                  : scanType === 'translation'
                    ? (translationMode === 'multilang' ? '要約中...' : '英文解釈中...')
            : 'クイズ作成中...'}
              </p>

              {/* 過去の重要語句をランダム表示（二択問題形式、多言語モードでは表示しない） */}
              {scanState === 'processing' && scanType === 'translation' && translationMode === 'english_learning' && currentVocab && (
                <motion.div
                  key={currentVocab.word}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md mx-auto"
                >
                  <p className="text-gray-400 text-xs mb-3 text-center">
                    {currentVocab.isIdiom ? 'イディオム' : '過去に学んだ重要語句'}
                  </p>
                  <p className="text-white font-bold text-lg mb-4 text-center">{currentVocab.word}</p>
                  
                  {/* イディオムの説明（回答前にも表示） */}
                  {currentVocab.isIdiom && currentVocab.explanation && (
                    <div className="mb-4 p-3 bg-purple-900/20 rounded-lg border border-purple-700/50">
                      <p className="text-purple-200 text-sm">💡 {currentVocab.explanation}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {currentVocab.options.map((option, index) => {
                      const isSelected = selectedVocabAnswer === index;
                      const isCorrect = index === currentVocab.correctIndex;
                      const showResult = selectedVocabAnswer !== null;
                      
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            if (selectedVocabAnswer === null) {
                              setSelectedVocabAnswer(index);
                              vibrateLight();
                              if (isCorrect) {
                                vibrateSuccess();
                              } else {
                                vibrateError();
                              }
                            }
                          }}
                          disabled={showResult}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            showResult
                              ? isCorrect
                                ? 'bg-green-500/20 border-2 border-green-500'
                                : isSelected
                                  ? 'bg-red-500/20 border-2 border-red-500'
                                  : 'bg-gray-700/50 border-2 border-gray-600'
                              : isSelected
                                ? 'bg-cyan-500/20 border-2 border-cyan-500'
                                : 'bg-gray-700/50 border-2 border-gray-600 hover:border-cyan-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${
                              showResult && isCorrect
                                ? 'text-green-400'
                                : showResult && isSelected && !isCorrect
                                  ? 'text-red-400'
                                  : 'text-white'
                            }`}>
                              {option}
                            </span>
                            {showResult && isCorrect && (
                              <span className="text-green-400 text-xl">✓</span>
                            )}
                            {showResult && isSelected && !isCorrect && (
                              <span className="text-red-400 text-xl">✗</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
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
                  クイズを始める
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
