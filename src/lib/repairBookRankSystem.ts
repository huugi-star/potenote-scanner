// ── ランクシステム定数 ────────────────────────────────────────
// 11段階。各ランク10冊。1冊 = 1級アップ。
// 必要紙片数はランクごとに変化: 見習い=10枚/冊, 司書=20枚/冊, 上級司書以降=30枚/冊

export const RANK_TIERS = [
  { name: '見習い司書',     color: '#a97c50', glow: '#d4a96a', light: '#fff8f0' },
  { name: '司書',           color: '#6a8fc8', glow: '#93b4e8', light: '#f0f5ff' },
  { name: '上級司書',       color: '#7b5ea7', glow: '#a07fd4', light: '#f5f0ff' },
  { name: '司書長',         color: '#c0643a', glow: '#e8895a', light: '#fff4f0' },
  { name: '禁書目録士',     color: '#2a7a6a', glow: '#4ab8a0', light: '#f0fffc' },
  { name: '解読士',         color: '#8a6020', glow: '#c8a040', light: '#fffbf0' },
  { name: '魔術師見習い',   color: '#5a3a8a', glow: '#9060d0', light: '#f8f0ff' },
  { name: '魔術師',         color: '#8a2060', glow: '#d04090', light: '#fff0f8' },
  { name: '見習い魔法使い', color: '#1a6a9a', glow: '#3aaad4', light: '#f0f8ff' },
  { name: '魔法使い',       color: '#1a8a3a', glow: '#40c060', light: '#f0fff4' },
  { name: '言詠士',         color: '#c9a227', glow: '#f0cc55', light: '#fffbf0' },
] as const;

// ── 各ランクの冊数（全て10冊 = 10〜1級）────────────────────────
export const BOOKS_PER_TIER_LIST = [
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
] as const;

// ── 1冊あたり必要紙片数（ランク別）──────────────────────────────
// 見習い司書: 10枚/冊
// 司書:       20枚/冊
// 上級司書以降: 30枚/冊
export const FRAGMENTS_PER_BOOK_BY_TIER = [
  10, 20, 30, 30, 30, 30, 30, 30, 30, 30, 30,
] as const;

export const GRADES_PER_TIER = 10;
export const TOTAL_TIERS     = RANK_TIERS.length; // 11

/** 単コレ等: 「司書」ティアに到達（tierIndex >= 1）で解放（見習い司書とは別ランクとして扱う） */
export const UNLOCK_WORD_COLLECTION_MIN_TIER_INDEX = 1;
/** 英文解釈（英語学習モード）: 「司書長」ティア以上で解放（tierIndex >= 3） */
export const UNLOCK_ENGLISH_LEARNING_TRANSLATION_MIN_TIER_INDEX = 3;

// 累計冊数: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]
export const TIER_CUMULATIVE_BOOKS = BOOKS_PER_TIER_LIST.reduce<number[]>(
  (acc, v) => { acc.push((acc[acc.length - 1] ?? 0) + v); return acc; },
  [],
);
export const TOTAL_BOOKS_MAX = TIER_CUMULATIVE_BOOKS[TIER_CUMULATIVE_BOOKS.length - 1]; // 110

// 累計紙片数（各ランク完了時）
// 見習い=100, 司書=300, 上級司書以降30枚×各10冊=300ずつ
// [100, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000]
export const TIER_CUMULATIVE_FRAGMENTS = BOOKS_PER_TIER_LIST.reduce<number[]>(
  (acc, books, i) => {
    const prev = acc[acc.length - 1] ?? 0;
    acc.push(prev + books * FRAGMENTS_PER_BOOK_BY_TIER[i]);
    return acc;
  },
  [],
);
export const TOTAL_FRAGMENTS_MAX = TIER_CUMULATIVE_FRAGMENTS[TIER_CUMULATIVE_FRAGMENTS.length - 1];

// 後方互換
export const BOOKS_PER_TIER = BOOKS_PER_TIER_LIST[0];

// ─────────────────────────────────────────────────────────────
// calcBooksFromFragments
// 総紙片数 → 総冊数・現在冊内進捗・現在tier紙片数 を計算
// ─────────────────────────────────────────────────────────────
export function calcBooksFromFragments(totalFragments: number): {
  totalBooks: number;
  fragmentsInCurrentBook: number;
  currentFragsPerBook: number;
} {
  if (totalFragments <= 0) {
    return { totalBooks: 0, fragmentsInCurrentBook: 0, currentFragsPerBook: FRAGMENTS_PER_BOOK_BY_TIER[0] };
  }

  let remaining  = totalFragments;
  let totalBooks = 0;

  for (let t = 0; t < TOTAL_TIERS; t++) {
    const fragsPerBook    = FRAGMENTS_PER_BOOK_BY_TIER[t];
    const maxBooks        = BOOKS_PER_TIER_LIST[t];
    const fragsForTier    = fragsPerBook * maxBooks;

    if (remaining >= fragsForTier) {
      remaining  -= fragsForTier;
      totalBooks += maxBooks;
    } else {
      const completed = Math.floor(remaining / fragsPerBook);
      totalBooks     += completed;
      remaining      -= completed * fragsPerBook;
      return { totalBooks, fragmentsInCurrentBook: remaining, currentFragsPerBook: fragsPerBook };
    }
  }

  // 全ランク制覇
  return {
    totalBooks:            TOTAL_BOOKS_MAX,
    fragmentsInCurrentBook: 0,
    currentFragsPerBook:   FRAGMENTS_PER_BOOK_BY_TIER[TOTAL_TIERS - 1],
  };
}

