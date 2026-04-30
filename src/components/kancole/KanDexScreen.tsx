/**
 * KanDexScreen.tsx
 *
 * 漢字図鑑：Vol一覧（図鑑TOP）
 * - 単コレのワード図鑑と同等の仕様
 */

import { ChevronLeft, BookOpen, Lock } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { KanColeScan } from '@/types';

const TERMS_PER_VOL = 50;

interface KanDexScreenProps {
  kanDexOrder: string[];
  scans: KanColeScan[];
  onSelectVol: (volIndex: number) => void;
  onBack: () => void;
}

function getTermBestState(term: string, scans: KanColeScan[]): 'captured' | 'defeated' | 'undefeated' {
  for (const scan of scans) {
    const w = scan.words.find((x) => x.term === term);
    if (!w) continue;
    if (w.hp === 0) return 'captured';
    if (w.hp < 2) return 'defeated';
  }
  return 'undefeated';
}

function getVolCapturedCount(volIndex: number, kanDexOrder: string[], scans: KanColeScan[]): number {
  const start = volIndex * TERMS_PER_VOL;
  const terms = kanDexOrder.slice(start, start + TERMS_PER_VOL);
  return terms.filter((t) => getTermBestState(t, scans) === 'captured').length;
}

export const KanDexScreen = ({ kanDexOrder, scans, onSelectVol, onBack }: KanDexScreenProps) => {
  const totalTerms = kanDexOrder.length;
  const maxVolIndex = Math.ceil(totalTerms / TERMS_PER_VOL) || 1;

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
            <h1 className="text-lg font-bold text-white">漢字図鑑</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="space-y-3">
          {Array.from({ length: Math.max(maxVolIndex, 3) }, (_, i) => {
            const start = i * TERMS_PER_VOL;
            const volTerms = kanDexOrder.slice(start, start + TERMS_PER_VOL);
            const isUnlocked = volTerms.length > 0 || (i === 0 && totalTerms === 0);
            const captured = getVolCapturedCount(i, kanDexOrder, scans);
            const isComplete = volTerms.length > 0 && captured === volTerms.length;

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
                      Kan Dex Vol.{i + 1}
                      {isComplete && <span className="text-amber-400">⭐</span>}
                    </p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {isUnlocked
                        ? `No.${String(start + 1).padStart(3, '0')}〜${String(
                            Math.min(start + TERMS_PER_VOL, totalTerms) || start + 1
                          ).padStart(3, '0')}`
                        : '未解放'}
                    </p>
                  </div>
                </div>
                {isUnlocked && (
                  <span className="text-amber-400/90 text-sm">
                    {captured}/{volTerms.length}
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

