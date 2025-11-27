/**
 * OnboardingOverlay.tsx
 * 
 * 初回起動時のオンボーディングオーバーレイ
 * 指差しアニメーションでスキャンボタンを案内
 */

import { motion } from 'framer-motion';
import { Scan, ArrowDown } from 'lucide-react';

// ===== Types =====

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

// ===== Main Component =====

export const OnboardingOverlay = ({ onDismiss }: OnboardingOverlayProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      {/* メッセージ */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-white mb-2">
          ようこそ！🥔
        </h2>
        <p className="text-gray-300">
          ノートをスキャンしてクイズを作ろう！
        </p>
      </motion.div>

      {/* 指差しアニメーション */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {/* ターゲットエリアのハイライト */}
        <motion.div
          className="w-64 h-16 rounded-2xl border-2 border-dashed border-cyan-400 flex items-center justify-center gap-3 bg-cyan-500/10"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(34, 211, 238, 0)',
              '0 0 0 10px rgba(34, 211, 238, 0.3)',
              '0 0 0 20px rgba(34, 211, 238, 0)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Scan className="w-6 h-6 text-cyan-400" />
          <span className="text-cyan-400 font-bold">スキャンして学ぶ</span>
        </motion.div>

        {/* 指差しアイコン */}
        <motion.div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <ArrowDown className="w-10 h-10 text-yellow-400" />
        </motion.div>

        {/* 手のアイコン */}
        <motion.div
          className="absolute -bottom-28 left-1/2 -translate-x-1/2 text-5xl"
          animate={{ 
            y: [0, -5, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        >
          👆
        </motion.div>
      </motion.div>

      {/* タップで閉じる */}
      <motion.p
        className="absolute bottom-12 text-gray-400 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        タップして始める
      </motion.p>

      {/* 装飾パーティクル */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-cyan-400 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.5, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
          }}
        />
      ))}
    </motion.div>
  );
};

export default OnboardingOverlay;

