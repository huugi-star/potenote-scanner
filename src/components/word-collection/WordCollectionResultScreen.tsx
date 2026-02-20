/**
 * WordCollectionResultScreen.tsx
 *
 * 単コレ：戦闘終了後の戦果画面
 * 間を最優先・捕獲時はイベント主役・ミスのみ折り畳み
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronDown, Sword } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { WordEnemy } from '@/types';

interface MissedWord {
  word: WordEnemy;
  missCount: number;
}

interface WordCollectionResultScreenProps {
  capturedWords: WordEnemy[];
  defeatedWords: WordEnemy[];
  defeatedCount: number;
  misses: number;
  missedWords: MissedWord[];
  onContinue: () => void;
  onRetry?: () => void;
  onBack: () => void;
}

// タイムライン（共通）
const TITLE_DELAY = 0;
const COUNT_DURATION = 0.5;
const FIRST_CARD_DELAY = 1.6;
const CARD_STAGGER = 0.3;
const CARD_ANIM_DURATION = 0.25;
const BATTLE_CARD_DISPLAY_LIMIT = 5;
const CAPTURED_CARD_DISPLAY_LIMIT = 3;
const CAPTURED_CARD_ANIM_DURATION = 0.35;
const CAPTURED_STAGGER = 0.2;
const DEFEATED_AFTER_CAPTURE_START = 2.6;
// GET 表示のタイミング（秒）
const GET_DISPLAY_DELAY = 0.05;
// 捕獲セクション見出し表示タイミング（GET の 0.5s 後）
const CAPTURE_HEADING_DELAY = GET_DISPLAY_DELAY + 0.5;

/** 撃破数カウントアップ */
function useCountUp(end: number, delayMs: number, durationMs: number) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let rafId: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime - delayMs;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / durationMs, 1);
      setCount(Math.round(progress * end));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [end, delayMs, durationMs]);
  return count;
}

