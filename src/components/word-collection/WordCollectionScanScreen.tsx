/**
 * WordCollectionScanScreen.tsx
 *
 * 単コレ拠点専用のスキャン画面
 * 英文解釈APIでスキャンし、単語を登録する
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Scan, ChevronLeft, Loader2, X, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useToast } from '@/components/ui/Toast';
import { compressForAI, validateImageFile, preprocessImageForOCR } from '@/lib/imageUtils';
import { vibrateLight, vibrateSuccess, vibrateError } from '@/lib/haptics';
import { LIMITS } from '@/lib/constants';
import type { WordCollectionScanResult } from '@/types';

// ===== Types =====

type ScanState = 'idle' | 'uploading' | 'processing' | 'error';

interface WordCollectionScanScreenProps {
  onComplete: (scanId?: string) => void;
  onBack: () => void;
}

// ===== Main Component =====

export const WordCollectionScanScreen = ({ onComplete, onBack }: WordCollectionScanScreenProps) => {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  const isVIP = useGameStore((s) => s.isVIP);
  const checkTranslationLimit = useGameStore((s) => s.checkTranslationLimit);
  const incrementTranslationCount = useGameStore((s) => s.incrementTranslationCount);
  const incrementScanCount = useGameStore((s) => s.incrementScanCount);
  const saveWordCollectionScan = useGameStore((s) => s.saveWordCollectionScan);

  const { addToast } = useToast();

  const limitCheck = checkTranslationLimit();
  const canScan = isVIP || limitCheck.canTranslate;

  const stopProgressTicker = useCallback((finalValue?: number) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (typeof finalValue === 'number') setProgress(finalValue);
  }, []);

  const startProgressTicker = useCallback(() => {
    stopProgressTicker();
    setProgress(3);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 3, 95);
        if (next >= 95 && progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        return next;
      });
    }, 1000);
  }, [stopProgressTicker]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      vibrateLight();

      const limitCheck = checkTranslationLimit();
      if (!limitCheck.canTranslate) {
        setErrorMessage(limitCheck.error || '翻訳回数の上限に達しました');
        setScanState('error');
        vibrateError();
        return;
      }

      const validation = validateImageFile(file);
      if (!validation.valid) {
        setErrorMessage(validation.error || '無効なファイルです');
        setScanState('error');
        vibrateError();
        return;
      }

      startProgressTicker();
      setProgressLabel('画像を確認中...');
      setScanState('uploading');
      setErrorMessage('');

      try {
        const compressed = await compressForAI(file);
        setSelectedImage(compressed.dataUrl);
        setProgressLabel('画像を最適化中...');
        setScanState('processing');

        const enhancedImage = await preprocessImageForOCR(file);
        setProgressLabel('単語抽出・意味生成中...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const res = await fetch('/api/word-collection-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: enhancedImage }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setProgressLabel('結果を保存中...');

        if (res.status === 429) {
          stopProgressTicker(0);
          setScanState('idle');
          vibrateError();
          addToast('error', '本日の利用上限に達しました。明日お試しください。');
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.details || `Error: ${res.status}`);
        }

        const data = await res.json();

        const result: WordCollectionScanResult = {
          clean_text: data.clean_text || '',
          words: Array.isArray(data.words) ? data.words : [],
        };

        incrementTranslationCount();
        incrementScanCount();
        const newScanId = saveWordCollectionScan(result, compressed.dataUrl);

        stopProgressTicker(100);
        vibrateSuccess();
        addToast('success', 'スキャン完了！単語が登録されました');
        onComplete(newScanId);
      } catch (e: unknown) {
        stopProgressTicker(0);
        setScanState('error');
        setErrorMessage((e as Error)?.message || 'スキャンに失敗しました');
        vibrateError();
        addToast('error', (e as Error)?.message || 'スキャンに失敗しました');
      }
    },
    [
      checkTranslationLimit,
      startProgressTicker,
      stopProgressTicker,
      incrementTranslationCount,
      incrementScanCount,
      saveWordCollectionScan,
      onComplete,
      addToast,
    ]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleReset = () => {
    vibrateLight();
    setScanState('idle');
    setSelectedImage(null);
    setErrorMessage('');
    stopProgressTicker(0);
    setProgressLabel('');
    fileInputRef.current && (fileInputRef.current.value = '');
  };

  const displayProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto pt-4 pb-4">
        <div className="flex items-center justify-between mb-6">
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
            <Scan className="w-5 h-5 text-amber-400" />
            英文をスキャン
          </h1>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              isVIP ? 'bg-amber-500/20 text-amber-400' : canScan ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isVIP ? '無制限' : `残り ${limitCheck.remaining}/${LIMITS.FREE_USER.DAILY_TRANSLATION_LIMIT} 回`}
          </div>
        </div>
      </div>

      {/* メイン */}
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {(scanState === 'idle' || scanState === 'error') && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {scanState === 'error' ? (
                <div className="text-center py-8 mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium mb-2">エラーが発生しました</p>
                  <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600"
                  >
                    やり直す
                  </button>
                </div>
              ) : (
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                    canScan ? 'border-gray-600 hover:border-amber-500 cursor-pointer' : 'border-gray-700 bg-gray-800/50 cursor-not-allowed'
                  }`}
                  onDrop={canScan ? handleDrop : undefined}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => canScan && (vibrateLight(), fileInputRef.current?.click())}
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
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-amber-400" />
                      </div>
                      <p className="text-white font-medium mb-2">画像をアップロード</p>
                      <p className="text-gray-400 text-sm">タップまたはドラッグ＆ドロップ</p>
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-400 text-xs flex items-center justify-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          1ページずつスキャンしてください
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                      </div>
                      <p className="text-red-400 font-medium mb-2">本日の翻訳上限に達しました</p>
                      <p className="text-gray-500 text-sm">明日またお試しください</p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {(scanState === 'uploading' || scanState === 'processing') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12 space-y-6"
            >
              {selectedImage && (
                <div className="w-48 h-48 mx-auto mb-6 rounded-xl overflow-hidden border-2 border-amber-500/50">
                  <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="max-w-md mx-auto mb-6">
                <div className="flex justify-between text-sm text-amber-100 mb-2 px-4">
                  <span className="line-clamp-2">{progressLabel || '英文解釈中...'}</span>
                  <span className="font-semibold">{displayProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-amber-500/30">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-[width] duration-300"
                    style={{ width: `${displayProgress}%` }}
                  />
                </div>
              </div>
              <Loader2 className="w-12 h-12 text-amber-400 mx-auto animate-spin" />
              <p className="text-white font-medium">単語を抽出・意味を生成中...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
