import {
  INTENT_KEYWORDS,
  TOPIC_KEYWORDS,
  TOPIC_REPLIES,
} from '@/lib/suhimochiConversationData';
import type {
  SuhimochiIntent,
  SuhimochiReplyResult,
  SuhimochiTopic,
} from '@/lib/suhimochiConversationTypes';

const AFFIRMATIVE_WORDS = ['はい', 'うん', 'うんうん', 'そう', 'そうだよ', 'なるほど'];
const NEGATIVE_WORDS = ['いいえ', 'ちがう', 'いや', 'べつに'];
const EMOTION_POSITIVE_WORDS = ['おいしい', '美味しい', 'たのしい', '楽しい', 'うれしい', '好き', 'すき'];
const EMOTION_NEGATIVE_WORDS = ['かなしい', '悲しい', 'つらい', '疲れた', 'しんどい', 'いやだった'];

const DEFAULT_REPLIES = {
  greeting: [
    'おかえり。今日はどんな言葉を見つけたの？',
    'きてくれてうれしいな。今日はなにを話そうか。',
  ],
  gratitude: [
    'どういたしまして。そう言ってもらえてうれしいよ。',
    'えへへ、こちらこそありがとう。',
  ],
  teaching_word: [
    'その言葉、いいね。どんな場面で見つけたの？',
    '教えてくれてありがとう。その言葉、ちょっと気になるな。',
  ],
  ask_dictionary: [
    '図鑑で見てみようか。その言葉、どんな意味だと思う？',
    'いっしょに確かめてみたいな。その言葉、覚えてる？',
  ],
  edit_word: [
    '言葉をなおしたいんだね。どこを変えたいの？',
    '修正したいところがあるんだね。少し教えてくれる？',
  ],
  question: [
    '気になるね。もう少しだけ聞かせて。',
    'その話、もう少し詳しく知りたいな。',
    'それって、どんな感じだったの？',
  ],
  smalltalk: [
    'うんうん、その話いいね。',
    'そうなんだね。なんだか気になるな。',
    'なるほど。もう少し聞いてみたいかも。',
  ],
  unknown: [
    'その言葉、いいね。よかったらもう少しだけ聞かせて。',
    'うんうん、少し気になるな。続きを聞いてもいい？',
    'その話の続き、ちょっと聞いてみたいな。',
  ],
} as const;

const pickByInput = (input: string, list: string[]): string => {
  if (list.length === 0) return '';
  const seed = Array.from(input).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return list[seed % list.length];
};

const pickAvoidSame = (input: string, list: string[], avoid?: string): string => {
  if (list.length === 0) return '';
  if (!avoid) return pickByInput(input, list);

  const filtered = list.filter((item) => item !== avoid);
  if (filtered.length === 0) return pickByInput(input, list);

  return pickByInput(input, filtered);
};

const isSingleWordLike = (normalized: string): boolean => {
  if (!normalized) return false;
  if (normalized.includes(' ')) return false;
  if (normalized.includes('　')) return false;
  if (normalized.length <= 4) return true;
  return false;
};

const detectTopic = (normalized: string): { topic: SuhimochiTopic; reason: string } => {
  const order: SuhimochiTopic[] = [
    'friendship',
    'physics',
    'promise',
    'study',
    'dictionary',
    'language',
    'daily_life',
  ];

  for (const key of order) {
    const hit = TOPIC_KEYWORDS[key].find((word) => normalized.includes(word));
    if (hit) return { topic: key, reason: `topic:${key} (keyword:${hit})` };
  }

  if (EMOTION_POSITIVE_WORDS.some((word) => normalized.includes(word))) {
    return { topic: 'daily_life', reason: 'topic:daily_life (positive emotion fallback)' };
  }

  if (EMOTION_NEGATIVE_WORDS.some((word) => normalized.includes(word))) {
    return { topic: 'daily_life', reason: 'topic:daily_life (negative emotion fallback)' };
  }

  return { topic: 'unknown', reason: 'topic:unknown (no matched keyword)' };
};

type Recognized = {
  isAffirmative: boolean;
  isNegative: boolean;
  emotionSignal: 'positive' | 'negative' | null;
  isWordLike: boolean;
  subjectWord?: string;
};

type ConversationFlow = 'confirm' | 'deny' | 'follow' | 'shift';
type DecisionType = 'empathy' | 'softConfirm' | 'softRedirect' | 'question' | 'expand' | 'normal';

const extractSubjectWord = (input: string, normalized: string): string | undefined => {
  if (isSingleWordLike(normalized)) return input.trim();
  const compact = input.trim();
  if (!compact) return undefined;
  const first = compact.split(/[\s　、。,.!?！？]/).filter(Boolean)[0];
  return first && first.length <= 12 ? first : undefined;
};

