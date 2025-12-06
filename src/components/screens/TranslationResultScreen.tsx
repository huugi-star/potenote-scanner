/**
 * TranslationResultScreen.tsx
 * 翻訳結果画面
 * 伊藤メソッド（構造解析）を主軸に、詳細情報はズームインに統合したシンプル版
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronDown } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult } from '@/types';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';

// ===== Types =====

interface TranslationResultScreenProps {
  result: TranslationResult;
  onBack: () => void;
  onStartQuiz?: () => void;
  imageUrl?: string;
}

// ===== Main Component =====

export const TranslationResultScreen = ({
  result,
  onBack,
  onStartQuiz,
  imageUrl,
}: TranslationResultScreenProps) => {
  const saveTranslationHistory = useGameStore(state => state.saveTranslationHistory);
  const translationHistory = useGameStore(state => state.translationHistory);
  
  const hasSavedRef = useRef(false);
  
  // 翻訳結果の自動保存
  useEffect(() => {
    if (hasSavedRef.current) return;
    
    let originalText = result.originalText || '';
    let translatedText = result.translatedText || '';
    
    if (result.sentences && result.sentences.length > 0) {
      originalText = result.sentences.map(s => s.marked_text || '').join(' ').trim();
      translatedText = result.sentences.map(s => s.translation || '').join(' ').trim();
      
      if (!originalText && result.marked_text) originalText = result.marked_text;
      if (!translatedText && result.japanese_translation) translatedText = result.japanese_translation;
    }
    
    if (!originalText || !translatedText) return;
    
    const isDuplicate = translationHistory.some(
      (history) =>
        history.originalText === originalText &&
        history.translatedText === translatedText
    );
    
    if (!isDuplicate) {
      const resultToSave: TranslationResult = { ...result, originalText, translatedText };
      saveTranslationHistory(resultToSave, imageUrl);
      hasSavedRef.current = true;
    }
  }, [result, imageUrl, saveTranslationHistory, translationHistory]);

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
            className="mb-6"
          >
            <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700/50">
              <h2 className="text-yellow-400 font-bold mb-2 text-sm flex items-center gap-2">
                <span className="text-lg">📋</span> 要約
              </h2>
              <p className="text-yellow-100 whitespace-pre-wrap leading-relaxed text-base">
                {result.summary}
              </p>
            </div>
          </motion.div>
        )}

        {/* メイン：一文完結型のカードリスト表示 */}
        {result.sentences && result.sentences.length > 0 ? (
          <div className="space-y-6">
            {result.sentences.map((sentence, sentenceIndex) => (
              <SentenceCard
                key={`sentence-${sentenceIndex}`}
                sentence={sentence}
                sentenceIndex={sentenceIndex}
              />
            ))}
          </div>
        ) : (
          /* 旧形式（フォールバック） */
          <>
            {result.marked_text && (
              <div className="mb-6 bg-blue-900/20 rounded-xl p-6 border border-blue-700/50 overflow-x-auto">
                  <MarkedTextParser text={result.marked_text} />
                </div>
            )}
            {result.japanese_translation && (
              <div className="mb-6 bg-emerald-900/20 rounded-xl p-5 border border-emerald-700/50">
                  <p className="text-white whitespace-pre-wrap leading-relaxed text-lg">
                    {result.japanese_translation}
                  </p>
                </div>
            )}
          </>
        )}

        {/* フッターアクション */}
        <div className="mt-8 space-y-3">
          {result.sentences && result.sentences.length > 0 && onStartQuiz && (
            <motion.button
              onClick={() => { vibrateLight(); onStartQuiz(); }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl">📚</span>
              この英文で問題生成する
            </motion.button>
          )}
          
          <motion.button
            onClick={() => { vibrateLight(); onBack(); }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Home className="w-5 h-5" />
            ホームへ戻る
          </motion.button>
        </div>

        <DeveloperSupport />
      </div>
    </div>
  );
};

// ===== Sub Components =====

