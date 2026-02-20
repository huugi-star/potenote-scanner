/**
 * TankoreScreen.tsx
 *
 * 単コレ拠点画面
 * 単語を討伐・捕獲する英文解釈の土台となるモード
 */

import { motion } from 'framer-motion';
import { ChevronLeft, Sword, Languages } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';

// ===== Types =====

interface TankoreScreenProps {
  onBack: () => void;
  onNavigate: (phase: 'translation_mode_select' | 'translation_history') => void;
}

// ===== Main Component =====

export const TankoreScreen = ({
  onBack,
  onNavigate,
}: TankoreScreenProps) => {
  const translationHistoryCount = useGameStore(
    (state) => state.translationHistory.length
  );
  const hasScanned = translationHistoryCount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-sm font-medium">戻る</span>
        </button>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Sword className="w-5 h-5 text-amber-500" />
          単コレ拠点
        </h1>
        <div className="w-16" />
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {!hasScanned ? (
          /* スキャン未実施時：案内表示 */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/50 mb-4">
                <Sword className="w-10 h-10 text-amber-400" />
              </div>
              <p className="text-gray-400 text-sm mb-2">単語を討伐・捕獲</p>
              <p className="text-gray-300 text-base leading-relaxed">
                まずはスキャンしてください
              </p>
              <p className="text-gray-500 text-sm mt-2">
                英文解釈モードでスキャンすると
                <br />
                単語を収集できます
              </p>
            </div>

            <motion.button
              onClick={() => {
                vibrateLight();
                onNavigate('translation_mode_select');
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Languages className="w-5 h-5" />
              スキャンして英語学習へ
            </motion.button>
          </motion.div>
        ) : (
          /* スキャン済み：拠点コンテンツ（将来拡張用） */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/50 mb-4">
                <Sword className="w-8 h-8 text-amber-400" />
              </div>
              <p className="text-gray-300 font-medium">
                収集した単語: {translationHistoryCount}件の翻訳から
              </p>
              <p className="text-gray-500 text-sm mt-1">
                翻訳履歴から単語を確認できます
              </p>
            </div>

            <motion.button
              onClick={() => {
                vibrateLight();
                onNavigate('translation_history');
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Languages className="w-5 h-5" />
              翻訳履歴で単語を確認
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TankoreScreen;
