import type { SuhimochiIntent, SuhimochiTopic } from '@/lib/suhimochiConversationTypes';

export const INTENT_KEYWORDS: Record<SuhimochiIntent, string[]> = {
  greeting: ['こんにちは', 'おはよう', 'こんばんは', 'ただいま', 'やあ'],
  gratitude: ['ありがとう', '助かる', '感謝'],
  teaching_word: ['教える', '覚えて', '単語', '言葉'],
  ask_dictionary: ['図鑑', '辞書', '一覧'],
  edit_word: ['修正', '直したい', '間違い', '訂正'],
  question: ['？', '?', 'なに', 'どうして', 'どうやって'],
  smalltalk: ['今日', '最近', '元気', '天気', '眠い'],
  unknown: [],
};

export const TOPIC_KEYWORDS: Record<SuhimochiTopic, string[]> = {
  friendship: ['友情', '友達', '仲間'],
  physics: ['gravity', '重力', '物理'],
  promise: ['約束', '誓い'],
  study: ['勉強', '学習', 'テスト', '英語'],
  daily_life: ['ごはん', '散歩', '部屋', '朝', '夜'],
  dictionary: ['図鑑', '辞書', '単語帳'],
  language: ['言葉', '単語', '表現', '意味'],
  unknown: [],
};

export const TOPIC_REPLIES: Record<SuhimochiTopic, string[]> = {
  friendship: [
    '友情って、言葉にすると照れるけど、行動にするとすごく伝わるよね。',
    '友達に向ける言葉は、やさしさを一滴足すだけで印象が変わるよ。',
  ],
  physics: [
    'gravity、いい言葉だね。見えない力を感じるって、ちょっとロマンだ。',
    '重力みたいに、言葉にも人を引き寄せる力がある気がするよ。',
  ],
  promise: [
    '約束は短い言葉でも、心の中ではすごく大きいよね。',
    '守ろうって思った瞬間に、もう半分は叶ってるのかも。',
  ],
  study: [
    '学んだ言葉を一つだけ今日の会話で使うと、ぐっと身につくよ。',
    '勉強は積み重ねが強いね。今日の一語、あとで図鑑に残しておこう。',
  ],
  daily_life: [
    '日常の言葉こそ、気持ちを整える魔法みたいなものだよ。',
    '今日の出来事を一言で表すなら、どんな言葉にする？',
  ],
  dictionary: [
    '図鑑に集めると、言葉の旅の地図みたいになって楽しいよ。',
    '辞書を眺めるだけでも、新しい出会いってあるんだよね。',
  ],
  language: [
    '言葉は意味だけじゃなく、温度も一緒に運んでくれるよ。',
    '同じ意味でも言い方で景色が変わるの、面白いよね。',
  ],
  unknown: [
    'うんうん、もっと聞かせて。今日はどんな言葉が気になった？',
    'いいね、その話。もう少し詳しく教えてくれる？',
  ],
};

export const INTENT_EMOTION: Record<SuhimochiIntent, 'happy' | 'smart' | 'confused' | 'normal'> = {
  greeting: 'happy',
  gratitude: 'happy',
  teaching_word: 'smart',
  ask_dictionary: 'smart',
  edit_word: 'confused',
  question: 'smart',
  smalltalk: 'normal',
  unknown: 'normal',
};

