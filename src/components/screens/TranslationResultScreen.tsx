/**
 * TranslationResultScreen.tsx
 * * 翻訳結果画面
 * 原文と翻訳文を見やすく表示する
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Copy, Check, History, Trash2, X, ChevronDown, Printer } from 'lucide-react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult, TranslationHistory } from '@/types';
import { GRAMMAR_TYPES, ELEMENT_TYPES } from '@/consts/grammarDefinitions';
import { SyntaxLegend } from '@/components/SyntaxLegend';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';

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
    
    // sentences配列がある場合（英文解釈モード）は、そこからoriginalTextとtranslatedTextを構築
    let originalText = result.originalText || '';
    let translatedText = result.translatedText || '';
    
    if (result.sentences && result.sentences.length > 0) {
      // sentencesから原文と訳文を構築
      originalText = result.sentences.map(s => s.marked_text || '').join(' ').trim();
      translatedText = result.sentences.map(s => s.translation || '').join(' ').trim();
      
      // 空の場合は後方互換用のフィールドを使用
      if (!originalText && result.marked_text) {
        originalText = result.marked_text;
      }
      if (!translatedText && result.japanese_translation) {
        translatedText = result.japanese_translation;
      }
    }
    
    // 原文または訳文が空の場合は保存しない
    if (!originalText || !translatedText) {
      console.log('Translation result missing required fields, skipping save');
      return;
    }
    
    // 同じ内容の翻訳が既に存在するかチェック
    const isDuplicate = translationHistory.some(
      (history) =>
        history.originalText === originalText &&
        history.translatedText === translatedText
    );
    
    if (!isDuplicate) {
      // sentences配列を含む完全なresultを保存
      const resultToSave: TranslationResult = {
        ...result,
        originalText,
        translatedText,
      };
      saveTranslationHistory(resultToSave, imageUrl);
      hasSavedRef.current = true;
    }
  }, [result, imageUrl, saveTranslationHistory, translationHistory]);

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

  const handlePrint = () => {
    vibrateLight();
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24 print-container">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🌐</span>
            翻訳結果
          </h1>
        </div>

        {/* 要約セクション（多言語翻訳モード用） */}
        {result.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-yellow-400 flex items-center gap-2">
                <span className="text-xl">📋</span>
                3行まとめ（要旨）
              </h2>
            </div>
            <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700/50">
              <p className="text-yellow-100 whitespace-pre-wrap leading-relaxed text-base font-medium">
                {result.summary}
              </p>
            </div>
            {result.textType && result.tone && (
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                  {result.textType === 'academic' ? '📄 論文・契約書' :
                   result.textType === 'email' ? '📧 メール・チャット' :
                   result.textType === 'manual' ? '📖 マニュアル' :
                   '📝 一般記事'}
                </span>
                <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                  {result.tone}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* 一文完結型のカードリスト表示 */}
        {result.sentences && result.sentences.length > 0 ? (
          <div className="space-y-6">
            {result.sentences.map((sentence, sentenceIndex) => (
              <SentenceCard
                key={`sentence-${sentenceIndex}-${sentence.marked_text?.substring(0, 20) || sentenceIndex}`}
                sentence={sentence}
                sentenceIndex={sentenceIndex}
              />
            ))}
          </div>
        ) : (
          /* 後方互換：旧形式の表示 */
          <>
            {/* 1. 記号付き原文エリア */}
            {result.marked_text && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-blue-400">記号付き原文</h2>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors print:hidden"
                    title="PDFで印刷"
                  >
                    <Printer className="w-4 h-4" />
                    PDFで印刷
                  </button>
                </div>
                <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-700/50 overflow-x-auto">
                  <MarkedTextParser text={result.marked_text} />
                </div>
              </motion.div>
            )}

            {/* 2. 全文和訳エリア */}
            {result.japanese_translation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-emerald-400">全文和訳</h2>
                </div>
                <div className="bg-emerald-900/20 rounded-xl p-5 border border-emerald-700/50">
                  <p className="text-white whitespace-pre-wrap leading-relaxed text-lg">
                    {result.japanese_translation}
                  </p>
                </div>
              </motion.div>
            )}

            {/* 2.5. 翻訳文セクション（多言語翻訳モード用） */}
            {result.translatedText && !result.japanese_translation && (
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
                {/* 原文 */}
                {result.originalText && (
                  <div className="mb-4 bg-gray-800/50 rounded-xl p-4 border border-gray-700 max-h-64 overflow-y-auto">
                    <p className="text-gray-300 text-sm mb-2 font-semibold">原文</p>
                    <p className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm">
                      {result.originalText}
                    </p>
                  </div>
                )}
                {/* 翻訳文 */}
                <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-700/50 max-h-96 overflow-y-auto">
                  <p className="text-white whitespace-pre-wrap leading-relaxed text-base">
                    {result.translatedText}
                  </p>
                </div>
              </motion.div>
            )}

            {/* 2.6. 専門用語リスト（多言語翻訳モード用） */}
            {result.technicalTerms && result.technicalTerms.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6"
              >
                <h2 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  専門用語の補足説明
                </h2>
                <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/50 space-y-2">
                  {result.technicalTerms.map((term, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="text-blue-300 font-bold text-sm min-w-[120px]">
                        {term.term}
                      </span>
                      <span className="text-gray-300 text-sm flex-1">
                        {term.explanation}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* 3. 構造解析カードエリア (Chunk Cards) */}
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
            
            {/* 横スクロールカード */}
            <div className="overflow-x-auto pb-4 -mx-4 px-4">
              <div className="flex gap-4 min-w-max">
                {chunks.map((chunk, index) => {
                  const role = chunk.role || chunk.type || 'M';
                  const chunkText = chunk.chunk_text || chunk.text || '';
                  const chunkTranslation = chunk.chunk_translation || chunk.translation || '';
                  const elementInfo = ELEMENT_TYPES[role as keyof typeof ELEMENT_TYPES];
                  
                  // 記号タイプの判定とGRAMMAR_TYPESの取得
                  let grammarType: keyof typeof GRAMMAR_TYPES | null = null;
                  
                  // ★修正点: M（修飾語）の場合は、記号が何であれ（あるいは無くても） <> として扱う優先度を高くする
                  const isModifier = role === 'M';

                  if (chunk.symbol === '()') grammarType = 'adj_clause'; // () は形容詞節として優先
                  else if (isModifier || chunk.symbol === '<>') grammarType = 'adv_clause'; // M または <> なら副詞的修飾(<>)
                  else if (chunk.symbol === '[]') grammarType = 'noun_clause'; // その他の [] は名詞節
                  else if (role === 'V') grammarType = 'verb_phrase';
                  
                  const grammarInfo = grammarType ? GRAMMAR_TYPES[grammarType] : null;
                  
                  // 記号付きテキストの生成
                  const getSymbolDisplay = () => {
                    // grammarTypeに基づいて統一された記号を返す
                    if (grammarType === 'noun_clause') return `[ ${chunkText} ]`;
                    if (grammarType === 'adv_clause') return `< ${chunkText} >`;
                    if (grammarType === 'adj_clause') return `( ${chunkText} )`;
                    
                    // フォールバック
                    if (chunk.symbol === '[]') return `[ ${chunkText} ]`;
                    if (chunk.symbol === '<>') return `< ${chunkText} >`;
                    if (chunk.symbol === '()') return `( ${chunkText} )`;
                    return chunkText;
                  };
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        vibrateLight();
                        setSelectedChunkIndex(index);
                      }}
                      className={`flex-shrink-0 w-80 rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform ${
                        grammarInfo ? grammarInfo.color : 'bg-gray-50 border-gray-200'
                      } border-2 overflow-hidden`}
                    >
                      {/* ヘッダー: GRAMMAR_TYPESのsymbolとtitle */}
                      {grammarInfo && (
                        <div className={`px-4 py-3 border-b-2 ${grammarInfo.color.split(' ')[2] || 'border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{grammarInfo.symbol}</span>
                            <span className="font-bold text-sm">{grammarInfo.title}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="p-4">
                        {/* チャンク番号 */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-gray-500">
                            {index + 1} / {chunks.length}
                          </span>
                          {/* 役割バッジ */}
                          {elementInfo && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              role === 'S' ? 'bg-green-100 text-green-800' :
                              role === 'V' ? 'bg-red-100 text-red-800' :
                              role === 'O' ? 'bg-yellow-100 text-yellow-800' :
                              role === 'C' ? 'bg-purple-100 text-purple-800' :
                              role === 'M' ? 'bg-cyan-100 text-cyan-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {elementInfo.title}
                            </span>
                          )}
                        </div>
                        
                        {/* メインテキスト: チャンクのテキスト（記号付き） */}
                        <div className="mb-3">
                          <p className="text-gray-600 text-xs mb-1 font-medium">英語の塊</p>
                          <p className="text-gray-900 font-mono text-base font-bold leading-relaxed">
                            {getSymbolDisplay()}
                          </p>
                        </div>
                        
                        {/* 直訳 */}
                        <div className="mb-3">
                          <p className="text-gray-600 text-xs mb-1 font-medium">意味</p>
                          <p className="text-emerald-700 text-base font-medium">
                            {chunkTranslation}
                          </p>
                        </div>
                        
                        {/* 詳細を見るボタン */}
                        <button className="w-full mt-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                          詳細を見る →
                        </button>
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
            
            // 記号タイプの判定（ポップアップ内でも統一ロジックを適用）
            let grammarType: keyof typeof GRAMMAR_TYPES | null = null;
            const isModifier = role === 'M';

            if (chunk.symbol === '()') grammarType = 'adj_clause';
            else if (isModifier || chunk.symbol === '<>') grammarType = 'adv_clause'; // Mは <> に統一
            else if (chunk.symbol === '[]') grammarType = 'noun_clause';
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
                        {/* 統一ロジックに基づいて表示 */}
                        {grammarType === 'noun_clause' && `[ ${chunkText} ]`}
                        {grammarType === 'adv_clause' && `< ${chunkText} >`}
                        {grammarType === 'adj_clause' && `( ${chunkText} )`}
                        {!grammarType && chunkText}
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

        {/* 記号の読み方ガイド（英語学習モードのみ） */}
        {result.sentences && result.sentences.length > 0 && <SyntaxLegend />}

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
          
          {/* この英文で問題生成するボタン（英文解釈モード用） */}
          {result.sentences && result.sentences.length > 0 && onStartQuiz !== undefined && (
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
              この英文で問題生成する
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

        {/* 開発者支援セクション */}
        <DeveloperSupport />
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

  // 英文解釈モードかどうかを判定
  const hasEnglishLearningData = history.sentences && history.sentences.length > 0;
  const hasMarkedText = history.marked_text;
  const hasChunks = history.chunks && history.chunks.length > 0;

  // デバッグ用ログ（開発時のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('TranslationHistoryItem - history data:', {
      hasSentences: !!history.sentences,
      sentencesLength: history.sentences?.length || 0,
      hasMarkedText: !!history.marked_text,
      hasChunks: !!history.chunks,
      chunksLength: history.chunks?.length || 0,
    });
  }

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
      
      {/* 英文解釈モードの場合はスキャン時と同じビジュアルで表示 */}
      {hasEnglishLearningData ? (
        <div className="space-y-6">
          {/* 一文完結型のカードリスト表示 */}
          {history.sentences!.map((sentence, sentenceIndex) => (
            <SentenceCard
              key={`history-sentence-${sentenceIndex}-${sentence.marked_text?.substring(0, 20) || sentenceIndex}`}
              sentence={sentence}
              sentenceIndex={sentenceIndex}
            />
          ))}
          
          {/* 構造解析カードエリア（chunksがある場合） */}
          {hasChunks && (() => {
            const chunks = history.chunks!;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <h2 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎓</span>
                  構造解析（ビジュアル英文解釈）
                </h2>
                
                {/* 横スクロールカード */}
                <div className="overflow-x-auto pb-4 -mx-4 px-4">
                  <div className="flex gap-4 min-w-max">
                    {chunks.map((chunk, index) => {
                      const role = chunk.role || chunk.type || 'M';
                      const chunkText = chunk.chunk_text || chunk.text || '';
                      const chunkTranslation = chunk.chunk_translation || chunk.translation || '';
                      const elementInfo = ELEMENT_TYPES[role as keyof typeof ELEMENT_TYPES];
                      
                      // 記号タイプの判定とGRAMMAR_TYPESの取得
                      let grammarType: keyof typeof GRAMMAR_TYPES | null = null;
                      const isModifier = role === 'M';

                      if (chunk.symbol === '()') grammarType = 'adj_clause';
                      else if (isModifier || chunk.symbol === '<>') grammarType = 'adv_clause';
                      else if (chunk.symbol === '[]') grammarType = 'noun_clause';
                      else if (role === 'V') grammarType = 'verb_phrase';
                      
                      const grammarInfo = grammarType ? GRAMMAR_TYPES[grammarType] : null;
                      
                      // 記号付きテキストの生成（統一ロジック）
                      const getSymbolDisplay = () => {
                        if (grammarType === 'noun_clause') return `[ ${chunkText} ]`;
                        if (grammarType === 'adv_clause') return `< ${chunkText} >`;
                        if (grammarType === 'adj_clause') return `( ${chunkText} )`;
                        return chunkText;
                      };
                      
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex-shrink-0 w-80 rounded-xl shadow-lg ${
                            grammarInfo ? grammarInfo.color : 'bg-gray-50 border-gray-200'
                          } border-2 overflow-hidden`}
                        >
                          {/* ヘッダー: GRAMMAR_TYPESのsymbolとtitle */}
                          {grammarInfo && (
                            <div className={`px-4 py-3 border-b-2 ${grammarInfo.color.split(' ')[2] || 'border-gray-200'}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold">{grammarInfo.symbol}</span>
                                <span className="font-bold text-sm">{grammarInfo.title}</span>
                              </div>
                            </div>
                          )}
                          
                          <div className="p-4">
                            {/* チャンク番号 */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-500">
                                {index + 1} / {chunks.length}
                              </span>
                              {/* 役割バッジ */}
                              {elementInfo && (
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  role === 'S' ? 'bg-green-100 text-green-800' :
                                  role === 'V' ? 'bg-red-100 text-red-800' :
                                  role === 'O' ? 'bg-yellow-100 text-yellow-800' :
                                  role === 'C' ? 'bg-purple-100 text-purple-800' :
                                  role === 'M' ? 'bg-cyan-100 text-cyan-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {elementInfo.title}
                                </span>
                              )}
                            </div>
                            
                            {/* メインテキスト: チャンクのテキスト（記号付き） */}
                            <div className="mb-3">
                              <p className="text-gray-800 font-bold text-lg leading-relaxed">
                                {getSymbolDisplay()}
                              </p>
                            </div>
                            
                            {/* 直読日本語訳 */}
                            {chunkTranslation && (
                              <div className="mb-3 pt-3 border-t border-gray-200">
                                <p className="text-gray-600 text-sm leading-relaxed">
                                  {chunkTranslation}
                                </p>
                              </div>
                            )}
                            
                            {/* 解説 */}
                            {chunk.explanation && (
                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-gray-500 text-xs leading-relaxed">
                                  💡 {chunk.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      ) : hasMarkedText ? (
        // marked_textがある場合（旧形式の英文解釈）
        <div className="space-y-4">
          {/* 記号付き原文 */}
          <div>
            <h3 className="text-sm font-bold text-blue-400 mb-2">記号付き原文</h3>
            <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/50 overflow-x-auto">
              <MarkedTextParser text={history.marked_text!} />
            </div>
          </div>
          {/* 全文和訳 */}
          {history.japanese_translation && (
            <div>
              <h3 className="text-sm font-bold text-emerald-400 mb-2">全文和訳</h3>
              <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/50">
                <p className="text-white whitespace-pre-wrap leading-relaxed">
                  {history.japanese_translation}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        // 通常の翻訳モード（簡素な表示）
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
      )}
    </div>
  );
};

// ===== Helper Components =====

/**
 * 役割ごとの配色定義
 */
const getColorClass = (role: string | null): string => {
  if (!role) return 'text-gray-300';
  
  // ダッシュ付きの役割も同じ色を使用（従属節内）
  const baseRole = role.replace("'", '');
  
  const colorMap: Record<string, string> = {
    'S': 'text-blue-700 bg-blue-50 border-blue-200',
    'V': 'text-red-700 bg-red-50 border-red-200',
    'O': 'text-green-700 bg-green-50 border-green-200',
    'C': 'text-green-700 bg-green-50 border-green-200',
    'M': 'text-gray-600 bg-gray-50 border-gray-200',
    'Conn': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  };
  
  return colorMap[baseRole] || colorMap[role] || 'text-gray-300 bg-gray-50 border-gray-200';
};

/**
 * 役割ラベルの定義
 */
const getRoleLabel = (role: string | null): string => {
  if (!role) return '';
  
  const labelMap: Record<string, string> = {
    'S': 'S (主語)',
    'V': 'V (動詞)',
    'O': 'O (目的語)',
    'C': 'C (補語)',
    'M': 'M (修飾語)',
    'Conn': '接続詞',
    // 従属節内の役割（ダッシュ付き）
    "S'": "S' (主語・従属節内)",
    "V'": "V' (動詞・従属節内)",
    "O'": "O' (目的語・従属節内)",
    "C'": "C' (補語・従属節内)",
    "M'": "M' (修飾語・従属節内)",
  };
  
  return labelMap[role] || role;
};

/**
 * SentenceCard - 一文のカードコンポーネント（memo化で再描画を最適化）
 */
const SentenceCard = memo(({ 
  sentence, 
  sentenceIndex 
}: { 
  sentence: any;
  sentenceIndex: number;
}) => {
  // 従属節の検出: marked_textに[ ]、()、<>で囲まれた部分があるかチェック
  const hasSubordinateClause = (text: string): boolean => {
    if (!text) return false;
    // [ ]、()、<>で囲まれた部分を検出
    const clausePatterns = [
      /\[[^\]]+\]/g,  // [名詞節]
      /\([^)]+\)/g,   // (形容詞節)
      /<[^>]+>/g      // <副詞節>
    ];
    return clausePatterns.some(pattern => pattern.test(text));
  };

  const hasSubStructures = sentence.sub_structures && sentence.sub_structures.length > 0;
  const hasClauses = hasSubordinateClause(sentence.marked_text || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sentenceIndex * 0.1 }}
      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
    >
      {/* 上段：ビジュアル英文（ルビ表示） */}
      <div className="mb-4">
        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/50 overflow-x-auto">
          <MarkedTextParser 
            text={sentence.marked_text || ''} 
            onChunkClick={(index) => {
              console.log('Chunk clicked:', sentenceIndex, index);
            }}
          />
        </div>
      </div>

      {/* 中段：日本語訳（強調表示） */}
      <div className="mb-4">
        <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/50">
          <p className="text-white text-lg font-medium leading-relaxed">
            {sentence.translation || ''}
          </p>
        </div>
      </div>

      {/* ズームイン解析エリア（アコーディオン） */}
      {/* 従属節がある場合、またはsub_structuresが存在する場合に表示 */}
      {(hasSubStructures || hasClauses) && (
        <ZoomInAccordion 
          subStructures={sentence.sub_structures || []} 
          hasClausesButNoStructures={hasClauses && !hasSubStructures}
        />
      )}

      {/* 詳しい説明エリア（名詞節・wh節などのアコーディオン） */}
      {sentence.structure_explanations && sentence.structure_explanations.length > 0 && (
        <StructureExplanationsAccordion explanations={sentence.structure_explanations} />
      )}

      {/* 高度な文法解説エリア（アコーディオン） */}
      {sentence.advanced_grammar_explanation && (
        <AdvancedGrammarAccordion explanation={sentence.advanced_grammar_explanation} />
      )}

      {/* 下段：語句・熟語リスト */}
      {sentence.vocab_list && sentence.vocab_list.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-yellow-400 mb-2">重要語句</h3>
          <div className="bg-gray-50/10 rounded-lg p-3 space-y-2">
            {sentence.vocab_list.map((vocab: any, vocabIndex: number) => {
              // イディオムデータベース（説明のみ）
              const idiomDatabase: Record<string, string> = {
                'break the ice': '緊張した雰囲気を和らげることを意味します。',
                'hit the nail on the head': '物事の核心を正確に捉えることを表します。',
                'once in a blue moon': '非常に稀な出来事を表します。',
                'the ball is in your court': '次の行動は相手次第という意味です。',
                'bite the bullet': '困難に耐えることを意味します。',
                'piece of cake': 'とても簡単なことを表します。',
                'under the weather': '体調が悪いことを意味します。',
                'spill the beans': '秘密を漏らすことを意味します。',
                'cost an arm and a leg': '非常に高価であることを表します。',
                'break a leg': '頑張って（幸運を祈る）という意味です。',
                'let the cat out of the bag': '秘密を漏らすことを意味します。',
                'kill two birds with one stone': '一つの行動で二つの目的を達成することを表します。',
                'the last straw': '我慢の限界を表します。',
                'when pigs fly': '絶対に起こらないことを表します。',
                'raining cats and dogs': '土砂降りを意味します。',
                'keep up with': '同じペースで進む、遅れを取らないという意味。',
                'take advantage of': '機会や状況を上手く利用することを表します。',
                'come up with': 'アイデアや解決策を考え出すことを意味します。',
                'look forward to': '将来の出来事を楽しみに待つことを表します。',
                'get along with': '人と友好的な関係を築くことを意味します。',
                'deal with': '問題や状況に対応することを表します。',
                'put up with': '不快な状況や人を耐え忍ぶことを意味します。',
                'run out of': '在庫や時間などが尽きることを表します。',
                'give up': '努力をやめる、断念することを意味します。',
                'look after': '人や物の面倒を見ることを表します。',
              };
              
              const vocabWord = (vocab.word || '').toLowerCase().trim();
              const isIdiom = idiomDatabase[vocabWord] !== undefined;
              const idiomExplanation = isIdiom ? idiomDatabase[vocabWord] : null;
              
              return (
                <div key={`vocab-${vocabIndex}-${vocab.word || vocabIndex}`} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-300 font-bold text-sm min-w-[120px]">
                      {vocab.word || ''}
                    </span>
                    <span className="text-gray-300 text-sm flex-1">
                      {vocab.meaning || ''}
                    </span>
                  </div>
                  {/* イディオムの説明 */}
                  {isIdiom && idiomExplanation && (
                    <div className="ml-[124px] mt-1 p-2 bg-purple-900/20 rounded-lg border border-purple-700/50">
                      <p className="text-purple-200 text-xs">💡 {idiomExplanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ワンポイント文法解説 */}
      {sentence.grammar_note && (
        <div className="mt-3">
          <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/50">
            <p className="text-purple-200 text-sm leading-relaxed">
              💡 {sentence.grammar_note}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}, (prev, next) => {
  // 完了した文は再レンダリングしない（marked_textが同じなら再描画しない）
  return prev.sentence.marked_text === next.sentence.marked_text &&
         prev.sentence.translation === next.sentence.translation;
});

SentenceCard.displayName = 'SentenceCard';

/**
 * MarkedTextParser - ルビ方式の表示コンポーネント（memo化で再描画を最適化）
 * 例: "[Many scientists]<{S}> believe<{V}> [that food production]<{O}> will not keep up<{V}>."
 */
const MarkedTextParser = memo(({ 
  text, 
  onChunkClick 
}: { 
  text: string;
  onChunkClick?: (index: number) => void;
}) => {
  if (!text) {
    return <div className="text-white font-mono text-lg">No text available</div>;
  }
  
  // パース: <{role:attribute:meaning}>タグで分割（3要素対応）
  const chunks: Array<{ text: string; role: string | null; attribute: string | null; meaning: string | null }> = [];
  const tagPattern = /<\{([^}]+)\}>/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tagPattern.exec(text)) !== null) {
    // タグの前のテキスト（役割を持つ）
    const textWithRole = text.substring(lastIndex, match.index);
    if (textWithRole.trim()) {
      // 役割・属性・意味を分割（コロン区切り、最大3要素）
      const tagContent = match[1];
      const parts = tagContent.split(':').map(s => s.trim());
      const role = parts[0] || null;
      const attribute = parts[1] && parts[1] !== '_' ? parts[1] : null;
      const meaning = parts[2] || null;
      
      chunks.push({ 
        text: textWithRole.trim(), 
        role: role || null,
        attribute: attribute || null,
        meaning: meaning || null
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 最後のタグの後の残りのテキスト（役割なし）
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    if (remaining.trim()) {
      chunks.push({ text: remaining.trim(), role: null, attribute: null, meaning: null });
    }
  }
  
  // タグがない場合はそのまま表示
  if (chunks.length === 0) {
    return <div className="text-white font-mono text-lg whitespace-pre-wrap">{text}</div>;
  }
  
  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-4 leading-relaxed font-mono">
      {chunks.map((chunk, index) => {
        const uniqueKey = `chunk-${index}-${chunk.text?.substring(0, 10) || index}`;
        
        if (!chunk.role) {
          // 役割がない部分（句読点など）
          return (
            <span key={uniqueKey} className="text-white text-lg">
              {chunk.text || ''}
            </span>
          );
        }
        
        // 役割があるチャンク（クリック可能）
        return (
          <button
            key={uniqueKey}
            onClick={() => onChunkClick?.(index)}
            className="flex flex-col items-center mx-1 mb-4 group cursor-pointer hover:bg-gray-800/30 rounded px-2 py-1 transition-colors"
          >
            {/* 1. 英文チャンク */}
            <span className={`${getColorClass(chunk.role)} font-medium px-2 py-1 rounded border text-lg`}>
              {chunk.text || ''}
            </span>
            
            {/* 2. 直読日本語訳（重要！） */}
            {chunk.meaning && (
              <span className="text-sm font-bold text-gray-800 mt-1 whitespace-nowrap bg-white/90 px-2 py-0.5 rounded">
                {chunk.meaning}
              </span>
            )}
            
            {/* 3. 役割・文法 */}
            <div className="flex gap-1 mt-0.5 items-center">
              <span className="text-[10px] font-bold text-gray-500">
                {getRoleLabel(chunk.role)}
              </span>
              {chunk.attribute && (
                <span className="text-[10px] bg-gray-100 px-1 rounded border border-gray-300 text-gray-600">
                  {chunk.attribute}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});

MarkedTextParser.displayName = 'MarkedTextParser';

/**
 * ZoomInAccordion - ズームイン解析のアコーディオンコンポーネント
 */
const ZoomInAccordion = memo(({ 
  subStructures, 
  hasClausesButNoStructures = false 
}: { 
  subStructures: Array<{ target_chunk?: string; analyzed_text?: string }>;
  hasClausesButNoStructures?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-blue-900/20 hover:bg-blue-900/30 rounded-lg border border-blue-700/30 transition-colors"
      >
        <span className="text-sm font-bold text-blue-300 flex items-center gap-2">
          <span>🔍</span>
          <span>詳しい構造（ズームイン）</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-blue-300" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-blue-50/10 rounded-lg p-4 border border-blue-700/30 space-y-4 mt-2">
              {subStructures.length > 0 ? (
                subStructures.map((subStruct: any, subIndex: number) => (
                  <div 
                    key={`substruct-${subIndex}-${subStruct.target_chunk?.substring(0, 20) || subIndex}`} 
                    className="space-y-3"
                  >
                    {/* 節の説明ヘッダー */}
                    <div className="flex items-start gap-2">
                      <span className="text-blue-300 text-sm font-bold">📋</span>
                      <div className="flex-1">
                        <p className="text-xs text-blue-400 font-semibold mb-1">
                          この節の中身の構造（S'/V'/O'/C'/M'）
                        </p>
                        <p className="text-sm text-blue-200 font-mono bg-blue-900/30 rounded px-2 py-1 border border-blue-700/50">
                          {subStruct.target_chunk || ''}
                        </p>
                      </div>
                    </div>
                    
                    {/* 解析結果 */}
                    <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/50 overflow-x-auto">
                      <div className="mb-2">
                        <p className="text-xs text-blue-400 font-semibold mb-1">
                          ⚠️ 注意: S'/V'/O'/C'/M'は節の中の要素です（メインのS/V/O/C/Mとは区別）
                        </p>
                      </div>
                      <MarkedTextParser 
                        text={subStruct.analyzed_text || ''} 
                        onChunkClick={() => {}}
                      />
                    </div>
                  </div>
                ))
              ) : hasClausesButNoStructures ? (
                <div className="text-center py-4">
                  <p className="text-blue-300 text-sm mb-2">
                    📝 この文には従属節が含まれています
                  </p>
                  <p className="text-blue-400 text-xs">
                    詳細な構造解析は準備中です。節の構造は上部の記号付き原文で確認できます。
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ZoomInAccordion.displayName = 'ZoomInAccordion';

/**
 * StructureExplanationsAccordion - 名詞節・wh節などの詳しい説明をアコーディオンで表示
 */
const StructureExplanationsAccordion = memo(({ 
  explanations 
}: { 
  explanations: Array<{ 
    target_text: string; 
    explanation: string; 
    difficulty_level?: 'easy' | 'medium' | 'hard' 
  }> 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // 難易度に応じた色とラベル
  const getDifficultyBadge = (level?: 'easy' | 'medium' | 'hard') => {
    if (!level) return null;
    
    const badges = {
      easy: { label: '初級', color: 'bg-green-500/20 text-green-300 border-green-500/50' },
      medium: { label: '中級', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
      hard: { label: '上級', color: 'bg-red-500/20 text-red-300 border-red-500/50' },
    };
    
    const badge = badges[level];
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-indigo-900/20 hover:bg-indigo-900/30 rounded-lg border border-indigo-700/30 transition-colors"
      >
        <span className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <span>📖</span>
          <span>詳しい説明（名詞節・wh節など）</span>
          <span className="text-xs font-normal text-indigo-400">
            ({explanations.length}件)
          </span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-indigo-300" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-50/10 rounded-lg p-4 border border-indigo-700/30 space-y-4 mt-2">
              {explanations.map((explanation, index) => (
                <div 
                  key={`explanation-${index}-${explanation.target_text?.substring(0, 20) || index}`} 
                  className="space-y-2"
                >
                  {/* 説明対象のテキスト */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-indigo-400 font-semibold mb-1">説明対象</p>
                      <p className="text-sm text-indigo-200 font-mono bg-indigo-900/30 rounded px-2 py-1 border border-indigo-700/50">
                        {explanation.target_text || ''}
                      </p>
                    </div>
                    {/* 難易度バッジ */}
                    {explanation.difficulty_level && (
                      <div className="flex-shrink-0 pt-5">
                        {getDifficultyBadge(explanation.difficulty_level)}
                      </div>
                    )}
                  </div>
                  
                  {/* 詳しい説明 */}
                  <div>
                    <p className="text-xs text-indigo-400 font-semibold mb-1">解説</p>
                    <p className="text-sm text-white leading-relaxed bg-indigo-900/20 rounded px-3 py-2 border border-indigo-700/30">
                      {explanation.explanation || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

StructureExplanationsAccordion.displayName = 'StructureExplanationsAccordion';

/**
 * AdvancedGrammarAccordion - 高度な文法解説をアコーディオンで表示
 * 名詞節・WH節・倒置・関係詞の非制限用法などの複雑な構文の包括的な解説を表示
 */
const AdvancedGrammarAccordion = memo(({ 
  explanation 
}: { 
  explanation: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-violet-900/20 hover:bg-violet-900/30 rounded-lg border border-violet-700/30 transition-colors"
      >
        <span className="text-sm font-bold text-violet-300 flex items-center gap-2">
          <span>🔍</span>
          <span>詳しい文法解説を見る</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-violet-300" />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-violet-50/10 rounded-lg p-4 border border-violet-700/30 mt-2">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-violet-300 text-lg">📚</span>
                  <div className="flex-1">
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                      {explanation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AdvancedGrammarAccordion.displayName = 'AdvancedGrammarAccordion';

export default TranslationResultScreen;