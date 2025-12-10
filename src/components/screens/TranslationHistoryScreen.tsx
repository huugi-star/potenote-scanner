/**
 * TranslationHistoryScreen.tsx
 * 
 * 翻訳履歴一覧画面
 * 過去に翻訳した内容を一覧表示し、削除できる
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Trash2, ChevronLeft, ChevronDown } from 'lucide-react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationHistory, SentenceResult } from '@/types';
import { GRAMMAR_TYPES, ELEMENT_TYPES } from '@/consts/grammarDefinitions';

// ===== Types =====

interface TranslationHistoryScreenProps {
  onBack: () => void;
}

// ===== Helper Functions =====

const getColorClass = (role: string | null): string => {
  if (!role) return 'text-white';
  switch (role.toUpperCase()) {
    case 'S': return 'bg-green-700 text-white border-green-800';
    case 'V': return 'bg-red-700 text-white border-red-800';
    case 'O': return 'bg-yellow-700 text-white border-yellow-800';
    case 'C': return 'bg-purple-700 text-white border-purple-800';
    case 'M': return 'bg-cyan-700 text-white border-cyan-800';
    case 'CONN': return 'bg-gray-600 text-white border-gray-700';
    default: return 'bg-gray-600 text-white border-gray-700';
  }
};

const getRoleLabel = (role: string | null): string => {
  if (!role) return '';
  switch (role.toUpperCase()) {
    case 'S': return '主語';
    case 'V': return '動詞';
    case 'O': return '目的語';
    case 'C': return '補語';
    case 'M': return '修飾語';
    case 'CONN': return '接続詞';
    default: return role;
  }
};

// 文オブジェクトから表示用の原文を取得（フォールバック付き）
const getSentenceSourceText = (sentence: any): string => {
  if (!sentence) return '';
  if (sentence.marked_text) return sentence.marked_text;
  if (sentence.original_text) return sentence.original_text;
  if (sentence.originalText) return sentence.originalText;
  if (sentence.original) return sentence.original;
  if (sentence.text) return sentence.text;
  if (Array.isArray(sentence.chunks)) {
    const joined = sentence.chunks.map((c: any) => c?.text ?? '').filter(Boolean).join(' ');
    if (joined.trim()) return joined.trim();
  }
  return '';
};

// ===== Sub Components =====

/**
 * MarkedTextParser - ルビ方式の表示コンポーネント
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
const ZoomInAccordion = memo(({ subStructures }: { subStructures: Array<{ target_chunk?: string; analyzed_text?: string }> }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-600 transition-colors"
      >
        <span className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <span>🔍</span>
          <span>詳しい構造（ズームイン）</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
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
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-600 space-y-3 mt-2">
              {subStructures.map((subStruct: any, subIndex: number) => (
                <div key={`substruct-${subIndex}-${subStruct.target_chunk?.substring(0, 20) || subIndex}`} className="space-y-2">
                  <div className="text-xs text-gray-400 font-mono">
                    {subStruct.target_chunk || ''}
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3 border border-gray-600 overflow-x-auto">
                    <MarkedTextParser 
                      text={subStruct.analyzed_text || ''} 
                      onChunkClick={() => {}}
                    />
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

ZoomInAccordion.displayName = 'ZoomInAccordion';

/**
 * SentenceCard - 一文完結型のカードコンポーネント
 */
