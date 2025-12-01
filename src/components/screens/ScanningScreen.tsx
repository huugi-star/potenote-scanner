/**
 * ScanningScreen.tsx
 * 
 * スキャン画面
 * 画像をスキャンしてクイズを生成する
 * Free/VIPユーザーの制限管理
 * 
 * ★重要: スキャン回数はAPI成功時のみ消費する
 */

import { useState, useRef, useCallback } from 'react';
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
import { AdsModal } from '@/components/ui/AdsModal';
import { ASPSalesModal } from '@/components/ui/ASPSalesModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { useToast } from '@/components/ui/Toast';
import { compressForAI, validateImageFile, preprocessImageForOCR } from '@/lib/imageUtils';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { LIMITS } from '@/lib/constants';
import type { QuizRaw, StructuredOCR } from '@/types';

// ===== Types =====

interface ScanningScreenProps {
  onQuizReady: (quiz: QuizRaw, imageUrl: string, ocrText?: string, structuredOCR?: StructuredOCR) => void;
  onTranslationReady?: (result: { originalText: string; translatedText: string }, imageUrl: string) => void;
  onBack?: () => void;
}

type ScanState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

// ===== Main Component =====

export const ScanningScreen = ({ onQuizReady, onTranslationReady, onBack }: ScanningScreenProps) => {
  // State
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showAdsModal, setShowAdsModal] = useState(false);
  const [showASPSalesModal, setShowASPSalesModal] = useState(false);
  const [aspAdRecommendation, setAspAdRecommendation] = useState<{ ad_id: string; reason: string } | null>(null);
  // const [showShopModal, setShowShopModal] = useState(false); // 一時的に非表示
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizRaw | null>(null);
  const [ocrText, setOcrText] = useState<string | undefined>(undefined);
  const [structuredOCR, setStructuredOCR] = useState<StructuredOCR | undefined>(undefined);

  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const scanType = useGameStore(state => state.scanType);
  const remainingScans = useGameStore(selectRemainingScanCount);
  const checkScanLimit = useGameStore(state => state.checkScanLimit);
  const checkTranslationLimit = useGameStore(state => state.checkTranslationLimit);
  const incrementScanCount = useGameStore(state => state.incrementScanCount);
  const incrementTranslationCount = useGameStore(state => state.incrementTranslationCount);
  const recoverScanCount = useGameStore(state => state.recoverScanCount);
  // const activateVIP = useGameStore(state => state.activateVIP); // 一時的に非表示

  // Toast
  const { addToast } = useToast();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canScan = isVIP || remainingScans > 0;

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

    try {
      // 1. 画像を圧縮（プレビュー用）
      const compressed = await compressForAI(file);
      setSelectedImage(compressed.dataUrl);
      setScanState('processing');

      // 2. OCR用に画像補正（コントラスト・シャープネス強化）
      const enhancedImage = await preprocessImageForOCR(file);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      if (scanType === 'translation') {
        // 翻訳モード
        const translateResponse = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: enhancedImage,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!translateResponse.ok) {
          throw new Error(`Translation error: ${translateResponse.status}`);
        }

        const translateResult = await translateResponse.json();

        if (translateResult.originalText && translateResult.translatedText) {
          // ★成功時のみ翻訳回数を消費
          incrementTranslationCount();
          
          if (onTranslationReady) {
            onTranslationReady(
              {
                originalText: translateResult.originalText,
                translatedText: translateResult.translatedText,
              },
              compressed.dataUrl
            );
          }
          
          vibrateSuccess();
          addToast('success', '翻訳が完了しました！');
        } else if (translateResult.error) {
          throw new Error(translateResult.error);
        } else {
          throw new Error('翻訳に失敗しました');
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
          setGeneratedQuiz(quizResult.quiz);
          setOcrText(quizResult.ocrText);
          setStructuredOCR(quizResult.structuredOCR); // 構造化OCRを保存
          
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
    if (generatedQuiz && selectedImage) {
      onQuizReady(generatedQuiz, selectedImage, ocrText, structuredOCR);
    }
  };

  // 広告視聴完了
  const handleAdRewardClaimed = () => {
    recoverScanCount();
    setShowAdsModal(false);
    vibrateSuccess();
    addToast('success', 'スキャン回数が回復しました！');
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
    setGeneratedQuiz(null);
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
            </motion.div>
          )}

          {/* アップロード/処理中 */}
          {(scanState === 'uploading' || scanState === 'processing') && (
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
              
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-white font-medium">
                {scanState === 'uploading' ? '画像を処理中...' : 'OCR & クイズ生成中...'}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Google Vision + GPT-4o-mini
              </p>
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
                {selectedImage && (
                  <div className="w-full h-40 mb-4 rounded-xl overflow-hidden">
                    <img 
                      src={selectedImage} 
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

      {/* モーダル */}
      <AdsModal
        isOpen={showAdsModal}
        onClose={() => setShowAdsModal(false)}
        adType="scan_recovery"
        onRewardClaimed={handleAdRewardClaimed}
      />
      
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
