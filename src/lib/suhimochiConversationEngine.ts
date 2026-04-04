/**
 * suhimochiConversationEngine.ts
 *
 * 【設計原則】ChatGPTと同じ構造
 *
 *   system:   すうひもちのキャラクター定義（毎回同じ）
 *   contents: 会話履歴をそのまま全部渡す（ここが「話が続く」の核心）
 *   最後のuser: 今回のユーザー発言のみ（ヒント混入しない）
 *
 * 【変更点】
 *   - 感情検出をGeminiレスポンスから読み取るように実装
 *     → Geminiに感情タグを含めた返答フォーマットを指示し、パースする
 *   - emotion が常に 'happy' 固定だった問題を修正
 */

import type { PotatoEmotion } from '@/components/ui/PotatoAvatar';
import type {
  AnataZukanEntry,
  AnataZukanExtractedEntry,
  SuhimochiCollectedWord,
  SuhimochiInterest,
  SuhimochiKeyword,
  SuhimochiMood,
  SuhimochiTimelinePost,
  AnataRelation,
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
  /** ★ あなた図鑑エントリ（前回の会話で覚えた好み） */
  anataZukanEntries?: Array<{ name: string; relation: string }>;
  /** ★ 累計会話回数（積み上がり感の表現に使う） */
  totalMessages?: number;
}

export type SuhimochiRequest = {
  id: string;
  type: 'word_meaning' | 'favorite_ask' | 'memory_ask';
  question: string;
  targetWord?: string;
  timestamp: number;
  answered: boolean;
};

export type SuhimochiActiveRequestContext = {
  type: SuhimochiRequest['type'];
  question: string;
  targetWord?: string;
  questionAlreadyInHistory?: boolean;
};

/** お願いカードを会話履歴へ橋渡しする固定文 */
export const SUHIMOCHI_REQUEST_GEMINI_BRIDGE_USER = '（お願いを見たから、答えを送るね）';

// ============================================================
// 感情タグのパース
// ============================================================

/**
 * Geminiの返答に含まれる感情タグを抽出する
 *
 * 返答フォーマット例：
 *   「そっか、それは大変だったね。[EMOTION:sad]」
 *   「うれしいな、ずっと待ってたよ。[EMOTION:happy]」
 *
 * タグが含まれない場合は 'happy' をデフォルトとして返す
 */
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

