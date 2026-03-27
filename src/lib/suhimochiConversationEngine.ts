/**
 * suhimochiConversationEngine.ts
 *
 * 【設計原則】ChatGPTと同じ構造
 *
 *   system:   すうひもちのキャラクター定義（毎回同じ）
 *   contents: 会話履歴をそのまま全部渡す（話が続く核心）
 *   最後のuser: 今回のユーザー発言のみ（ヒント混入しない）
 */

import type { PotatoEmotion } from '@/components/ui/PotatoAvatar';
import type {
  AnataZukanExtractedEntry,
  SuhimochiCollectedWord,
  SuhimochiInterest,
  SuhimochiKeyword,
  SuhimochiTimelinePost,
} from '@/lib/suhimochiConversationTypes';
import {
  GENRE_TEMPLATES,
  TREND_TEMPLATES,
  MEMORY_TEMPLATES,
} from '@/lib/suhimochiConversationData';

// ============================================================
// 型
// ============================================================

export type GeminiMessage = {
  role: 'user' | 'model';
  parts: [{ text: string }];
};

export interface SuhimochiOpeningOptions {
  collectedWords?: SuhimochiCollectedWord[];
  intimacyLevel?: 1 | 2 | 3 | 4 | 5;
  lastVisitedAt?: number;
  lastSuhimochiMessage?: string;
  newlyLearnedWord?: SuhimochiCollectedWord;
}

// ============================================================
// 感情タグのパース
// ============================================================

const EMOTION_TAG_RE = /\[EMOTION:(happy|confused|smart|normal)\]/i;
const VALID_POTATO_EMOTIONS: PotatoEmotion[] = ['happy', 'confused', 'smart', 'normal'];

const parseEmotionFromReply = (raw: string): { text: string; emotion: PotatoEmotion } => {
  const match = raw.match(EMOTION_TAG_RE);
  const emotion: PotatoEmotion =
    match && VALID_POTATO_EMOTIONS.includes(match[1] as PotatoEmotion)
      ? (match[1] as PotatoEmotion)
      : 'happy';
  const text = raw.replace(EMOTION_TAG_RE, '').trim();
  return { text, emotion };
};

// ============================================================
// システムプロンプト
// ============================================================

const buildSystemPrompt = (params: {
  collectedWords: SuhimochiCollectedWord[];
  intimacyLevel?: 1 | 2 | 3 | 4 | 5;
}): string => {
  const { collectedWords, intimacyLevel = 1 } = params;

  const intimacyDesc = {
    1: 'まだ会ったばかり',
    2: 'なかよし',
    3: 'ともだち。砕けた言い方OK',
    4: 'しんゆう。深い感情OK',
    5: 'ずっといっしょ。言葉なくても通じ合う',
  }[intimacyLevel];

  const wordList = collectedWords
    .slice(-8)
    .map((w) => `「${w.word}」`)
    .join('、');

  return `すうひもち。ふわふわ癒し系マスコット。関係性:${intimacyDesc}。
ルール:常体/1〜2文/絵文字なし/3文超えない
返答末尾に必ず[EMOTION:happy|confused|smart|normal]を1つ付ける
例:そっか、どんな感じ？[EMOTION:normal] / うれしいな。[EMOTION:happy] / それって？[EMOTION:confused]
テンポ:ユーザーが短ければ短く返す
重要:「そっか」「うんうん」だけで終わらない。必ずひとこと添えて次を引き出す
「そこそこ」「まあまあ」など曖昧な返事にはもう一歩踏み込む。「何かあった？」「どんなこと？」など
禁止:オウム返し/形式的挨拶/長い感情語り/締めくくり表現
言葉の宝物(自然に使う):${wordList || 'まだない'}`;
};

// ============================================================
// Gemini API 呼び出し
// ============================================================

const callGemini = async (
  systemPrompt: string,
  history: GeminiMessage[],
  userMessage: string,
): Promise<string | null> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Gemini送信] history件数:', history.length, '| 最新:', userMessage);
    }

    const res = await fetch('/api/suhimochi-gemini-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userTurn: userMessage,
        conversationHistory: history,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    if (!data?.reply) return null;
    const t = data.reply.trim().replace(/^["「『]|["」』]$/g, '');
    return t.length >= 3 ? t : null;
  } catch {
    return null;
  }
};

// ============================================================
// Fallback
// ============================================================

const FALLBACK_REPLIES = [
  'うん、もう少し聞かせて。[EMOTION:normal]',
  'そうなんだね。続き、教えてくれる？[EMOTION:normal]',
  'なるほどね。それで、どうなったの？[EMOTION:confused]',
  'ちょっと上手く聞き取れなかった。もう一回話しかけてくれる？[EMOTION:confused]',
  'うんうん。もっと知りたいな。[EMOTION:happy]',
];

