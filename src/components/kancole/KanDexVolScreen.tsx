/**
 * KanDexVolScreen.tsx
 *
 * 漢字図鑑：Vol詳細（語一覧・ページ制）
 * - 単コレのワード図鑑と同等の仕様
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { KanColeScan } from '@/types';

const TERMS_PER_VOL = 50;
const TERMS_PER_PAGE = 10;

interface KanDexVolScreenProps {
  volIndex: number;
  kanDexOrder: string[];
  scans: KanColeScan[];
  onSelectTerm: (term: string) => void;
  onBack: () => void;
}

function getTermInfo(term: string, scans: KanColeScan[]) {
  let state: 'captured' | 'defeated' | 'undefeated' = 'undefeated';
  let meaning = '';
  let reading = '';
  for (const scan of scans) {
    const w = scan.words.find((x) => x.term === term);
    if (!w) continue;
    if (w.hp === 0) state = 'captured';
    else if (w.hp < 2 && state === 'undefeated') state = 'defeated';
    if (w.meaning) meaning = w.meaning;
    if (w.reading) reading = w.reading;
  }
  return { state, meaning, reading };
}

export const KanDexVolScreen = ({ volIndex, kanDexOrder, scans, onSelectTerm, onBack }: KanDexVolScreenProps) => {
  const start = volIndex * TERMS_PER_VOL;
  const terms = kanDexOrder.slice(start, start + TERMS_PER_VOL);
  const totalPages = Math.ceil(terms.length / TERMS_PER_PAGE) || 1;
  const [page, setPage] = useState(0);

  const pageTerms = terms.slice(page * TERMS_PER_PAGE, (page + 1) * TERMS_PER_PAGE);

  const goPrev = () => {
    vibrateLight();
    setPage((p) => Math.max(0, p - 1));
  };
  const goNext = () => {
    vibrateLight();
    setPage((p) => Math.min(totalPages - 1, p + 1));
  };
  const goToPage = (p: number) => {
    vibrateLight();
    setPage(p);
  };

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
            <h1 className="text-lg font-bold text-white">Kan Dex Vol.{volIndex + 1}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {terms.length === 0 ? (
          <p className="text-gray-500 text-sm py-12 text-center">まだ漢字が登録されていません</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {pageTerms.map((term, i) => {
                const dexNo = start + page * TERMS_PER_PAGE + i + 1;
                const { state, meaning, reading } = getTermInfo(term, scans);
                const isCaptured = state === 'captured';
                const isDefeated = state === 'defeated';

                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      vibrateLight();
                      if (isCaptured) onSelectTerm(term);
                    }}
                    disabled={!isCaptured}
                    className={`relative rounded-xl px-4 py-3 text-left transition-colors ${
                      isCaptured
                        ? 'border-2 border-amber-500/70 bg-amber-500/20 hover:bg-amber-500/30 cursor-pointer shadow-lg shadow-amber-500/10'
                        : 'border border-gray-700 bg-gray-800/50 cursor-default'
                    }`}
                  >
                    {isCaptured && (
                      <span className="absolute top-2 right-2 text-amber-400">
                        <Star className="w-4 h-4 fill-amber-400" />
                      </span>
                    )}
                    <p className="text-[10px] text-gray-500 font-mono">No.{String(dexNo).padStart(3, '0')}</p>
                    <p
                      className={`font-mono font-bold mt-0.5 truncate ${
                        isCaptured ? 'text-amber-200' : isDefeated ? 'text-gray-400 opacity-70' : 'text-gray-600'
                      }`}
                    >
                      {isCaptured || isDefeated ? term : '???'}
                    </p>
                    {isCaptured && reading && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">よみ：{reading}</p>
                    )}
                    {isCaptured && meaning && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">— {meaning}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToPage(i)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === i
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : 'border border-gray-600 text-gray-400 hover:bg-gray-700/50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

