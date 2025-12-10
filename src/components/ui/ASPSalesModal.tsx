/**
 * ASPSalesModal.tsx
 * 
 * AIセールスマンモーダル
 * 「AI先生からのアドバイス」として、5秒間しっかり読ませてからクリックを促すUI
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Sparkles, Timer } from 'lucide-react';
import { ASP_ADS, type AspAdItem } from '@/data/aspAds';

// ===== Types =====

interface ASPSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  adRecommendation: {
    ad_id: string;
    reason: string;
    url?: string;
    name?: string;
  } | null;
}

// ===== Constants =====

const MIN_READ_TIME = 5000; // 5秒間しっかり読ませる

// ===== Main Component =====

export const ASPSalesModal = ({
  isOpen,
  onClose,
  adRecommendation,
}: ASPSalesModalProps) => {
  const [readTime, setReadTime] = useState(0);
  const [canClick, setCanClick] = useState(false);
  const [selectedAd, setSelectedAd] = useState<AspAdItem | null>(null);

  // 広告情報を取得
  useEffect(() => {
    if (adRecommendation) {
      if (adRecommendation.ad_id === 'rakuten_fallback') {
        setSelectedAd({
          id: 'rakuten_fallback',
          name: adRecommendation.name || '楽天で探す',
          url: adRecommendation.url || 'https://search.rakuten.co.jp/',
          imageUrl: '/images/ads/rakuten-placeholder.png',
          descriptionForAI: adRecommendation.reason,
          keywords: [],
        });
      } else {
        const ad = ASP_ADS.find(a => a.id === adRecommendation.ad_id);
        setSelectedAd(ad || null);
      }
    }
  }, [adRecommendation]);

  // 読書時間のカウント
  useEffect(() => {
    if (!isOpen || !adRecommendation) return;

    setReadTime(0);
    setCanClick(false);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setReadTime(elapsed);

      if (elapsed >= MIN_READ_TIME) {
        setCanClick(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, adRecommendation]);

  if (!adRecommendation || !selectedAd) {
    return null;
  }

  const readProgress = Math.min((readTime / MIN_READ_TIME) * 100, 100);
  const remainingSeconds = Math.ceil((MIN_READ_TIME - readTime) / 1000);

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
            onClick={canClick ? onClose : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* モーダルコンテンツ */}
          <motion.div
            className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* ヘッダー */}
            <div className="px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h2 className="text-lg font-bold text-white">
                    広告
                  </h2>
                </div>
                {canClick && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* ボディ */}
            <div className="px-6 py-6">
              {/* 商品名 */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2">
                  {selectedAd.name}
                </h3>
                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${readProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                {!canClick && (
                  <p className="text-gray-400 text-sm mt-2 text-center">
                    あと {remainingSeconds} 秒で詳細を確認できます
                  </p>
                )}
              </div>

              {/* AIからのメッセージ */}
              <motion.div
                className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-72">
                      {adRecommendation.reason}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* 商品説明 */}
              {selectedAd.descriptionForAI && (
                <div className="bg-gray-800/30 rounded-lg p-3 mb-4">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-72">
                    {selectedAd.descriptionForAI}
                  </p>
                </div>
              )}

              {/* 注意書き */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 text-xs text-center">
                  ※ 外部サイトに移動します。購入は任意です。
                </p>
              </div>
            </div>

            {/* フッター */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
              {!canClick ? (
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-2">
                    内容を確認してください...
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              ) : (
                <a
                  href={selectedAd.url || '#'}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="block w-full"
                  onClick={onClose}
                >
                  <button
                    className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/30"
                  >
                    <ExternalLink className="w-5 h-5" />
                    詳細を見る
                  </button>
                </a>
              )}
            </div>

            {/* 閉じるボタン（待機/閲覧後共通） */}
            <div className="px-6 pb-6 bg-gray-900/60">
              <button
                onClick={onClose}
                disabled={!canClick}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  canClick
                    ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'
                    : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                {canClick ? (
                  <>
                    広告を閉じてコイン2倍
                  </>
                ) : (
                  <>
                    <Timer className="w-4 h-4 animate-spin" />
                    メッセージを確認中... ({remainingSeconds})
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ASPSalesModal;

