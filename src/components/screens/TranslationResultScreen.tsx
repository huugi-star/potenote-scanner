/**
 * TranslationResultScreen.tsx
 * 伊藤メソッド（直読直解）完全ビジュアル版
 * 英文・和訳・役割解説を「縦3段」のブロックで積み上げ、左から右へ読むスタイル
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronDown, BookOpen } from 'lucide-react';
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

  // 自動保存
  useEffect(() => {
    if (hasSavedRef.current) return;
    if (result.sentences && result.sentences.length > 0) {
      const originalText = result.sentences.map(s => s.marked_text).join(' ');
      const translatedText = result.sentences.map(s => s.translation).join(' ');
      const isDuplicate = translationHistory.some(h => h.originalText === originalText);
      
      if (!isDuplicate) {
        saveTranslationHistory({ ...result, originalText, translatedText }, imageUrl);
        hasSavedRef.current = true;
      }
    }
  }, [result, imageUrl, saveTranslationHistory, translationHistory]);

  return (
    <div className="min-h-screen bg-[#1a1b26] p-4 pb-24 font-sans text-gray-100">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* ヘッダー */}
        <header className="flex items-center gap-3 border-b border-gray-700 pb-4">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">ビジュアル英文解釈</h1>
            <p className="text-xs text-gray-400">直読直解で構造を理解する</p>
          </div>
        </header>

        {/* センテンスリスト */}
        {result.sentences && result.sentences.length > 0 ? (
          <div className="space-y-10">
            {result.sentences.map((sentence, index) => (
              <VisualSentenceCard 
                key={index} 
                sentence={sentence} 
                index={index} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-10">
            データが見つかりません。
          </div>
        )}

        {/* フッター */}
        <div className="pt-8 space-y-3">
          {onStartQuiz && result.sentences && result.sentences.length > 0 && (
            <button
              onClick={() => { vibrateLight(); onStartQuiz(); }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
            >
              <BookOpen className="w-5 h-5" />
              この英文で問題生成する
            </button>
          )}
          <button
            onClick={() => { vibrateLight(); onBack(); }}
            className="w-full py-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-5 h-5" />
            ホームへ戻る
          </button>
        </div>

        <DeveloperSupport />
      </div>
    </div>
  );
};

// ===== Core Components =====

/**
 * VisualSentenceCard
 * 1つの文を表示するカードコンポーネント
 */
const VisualSentenceCard = memo(({ sentence, index }: { sentence: any, index: number }) => {
  // 詳細データがあるか判定
  const hasDetails = (sentence.sub_structures && sentence.sub_structures.length > 0) || 
                     (sentence.advanced_grammar_explanation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#24283b] rounded-2xl border border-gray-700 overflow-hidden shadow-xl"
    >
      {/* 1. ビジュアル解析エリア（メイン） */}
      <div className="p-6 bg-[#1f2335] border-b border-gray-700">
        <div className="mb-4 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
            Sentence {index + 1}
          </span>
        </div>
        
        {/* ここに伊藤メソッド（3段構成）を表示 */}
        {sentence.chunks ? (
          // chunksデータがある場合（推奨）
          <div className="flex flex-wrap items-start gap-x-2 gap-y-6">
            {sentence.chunks.map((chunk: any, i: number) => (
              <VisualChunk 
                key={i} 
                text={chunk.chunk_text || chunk.text}
                translation={chunk.chunk_translation || chunk.translation}
                role={chunk.role || chunk.type}
                symbol={chunk.symbol}
              />
            ))}
          </div>
        ) : (
          // chunksがない場合は marked_text から簡易パース
          <LegacyParser text={sentence.marked_text} />
        )}
      </div>

      {/* 2. 自然な和訳 */}
      <div className="p-5 bg-[#24283b] border-b border-gray-700/50">
        <div className="flex items-start gap-3">
          <span className="text-xl">🇯🇵</span>
          <p className="text-lg text-gray-100 leading-relaxed font-medium">
            {sentence.translation}
          </p>
        </div>
      </div>

      {/* 3. 重要語句 */}
      {sentence.vocab_list && sentence.vocab_list.length > 0 && (
        <div className="px-6 py-4 bg-[#24283b]">
          <h4 className="text-xs font-bold text-yellow-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <span>Vocabulary</span>
            <div className="h-px flex-1 bg-yellow-500/20"></div>
          </h4>
          <div className="flex flex-wrap gap-2">
            {sentence.vocab_list.map((vocab: any, i: number) => (
              <div key={i} className="inline-flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700">
                <span className="text-yellow-200 font-bold text-sm">{vocab.word}</span>
                <span className="text-gray-400 text-xs border-l border-gray-600 pl-2">{vocab.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ズームイン（詳しい説明） */}
      {hasDetails && (
        <ZoomInAccordion 
          subStructures={sentence.sub_structures}
          explanation={sentence.advanced_grammar_explanation}
        />
      )}
    </motion.div>
  );
});

VisualSentenceCard.displayName = 'VisualSentenceCard';

/**
 * VisualChunk
 * 伊藤メソッドの核心部品。
 * 1. 英文（色付きカード）
 * 2. 直訳（日本語）
 * 3. 役割解説（S/V/O...）
 * の3段構成で表示する。
 */
const VisualChunk = memo(({ 
  text, 
  translation, 
  role, 
  symbol,
  isNested = false 
}: { 
  text: string; 
  translation?: string; 
  role?: string; 
  symbol?: string;
  isNested?: boolean;
}) => {
  // 句読点のみの場合は解説を表示しない
  const isPunctuationOnly = /^[.,;:!?'"()\[\]{}<>\-—–\s]+$/.test(text.trim());
  
  // 色とラベルの決定
  const { colorClasses, label, description } = getChunkStyle(role, symbol, isNested);
  
  // 記号で囲む
  const displayText = formatTextWithSymbol(text, symbol, role);

  return (
    <div className="flex flex-col items-center group max-w-[280px]">
      {/* 1段目: 英文カード */}
      <div className={`
        relative px-3 py-2 rounded-lg text-lg font-bold font-mono text-center shadow-md transition-transform group-hover:scale-105
        ${isPunctuationOnly ? 'bg-transparent border-transparent' : `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`} border-b-4
      `}>
        {displayText}
      </div>

      {/* 2段目: 直訳（句読点の場合は非表示） */}
      {!isPunctuationOnly && (
        <div className="mt-2 text-sm text-gray-300 font-medium text-center leading-tight px-1">
          {translation || '...'}
        </div>
      )}

      {/* 3段目: 役割ラベル（句読点の場合は非表示） */}
      {!isPunctuationOnly && role && (
        <div className="mt-1 flex flex-col items-center">
          {/* 線 */}
          <div className={`w-0.5 h-2 ${colorClasses.lineBg}`}></div>
          {/* 丸ラベル */}
          <div className={`
            px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap
            ${colorClasses.labelBg} ${colorClasses.labelText}
          `}>
            {label}
            {description && <span className="ml-1 opacity-80 font-normal normal-case">({description})</span>}
          </div>
        </div>
      )}
    </div>
  );
});

VisualChunk.displayName = 'VisualChunk';

/**
 * ZoomInAccordion
 * 複雑な構文をビジュアル表示するためのエリア
 */
const ZoomInAccordion = ({ subStructures, explanation }: { subStructures?: any[], explanation?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-gray-700 bg-[#1e1e2e]">
      <button
        onClick={() => { vibrateLight(); setIsOpen(!isOpen); }}
        className="w-full flex items-center justify-between p-4 bg-blue-900/10 hover:bg-blue-900/20 transition-colors group"
      >
        <div className="flex items-center gap-2 text-blue-300 group-hover:text-blue-200 font-bold text-sm">
          <span className="text-lg">🔍</span>
          <span>詳しい説明（構造・解説）</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="w-5 h-5 text-blue-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-8">
              
              {/* 解説文 */}
              {explanation && (
                <div className="bg-[#24283b] p-4 rounded-xl border border-blue-500/20 shadow-inner">
                  <h4 className="text-xs font-bold text-blue-400 mb-2">💡 文法解説</h4>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {explanation}
                  </p>
                </div>
              )}

              {/* 構造解析（ビジュアル） */}
              {subStructures && subStructures.map((item: any, idx: number) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">
                      対象: {item.target_chunk}
                    </span>
                  </div>
                  
                  {/* ネストされたビジュアル解析エリア */}
                  <div className="bg-[#1a1b26] p-4 rounded-xl border border-gray-600 overflow-x-auto">
                    <p className="text-[10px] text-gray-500 mb-4 font-bold uppercase tracking-widest">
                      Inner Structure
                    </p>
                    <NestedStructureParser text={item.analyzed_text} />
                  </div>

                  {item.explanation && (
                    <p className="text-sm text-gray-400 pl-3 border-l-2 border-blue-500/50 italic">
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ===== Parsers & Helpers =====

/**
 * NestedStructureParser
 * ズームイン用のパーサー。文字列データから VisualChunk を生成する。
 */
const NestedStructureParser = ({ text }: { text: string }) => {
  if (!text) return null;
  const chunks: any[] = [];
  const regex = /([^<]+)<\{([^}]+)\}>|([^<]+)/g; // 簡易パース
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      // Roleあり
      const parts = match[2].split(':');
      chunks.push({ text: match[1].trim(), role: parts[0], translation: parts[2] || null });
    } else if (match[0].trim()) {
      // Roleなし
      const clean = match[0].replace(/<\{|\}>/g, '').trim();
      if (clean) chunks.push({ text: clean, role: null });
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-6">
      {chunks.map((chunk, i) => (
        <VisualChunk 
          key={i} 
          text={chunk.text} 
          translation={chunk.translation} // sub_structuresにも翻訳があれば表示
          role={chunk.role}
          isNested={true}
        />
      ))}
    </div>
  );
};

/**
 * LegacyParser
 * chunksデータがない場合のフォールバック（marked_textから表示）
 */
const LegacyParser = ({ text }: { text: string }) => {
  // NestedStructureParserと同じロジックでとりあえず表示
  return <NestedStructureParser text={text} />;
};

/**
 * テキストに記号を付与するヘルパー
 */
const formatTextWithSymbol = (text: string, symbol?: string, role?: string) => {
  // 既に記号がついている場合は除去してから付け直す
  const cleanText = text.replace(/^\[|\]$|^<|>$|^\(|\)$/g, '').trim();
  
  // 明示的なSymbol指定があればそれを使う
  if (symbol === '[]') return `[ ${cleanText} ]`;
  if (symbol === '<>') return `< ${cleanText} >`;
  if (symbol === '()') return `( ${cleanText} )`;
  
  // Roleに基づくデフォルト
  if (!role) return cleanText;
  const r = role.replace("'", '').toUpperCase();
  
  if (r === 'M' || r.includes('ADV')) return `< ${cleanText} >`; // 副詞的
  if (r === 'O' || r === 'S' || r === 'C') return `[ ${cleanText} ]`; // 名詞的
  
  return cleanText;
};

/**
 * 役割に応じたスタイルとラベル定義
 */
const getChunkStyle = (role: string | null = '', symbol?: string, isNested?: boolean) => {
  const r = (role || '').replace("'", '').toUpperCase();
  
  // デフォルト
  let style = {
    bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-600',
    lineBg: 'bg-gray-600', labelBg: 'bg-gray-700', labelText: 'text-gray-300'
  };
  let label = '';
  let description = '';

  // 接続詞・関係詞の特別扱い
  if (r === 'CONN' || r === 'REL') {
    style = {
      bg: 'bg-yellow-900/40', text: 'text-yellow-200', border: 'border-yellow-600',
      lineBg: 'bg-yellow-600', labelBg: 'bg-yellow-600', labelText: 'text-yellow-950'
    };
    label = '接続詞';
    if (symbol === '[]') description = '名詞節';
    if (symbol === '<>') description = '副詞節';
    if (symbol === '()') description = '形容詞節';
    return { colorClasses: style, label, description };
  }

  switch (r) {
    case 'S':
      style = {
        bg: 'bg-blue-900/40', text: 'text-blue-200', border: 'border-blue-500',
        lineBg: 'bg-blue-500', labelBg: 'bg-blue-500', labelText: 'text-white'
      };
      label = isNested ? "S'" : "S";
      description = isNested ? '主語・従属' : '主語';
      break;
    case 'V':
      style = {
        bg: 'bg-red-900/40', text: 'text-red-200', border: 'border-red-500',
        lineBg: 'bg-red-500', labelBg: 'bg-red-500', labelText: 'text-white'
      };
      label = isNested ? "V'" : "V";
      description = isNested ? '動詞・従属' : '動詞';
      break;
    case 'O':
      style = {
        bg: 'bg-emerald-900/40', text: 'text-emerald-200', border: 'border-emerald-500',
        lineBg: 'bg-emerald-500', labelBg: 'bg-emerald-500', labelText: 'text-white'
      };
      label = isNested ? "O'" : "O";
      description = isNested ? '目的語・従属' : '目的語';
      break;
    case 'C':
      style = {
        bg: 'bg-emerald-900/40', text: 'text-emerald-200', border: 'border-emerald-500',
        lineBg: 'bg-emerald-500', labelBg: 'bg-emerald-500', labelText: 'text-white'
      };
      label = isNested ? "C'" : "C";
      description = isNested ? '補語・従属' : '補語';
      break;
    case 'M':
      style = {
        bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-500',
        lineBg: 'bg-gray-500', labelBg: 'bg-gray-600', labelText: 'text-gray-300'
      };
      label = isNested ? "M'" : "M";
      description = '修飾語';
      break;
    default:
      // roleがない、または不明な場合
      if (!role) {
         return { colorClasses: style, label: '', description: '' };
      }
      label = role;
  }

  return { colorClasses: style, label, description };
};

export default TranslationResultScreen;