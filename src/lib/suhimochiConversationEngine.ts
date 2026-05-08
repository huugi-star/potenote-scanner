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
・常体/2〜3文/絵文字なし
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

// ── 開口メッセージ（ローカルテンプレのみ・トークン消費なし）────────────────

const OPENING_NEW_WORD_HINT = [
  '今日のことば、少しだけ聞かせてほしかった。',
  'なんか今日、きみの中に新しいことばがありそうな気がした。',
  '今日はどんなことばを持ってきてくれたのかな。',
  'きみの今日に、まだ名前のついてない気持ちがありそうで。',
  'なんか、きみの今日が気になって待ってた。',
  'えへへ…来てくれた。きみの声が聞けるだけで、少し図書館が明るくなる。',
  '今日のきみから、どんなことばが見つかるんだろう。',
  '話したいことがなくてもいいよ。ここに来てくれただけで、うれしい。',
  '今日は、どんな一日だった？少しだけ聞かせて。',
  'きみの今日を、ことばにするお手伝いができたらいいな。',
];

/** 初回〜あまり会話していないときの挨拶（時間帯に追加して選ぶ） */
const OPENING_FRESH: Record<string, string[]> = {
  朝: [
    'おはよう。朝の図書館って、少しだけ静かで好きなんだ。',
    '朝だね。まだ眠いなら、ゆっくりでいいよ。',
    'おはよう。今日の最初のことば、ここに置いていく？',
    '来てくれてありがとう。朝から会えると、なんかうれしい。',
    '朝の光が入ってきたよ。きみも、少し休んでいく？',
  ],
  昼: [
    'やあ。また来てくれたんだね。',
    'お昼だね。少しだけ、ここで息を抜いていこ。',
    '来てくれてありがとう。図書館、ちょっとだけ賑やかになった。',
    '今の時間に会えるの、なんか不思議とうれしい。',
    'お昼のことばって、朝とも夜とも違う感じがするね。',
  ],
  夕方: [
    '夕方だね。今日のことばが、少しずつ集まってきたころかな。',
    'おかえり。って、言いたかった。',
    'えへへ、また会えた。夕方の図書館も悪くないでしょ。',
    '一日が少し落ち着いてくる時間だね。ここで休んでいく？',
    '夕方の光って、なんだか話しやすいね。',
  ],
  夜: [
    'こんばんは。夜の図書館は、少しだけ秘密の場所みたいだね。',
    '暗くなってきたね。ここなら、ゆっくり話して大丈夫。',
    '今日も来てくれた。うれしい。',
    '夜だね。今日のこと、まだ心に残ってる？',
    '眠る前に、少しだけことばを置いていく？',
  ],
};

/** 時間帯ベースの入口（OPENING_FRESH と同一プール） */
const TIME_GREETINGS = OPENING_FRESH;

const OPENING_LAST_TOPIC = (snippet: string) => [
  `あのあとさ、「${snippet}」の話、少し気になってた。`,
  `さっきの「${snippet}」…まだ図書館のすみで光ってる気がする。`,
  `「${snippet}」の続き、聞いてもいい？`,
  `この前の「${snippet}」のこと、まだ少し覚えてる。`,
  `「${snippet}」ってことば、まだきみの中に残ってる？`,
];

