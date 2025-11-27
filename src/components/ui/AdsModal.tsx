/**
 * AdsModal.tsx
 * 
 * 自発的広告モーダル
 * ユーザーが自ら選択して広告を視聴し、報酬を獲得する
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Gift, Loader2, CheckCircle } from 'lucide-react';
import type { AdType } from '@/types';
import { REWARDS } from '@/lib/constants';

// ===== Types =====

interface AdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adType: AdType;
  onRewardClaimed: (adType: AdType) => void;
}

type AdState = 'idle' | 'watching' | 'completed';

// ===== Constants =====

const AD_DURATION = 3000; // 3秒

const AD_CONFIG = {
  scan_recovery: {
    title: 'スキャン回数を回復',
    description: '動画を視聴してスキャン回数を回復しますか？',
    reward: `+${REWARDS.AD_REWARDS.SCAN_RECOVERY_COUNT}回`,
    icon: '🔄',
    color: '#10B981',
  },
  coin_doubler: {
    title: 'コインを2倍にする',
    description: '動画を視聴して獲得コインを2倍にしますか？',
    reward: `×${REWARDS.AD_REWARDS.COIN_MULTIPLIER}`,
    icon: '💰',
    color: '#F59E0B',
  },
};

// ===== Sub Components =====

/**
 * プログレスリング
 */
const ProgressRing = ({ 
  progress, 
  size = 80 
}: { 
  progress: number; 
  size?: number;
}) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* 背景リング */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#374151"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* プログレスリング */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#10B981"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        style={{
          strokeDasharray: circumference,
          strokeDashoffset,
        }}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.1 }}
      />
    </svg>
  );
};

/**
 * 広告シミュレーション画面
 */
const AdSimulation = ({ 
  progress, 
  remainingTime 
}: { 
  progress: number; 
  remainingTime: number;
}) => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 広告プレースホルダー */}
      <div className="relative w-64 h-36 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg overflow-hidden mb-6 border border-gray-600">
        {/* シミュレーション用のアニメーション */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-gray-400 text-sm">広告を再生中...</p>
          </div>
        </div>
      </div>

      {/* プログレス表示 */}
      <div className="relative">
        <ProgressRing progress={progress} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {Math.ceil(remainingTime / 1000)}
          </span>
        </div>
      </div>

      <p className="text-gray-400 text-sm mt-4">
        あと少しで報酬を獲得できます
      </p>
    </motion.div>
  );
};

/**
 * 報酬獲得画面
 */
const RewardClaimed = ({ 
  config 
}: { 
  config: typeof AD_CONFIG[keyof typeof AD_CONFIG];
}) => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-8"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 15 }}
    >
      {/* 成功アイコン */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <CheckCircle 
          className="w-16 h-16 mb-4" 
          style={{ color: config.color }} 
        />
      </motion.div>

      {/* 報酬表示 */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="text-2xl font-bold text-white mb-2">
          報酬獲得！
        </h3>
        <div 
          className="text-4xl font-bold mb-2"
          style={{ color: config.color }}
        >
          {config.icon} {config.reward}
        </div>
        <p className="text-gray-400">
          {config.title}が適用されました
        </p>
      </motion.div>

      {/* パーティクルエフェクト */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{ 
              backgroundColor: config.color,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ 
              opacity: 0, 
              scale: 0,
              y: -50 - Math.random() * 100,
            }}
            transition={{ 
              duration: 1 + Math.random() * 0.5,
              delay: Math.random() * 0.3,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// ===== Main Component =====

export const AdsModal = ({
  isOpen,
  onClose,
  adType,
  onRewardClaimed,
}: AdsModalProps) => {
  const [adState, setAdState] = useState<AdState>('idle');
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(AD_DURATION);

  const config = AD_CONFIG[adType];

  // 広告視聴開始
  const startWatching = useCallback(() => {
    setAdState('watching');
    setProgress(0);
    setRemainingTime(AD_DURATION);
  }, []);

  // 広告視聴中のタイマー
  useEffect(() => {
    if (adState !== 'watching') return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / AD_DURATION) * 100, 100);
      const newRemaining = Math.max(AD_DURATION - elapsed, 0);

      setProgress(newProgress);
      setRemainingTime(newRemaining);

      if (elapsed >= AD_DURATION) {
        clearInterval(interval);
        setAdState('completed');
        onRewardClaimed(adType);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [adState, adType, onRewardClaimed]);

  // モーダルを閉じる時にリセット
  const handleClose = useCallback(() => {
    if (adState === 'watching') return; // 視聴中は閉じられない
    setAdState('idle');
    setProgress(0);
    setRemainingTime(AD_DURATION);
    onClose();
  }, [adState, onClose]);

  // モーダルが開いた時にリセット
  useEffect(() => {
    if (isOpen) {
      setAdState('idle');
      setProgress(0);
      setRemainingTime(AD_DURATION);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* オーバーレイ */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* モーダルコンテンツ */}
          <motion.div
            className="relative w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* ヘッダー */}
            <div 
              className="px-6 py-4 border-b border-gray-700"
              style={{ 
                background: `linear-gradient(135deg, ${config.color}20, transparent)` 
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <h2 className="text-lg font-bold text-white">
                    {config.title}
                  </h2>
                </div>
                {adState !== 'watching' && (
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* ボディ */}
            <div className="px-6 py-6">
              <AnimatePresence mode="wait">
                {adState === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    <Gift 
                      className="w-16 h-16 mx-auto mb-4" 
                      style={{ color: config.color }}
                    />
                    <p className="text-gray-300 mb-6">
                      {config.description}
                    </p>
                    <div 
                      className="inline-block px-6 py-3 rounded-xl font-bold text-xl mb-6"
                      style={{ 
                        backgroundColor: `${config.color}20`,
                        color: config.color,
                      }}
                    >
                      {config.reward}
                    </div>
                    <p className="text-gray-500 text-sm mb-6">
                      約3秒の動画を視聴すると報酬を獲得できます
                    </p>
                  </motion.div>
                )}

                {adState === 'watching' && (
                  <AdSimulation 
                    key="watching"
                    progress={progress} 
                    remainingTime={remainingTime} 
                  />
                )}

                {adState === 'completed' && (
                  <RewardClaimed key="completed" config={config} />
                )}
              </AnimatePresence>
            </div>

            {/* フッター */}
            <div className="px-6 py-4 border-t border-gray-700">
              {adState === 'idle' && (
                <button
                  onClick={startWatching}
                  className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: config.color }}
                >
                  <Play className="w-5 h-5" />
                  動画を見て報酬を獲得
                </button>
              )}

              {adState === 'watching' && (
                <p className="text-center text-gray-500 text-sm">
                  視聴中は閉じることができません
                </p>
              )}

              {adState === 'completed' && (
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  閉じる
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdsModal;

