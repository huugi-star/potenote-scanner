/**
 * BannerAd.tsx
 * 
 * Freeユーザー向けバナー広告（シミュレーション）
 * 画面下部に固定表示される
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// ===== Types =====

interface BannerAdProps {
  isVisible: boolean;
  className?: string;
}

// 以前はシミュレーション用の複数バナーとローテーションを持っていたが、
// 現在はAdSenseのみを1種類表示するシンプルな実装にしている。

// ===== Main Component =====

export const BannerAd = ({
  isVisible,
  className = '',
}: BannerAdProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Google AdSense広告を初期化
  useEffect(() => {
    if (isVisible && !isDismissed && typeof window !== 'undefined') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (err) {
        console.error('AdSense initialization error:', err);
      }
    }
  }, [isVisible, isDismissed]);

  if (!isVisible || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed bottom-0 left-0 right-0 z-40 ${className}`}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* コンパクトなメインバナー（1種類の広告のみ表示） */}
        <div className="bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-3 py-2 relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-300 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <motion.div
            key="adsense"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex justify-center"
          >
            {/* Google AdSense 広告ユニット（1種類のみ表示） */}
            <ins
              className="adsbygoogle"
              style={{ display: 'block' }}
              data-ad-client="ca-pub-5524219244906928"
              data-ad-slot="5707417970"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </motion.div>
        </div>

        {/* セーフエリア用スペーサー */}
        <div className="h-safe-bottom bg-gray-900/95" />
      </motion.div>
    </AnimatePresence>
  );
};

export default BannerAd;