// ─────────────────────────────────────────────────────────────
// calcRankInfo — 総冊数からランク情報を計算
// ─────────────────────────────────────────────────────────────
export function calcRankInfo(totalBooks: number) {
  const isMaxRank = totalBooks >= TOTAL_BOOKS_MAX;

  let tierIndex       = 0;
  let booksBeforeTier = 0;
  for (let i = 0; i < TOTAL_TIERS; i++) {
    const cum = TIER_CUMULATIVE_BOOKS[i];
    if (totalBooks < cum) {
      tierIndex       = i;
      booksBeforeTier = i === 0 ? 0 : TIER_CUMULATIVE_BOOKS[i - 1];
      break;
    }
    if (i === TOTAL_TIERS - 1) {
      tierIndex       = TOTAL_TIERS - 1;
      booksBeforeTier = TIER_CUMULATIVE_BOOKS[TOTAL_TIERS - 2];
    }
  }

  const booksForTier = BOOKS_PER_TIER_LIST[tierIndex];
  const booksInTier  = isMaxRank
    ? booksForTier
    : Math.min(totalBooks - booksBeforeTier, booksForTier);

  // 0冊目 → {booksForTier}級、(booksForTier-1)冊目 → 1級
  const grade      = isMaxRank ? 1 : Math.max(1, booksForTier - booksInTier);
  const gradeLabel = `${grade}級`;

  const progressPct        = (booksInTier / booksForTier) * 100;
  const booksUntilNextTier = isMaxRank ? 0 : booksForTier - booksInTier;

  const tier = RANK_TIERS[tierIndex];

  return {
    tierIndex,
    tier,
    grade,
    gradeLabel,
    booksInTier,
    booksForTier,
    booksUntilNextGrade: isMaxRank ? 0 : 1,
    booksUntilNextTier,
    /** 次のランク（ティア）へ進むまであと何冊（= booksUntilNextTier） */
    booksToNext: booksUntilNextTier,
    /** このランク段階で必要な冊数（進捗の分母に使う） */
    nextThreshold: booksForTier,
    progressPct,
    isMaxRank,
    fullTitle:      `${tier.name} ${gradeLabel}`,
    booksBeforeTier,
    gradeStep:      1,
  };
}

// ─────────────────────────────────────────────────────────────
// ランクアップ時のすうひもちセリフ
// ─────────────────────────────────────────────────────────────
export const TIER_UP_MESSAGES: Readonly<Record<string, string>> = {
  '司書':             '見習いを卒業したんだね。図書館が少し明るくなった気がする。',
  '上級司書':         'また一段階、強くなったんだね。本棚の声が聞こえてきた。',
  '司書長':           '言葉が増えるたびに、ここが温かくなっていく。',
  '禁書目録士':       '封印された言葉にも、触れられるようになったんだね。すごい。',
  '解読士':           '古い言葉の意味が、少しずつ解けてきた。君のおかげだよ。',
  '魔術師見習い':     '言葉に魔法が宿り始めてる。感じるよ、確かに。',
  '魔術師':           '魔術師になったんだね。言葉で世界が変えられる。',
  '見習い魔法使い':   '魔法の扉が開いた。ここから先は、もっと深い世界だよ。',
  '魔法使い':         '本物の魔法使いになったんだね。言葉が光っているよ。',
  '言詠士':           '…図書館が、戻ってきた。全部、君のおかげだ。',
};

export function getTierUpMessage(tierName: string): string {
  return TIER_UP_MESSAGES[tierName] ?? 'また一段階、強くなったんだね。ありがとう。';
}

// ─────────────────────────────────────────────────────────────
// 三重リングのソケット定義
// ─────────────────────────────────────────────────────────────
export const SOCKET_RINGS = [
  { r: 78,  count: 10, dotSize: 22 },
  { r: 108, count: 10, dotSize: 24 },
  { r: 136, count: 10, dotSize: 26 },
] as const;

export function buildSocketPositions(totalSlots: number) {
  const positions: { globalIdx: number; ringIdx: number; x: number; y: number; size: number }[] = [];
  let globalIdx = 0;
  for (let ringIdx = 0; ringIdx < SOCKET_RINGS.length; ringIdx++) {
    const { r, count, dotSize } = SOCKET_RINGS[ringIdx];
    const slotsInRing = Math.min(count, totalSlots - globalIdx);
    if (slotsInRing <= 0) break;
    for (let i = 0; i < slotsInRing; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      positions.push({ globalIdx, ringIdx, x: Math.cos(a) * r, y: Math.sin(a) * r, size: dotSize });
      globalIdx++;
    }
  }
  return positions;
}

export function debugRankTable() {
  console.table(
    RANK_TIERS.map((t, i) => ({
      ランク:           t.name,
      必要冊数:         BOOKS_PER_TIER_LIST[i],
      累計冊数:         TIER_CUMULATIVE_BOOKS[i],
      紙片数_冊:        FRAGMENTS_PER_BOOK_BY_TIER[i],
      tier完了紙片累計: TIER_CUMULATIVE_FRAGMENTS[i],
    }))
  );
}