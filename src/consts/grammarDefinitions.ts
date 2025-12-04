/**
 * grammarDefinitions.ts
 * 
 * 英語学習モード用の文法定義定数
 * AIのトークン消費を抑えるため、定型文言はフロントエンド側で管理
 */

// 1. 括弧（チャンクの形）の定義
export const GRAMMAR_TYPES = {
  noun_clause: {
    symbol: "[ ]",
    title: "名詞のカタマリ",
    definition: "文を成立させる「骨格」",
    description: "主語（S）や目的語（O）など、文の中心となる役割です。このブロックがないと意味が通じなくなります。",
    color: "bg-blue-50 border-blue-200 text-blue-900"
  },
  adj_clause: {
    symbol: "( )",
    title: "形容詞のカタマリ",
    definition: "名詞を説明する「肉付け」",
    description: "直前の名詞（人や物）が具体的にどんなものなのか、情報を付け足して分かりやすくします。",
    color: "bg-green-50 border-green-200 text-green-900"
  },
  adv_clause: {
    symbol: "< >",
    title: "副詞のカタマリ",
    definition: "文脈を広げる「背景情報」",
    description: "「いつ・どこで・なぜ」といった状況を説明します。あってもなくてもよい内容ですが、表現力を豊かにします。",
    color: "bg-gray-50 border-gray-200 text-gray-900"
  },
  verb_phrase: {
    symbol: "V",
    title: "動詞エリア",
    definition: "文の結論となる「動き」",
    description: "英語の心臓部です。ここが決まらないと文の意味が決まりません。",
    color: "bg-red-50 border-red-200 text-red-900"
  },
  adv_phrase: {
    symbol: "< >",
    title: "副詞句",
    definition: "文脈を広げる「背景情報」",
    description: "「いつ・どこで・なぜ」といった状況を説明します。あってもなくてもよい内容ですが、表現力を豊かにします。",
    color: "bg-gray-50 border-gray-200 text-gray-900"
  },
  noun_phrase: {
    symbol: "[ ]",
    title: "名詞句",
    definition: "文を成立させる「骨格」",
    description: "主語（S）や目的語（O）など、文の中心となる役割です。このブロックがないと意味が通じなくなります。",
    color: "bg-blue-50 border-blue-200 text-blue-900"
  }
} as const;

// 2. 文の要素（S, V, O, C）の定義
export const ELEMENT_TYPES = {
  S: {
    title: "S (Subject)",
    meaning: "文の「主人公」",
    desc: "「～は」「～が」にあたる、話の中心人物です。"
  },
  V: {
    title: "V (Verb)",
    meaning: "主人公の「動き・状態」",
    desc: "「～する」「～だ」にあたる結論部分です。"
  },
  O: {
    title: "O (Object)",
    meaning: "動きの「ターゲット」",
    desc: "「～を」「～に」にあたる、動作の受け手です。"
  },
  C: {
    title: "C (Complement)",
    meaning: "主人公の「イコール説明」",
    desc: "「S ＝ C」の関係（主語は～だ）を作り、状態を説明します。"
  },
  M: { 
    title: "M (Modifier)",
    meaning: "詳しい「修飾語」",
    desc: "他の言葉を詳しく説明している部分です。"
  },
  Connect: {
    title: "等位接続詞",
    meaning: "並列要素をつなぐ「接続詞」",
    desc: "and, but, or などで、同じ役割の要素を並列につなぎます。"
  }
} as const;

// 型定義のヘルパー
export type GrammarType = keyof typeof GRAMMAR_TYPES;
export type ElementType = keyof typeof ELEMENT_TYPES;

