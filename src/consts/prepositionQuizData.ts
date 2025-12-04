/**
 * 前置詞クイズデータ
 * 
 * 前置詞のコア・イメージを視覚的に理解できる問題集
 */

export interface PrepositionQuiz {
  sentence: string;
  options: string[];
  correct: string;
  explanation: {
    imageIcon: string;
    coreMeaning: string;
    detail: string;
  };
}

export const PREPOSITION_QUIZZES: PrepositionQuiz[] = [
  {
    sentence: "I am waiting ___ the bus.",
    options: ["for", "to", "at"],
    correct: "for",
    explanation: {
      imageIcon: "🏹",
      coreMeaning: "方向・ターゲット",
      detail: "forは「指差すイメージ」。バスという「目的」に向かって気持ちが向いています。"
    }
  },
  {
    sentence: "Look ___ the blackboard.",
    options: ["at", "on", "in"],
    correct: "at",
    explanation: {
      imageIcon: "📍",
      coreMeaning: "一点集中",
      detail: "atは地図上の「点」。黒板という「一点」を指して見ています。"
    }
  },
  {
    sentence: "The apple is ___ the table.",
    options: ["on", "in", "above"],
    correct: "on",
    explanation: {
      imageIcon: "🔛",
      coreMeaning: "接触（くっついている）",
      detail: "onは「上に」ではなく「接触」。テーブルの面にピタッとくっついています。"
    }
  },
  {
    sentence: "The book is ___ the drawer.",
    options: ["in", "on", "at"],
    correct: "in",
    explanation: {
      imageIcon: "📦",
      coreMeaning: "容器・範囲内",
      detail: "inは「容器の中」。引き出しという「容器」の中に本が入っています。"
    }
  },
  {
    sentence: "I go ___ school every day.",
    options: ["to", "for", "at"],
    correct: "to",
    explanation: {
      imageIcon: "🏁",
      coreMeaning: "到達・目的地",
      detail: "toは「到達点」。学校という「目的地」に到達するイメージです。"
    }
  },
  {
    sentence: "She lives ___ Tokyo.",
    options: ["in", "at", "on"],
    correct: "in",
    explanation: {
      imageIcon: "🗺️",
      coreMeaning: "範囲内・領域",
      detail: "inは「広い範囲の中」。東京という「領域」の中に住んでいます。"
    }
  },
  {
    sentence: "The cat is sleeping ___ the sofa.",
    options: ["on", "in", "at"],
    correct: "on",
    explanation: {
      imageIcon: "🛋️",
      coreMeaning: "接触・表面",
      detail: "onは「接触」。ソファの表面に接触して寝ています。"
    }
  },
  {
    sentence: "I'm looking ___ my keys.",
    options: ["for", "at", "to"],
    correct: "for",
    explanation: {
      imageIcon: "🔍",
      coreMeaning: "目的・探求",
      detail: "forは「目的に向かう」。鍵という「目的」を探しています。"
    }
  },
  {
    sentence: "The picture is hanging ___ the wall.",
    options: ["on", "in", "at"],
    correct: "on",
    explanation: {
      imageIcon: "🖼️",
      coreMeaning: "接触・固定",
      detail: "onは「接触」。壁という「面」に接触して固定されています。"
    }
  },
  {
    sentence: "I arrived ___ the station.",
    options: ["at", "in", "to"],
    correct: "at",
    explanation: {
      imageIcon: "🚉",
      coreMeaning: "特定の地点",
      detail: "atは「特定の点」。駅という「特定の地点」に到着しました。"
    }
  },
  {
    sentence: "She is good ___ math.",
    options: ["at", "in", "for"],
    correct: "at",
    explanation: {
      imageIcon: "📐",
      coreMeaning: "特定分野・能力",
      detail: "atは「特定の分野」。数学という「特定分野」で優れています。"
    }
  },
  {
    sentence: "The bird is flying ___ the sky.",
    options: ["in", "on", "at"],
    correct: "in",
    explanation: {
      imageIcon: "☁️",
      coreMeaning: "空間・環境",
      detail: "inは「空間の中」。空という「空間」の中を飛んでいます。"
    }
  },
  {
    sentence: "I'm waiting ___ you.",
    options: ["for", "to", "at"],
    correct: "for",
    explanation: {
      imageIcon: "⏳",
      coreMeaning: "対象・目的",
      detail: "forは「対象に向かう」。あなたという「対象」を待っています。"
    }
  },
  {
    sentence: "The meeting starts ___ 3 o'clock.",
    options: ["at", "on", "in"],
    correct: "at",
    explanation: {
      imageIcon: "🕐",
      coreMeaning: "特定の時点",
      detail: "atは「特定の時点」。3時という「特定の時点」を指しています。"
    }
  },
  {
    sentence: "I'm interested ___ music.",
    options: ["in", "at", "for"],
    correct: "in",
    explanation: {
      imageIcon: "🎵",
      coreMeaning: "関心の対象",
      detail: "inは「中に入る」。音楽という「対象」の中に興味が入っています。"
    }
  },
  {
    sentence: "She is afraid ___ spiders.",
    options: ["of", "at", "for"],
    correct: "of",
    explanation: {
      imageIcon: "🕷️",
      coreMeaning: "分離・所属",
      detail: "ofは「～から分離」または「～の一部」。クモという「対象」から離れたい気持ち。"
    }
  },
  {
    sentence: "I'm proud ___ my son.",
    options: ["of", "at", "for"],
    correct: "of",
    explanation: {
      imageIcon: "👨‍👦",
      coreMeaning: "所属・関係",
      detail: "ofは「所属関係」。息子という「所属」に対する誇りです。"
    }
  },
  {
    sentence: "The shop is ___ the corner.",
    options: ["at", "on", "in"],
    correct: "at",
    explanation: {
      imageIcon: "🏪",
      coreMeaning: "特定の位置",
      detail: "atは「特定の位置」。角という「特定の位置」に店があります。"
    }
  },
  {
    sentence: "I'm thinking ___ you.",
    options: ["about", "at", "for"],
    correct: "about",
    explanation: {
      imageIcon: "💭",
      coreMeaning: "周辺・関連",
      detail: "aboutは「周辺を回る」。あなたの「周辺」について考えています。"
    }
  },
  {
    sentence: "The ball is ___ the box.",
    options: ["in", "on", "at"],
    correct: "in",
    explanation: {
      imageIcon: "📦",
      coreMeaning: "容器の中",
      detail: "inは「容器の中」。箱という「容器」の中にボールが入っています。"
    }
  }
];

