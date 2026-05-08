/**
 * 修繕・ランク用の定数・計算（本体は lib に集約）
 * @see src/lib/repairBookRankSystem.ts
 */
export {
  RANK_TIERS,
  BOOKS_PER_TIER_LIST,
  TIER_CUMULATIVE_BOOKS,
  TIER_CUMULATIVE_FRAGMENTS,
  TOTAL_BOOKS_MAX,
  TOTAL_FRAGMENTS_MAX,
  FRAGMENTS_PER_BOOK_BY_TIER,
  GRADES_PER_TIER,
  TOTAL_TIERS,
  BOOKS_PER_TIER,
  UNLOCK_WORD_COLLECTION_MIN_TIER_INDEX,
  UNLOCK_ENGLISH_LEARNING_TRANSLATION_MIN_TIER_INDEX,
  SOCKET_RINGS,
  buildSocketPositions,
  calcBooksFromFragments,
  calcRankInfo,
  TIER_UP_MESSAGES,
  getTierUpMessage,
  debugRankTable,
  SUHIMOCHI_INTIMACY_POINTS_BASE_CAP,
  SUHIMOCHI_INTIMACY_EXTRA_CAP_PER_TIER,
  getSuhimochiIntimacyPointsCapForTierIndex,
  calcSuhimochiIntimacyLevelFromPoints,
} from '@/lib/repairBookRankSystem';