const SentenceCard = memo(({ 
  sentence, 
  sentenceIndex 
}: { 
  sentence: SentenceResult;
  sentenceIndex: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sentenceIndex * 0.1 }}
      className="bg-gray-700 rounded-lg p-4 border border-gray-600"
    >
      {/* 上段：ビジュアル英文（ルビ表示） */}
      <div className="mb-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-600 overflow-x-auto">
          <MarkedTextParser 
            text={getSentenceSourceText(sentence)} 
            onChunkClick={(index) => {
              console.log('Chunk clicked:', sentenceIndex, index);
            }}
          />
        </div>
      </div>

      {/* 中段：日本語訳（強調表示） */}
      <div className="mb-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
          <p className="text-gray-200 text-base font-medium leading-relaxed">
            {sentence.translation || ''}
          </p>
        </div>
      </div>

      {/* ズームイン解析エリア（アコーディオン） */}
      {sentence.sub_structures && sentence.sub_structures.length > 0 && (
        <ZoomInAccordion subStructures={sentence.sub_structures} />
      )}

      {/* 下段：語句・熟語リスト */}
      {sentence.vocab_list && sentence.vocab_list.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-300 mb-2">重要語句</h3>
          <div className="bg-gray-800 rounded-lg p-3 space-y-2 border border-gray-600">
            {sentence.vocab_list.map((vocab: any, vocabIndex: number) => (
              <div key={`vocab-${vocabIndex}-${vocab.word || vocabIndex}`} className="flex items-start gap-2">
                <span className="text-gray-300 font-bold text-sm min-w-[120px]">
                  {vocab.word || ''}
                </span>
                <span className="text-gray-400 text-sm">
                  {vocab.meaning || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ワンポイント文法解説 */}
      {sentence.grammar_note && (
        <div className="mt-3">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
            <p className="text-gray-400 text-sm leading-relaxed">
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
 * TranslationHistoryItem - 履歴アイテムコンポーネント
 */
const TranslationHistoryItem = ({ history, onDelete }: { history: TranslationHistory; onDelete: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // プレビューテキスト（2行程度）
  const getPreviewText = () => {
    if (hasEnglishLearningData && history.sentences && history.sentences.length > 0) {
      const firstSentence = history.sentences[0];
      const preview = firstSentence.translation || getSentenceSourceText(firstSentence) || '';
      return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }
    if (hasMarkedText) {
      const preview = history.marked_text || '';
      return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }
    return history.translatedText.length > 100 ? history.translatedText.substring(0, 100) + '...' : history.translatedText;
  };

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
      
      {/* プレビュー表示（常に表示） */}
      <div className="space-y-2 mb-3">
        <div className="text-sm text-gray-300 line-clamp-2">
          {history.originalText.length > 100 ? history.originalText.substring(0, 100) + '...' : history.originalText}
        </div>
        <div className="text-sm text-gray-400 line-clamp-2">
          {getPreviewText()}
        </div>
      </div>

      {/* 展開/折りたたみボタン */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 text-gray-400 hover:text-gray-300 transition-colors"
      >
        <span className="text-xs">{isExpanded ? '折りたたむ' : '詳細を見る'}</span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* 詳細表示（展開時のみ） */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-3 pt-3 border-t border-gray-700"
          >
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
                    <div className="mt-6">
                      <h2 className="text-base font-bold text-gray-300 mb-4 flex items-center gap-2">
                        <span className="text-xl">🎓</span>
                        構造解析
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
                            if (chunk.symbol === '[]') grammarType = 'noun_clause';
                            else if (chunk.symbol === '()') grammarType = 'adj_clause';
                            else if (chunk.symbol === '<>') grammarType = 'adv_clause';
                            else if (role === 'V') grammarType = 'verb_phrase';
                            
                            const grammarInfo = grammarType ? GRAMMAR_TYPES[grammarType] : null;
                            
                            // 記号付きテキストの生成
                            const getSymbolDisplay = () => {
                              if (chunk.symbol === '[]') return `[ ${chunkText} ]`;
                              if (chunk.symbol === '<>') return `< ${chunkText} >`;
                              if (chunk.symbol === '()') return `( ${chunkText} )`;
                              return chunkText;
                            };
                            
                            return (
                              <div
                                key={index}
                                className={`flex-shrink-0 w-80 rounded-lg shadow-md bg-gray-700 border border-gray-600 overflow-hidden`}
                              >
                                {/* ヘッダー: GRAMMAR_TYPESのsymbolとtitle */}
                                {grammarInfo && (
                                  <div className="px-4 py-2 border-b border-gray-600 bg-gray-800">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl font-bold text-gray-300">{grammarInfo.symbol}</span>
                                      <span className="font-bold text-sm text-gray-300">{grammarInfo.title}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="p-4 bg-gray-700">
                                  {/* チャンク番号 */}
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-400">
                                      {index + 1} / {chunks.length}
                                    </span>
                                    {/* 役割バッジ */}
                                    {elementInfo && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        role === 'S' ? 'bg-gray-600 text-gray-200' :
                                        role === 'V' ? 'bg-gray-600 text-gray-200' :
                                        role === 'O' ? 'bg-gray-600 text-gray-200' :
                                        role === 'C' ? 'bg-gray-600 text-gray-200' :
                                        role === 'M' ? 'bg-gray-600 text-gray-200' :
                                        'bg-gray-600 text-gray-200'
                                      }`}>
                                        {elementInfo.title}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* メインテキスト: チャンクのテキスト（記号付き） */}
                                  <div className="mb-3">
                                    <p className="text-gray-200 font-bold text-base leading-relaxed">
                                      {getSymbolDisplay()}
                                    </p>
                                  </div>
                                  
                                  {/* 直読日本語訳 */}
                                  {chunkTranslation && (
                                    <div className="mb-3 pt-3 border-t border-gray-600">
                                      <p className="text-gray-400 text-sm leading-relaxed">
                                        {chunkTranslation}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* 解説 */}
                                  {chunk.explanation && (
                                    <div className="pt-3 border-t border-gray-600">
                                      <p className="text-gray-500 text-xs leading-relaxed">
                                        💡 {chunk.explanation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : hasMarkedText ? (
              // marked_textがある場合（旧形式の英文解釈）
              <div className="space-y-4">
                {/* 記号付き原文 */}
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-2">記号付き原文</h3>
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 overflow-x-auto">
                    <MarkedTextParser text={history.marked_text || history.originalText || ''} />
                  </div>
                </div>
                {/* 全文和訳 */}
                {history.japanese_translation && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-300 mb-2">全文和訳</h3>
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {history.japanese_translation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // 通常の翻訳モード（簡素な表示）
              <div className="space-y-3 pt-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">原文</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {history.originalText}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">翻訳文</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {history.translatedText}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ===== Main Component =====

export const TranslationHistoryScreen = ({
  onBack,
}: TranslationHistoryScreenProps) => {
  const translationHistory = useGameStore(state => state.translationHistory);
  const deleteTranslationHistory = useGameStore(state => state.deleteTranslationHistory);

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
              >
                <TranslationHistoryItem
                  history={history}
                  onDelete={() => {
                    vibrateLight();
                    if (confirm('この翻訳履歴を削除しますか？')) {
                      deleteTranslationHistory(history.id);
                    }
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationHistoryScreen;