/**
 * SentenceCard - 一文のカードコンポーネント
 * シンプル化：構造解析（伊藤メソッド）を最優先表示し、詳細は全てアコーディオンへ
 */
const SentenceCard = memo(({ 
  sentence, 
  sentenceIndex 
}: { 
  sentence: any;
  sentenceIndex: number;
}) => {
  // データの有無チェック
  const hasSubStructures = sentence.sub_structures && sentence.sub_structures.length > 0;
  const hasStructureExplanations = sentence.structure_explanations && sentence.structure_explanations.length > 0;
  const hasAdvancedGrammar = !!sentence.advanced_grammar_explanation;
  
  // いずれかの詳細データがあればズームインボタンを表示
  const shouldShowZoomIn = hasSubStructures || hasStructureExplanations || hasAdvancedGrammar;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sentenceIndex * 0.1 }}
      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700"
    >
      {/* 1. ビジュアル英文（伊藤メソッド：構造の可視化） */}
      <div className="mb-4">
        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/50 overflow-x-auto">
          <MarkedTextParser 
            text={sentence.marked_text || ''} 
          />
        </div>
      </div>

      {/* 2. 日本語訳 */}
      <div className="mb-4">
        <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-700/50">
          <p className="text-white text-lg font-medium leading-relaxed">
            {sentence.translation || ''}
          </p>
        </div>
      </div>

      {/* 3. ズームイン解析（すべての詳細情報はここに統合） */}
      {shouldShowZoomIn && (
        <ZoomInAccordion 
          subStructures={sentence.sub_structures || []}
          structureExplanations={sentence.structure_explanations || []}
          advancedGrammar={sentence.advanced_grammar_explanation}
        />
      )}

      {/* 4. 重要語句（シンプル表示） */}
      {sentence.vocab_list && sentence.vocab_list.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 font-bold mb-2">重要語句</p>
          <div className="flex flex-wrap gap-2">
            {sentence.vocab_list.map((vocab: any, i: number) => (
              <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                <span className="text-yellow-200 font-bold mr-1">{vocab.word}</span>
                {vocab.meaning}
                    </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. ワンポイント（控えめに） */}
      {sentence.grammar_note && (
        <div className="mt-3">
          <p className="text-purple-300 text-xs leading-relaxed">
              💡 {sentence.grammar_note}
            </p>
        </div>
      )}
    </motion.div>
  );
}, (prev, next) => {
  return prev.sentence.marked_text === next.sentence.marked_text;
});

SentenceCard.displayName = 'SentenceCard';

/**
 * ZoomInAccordion - 統合された詳細表示コンポーネント
 * 構造解析、詳しい解説、発展文法をすべてここに集約
 */
