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
      // 広告コンテナが DOM に追加されてから初期化するため、少し遅延させる
      const timer = setTimeout(() => {
        try {
          const adsbygoogle = (window as any).adsbygoogle || [];
          (window as any).adsbygoogle = adsbygoogle;
          adsbygoogle.push({});
        } catch (err) {
          console.error('AdSense initialization error:', err);
        }
      }, 100);
      
      return () => clearTimeout(timer);
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
        <div className="bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 px-3 py-2 relative max-h-[100px] overflow-hidden">
          {/* 閉じるボタン */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDismiss();
            }}
            className="absolute top-1 right-1 p-1.5 bg-gray-800/80 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition-colors z-50"
            aria-label="広告を閉じる"
          >
            <X className="w-4 h-4" />
          </button>

          <motion.div
            key="adsense"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex justify-center items-center"
            style={{ maxHeight: '80px' }}
          >
            {/* Google AdSense 広告ユニット（1種類のみ表示） */}
            <ins
              className="adsbygoogle"
              style={{ 
                display: 'block',
                minWidth: '320px',
                minHeight: '50px',
                maxHeight: '80px',
                width: '100%',
                maxWidth: '728px',
                overflow: 'hidden',
              }}
              data-ad-client="ca-pub-5524219244906928"
              data-ad-slot="5707417970"
              data-ad-format="horizontal"
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

