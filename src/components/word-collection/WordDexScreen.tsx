/**
 * WordDexScreen.tsx
 *
 * ワード図鑑：Vol一覧（図鑑TOP）
 */

import { ChevronLeft, BookOpen, Lock } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { WordCollectionScan } from '@/types';

const WORDS_PER_VOL = 50;

interface WordDexScreenProps {
  wordDexOrder: string[];
  scans: WordCollectionScan[];
  onSelectVol: (volIndex: number) => void;
  onBack: () => void;
}

/** 単語の最良状態を全スキャンから取得 */
function getWordBestState(word: string, scans: WordCollectionScan[]): 'captured' | 'defeated' | 'undefeated' {
  for (const scan of scans) {
    const w = scan.words.find((x) => x.word === word);
    if (!w) continue;
    if (w.hp === 0) return 'captured';
    if (w.hp < 3) return 'defeated';
  }
  return 'undefeated';
}

/** Vol内の捕獲済み数を取得 */
function getVolCapturedCount(
  volIndex: number,
  wordDexOrder: string[],
  scans: WordCollectionScan[]
): number {
  const start = volIndex * WORDS_PER_VOL;
  const words = wordDexOrder.slice(start, start + WORDS_PER_VOL);
  return words.filter((w) => getWordBestState(w, scans) === 'captured').length;
}

export const WordDexScreen = ({
  wordDexOrder,
  scans,
  onSelectVol,
  onBack,
}: WordDexScreenProps) => {
  const totalWords = wordDexOrder.length;
  const maxVolIndex = Math.ceil(totalWords / WORDS_PER_VOL) || 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                vibrateLight();
                onBack();
              }}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              戻る
            </button>
            <h1 className="text-lg font-bold text-white">ワード図鑑</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="space-y-3">
          {Array.from({ length: Math.max(maxVolIndex, 3) }, (_, i) => {
            const start = i * WORDS_PER_VOL;
            const volWords = wordDexOrder.slice(start, start + WORDS_PER_VOL);
            const isUnlocked = volWords.length > 0 || (i === 0 && totalWords === 0);
            const captured = getVolCapturedCount(i, wordDexOrder, scans);
            const isComplete = volWords.length > 0 && captured === volWords.length;

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  vibrateLight();
                  if (isUnlocked) onSelectVol(i);
                }}
                disabled={!isUnlocked}
                className={`w-full rounded-xl border px-4 py-4 flex items-center justify-between gap-3 text-left transition-colors ${
                  isUnlocked
                    ? 'border-amber-500/40 bg-gray-800/60 hover:bg-gray-700/50'
                    : 'border-gray-700 bg-gray-800/30 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      isUnlocked ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-gray-700 border border-gray-600'
                    }`}
                  >
                    {isUnlocked ? (
                      <BookOpen className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-2">
                      Word Dex Vol.{i + 1}
                      {isComplete && <span className="text-amber-400">⭐</span>}
                    </p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {isUnlocked
                        ? `No.${String(start + 1).padStart(3, '0')}〜${String(Math.min(start + WORDS_PER_VOL, totalWords) || start + 1).padStart(3, '0')}`
                        : '未解放'}
                    </p>
                  </div>
                </div>
                {isUnlocked && (
                  <span className="text-amber-400/90 text-sm">
                    {captured}/{volWords.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
};
