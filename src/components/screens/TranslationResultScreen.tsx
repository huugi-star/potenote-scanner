/**
 * TranslationResultScreen.tsx
 * 英文構造を3段で可視化する結果画面
 * 英文・和訳・役割解説を「縦3段」のブロックで積み上げ、左から右へ読むスタイル
 */

import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ChevronDown, BookOpen } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { TranslationResult } from '@/types';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';
import { AdsModal } from '@/components/ui/AdsModal';
import { getAffiliateByMode } from '@/utils/affiliate';

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
  const [showAdsModal, setShowAdsModal] = useState(false);
  const [tipShown, setTipShown] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [fullTextOpen, setFullTextOpen] = useState(false);
  const saveTranslationHistory = useGameStore(state => state.saveTranslationHistory);
  const addCoins = useGameStore(state => state.addCoins);
  const affiliateMode = useGameStore(state => state.englishLearningMode);
  const translationHistory = useGameStore(state => state.translationHistory);
  const hasSavedRef = useRef(false);
  const baseRewardGivenRef = useRef(false);
  const adRewardGivenRef = useRef(false);
  const [affiliateImages, setAffiliateImages] = useState<Record<string, string>>({});

  // 自動保存
  useEffect(() => {
    if (hasSavedRef.current) return;
    
    // 英文解釈モードの場合
    if (result.sentences && result.sentences.length > 0) {
      const originalText = result.sentences
        .map((s: any) => s.marked_text ?? s.original_text ?? s.originalText ?? s.original ?? '')
        .filter(Boolean)
        .join(' ');
      const translatedText = result.sentences
        .map((s: any) => s.translation ?? s.full_translation ?? '')
        .filter(Boolean)
        .join(' ');
      const isDuplicate = translationHistory.some(h => h.originalText === originalText && h.translatedText === translatedText);
      
      if (!isDuplicate) {
        saveTranslationHistory({ ...result, originalText, translatedText }, imageUrl);
        hasSavedRef.current = true;
      }
    }
    // 多言語モードの場合
    else if (result.translatedText && result.originalText) {
      const isDuplicate = translationHistory.some(h => h.originalText === result.originalText);
      
      if (!isDuplicate) {
        saveTranslationHistory(result, imageUrl);
        hasSavedRef.current = true;
      }
    }
  }, [result, imageUrl, saveTranslationHistory, translationHistory]);

  // 多言語モードかどうかを判定
  const isMultilangMode = !result.sentences && result.translatedText && result.originalText;
  const fullEnglishText = useMemo(() => {
    if (result.clean_text && result.clean_text.trim()) return result.clean_text.trim();
    if (!result.sentences || result.sentences.length === 0) return '';
    return result.sentences
      .map((s: any) => s.marked_text ?? s.original_text ?? s.originalText ?? s.original ?? s.text ?? '')
      .filter(Boolean)
      .join('\n\n');
  }, [result.sentences, result.clean_text]);

  // アフィリエイト推薦（モードと英文量で判定、毎回ランダム2件）
  const affiliatePick = useMemo(() => {
    if (isMultilangMode) return null;
    return getAffiliateByMode(fullEnglishText, affiliateMode);
  }, [affiliateMode, fullEnglishText, isMultilangMode]);

  // 楽天画像フェッチ
  useEffect(() => {
    const fetchImages = async () => {
      if (!affiliatePick) return;
      const entries = await Promise.all(
        affiliatePick.items.map(async (item) => {
          try {
            const res = await fetch(`/api/rakuten-items?keyword=${encodeURIComponent(item.title)}&hits=1`);
            if (!res.ok) return [item.title, ''] as const;
            const data = await res.json();
            const first = data.items?.[0];
            const img = first?.mediumImageUrls?.[0] || '';
            return [item.title, img] as const;
          } catch {
            return [item.title, ''] as const;
          }
        })
      );
      const map: Record<string, string> = {};
      entries.forEach(([title, img]) => { map[title] = img; });
      setAffiliateImages(map);
    };
    fetchImages();
  }, [affiliatePick]);

  // 英文解釈モード報酬付与（ベース3コイン）
  useEffect(() => {
    if (isMultilangMode) return;
    if (!result.sentences || result.sentences.length === 0) return;
    if (baseRewardGivenRef.current) return;
    addCoins(3);
    baseRewardGivenRef.current = true;
  }, [addCoins, isMultilangMode, result.sentences]);

  const handleAdRewardClaim = () => {
    if (adRewardGivenRef.current) return;
    addCoins(3); // ベース3枚を倍にするため、追加で+3
    adRewardGivenRef.current = true;
    setShowAdsModal(false);
  };

  return (
    <>
      <div className="min-h-screen bg-[#1a1b26] p-4 pb-24 font-sans text-gray-100">
        <div className="max-w-4xl mx-auto space-y-8">
        
        {/* ヘッダー */}
        <header className="flex items-center gap-3 border-b border-gray-700 pb-4">
          <div className={`p-2 rounded-lg shadow-lg ${isMultilangMode ? 'bg-green-600 shadow-green-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">
              {isMultilangMode ? '多言語翻訳結果' : '英文構造解析'}
            </h1>
            <p className="text-xs text-gray-400">
              {isMultilangMode ? '自然な日本語に翻訳しました' : '直読直解で構造を理解する'}
            </p>
          </div>
        </header>

        {/* 全文表示（スキャンした英文の完全なテキスト） */}
        {!isMultilangMode && fullEnglishText && (
          <div className="border border-indigo-500/30 bg-indigo-900/10 rounded-xl overflow-hidden">
            <button
              onClick={() => { vibrateLight(); setFullTextOpen(o => !o); }}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-indigo-100 font-semibold"
            >
              <span>📄 スキャンした英文（全文）</span>
              <motion.div animate={{ rotate: fullTextOpen ? 180 : 0 }}>
                <ChevronDown className="w-5 h-5 text-indigo-200" />
              </motion.div>
            </button>
            <AnimatePresence>
              {fullTextOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4">
                    <p className="text-gray-100 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                      {fullEnglishText}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* カバレッジ警告: 元英文の単語が解析結果に含まれていない場合 */}
        {result.missing_tokens && result.missing_tokens.length > 0 && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-900/20 px-4 py-3">
            <p className="text-amber-200 font-bold text-sm mb-1">⚠️ 解析結果に含まれていない単語があります</p>
            <p className="text-amber-200/90 text-xs mb-2">元の英文にあった以下の単語が、構造解析のチャンクに含まれていません。OCRや後処理で欠落している可能性があります。</p>
            <p className="text-amber-300 font-mono text-xs break-words">
              {result.missing_tokens.slice(0, 20).join(", ")}
              {result.missing_tokens.length > 20 && ` …他${result.missing_tokens.length - 20}語`}
            </p>
          </div>
        )}

        {/* 英文解釈モード用 注意書き＆記号の読み方 */}
        {!isMultilangMode && (
          <div className="space-y-3">
            <div className="border border-indigo-500/30 bg-indigo-900/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setNoticeOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-indigo-100 font-semibold"
              >
                <span>⚠️ AI解析との向き合い方</span>
                <motion.div animate={{ rotate: noticeOpen ? 180 : 0 }}>
                  <ChevronDown className="w-5 h-5 text-indigo-200" />
                </motion.div>
              </button>
              <AnimatePresence>
                {noticeOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 text-sm text-indigo-100 space-y-3"
                  >
                    <p>このモードは教科書的な正解を覚える場所ではありません。AIというパートナー相手の「打ち込み稽古」です。</p>
                    <p className="text-indigo-200/90">※AIは時折ミスをしますが、あえて修正せず流れを止めずに読み切り、後から違和感を振り返ることで「突破力」を鍛えてください。</p>
                    <div className="space-y-2">
                      <p className="font-bold">習得すべき三つの型</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>壱ノ型：塊（チャンク）読み — 単語ではなく意味の塊で捉え、リズムよく左→右で読む。</li>
                        <li>弐ノ型：返り読み禁止 — 量をこなし、直読直解を続けることで脳に文法リズムを刻む。</li>
                        <li>奥義：【予測の呼吸】 — Sの次はV、接続詞の次は節…という英語の呼吸を体に染み込ませる。</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border border-indigo-500/30 bg-indigo-900/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setSymbolsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-indigo-100 font-semibold"
              >
<span>🔍 記号と構造の読み方</span>
              <motion.div animate={{ rotate: symbolsOpen ? 180 : 0 }}>
                <ChevronDown className="w-5 h-5 text-indigo-200" />
              </motion.div>
            </button>
            <AnimatePresence>
              {symbolsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 text-sm text-indigo-100 space-y-3"
                >
                  <div>
                    <p className="font-bold text-indigo-100 mb-1">1. 文の骨組み （SVOC）＋ M（修飾）— 場所で役割が決まる</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">S</span> (主人公)：「〜は」</p>
                    <p className="text-indigo-200/90">
                      <span className="text-red-300 font-bold">S'</span> (真主語)：Sのあとに出てくる「本当の主語」。<br />　（長い主語を後ろに回すとき使われる）<br />
                      　It や There が文頭にあるとき、後ろに本当の主語（S'）が現れることがある。
                    </p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">V</span> (結論)：「〜する」 — ここが最重要。Vの後ろを見て O か C かを予測。</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">O</span> (ターゲット)：「〜を」 (S ≠ O)</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">C</span> (イコール)：「〜だ」 (S ＝ C)</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">M</span> (修飾)：文の背景。なくても文は成立する</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-bold text-indigo-100 mb-1">2. 記号のルール</p>
                    <p className="text-indigo-200/90">【　】：文の骨組み（主役）— 絶対に省けない「誰が・何を」などメインパーツ</p>
                    <p className="text-indigo-200/90">（　）：名詞のお飾り（説明）— 直前の【名詞】を詳しく説明するアクセサリー</p>
                    <p className="text-indigo-200/90">＜　＞：文の背景（おまけ）— 「いつ・どこで・なぜ」等の補足。骨組みにはならない</p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-indigo-100 mb-1">3. 基本の5文型 — Vが後ろの形を決める</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">SV</span>：「SがVする」（一番シンプルな形）</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">SVC</span>：「SはCだ」（S ＝ C）</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">SVO</span>：「SがOをVする」（Oに動作が向かう）</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">SVOO</span>：「Sが O(誰か)に O(何か)を Vする」（あげる・伝える）</p>
                    <p className="text-indigo-200/90"><span className="text-red-300 font-bold">SVOC</span>：「Sは OをCのままに Vする / O＝Cだと Vする」（O ＝ C）</p>
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 多言語モードの表示 */}
        {isMultilangMode ? (
          <MultilangTranslationView result={result} />
        ) : result.sentences && result.sentences.length > 0 ? (
          <div className="space-y-6 md:space-y-10">
            {result.sentences.map((sentence, index) => (
              <VisualSentenceCard 
                key={index} 
                sentence={sentence} 
                index={index} 
                tipShown={tipShown}
                setTipShown={setTipShown}
              />
            ))}

            {/* 全文相談ボタン */}
            <div className="mt-4">
              <FullConsultButton
                fullText={fullEnglishText}
                tipShown={tipShown}
                setTipShown={setTipShown}
              />
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-10">
            データが見つかりません。
          </div>
        )}

        {/* フッター */}
        <div className="pt-8 space-y-4">
            {/* おすすめ教材（英文解釈モードのみ表示） */}
            {!isMultilangMode && affiliatePick && (
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-900/20 p-4 space-y-3">
                <h3 className="text-sm font-bold text-indigo-100">{affiliatePick.title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {affiliatePick.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                      <div className="w-full aspect-[3/2] bg-gray-900 relative">
                        {affiliateImages[item.title] ? (
                          <img
                            src={affiliateImages[item.title]}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Loading...</div>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="text-sm text-white line-clamp-2 min-h-[2.5rem]">{item.title}</div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200"
                        >
                          楽天で見る &gt;
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* 英文解釈モード: 報酬＆広告ボタン（フッターに配置） */}
          {!isMultilangMode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <div className="text-amber-200 font-bold text-sm">獲得報酬</div>
                <div className="text-amber-300 font-extrabold text-lg">コイン 3 枚</div>
              </div>
              <motion.button
                onClick={() => { vibrateLight(); setShowAdsModal(true); }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                コインを2倍にする
              </motion.button>
            </div>
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
      {/* 広告視聴モーダル（コイン2倍） */}
      <AdsModal
        isOpen={showAdsModal}
        onClose={() => setShowAdsModal(false)}
        adType="coin_doubler"
        onRewardClaimed={handleAdRewardClaim}
      />
    </>
  );
};

// ===== Core Components =====

/**
 * VisualSentenceCard
 * 1つの文を表示するカードコンポーネント
 */
const VisualSentenceCard = memo(({ sentence, index, tipShown, setTipShown }: { sentence: any, index: number, tipShown: boolean, setTipShown: (v: boolean) => void }) => {
  const [subOpen, setSubOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);
  const [vocabOpen, setVocabOpen] = useState(false);
  // 詳細データがあるか判定（新しい構造と後方互換性）
  const hasDetails = (sentence.sub_structures && sentence.sub_structures.length > 0) || 
                     (sentence.structure_explanations && sentence.structure_explanations.length > 0) ||
                     (sentence.advanced_grammar_explanation);

  const originalSentence = sentence.marked_text ?? sentence.original_text ?? sentence.originalText ?? sentence.original ?? '';
  const focusChunk = (sentence.main_structure && sentence.main_structure.length > 0
    ? sentence.main_structure[0]
    : (sentence.chunks && sentence.chunks.length > 0 ? sentence.chunks[0] : null));
  const targetText = focusChunk?.text ?? originalSentence ?? '';
  const currentRole = focusChunk?.role ?? '未指定';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#24283b] rounded-2xl border border-gray-700 overflow-hidden shadow-xl"
    >
      {/* 1. ビジュアル解析エリア（メイン） */}
      <div className="p-4 md:p-6 bg-[#1f2335] border-b border-gray-700">
        <div className="mb-4 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-700 text-gray-300">
            Sentence {index + 1}
          </span>
          <div className="ml-auto">
            <ExternalConsultButton
              target={targetText}
              sentence={originalSentence}
              currentRole={currentRole}
              tipShown={tipShown}
              setTipShown={setTipShown}
            />
          </div>
        </div>
        
        {/* ここに3段構成のチャンク表示を配置 */}
        {sentence.main_structure ? (
          // main_structureデータがある場合（新しい構造）
          <div className="flex flex-wrap justify-start items-baseline gap-2 md:gap-6">
            {sentence.main_structure.map((chunk: any, i: number) => (
              <ItoChunkCard 
                key={i} 
                chunk={chunk} 
                isSub={false} 
              />
            ))}
          </div>
        ) : sentence.chunks ? (
          // chunksデータがある場合（後方互換性）
          <div className="flex flex-wrap justify-start items-baseline gap-2 md:gap-6">
            {sentence.chunks.map((chunk: any, i: number) => (
              <ItoChunkCard 
                key={i} 
                chunk={chunk} 
                isSub={false} 
              />
            ))}
          </div>
        ) : (
          // chunksがない場合は original_text / marked_text をそのまま表示
          <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">
            {originalSentence || sentence.marked_text || '（解析データなし）'}
          </p>
        )}
      </div>

      {/* 2. 自然な和訳（折りたたみ・タップで開く） */}
      <div className="border-t border-gray-700 bg-[#1e1e2e]">
        <button
          onClick={() => { vibrateLight(); setTranslationOpen(o => !o); }}
          className="w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-green-900/10 hover:bg-green-900/20 transition-colors"
        >
          <div className="flex items-center gap-2 text-green-200 font-bold text-sm">
            <span className="text-lg">📝</span>
            <span>訳</span>
          </div>
          <motion.div animate={{ rotate: translationOpen ? 180 : 0 }}>
            <ChevronDown className="w-5 h-5 text-green-300" />
          </motion.div>
        </button>
        <AnimatePresence>
          {translationOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 md:px-6 py-3 md:py-4 bg-[#24283b]">
                <p className="text-base md:text-lg text-gray-100 leading-relaxed font-medium">
                  {sentence.full_translation || sentence.translation}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. 重要語句（折りたたみ・タップで開く） */}
      <div className="border-t border-gray-700 bg-[#1e1e2e]">
        <button
          onClick={() => { vibrateLight(); setVocabOpen(o => !o); }}
          className="w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-yellow-900/10 hover:bg-yellow-900/20 transition-colors"
        >
          <div className="flex items-center gap-2 text-yellow-200 font-bold text-sm">
            <span className="text-lg">📚</span>
            <span>Vocabulary</span>
          </div>
          <motion.div animate={{ rotate: vocabOpen ? 180 : 0 }}>
            <ChevronDown className="w-5 h-5 text-yellow-300" />
          </motion.div>
        </button>
        <AnimatePresence>
          {vocabOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 md:px-6 py-3 md:py-4 bg-[#24283b]">
                {sentence.vocab_list && sentence.vocab_list.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sentence.vocab_list.map((vocab: any, i: number) => (
                      <div key={i} className="inline-flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-700">
                        <span className="text-slate-300 font-semibold text-sm">{vocab.word}</span>
                        <span className="text-gray-400 text-xs border-l border-gray-600 pl-2">{vocab.meaning}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">語句なし</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. ズームイン解析（sub_structures） */}
      {sentence.sub_structures && sentence.sub_structures.length > 0 && (
        <div className="border-t border-gray-700 bg-[#1e1e2e]">
          <button
            onClick={() => { vibrateLight(); setSubOpen(o => !o); }}
            className="w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-blue-900/10 hover:bg-blue-900/20 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-200 font-bold text-sm">
              <span className="text-lg">🔍</span>
              <span>ズームイン解析（節の内部構造）</span>
            </div>
            <motion.div animate={{ rotate: subOpen ? 180 : 0 }}>
              <ChevronDown className="w-5 h-5 text-blue-300" />
            </motion.div>
          </button>
          <AnimatePresence>
            {subOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {sentence.sub_structures.map((sub: any, subIndex: number) => (
                    <div key={subIndex} className="bg-[#24283b] rounded-lg p-3 md:p-4 border border-gray-700">
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">解析対象:</div>
                        <div className="text-sm font-mono text-gray-200">{sub.target_text}</div>
                      </div>
                      {sub.explanation && (
                        <div className="mb-3 text-sm text-gray-300 leading-relaxed">
                          {sub.explanation}
                        </div>
                      )}
                      <div className="flex flex-wrap justify-start items-baseline gap-2 md:gap-6 mt-4">
                        {sub.chunks && sub.chunks.map((chunk: any, chunkIndex: number) => (
                          <ItoChunkCard key={chunkIndex} chunk={chunk} isSub={true} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 5. 従来のズームイン（後方互換性） */}
      {hasDetails && !sentence.sub_structures && (
        <ZoomInAccordion 
          subStructures={sentence.sub_structures}
          structureExplanations={sentence.structure_explanations}
          explanation={sentence.advanced_grammar_explanation}
        />
      )}
    </motion.div>
  );
});

VisualSentenceCard.displayName = 'VisualSentenceCard';

// ===== External Consult Buttons =====

const ExternalConsultButton = ({ target: _target, sentence, currentRole: _currentRole, tipShown, setTipShown }: { target: string; sentence: string; currentRole: string; tipShown: boolean; setTipShown: (v: boolean) => void }) => {
  const [copied, setCopied] = useState(false);

  const consultPrompt = `
【英文】
${sentence}

【質問】
この文章の文法的な役割（S/V/O/C/M）と、なぜそうなるのかの理由を、初心者にもわかりやすく解説してください。
  `.trim();

  const handleConsult = async () => {
    try {
      await navigator.clipboard.writeText(consultPrompt);
      setCopied(true);
      if (!tipShown) {
        setTipShown(true);
        alert('プロンプトをコピーしました。ChatGPTが開いたらペーストしてください。');
      }
      setTimeout(() => {
        window.open('https://chatgpt.com/', '_blank');
        setCopied(false);
      }, 700);
    } catch (err) {
      alert('コピーに失敗しました');
    }
  };

  return (
    <button
      onClick={handleConsult}
      className="ml-2 w-8 h-8 inline-flex items-center justify-center rounded-full border border-indigo-400/60 bg-indigo-900/40 hover:bg-indigo-800/60 text-xs"
      title="外部AIに質問"
    >
      {copied ? '✅' : '🔍'}
    </button>
  );
};

const FullConsultButton = ({ fullText, tipShown, setTipShown }: { fullText: string; tipShown: boolean; setTipShown: (v: boolean) => void }) => {
  const [copied, setCopied] = useState(false);

  const prompt = `
以下の英文全体の構造分析と文法解説をお願いします。

【全文】
${fullText}

それぞれの文のS/V/O/C/Mを分解しながら、文章全体のつながりも説明してください。
初心者向けにゆっくり丁寧にお願いします。
  `.trim();

  const handleConsult = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (!tipShown) {
        setTipShown(true);
        alert('プロンプトをコピーしました。ChatGPTが開いたらペーストしてください。');
      }
      setTimeout(() => {
        window.open('https://chatgpt.com/', '_blank');
        setCopied(false);
      }, 700);
    } catch {
      alert('コピーに失敗しました');
    }
  };

  return (
    <button
      onClick={handleConsult}
      className="mt-6 w-full py-3 text-sm font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600"
    >
      {copied ? 'コピー完了！ChatGPTを開いてください' : '全文についてChatGPTに相談する'}
    </button>
  );
};

/**
 * VisualChunk
 * 3段構成でチャンクを表示するコンポーネント。
 * 1. 英文（色付きカード）
 * 2. 直訳（日本語）
 * 3. 役割解説（S/V/O...）
 */
// 共通チャンク表示コンポーネント（3段構成の徹底）。タップで直訳を表示
const ItoChunkCard = memo(({ chunk, isSub = false }: { chunk: any; isSub?: boolean }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  // bracketTypeまたはtypeから判定（後方互換性）
  const bracketType = chunk.bracketType || chunk.type || "other";

  // ブラケットの決定
  let leftB = "", rightB = "";
  let textColor = "text-gray-200";
  let roleColor = "text-gray-500";
  let borderColor = "border-transparent";

  // 記号ルール
  switch (bracketType) {
    case "noun": // S, O, C, s', o', c'
      leftB = "【"; rightB = "】";
      textColor = isSub ? "text-blue-200" : "text-white";
      borderColor = isSub ? "border-blue-400" : "border-blue-500"; // 名詞は青系
      roleColor = isSub ? "text-blue-200" : "text-blue-300";
      break;
    case "modifier": // M, m' - main_structureと同じ色（ズームインも統一）
      leftB = "＜"; rightB = "＞";
      textColor = "text-gray-300";
      borderColor = "border-yellow-600";
      roleColor = "text-yellow-500";
      break;
    case "verb": // V, v'
      leftB = ""; rightB = "";
      textColor = isSub ? "text-red-300" : "text-red-200 font-bold"; // 動詞は赤系・強調
      borderColor = isSub ? "border-red-400" : "border-red-500";
      roleColor = isSub ? "text-red-300" : "text-red-400";
      break;
    case "connector": // 接続詞
      leftB = "["; rightB = "]";
      textColor = "text-gray-400";
      borderColor = "border-gray-600";
      roleColor = "text-gray-400";
      break;
    case "other": // その他
      leftB = "["; rightB = "]";
      textColor = "text-gray-400";
      borderColor = "border-gray-600";
      roleColor = "text-gray-400";
      break;
    default:
      // フォールバック
      leftB = ""; rightB = "";
      textColor = "text-gray-200";
      borderColor = "border-gray-600";
  }

  const cleanTranslation = (chunk.translation || "").replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "");
  const hasTranslation = cleanTranslation.length > 0;
  // 長い節のみ改行許可（短いS/V/Oは絶対に改行しない）
  const isLongChunk = (chunk.text || "").length > 40;

  return (
    <button
      type="button"
      onClick={() => hasTranslation && (vibrateLight(), setShowTranslation((v) => !v))}
      className={`flex flex-col items-start shrink-0 w-fit max-w-full group text-left ${hasTranslation ? "cursor-pointer touch-manipulation" : "cursor-default"}`}
    >
      {/* 1段目：英文 (ブラケット付き) - 短いチャンクは改行禁止、長いチャンクのみ改行許可 */}
      <div className={`text-base md:text-xl px-2 py-1 border-b-2 ${borderColor} ${textColor} text-left ${isLongChunk ? "whitespace-normal break-words min-w-0" : "whitespace-nowrap"}`}>
        <span className="opacity-60 mr-1">{leftB}</span>
        {chunk.text}
        <span className="opacity-60 ml-1">{rightB}</span>
      </div>

      {/* 2段目：直訳 (タップで表示) */}
      {showTranslation && (
        <div className="mt-2 text-xs md:text-sm text-gray-300 font-medium max-w-[220px] text-left whitespace-normal break-words">
          {cleanTranslation}
        </div>
      )}
      {hasTranslation && !showTranslation && (
        <div className="mt-2 text-[10px] md:text-xs text-gray-500 text-left">タップで直訳を表示</div>
      )}

      {/* 3段目：文法役割 (S/V/O...) - CONJ/CONNは空欄表示（接続詞は文要素に含めない） */}
      <div className="mt-1 flex flex-col items-center min-h-[20px] md:min-h-[24px] self-center">
        {chunk.role !== "CONJ" && chunk.role !== "CONN" && (
          <div className={`text-[10px] md:text-sm font-bold ${roleColor} uppercase`}>
            {chunk.role}
          </div>
        )}
      </div>
    </button>
  );
});

ItoChunkCard.displayName = 'ItoChunkCard';

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
  // 長い節のみ改行許可（短いS/V/Oは絶対に改行しない）
  const isLongChunk = text.length > 40;
  
  // 色とラベルの決定
  const { colorClasses, label, description } = getChunkStyle(role, symbol, isNested);
  
  // 記号で囲む
  const displayText = formatTextWithSymbol(text, symbol, role);

  return (
    <div className="flex flex-col items-center shrink-0 w-fit max-w-full group">
      {/* 1段目: 英文カード - 短いチャンクは改行禁止、長いチャンクのみ改行許可 */}
      <div className={`
        relative px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-base md:text-lg font-bold font-mono text-left shadow-md transition-transform group-hover:scale-105
        ${isLongChunk ? "whitespace-normal break-words min-w-0" : "whitespace-nowrap"}
        ${isPunctuationOnly ? 'bg-transparent border-transparent' : `${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`} border-b-4
      `}>
        {displayText}
      </div>

      {/* 2段目: 直訳（句読点の場合は非表示） */}
      {!isPunctuationOnly && (
        <div className="mt-2 text-xs md:text-sm text-gray-300 font-medium text-left leading-tight px-1 whitespace-normal break-words">
          {translation || '...'}
        </div>
      )}

      {/* 3段目: 役割ラベル（句読点・CONJ/CONNの場合は非表示） - 中央配置 */}
      {!isPunctuationOnly && role && role !== "CONJ" && role !== "CONN" && (
        <div className="mt-1 flex flex-col items-center">
          {/* 線 */}
          <div className={`w-0.5 h-2 ${colorClasses.lineBg}`}></div>
          {/* 丸ラベル - スマホでは小さくPCでは読みやすく */}
          <div className={`
            px-2 py-0.5 rounded-full text-[10px] md:text-sm font-bold uppercase tracking-wider whitespace-nowrap
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
const ZoomInAccordion = ({ 
  subStructures, 
  structureExplanations,
  explanation 
}: { 
  subStructures?: any[], 
  structureExplanations?: any[],
  explanation?: string 
}) => {
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
              {subStructures && subStructures.length > 0 && (
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">📋 構造解析</h4>
                  {subStructures.map((item: any, idx: number) => (
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
              )}

              {/* 詳しい解説（名詞節・wh節など） */}
              {structureExplanations && structureExplanations.length > 0 && (
                <div className="space-y-4">
                  {(subStructures && subStructures.length > 0) || explanation ? (
                    <div className="border-t border-gray-700 pt-6"></div>
                  ) : null}
                  <h4 className="text-xs font-bold text-green-400 mb-3 uppercase tracking-wider">📖 詳しい解説（構造・解説）</h4>
                  {structureExplanations.map((exp: any, idx: number) => {
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
                      <div key={idx} className="bg-[#24283b] p-4 rounded-xl border border-green-500/20">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs text-green-200 font-mono bg-green-900/30 px-2 py-1 rounded">
                            {exp.target_text}
                          </p>
                          {exp.difficulty_level && (
                            <div className="flex-shrink-0">
                              {getDifficultyBadge(exp.difficulty_level)}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 leading-relaxed">
                          {exp.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
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
    <div className="flex flex-wrap justify-start items-baseline gap-2 md:gap-6">
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

  // 接続詞(CONJ/CONN)・関係詞(REL)の特別扱い - UIではラベルを空欄表示（文要素に含めない）
  if (r === 'CONN' || r === 'CONJ' || r === 'REL') {
    style = {
      bg: 'bg-yellow-900/40', text: 'text-yellow-200', border: 'border-yellow-600',
      lineBg: 'bg-yellow-600', labelBg: 'bg-yellow-600', labelText: 'text-yellow-950'
    };
    label = ''; // CONJ/CONNは空欄表示
    if (r === 'REL' && symbol === '[]') description = '名詞節';
    if (r === 'REL' && symbol === '<>') description = '副詞節';
    if (r === 'REL' && symbol === '()') description = '形容詞節';
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

// ===== Multilang Translation View =====

/**
 * MultilangTranslationView
 * 多言語翻訳モード用の表示コンポーネント
 */
const MultilangTranslationView = ({ result }: { result: TranslationResult }) => {
  return (
    <div className="space-y-6">
      {/* 3行まとめ */}
      {result.summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-600/20 to-green-500/20 rounded-xl p-6 border border-green-500/30"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">📋</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-300 mb-2">3行まとめ</h3>
              <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">
                {result.summary}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 翻訳結果 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#24283b] rounded-xl p-6 border border-gray-700"
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">翻訳結果</span>
          {result.textType && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              result.textType === 'academic' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' :
              result.textType === 'email' ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
              result.textType === 'manual' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' :
              'bg-gray-500/20 text-gray-300 border border-gray-500/50'
            }`}>
              {result.textType === 'academic' ? '論文・契約書' :
               result.textType === 'email' ? 'メール・チャット' :
               result.textType === 'manual' ? 'マニュアル' : '一般記事'}
            </span>
          )}
          {result.tone && (
            <span className="text-xs text-gray-500">({result.tone})</span>
          )}
        </div>
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-100 leading-relaxed whitespace-pre-wrap">
            {result.translatedText}
          </p>
        </div>
      </motion.div>

      {/* 専門用語 */}
      {result.technicalTerms && result.technicalTerms.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#24283b] rounded-xl p-6 border border-gray-700"
        >
          <h3 className="text-lg font-bold text-yellow-300 mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>専門用語の補足説明</span>
          </h3>
          <div className="space-y-3">
            {result.technicalTerms.map((term, index) => (
              <div key={index} className="bg-[#1a1b26] rounded-lg p-4 border border-gray-600">
                <div className="font-bold text-yellow-200 mb-1">{term.term}</div>
                <div className="text-sm text-gray-300">{term.explanation}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 原文 */}
      {result.originalText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1a1b26] rounded-xl p-6 border border-gray-700"
        >
          <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">原文</h3>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap font-mono text-sm">
            {result.originalText}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default TranslationResultScreen;