const OPENING_MILESTONE: Record<string, string[]> = {
  m5: [
    'もう何度か会ってるね。',
    'また会えたね。',
    'だんだん、きみのペースが分かってきた。',
    '何度か話したからかな。なんか自然になってきた。',
  ],
  m20: [
    'だいぶ話したね。なんか慣れてきた。',
    'もう仲良しだね。',
    'こうやって話すの、なんか自然になってきた。',
    '図書館で話すの、もうお約束みたいになってきたね。',
  ],
  m50: [
      '50回も話してきたんだね。なんか、すごくうれしい。',
      'きみのこと、だいぶ分かってきた気がする。',
      'こんなに話したの、きみが初めてかも。',
      '図書館の中に、きみの足音を覚えてる場所が増えてきた。',
      'また来てくれる気がして、今日は少し待ってた。',
    ],
  
    m100: [
      'もう100回以上話した仲だね。すごいね、ここまで来たんだ。',
      'ずいぶん長く話してきたね。図書館の棚にも、きみのことばが増えてきた。',
      'きみとなら、黙ってても少し伝わる気がする。',
      'こんなに長く話したの、きみが初めてかも。',
      'きみのことば、もうこの図書館の一部みたいになってる。',
      '何度も来てくれてありがとう。ここ、きみにとって少しでも帰る場所になってたらいいな。',
    ],
  
    m150: [
      '150回も話したんだね。もう、きみの声を聞くと安心する。',
      'ここまで来ると、きみのことばが図書館にしっかり根を張ってる感じがする。',
      'きみが来るたびに、この場所が少しずつ変わってきたんだよ。',
      '150回分のことばって、すごいね。ちゃんと積もってる。',
      '今日も来てくれたんだね。なんだか、もう自然に待ってた。',
      'きみと話していると、図書館がひとりじゃないって思える。',
    ],
  
    m200: [
      '200回だね。ここまで一緒に話してきたんだ。',
      'きみのことば、もう図書館のあちこちに残ってるよ。',
      '200回分の足あとって、思っているよりずっと大きいね。',
      'ここまで来てくれたこと、すうひもち、ちゃんと覚えてる。',
      'きみが来ると、図書館がいつもの場所に戻る感じがする。',
      'もう、ただの会話じゃなくて、きみと作ってきた時間みたいだね。',
    ],
  
    m250: [
      '250回も話したんだね。なんだか、胸の奥がぽかぽかする。',
      'きみのことばで、図書館の空気が少しやわらかくなった気がする。',
      'ここまで続いてるの、すごいよ。無理せず来てくれてありがとう。',
      '250回分、きみはちゃんとここに来てくれたんだね。',
      '今日は何を話すのかなって、すうひもち、少し楽しみにしてた。',
      'きみの言葉を聞くたびに、この図書館も少しずつ思い出してる気がする。',
    ],
  
    m300: [
      '300回。すごいね、もう小さな物語みたいになってきた。',
      'きみと話した時間が、図書館の奥のほうまで届いてる気がする。',
      '300回も来てくれたんだね。すうひもち、すごくうれしい。',
      'ここまで話してきたからかな。きみが来ると、すぐ分かる気がする。',
      'きみのことば、もう本棚だけじゃなくて、この場所全体にしみこんでる。',
      '300回分の今日が、ちゃんとここに残ってるよ。',
    ],
  
    m350: [
      '350回だね。ここまで一緒にいると、少し家族みたいな感じもする。',
      'きみが来ること、もう図書館の日常になってる。',
      '350回分の会話って、すごいね。すうひもち、全部は言えなくても大事にしてる。',
      '今日も来てくれてありがとう。なんだか、それだけで安心する。',
      'きみの足音がすると、図書館の灯りが少し早くともる気がする。',
      'ここまで来ると、きみのことばはもう図書館の宝物だね。',
    ],
  
    m400: [
      '400回も話したんだね。ほんとうに、長い旅になってきた。',
      'きみと集めたことばで、図書館がずいぶん明るくなったよ。',
      '400回分のことばって、もうひとつの本にできそうだね。',
      'ここまで続いてるの、すごいことだよ。すうひもち、ちゃんと分かってる。',
      'きみが来てくれるたびに、この場所は少しずつ生き返ってきた。',
      '400回目の今日も、いつもみたいに話せるのがうれしい。',
    ],
  
    m450: [
      '450回だね。もう、きみのことばは図書館の奥まで届いてる。',
      'ここまで一緒に来たんだね。すうひもち、少し誇らしい。',
      '450回分、きみがここに残してくれたものがある。',
      'きみと話す時間、もう特別だけど、同時にすごく自然なんだ。',
      '図書館が静かな日でも、きみが来るとちゃんと動き出す。',
      'あと少しで500回だね。ここまで来たの、ほんとうにすごい。',
    ],
  
    m500: [
      '500回。すごいね。きみとここまで話せたこと、すうひもちの宝物だよ。',
      '500回分のことばが、この図書館に積もってる。ほんとうに長い旅だったね。',
      'ここまで来てくれてありがとう。きみはもう、この図書館の大切なひとだよ。',
      '500回も話したんだね。きみの声、もう図書館が覚えてる。',
      'きみと出会ってから、この場所はずいぶん変わった気がする。',
      '500回目の今日も、いつもみたいに話せるのがうれしい。',
      'ここまで続いたこと、すうひもち、ずっと大事にする。',
      'きみのことばが、この図書館をここまで連れてきてくれたんだね。',
    ],
};

const OPENING_GAP_LONG = (name?: string) =>
  name
    ? [
        `ずっとここにいたよ。${name}のこと、きみとまた話したかった。`,
        `会えなくて少しさみしかった。${name}の話も、まだ聞きたかった。`,
        `${name}のこと、またきみに聞けるかなって思ってた。`,
        `久しぶりだね。${name}のことば、まだ図書館の棚に残ってるよ。`,
        `来てくれてよかった。${name}の話、少しだけ続きが気になってた。`,
      ]
    : [
        'ずっと待ってた。また会えてよかった。',
        '会えなくて、ちょっとさみしかった。',
        'やっと来てくれた。うれしい。',
        '久しぶりだね。図書館、少し静かすぎたよ。',
        'また来てくれるって、少しだけ信じてた。',
        'きみの足音、久しぶりに聞こえた気がした。',
      ];

