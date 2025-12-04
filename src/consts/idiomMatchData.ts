/**
 * 熟語イメージ（アイコン合わせ）クイズデータ
 */

export interface IdiomMatch {
  idiom: string;
  meaning: string;
  correctIcon: string;
  wrongIcons: string[];
}

export const IDIOM_MATCHES: IdiomMatch[] = [
  {
    idiom: "piece of cake",
    meaning: "とても簡単",
    correctIcon: "🍰",
    wrongIcons: ["😨", "💪"]
  },
  {
    idiom: "break the ice",
    meaning: "場の雰囲気を和らげる",
    correctIcon: "🧊",
    wrongIcons: ["🔥", "❄️"]
  },
  {
    idiom: "hit the books",
    meaning: "勉強する",
    correctIcon: "📚",
    wrongIcons: ["🎮", "🎬"]
  },
  {
    idiom: "cost an arm and a leg",
    meaning: "非常に高価",
    correctIcon: "💰",
    wrongIcons: ["🆓", "💸"]
  },
  {
    idiom: "once in a blue moon",
    meaning: "めったにない",
    correctIcon: "🌙",
    wrongIcons: ["☀️", "⭐"]
  },
  {
    idiom: "the ball is in your court",
    meaning: "あなたの番です",
    correctIcon: "🎾",
    wrongIcons: ["⚽", "🏀"]
  },
  {
    idiom: "spill the beans",
    meaning: "秘密を漏らす",
    correctIcon: "🫘",
    wrongIcons: ["🔒", "🤐"]
  },
  {
    idiom: "under the weather",
    meaning: "体調が悪い",
    correctIcon: "🌧️",
    wrongIcons: ["☀️", "🌈"]
  },
  {
    idiom: "kill two birds with one stone",
    meaning: "一石二鳥",
    correctIcon: "🪨",
    wrongIcons: ["🐦", "🎯"]
  },
  {
    idiom: "barking up the wrong tree",
    meaning: "見当違い",
    correctIcon: "🌳",
    wrongIcons: ["🐕", "🎯"]
  }
];

