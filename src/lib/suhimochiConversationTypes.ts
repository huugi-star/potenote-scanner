import type { PotatoEmotion } from '@/components/ui/PotatoAvatar';

// ─── 会話メッセージ ────────────────────────────────────────────────────────

export interface ConversationChatMessage {
  id: string;
  role: 'user' | 'suhimochi';
  text: string;
}

// ─── 収集語 ───────────────────────────────────────────────────────────────

export type SuhimochiCollectedWord = {
  word: string;
  source: 'word_collection' | 'word_dex' | 'word_dex_relation';
  aliases?: string[];
  /** 低レベル=ふんわり、高レベル=自然に織り込む */
  level: 1 | 2 | 3 | 4 | 5;
  meaning?: string;
  description?: string;
  relatedFacts?: string[];
  relations?: Array<{
    target: string;
    relation: string;
  }>;
  contextKeywords?: string[];
  note?: string;
};

// ─── 感情（PotatoAvatar と共有） ─────────────────────────────────────────

/** アバター表示用感情（PotatoEmotion の別名） */
export type SuhimochiMood = PotatoEmotion;

// ─── SNS タイムライン MVP ─────────────────────────────────────────────────

export type SuhimochiInterest =
  | 'アニメ'
  | 'YouTuber'
  | '映画'
  | '音楽'
  | 'ゲーム'
  | '仕事'
  | 'SNS';

export interface SuhimochiKeyword {
  word: string;
  /** 0〜100。ユーザーが使うたびに +10、7日未使用で -5 ずつ自然減衰 */
  weight: number;
  lastUsed: number; // Unix timestamp (ms)
  source: 'user' | 'system';
}

export interface SuhimochiTimelinePost {
  id: string;
  text: string;
  timestamp: number; // Unix timestamp (ms)
  genre?: SuhimochiInterest;
  /** auto = ジャンルテンプレ, trend = 擬似トレンド, memory = 身内ネタ再利用 */
  type: 'auto' | 'trend' | 'memory';
}

// ─── あなた図鑑（独立） ────────────────────────────────────────────────────

export type AnataRelation = 'favorite' | 'like' | 'interested' | 'dislike';
export type AnataCategory = 'work' | 'character' | 'topic' | 'food' | 'game' | 'person' | 'sport' | 'music' | 'place' | 'animal' | 'other';
export interface AnataZukanEntry {
  id: string;
  name: string;
  normalizedName: string;
  relation: AnataRelation;
  category: AnataCategory;
  /** 「ここがスキ」（自由記述。会話を深くするメモ） */
  likePoint?: string;
  sourceText: string;
  confidence: number;
  mentionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnataZukanExtractedEntry {
  name: string;
  relation: AnataRelation;
  category: AnataCategory;
  /** 「ここがスキ」（抽出時点では空でもOK） */
  likePoint?: string;
  sourceText: string;
  confidence: number;
}