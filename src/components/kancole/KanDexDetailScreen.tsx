/**
 * KanDexDetailScreen.tsx
 *
 * 漢字図鑑：詳細（捕獲済みのみ）
 * - 単コレのワード図鑑と同等の仕様
 */

import { ChevronLeft } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { KanColeScan } from '@/types';

interface KanDexDetailScreenProps {
  term: string;
  dexNo: number;
  scans: KanColeScan[];
  onBack: () => void;
}

function getTermDetail(term: string, scans: KanColeScan[]) {
  let reading = '';
  let meaning = '';
  let explanation = '';
  let sourceSnippet: string | undefined = undefined;
  for (const scan of scans) {
    const w = scan.words.find((x) => x.term === term);
    if (!w) continue;
    if (w.reading) reading = w.reading;
    if (w.meaning) meaning = w.meaning;
    if (w.explanation) explanation = w.explanation;
    if (w.sourceSnippet) sourceSnippet = w.sourceSnippet;
  }
  return { reading, meaning, explanation, sourceSnippet };
}

export const KanDexDetailScreen = ({ term, dexNo, scans, onBack }: KanDexDetailScreenProps) => {
  const { reading, meaning, explanation, sourceSnippet } = getTermDetail(term, scans);

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
            <h1 className="text-lg font-bold text-white">図鑑 No.{String(dexNo).padStart(3, '0')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-6 text-center">
          <p className="text-amber-500/80 text-sm font-mono">No.{String(dexNo).padStart(3, '0')}</p>
          <p className="font-mono font-bold text-3xl text-amber-200 tracking-wider mt-2">{term}</p>
          <p className="text-gray-300 mt-2 text-sm">よみ：{reading || '—'}</p>
          <p className="text-gray-300 mt-2">— {meaning || '—'}</p>
        </div>

        {(explanation || sourceSnippet) && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            {explanation && (
              <div>
                <p className="text-sm font-bold text-gray-200">解説</p>
                <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">{explanation}</p>
              </div>
            )}
            {sourceSnippet && (
              <div className={explanation ? 'mt-4 pt-4 border-t border-gray-800' : ''}>
                <p className="text-sm font-bold text-gray-200">出典（スキャン断片）</p>
                <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap leading-relaxed">{sourceSnippet}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

