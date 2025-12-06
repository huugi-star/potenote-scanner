/**
 * TranslationResultScreen.tsx
 * 伊藤メソッド（ビジュアル英文解釈）完全準拠版
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronDown, BookOpen } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult } from '@/types';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';

// ===== Types & Interfaces =====

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
  imageUrl,
}: TranslationResultScreenProps) => {
  const saveTranslationHistory = useGameStore(state => state.saveTranslationHistory);
  const translationHistory = useGameStore(state => state.translationHistory);
  const hasSavedRef = useRef(false);

  // 自動保存ロジック（シンプル化）
  useEffect(() => {
    if (hasSavedRef.current) return;
    
    // データ整合性チェックと保存
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
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* ヘッダー */}
        <header className="flex items-center gap-3 border-b border-gray-700 pb-4">
          <div className="p-2 bg-blue-600 rounded-lg">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-wide">ビジュアル英文解釈</h1>
        </header>

        {/* センテンスリスト */}
        {result.sentences && result.sentences.length > 0 ? (
          <div className="space-y-8">
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
            解析データが見つかりません。再スキャンしてください。
          </div>
        )}

        {/* フッターアクション */}
        <div className="pt-8">
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
 * 伊藤メソッドに基づき、英文を構造的に表示するカード
 */
