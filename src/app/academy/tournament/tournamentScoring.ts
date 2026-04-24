import {
  BASE_SCORE,
  MAX_TIME_BONUS,
  PERFECT_ROUND_BONUS,
  TIME_LIMIT_SEC,
  TOURNAMENT_REACH_RESULT_LABEL,
  TOURNAMENT_REWARD_BASE,
} from './tournamentConstants';
import type { RoundPoints, TournamentReach, TournamentRewardSummary } from './tournamentTypes';

export function buildTournamentRewardSummary(
  reach: Exclude<TournamentReach, 'none'>,
  allCorrectInRound: boolean
): TournamentRewardSummary {
  const base = TOURNAMENT_REWARD_BASE[reach];
  const bonusNames: string[] = [];
  let leaves = base.leaves;
  let coins = base.coins;
  if (allCorrectInRound) {
    leaves += PERFECT_ROUND_BONUS.leaves;
    coins += PERFECT_ROUND_BONUS.coins;
    bonusNames.push('全問正解ボーナス');
  }
  return {
    reachLabel: TOURNAMENT_REACH_RESULT_LABEL[reach],
    leaves,
    coins,
    bonusNames,
  };
}

/** 1問あたり最大20点（正解10 ＋ 秒数ボーナス最大10） */
export function calcPoints(isCorrect: boolean, remainingSec: number): RoundPoints {
  if (!isCorrect) return { total: 0, base: 0, bonus: 0 };
  const base = BASE_SCORE;
  const rem = Math.max(0, Math.min(TIME_LIMIT_SEC, remainingSec));
  const bonus = Math.min(
    MAX_TIME_BONUS,
    Math.round((rem / TIME_LIMIT_SEC) * MAX_TIME_BONUS)
  );
  const total = base + bonus;
  return { total, base, bonus };
}
