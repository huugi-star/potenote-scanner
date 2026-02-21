'use client';

/**
 * 単コレ拠点ページ（/word-collection）
 *
 * 冒険ログ（スキャン一覧）＋ 単コレ専用スキャン画面
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Scan, BookOpen, BookMarked } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { ToastProvider } from '@/components/ui/Toast';
import { useGameStore } from '@/store/useGameStore';
import { ScanCard, type ScanCardData } from '@/components/word-collection/ScanCard';
import { WordCollectionScanScreen } from '@/components/word-collection/WordCollectionScanScreen';
import { WordCollectionQuestScreen, type BattleResultData } from '@/components/word-collection/WordCollectionQuestScreen';
import { WordCollectionResultScreen } from '@/components/word-collection/WordCollectionResultScreen';
import { WordDexScreen } from '@/components/word-collection/WordDexScreen';
import { WordDexVolScreen } from '@/components/word-collection/WordDexVolScreen';
import { WordDexDetailScreen } from '@/components/word-collection/WordDexDetailScreen';

// ===== Page Content =====

function WordCollectionContent() {
  const [view, setView] = useState<'list' | 'log' | 'dex' | 'dexVol' | 'dexDetail' | 'scan' | 'quest' | 'result'>('list');
  const [selectedVolIndex, setSelectedVolIndex] = useState<number | null>(null);
  const [selectedDexWord, setSelectedDexWord] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [questMode, setQuestMode] = useState<'explore' | 'retry'>('explore');
  const [battleResult, setBattleResult] = useState<BattleResultData | null>(null);
  useToast(); // hook initialization (addToast not used here)
  const wordCollectionScans = useGameStore((s) => s.wordCollectionScans);
  const wordDexOrder = useGameStore((s) => s.wordDexOrder);
  const dailyWordCollectionScanCount = useGameStore((s) => s.dailyWordCollectionScanCount);
  const lastWordCollectionScanDate = useGameStore((s) => s.lastWordCollectionScanDate);
  const getWordCollectionScanById = useGameStore((s) => s.getWordCollectionScanById);
  const refillActiveEnemies = useGameStore((s) => s.refillActiveEnemies);
  const saveAdventureSnapshot = useGameStore((s) => s.saveAdventureSnapshot);

  const scansForDisplay: ScanCardData[] = wordCollectionScans.map((scan) => {
    // 冒険ログは「完了時のスナップショット」を最優先で表示（続きを探索しても崩れない）
    if (scan.lastAdventureSnapshot) {
      const snap = scan.lastAdventureSnapshot;
      return {
        id: scan.id,
        title: scan.title,
        capturedInActive: snap.capturedCount,
        defeatedInActive: snap.defeatedCount,
        remainingInActive: snap.remainingCount,
        activeTotal: snap.total > 0 ? snap.total : 1,
      };
    }

    // ===== HPベースの純粋な計算ロジック（スナップショットは無視） =====
    const activeWords = scan.activeEnemyWords ?? [];
    const activeTotal = scan.activeEnemyTotal ?? activeWords.length;

    const activeWordsData = activeWords
      .map((w) => scan.words.find((sw) => sw.word === w))
      .filter((w) => w !== undefined) as Array<typeof scan.words[0]>;

    const capturedInActive = activeWordsData.filter((w) => w.hp === 0).length;
    const defeatedInActive = activeWordsData.filter((w) => w.hp === 1 || w.hp === 2).length;
    const remainingInActive = Math.max(0, activeTotal - capturedInActive - defeatedInActive);

    return {
      id: scan.id,
      title: scan.title,
      capturedInActive,
      defeatedInActive,
      remainingInActive,
      activeTotal: activeTotal > 0 ? activeTotal : 1,
    };
  });

  const handleExplore = (id: string) => {
    vibrateLight();
    refillActiveEnemies(id);
    setSelectedScanId(id);
    setQuestMode('explore');
    setView('quest');
  };

  const handleRetry = (id: string) => {
    vibrateLight();
    setSelectedScanId(id);
    setQuestMode('retry');
    setView('quest');
  };

  const selectedScan = selectedScanId ? getWordCollectionScanById(selectedScanId) : undefined;

  // クエスト選択中にスキャンが消えた場合は一覧へ戻す
  useEffect(() => {
    if (view === 'quest' && selectedScanId && !selectedScan) {
      setView('list');
      setSelectedScanId(null);
    }
  }, [view, selectedScanId, selectedScan]);

  // ワード図鑑
  if (view === 'dex') {
    return (
      <WordDexScreen
        wordDexOrder={wordDexOrder}
        scans={wordCollectionScans}
        onSelectVol={(volIndex) => {
          setSelectedVolIndex(volIndex);
          setView('dexVol');
        }}
        onBack={() => setView('list')}
      />
    );
  }
  if (view === 'dexVol' && selectedVolIndex !== null) {
    return (
      <WordDexVolScreen
        volIndex={selectedVolIndex}
        wordDexOrder={wordDexOrder}
        scans={wordCollectionScans}
        onSelectWord={(word) => {
          setSelectedDexWord(word);
          setView('dexDetail');
        }}
        onBack={() => {
          setSelectedVolIndex(null);
          setView('dex');
        }}
      />
    );
  }
  if (view === 'dexDetail' && selectedDexWord) {
    const dexNo = wordDexOrder.indexOf(selectedDexWord) + 1;
    return (
      <WordDexDetailScreen
        word={selectedDexWord}
        dexNo={dexNo}
        scans={wordCollectionScans}
        onBack={() => {
          setSelectedDexWord(null);
          setView('dexVol');
        }}
      />
    );
  }

  // 冒険ログ（ScanCard 一覧・探索・再戦）
  if (view === 'log') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white">
        <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { vibrateLight(); setView('list'); }}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                戻る
              </button>
              <h1 className="text-lg font-bold text-white">冒険ログ</h1>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          {scansForDisplay.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              まだ冒険ログがありません。
            </p>
          ) : (
            <div className="space-y-4">
              {scansForDisplay.map((scan) => (
                <ScanCard
                  key={scan.id}
                  data={scan}
                  onExplore={handleExplore}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // 単コレ専用スキャン画面を表示
  if (view === 'scan') {
    return (
      <WordCollectionScanScreen
        onComplete={(id?: string) => {
          if (id) {
            // 直接クエストへ遷移して出題を開始
            refillActiveEnemies(id);
            setSelectedScanId(id);
            setQuestMode('explore');
            setView('quest');
          } else {
            setView('list');
          }
        }}
        onBack={() => setView('list')}
      />
    );
  }

  // クエスト戦闘画面を表示
  if (view === 'quest' && selectedScan) {
    return (
      <WordCollectionQuestScreen
        scan={selectedScan}
        questMode={questMode}
        onComplete={(result) => {
          // Save an immutable adventure snapshot using latest store state
          // (HP=0 を捕獲として集計し、分母は固定値を維持)
          const latestScan = getWordCollectionScanById(selectedScan.id) ?? selectedScan;
          const activeWords = latestScan.activeEnemyWords ?? [];
          const total = latestScan.activeEnemyTotal ?? activeWords.length;
          const activeWordsData = activeWords
            .map((w) => latestScan.words.find((sw) => sw.word === w))
            .filter((w) => w !== undefined) as Array<typeof latestScan.words[0]>;
          const capturedCount = activeWordsData.filter((w) => w.hp === 0).length;
          const defeatedCount = activeWordsData.filter((w) => w.hp === 1 || w.hp === 2).length;
          const remainingCount = Math.max(0, total - capturedCount - defeatedCount);
          saveAdventureSnapshot(selectedScan.id, {
            timestamp: new Date().toISOString(),
            capturedCount,
            defeatedCount,
            remainingCount,
            total: total > 0 ? total : 1,
            capturedWords: activeWordsData.filter((w) => w.hp === 0),
            defeatedWords: activeWordsData.filter((w) => w.hp === 1 || w.hp === 2),
          });
          setBattleResult(result);
          setView('result');
        }}
        onBack={() => { setView('list'); setSelectedScanId(null); }}
      />
    );
  }

  // 戦果画面を表示
  if (view === 'result' && battleResult && selectedScanId) {
    return (
      <WordCollectionResultScreen
        capturedWords={battleResult.capturedWords}
        defeatedWords={battleResult.defeatedWords}
        defeatedCount={battleResult.defeatedCount}
        misses={battleResult.misses}
        missedWords={battleResult.missedWords ?? []}
        onContinue={() => {
          // Debug: log snapshot before continue
          try {
            const s = wordCollectionScans.find((x) => x.id === selectedScanId);
            console.log('[onContinue] selectedScan before refill:', { id: selectedScanId, hasSnapshot: !!s?.lastAdventureSnapshot, lastSnapshot: s?.lastAdventureSnapshot });
          } catch (e) {}
          refillActiveEnemies(selectedScanId);
          setView('quest');
          setBattleResult(null);
        }}
        onRetry={() => {
          // 同じスキャンで再チャレンジ（retry モード）
          setSelectedScanId(selectedScanId);
          setQuestMode('retry');
          setView('quest');
          setBattleResult(null);
        }}
        onBack={() => {
          setView('list');
          setSelectedScanId(null);
          setBattleResult(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white">
      {/* 1) ヘッダー */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">単コレ拠点</h1>
              <p className="text-sm text-gray-500 mt-0.5">スキャンごとの冒険ログ</p>
            </div>
            <Link
              href="/"
              onClick={() => vibrateLight()}
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
              HOMEへ
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 2) 新規スキャン導線（単コレ内のスキャン画面へ） */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const isDevEnv =
            process.env.NODE_ENV !== 'production' ||
            (typeof window !== 'undefined' &&
              (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
          const reachedLimit = !isDevEnv && lastWordCollectionScanDate === today && (dailyWordCollectionScanCount ?? 0) >= 5;
          return (
            <div>
              <button
                type="button"
                onClick={() => {
                  if (reachedLimit) {
                    vibrateLight();
                    // show simple inline feedback via alert (keeps change minimal)
                    alert('本日の限度数に達しました');
                    return;
                  }
                  vibrateLight();
                  setView('scan');
                }}
                disabled={reachedLimit}
                className={`block w-full py-4 rounded-xl ${reachedLimit ? 'bg-gray-700 text-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white'} font-bold text-center flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25`}
              >
                <Scan className="w-5 h-5" />
                新しい英文をスキャン
              </button>
              {reachedLimit && <p className="text-center text-sm text-red-400 mt-2">本日の限度数に達しました</p>}
            </div>
          );
        })()}

        {/* 3) 冒険ログ（タップで階層へ） */}
        <section>
          <button
            type="button"
            onClick={() => {
              vibrateLight();
              setView('log');
            }}
            className="w-full rounded-xl border border-gray-600/80 bg-gray-800/60 px-4 py-4 flex items-center justify-between gap-3 text-left hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-white">冒険ログ</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  {scansForDisplay.length === 0
                    ? 'スキャンすると記録されます'
                    : `これまでのスキャン ${scansForDisplay.length}件`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
          </button>
        </section>

        {/* 4) ワード図鑑 */}
        <section>
          <button
            type="button"
            onClick={() => {
              vibrateLight();
              setView('dex');
            }}
            className="w-full rounded-xl border border-gray-600/80 bg-gray-800/60 px-4 py-4 flex items-center justify-between gap-3 text-left hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <BookMarked className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-white">ワード図鑑</p>
                <p className="text-gray-500 text-sm mt-0.5">
                  {wordDexOrder.length === 0
                    ? '戦闘で発見した単語が登録されます'
                    : `登録単語 ${wordDexOrder.length}語`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
          </button>
        </section>
      </main>
    </div>
  );
}

// ===== Main Export =====

export default function WordCollectionPage() {
  return (
    <ToastProvider>
      <WordCollectionContent />
    </ToastProvider>
  );
}
