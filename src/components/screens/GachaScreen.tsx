/**
 * GachaScreen.tsx
 * 
 * ガチャ画面
 * ALL_ITEMSから動的ガチャ、SSR演出付き
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gem, 
  Ticket, 
  Coins, 
  ChevronLeft, 
  Sparkles,
  Gift,
  Star
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getRarityColor, getRarityGradient, type Item } from '@/data/items';
import { GACHA } from '@/lib/constants';
import { vibrateLight, vibrateGacha } from '@/lib/haptics';
import { confettiSSR } from '@/lib/confetti';
import { useToast } from '@/components/ui/Toast';
import type { GachaResult } from '@/types';

// ===== Types =====

interface GachaScreenProps {
  onBack: () => void;
}

type GachaState = 'idle' | 'rolling' | 'revealing' | 'result';

// ===== Sub Components =====

/**
 * ガチャ演出
 */
const GachaAnimation = ({ 
  rarity, 
  onComplete 
}: { 
  rarity: Item['rarity']; 
  onComplete: () => void;
}) => {
  const isSSR = rarity === 'SSR';
  const isSR = rarity === 'SR';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 背景エフェクト */}
      <motion.div
        className={`absolute inset-0 ${
          isSSR 
            ? 'bg-gradient-to-br from-yellow-600 via-orange-500 to-red-600' 
            : isSR 
              ? 'bg-gradient-to-br from-purple-600 via-pink-500 to-purple-600'
              : 'bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-600'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0.3] }}
        transition={{ duration: 1.5 }}
      />

      {/* 光線 */}
      {(isSSR || isSR) && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-1 h-40 ${isSSR ? 'bg-yellow-300' : 'bg-purple-300'}`}
              style={{
                transform: `rotate(${i * 30}deg)`,
                transformOrigin: 'center 200px',
              }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: [0, 0.8, 0], scaleY: [0, 1, 0] }}
              transition={{ 
                duration: 1.5, 
                delay: i * 0.08,
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* 中央のオーブ */}
      <motion.div
        className={`relative w-32 h-32 rounded-full ${
          isSSR 
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
            : isSR
              ? 'bg-gradient-to-br from-purple-400 to-pink-500'
              : rarity === 'R'
                ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                : 'bg-gradient-to-br from-gray-400 to-gray-500'
        }`}
        initial={{ scale: 0 }}
        animate={{ 
          scale: [0, 1.5, 1],
          boxShadow: isSSR 
            ? ['0 0 0 0 rgba(251, 191, 36, 0)', '0 0 100px 50px rgba(251, 191, 36, 0.5)', '0 0 60px 30px rgba(251, 191, 36, 0.3)']
            : isSR
              ? ['0 0 0 0 rgba(168, 85, 247, 0)', '0 0 80px 40px rgba(168, 85, 247, 0.5)', '0 0 40px 20px rgba(168, 85, 247, 0.3)']
              : ['0 0 0 0 rgba(59, 130, 246, 0)', '0 0 50px 25px rgba(59, 130, 246, 0.5)', '0 0 30px 15px rgba(59, 130, 246, 0.3)']
        }}
        transition={{ duration: 1.5 }}
        onAnimationComplete={onComplete}
      >
        <div className="absolute inset-2 rounded-full bg-white/30 backdrop-blur-sm" />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className={`w-12 h-12 ${isSSR ? 'text-yellow-200' : 'text-white'}`} />
        </motion.div>
      </motion.div>

      {/* SSR専用追加演出 */}
      {isSSR && (
        <>
          {/* 星パーティクル */}
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1 + Math.random(),
                delay: Math.random() * 2,
                repeat: Infinity,
              }}
            >
              <Star className="w-full h-full text-yellow-300 fill-yellow-300" />
            </motion.div>
          ))}
        </>
      )}
    </motion.div>
  );
};

/**
 * 結果表示
 */
