import type { CpuStatus, Round, TournamentReach } from './tournamentTypes';

// ─── Quiz / タイマー ───────────────────────────────────────────────────────
export const TOTAL_QUESTIONS = 10;
export const PREFERRED_QUESTIONS = 5;
export const TIME_LIMIT_MS = 10_000;
export const TIME_LIMIT_SEC = TIME_LIMIT_MS / 1000;
export const BASE_SCORE = 10;
/** 秒数ボーナスは最大10点（正解10＋ボーナス10＝一問最大20点） */
export const MAX_TIME_BONUS = 10;
export const CPU_NAME_CANDIDATES = [
  'コトノ', 'リブラ', 'ユラ', 'ノート', 'シグ', 'ミモ', 'レフ', 'トワ', 'セナ', 'アルク',
];
export const MAGIC_CIRCLE_DURATION_MS = 450;
export const FEEDBACK_ADVANCE_MS = 1000;

/** 到達に応じた仮報酬（ことの葉 / ポテコイン） */
export const TOURNAMENT_REWARD_BASE: Record<Exclude<TournamentReach, 'none'>, { leaves: number; coins: number }> = {
  round1_eliminated: { leaves: 5, coins: 50 },
  semi_eliminated:   { leaves: 10, coins: 100 },
  runner_up:         { leaves: 15, coins: 150 },
  champion:          { leaves: 30, coins: 300 },
};

export const TOURNAMENT_REACH_RESULT_LABEL: Record<Exclude<TournamentReach, 'none'>, string> = {
  round1_eliminated: '1回戦敗退',
  semi_eliminated:   '準決勝敗退',
  runner_up:         '準優勝',
  champion:          '優勝',
};

export const PERFECT_ROUND_BONUS = { leaves: 5, coins: 50 };

// ─── 結果表示 ────────────────────────────────────────────────────────────
export const RANK_EMOJI = ['🥇', '🥈', '🥉', '4', '5'];
export const STATUS_LABEL: Record<CpuStatus, string> = {
  thinking: '考え中…', answered: '回答済み', correct: '正解！', wrong: '不正解',
};
export const STATUS_COLOR: Record<CpuStatus, string> = {
  thinking: '#94a3b8',
  answered: 'rgba(250,204,21,0.85)',
  correct: '#34d399',
  wrong: '#f87171',
};

// ─── Confetti（同ファイル内の UI で使用）────────────────────────────────
export const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c'];

// ─── 順位テキスト（進出/敗退の進行表示）────────────────────────────────
export function getRankText(
  rank: number,
  round: Round,
  qualificationSlots: number
): {
  headline: string;
  sub: string;
  color: string;
  advance: boolean;
} {
  const advance = rank >= 0 && rank < qualificationSlots;

  if (round === 'round1') {
    if (rank === 0) return { headline: '1位通過！', sub: '準決勝進出おめでとう！', color: '#fde68a', advance: true };
    if (rank === 1) return { headline: '2位通過！', sub: '準決勝進出！', color: '#e2e8f0', advance: true };
    if (rank === 2) return { headline: '3位通過！', sub: '準決勝進出！', color: '#fb923c', advance: true };
    if (rank === 3) return { headline: '4位 敗退…', sub: '惜しくも一回戦敗退', color: '#94a3b8', advance: false };
    return { headline: '5位 敗退…', sub: 'また挑戦してみよう！', color: '#94a3b8', advance: false };
  }

  if (round === 'semi') {
    if (rank === 0) return { headline: '1位通過！', sub: '決勝進出おめでとう！', color: '#fde68a', advance: true };
    if (rank === 1) return { headline: '2位通過！', sub: '決勝進出！', color: '#e2e8f0', advance: true };
    return { headline: '敗退…', sub: '惜しくも準決勝敗退', color: '#94a3b8', advance: false };
  }

  return {
    headline: advance ? '通過！' : '敗退…',
    sub: '',
    color: advance ? '#fde68a' : '#94a3b8',
    advance,
  };
}
