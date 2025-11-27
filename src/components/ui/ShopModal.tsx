/**
 * ShopModal.tsx
 * 
 * VIP訴求モーダル
 * VIPプランの特典を表示し、購入を促す
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Crown, 
  Infinity, 
  Coins, 
  Ban, 
  Sparkles,
  CheckCircle,
  Star
} from 'lucide-react';
import { VIP_PLAN } from '@/lib/constants';

// ===== Types =====

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
  isVIP?: boolean;
}

// ===== Constants =====

const BENEFITS = [
  {
    icon: Infinity,
    title: 'スキャン無制限',
    description: '1日のスキャン回数制限なし！学び放題！',
    color: '#8B5CF6',
  },
  {
    icon: Coins,
    title: 'コイン2倍',
    description: 'クエストクリア時のコインが常時2倍に',
    color: '#F59E0B',
  },
  {
    icon: Ban,
    title: '広告完全非表示',
    description: 'バナー広告が表示されず、快適な学習体験',
    color: '#EF4444',
  },
  {
    icon: Sparkles,
    title: 'ログインボーナス2倍',
    description: '毎日のログインボーナスが50→100コインに',
    color: '#10B981',
  },
];

// ===== Sub Components =====

/**
 * 特典カード
 */
const BenefitCard = ({ 
  benefit, 
  index 
}: { 
  benefit: typeof BENEFITS[0]; 
  index: number;
}) => {
  const Icon = benefit.icon;

  return (
    <motion.div
      className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div 
        className="p-3 rounded-xl"
        style={{ backgroundColor: `${benefit.color}20` }}
      >
        <Icon 
          className="w-6 h-6" 
          style={{ color: benefit.color }} 
        />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-white mb-1">{benefit.title}</h4>
        <p className="text-sm text-gray-400">{benefit.description}</p>
      </div>
      <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
    </motion.div>
  );
};

/**
 * 価格表示
 */
const PriceDisplay = () => {
  return (
    <motion.div
      className="text-center py-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="inline-flex items-baseline gap-1">
        <span className="text-gray-400 text-lg">¥</span>
        <span className="text-5xl font-bold text-white">
          {VIP_PLAN.PRICE}
        </span>
        <span className="text-gray-400 text-lg">/月</span>
      </div>
      <p className="text-gray-500 text-sm mt-2">
        いつでもキャンセル可能
      </p>
    </motion.div>
  );
};

/**
 * VIP会員状態表示
 */
const VIPStatus = () => {
  return (
    <motion.div
      className="text-center py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="inline-block mb-4"
        animate={{ 
          rotate: [0, 10, -10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          repeatDelay: 3 
        }}
      >
        <Crown className="w-20 h-20 text-yellow-500" />
      </motion.div>
      <h3 className="text-2xl font-bold text-white mb-2">
        VIP会員です！
      </h3>
      <p className="text-gray-400">
        全ての特典をお楽しみいただけます
      </p>
      
      {/* 星のエフェクト */}
      <div className="flex justify-center gap-2 mt-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ 
              opacity: [0.5, 1, 0.5],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{ 
              duration: 1.5, 
              delay: i * 0.2, 
              repeat: Infinity 
            }}
          >
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// ===== Main Component =====

export const ShopModal = ({
  isOpen,
  onClose,
  onPurchase,
  isVIP = false,
}: ShopModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async () => {
    setIsProcessing(true);
    
    // 実際の課金処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    onPurchase();
    setIsProcessing(false);
  };

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
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* モーダルコンテンツ */}
          <motion.div
            className="relative w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl overflow-hidden border border-yellow-500/30 shadow-2xl shadow-yellow-500/10"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* 装飾的なグロー */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-yellow-500/20 blur-3xl" />

            {/* ヘッダー */}
            <div className="relative px-6 py-5 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <Crown className="w-8 h-8 text-yellow-500" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      VIPプラン
                    </h2>
                    <p className="text-sm text-yellow-500">
                      プレミアムな学習体験
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* ボディ */}
            <div className="relative px-6 py-6 max-h-[60vh] overflow-y-auto">
              {isVIP ? (
                <VIPStatus />
              ) : (
                <>
                  {/* 特典リスト */}
                  <div className="space-y-3 mb-6">
                    {BENEFITS.map((benefit, index) => (
                      <BenefitCard 
                        key={benefit.title} 
                        benefit={benefit} 
                        index={index} 
                      />
                    ))}
                  </div>

                  {/* 価格 */}
                  <PriceDisplay />

                  {/* 比較 */}
                  <motion.div
                    className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-gray-500 text-sm mb-1">無料プラン</p>
                        <p className="text-gray-400 font-medium">5回/日</p>
                      </div>
                      <div>
                        <p className="text-yellow-500 text-sm mb-1">VIPプラン</p>
                        <p className="text-white font-bold flex items-center justify-center gap-1">
                          <Infinity className="w-4 h-4" /> 無制限
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>

            {/* フッター */}
            <div className="relative px-6 py-4 border-t border-gray-700/50">
              {isVIP ? (
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  閉じる
                </button>
              ) : (
                <motion.button
                  onClick={handlePurchase}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl font-bold text-black bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/25"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div
                        className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      処理中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Crown className="w-5 h-5" />
                      VIPになる - ¥{VIP_PLAN.PRICE}/月
                    </span>
                  )}
                </motion.button>
              )}

              {!isVIP && (
                <p className="text-center text-gray-500 text-xs mt-3">
                  お支払いはApp Store / Google Playを通じて行われます
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShopModal;