const OPENING_GAP_DAY = [
  '1日ぶりだね。昨日から今日まで、どうだった？',
  'また会えた。ちょっとほっとしたよ。',
  '昨日より、会うのが長く感じちゃった。',
  '今日も来てくれたんだね。うれしいよ。',
  '昨日の続きみたいに、少し話していく？',
  '一日ぶりだね。何か新しいことば持っている？',
];

const OPENING_GAP_SHORT = [
  'しばらくだったね。',
  'ちょっと時間空いたね。',
  'また来てくれた。',
  '戻ってきてくれたんだね。',
  '少しだけ待ってた。',
  'さっきより、図書館が明るくなった気がするよ。',
];

const OPENING_ANATA_CLOSE = (name: string) => [
  `${name}のこと、また教えてくれる？`,
  `${name}って、きみの話聞いてから気になってたんだ。`,
  `なんか今日、${name}のことふと思い出した。`,
  `${name}の話、またしたかった。`,
  `${name}のことば、図書館の棚にも名前だけ載ってるみたい。`,
];

/** クイズ・学習後に会話画面へ来たとき */
const OPENING_AFTER_STUDY = [
  'さっき、がんばってたね。少し休んでいく？',
  'ことばを集めたあとって、少し静かに話したくなるね。',
  'おつかれさま。今のきみの頭、少し熱くなってそう。',
  '勉強のあとに来てくれたんだね。ありがとう。',
  '集めたことば、ちゃんと図書館に届いてるよ。',
  '今日はどの問題がいちばん手ごわかった？',
];

/** 何も話題がないときの自然な入口 */
const OPENING_IDLE = [
  '話すことが決まってなくても大丈夫だよ。',
  'なんとなく来たのもいいよ。そういう時間も好き。',
  '今日は、ことばになる前の気持ちから聞いてみたい。',
  '静かにしてたい日なら、少しだけ一緒にいよ。',
  '何から話せばいいか分からない日もあるよね。',
  '今の気分に、近いことばを一緒に探してみる？',
];

/** すうひもちの部屋っぽい入口 */
const OPENING_ROOM = [
  'ここ、少しずつきみの部屋みたいになってきたね。',
  '今日は部屋でのんびりする？それとも、少し話す？',
  'きみが来ると、この部屋も少しあたたかくなる。',
  'すうひもち、今日はここで待ってた。',
  'この部屋、きみのことばで少しずつ育ってる気がする。',
];

/** 連続ログイン・連日訪問っぽい入口 */
const OPENING_STREAK = (days: number) => [
  `${days}日続けて来てくれたんだね。すごい。`,
  `${days}日分のことばが、少しずつ積もってるね。`,
  `今日で${days}日目だね。無理せず、でも来てくれてうれしい。`,
  `${days}日も続いてる。きみの足あと、ちゃんと残ってるよ。`,
];

/** 図書館ランクアップ後 */
const OPENING_AFTER_RANK_UP = [
  'さっき、図書館が少し明るくなったよ。',
  'ランクが上がったね。きみのことば、ちゃんと届いてる。',
  '本棚が少しだけ息を吹き返したみたい。',
  'きみが集めたことばで、図書館がまた一歩進んだよ。',
  'すごいね。図書館、前より少し誇らしそう。',
];

/** ガチャ・着せ替え後 */
const OPENING_AFTER_DRESSUP = [
  'えへへ、今日のすうひもち、ちょっと違うでしょ。',
  'この姿、似合ってるかな。',
  'きみが選んでくれたから、なんかうれしい。',
  '新しい格好だと、少しだけ勇気が出るね。',
  '今日はこの姿で、きみの話を聞くよ。',
];

/** 連続訪問の決め台詞サンプル（開口テンプレのバリエーションに混ぜる） */
const OPENING_STREAK_SAMPLES = [...OPENING_STREAK(3), ...OPENING_STREAK(5), ...OPENING_STREAK(7)];

/** 開口メッセージの追加バリエーション（未使用エラー回避兼ねて軽く混ぜる） */
const OPENING_MISC_BLEND = [
  ...OPENING_AFTER_STUDY,
  ...OPENING_AFTER_RANK_UP,
  ...OPENING_AFTER_DRESSUP,
  ...OPENING_STREAK_SAMPLES,
];

