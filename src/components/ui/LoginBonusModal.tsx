/**
 * LoginBonusModal.tsx
 * 
 * ログインボーナスモーダル
 * 起動時にポテトがコインをプレゼントする演出
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Calendar, Flame, Gift } from 'lucide-react';
import { PotatoAvatar } from './PotatoAvatar';

// ===== Types =====

interface LoginBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  bonusCoins: number;
  consecutiveDays: number;
  isVIP?: boolean;
}

// ===== Sub Components =====

/**
 * コイン落下アニメーション
 */
const FallingCoins = ({ count }: { count: number }) => {
  const coins = Array.from({ length: Math.min(count / 5, 15) }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 200 - 100,
    rotation: Math.random() * 360,
    duration: 1 + Math.random() * 0.5,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {coins.map((coin) => (
        <motion.div
          key={coin.id}
          className="absolute left-1/2 top-0"
          initial={{ 
            x: coin.x, 
            y: -50, 
            opacity: 1,
            rotate: 0,
          }}
          animate={{ 
            y: 400, 
            opacity: 0,
            rotate: coin.rotation,
          }}
          transition={{ 
            duration: coin.duration,
            delay: coin.delay + 0.5,
            ease: 'easeIn',
          }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-300 shadow-lg flex items-center justify-center">
            <span className="text-yellow-900 font-bold text-xs">¥</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/**
 * 連続ログイン表示
 */
const ConsecutiveDays = ({ days }: { days: number }) => {
  const weekDays = ['月', '火', '水', '木', '金', '土', '日'];
  const currentDayIndex = (days - 1) % 7;

  return (
    <motion.div
      className="flex items-center justify-center gap-1 mb-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {weekDays.map((day, index) => (
        <div
          key={day}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            index <= currentDayIndex
              ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
              : 'bg-gray-700 text-gray-500'
          }`}
        >
          {day}
        </div>
      ))}
    </motion.div>
  );
};

/**
 * ポテトのプレゼント演出
 */
const PotatoPresenting = ({ 
  stage, 
  isVIP 
}: { 
  stage: 'entering' | 'presenting' | 'celebrating';
  isVIP: boolean;
}) => {
  const getEmotion = () => {
    switch (stage) {
      case 'entering': return 'normal';
      case 'presenting': return 'smart';
      case 'celebrating': return 'happy';
    }
  };

  return (
    <motion.div
      className="relative"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      <PotatoAvatar
        emotion={getEmotion()}
        ssrEffect={isVIP}
        size={140}
      />
      
      {/* プレゼントボックス（presenting時のみ） */}
      {stage === 'presenting' && (
        <motion.div
          className="absolute -right-4 top-1/2 -translate-y-1/2"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <Gift className="w-12 h-12 text-pink-500" />
        </motion.div>
      )}
    </motion.div>
  );
};

// ===== Main Component =====

export const LoginBonusModal = ({
  isOpen,
  onClose,
  bonusCoins,
  consecutiveDays,
  isVIP = false,
}: LoginBonusModalProps) => {
  const [stage, setStage] = useState<'entering' | 'presenting' | 'celebrating'>('entering');
  const [showCoins, setShowCoins] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStage('entering');
      setShowCoins(false);
      return;
    }

    // アニメーションシーケンス
    const timer1 = setTimeout(() => setStage('presenting'), 500);
    const timer2 = setTimeout(() => {
      setStage('celebrating');
      setShowCoins(true);
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* コイン落下エフェクト */}
          {showCoins && <FallingCoins count={bonusCoins} />}

          {/* モーダルコンテンツ */}
          <motion.div
            className="relative w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 rounded-2xl overflow-hidden border border-yellow-500/30 shadow-2xl"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* 装飾的なグロー */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-yellow-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-orange-500/10 blur-3xl" />

            {/* ヘッダー */}
            <div className="relative text-center pt-6 pb-2">
              <motion.div
                className="flex items-center justify-center gap-2 mb-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Calendar className="w-5 h-5 text-yellow-500" />
                <span className="text-yellow-500 font-bold">ログインボーナス</span>
              </motion.div>

              {/* 連続ログイン */}
              <motion.div
                className="flex items-center justify-center gap-2 text-orange-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Flame className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {consecutiveDays}日連続ログイン
                </span>
              </motion.div>
            </div>

            {/* ポテトとプレゼント */}
            <div className="relative flex justify-center py-6">
              <PotatoPresenting stage={stage} isVIP={isVIP} />
            </div>

            {/* ボーナス表示 */}
            <motion.div
              className="text-center pb-6"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
            >
              <ConsecutiveDays days={consecutiveDays} />

              <motion.div
                className="flex items-center justify-center gap-3 mb-2"
                animate={stage === 'celebrating' ? {
                  scale: [1, 1.1, 1],
                } : {}}
                transition={{ duration: 0.5, repeat: stage === 'celebrating' ? 2 : 0 }}
              >
                <Coins className="w-10 h-10 text-yellow-500" />
                <span className="text-5xl font-bold text-white">
                  +{bonusCoins}
                </span>
              </motion.div>

              {isVIP && (
                <motion.div
                  className="inline-block px-3 py-1 bg-yellow-500/20 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <span className="text-yellow-500 text-sm font-medium">
                    VIP 2倍ボーナス適用中！
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* フッター */}
            <div className="px-6 pb-6">
              <motion.button
                onClick={onClose}
                className="w-full py-4 rounded-xl font-bold text-black bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg shadow-yellow-500/25"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                受け取る
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginBonusModal;