/** 撃破カード（共通アニメ：fade + translateY 0.25s） */
function BattleResultCard({ word, delay, small = false }: { word: WordEnemy; delay: number; small?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: CARD_ANIM_DURATION, delay }}
      className={`rounded-xl border border-amber-500/40 bg-gradient-to-b from-gray-800/80 to-gray-900/80 text-center ${
        small ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <p className={`font-mono font-bold text-amber-200 uppercase tracking-wider ${small ? 'text-sm' : 'text-base'}`}>
        {word.word}
      </p>
      <p className={`text-gray-100 mt-1 ${small ? 'text-[10px]' : 'text-xs'}`}>— {word.meaning || '—'}</p>
    </motion.div>
  );
}

/** 捕獲カード（大・金色グロー・★図鑑登録・0.35s） */
function CapturedCard({ word, delay }: { word: WordEnemy; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: CAPTURED_CARD_ANIM_DURATION, delay }}
      className="relative rounded-xl border-2 border-amber-300/30 bg-gradient-to-b from-amber-200/6 to-amber-700/4 px-6 pt-8 pb-5 shadow-[0_0_20px_rgba(251,191,36,0.12)] overflow-visible"
    >
      {/* ハイライトライン（上部） */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-200/50 via-amber-300/40 to-transparent opacity-90" />

      {/* 捕獲バッジ（左上） */}
      <div className="absolute top-3 left-3">
        <div className="px-3 py-1 rounded-full bg-[#07102a] text-amber-300 font-semibold text-sm border border-amber-300/40 shadow-sm flex items-center gap-1">
          <span className="text-amber-400 text-lg leading-none drop-shadow-sm">★</span>
          <span className="text-amber-300">GET</span>
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-1">
        <span className="font-mono font-extrabold text-amber-200 text-xl uppercase tracking-wider">
          {word.word}
        </span>
        <span className="text-gray-100 text-sm mt-0.5">— {word.meaning || '—'}</span>
        <span className="text-gray-400 text-[11px] mt-1.5">★ 図鑑登録</span>
      </div>
    </motion.div>
  );
}

export const WordCollectionResultScreen = ({
  capturedWords,
  defeatedWords,
  defeatedCount,
  misses,
  missedWords,
  onContinue,
  onRetry,
  onBack,
}: WordCollectionResultScreenProps) => {
  const [missedListOpen, setMissedListOpen] = useState(false);
  const hasCaptured = capturedWords.length > 0;
  const displayDefeatedCount = useCountUp(
    defeatedCount,
    GET_DISPLAY_DELAY * 1000 + 120,
    COUNT_DURATION * 1000
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e17] via-[#0d1321] to-[#0a0e17] text-white p-4">
      <div className="max-w-md mx-auto">
        {/* 上部（共通）：0.0s 戦闘終了 → 0.4s カウントアップ */}
        <section className="mb-6">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: TITLE_DELAY }}
            className="text-base font-bold text-amber-400 mb-1"
          >
            ⚔ 戦闘終了！
          </motion.h2>
          {/* 捕獲数（最上位で表示） */}
          {hasCaptured ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, delay: GET_DISPLAY_DELAY }}>
              <p className="text-4xl font-extrabold text-amber-300 mb-1">捕獲 <span className="text-5xl">{capturedWords.length}</span> 体</p>
            </motion.div>
          ) : null}

          {/* 撃破（中サイズ） */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: GET_DISPLAY_DELAY + 0.12 }}
            className="text-2xl font-bold text-gray-100"
          >
            撃破 <span className="text-3xl text-gray-100">{displayDefeatedCount}</span> 回
          </motion.p>

          {/* ミス（小） */}
          {misses > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: GET_DISPLAY_DELAY + COUNT_DURATION + 0.12 }}
              className="text-sm text-gray-200 mt-1"
            >
              ミス {misses}回
            </motion.p>
          )}
        </section>

        {hasCaptured ? (
          /* Mode B：捕獲あり → 1.6s から捕獲イベント → 撃破はサブ */
          <>
            {/* 1.6s〜 捕獲イベント（主役） */}
            <section className="mb-5">
              <motion.h3
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: CAPTURE_HEADING_DELAY }}
                className="text-lg font-extrabold text-amber-400 mb-4"
              >
                ✨ 新たに捕獲！
              </motion.h3>
              <div className="space-y-3">
                {capturedWords.slice(0, CAPTURED_CARD_DISPLAY_LIMIT).map((w, i) => (
                  <CapturedCard
                    key={w.word}
                    word={w}
                    delay={CAPTURE_HEADING_DELAY + 0.15 + i * CAPTURED_STAGGER}
                  />
                ))}
                {capturedWords.length > CAPTURED_CARD_DISPLAY_LIMIT && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: CAPTURE_HEADING_DELAY + CAPTURED_CARD_DISPLAY_LIMIT * CAPTURED_STAGGER }}
                    className="text-center text-amber-500/80 text-sm font-medium"
                  >
                    +{capturedWords.length - CAPTURED_CARD_DISPLAY_LIMIT}体
                  </motion.p>
                )}
              </div>
            </section>
            {/* 撃破した単語（小さめ・視覚優先度下げる） */}
            {defeatedWords.length > 0 && (
              <section className="mb-6">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: DEFEATED_AFTER_CAPTURE_START }}
                  className="text-xs font-medium text-gray-500 mb-2"
                >
                  ⚔ 撃破した単語
                </motion.p>
                <div className="space-y-2">
                  {defeatedWords.slice(0, BATTLE_CARD_DISPLAY_LIMIT).map((w, i) => (
                    <BattleResultCard
                      key={w.word}
                      word={w}
                      delay={DEFEATED_AFTER_CAPTURE_START + 0.1 + i * 0.28}
                      small
                    />
                  ))}
                  {defeatedWords.length > BATTLE_CARD_DISPLAY_LIMIT && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: DEFEATED_AFTER_CAPTURE_START + BATTLE_CARD_DISPLAY_LIMIT * 0.28 }}
                      className="text-center text-gray-500 text-xs"
                    >
                      +{defeatedWords.length - BATTLE_CARD_DISPLAY_LIMIT}体
                    </motion.p>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          /* Mode A：捕獲なし → 1.6s から撃破カード */
          <>
            {defeatedWords.length > 0 && (
              <section className="mb-6">
                <div className="space-y-3">
                  {defeatedWords.slice(0, BATTLE_CARD_DISPLAY_LIMIT).map((w, i) => (
                    <BattleResultCard
                      key={w.word}
                      word={w}
                      delay={FIRST_CARD_DELAY + i * CARD_STAGGER}
                    />
                  ))}
                  {defeatedWords.length > BATTLE_CARD_DISPLAY_LIMIT && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: FIRST_CARD_DELAY + BATTLE_CARD_DISPLAY_LIMIT * CARD_STAGGER }}
                      className="text-center text-amber-500/80 text-sm font-medium"
                    >
                      +{defeatedWords.length - BATTLE_CARD_DISPLAY_LIMIT}体
                    </motion.p>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* 復習：▼ ミスした単語（折り畳み） */}
        {(missedWords ?? []).length > 0 ? (
          <section className="mb-8">
            <button
              onClick={() => {
                vibrateLight();
                setMissedListOpen((o) => !o);
              }}
              className="w-full flex items-center justify-between py-2 text-left text-sm text-gray-100 hover:text-gray-200 transition-colors"
            >
              <span>▼ ミスした単語（{(missedWords ?? []).length}体）</span>
              <motion.span animate={{ rotate: missedListOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </button>
            <AnimatePresence>
              {missedListOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                <div className="pt-2 space-y-1.5">
                    {(missedWords ?? []).map(({ word, missCount }) => (
                      <div
                        key={word.word}
                        className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono text-amber-200/80 text-sm uppercase">{word.word}</span>
                          <span className="text-gray-200 text-xs ml-2">— {word.meaning || '—'}</span>
                        </div>
                        {missCount > 1 && (
                          <span className="text-orange-400/80 text-xs shrink-0">×{missCount}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-200 text-xs mt-2">
                    次の探索ではミスした単語が優先的に出現します
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <section className="mb-8">
            <p className="text-center text-amber-500/70 text-sm">取り逃がしなし！</p>
          </section>
        )}

        {/* ボタン（共通） */}
        <section className="space-y-3">
          {/** 再チャレンジ（同じ問題に挑戦） */ }
          {typeof onRetry === 'function' && (
            <button
              onClick={() => {
                vibrateLight();
                onRetry && onRetry();
              }}
              className="w-full py-3 rounded-xl border border-amber-400/30 text-amber-300 font-semibold text-sm hover:bg-gray-800/40 transition-colors flex items-center justify-center gap-2"
            >
              再チャレンジする
            </button>
          )}
          <button
            onClick={() => {
              vibrateLight();
              onContinue();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            <Sword className="w-4 h-4" />
            続けて探索する
          </button>
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="w-full py-2.5 rounded-xl border border-gray-600 text-gray-400 font-medium text-sm hover:bg-gray-700/40 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            拠点へ戻る
          </button>
        </section>
      </div>
    </div>
  );
};
