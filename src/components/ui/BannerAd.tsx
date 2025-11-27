/**
 * BannerAd.tsx
 * 
 * Freeユーザー向けバナー広告（シミュレーション）
 * 画面下部に固定表示される
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Crown, Sparkles } from 'lucide-react';

// ===== Types =====

interface BannerAdProps {
  isVisible: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

interface AdContent {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  gradient: string;
  icon: string;
}

// ===== Constants =====

const AD_CONTENTS: AdContent[] = [
  {
    id: 'vip_promo',
    title: '広告なしで学習',
    subtitle: 'VIPプランで快適な学習体験',
    cta: '詳しく見る',
    gradient: 'from-yellow-500 to-orange-500',
    icon: '👑',
  },
  {
    id: 'unlimited_scan',
    title: 'スキャン無制限',
    subtitle: 'VIPなら何回でもスキャンOK',
    cta: 'アップグレード',
    gradient: 'from-purple-500 to-pink-500',
    icon: '♾️',
  },
  {
    id: 'double_coins',
    title: 'コイン2倍',
    subtitle: 'VIPならいつでもコイン2倍',
    cta: 'VIPになる',
    gradient: 'from-green-500 to-emerald-500',
    icon: '💰',
  },
];

const AD_ROTATION_INTERVAL = 8000; // 8秒ごとにローテーション

// ===== Sub Components =====

/**
 * 広告コンテンツ
 */
const AdContentDisplay = ({
  content,
  onCtaClick,
}: {
  content: AdContent;
  onCtaClick: () => void;
}) => {
  return (
    <motion.div
      className="flex items-center justify-between w-full"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{content.icon}</span>
        <div>
          <h4 className="text-white font-bold text-sm leading-tight">
            {content.title}
          </h4>
          <p className="text-gray-300 text-xs">
            {content.subtitle}
          </p>
        </div>
      </div>

      <motion.button
        onClick={onCtaClick}
        className={`px-4 py-2 rounded-lg bg-gradient-to-r ${content.gradient} text-white text-sm font-bold shadow-lg flex items-center gap-1`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {content.cta}
        <ExternalLink className="w-3 h-3" />
      </motion.button>
    </motion.div>
  );
};

/**
 * シミュレート広告（外部広告風）
 */
const SimulatedExternalAd = ({ onClick }: { onClick: () => void }) => {
  const [variant] = useState(() => Math.floor(Math.random() * 3));

  const variants = [
    {
      bg: 'bg-gradient-to-r from-blue-600 to-blue-800',
      text: '📚 今すぐダウンロード',
      subtext: '人気の学習アプリ',
    },
    {
      bg: 'bg-gradient-to-r from-red-600 to-orange-600',
      text: '🎮 新作ゲーム登場',
      subtext: '無料でプレイ',
    },
    {
      bg: 'bg-gradient-to-r from-green-600 to-teal-600',
      text: '🛒 セール開催中',
      subtext: '最大50%OFF',
    },
  ];

  const current = variants[variant];

  return (
    <div 
      className={`flex items-center justify-between w-full ${current.bg} px-4 py-2 rounded cursor-pointer`}
      onClick={onClick}
    >
      <div>
        <p className="text-white text-sm font-bold">{current.text}</p>
        <p className="text-white/70 text-xs">{current.subtext}</p>
      </div>
      <div className="text-white/50 text-xs">広告</div>
    </div>
  );
};

// ===== Main Component =====

export const BannerAd = ({
  isVisible,
  onUpgradeClick,
  className = '',
}: BannerAdProps) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [showVipPromo, setShowVipPromo] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  // 広告ローテーション
  useEffect(() => {
    if (!isVisible || isDismissed) return;

    const interval = setInterval(() => {
      setShowVipPromo(prev => !prev);
      if (showVipPromo) {
        setCurrentAdIndex(i => (i + 1) % AD_CONTENTS.length);
      }
    }, AD_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isVisible, isDismissed, showVipPromo]);

  const handleUpgradeClick = () => {
    onUpgradeClick?.();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // 30秒後に再表示
    setTimeout(() => setIsDismissed(false), 30000);
  };

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
        {/* 上部の装飾ライン */}
        <div className="h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />

        {/* メインバナー */}
        <div className="bg-gray-900/95 backdrop-blur-lg border-t border-gray-700/50 px-4 py-3 relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait">
            {showVipPromo ? (
              <motion.div
                key="vip"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AdContentDisplay
                  content={AD_CONTENTS[currentAdIndex]}
                  onCtaClick={handleUpgradeClick}
                />
              </motion.div>
            ) : (
              <motion.div
                key="external"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SimulatedExternalAd onClick={() => {}} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIPへの誘導テキスト */}
          <motion.div
            className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Crown className="w-3 h-3 text-yellow-500" />
            <span>VIPプランで広告を非表示に</span>
            <Sparkles className="w-3 h-3 text-yellow-500" />
          </motion.div>
        </div>

        {/* セーフエリア用スペーサー */}
        <div className="h-safe-bottom bg-gray-900/95" />
      </motion.div>
    </AnimatePresence>
  );
};

export default BannerAd;