// ① 認識
const recognizeInput = (input: string, normalized: string): { recognized: Recognized; reason: string } => {
  const isAffirmative = AFFIRMATIVE_WORDS.some((word) => normalized === word || normalized.includes(word));
  const isNegative = NEGATIVE_WORDS.some((word) => normalized === word || normalized.includes(word));
  const hasPositiveEmotion = EMOTION_POSITIVE_WORDS.some((word) => normalized.includes(word));
  const hasNegativeEmotion = EMOTION_NEGATIVE_WORDS.some((word) => normalized.includes(word));
  const emotionSignal: Recognized['emotionSignal'] = hasPositiveEmotion
    ? 'positive'
    : hasNegativeEmotion
    ? 'negative'
    : null;
  const isWordLike = isSingleWordLike(normalized);
  const subjectWord = extractSubjectWord(input, normalized);

  return {
    recognized: {
      isAffirmative,
      isNegative,
      emotionSignal,
      isWordLike,
      subjectWord,
    },
    reason: `recognize:aff=${isAffirmative},neg=${isNegative},emo=${emotionSignal ?? 'none'},wordLike=${isWordLike},subject=${subjectWord ?? 'none'}`,
  };
};

// ② 理解
const understandConversation = ({
  normalized,
  recognized,
}: {
  normalized: string;
  recognized: Recognized;
}): { intent: SuhimochiIntent; topic: SuhimochiTopic; emotion: SuhimochiReplyResult['emotion']; reason: string } => {
  let intent: SuhimochiIntent = 'unknown';

  const intentOrder: SuhimochiIntent[] = [
    'greeting',
    'gratitude',
    'teaching_word',
    'ask_dictionary',
    'edit_word',
    'question',
    'smalltalk',
  ];
  for (const key of intentOrder) {
    const hit = INTENT_KEYWORDS[key].find((word) => normalized.includes(word));
    if (hit) {
      intent = key;
      break;
    }
  }
  if (intent === 'unknown' && recognized.isWordLike) intent = 'question';
  if (intent === 'unknown' && (recognized.isAffirmative || recognized.isNegative || recognized.emotionSignal)) {
    intent = 'smalltalk';
  }

  const { topic } = detectTopic(normalized);
  const emotion: SuhimochiReplyResult['emotion'] =
    recognized.emotionSignal === 'positive'
      ? 'happy'
      : recognized.emotionSignal === 'negative'
      ? 'confused'
      : intent === 'question'
      ? 'smart'
      : intent === 'greeting' || intent === 'gratitude'
      ? 'happy'
      : 'normal';

  return {
    intent,
    topic,
    emotion,
    reason: `understand:intent=${intent},topic=${topic},emotion=${emotion}`,
  };
};

// ③ 流れ
const decideFlow = ({
  recognized,
  topic,
  lastTopic,
}: {
  recognized: Recognized;
  topic: SuhimochiTopic;
  lastTopic?: SuhimochiTopic;
}): { flow: ConversationFlow; reason: string } => {
  if (recognized.isAffirmative) return { flow: 'confirm', reason: 'flow:confirm (affirmative)' };
  if (recognized.isNegative) return { flow: 'deny', reason: 'flow:deny (negative)' };
  if (lastTopic && topic !== 'unknown' && topic === lastTopic) {
    return { flow: 'follow', reason: 'flow:follow (same topic)' };
  }
  return { flow: 'shift', reason: 'flow:shift (default)' };
};

// ④ 判断（intent 最優先 → emotion → confirm/deny → 単語 → expand）
const decideAction = ({
  intent,
  recognized,
  flow,
  lastIntent,
}: {
  intent: SuhimochiIntent;
  recognized: Recognized;
  flow: ConversationFlow;
  lastIntent?: SuhimochiIntent;
}): { action: DecisionType; reason: string } => {
  if (intent === 'greeting') {
    return { action: 'normal', reason: 'greeting priority' };
  }
  if (intent === 'gratitude') {
    return { action: 'empathy', reason: 'gratitude priority' };
  }
  if (recognized.emotionSignal) return { action: 'empathy', reason: 'decide:empathy (emotion detected)' };
  if (flow === 'confirm') return { action: 'softConfirm', reason: 'decide:softConfirm (confirm flow)' };
  if (flow === 'deny') return { action: 'softRedirect', reason: 'decide:softRedirect (deny flow)' };
  if (recognized.isWordLike) return { action: 'question', reason: 'decide:question (word-like input)' };
  if (lastIntent === 'question') return { action: 'expand', reason: 'decide:expand (after question)' };
  return { action: 'normal', reason: 'decide:normal (fallback)' };
};

const softTone = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return 'うん、もう少し聞かせてね。';
  const normalized = trimmed
    .replace(/だ。$/u, 'だよ。')
    .replace(/ね\.$/u, 'ね。');
  if (/[。！？?!]$/u.test(normalized)) return normalized;
  return `${normalized}ね。`;
};

