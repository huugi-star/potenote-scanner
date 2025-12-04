/**
 * 語順整序（SVOビルダー）クイズデータ
 */

export interface SyntaxPuzzle {
  words: string[];
  correctOrder: number[];
  sentence: string;
  translation: string;
}

export const SYNTAX_PUZZLES: SyntaxPuzzle[] = [
  {
    words: ["I", "love", "reading", "books"],
    correctOrder: [0, 1, 2, 3],
    sentence: "I love reading books.",
    translation: "私は本を読むことが好きです。"
  },
  {
    words: ["She", "is", "studying", "English", "now"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "She is studying English now.",
    translation: "彼女は今英語を勉強しています。"
  },
  {
    words: ["They", "will", "visit", "Tokyo", "next", "week"],
    correctOrder: [0, 1, 2, 3, 4, 5],
    sentence: "They will visit Tokyo next week.",
    translation: "彼らは来週東京を訪れるでしょう。"
  },
  {
    words: ["He", "can", "speak", "Japanese", "fluently"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "He can speak Japanese fluently.",
    translation: "彼は流暢に日本語を話せます。"
  },
  {
    words: ["We", "are", "going", "to", "the", "park"],
    correctOrder: [0, 1, 2, 3, 4, 5],
    sentence: "We are going to the park.",
    translation: "私たちは公園に行くところです。"
  },
  {
    words: ["I", "have", "finished", "my", "homework"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "I have finished my homework.",
    translation: "私は宿題を終えました。"
  },
  {
    words: ["She", "likes", "to", "play", "tennis"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "She likes to play tennis.",
    translation: "彼女はテニスをするのが好きです。"
  },
  {
    words: ["The", "cat", "is", "sleeping", "on", "the", "sofa"],
    correctOrder: [0, 1, 2, 3, 4, 5, 6],
    sentence: "The cat is sleeping on the sofa.",
    translation: "猫がソファの上で眠っています。"
  },
  {
    words: ["I", "want", "to", "learn", "French"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "I want to learn French.",
    translation: "私はフランス語を学びたいです。"
  },
  {
    words: ["They", "were", "watching", "TV", "yesterday"],
    correctOrder: [0, 1, 2, 3, 4],
    sentence: "They were watching TV yesterday.",
    translation: "彼らは昨日テレビを見ていました。"
  }
];

