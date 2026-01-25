'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Play, Pause, Square, RotateCcw, Volume2 } from 'lucide-react';
import { LectureStage } from '@/components/ui/LectureStage';
import { LectureChat } from '@/components/ui/LectureChat';
import { useLecturePlayer } from '@/lib/useLecturePlayer';
import { compressForAI, validateImageFile } from '@/lib/imageUtils';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore, selectRemainingScanCount } from '@/store/useGameStore';
import { LIMITS } from '@/lib/constants';
import type { LectureScript, CharacterTone, LectureHistory } from '@/types';

interface LectureScreenProps {
  onBack: () => void;
  initialHistory?: LectureHistory; // 履歴から読み込む場合
}

export const LectureScreen = ({ onBack, initialHistory }: LectureScreenProps) => {
  const [lectureState, setLectureState] = useState<'idle' | 'uploading' | 'generating' | 'ready' | 'error'>('idle');
  const [lectureScript, setLectureScript] = useState<LectureScript | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<CharacterTone>('normal');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [repeat, setRepeat] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store
  const saveLectureHistory = useGameStore(state => state.saveLectureHistory);
  const isVIP = useGameStore(state => state.isVIP);
  const remainingScans = useGameStore(selectRemainingScanCount);
  const checkScanLimit = useGameStore(state => state.checkScanLimit);
  const incrementScanCount = useGameStore(state => state.incrementScanCount);
  
  const canScan = isVIP || remainingScans > 0;

  // 履歴から講義を読み込む
  useEffect(() => {
    if (initialHistory) {
      console.log('[LectureScreen] Loading from history:', initialHistory.id);
      setLectureScript(initialHistory.script);
      setSelectedTone(initialHistory.script.tone);
      setLectureState('ready');
    } else {
      // 履歴がない場合は初期状態にリセット
      setLectureScript(null);
      setLectureState('idle');
    }
  }, [initialHistory]);

  // Lecture Player
  const player = useLecturePlayer({
    items: lectureScript?.items || [],
    tone: selectedTone,
    playbackRate,
    repeat,
    onItemComplete: (_itemId: number) => {
      // アイテム完了時の処理（必要に応じて）
    },
    onComplete: () => {
      // 講義完了時の処理
      console.log('講義が完了しました');
    },
  });

  // 現在のアイテムを取得
  const currentItem = lectureScript?.items.find(
    item => item.id === player.currentItemId
  ) || null;
  
  // デバッグ: 現在のアイテムをログ出力
  useEffect(() => {
    console.log('[LectureScreen] currentItemId changed:', player.currentItemId);
    if (currentItem) {
      console.log('[LectureScreen] Current item:', currentItem.id, currentItem.type, 'displayBoard:', currentItem.displayBoard, 'text:', currentItem.text);
    } else {
      console.log('[LectureScreen] Current item is null');
    }
  }, [player.currentItemId, currentItem]);

  // 画面を離れる時に音声を停止
  useEffect(() => {
    return () => {
      player.stop();
    };
  }, []);

  // 画像選択ハンドラ
  const handleImageSelect = useCallback(async (file: File) => {
    try {
      // 制限チェック（消費はまだしない）
      const limitCheck = checkScanLimit();
      if (!limitCheck.canScan) {
        setErrorMessage(limitCheck.error || 'スキャン回数の上限に達しました');
        setLectureState('error');
        return;
      }

      // 画像検証
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setErrorMessage(validation.error || '画像ファイルが無効です');
        setLectureState('error');
        return;
      }

      // 画像を圧縮
      setLectureState('uploading');
      const compressionResult = await compressForAI(file);

      // 講義生成
      setLectureState('generating');
      setErrorMessage('');

      const response = await fetch('/api/generate-lecture', {
        method: 'POST',
        body: JSON.stringify({
          image: compressionResult.dataUrl, // base64エンコードされた画像
          tone: selectedTone,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = '講義生成に失敗しました';
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch (e) {
          // JSON解析に失敗した場合はデフォルトメッセージを使用
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const script: LectureScript = await response.json();
      setLectureScript(script);
      setLectureState('ready');
      
      // スキャン回数を増やす（API成功時のみ）
      incrementScanCount();
      
      // 講義履歴に保存
      saveLectureHistory(script, compressionResult.dataUrl);
    } catch (error: any) {
      console.error('Lecture generation error:', error);
      setErrorMessage(error.message || '講義生成に失敗しました');
      setLectureState('error');
    }
  }, [selectedTone, checkScanLimit, incrementScanCount, saveLectureHistory]);

  // ファイル入力変更ハンドラ
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  }, [handleImageSelect]);

  // リセット
  const handleReset = useCallback(() => {
    player.stop();
    setLectureScript(null);
    setLectureState('idle');
    setErrorMessage('');
  }, [player]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              player.stop();
              onBack();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">音声講義</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col p-4 gap-4 max-w-6xl mx-auto w-full">
        {lectureState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6"
          >
            <div className="text-center">
              <Volume2 className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                画像をアップロード
              </h2>
              <p className="text-gray-600 mb-6">
                参考書やノートをアップロードして、音声講義を生成します
              </p>
              {/* スキャン残数表示 */}
              {!isVIP && (
                <div className="mb-4 text-sm text-gray-500">
                  残り {remainingScans}/{LIMITS.FREE_USER.DAILY_SCAN_LIMIT} 回
                </div>
              )}
            </div>

            {/* キャラクター選択 */}
            <div className="w-full max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                講師選択
              </label>
              <select
                value={selectedTone}
                onChange={(e) => {
                  setSelectedTone(e.target.value as CharacterTone);
                  // 選択後にフォーカスを外す
                  e.target.blur();
                }}
                className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="normal">標準</option>
                <option value="yuruhachi">ゆる八先生</option>
                <option value="kyoto">きょう丸先生</option>
                <option value="ojousama">お嬢様</option>
                <option value="gal">ギャル</option>
                <option value="sage">賢者</option>
              </select>
            </div>

            {/* ファイルアップロード */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => {
                vibrateLight();
                if (!canScan) {
                  setErrorMessage('スキャン回数の上限に達しました');
                  setLectureState('error');
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={!canScan}
              className={`px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                canScan
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-xl'
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
            >
              画像を選択
            </button>
            <button
              onClick={() => {
                vibrateLight();
                onBack();
              }}
              className="px-6 py-3 rounded-lg bg-gray-500 text-white font-bold flex items-center gap-2 hover:bg-gray-600 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </button>
          </motion.div>
        )}

        {(lectureState === 'uploading' || lectureState === 'generating') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {lectureState === 'uploading' ? '画像を処理中...' : '講義を生成中...'}
              </p>
            </div>
          </div>
        )}

        {lectureState === 'error' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-600 mb-4">{errorMessage}</p>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-lg bg-gray-500 text-white"
              >
                戻る
              </button>
            </div>
          </div>
        )}

        {lectureState === 'ready' && lectureScript && (
          <div className="flex-1 flex flex-col gap-4">
            {/* 黒板 */}
            <LectureStage
              currentItem={currentItem}
              isSpeaking={player.isPlaying && !player.isPaused}
            />

            {/* コントロール */}
            <div className="bg-white rounded-lg p-4 shadow-lg">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => {
                    vibrateLight();
                    if (player.isPlaying) {
                      if (player.isPaused) {
                        player.resume();
                      } else {
                        player.pause();
                      }
                    } else {
                      player.play();
                    }
                  }}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold flex items-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all"
                  disabled={!lectureScript}
                >
                  {player.isPlaying ? (
                    player.isPaused ? (
                      <>
                        <Play className="w-5 h-5" />
                        再開
                      </>
                    ) : (
                      <>
                        <Pause className="w-5 h-5" />
                        一時停止
                      </>
                    )
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      再生開始
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    vibrateLight();
                    player.stop();
                  }}
                  className="px-4 py-3 rounded-lg bg-gray-500 text-white font-bold flex items-center gap-2 hover:bg-gray-600 transition-all"
                >
                  <Square className="w-5 h-5" />
                  停止
                </button>

                <button
                  onClick={() => {
                    vibrateLight();
                    handleReset();
                  }}
                  className="px-4 py-3 rounded-lg bg-gray-400 text-white font-bold flex items-center gap-2 hover:bg-gray-500 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  リセット
                </button>

                <button
                  onClick={() => {
                    vibrateLight();
                    player.stop();
                    onBack();
                  }}
                  className="px-4 py-3 rounded-lg bg-gray-600 text-white font-bold flex items-center gap-2 hover:bg-gray-700 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  戻る
                </button>
              </div>

              {/* 再生速度とリピート */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">速度:</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600 w-12">{playbackRate.toFixed(1)}x</span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(e) => setRepeat(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">リピート</span>
                </label>
              </div>
            </div>

            {/* チャットログ */}
            <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col min-h-[300px]">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">講義ログ</h3>
              </div>
              <LectureChat
                items={lectureScript.items}
                currentItemId={player.currentItemId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