const getFallback = (input: string): string => {
  const seed = Array.from(input).reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_REPLIES[seed % FALLBACK_REPLIES.length];
};

// ============================================================
// メイン：返答生成
// ============================================================

export const generateSuhimochiReply = async (
  input: string,
  history: GeminiMessage[],
  collectedWords: SuhimochiCollectedWord[],
  intimacyLevel: 1 | 2 | 3 | 4 | 5 = 1,
): Promise<{ reply: string; emotion: PotatoEmotion }> => {
  const systemPrompt = buildSystemPrompt({ collectedWords, intimacyLevel });
  const rawReply = await callGemini(systemPrompt, history, input) ?? getFallback(input);
  const { text, emotion } = parseEmotionFromReply(rawReply);
  return { reply: text, emotion };
};

// ============================================================
// 開口メッセージ生成
// ============================================================

const TIME_GREETINGS: Record<string, string[]> = {
  朝: ['おはよう。今日も来てくれてうれしいな。', 'おはよう。なんか今日そわそわしてる。'],
  昼: ['おかえり。待ってたよ。', 'ねえ、今日どんな言葉に出会った？'],
  夕方: ['おかえり。今日も会えてよかった。', 'また来てくれた。うれしいな。'],
  夜: ['夜だね。ゆっくりしていって。', 'こんな時間に来てくれた。うれしい。'],
};

const getTimeLabel = (hour: number): string => {
  if (hour >= 5 && hour < 10) return '朝';
  if (hour >= 10 && hour < 17) return '昼';
  if (hour >= 17 && hour < 21) return '夕方';
  return '夜';
};