const ZoomInAccordion = memo(({ 
  subStructures,
  structureExplanations,
  advancedGrammar
}: { 
  subStructures: any[];
  structureExplanations: any[];
  advancedGrammar?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-blue-900/20 hover:bg-blue-900/30 rounded-lg border border-blue-700/30 transition-colors group"
      >
        <span className="text-sm font-bold text-blue-300 flex items-center gap-2">
          <span>🔍</span>
          <span>詳しい構造と解説を見る</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-blue-300 group-hover:text-white transition-colors" />
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
            <div className="bg-blue-50/10 rounded-lg p-4 border border-blue-700/30 space-y-6 mt-2">
              
              {/* A. 構造解析（S'/V'などの入れ子構造） */}
              {subStructures.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-blue-300 border-b border-blue-500/30 pb-1">
                    📋 構造解析（入れ子構造）
                  </h4>
                  {subStructures.map((subStruct: any, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-xs text-blue-200 font-mono bg-blue-900/40 inline-block px-2 py-1 rounded">
                        {subStruct.target_chunk}
                      </p>
                      <div className="bg-gray-900/40 rounded p-3 border border-blue-500/20 overflow-x-auto">
                        <MarkedTextParser text={subStruct.analyzed_text || ''} />
                      </div>
                      {subStruct.explanation && (
                        <p className="text-sm text-gray-300 pl-2 border-l-2 border-blue-500/50">
                          {subStruct.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* B. 詳しい文法解説（初心者向け） */}
              {structureExplanations.length > 0 && (
                <div className="space-y-3">
                   <h4 className="text-xs font-bold text-green-300 border-b border-green-500/30 pb-1">
                    📖 詳しい解説
                  </h4>
                  {structureExplanations.map((exp: any, idx: number) => (
                    <div key={idx} className="bg-green-900/10 rounded p-3 border border-green-500/20">
                      <p className="text-xs text-green-200 mb-1 font-bold">{exp.target_text}</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{exp.explanation}</p>
                    </div>
                  ))}
                  </div>
              )}

              {/* C. 発展的な文法解説（上級者向け・統合済み） */}
              {advancedGrammar && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-violet-300 border-b border-violet-500/30 pb-1">
                    🎓 発展的な文法知識
                  </h4>
                  <div className="bg-violet-900/10 rounded p-3 border border-violet-500/20">
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {advancedGrammar}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ZoomInAccordion.displayName = 'ZoomInAccordion';

/**
 * MarkedTextParser
 * 英文のビジュアル解析（伊藤メソッドの核）を担当
 */
const MarkedTextParser = memo(({ text }: { text: string }) => {
  if (!text) return <span className="text-gray-500">No text</span>;
  
  // Chunking logic (simplified for brevity, keeps original logic)
  const chunks: Array<{ text: string; role: string | null; meaning: string | null }> = [];
  const tagPattern = /<\{([^}]+)\}>/g;
  let lastIndex = 0;
  let match;
  
  while ((match = tagPattern.exec(text)) !== null) {
    const textPart = text.substring(lastIndex, match.index);
    if (textPart.trim()) {
      const content = match[1].split(':');
      chunks.push({ 
        text: textPart.trim(), 
        role: content[0] || null, 
        meaning: content[2] || null 
      });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    const rest = text.substring(lastIndex).trim();
    if (rest) chunks.push({ text: rest, role: null, meaning: null });
  }

  // Helper for colors
  const getColor = (role: string | null) => {
    if (!role) return 'text-white';
    const r = role.replace("'", '').toUpperCase();
    if (r === 'S') return 'text-blue-300 border-blue-500/50 bg-blue-500/10';
    if (r === 'V') return 'text-red-300 border-red-500/50 bg-red-500/10';
    if (r === 'O') return 'text-green-300 border-green-500/50 bg-green-500/10';
    if (r === 'C') return 'text-green-300 border-green-500/50 bg-green-500/10'; // Oと同じ系統
    if (r === 'M') return 'text-cyan-300 border-cyan-500/50 bg-cyan-500/10';
    if (r === 'CONN') return 'text-yellow-300 border-yellow-500/50 bg-yellow-500/10';
    return 'text-gray-300 border-gray-600 bg-gray-800';
  };

  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-3 font-mono leading-relaxed">
      {chunks.map((chunk, i) => {
        const hasRole = !!chunk.role;
        return (
          <div key={i} className="flex flex-col items-center group relative">
            {/* 英文パーツ */}
            <span className={`text-lg px-2 py-0.5 rounded border ${hasRole ? getColor(chunk.role) : 'border-transparent text-white'}`}>
              {chunk.text}
            </span>
            
            {/* 役割ラベル（S, V, O...） */}
            {hasRole && (
              <span className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">
                {chunk.role}
              </span>
            )}

            {/* 意味（ホバーまたは常時表示も可だが、シンプルさ優先でツールチップ的配置も考慮） */}
            {chunk.meaning && (
              <span className="text-[10px] text-emerald-400 font-bold bg-gray-900/80 px-1.5 py-0.5 rounded absolute -top-5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {chunk.meaning}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

MarkedTextParser.displayName = 'MarkedTextParser';

export default TranslationResultScreen;