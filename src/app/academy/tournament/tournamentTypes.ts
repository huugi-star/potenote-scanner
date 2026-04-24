import type { Item } from '@/data/items';

export type GamePhase =
  | 'lobby'
  | 'quiz'
  | 'result'
  | 'semifinal_category'
  | 'final_category'
  | 'tournament_final_result';

export type CpuStatus = 'thinking' | 'answered' | 'correct' | 'wrong';

export type Round = 'round1' | 'semi' | 'final';

export type TournamentReach =
  | 'none'
  | 'round1_eliminated'
  | 'semi_eliminated'
  | 'runner_up'
  | 'champion';

export type TournamentQuestion = {
  id: string;
  genre: string;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  correctRate: number | null;
  authorLabel: string;
};

export type EquippedSet = {
  head?: Item;
  body?: Item;
  face?: Item;
  accessory?: Item;
};

export type CpuPlayer = {
  id: string;
  name: string;
  accuracy: number;
  score: number;
  status: CpuStatus;
  equipped: EquippedSet;
  correctCount: number;
  answerTimesMs: number[];
  /** ユーザー回答前にCPUが答えた場合、ここに結果を一時保持して発表タイミングで加算する */
  pending?: { isCorrect: boolean; points: number; elapsedMs: number } | null;
};

export type RankingEntry = {
  id: string;
  name: string;
  score: number;
  isPlayer: boolean;
  equipped?: EquippedSet;
  correctCount: number;
  avgAnswerMs: number;
  qualified: boolean;
};

export type TournamentRewardSummary = {
  reachLabel: string;
  leaves: number;
  coins: number;
  bonusNames: string[];
};

export type MagicCircleState = { id: number; x: number; y: number; isCorrect: boolean };

export type RoundPoints = { total: number; base: number; bonus: number };
