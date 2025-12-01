/**
 * TranslationHistoryScreen.tsx
 * 
 * 翻訳履歴一覧画面
 * 過去に翻訳した内容を一覧表示し、削除できる
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Home, Copy, Check, Trash2, ChevronLeft } from 'lucide-react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationHistory } from '@/types';

// ===== Types =====

interface TranslationHistoryScreenProps {
  onBack: () => void;
}

// ===== Main Component =====

export const TranslationHistoryScreen = ({
  onBack,
}: TranslationHistoryScreenProps) => {
  const translationHistory = useGameStore(state => state.translationHistory);
  const deleteTranslationHistory = useGameStore(state => state.deleteTranslationHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (history: TranslationHistory) => {
    try {
      await navigator.clipboard.writeText(history.translatedText);
      setCopiedId(history.id);
      vibrateSuccess();
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = (id: string) => {
    vibrateLight();
    if (confirm('この翻訳履歴を削除しますか？')) {
      deleteTranslationHistory(id);
      if (expandedId === id) {
        setExpandedId(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">🌐</span>
              翻訳履歴
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            {translationHistory.length}件の翻訳履歴
          </p>
        </div>

        {/* 履歴一覧 */}
        {translationHistory.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">翻訳履歴がありません</p>
            <p className="text-gray-500 text-sm">スキャン翻訳を使用すると、ここに履歴が表示されます</p>
          </div>
        ) : (
          <div className="space-y-4">
            {translationHistory.map((history, index) => (
              <motion.div
                key={history.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatDate(history.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(history)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      title="コピー"
                    >
                      {copiedId === history.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(history.id)}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-400 line-clamp-2">
                    {history.originalText.substring(0, 100)}
                    {history.originalText.length > 100 && '...'}
                  </div>
                  <div className="text-sm text-emerald-400 line-clamp-2">
                    {history.translatedText.substring(0, 100)}
                    {history.translatedText.length > 100 && '...'}
                  </div>
                  
                  <button
                    onClick={() => setExpandedId(expandedId === history.id ? null : history.id)}
                    className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
                  >
                    {expandedId === history.id ? '折りたたむ' : '詳細を見る'}
                  </button>
                  
                  {expandedId === history.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 pt-3 border-t border-gray-700"
                    >
                      <div>
                        <p className="text-xs text-gray-500 mb-1">原文</p>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {history.originalText}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">翻訳文</p>
                        <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
                          {history.translatedText}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationHistoryScreen;

