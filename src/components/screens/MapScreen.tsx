/**
 * MapScreen.tsx
 * 
 * マップ画面
 * 学習の軌跡を黄金螺旋で可視化
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Flag, X, BookOpen, Share2 } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { MapVisualizer } from '@/components/ui/MapVisualizer';
import { ShareModal } from '@/components/ui/ShareModal';
import { vibrateLight } from '@/lib/haptics';
import type { Flag as FlagType } from '@/types';

// ===== Types =====

interface MapScreenProps {
  onBack: () => void;
}

// ===== Main Component =====

export const MapScreen = ({ onBack }: MapScreenProps) => {
  const [selectedFlag, setSelectedFlag] = useState<FlagType | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Store
  const journey = useGameStore(state => state.journey);
  const totalDistance = useGameStore(state => state.totalDistance);

  const handleFlagClick = (flag: FlagType) => {
    setSelectedFlag(flag);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between py-4 mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Flag className="w-6 h-6 text-cyan-400" />
            学習マップ
          </h1>

          <button
            onClick={() => {
              vibrateLight();
              setShowShareModal(true);
            }}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="シェア"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">総移動距離</p>
            <p className="text-xl font-bold text-white">
              {totalDistance.toFixed(1)}<span className="text-sm text-gray-400">km</span>
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">フラッグ数</p>
            <p className="text-xl font-bold text-cyan-400">{journey.flags.length}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
            <p className="text-gray-400 text-xs mb-1">島到達</p>
            <p className="text-xl font-bold">
              {totalDistance >= 100 ? (
                <span className="text-green-400">🏝️</span>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </p>
          </div>
        </div>

        {/* マップ */}
        <MapVisualizer
          flags={journey.flags}
          currentPosition={journey.currentPosition}
          totalDistance={journey.totalDistance}
          onFlagClick={handleFlagClick}
          className="h-[400px]"
        />

        {/* フラッグ一覧 */}
        {journey.flags.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              獲得したキーワード ({journey.flags.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {journey.flags.slice(-10).reverse().map((flag) => (
                <button
                  key={flag.id}
                  onClick={() => handleFlagClick(flag)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300 border border-gray-700 transition-colors"
                >
                  🚩 {flag.keywords[0]}
                </button>
              ))}
              {journey.flags.length > 10 && (
                <span className="px-3 py-1.5 text-gray-500 text-sm">
                  +{journey.flags.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* フラッグ詳細モーダル */}
      <AnimatePresence>
        {selectedFlag && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedFlag(null)}
            />

            <motion.div
              className="relative w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="p-6">
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>

                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">🚩</div>
                  <h3 className="text-xl font-bold text-white">
                    フラッグ #{journey.flags.indexOf(selectedFlag) + 1}
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">キーワード</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFlag.keywords.map((kw, i) => (
                        <span 
                          key={i}
                          className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-sm text-gray-400 mb-1">距離</p>
                      <p className="text-lg font-bold text-white">
                        {selectedFlag.distance.toFixed(1)} km
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3">
                      <p className="text-sm text-gray-400 mb-1">獲得日</p>
                      <p className="text-lg font-bold text-white">
                        {new Date(selectedFlag.createdAt).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedFlag(null)}
                  className="w-full mt-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* シェアモーダル */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};

export default MapScreen;