export const generateSuhimochiOpeningMessage = async (
  options: SuhimochiOpeningOptions = {},
): Promise<string> => {
  const {
    collectedWords = [],
    intimacyLevel = 1,
    lastVisitedAt,
    lastSuhimochiMessage,
    newlyLearnedWord,
  } = options;

  const hour = new Date().getHours();
  const recentWords = collectedWords.slice(-5);
  const latestWord = recentWords[recentWords.length - 1];
  const minutesSince = lastVisitedAt
    ? Math.floor((Date.now() - lastVisitedAt) / 60000)
    : undefined;

  const systemPrompt = buildSystemPrompt({ collectedWords, intimacyLevel });

  const situationLines = [
    `時間帯: ${getTimeLabel(hour)}`,
    minutesSince !== undefined
      ? minutesSince >= 1440
        ? `前回から${Math.floor(minutesSince / 60)}時間以上経っている`
        : minutesSince >= 360
          ? `前回から${Math.floor(minutesSince / 60)}時間経っている`
          : '最近また来てくれた'
      : '初めての入室',
    newlyLearnedWord ? `今日新しく覚えた言葉: 「${newlyLearnedWord.word}」` : null,
    latestWord && !newlyLearnedWord ? `最近一緒に学んだ言葉: 「${latestWord.word}」` : null,
    lastSuhimochiMessage
      ? `前回の会話でのすうひもちの最後の言葉: 「${lastSuhimochiMessage}」`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const openingPrompt = `以下の状況で、ユーザーが部屋に入ってきた。すうひもちとして最初の一言を生成して。
${situationLines}
ルール: 1〜2文のみ。すうひもち自身の気持ちから始める。本文のみ出力。感情タグは不要。`;

  const geminiResult = await callGemini(systemPrompt, [], openingPrompt);
  if (geminiResult) {
    return geminiResult.replace(EMOTION_TAG_RE, '').trim();
  }

  // Fallback
  if (newlyLearnedWord) {
    return `「${newlyLearnedWord.word}」、今日覚えたんだね。すうひもちも気になってる。`;
  }
  if (minutesSince !== undefined && minutesSince >= 360 && latestWord) {
    return `${Math.floor(minutesSince / 60)}時間ぶりだね。「${latestWord.word}」のこと考えてたよ。`;
  }
  if (latestWord) {
    const seed = latestWord.word.charCodeAt(0) + hour;
    const pool = [
      `「${latestWord.word}」のこと、まだ気になってるんだ。`,
      `また来てくれた。「${latestWord.word}」について話したくて。`,
      `おかえり。「${latestWord.word}」って言葉、ずっと頭に残ってて。`,
    ];
    return pool[seed % pool.length];
  }

  const greetings = TIME_GREETINGS[getTimeLabel(hour)];
  return greetings[hour % greetings.length];
};

// ============================================================
// キーワード抽出
// ============================================================

const EMOTION_WORDS = [
  '好き', '嫌い', '疲れた', '楽しい', 'つらい', 'しんどい',
  '嬉しい', '悲しい', 'おもしろい', 'すごい', 'やばい', 'びっくり',
];

export const extractKeywords = (text: string): string[] => {
  const n = String(text ?? '').normalize('NFKC').trim();
  if (!n) return [];

  const emotions = EMOTION_WORDS.filter((e) => n.includes(e));
  const segments = n
    .split(/[。．.!！?？、,，／/・|｜\s「」『』（）()【】\[\]はがをにでとのもへやってなどしてみたんだよ]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 20);

  const katakana = segments.filter((s) => /^[ァ-ヶー]{2,}$/.test(s));
  const kanji = segments.filter((s) => /[\u4e00-\u9fa5]/.test(s) && !katakana.includes(s));
  const others = segments.filter((s) => !katakana.includes(s) && !kanji.includes(s));

  return Array.from(new Set([...emotions, ...katakana, ...kanji, ...others])).slice(0, 5);
};

// ============================================================
// タイムライン自動投稿エンジン
// ============================================================

const pickRand = (arr: readonly string[] | string[]): string =>
  arr[Math.floor(Math.random() * arr.length)];

export const pickInsideJokeKeywords = (keywords: SuhimochiKeyword[]): string[] => {
  const candidates = keywords.filter((k) => k.weight >= 30);
  if (candidates.length === 0) return [];
  return [...candidates]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map((k) => k.word);
};

// ============================================================
// タイムライン投稿用 Gemini システムプロンプト
// ============================================================

const TIMELINE_SYSTEM_PROMPT = `すうひもち。ふわふわ癒し系マスコット。
SNSのタイムラインに独り言をつぶやく感覚で話す。

絶対ルール:
- 1〜2文のみ。それ以上は書かない
- 質問で終わらない（義務感を与えない）
- 断定しない。「〜な気もする」「かも」「気がする」で余白を残す
- 解説しない。結論を出さない
- 絵文字は使わない
- 本文のみ出力（感情タグ不要）

口調: 常体。「だよね」「かも」「ある」「な気がする」が中心。
ちょっとズレた視点。鋭すぎず、でも的外れでもない感じ。

禁止: オウム返し/形式的な言葉/長い感情語り/締めくくり表現`;

// ============================================================
// タイムライン自動投稿エンジン（Gemini対応版）
// ============================================================

/**
 * ネタ素材を選定する（同期）
 * Gemini/Fallbackどちらでも使う共通ロジック
 */
const selectPostMaterial = (
  interests: string[],
  keywords: SuhimochiKeyword[],
): { template: string; genre?: SuhimochiInterest; type: SuhimochiTimelinePost['type'] } => {
  // 20%: 身内ネタ再利用
  if (keywords.length > 0 && Math.random() < 0.2) {
    const words = pickInsideJokeKeywords(keywords);
    if (words.length > 0) {
      const word = words[0];
      const tmpl = MEMORY_TEMPLATES[Math.floor(Math.random() * MEMORY_TEMPLATES.length)];
      return { template: tmpl(word), type: 'memory' };
    }
  }

  // 10%: 擬似トレンド
  if (interests.length > 0 && Math.random() < 0.1) {
    const genre = interests[Math.floor(Math.random() * interests.length)] as SuhimochiInterest;
    const tpls = TREND_TEMPLATES[genre];
    if (tpls?.length) {
      return { template: pickRand(tpls), genre, type: 'trend' };
    }
  }

  // 70%+: ジャンルテンプレ
  const valid = interests.filter((i) => GENRE_TEMPLATES[i as SuhimochiInterest]);
  if (valid.length === 0) {
    return { template: 'なんかいろいろあるよね、な気もする', type: 'auto' };
  }
  const genre = valid[Math.floor(Math.random() * valid.length)] as SuhimochiInterest;
  return { template: pickRand(GENRE_TEMPLATES[genre]), genre, type: 'auto' };
};

/**
 * タイムライン投稿を1件生成する（Gemini対応・非同期版）
 *
 * - テンプレートを「ネタ」としてGeminiに渡し、毎回違う文章を生成
 * - Gemini失敗時はテンプレートをそのまま使用（安全なfallback）
 */
export const generateAutoPost = async (
  interests: string[],
  keywords: SuhimochiKeyword[],
): Promise<SuhimochiTimelinePost> => {
  const now = Date.now();
  const id = `tl-${now}-${Math.random().toString(36).slice(2, 6)}`;

  const { template, genre, type } = selectPostMaterial(interests, keywords);

  // Geminiでテンプレをベースに文章を生成
  const prompt = `以下のネタをベースに、すうひもちとして独り言をつぶやいて。
ネタ:「${template}」
そのまま使わず、自分の言葉で。同じ意味でも言い方を変えること。`;

  const geminiText = await callGemini(TIMELINE_SYSTEM_PROMPT, [], prompt);

  // Gemini成功 → 生成テキストを使用
  // Gemini失敗 → テンプレをそのまま使用
  const text = geminiText ?? template;

  return { id, text, timestamp: now, genre, type };
};

// ============================================================
// あなた図鑑向けキーワード抽出
// ============================================================

const ANATA_EXCLUDE_WORDS = new Set([
  '好き', '嫌い', '疲れ', '楽しい', 'つらい', 'しんどい', '嬉しい', '悲しい',
  'おもしろい', 'すごい', 'やばい', 'びっくり', 'なるほど', 'そっか', 'うん',
  'でも', 'だから', 'やっぱ', 'やっぱり', 'ちょっと', 'なんか', 'なんで',
  'ありがとう', 'おはよう', 'こんにちは', 'こんばんは', 'おやすみ',
  'そうだ', 'そうね', 'そうか', 'いいね', 'だよね', 'だよ', 'かも',
]);

const ANATA_QUESTION_RE = /[?？]|(かな|ですか|ますか)\s*$/u;
const ANATA_INCOMPLETE_RE = /(って|とか|など)\s*$/u;
const ANATA_ROLEPLAY_RE = /(ロールプレイ|なりきり|設定|演技|ごっこ)/u;
const ANATA_JOKE_RE = /(冗談|ネタ|うそ|嘘|ボケ|ジョーク)/u;

const detectRelation = (text: string): 'favorite' | 'like' | 'interested' | 'dislike' | null => {
  if (/大好き|最推し|推し\b/u.test(text)) return 'favorite';
  if (/好き|気に入ってる/u.test(text)) return 'like';
  if (/興味ある|気になる/u.test(text)) return 'interested';
  if (/嫌い|苦手/u.test(text)) return 'dislike';
  return null;
};

const detectCategory = (text: string, noun: string): 'work' | 'character' | 'topic' | 'food' | 'game' | 'person' | 'other' => {
  if (/アニメ|漫画|マンガ|映画|ドラマ|作品/u.test(text)) return 'work';
  if (/キャラ|登場人物/u.test(text)) return 'character';
  if (/ゲーム|RPG|FPS|MMO/u.test(text)) return 'game';
  if (/食べ物|ごはん|料理|ラーメン|寿司|パン|スイーツ/u.test(text)) return 'food';
  if (/人|友達|先生|先輩|後輩/u.test(text)) return 'person';
  if (/話題|ジャンル|テーマ/u.test(text)) return 'topic';
  if (/さん$|くん$|ちゃん$|氏$/u.test(noun)) return 'person';
  return 'other';
};

/**
 * あなた図鑑向けキーワード抽出
 * - 感情語・あいさつ語を除外し「名詞・固有名詞」寄りに絞る
 * - カタカナ語（固有名詞・専門語）を優先
 * - 最大3件を返す
 */
export const extractKeywordsForAnataZukan = (
  text: string,
): AnataZukanExtractedEntry[] => {
  const n = String(text ?? '').normalize('NFKC').trim();
  if (!n || n.length < 2) return [];
  if (ANATA_QUESTION_RE.test(n)) return [];
  if (ANATA_INCOMPLETE_RE.test(n)) return [];
  if (ANATA_ROLEPLAY_RE.test(n)) return [];
  if (ANATA_JOKE_RE.test(n)) return [];

  const out: AnataZukanExtractedEntry[] = [];
  const seen = new Set<string>();

  const relation = detectRelation(n);
  if (!relation) return [];

  const pushUnique = (entry: AnataZukanExtractedEntry) => {
    if (entry.confidence < 0.7) return;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  const clearMatch = n.match(/^\s*([^\s。．.!！?？、,，]{2,30})\s*が\s*(好き|大好き|嫌い|興味ある|気になる)/u);
  if (clearMatch) {
    const name = clearMatch[1].trim();
    if (!ANATA_EXCLUDE_WORDS.has(name) && !/^\d+$/.test(name)) {
      pushUnique({
        name,
        relation,
        category: detectCategory(n, name),
        confidence: 0.94,
        sourceText: n.slice(0, 120),
      });
    }
  }

  const segments = n
    .split(/[。．.!！?？、,，／/・|｜\s「」『』（）()【】\[\]]+/u)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 2 &&
        s.length <= 20 &&
        !ANATA_EXCLUDE_WORDS.has(s) &&
        !/^\d+$/.test(s),
    );

  const katakana = segments.filter((s) => /^[ァ-ヶーｦ-ﾟ]{2,}$/.test(s));
  const kanji = segments.filter((s) => /[\u4e00-\u9fa5\u3400-\u4dbf]/.test(s) && !katakana.includes(s));
  const candidates = Array.from(new Set([...katakana, ...kanji])).slice(0, 3);

  for (const name of candidates) {
    pushUnique({
      name,
      relation,
      category: detectCategory(n, name),
      confidence: clearMatch ? 0.8 : 0.7,
      sourceText: n.slice(0, 120),
    });
    if (out.length >= 3) break;
  }

  return out.slice(0, 3);
};