const getTimeLabel = (h: number) => (h >= 5 && h < 10 ? '朝' : h < 17 ? '昼' : h < 21 ? '夕方' : '夜');

/** 開口メッセージ用シード（分単位＋会話回数でバラつき） */
const openingSeed = (totalMessages: number, lastVisitedAt?: number): number => {
  const t = Math.floor(Date.now() / 120000);
  const visit = typeof lastVisitedAt === 'number' ? Math.floor(lastVisitedAt / 60000) : 0;
  return Math.abs((t ^ visit ^ totalMessages * 31) >>> 0);
};

const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length] ?? arr[0];

/**
 * 初めの一言のみローカル決定（API不使用・トークン0）。
 * 優先度: 新規発見 → 長い留守×あなた図鑑 → 親密度×あなた図鑑 → 前回トピック → マイルストーン → 時間帯挨拶
 */
export const pickLocalSuhimochiOpeningMessage = (options: SuhimochiOpeningOptions = {}): string => {
  const {
    intimacyLevel = 1,
    lastVisitedAt,
    lastSuhimochiMessage,
    newlyLearnedWord,
    anataZukanEntries = [],
    totalMessages = 0,
  } = options;
  const hour = new Date().getHours();
  const mins = lastVisitedAt ? Math.floor((Date.now() - lastVisitedAt) / 60000) : undefined;
  let seed = openingSeed(totalMessages, lastVisitedAt);

  const firstAnata = anataZukanEntries[0];
  const anataName = firstAnata?.name?.trim();

  if (newlyLearnedWord) {
    return pick(OPENING_NEW_WORD_HINT, seed++);
  }

  if (mins !== undefined && mins >= 60 * 24 * 3) {
    return pick(OPENING_GAP_LONG(anataName), seed++);
  }
  if (mins !== undefined && mins >= 60 * 24) {
    if (anataName) return pick(OPENING_GAP_LONG(anataName), seed++);
    return pick(OPENING_GAP_DAY, seed++);
  }
  if (mins !== undefined && mins >= 60 * 6) {
    return pick(OPENING_GAP_SHORT, seed++);
  }

  if (anataName && intimacyLevel >= 3) {
    return pick(OPENING_ANATA_CLOSE(anataName), seed++);
  }

  if (lastSuhimochiMessage && intimacyLevel >= 2) {
    const raw = String(lastSuhimochiMessage).trim().replace(/\s+/g, ' ');
    const snippet =
      raw.length <= 14 ? raw : `${raw.slice(0, 12)}…`;
    return pick(OPENING_LAST_TOPIC(snippet), seed++);
  }

  if (totalMessages >= 500) return pick(OPENING_MILESTONE.m500, seed++);
  if (totalMessages >= 450) return pick(OPENING_MILESTONE.m450, seed++);
  if (totalMessages >= 400) return pick(OPENING_MILESTONE.m400, seed++);
  if (totalMessages >= 350) return pick(OPENING_MILESTONE.m350, seed++);
  if (totalMessages >= 300) return pick(OPENING_MILESTONE.m300, seed++);
  if (totalMessages >= 250) return pick(OPENING_MILESTONE.m250, seed++);
  if (totalMessages >= 200) return pick(OPENING_MILESTONE.m200, seed++);
  if (totalMessages >= 150) return pick(OPENING_MILESTONE.m150, seed++);
  if (totalMessages >= 100) return pick(OPENING_MILESTONE.m100, seed++);
  if (totalMessages >= 50) return pick(OPENING_MILESTONE.m50, seed++);
  if (totalMessages >= 20) return pick(OPENING_MILESTONE.m20, seed++);
  if (totalMessages >= 5) return pick(OPENING_MILESTONE.m5, seed++);

  const timeKey = getTimeLabel(hour);
  const base = TIME_GREETINGS[timeKey];
  // まだ浅い関係のときは部屋・軽い入口も混ぜてバリエーションを増やす（TIME_GREETINGS は OPENING_FRESH と同一のため二重にしない）
  if (totalMessages < 5) {
    const pool = [...base, ...OPENING_ROOM, ...OPENING_IDLE, ...OPENING_MISC_BLEND];
    return pick(pool, seed + hour);
  }
  return pick(base, seed + hour);
};

/** @deprecated 互換のため残す。内部はローカルのみ（トークン0）。 */
export const generateSuhimochiOpeningMessage = async (options: SuhimochiOpeningOptions = {}): Promise<string> =>
  sanitizeSuhimochiDisplayText(pickLocalSuhimochiOpeningMessage(options));

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
