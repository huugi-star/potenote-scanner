/**
 * ネイティブ判定（どっちが自然？）クイズデータ
 */

export interface NuanceSwipe {
  natural: string;
  unnatural: string;
  explanation: string;
}

export const NUANCE_SWIPES: NuanceSwipe[] = [
  {
    natural: "I'm excited about the trip.",
    unnatural: "I'm exciting about the trip.",
    explanation: "人を主語にする時は-ed（excited）。物を主語にする時は-ing（exciting）。"
  },
  {
    natural: "This movie is interesting.",
    unnatural: "This movie is interested.",
    explanation: "物（movie）を主語にする時は-ing（interesting）。人を主語にする時は-ed（interested）。"
  },
  {
    natural: "I'm bored with this game.",
    unnatural: "I'm boring with this game.",
    explanation: "人を主語にする時は-ed（bored）。物を主語にする時は-ing（boring）。"
  },
  {
    natural: "I'm confused about the problem.",
    unnatural: "I'm confusing about the problem.",
    explanation: "人を主語にする時は-ed（confused）。物を主語にする時は-ing（confusing）。"
  },
  {
    natural: "The news was surprising.",
    unnatural: "The news was surprised.",
    explanation: "物（news）を主語にする時は-ing（surprising）。人を主語にする時は-ed（surprised）。"
  },
  {
    natural: "I'm tired of waiting.",
    unnatural: "I'm tiring of waiting.",
    explanation: "人を主語にする時は-ed（tired）。物を主語にする時は-ing（tiring）。"
  },
  {
    natural: "This book is worth reading.",
    unnatural: "This book is worth to read.",
    explanation: "worthの後は動名詞（reading）。不定詞（to read）は使えません。"
  },
  {
    natural: "I'm looking forward to meeting you.",
    unnatural: "I'm looking forward to meet you.",
    explanation: "look forward toの後は動名詞（meeting）。toは前置詞なので、動名詞が続きます。"
  },
  {
    natural: "I'm used to getting up early.",
    unnatural: "I'm used to get up early.",
    explanation: "be used toの後は動名詞（getting）。toは前置詞なので、動名詞が続きます。"
  },
  {
    natural: "I enjoy playing tennis.",
    unnatural: "I enjoy to play tennis.",
    explanation: "enjoyの後は動名詞（playing）。不定詞（to play）は使えません。"
  }
];

