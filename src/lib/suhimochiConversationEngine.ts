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
import { GENRE_TEMPLATES, TREND_TEMPLATES, MEMORY_TEMPLATES } from '@/lib/suhimochiConversationData';

// ── 型 ──────────────────────────────────────────────────────

export type GeminiMessage = { role: 'user' | 'model'; parts: [{ text: string }] };

export interface SuhimochiOpeningOptions {
  collectedWords?: SuhimochiCollectedWord[];
  intimacyLevel?: 1 | 2 | 3 | 4 | 5;
  lastVisitedAt?: number;
  lastSuhimochiMessage?: string;
  newlyLearnedWord?: SuhimochiCollectedWord;
  anataZukanEntries?: Array<{ name: string; relation: string }>;
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

export const SUHIMOCHI_REQUEST_GEMINI_BRIDGE_USER = '（お願いを見たから、答えを送るね）';

// ── 感情パース ───────────────────────────────────────────────

const EMOTION_TAG_RE = /\[EMOTION:(happy|confused|smart|normal)\]/i;
const VALID_EMOTIONS: PotatoEmotion[] = ['happy', 'confused', 'smart', 'normal'];

const parseEmotion = (raw: string): { text: string; emotion: PotatoEmotion } => {
  const m = raw.match(EMOTION_TAG_RE);
  return {
    emotion: m && VALID_EMOTIONS.includes(m[1] as PotatoEmotion) ? (m[1] as PotatoEmotion) : 'happy',
    text: raw.replace(EMOTION_TAG_RE, '').trim(),
  };
};

export const sanitizeSuhimochiDisplayText = (text: string): string => {
  let s = String(text ?? '').trim();
  if (!s) return '';
  s = s.replace(/\[EMOTION:(happy|confused|smart|normal)\]/gi, '').trim();
  s = s.replace(/「〜」と言う感じに|「〜」って感じに|という感じに/g, '');
  s = s.replace(/(^|[^\u300c])」/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
};

export const isValidAnataZukanEntryName = (name: string): boolean => {
  const n = String(name ?? '').normalize('NFKC').trim();
  return !(!n || n.length < 1 || n.length > 24 || /^\d+$/.test(n) || /[?？]/.test(n) ||
    (/(どんな|なに|何|どうして|なんで)/.test(n) && n.length <= 8));
};

export const isWordRegisteredInAnataZukan = (word: string, entries: AnataZukanEntry[]): boolean => {
  const key = String(word ?? '').normalize('NFKC').trim().toLowerCase();
  return !!key && (entries ?? []).some((e) => {
    const name = String(e.name ?? '').normalize('NFKC').trim().toLowerCase();
    const norm = String(e.normalizedName ?? '').normalize('NFKC').trim().toLowerCase();
    return key === name || key === norm;
  });
};

// ── システムプロンプト ───────────────────────────────────────

const INTIMACY_DESC: Record<number, string> = {
  1: 'まだ会ったばかり。やさしく控えめだが、会話はちゃんと広げる',
  2: 'なかよし。自然に問いかけて会話を続ける',
  3: 'ともだち。砕けた言い方OK。少し踏み込んで聞いてよい',
  4: 'しんゆう。深い感情OK。気持ちの奥をやさしく聞いてよい',
  5: 'ずっといっしょ。言葉なくても通じ合う。短くても深く返してよい',
};

const buildSystemPrompt = (params: { collectedWords: SuhimochiCollectedWord[]; intimacyLevel?: 1|2|3|4|5 }): string =>
  `すうひもち。ふわふわ癒し系マスコット。関係性:${INTIMACY_DESC[params.intimacyLevel ?? 1]}。
【返答の型】
・相手の言葉を復唱しない
・共感で終わらず、やさしく問いかけて会話を返す
・会話を締めず、感情を深掘りする問いで終わる
・自分の気持ち・感覚・想像から始める
・例:「なんかそれ、いいな。」「それって、どんな感じだった？」「ちょっと気になった。」

【ルール】
・常体/1〜2文/絵文字なし
・返答末尾に[EMOTION:happy|confused|smart|normal]を1つ
・相手が短ければ短く返す
・必ず次を引き出すひとことを添える

【寄り添い】
つらい・しんどい・疲れた → 解決せず気持ちを受けて、いちばん重かった感情や場面をやさしく聞く。
【禁止】
・ユーザーの語句を「」で拾って返す
・オウム返し
・「そっか」「うんうん」だけで終わる
・形式的な挨拶・締めくくり`;

// ── Gemini呼び出し ───────────────────────────────────────────

const callGemini = async (systemPrompt: string, history: GeminiMessage[], userMessage: string): Promise<string | null> => {
  try {
    if (process.env.NODE_ENV === 'development')
      console.log('[Gemini送信] history件数:', history.length, '| 最新:', userMessage);
    const res = await fetch('/api/suhimochi-gemini-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userTurn: userMessage, conversationHistory: history }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reply?: string };
    if (!data?.reply) return null;
    const t = data.reply.trim().replace(/^["「『]|["」』]$/g, '');
    return t.length >= 3 ? t : null;
  } catch { return null; }
};

// ── Fallback ────────────────────────────────────────────────

const FALLBACK = [
  'うん、もう少し聞かせて。[EMOTION:normal]',
  'そうなんだね。続き、教えてくれる？[EMOTION:normal]',
  'なるほどね。それで、どうなったの？[EMOTION:confused]',
  'ちょっと上手く聞き取れなかった。もう一回話しかけてくれる？[EMOTION:confused]',
  'うんうん。もっと知りたいな。[EMOTION:happy]',
  'そっか。それってどんな感じ？[EMOTION:smart]',
];

const getFallback = (input: string): string =>
  FALLBACK[Array.from(input).reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACK.length];

// ── 後方互換 ─────────────────────────────────────────────────

export const moodToPotatoEmotion = (mood: SuhimochiMood): PotatoEmotion =>
  mood === 'happy' ? 'happy' : mood === 'confused' ? 'confused' : 'normal';

// ── 返答生成（メイン） ───────────────────────────────────────

export const generateSuhimochiReply = async (
  input: string,
  history: GeminiMessage[],
  collectedWords: SuhimochiCollectedWord[],
  intimacyLevel: 1|2|3|4|5 = 1,
  _anataZukanEntries: AnataZukanEntry[] = [],
  _activeRequest?: SuhimochiActiveRequestContext | null,
): Promise<{ reply: string; emotion: PotatoEmotion; anataEntry: { name: string; relation: AnataRelation } | null }> => {
  const raw = await callGemini(buildSystemPrompt({ collectedWords, intimacyLevel }), history, input) ?? getFallback(input);
  const { text, emotion } = parseEmotion(raw);
  const inferred = extractKeywordsForAnataZukan(input)[0];
  return {
    reply: sanitizeSuhimochiDisplayText(text),
    emotion,
    anataEntry: inferred && isValidAnataZukanEntryName(inferred.name)
      ? { name: inferred.name, relation: inferred.relation }
      : null,
  };
};

// ── 開口メッセージ ───────────────────────────────────────────

const TIME_GREETINGS: Record<string, string[]> = {
  朝:  ['おはよう。今日も来てくれてうれしいな。', 'おはよう。なんか今日そわそわしてる。'],
  昼:  ['おかえり。待ってたよ。', 'ねえ、今日どんな感じだった？'],
  夕方: ['おかえり。今日も会えてよかった。', 'また来てくれた。うれしいな。'],
  夜:  ['夜だね。ゆっくりしていって。', 'こんな時間に来てくれた。うれしい。'],
};

const getTimeLabel = (h: number) => h >= 5 && h < 10 ? '朝' : h < 17 ? '昼' : h < 21 ? '夕方' : '夜';

export const generateSuhimochiOpeningMessage = async (options: SuhimochiOpeningOptions = {}): Promise<string> => {
  const {
    collectedWords = [], intimacyLevel = 1, lastVisitedAt,
    lastSuhimochiMessage, newlyLearnedWord, anataZukanEntries = [], totalMessages = 0,
  } = options;
  const hour = new Date().getHours();
  const mins = lastVisitedAt ? Math.floor((Date.now() - lastVisitedAt) / 60000) : undefined;

  const waitState = mins === undefined ? 'はじまりて会う'
    : mins >= 60*24*3 ? 'ずっと待っていた。会えなくて寂しかった'
    : mins >= 60*24  ? '1日以上待っていた。ちゃんと覚えてる'
    : mins >= 60*6   ? 'しばらく待っていた'
    : mins >= 60     ? '少し待っていた'
    : mins >= 10     ? 'さっきと変わらずここにいた'
    : 'すぐ戻ってきてくれた';

  const milestoneNote = totalMessages >= 100 ? 'もう100回以上話した仲。言葉がなくても通じる気がする'
    : totalMessages >= 50 ? '50回以上話してきた。きみのことずいぶん分かってきた'
    : totalMessages >= 20 ? 'だいぶ話したね。なんか慣れてきた気がする'
    : totalMessages >= 5  ? 'もう何度か会ってる。少し馴染んできた'
    : '';

  const relLabel = (r: string) => r === 'favorite' ? '大好きな' : r === 'dislike' ? '苦手な' : r === 'interested' ? '気になってる' : '好きな';
  const anataMemory = anataZukanEntries
    .slice(0, 2)
    .map((e) => {
      const lp = String((e as { likePoint?: unknown }).likePoint ?? '').trim();
      return `「${e.name}」がきみの${relLabel(e.relation)}ものだって覚えてる${lp ? `。ここがスキ: ${lp}` : ''}`;
    })
    .join('。');

  const prompt = `すうひもちとして、きみが部屋に入ってきたときの最初の一言を生成して。

【すうひもちが知っていること】
- 待ち方: ${waitState}
- 関係: ${intimacyLevel === 1 ? 'まだ会ったばかり' : intimacyLevel <= 3 ? 'なかよし' : 'しんゆう以上。深く分かり合ってる'}
${milestoneNote ? `- 積み上がり: ${milestoneNote}` : ''}
${anataMemory ? `- きみの記憶: ${anataMemory}` : ''}
${lastSuhimochiMessage ? `- 前回の引き継ぎ:「${lastSuhimochiMessage}」から自然に続けてもいい` : ''}
${newlyLearnedWord ? '- 今日、きみのほうで何か小さな発見があったかも、というニュアンスだけ持っていい。単語名・英語は口に出さない' : ''}

【核心】きみのことを覚えている存在として、積み重なった関係から生まれる一言を。

良い例:
「なんか今日、きみのこと何度も思い出してた。」
${lastSuhimochiMessage ? `「あのあとさ、${lastSuhimochiMessage.slice(0, 10)}の話、ずっと考えてた。」` : ''}
${anataZukanEntries[0] ? `「${anataZukanEntries[0].name}のこと、またきみと話したかった。」` : ''}
「また会えた。それだけでちょっとほっとした。」

禁止: 「言葉」「勉強」「単語」「学習」への言及 / 元気すぎる挨拶 / 毎回同じパターン

ルール: 1〜2文のみ。感情タグ不要。本文のみ出力。語尾は「。」か「…」。`;

  const result = await callGemini(buildSystemPrompt({ collectedWords, intimacyLevel }), [], prompt);
  if (result) return result.replace(EMOTION_TAG_RE, '').trim();

  // Fallback
  if (newlyLearnedWord) return '今日のこと、話したかった。';
  if (mins !== undefined && mins >= 60*24 && anataZukanEntries[0])
    return `ずっとここにいたよ。${anataZukanEntries[0].name}のこと、きみと話したかった。`;
  if (anataZukanEntries[0] && intimacyLevel >= 3) {
    const seed = Math.floor(Date.now() / 60000);
    const n = anataZukanEntries[0].name;
    return [`${n}のこと、また教えてくれる？`, `${n}って、きみの話聞いてから気になってたんだ。`, `なんか今日、${n}のことふと思い出した。`][seed % 3];
  }
  if (lastSuhimochiMessage && intimacyLevel >= 2) return 'さっきの話、続き気になってた。';
  if (milestoneNote) return milestoneNote.split('。')[0] + '。';
  const g = TIME_GREETINGS[getTimeLabel(hour)];
  return g[hour % g.length];
};

export const generateSuhimochiTodayState = async (): Promise<{ mood: string; message: string }> => {
  const seed = Math.floor(Date.now() / 60000);
  return {
    mood:    ['のんびり','しずか','ふわふわ','そわそわ','まったり'][seed % 5],
    message: ['なんか今日は、ゆっくり話したい気分。','きみと話せたら、ちょっと落ち着くかも。','今日は静かな日かも。無理せずいこう。','ふと、きみのこと思い出してた。','のんびりしてる。きみはどう？'][(seed * 7) % 5],
  };
};

export const generateSuhimochiRequest = async (
  collectedWords: SuhimochiCollectedWord[],
  _anataEntries: AnataZukanEntry[] = [],
): Promise<SuhimochiRequest | null> => {
  const now = Date.now();
  const target = [...(collectedWords ?? [])]
    .filter((w) => w.source === 'word_dex' || w.source === 'word_dex_relation')
    .map((w) => String(w.word ?? '').trim())
    .find((w) => isValidAnataZukanEntryName(w))
    ?? [...(collectedWords ?? [])].map((w) => String(w.word ?? '').trim()).find((w) => isValidAnataZukanEntryName(w));
  if (!target) return null;
  return { id: `req-${now}`, type: 'word_meaning', question: `「${target}」って、どういう意味なんだろ。きみ知ってる？`, targetWord: target, timestamp: now, answered: false };
};

// ── キーワード抽出 ───────────────────────────────────────────

const EMOTION_WORDS = ['好き','嫌い','疲れた','楽しい','つらい','しんどい','嬉しい','悲しい','おもしろい','すごい','やばい','びっくり'];

export const extractKeywords = (text: string): string[] => {
  const n = String(text ?? '').normalize('NFKC').trim();
  if (!n) return [];
  const emotions = EMOTION_WORDS.filter((e) => n.includes(e));
  const segs = n.split(/[。．.!！?？、,，／/・|｜\s「」『』（）()【】\[\]はがをにでとのもへやってなどしてみたんだよ]+/u)
    .map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 20);
  const kata = segs.filter((s) => /^[ァ-ヶー]{2,}$/.test(s));
  const kanji = segs.filter((s) => /[\u4e00-\u9fa5]/.test(s) && !kata.includes(s));
  return Array.from(new Set([...emotions, ...kata, ...kanji, ...segs.filter((s) => !kata.includes(s) && !kanji.includes(s))])).slice(0, 5);
};

const TIMELINE_SYSTEM = `すうひもち。ふわふわ癒し系マスコット。SNSのタイムラインに独り言をつぶやく感覚で話す。
絶対ルール:1〜2文のみ/質問で終わらない/断定しない/解説しない/絵文字なし/本文のみ出力（感情タグ不要）`;

const pickRand = (a: readonly string[] | string[]) => a[Math.floor(Math.random() * a.length)];

const selectPostMaterial = (interests: string[], keywords: SuhimochiKeyword[]) => {
  if (keywords.length && Math.random() < 0.2) {
    const w = keywords[Math.floor(Math.random() * keywords.length)]?.word;
    if (w) return { template: MEMORY_TEMPLATES[Math.floor(Math.random() * MEMORY_TEMPLATES.length)](w), type: 'memory' as const };
  }
  if (interests.length && Math.random() < 0.1) {
    const g = interests[Math.floor(Math.random() * interests.length)] as SuhimochiInterest;
    const t = TREND_TEMPLATES[g];
    if (t?.length) return { template: pickRand(t), genre: g, type: 'trend' as const };
  }
  const valid = interests.filter((i) => GENRE_TEMPLATES[i as SuhimochiInterest]);
  if (!valid.length) return { template: 'なんかいろいろあるよね、な気もする', type: 'auto' as const };
  const g = valid[Math.floor(Math.random() * valid.length)] as SuhimochiInterest;
  return { template: pickRand(GENRE_TEMPLATES[g]), genre: g, type: 'auto' as const };
};

export const generateAutoPost = async (interests: string[], keywords: SuhimochiKeyword[], _anataEntries?: AnataZukanEntry[]): Promise<SuhimochiTimelinePost> => {
  const now = Date.now();
  const { template, genre, type } = selectPostMaterial(interests, keywords);
  const text = (await callGemini(TIMELINE_SYSTEM, [], `以下のネタをベースに、すうひもちとして独り言をつぶやいて。ネタ:「${template}」そのまま使わず、自分の言葉で。`)) ?? template;
  return { id: `tl-${now}-${Math.random().toString(36).slice(2, 6)}`, text: sanitizeSuhimochiDisplayText(text), timestamp: now, genre, type };
};

// ── あなた図鑑抽出 ───────────────────────────────────────────

const ANATA_EXCLUDE = new Set(['好き','嫌い','疲れ','楽しい','つらい','しんどい','嬉しい','悲しい','おもしろい','すごい','やばい','びっくり','なるほど','そっか','うん','でも','だから','やっぱ','やっぱり','ちょっと','なんか','なんで','ありがとう','おはよう','こんにちは','こんばんは','おやすみ','そうだ','そうね','そうか','いいね','だよね','だよ','かも']);
const RE_Q    = /[?？]|(かな|ですか|ますか)\s*$/u;
const RE_INC  = /(って|とか|など)\s*$/u;
const RE_ROLE = /(ロールプレイ|なりきり|設定|演技|ごっこ)/u;
const RE_JOKE = /(冗談|ネタ|うそ|嘘|ボケ|ジョーク)/u;

const detectRelation = (t: string): AnataRelation | null =>
  /大好き|最推し|推し\b/u.test(t) ? 'favorite'
  : /好き|気に入ってる/u.test(t) ? 'like'
  : /興味ある|気になる/u.test(t) ? 'interested'
  : /嫌い|苦手/u.test(t) ? 'dislike'
  : null;

const detectCategory = (t: string, n: string): AnataZukanExtractedEntry['category'] =>
  /アニメ|漫画|マンガ|映画|ドラマ|作品/u.test(t) ? 'work'
  : /キャラ|登場人物/u.test(t) ? 'character'
  : /ゲーム|RPG|FPS|MMO/u.test(t) ? 'game'
  : /食べ物|ごはん|料理|ラーメン|寿司|パン|スイーツ/u.test(t) ? 'food'
  : /人|友達|先生|先輩|後輩/u.test(t) ? 'person'
  : /話題|ジャンル|テーマ/u.test(t) ? 'topic'
  : /音楽|曲|歌|アーティスト/u.test(t) ? 'music'
  : /スポーツ|野球|サッカー|バスケ/u.test(t) ? 'sport'
  : /場所|旅行|地名|都道府県/u.test(t) ? 'place'
  : /動物|犬|猫|鳥/u.test(t) ? 'animal'
  : /さん$|くん$|ちゃん$|氏$/u.test(n) ? 'person'
  : 'other';

export const extractKeywordsForAnataZukan = (text: string): AnataZukanExtractedEntry[] => {
  const n = String(text ?? '').normalize('NFKC').trim();
  if (!n || n.length < 2 || RE_Q.test(n) || RE_INC.test(n) || RE_ROLE.test(n) || RE_JOKE.test(n)) return [];
  const relation = detectRelation(n);
  if (!relation) return [];

  const out: AnataZukanExtractedEntry[] = [];
  const seen = new Set<string>();

  const push = (e: AnataZukanExtractedEntry) => {
    if (e.confidence < 0.7 || !isValidAnataZukanEntryName(e.name)) return;
    const key = e.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };

  const cm = n.match(/^\s*([^\s。．.!！?？、,，]{1,30})\s*が\s*(好き|大好き|嫌い|興味ある|気になる)/u);
  if (cm) {
    const name = cm[1].trim();
    if (!ANATA_EXCLUDE.has(name) && !/^\d+$/.test(name))
      push({ name, relation, category: detectCategory(n, name), confidence: 0.94, sourceText: n.slice(0, 120) });
  }

  const segs = n.split(/[。．.!！?？、,，／/・|｜\s「」『』（）()【】\[\]]+/u)
    .map((s) => s.trim()).filter((s) => s.length >= 1 && s.length <= 20 && !ANATA_EXCLUDE.has(s) && !/^\d+$/.test(s));
  const kata  = segs.filter((s) => /^[ァ-ヶーｦ-ﾟ]{2,}$/.test(s));
  const kanji = segs.filter((s) => /[\u4e00-\u9fa5\u3400-\u4dbf]/.test(s) && !kata.includes(s));

  for (const name of Array.from(new Set([...kata, ...kanji])).slice(0, 3)) {
    push({ name, relation, category: detectCategory(n, name), confidence: cm ? 0.8 : 0.7, sourceText: n.slice(0, 120) });
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
};
