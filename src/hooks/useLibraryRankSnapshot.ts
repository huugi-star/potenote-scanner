'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { calcBooksFromFragments, calcRankInfo } from '@/constants/rankSystem';
import { getRepairSpentFragments, migrateRepairProgressIfNeeded } from '@/lib/repairBookFragments';

/**
 * ことば図書館のランク（修繕に使った紙片累計ベース）。
 * アカデミーやホーム画面と同様に periodic sync する。
 */
export function useLibraryRankSnapshot() {
  const [spent, setSpent] = useState(0);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    migrateRepairProgressIfNeeded();
    setSpent(getRepairSpentFragments());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    migrateRepairProgressIfNeeded();
    const sync = () => setSpent(getRepairSpentFragments());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(sync, 800);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, []);

  return useMemo(() => {
    const { totalBooks } = calcBooksFromFragments(spent);
    return { ...calcRankInfo(totalBooks), totalBooks, repairSpentFragments: spent };
  }, [spent]);
}
