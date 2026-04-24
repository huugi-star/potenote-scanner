import type { AcademyUserQuestion } from '@/types';
import { PREFERRED_QUESTIONS, TOTAL_QUESTIONS } from './tournamentConstants';
import { shuffle } from './tournamentCpu';
import type { TournamentQuestion } from './tournamentTypes';

export function extractGenre(q: AcademyUserQuestion): string {
  return q.bigCategory || q.subCategory || q.subjectText || q.detailText || q.keywords[0] || 'その他';
}

export function toTournamentQuestion(q: AcademyUserQuestion): TournamentQuestion | null {
  if (!Array.isArray(q.choices) || q.choices.length < 4) return null;
  if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) return null;
  const base = q.choices.slice(0, 4);
  const ansIdx = base.indexOf(q.choices[q.answerIndex]);
  if (ansIdx < 0) return null;
  const perm = shuffle([0, 1, 2, 3]);
  const shuffled: [string, string, string, string] = [base[perm[0]!], base[perm[1]!], base[perm[2]!], base[perm[3]!]];
  const displayAnswerIndex = perm.indexOf(ansIdx);
  const play = Math.max(0, Number(q.playCount ?? 0));
  const cor = Math.max(0, Number(q.correctCount ?? 0));
  const correctRate = play > 0 ? Math.max(0, Math.min(100, Math.floor((cor / play) * 100))) : null;
  const rawAuthor = String(q.authorName ?? '').trim();
  return {
    id: q.id,
    genre: extractGenre(q),
    question: q.question,
    choices: displayAnswerIndex >= 0 ? shuffled : [base[0], base[1], base[2], base[3]],
    answerIndex: displayAnswerIndex >= 0 ? displayAnswerIndex : ansIdx,
    correctRate,
    authorLabel: !rawAuthor || rawAuthor === '匿名ユーザー' ? '匿名' : rawAuthor,
  };
}

export function getPreferredGenres(questions: AcademyUserQuestion[]): string[] {
  const map = new Map<string, number>();
  for (const q of questions) {
    const play = Math.max(0, Number(q.playCount ?? 0));
    if (play <= 0) continue;
    const g = extractGenre(q);
    map.set(g, (map.get(g) ?? 0) + play);
  }
  if (map.size === 0) {
    const cnt = new Map<string, number>();
    for (const q of questions) {
      const g = extractGenre(q);
      cnt.set(g, (cnt.get(g) ?? 0) + 1);
    }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
}

export function buildQuestions(src: AcademyUserQuestion[], preferred: string[]): TournamentQuestion[] {
  const all = Array.from(
    new Map(
      src
        .map(toTournamentQuestion)
        .filter((q): q is TournamentQuestion => !!q)
        .map((q) => [q.id, q])
    ).values()
  );
  const pref = shuffle(all.filter((q) => preferred.includes(q.genre))).slice(0, PREFERRED_QUESTIONS);
  const prefIds = new Set(pref.map((q) => q.id));
  const rand = shuffle(all.filter((q) => !prefIds.has(q.id))).slice(0, TOTAL_QUESTIONS - pref.length);
  const sel = [...pref, ...rand];
  if (sel.length < TOTAL_QUESTIONS) {
    const selIds = new Set(sel.map((q) => q.id));
    sel.push(
      ...shuffle(all.filter((q) => !selIds.has(q.id))).slice(0, TOTAL_QUESTIONS - sel.length)
    );
  }
  return shuffle(sel).slice(0, TOTAL_QUESTIONS);
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function pickRandomDistinct<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
}

export function buildQuestionsForGenre(
  src: AcademyUserQuestion[],
  genre: string,
  genreCount: number,
  randomCount: number
): TournamentQuestion[] {
  const all = Array.from(
    new Map(
      src
        .map(toTournamentQuestion)
        .filter((q): q is TournamentQuestion => !!q)
        .map((q) => [q.id, q])
    ).values()
  );
  const genrePool = all.filter((q) => q.genre === genre);
  const pickedGenre = shuffle(genrePool).slice(0, genreCount);
  const pickedIds = new Set(pickedGenre.map((q) => q.id));
  const randomPool = all.filter((q) => !pickedIds.has(q.id));
  const pickedRandom = shuffle(randomPool).slice(0, randomCount);
  return shuffle([...pickedGenre, ...pickedRandom]).slice(0, genreCount + randomCount);
}
