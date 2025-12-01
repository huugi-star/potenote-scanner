/**
 * TranslationResultScreen.tsx
 * 
 * 翻訳結果画面
 * 原文と翻訳文を見やすく表示する
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, Copy, Check, History, Trash2 } from 'lucide-react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult, TranslationHistory } from '@/types';

// ===== Types =====

interface TranslationResultScreenProps {
  result: TranslationResult;
  onBack: () => void;
  imageUrl?: string;
}

// ===== Main Component =====

export const TranslationResultScreen = ({
  result,
  onBack,
  imageUrl,
}: TranslationResultScreenProps) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const saveTranslationHistory = useGameStore(state => state.saveTranslationHistory);
  const translationHistory = useGameStore(state => state.translationHistory);
  const deleteTranslationHistory = useGameStore(state => state.deleteTranslationHistory);
  
  // 翻訳結果を自動保存
  useEffect(() => {
    saveTranslationHistory(result, imageUrl);
  }, []); // 初回のみ実行

  const handleCopyOriginal = async () => {
    try {
      await navigator.clipboard.writeText(result.originalText);
      setCopiedOriginal(true);
      vibrateSuccess();
      setTimeout(() => setCopiedOriginal(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyTranslated = async () => {
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopiedTranslated(true);
      vibrateSuccess();
      setTimeout(() => setCopiedTranslated(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🌐</span>
            翻訳結果
          </h1>
        </div>

        {/* 原文セクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-300">原文</h2>
            <button
              onClick={handleCopyOriginal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              {copiedOriginal ? (
                <>
                  <Check className="w-4 h-4" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  コピー
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 max-h-64 overflow-y-auto">
            <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
              {result.originalText}
            </p>
          </div>
        </motion.div>

        {/* 翻訳文セクション */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-emerald-400">翻訳文（日本語）</h2>
            <button
              onClick={handleCopyTranslated}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
            >
              {copiedTranslated ? (
                <>
                  <Check className="w-4 h-4" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  コピー
                </>
              )}
            </button>
          </div>
          <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-700/50 max-h-96 overflow-y-auto">
            <p className="text-white whitespace-pre-wrap leading-relaxed text-base">
              {result.translatedText}
            </p>
          </div>
        </motion.div>

        {/* フッター */}
        <div className="space-y-3">
          <motion.button
            onClick={() => {
              vibrateLight();
              setShowHistory(!showHistory);
            }}
            className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <History className="w-5 h-5" />
            翻訳履歴を見る ({translationHistory.length})
          </motion.button>
          
          <motion.button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-5 h-5" />
            ホームへ戻る
          </motion.button>
        </div>

        {/* 翻訳履歴 */}
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 space-y-3"
          >
            <h3 className="text-lg font-bold text-white mb-3">翻訳履歴</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {translationHistory.length === 0 ? (
                <p className="text-gray-400 text-center py-8">履歴がありません</p>
              ) : (
                translationHistory.map((history) => (
                  <TranslationHistoryItem
                    key={history.id}
                    history={history}
                    onDelete={() => {
                      vibrateLight();
                      deleteTranslationHistory(history.id);
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// ===== Sub Components =====

interface TranslationHistoryItemProps {
  history: TranslationHistory;
  onDelete: () => void;
}

const TranslationHistoryItem = ({ history, onDelete }: TranslationHistoryItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(history.translatedText);
      setCopied(true);
      vibrateSuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const date = new Date(history.createdAt);
  const dateString = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{dateString}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="コピー"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
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
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-emerald-400 text-sm hover:text-emerald-300"
        >
          {isExpanded ? '折りたたむ' : '詳細を見る'}
        </button>
        
        {isExpanded && (
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
    </div>
  );
};

export default TranslationResultScreen;