// ⑤ 組立
const composeReply = ({
  normalized,
  topic,
  intent,
  action,
  recognized,
  lastReply,
}: {
  normalized: string;
  topic: SuhimochiTopic;
  intent: SuhimochiIntent;
  action: DecisionType;
  recognized: Recognized;
  lastReply?: string;
}): { reply: string; reason: string } => {
  const seed = normalized || 'default';
  const topicReplies = TOPIC_REPLIES[topic] ?? [];

  if (action === 'normal' && intent === 'greeting') {
    return {
      reply: pickAvoidSame(seed, [...DEFAULT_REPLIES.greeting], lastReply),
      reason: 'compose:normal (greeting templates)',
    };
  }

  if (recognized.subjectWord && (action === 'question' || action === 'expand' || action === 'normal')) {
    const subjectTemplates = [
      `${recognized.subjectWord}っていいね。どんな場面で出会ったの？`,
      `${recognized.subjectWord}、いい響きだね。もう少し教えてくれる？`,
      `${recognized.subjectWord}かあ。すうひもち、ちょっと気になるな。`,
    ];
    return {
      reply: pickAvoidSame(seed, subjectTemplates, lastReply),
      reason: 'compose:subject-word template',
    };
  }

  if (action === 'empathy') {
    const empathyReplies =
      recognized.emotionSignal === 'positive'
        ? [
            'それはうれしいね。聞いているこっちまであたたかくなるよ。',
            '楽しそうでいいね。その気持ち、大事にしていこう。',
          ]
        : recognized.emotionSignal === 'negative'
        ? [
            'そっか、少ししんどかったんだね。ここでゆっくりしよう。',
            'それは大変だったね。無理せず、ひと息ついていこう。',
          ]
        : [...DEFAULT_REPLIES.gratitude];
    return {
      reply: pickAvoidSame(seed, empathyReplies, lastReply),
      reason:
        recognized.emotionSignal === 'positive'
          ? 'compose:empathy (positive)'
          : recognized.emotionSignal === 'negative'
          ? 'compose:empathy (negative)'
          : 'compose:empathy (gratitude/neutral)',
    };
  }

  if (action === 'softConfirm') {
    return {
      reply: pickAvoidSame(
        seed,
        [
          'うんうん、そうなんだね。続きを聞かせてくれる？',
          'なるほど、いい感じだね。もう少し話してみよう。',
        ],
        lastReply
      ),
      reason: 'compose:softConfirm',
    };
  }

  if (action === 'softRedirect') {
    return {
      reply: pickAvoidSame(
        seed,
        [
          'わかったよ。じゃあ、別の言葉の話をしてみようか。',
          'そっか。無理しないで、話しやすいところからで大丈夫だよ。',
        ],
        lastReply
      ),
      reason: 'compose:softRedirect',
    };
  }

  if (action === 'question') {
    return {
      reply: pickAvoidSame(seed, [...topicReplies, ...DEFAULT_REPLIES.question], lastReply),
      reason: `compose:question (topic:${topic})`,
    };
  }

  if (action === 'expand') {
    return {
      reply: pickAvoidSame(
        seed,
        [
          ...topicReplies,
          'さっきの話、もう少し広げてみよう。どこが一番印象に残った？',
          'いい流れだね。その言葉で思い出す場面ってある？',
        ],
        lastReply
      ),
      reason: `compose:expand (topic:${topic})`,
    };
  }

  return {
    reply: pickAvoidSame(seed, [...topicReplies, ...DEFAULT_REPLIES.smalltalk, ...DEFAULT_REPLIES.unknown], lastReply),
    reason: `compose:normal (topic:${topic})`,
  };
};

export const generateSuhimochiReply = (
  input: string,
  options?: { lastReply?: string; lastIntent?: SuhimochiIntent; lastTopic?: SuhimochiTopic }
): SuhimochiReplyResult => {
  const normalized = input.trim().toLowerCase();
  const { recognized, reason: recognizeReason } = recognizeInput(input, normalized); // ① 認識
  const { intent, topic, emotion, reason: understandReason } = understandConversation({
    normalized,
    recognized,
  });
  const { flow, reason: flowReason } = decideFlow({
    recognized,
    topic,
    lastTopic: options?.lastTopic,
  }); // ③ 流れ
  const { action, reason: decideReason } = decideAction({
    intent,
    recognized,
    flow,
    lastIntent: options?.lastIntent,
  }); // ④ 判断

  const { reply, reason: composeReason } = composeReply({
    normalized,
    topic,
    intent,
    action,
    recognized,
    lastReply: options?.lastReply,
  }); // ⑤ 組立

  const softenedReply = softTone(reply); // ⑥ 出力

  const result: SuhimochiReplyResult = {
    reply: softenedReply,
    emotion,
    topic,
    intent,
    reason: `${recognizeReason}; ${understandReason}; ${flowReason}; ${decideReason}; ${composeReason}; output:softTone`,
  };

  console.log('[SuhimochiReply]', {
    input,
    normalized,
    intent,
    topic,
    emotion,
    flow,
    action,
    reply: softenedReply,
    lastIntent: options?.lastIntent,
    lastTopic: options?.lastTopic,
    reason: result.reason,
  });

  return result;
};