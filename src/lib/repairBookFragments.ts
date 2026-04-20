/**
 * 「本を修繕する」用：ことばの紙片カウンタ（ローカル保存・最小実装）
 */
const STORAGE_KEY = 'suhi_fragments';

export const FRAGMENTS_PER_REPAIRED_BOOK = 10;

/** みんなの問題：合計スコアがこの点数につき「ことの葉」1枚 */
export const SCORE_PER_KOTOBA_LEAF = 10;

export function getRepairBookFragments(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 加算後の合計を返す */
export function addRepairBookFragments(delta: number): number {
  if (typeof window === 'undefined') return 0;
  if (!Number.isFinite(delta) || delta <= 0) return getRepairBookFragments();
  try {
    const next = getRepairBookFragments() + Math.floor(delta);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return getRepairBookFragments();
  }
}
