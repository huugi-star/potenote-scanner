/**
 * WordDexDetailScreen.tsx
 *
 * ワード図鑑：単語詳細（捕獲済みのみ）
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, Volume2 } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import type { WordCollectionScan } from '@/types';

const POS_LABELS: Record<string, string> = {
  noun: '名詞',
  verb: '動詞',
  adj: '形容詞',
  other: 'その他',
};

interface WordDexDetailScreenProps {
  word: string;
  dexNo: number;
  scans: WordCollectionScan[];
  onBack: () => void;
}

function getWordDetail(word: string, scans: WordCollectionScan[]) {
  let meaning = '';
  let pos = '';
  for (const scan of scans) {
    const w = scan.words.find((x) => x.word === word);
    if (!w) continue;
    if (w.meaning) meaning = w.meaning;
    if ((w as { pos?: string }).pos) pos = (w as { pos?: string }).pos!;
  }
  return { meaning, pos };
}

export const WordDexDetailScreen = ({
  word,
  dexNo,
  scans,
  onBack,
}: WordDexDetailScreenProps) => {
  const { meaning, pos } = getWordDetail(word, scans);
  const posLabel = pos ? (POS_LABELS[pos] ?? pos) : '—';
  const [ipa, setIpa] = useState<string>('—');

  useEffect(() => {
    let alive = true;
    const fetchIpa = async () => {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!res.ok) return;
        const data = await res.json();
        const first = Array.isArray(data) ? data[0] : null;
        const phonetic =
          (first?.phonetic as string | undefined) ||
          (Array.isArray(first?.phonetics)
            ? first.phonetics.find((p: any) => p?.text)?.text
            : undefined);
        if (alive && phonetic && String(phonetic).trim()) {
          setIpa(String(phonetic).trim());
        }
      } catch {
        // ignore fetch failures, keep fallback
      }
    };
    setIpa('—');
    fetchIpa();
    return () => {
      alive = false;
    };
  }, [word]);

  const speakWord = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    // 連打時は現在の読み上げを止めてから再生
    synth.cancel();

    const speakNow = () => {
      const utter = new SpeechSynthesisUtterance(word);
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.lang = 'en-US';
      const voices = synth.getVoices();
      const englishVoices = voices.filter((v) => /^en(-|_)/i.test(v.lang));
      const preferred =
        englishVoices.find((v) => /en-US/i.test(v.lang)) ||
        englishVoices.find((v) => /en-GB/i.test(v.lang)) ||
        englishVoices[0];
      if (preferred) utter.voice = preferred;
      synth.speak(utter);
    };

    // iOS Safari など初回で voices が空のことがある
    if (synth.getVoices().length === 0) {
      const onVoicesChanged = () => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        speakNow();
      };
      synth.addEventListener('voiceschanged', onVoicesChanged);
      // フォールバック: voiceschanged が来なくても短時間後に再試行
      window.setTimeout(() => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        speakNow();
      }, 180);
      return;
    }
    speakNow();
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
            <h1 className="text-lg font-bold text-white">図鑑 No.{String(dexNo).padStart(3, '0')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-6 text-center">
          <p className="text-amber-500/80 text-sm font-mono">No.{String(dexNo).padStart(3, '0')}</p>
          <p className="font-mono font-bold text-2xl text-amber-200 uppercase tracking-wider mt-2">
            {word}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="text-gray-300 text-sm">発音記号: {ipa}</p>
            <button
              type="button"
              onClick={() => {
                vibrateLight();
                speakWord();
              }}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-amber-400/40 text-amber-300 hover:bg-amber-500/20"
              aria-label={`${word} を発音`}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-300 mt-2">— {meaning || '—'}</p>
          <p className="text-gray-500 text-sm mt-4">品詞：{posLabel}</p>
        </div>
      </main>
    </div>
  );
};
