/**
 * 「本を修繕する」用：ことばの紙片カウンタ（ローカル保存・最小実装）
 */
const STORAGE_KEY_WALLET = 'suhi_fragments';
const STORAGE_KEY_SPENT = 'suhi_repair_spent_fragments';
const STORAGE_KEY_MIGRATED = 'suhi_repair_migrated_v1';

export const FRAGMENTS_PER_REPAIRED_BOOK = 10;

/** みんなの問題：合計スコアがこの点数につき「ことの葉」1枚 */
export const SCORE_PER_KOTOBA_LEAF = 10;

function safeGet(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(key);
    const n = parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 加算後の合計を返す */
function safeSet(key: string, n: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(Math.max(0, Math.floor(n))));
  } catch {
    // ignore
  }
}

/**
 * 移行: 旧仕様では suhi_fragments = 修繕進捗(累計) として扱っていた。
 * 新仕様では wallet(未使用) と spent(修繕に使った累計) を分離する。
 * 初回のみ spent=旧fragments, wallet=0 に移行して進捗を保つ。
 */
export function migrateRepairProgressIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    const migrated = window.localStorage.getItem(STORAGE_KEY_MIGRATED);
    if (migrated === '1') return;

    const wallet = safeGet(STORAGE_KEY_WALLET);
    const spent = safeGet(STORAGE_KEY_SPENT);
    if (spent <= 0 && wallet > 0) {
      safeSet(STORAGE_KEY_SPENT, wallet);
      safeSet(STORAGE_KEY_WALLET, 0);
    }
    window.localStorage.setItem(STORAGE_KEY_MIGRATED, '1');
  } catch {
    // ignore
  }
}

/** ことの葉（所持 / 未使用） */
export function getRepairBookFragments(): number {
  return safeGet(STORAGE_KEY_WALLET);
}

/** ことの葉（所持）を加算（クイズ報酬など） */
export function addRepairBookFragments(delta: number): number {
  if (typeof window === 'undefined') return 0;
  if (!Number.isFinite(delta) || delta <= 0) return getRepairBookFragments();
  try {
    const next = getRepairBookFragments() + Math.floor(delta);
    safeSet(STORAGE_KEY_WALLET, next);
    return next;
  } catch {
    return getRepairBookFragments();
  }
}

/** ことの葉（所持）を消費（減算）して、残量を返す */
export function consumeRepairBookFragments(delta: number): number {
  if (typeof window === 'undefined') return 0;
  if (!Number.isFinite(delta) || delta <= 0) return getRepairBookFragments();
  const cur = getRepairBookFragments();
  const next = Math.max(0, cur - Math.floor(delta));
  safeSet(STORAGE_KEY_WALLET, next);
  return next;
}

/** 修繕に使ったことの葉（累計） */
export function getRepairSpentFragments(): number {
  return safeGet(STORAGE_KEY_SPENT);
}

/** 修繕に使った累計を加算して、合計を返す */
export function addRepairSpentFragments(delta: number): number {
  if (typeof window === 'undefined') return 0;
  if (!Number.isFinite(delta) || delta <= 0) return getRepairSpentFragments();
  const next = getRepairSpentFragments() + Math.floor(delta);
  safeSet(STORAGE_KEY_SPENT, next);
  return next;
}