const GachaResultDisplay = ({
  result,
  onClose,
}: {
  result: GachaResult;
  onClose: () => void;
}) => {
  const { item, isNew } = result;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        className="relative w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden border-2"
        style={{ borderColor: getRarityColor(item.rarity) }}
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        {/* 背景グラデーション */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{ background: getRarityGradient(item.rarity) }}
        />

        {/* コンテンツ */}
        <div className="relative p-6 text-center">
          {/* NEWバッジ */}
          {isNew && (
            <motion.div
              className="absolute top-4 right-4 px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full"
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3 }}
            >
              NEW!
            </motion.div>
          )}

          {/* レアリティ */}
          <motion.div
            className="text-lg font-bold mb-4"
            style={{ color: getRarityColor(item.rarity) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {'★'.repeat(
              item.rarity === 'SSR' ? 5 :
              item.rarity === 'SR' ? 4 :
              item.rarity === 'R' ? 3 : 2
            )}
          </motion.div>

          {/* アイテムビジュアル */}
          <motion.div
            className="w-32 h-32 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ 
              background: getRarityGradient(item.rarity),
              boxShadow: `0 0 30px ${getRarityColor(item.rarity)}50`
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            {item.visual && item.visual.value ? (
              item.visual.type === 'svg_path' ? (
                <svg viewBox="0 0 24 24" className="w-16 h-16">
                  <path d={item.visual.value} fill="white" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
                </svg>
              ) : (
                <div 
                  className="w-16 h-16 rounded-xl"
                  style={{ backgroundColor: item.visual.value }}
                />
              )
            ) : null}
          </motion.div>

          {/* アイテム名 */}
          <motion.h3
            className="text-2xl font-bold text-white mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {item.name}
          </motion.h3>

          {/* 説明 */}
          {item.description && (
            <motion.p
              className="text-gray-400 text-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {item.description}
            </motion.p>
          )}

          {/* タイプバッジ */}
          <motion.div
            className="flex justify-center gap-2 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full">
              {item.type === 'equipment' ? '装備品' : '消耗品'}
            </span>
            {item.category && (
              <span className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full">
                {item.category === 'head' ? '頭' :
                 item.category === 'body' ? '体' :
                 item.category === 'face' ? '顔' : 'アクセサリー'}
              </span>
            )}
          </motion.div>

          {/* 閉じるボタン */}
          <motion.button
            onClick={onClose}
            className="w-full py-4 rounded-xl font-bold text-white"
            style={{ 
              background: getRarityGradient(item.rarity),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            OK
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ===== Main Component =====

export const GachaScreen = ({ onBack }: GachaScreenProps) => {
  const [gachaState, setGachaState] = useState<GachaState>('idle');
  const [currentResult, setCurrentResult] = useState<GachaResult | null>(null);
  const [rollingRarity, setRollingRarity] = useState<Item['rarity']>('N');

  // Store
  const coins = useGameStore(state => state.coins);
  const tickets = useGameStore(state => state.tickets);
  const pullGacha = useGameStore(state => state.pullGacha);

  // Toast
  const { addToast } = useToast();

  const canPullSingle = coins >= GACHA.COST.SINGLE || tickets > 0;
  const canPullTen = coins >= GACHA.COST.TEN_PULL;

  // 単発ガチャ
  const handleSinglePull = useCallback((useTicket: boolean) => {
    vibrateLight();
    const result = pullGacha(useTicket);
    
    if ('error' in result) {
      addToast('error', result.error);
      return;
    }

    setRollingRarity(result.item.rarity);
    setGachaState('rolling');
    setCurrentResult(result);
  }, [pullGacha, addToast]);

  // アニメーション完了
  const handleAnimationComplete = () => {
    if (currentResult) {
      vibrateGacha(currentResult.item.rarity);
      
      // SSR時は紙吹雪
      if (currentResult.item.rarity === 'SSR') {
        confettiSSR();
      }
    }
    setGachaState('result');
  };

  // 結果を閉じる
  const handleCloseResult = () => {
    vibrateLight();
    setGachaState('idle');
    setCurrentResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between py-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Gem className="w-6 h-6 text-purple-400" />
            ガチャ
          </h1>

          <div className="w-16" />
        </div>

        {/* 所持リソース */}
        <div className="flex justify-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold">{coins}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
            <Ticket className="w-5 h-5 text-pink-400" />
            <span className="text-white font-bold">{tickets}</span>
          </div>
        </div>

        {/* ガチャビジュアル */}
        <motion.div
          className="relative w-64 h-64 mx-auto mb-8"
          animate={gachaState === 'idle' ? { 
            rotate: [0, 5, -5, 0],
          } : {}}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {/* ガチャマシン */}
          <div className="absolute inset-0 bg-gradient-to-b from-purple-600 to-purple-800 rounded-3xl border-4 border-purple-400 shadow-lg shadow-purple-500/30">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-gray-900 border-4 border-purple-300 flex items-center justify-center overflow-hidden">
              <motion.div
                className="grid grid-cols-3 gap-1"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full ${
                      i % 4 === 0 ? 'bg-yellow-400' :
                      i % 4 === 1 ? 'bg-purple-400' :
                      i % 4 === 2 ? 'bg-blue-400' : 'bg-gray-400'
                    }`}
                  />
                ))}
              </motion.div>
            </div>

            {/* 取り出し口 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-8 bg-gray-900 rounded-full border-2 border-purple-300" />
          </div>

          {/* 星の装飾 */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${10 + Math.random() * 80}%`,
              }}
              animate={{ 
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{ 
                duration: 2, 
                delay: i * 0.4, 
                repeat: Infinity 
              }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </motion.div>
          ))}
        </motion.div>

        {/* 排出率 */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
          <p className="text-center text-sm text-gray-400 mb-3">排出確率</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {Object.entries(GACHA.RATES).map(([rarity, rate]) => (
              <div key={rarity}>
                <span 
                  className="text-sm font-bold"
                  style={{ color: getRarityColor(rarity as Item['rarity']) }}
                >
                  {rarity}
                </span>
                <p className="text-gray-400 text-xs">{rate}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* ガチャボタン */}
        <div className="space-y-3">
          {/* チケットで引く */}
          {tickets > 0 && (
            <motion.button
              onClick={() => handleSinglePull(true)}
              disabled={gachaState !== 'idle'}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Ticket className="w-5 h-5" />
              チケットで1回引く
            </motion.button>
          )}

          {/* コインで1回 */}
          <motion.button
            onClick={() => handleSinglePull(false)}
            disabled={!canPullSingle || gachaState !== 'idle'}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={canPullSingle ? { scale: 1.02 } : {}}
            whileTap={canPullSingle ? { scale: 0.98 } : {}}
          >
            <Gift className="w-5 h-5" />
            1回引く ({GACHA.COST.SINGLE} コイン)
          </motion.button>

          {/* 10連 */}
          <motion.button
            onClick={() => {/* 10連実装 */}}
            disabled={!canPullTen || gachaState !== 'idle'}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={canPullTen ? { scale: 1.02 } : {}}
            whileTap={canPullTen ? { scale: 0.98 } : {}}
          >
            <Sparkles className="w-5 h-5" />
            10連ガチャ ({GACHA.COST.TEN_PULL} コイン)
            <span className="text-xs opacity-80">SR以上確定</span>
          </motion.button>
        </div>

        {/* 天井説明 */}
        <p className="text-center text-gray-500 text-xs mt-4">
          10回でSR以上確定 / 100回でSSR確定
        </p>
      </div>

      {/* ガチャ演出 */}
      <AnimatePresence>
        {gachaState === 'rolling' && (
          <GachaAnimation
            rarity={rollingRarity}
            onComplete={handleAnimationComplete}
          />
        )}
      </AnimatePresence>

      {/* 結果表示 */}
      <AnimatePresence>
        {gachaState === 'result' && currentResult && (
          <GachaResultDisplay
            result={currentResult}
            onClose={handleCloseResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GachaScreen;

