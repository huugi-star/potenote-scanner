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
  SOCKET_RINGS,
  buildSocketPositions,
  calcBooksFromFragments,
  calcRankInfo,
  TIER_UP_MESSAGES,
  getTierUpMessage,
  debugRankTable,
} from '@/lib/repairBookRankSystem';