const VisualSentenceCard = memo(({ sentence, index }: { sentence: any, index: number }) => {
  // ズームインデータがあるか確認
  const hasDetails = (sentence.sub_structures && sentence.sub_structures.length > 0) || 
                     (sentence.advanced_grammar_explanation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#24283b] rounded-xl border border-gray-700 overflow-hidden shadow-lg"
    >
      {/* 1. 原文エリア（ビジュアル解析） */}
      <div className="p-6 border-b border-gray-700 bg-[#1f2335]">
        <div className="mb-2 text-xs text-gray-400 font-mono">Sentence {index + 1}</div>
        <ItoMethodParser text={sentence.marked_text || ''} />
      </div>

      {/* 2. 自然な和訳 */}
      <div className="p-6 bg-[#24283b]">
        <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2">
          <span>日本語訳</span>
          <div className="h-px flex-1 bg-emerald-400/20"></div>
        </h4>
        <p className="text-lg text-gray-200 leading-relaxed font-medium">
          {sentence.translation}
        </p>
      </div>

      {/* 3. 重要語句リスト */}
      {sentence.vocab_list && sentence.vocab_list.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-xs font-bold text-yellow-400 mb-3 flex items-center gap-2">
            <span>重要語句・イディオム</span>
            <div className="h-px flex-1 bg-yellow-400/20"></div>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sentence.vocab_list.map((vocab: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-yellow-200 font-bold min-w-[30%] break-words">
                  {vocab.word}
                </span>
                <span className="text-gray-400 flex-1">
                  {vocab.meaning}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 詳しい説明（アコーディオン） */}
      {hasDetails && (
        <DetailedExplanationAccordion 
          subStructures={sentence.sub_structures}
          explanation={sentence.advanced_grammar_explanation}
        />
      )}
    </motion.div>
  );
});

VisualSentenceCard.displayName = 'VisualSentenceCard';

/**
 * DetailedExplanationAccordion
 * 複雑な構文の「ズームイン解析」と「解説」を格納
 */
const DetailedExplanationAccordion = ({ subStructures, explanation }: { subStructures?: any[], explanation?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-gray-700 bg-[#1a1b26]/50">
      <button
        onClick={() => { vibrateLight(); setIsOpen(!isOpen); }}
        className="w-full flex items-center justify-between p-4 text-sm font-bold text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          🔍 詳しい説明（構造・解説）
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="w-5 h-5" />
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
            <div className="p-6 pt-0 space-y-6">
              {/* 解説テキスト */}
              {explanation && (
                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {explanation}
                  </p>
                </div>
              )}

              {/* ズームイン構造解析（ネストされたS'V'など） */}
              {subStructures && subStructures.map((item: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="text-xs text-gray-400 font-mono pl-1">
                    ▼ {item.target_chunk} の内部構造
                  </div>
                  <div className="p-4 bg-[#1f2335] rounded-lg border border-gray-600 overflow-x-auto">
                    {/* ここでも伊藤メソッドパーサーを再利用してビジュアル表示 */}
                    <ItoMethodParser text={item.analyzed_text} isNested={true} />
                  </div>
                  {item.explanation && (
                    <p className="text-sm text-gray-400 pl-2 border-l-2 border-gray-600">
                      💡 {item.explanation}
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

/**
 * ItoMethodParser
 * 核心となるコンポーネント。
 * テキストを「単語」と「記号（S/V/O/C/M）」の上下2段組みで表示する。
 */
const ItoMethodParser = memo(({ text, isNested = false }: { text: string, isNested?: boolean }) => {
  if (!text) return null;

  // チャンク分割ロジック
  // 例: "[Many people]<{S}>" -> text: "[Many people]", role: "S"
  const chunks: Array<{ text: string; role: string | null }> = [];
  const regex = /([^<]+)<\{([^}]+)\}>|([^<]+)/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      // タグ付き部分
      chunks.push({ text: match[1].trim(), role: match[2] });
    } else if (match[0].trim()) {
      // タグなし部分（接続詞や前置詞など、または解析外）
      // 不要な記号が混じらないようクリーニング
      const cleanText = match[0].replace(/<\{|\}>/g, '').trim();
      if (cleanText) chunks.push({ text: cleanText, role: null });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-6 leading-none font-mono">
      {chunks.map((chunk, i) => {
        const { style, label } = getRoleStyle(chunk.role);
        
        // 役割がない単語（接続詞など）
        if (!chunk.role) {
          return (
            <div key={i} className="pb-1 text-lg text-gray-300">
              {chunk.text}
            </div>
          );
        }

        // 役割があるチャンク（上下配置）
        return (
          <div key={i} className="flex flex-col items-center group">
            {/* 上段：英文テキスト（カッコ含む） */}
            <div className={`text-lg px-1 ${style.text} whitespace-nowrap`}>
              {chunk.text}
            </div>
            
            {/* 下段：役割ラベル（線付き） */}
            <div className="w-full flex flex-col items-center mt-1">
              {/* 線 */}
              <div className={`w-full h-[2px] ${style.line}`}></div>
              {/* ラベル (S, V, O...) */}
              <span className={`text-xs font-bold mt-1 ${style.label} uppercase`}>
                {isNested ? label.toLowerCase() : label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

ItoMethodParser.displayName = 'ItoMethodParser';

// ===== Helpers =====

/**
 * 役割に応じたスタイル定義
 * 伊藤メソッドの「赤(V)」「青(S)」などのイメージに合わせつつ、ダークモードで見やすく調整
 */
const getRoleStyle = (role: string | null) => {
  if (!role) return { 
    style: { text: 'text-gray-300', line: 'bg-transparent', label: 'text-transparent' }, 
    label: '' 
  };

  // ダッシュや小文字を正規化
  const r = role.replace("'", '').toUpperCase();
  const isNested = role.includes("'"); // ネスト判定用

  let styles = {
    text: 'text-gray-100',
    line: 'bg-gray-500',
    label: 'text-gray-400'
  };

  switch (r) {
    case 'S': // 主語：青系
      styles = { text: 'text-blue-300', line: 'bg-blue-500', label: 'text-blue-400' };
      break;
    case 'V': // 動詞：赤系
      styles = { text: 'text-red-300', line: 'bg-red-500', label: 'text-red-400' };
      break;
    case 'O': // 目的語：緑系
      styles = { text: 'text-emerald-300', line: 'bg-emerald-500', label: 'text-emerald-400' };
      break;
    case 'C': // 補語：緑/紫系
      styles = { text: 'text-emerald-300', line: 'bg-emerald-500', label: 'text-emerald-400' };
      break;
    case 'M': // 修飾語：黄色/グレー系（目立たせすぎない）
      styles = { text: 'text-gray-300', line: 'bg-yellow-600/50', label: 'text-yellow-600' };
      break;
    case 'CONN': // 接続詞
      styles = { text: 'text-gray-300', line: 'bg-gray-600', label: 'text-gray-500' };
      break;
  }

  return { style: styles, label: isNested ? role.toLowerCase() : role }; // 表示用ラベルは元のまま（s'など）返す
};