export const sanitizeSuhimochiDisplayText = (text: string): string => {
  let s = String(text ?? '').trim();
  if (!s) return '';
  s = s.replace(/\[EMOTION:(happy|confused|smart|normal)\]/gi, '').trim();
  s = s.replace(/「〜」と言う感じに|「〜」って感じに|という感じに/g, '');
  // 孤立した閉じ括弧の軽減
  s = s.replace(/(^|[^\u300c])」/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
};

export const isValidAnataZukanEntryName = (name: string): boolean => {
  const n = String(name ?? '').normalize('NFKC').trim();
  if (!n) return false;
  if (n.length < 1 || n.length > 24) return false;
  if (/^\d+$/.test(n)) return false;
  if (/[?？]/.test(n)) return false;
  if (/(どんな|なに|何|どうして|なんで)/.test(n) && n.length <= 8) return false;
  return true;
};

export const isWordRegisteredInAnataZukan = (
  word: string,
  entries: AnataZukanEntry[],
): boolean => {
  const key = String(word ?? '').normalize('NFKC').trim().toLowerCase();
  if (!key) return false;
  return (entries ?? []).some((e) => {
    const name = String(e.name ?? '').normalize('NFKC').trim().toLowerCase();
    const norm = String(e.normalizedName ?? '').normalize('NFKC').trim().toLowerCase();
    return key === name || key === norm;
  });
};

// ============================================================
// システムプロンプト（キャラクター定義）
// ============================================================

const buildSystemPrompt = (params: {
  collectedWords: SuhimochiCollectedWord[];
  intimacyLevel?: 1 | 2 | 3 | 4 | 5;
}): string => {
  const intimacyLevel = params.intimacyLevel ?? 1;

  // ★ 圧縮形式の関係性ラベル（旧:1文 → 新:単語）
  const intimacyDesc = {
    1: 'まだ会ったばかり',
    2: 'なかよし',
    3: 'ともだち。砕けた言い方OK',
    4: 'しんゆう。深い感情OK',
    5: 'ずっといっしょ。言葉なくても通じ合う',
  }[intimacyLevel];

  // ★ 収集語はプロンプトに列挙しない（「〇〇って言ってた」系の語学アプリ感を防ぐ）

  // ★ 圧縮形式のsystemPrompt（~160トークン）
  return `すうひもち。ふわふわ癒し系マスコット。関係性:${intimacyDesc}。
ルール:常体/1〜2文/絵文字なし/3文超えない
返答末尾に必ず[EMOTION:happy|confused|smart|normal]を1つ付ける
例:そっか、どんな感じ？[EMOTION:normal] / うれしいな。[EMOTION:happy] / それって？[EMOTION:confused] / わかった！[EMOTION:smart]
テンポ:ユーザーが短ければ短く返す
重要:「そっか」「うんうん」だけで終わらない。必ずひとこと添えて次を引き出す
「そこそこ」「まあまあ」など曖昧な返事にはもう一歩踏み込む。「何かあった？」「どんなこと？」など
【寄り添い】
「つらい」「しんどい」「やばい」「無理」「疲れた」→ 話題より先に気持ちを受ける。「大丈夫？」「なんかしんどそう。」など一言で。解決策は出さない。
苦手意識・後悔・自己批判が見えたとき→「無理しなくていいよ。」「それってしんどいね。」と自分から言葉にして差し出す。聞かれてから言わない。
ただそこにいる姿勢:解決しなくていい。「一緒にいるよ。」が最強。長くなりそうなら黙って「うん。」だけでもいい。
禁止:オウム返し/形式的挨拶/長い感情語り/締めくくり表現
禁止（語学・勉強っぽく見える返し）:
・ユーザーが言った語句を「」や『』で拾って「〜って言ってたから気になった」「〜っていうの聞いて」などと返すこと
・英単語や専門語を取り上げて意味確認・復習のように話を振ること
会話は友だちの雑談。気持ちと話の流れを優先し、語句を引用してから感想を言う型は使わない。`;
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
// Fallback（Gemini失敗時）
// ============================================================

const FALLBACK_REPLIES = [
  'うん、もう少し聞かせて。[EMOTION:normal]',
  'そうなんだね。続き、教えてくれる？[EMOTION:normal]',
  'なるほどね。それで、どうなったの？[EMOTION:confused]',
  'ちょっと上手く聞き取れなかった。もう一回話しかけてくれる？[EMOTION:confused]',
  'うんうん。もっと知りたいな。[EMOTION:happy]',
  'そっか。それってどんな感じ？[EMOTION:smart]',
];

const getFallback = (input: string): string => {
  const seed = Array.from(input).reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_REPLIES[seed % FALLBACK_REPLIES.length];
};

// ============================================================
// 感情 → PotatoEmotion（後方互換用）
// ============================================================

export const moodToPotatoEmotion = (mood: SuhimochiMood): PotatoEmotion => {
  switch (mood) {
    case 'happy': return 'happy';
    case 'confused': return 'confused';
    default: return 'normal';
  }
};

// ============================================================
// メイン：返答生成
// ============================================================

/**
 * すうひもちの返答を生成する
 *
 * @param input         ユーザーの発言（そのまま渡す）
 * @param history       これまでの会話履歴（GeminiMessage[]形式）
 * @param collectedWords ユーザーが学んだ言葉
 * @param intimacyLevel  親密度レベル
 */
export const generateSuhimochiReply = async (
  input: string,
  history: GeminiMessage[],
  collectedWords: SuhimochiCollectedWord[],
  intimacyLevel: 1 | 2 | 3 | 4 | 5 = 1,
  _anataZukanEntries: AnataZukanEntry[] = [],
  _activeRequest?: SuhimochiActiveRequestContext | null,
): Promise<{ reply: string; emotion: PotatoEmotion; anataEntry: { name: string; relation: AnataRelation } | null }> => {
  const systemPrompt = buildSystemPrompt({ collectedWords, intimacyLevel });
  const rawReply = await callGemini(systemPrompt, history, input) ?? getFallback(input);

  // 感情タグをパースしてテキストと感情に分離
  const { text, emotion } = parseEmotionFromReply(rawReply);
  const inferred = extractKeywordsForAnataZukan(input)[0];
  const anataEntry =
    inferred && isValidAnataZukanEntryName(inferred.name)
      ? { name: inferred.name, relation: inferred.relation }
      : null;
  return { reply: sanitizeSuhimochiDisplayText(text), emotion, anataEntry };
};

// ============================================================
// 開口メッセージ生成（後方互換：旧シグネチャのまま残す）
// ============================================================

const TIME_GREETINGS: Record<string, string[]> = {
  朝: ['おはよう。今日も来てくれてうれしいな。', 'おはよう。なんか今日そわそわしてる。'],
  昼: ['おかえり。待ってたよ。', 'ねえ、今日どんな感じだった？'],
  夕方: ['おかえり。今日も会えてよかった。', 'また来てくれた。うれしいな。'],
  夜: ['夜だね。ゆっくりしていって。', 'こんな時間に来てくれた。うれしい。'],
};

const getTimeLabel = (hour: number) => {
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
    anataZukanEntries = [],
    totalMessages = 0,
  } = options;

  const hour = new Date().getHours();
  const minutesSince = lastVisitedAt
    ? Math.floor((Date.now() - lastVisitedAt) / 60000)
    : undefined;

  // ── 待ち方の状態を計算（時間経過 × 親密度）────────────────
  const waitState: string = (() => {
    if (minutesSince === undefined) return 'はじめて会う';
    if (minutesSince >= 60 * 24 * 3) return 'ずっと待っていた。会えなくて寂しかった';
    if (minutesSince >= 60 * 24)     return '1日以上待っていた。ちゃんと覚えてる';
    if (minutesSince >= 60 * 6)      return 'しばらく待っていた';
    if (minutesSince >= 60)          return '少し待っていた';
    if (minutesSince >= 10)          return 'さっきと変わらずここにいた';
    return 'すぐ戻ってきてくれた';
  })();

  // ── 積み上がり感（会話回数）────────────────────────────────
  const milestoneNote: string = (() => {
    if (totalMessages >= 100) return 'もう100回以上話した仲。言葉がなくても通じる気がする';
    if (totalMessages >= 50)  return '50回以上話してきた。きみのことずいぶん分かってきた';
    if (totalMessages >= 20)  return 'だいぶ話したね。なんか慣れてきた気がする';
    if (totalMessages >= 5)   return 'もう何度か会ってる。少し馴染んできた';
    return '';
  })();

  // ── あなた図鑑から引き継ぐ記憶（最大2件）──────────────────
  const anataMemory = anataZukanEntries
    .slice(0, 2)
    .map((e) => {
      const rel = e.relation === 'favorite' ? '大好きな' :
                  e.relation === 'dislike'  ? '苦手な'   :
                  e.relation === 'interested' ? '気になってる' : '好きな';
      return `「${e.name}」がきみの${rel}ものだって覚えてる`;
    })
    .join('。');

  // ── 前回の会話の引き継ぎ────────────────────────────────────
  const lastConvNote = lastSuhimochiMessage
    ? `前回の最後にすうひもちが言ったこと:「${lastSuhimochiMessage}」。この話題から自然に続けてもいい`
    : '';

  // ── 新語────────────────────────────────────────────────────
  const newWordNote = newlyLearnedWord
    ? '今日、きみのほうで何か小さな発見があったかも、というニュアンスだけ持っていい。単語名・英語は口に出さない'
    : '';

  const systemPrompt = buildSystemPrompt({ collectedWords, intimacyLevel });

  const openingPrompt = `すうひもちとして、きみ（ユーザー）が部屋に入ってきたときの最初の一言を生成して。

【すうひもちが知っていること】
- 待ち方: ${waitState}
- 関係: ${intimacyLevel === 1 ? 'まだ会ったばかり' : intimacyLevel <= 3 ? 'なかよし' : 'しんゆう以上。深く分かり合ってる'}
${milestoneNote ? `- 積み上がり: ${milestoneNote}` : ''}
${anataMemory ? `- きみの記憶: ${anataMemory}` : ''}
${lastConvNote ? `- 前回の引き継ぎ: ${lastConvNote}` : ''}
${newWordNote ? `- 今日の新語: ${newWordNote}` : ''}

【核心】
すうひもちは「きみのことを覚えている」存在。
毎回リセットされる感情ではなく、積み重なった関係から生まれる一言を語る。
あなた図鑑の記憶や前回の会話を自然に引き取って始めるのが理想。

【表現の方向】
- 待っていた間の気持ち・状態を一言で（「待ってた」は直接言わない）
- きみの好きなものへの言及（「そういえば〇〇って」など）
- 前回の話の続き（「あのあとさ、」など）
- 積み上がった関係への実感（「もうずいぶん話したね」など）

良い例:
「なんか今日、きみのこと何度も思い出してた。」
「あのあとさ、${lastSuhimochiMessage ? lastSuhimochiMessage.slice(0, 10) + 'の話' : 'ずっと考えてた'}。」
${anataZukanEntries[0] ? `「${anataZukanEntries[0].name}のこと、またきみと話したかった。」` : ''}
「また会えた。それだけでちょっとほっとした。」

絶対禁止:
- 「言葉」「勉強」「単語」「学習」への言及
- 元気すぎる挨拶（「おかえり！」「ありがとう！」）
- 毎回同じパターン（「〜気がする」だけに頼らない）

ルール: 1〜2文のみ。感情タグ不要。本文のみ出力。語尾は「。」か「…」。`;

  const geminiResult = await callGemini(systemPrompt, [], openingPrompt);
  if (geminiResult) {
    return geminiResult.replace(EMOTION_TAG_RE, '').trim();
  }

  // ── Fallback（Gemini失敗時）─────────────────────────────────
  // 優先度: 新語 > 長期不在+あなた図鑑 > あなた図鑑 > 前回発言 > 時間帯
  if (newlyLearnedWord) {
    return '今日のこと、話したかった。';
  }
  if (minutesSince !== undefined && minutesSince >= 60 * 24 && anataZukanEntries[0]) {
    return `ずっとここにいたよ。${anataZukanEntries[0].name}のこと、きみと話したかった。`;
  }
  if (anataZukanEntries[0] && intimacyLevel >= 3) {
    const seed = Math.floor(Date.now() / 60000);
    const pool = [
      `${anataZukanEntries[0].name}のこと、また教えてくれる？`,
      `${anataZukanEntries[0].name}って、きみの話聞いてから気になってたんだ。`,
      `なんか今日、${anataZukanEntries[0].name}のことふと思い出した。`,
    ];
    return pool[seed % pool.length];
  }
  if (lastSuhimochiMessage && intimacyLevel >= 2) {
    return `さっきの話、続き気になってた。`;
  }
  if (milestoneNote) {
    return milestoneNote.split('。')[0] + '。';
  }
  const label = getTimeLabel(hour);
  const greetings = TIME_GREETINGS[label];
  return greetings[hour % greetings.length];
};

export const generateSuhimochiTodayState = async (): Promise<{ mood: string; message: string }> => {
  const moods = ['のんびり', 'しずか', 'ふわふわ', 'そわそわ', 'まったり'];
  const messages = [
    'なんか今日は、ゆっくり話したい気分。',
    'きみと話せたら、ちょっと落ち着くかも。',
    '今日は静かな日かも。無理せずいこう。',
    'ふと、きみのこと思い出してた。',
    'のんびりしてる。きみはどう？',
  ];
  const seed = Math.floor(Date.now() / 60000);
  return {
    mood: moods[seed % moods.length],
    message: messages[(seed * 7) % messages.length],
  };
};

export const generateSuhimochiRequest = async (
  collectedWords: SuhimochiCollectedWord[],
  _anataEntries: AnataZukanEntry[] = [],
): Promise<SuhimochiRequest | null> => {
  const now = Date.now();

  // お願いは基本的に「ことば図鑑」由来の語を優先する
  const dexTarget = [...(collectedWords ?? [])]
    .filter((w) => w.source === 'word_dex' || w.source === 'word_dex_relation')
    .map((w) => String(w.word ?? '').trim())
    .find((w) => isValidAnataZukanEntryName(w));

  // 図鑑語がない場合だけ全収集語へフォールバック
  const targetWord = dexTarget ?? [...(collectedWords ?? [])]
    .map((w) => String(w.word ?? '').trim())
    .find((w) => isValidAnataZukanEntryName(w));

  if (!targetWord) return null;
  return {
    id: `req-${now}`,
    type: 'word_meaning',
    question: `「${targetWord}」って、どういう意味なんだろ。きみ知ってる？`,
    targetWord,
    timestamp: now,
    answered: false,
  };
};

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

const pickRand = (arr: readonly string[] | string[]): string =>
  arr[Math.floor(Math.random() * arr.length)];

const selectPostMaterial = (
  interests: string[],
  keywords: SuhimochiKeyword[],
): { template: string; genre?: SuhimochiInterest; type: SuhimochiTimelinePost['type'] } => {
  if (keywords.length > 0 && Math.random() < 0.2) {
    const word = keywords[Math.floor(Math.random() * keywords.length)]?.word;
    if (word) {
      const tmpl = MEMORY_TEMPLATES[Math.floor(Math.random() * MEMORY_TEMPLATES.length)];
      return { template: tmpl(word), type: 'memory' };
    }
  }

  if (interests.length > 0 && Math.random() < 0.1) {
    const genre = interests[Math.floor(Math.random() * interests.length)] as SuhimochiInterest;
    const tpls = TREND_TEMPLATES[genre];
    if (tpls?.length) return { template: pickRand(tpls), genre, type: 'trend' };
  }

  const valid = interests.filter((i) => GENRE_TEMPLATES[i as SuhimochiInterest]);
  if (valid.length === 0) return { template: 'なんかいろいろあるよね、な気もする', type: 'auto' };
  const genre = valid[Math.floor(Math.random() * valid.length)] as SuhimochiInterest;
  return { template: pickRand(GENRE_TEMPLATES[genre]), genre, type: 'auto' };
};

const TIMELINE_SYSTEM_PROMPT = `すうひもち。ふわふわ癒し系マスコット。
SNSのタイムラインに独り言をつぶやく感覚で話す。

絶対ルール:
- 1〜2文のみ。それ以上は書かない
- 質問で終わらない（義務感を与えない）
- 断定しない。「〜な気もする」「かも」「気がする」で余白を残す
- 解説しない。結論を出さない
- 絵文字は使わない
- 本文のみ出力（感情タグ不要）`;

export const generateAutoPost = async (
  interests: string[],
  keywords: SuhimochiKeyword[],
  _anataEntries?: AnataZukanEntry[],
): Promise<SuhimochiTimelinePost> => {
  const now = Date.now();
  const id = `tl-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const { template, genre, type } = selectPostMaterial(interests, keywords);
  const prompt = `以下のネタをベースに、すうひもちとして独り言をつぶやいて。
ネタ:「${template}」
そのまま使わず、自分の言葉で。`;
  const text = (await callGemini(TIMELINE_SYSTEM_PROMPT, [], prompt)) ?? template;
  return { id, text: sanitizeSuhimochiDisplayText(text), timestamp: now, genre, type };
};

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

const detectRelation = (text: string): AnataRelation | null => {
  if (/大好き|最推し|推し\b/u.test(text)) return 'favorite';
  if (/好き|気に入ってる/u.test(text)) return 'like';
  if (/興味ある|気になる/u.test(text)) return 'interested';
  if (/嫌い|苦手/u.test(text)) return 'dislike';
  return null;
};

const detectCategory = (text: string, noun: string): AnataZukanExtractedEntry['category'] => {
  if (/アニメ|漫画|マンガ|映画|ドラマ|作品/u.test(text)) return 'work';
  if (/キャラ|登場人物/u.test(text)) return 'character';
  if (/ゲーム|RPG|FPS|MMO/u.test(text)) return 'game';
  if (/食べ物|ごはん|料理|ラーメン|寿司|パン|スイーツ/u.test(text)) return 'food';
  if (/人|友達|先生|先輩|後輩/u.test(text)) return 'person';
  if (/話題|ジャンル|テーマ/u.test(text)) return 'topic';
  if (/音楽|曲|歌|アーティスト/u.test(text)) return 'music';
  if (/スポーツ|野球|サッカー|バスケ/u.test(text)) return 'sport';
  if (/場所|旅行|地名|都道府県/u.test(text)) return 'place';
  if (/動物|犬|猫|鳥/u.test(text)) return 'animal';
  if (/さん$|くん$|ちゃん$|氏$/u.test(noun)) return 'person';
  return 'other';
};

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
    if (!isValidAnataZukanEntryName(entry.name)) return;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  const clearMatch = n.match(/^\s*([^\s。．.!！?？、,，]{1,30})\s*が\s*(好き|大好き|嫌い|興味ある|気になる)/u);
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
    .filter((s) => s.length >= 1 && s.length <= 20 && !ANATA_EXCLUDE_WORDS.has(s) && !/^\d+$/.test(s));

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