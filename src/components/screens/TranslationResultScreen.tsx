/**
 * TranslationResultScreen.tsx
 * 
 * 翻訳結果画面
 * 原文と翻訳文を見やすく表示する
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Copy, Check, History, Trash2, X } from 'lucide-react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult, TranslationHistory } from '@/types';
import { GRAMMAR_TYPES, ELEMENT_TYPES } from '@/consts/grammarDefinitions';

// ===== Types =====

interface TranslationResultScreenProps {
  result: TranslationResult;
  onBack: () => void;
  onStartQuiz?: () => void; // クイズに挑戦するコールバック
  imageUrl?: string;
}

// ===== Main Component =====

export const TranslationResultScreen = ({
  result,
  onBack,
  onStartQuiz,
  imageUrl,
}: TranslationResultScreenProps) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null); // ポップアップ表示用
  
  const saveTranslationHistory = useGameStore(state => state.saveTranslationHistory);
  const translationHistory = useGameStore(state => state.translationHistory);
  const deleteTranslationHistory = useGameStore(state => state.deleteTranslationHistory);
  
  // 重複保存を防ぐためのref
  const hasSavedRef = useRef(false);
  
  // 翻訳結果を自動保存（1回のみ）
  useEffect(() => {
    if (hasSavedRef.current) return; // 既に保存済みの場合はスキップ
    
    // 同じ内容の翻訳が既に存在するかチェック
    const isDuplicate = translationHistory.some(
      (history) =>
        history.originalText === result.originalText &&
        history.translatedText === result.translatedText
    );
    
    if (!isDuplicate) {
      saveTranslationHistory(result, imageUrl);
      hasSavedRef.current = true;
    }
  }, [result, imageUrl, saveTranslationHistory, translationHistory]);

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

        {/* 記号付き原文エリア（英語学習モード用） */}
        {result.marked_text && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-blue-400">記号付き原文</h2>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.marked_text || '');
                    setCopiedOriginal(true);
                    vibrateSuccess();
                    setTimeout(() => setCopiedOriginal(false), 2000);
                  } catch (err) {
                    console.error('Failed to copy:', err);
                  }
                }}
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
            <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/50 max-h-64 overflow-y-auto">
              <p className="text-white font-mono text-lg leading-relaxed">
                {result.marked_text}
              </p>
            </div>
          </motion.div>
        )}

        {/* 日本語訳エリア（英語学習モード用） */}
        {result.japanese_translation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-emerald-400">日本語訳</h2>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.japanese_translation || '');
                    setCopiedTranslated(true);
                    vibrateSuccess();
                    setTimeout(() => setCopiedTranslated(false), 2000);
                  } catch (err) {
                    console.error('Failed to copy:', err);
                  }
                }}
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
                {result.japanese_translation}
              </p>
            </div>
          </motion.div>
        )}

        {/* 後方互換性のための原文・翻訳文セクション（marked_text/japanese_translationがない場合） */}
        {!result.marked_text && (
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
        )}

        {!result.japanese_translation && (
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
        )}

        {/* チャンクベースの構造解析（英語学習モード用 - カード式UI） */}
        {result.chunks !== undefined && result.chunks.length > 0 && (() => {
          const chunks = result.chunks!;
          return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              構造解析（ビジュアル英文解釈）
            </h2>
            
            {/* カード式UI */}
            <div className="mb-4">
              {/* チャンクカード一覧 */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                {chunks.map((chunk, index) => {
                  const role = chunk.role || chunk.type || 'M';
                  const chunkText = chunk.chunk_text || chunk.text || '';
                  const chunkTranslation = chunk.chunk_translation || chunk.translation || '';
                  const elementInfo = ELEMENT_TYPES[role as keyof typeof ELEMENT_TYPES];
                  
                  // 記号の表示
                  const getSymbolDisplay = () => {
                    if (chunk.symbol === '[]') return `[ ${chunkText} ]`;
                    if (chunk.symbol === '<>') return `< ${chunkText} >`;
                    if (chunk.symbol === '()') return `( ${chunkText} )`;
                    return chunkText;
                  };
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        vibrateLight();
                        setSelectedChunkIndex(index);
                      }}
                      className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 rounded-xl p-4 border-2 border-blue-600/50 shadow-lg cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-blue-300 text-xs font-medium">
                          {index + 1} / {chunks.length}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          role === 'S' ? 'bg-green-500/30 text-green-300' :
                          role === 'V' ? 'bg-red-500/30 text-red-300' :
                          role === 'O' ? 'bg-yellow-500/30 text-yellow-300' :
                          role === 'C' ? 'bg-purple-500/30 text-purple-300' :
                          role === 'M' ? 'bg-cyan-500/30 text-cyan-300' :
                          'bg-gray-500/30 text-gray-300'
                        }`}>
                          {elementInfo ? elementInfo.title : role}
                        </span>
                      </div>
                      
                      {/* 英語のチャンク（記号付き） */}
                      <div className="mb-3">
                        <p className="text-gray-400 text-xs mb-1">英語の塊</p>
                        <p className="text-white font-mono text-lg font-bold leading-relaxed">
                          {getSymbolDisplay()}
                        </p>
                      </div>
                      
                      {/* 日本語訳（直訳） */}
                      <div>
                        <p className="text-gray-400 text-xs mb-1">意味</p>
                        <p className="text-emerald-300 text-base font-medium">
                          {chunkTranslation}
                        </p>
                      </div>
                      
                      {/* タップして詳細を見るヒント */}
                      <div className="mt-3 pt-3 border-t border-blue-700/50">
                        <p className="text-gray-500 text-xs">タップして詳細解説を見る</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
          );
        })()}

        {/* 先生からのコメント（英語学習モード用） */}
        {result.teacherComment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-4 border border-purple-700/50">
              <div className="flex items-start gap-3">
                <span className="text-2xl">👨‍🏫</span>
                <div>
                  <h3 className="text-purple-300 font-bold mb-2">先生からのアドバイス</h3>
                  <p className="text-white text-sm leading-relaxed">
                    {result.teacherComment}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* チャンク詳細解説ポップアップ */}
        <AnimatePresence>
          {selectedChunkIndex !== null && result.chunks && result.chunks[selectedChunkIndex] && (() => {
            const chunk = result.chunks![selectedChunkIndex!];
            const role = chunk.role || chunk.type || 'M';
            const chunkText = chunk.chunk_text || chunk.text || '';
            const chunkTranslation = chunk.chunk_translation || chunk.translation || '';
            const elementInfo = ELEMENT_TYPES[role as keyof typeof ELEMENT_TYPES];
            
            // 記号タイプの判定
            let grammarType: keyof typeof GRAMMAR_TYPES | null = null;
            if (chunk.symbol === '[]') grammarType = 'noun_clause';
            else if (chunk.symbol === '()') grammarType = 'adj_clause';
            else if (chunk.symbol === '<>') grammarType = 'adv_clause';
            else if (role === 'V') grammarType = 'verb_phrase';
            
            const grammarInfo = grammarType ? GRAMMAR_TYPES[grammarType] : null;
            
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={() => {
                  vibrateLight();
                  setSelectedChunkIndex(null);
                }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-blue-600/50"
                >
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">詳細解説</h3>
                    <button
                      onClick={() => {
                        vibrateLight();
                        setSelectedChunkIndex(null);
                      }}
                      className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* チャンク情報 */}
                  <div className="mb-6">
                    <div className="mb-4">
                      <p className="text-gray-400 text-xs mb-2">英語の塊</p>
                      <p className="text-white font-mono text-xl font-bold">
                        {chunk.symbol === '[]' && `[ ${chunkText} ]`}
                        {chunk.symbol === '<>' && `< ${chunkText} >`}
                        {chunk.symbol === '()' && `( ${chunkText} )`}
                        {chunk.symbol === 'none' && chunkText}
                      </p>
                    </div>
                    <div className="mb-4">
                      <p className="text-gray-400 text-xs mb-2">意味</p>
                      <p className="text-emerald-300 text-lg font-medium">
                        {chunkTranslation}
                      </p>
                    </div>
                    {chunk.explanation && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-xs mb-2">💡 解説</p>
                        <p className="text-gray-300 text-sm">
                          {chunk.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* 文の要素（S, V, O, C）の説明 */}
                  {elementInfo && (
                    <div className="mb-6 p-4 bg-blue-900/20 rounded-xl border border-blue-700/50">
                      <h4 className="text-blue-300 font-bold mb-2">{elementInfo.title}</h4>
                      <p className="text-white text-sm font-medium mb-1">{elementInfo.meaning}</p>
                      <p className="text-gray-300 text-sm">{elementInfo.desc}</p>
                    </div>
                  )}
                  
                  {/* 括弧タイプ（名詞のカタマリ、形容詞のカタマリなど）の説明 */}
                  {grammarInfo && (
                    <div className={`p-4 rounded-xl border ${grammarInfo.color}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold">{grammarInfo.symbol}</span>
                        <h4 className="font-bold text-lg">{grammarInfo.title}</h4>
                      </div>
                      <p className="text-sm font-medium mb-2">{grammarInfo.definition}</p>
                      <p className="text-sm">{grammarInfo.description}</p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* フッター */}
        <div className="space-y-3">
          {/* この内容でクイズに挑戦ボタン（英語学習モード用） */}
          {result.chunks !== undefined && result.chunks.length > 0 && onStartQuiz !== undefined && (
            <motion.button
              onClick={() => {
                vibrateLight();
                if (onStartQuiz) {
                  onStartQuiz();
                }
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <span className="text-xl">📚</span>
              この内容でクイズに挑戦
            </motion.button>
          )}
          
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

