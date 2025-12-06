/**
 * Potenote Scanner v2 - Type Definitions
 * 
 * アプリケーション全体で使用する型定義
 */

import type { Item } from '@/data/items';

// ===== Quiz Types =====

/**
 * クイズの選択肢
 */
export interface QuizQuestion {
  q: string;           // 問題文
  options: string[];   // 選択肢 (4つ)
  a: number;           // 正解のインデックス (0-3)
  explanation: string; // 解説
}

/**
 * APIから返されるクイズ生データ
 */
export interface QuizRaw {
  summary: string;           // スキャンした内容の要約
  keywords: string[];        // フラッグ用キーワード (Top 3)
  questions: QuizQuestion[]; // クイズ問題 (5問)
}

/**
 * 処理済みクイズデータ (ゲームで使用)
 */
export interface Quiz extends QuizRaw {
  id: string;
  createdAt: Date;
  imageUrl?: string;   // スキャン元画像のURL
}

/**
 * 構造化OCRデータ（位置情報付き）
 */
export interface StructuredOCR {
  fullText: string;      // 全テキスト
  leftPage?: string;     // 左ページ（問題文エリア）
  rightPage?: string;    // 右ページ（解答エリア）
}

/**
 * チャンク（意味の塊）データ（英語学習モード用 - ビジュアル英文解釈）
 */
export interface Chunk {
  // 後方互換性のための既存フィールド
  text?: string;           // 英語の塊（後方互換用）
  translation?: string;    // その意味（後方互換用）
  type?: 'S' | 'V' | 'O' | 'C' | 'M' | 'Connect'; // 文の要素（後方互換用）
  
  // 新しいフィールド（AI出力形式）
  chunk_text: string;      // チャンクのテキスト（記号付き）
  chunk_translation: string; // その部分だけの直訳
  role: 'S' | 'V' | 'O' | 'C' | 'M' | 'Connect'; // 文の要素（役割）
  symbol: '[]' | '<>' | '()' | 'none'; // 囲む記号
  explanation?: string;   // 解説
}

/**
 * 構造要素（Interlinear Display用）
 */
export interface StructureElement {
  text: string;                    // テキスト（単語、句読点、スペースなど）
  symbol: '[]' | '<>' | '()' | 'V' | null; // 記号の種類
  type: 'noun_clause' | 'adj_clause' | 'adv_clause' | 'verb_phrase' | 'adv_phrase' | 'noun_phrase' | null; // GRAMMAR_TYPESのキー
  role: 'S' | 'V' | 'O' | 'C' | 'M' | 'Connect' | null; // ELEMENT_TYPESのキー
  label: string | null;            // 画面下段に表示する短いラベル（例: "名詞節(O)", "動詞(V)", "副詞(M)"）
}

/**
 * 一文の翻訳結果（一文完結型）
 */
export interface SentenceResult {
  marked_text: string;        // 構造化された原文（Big Chunkルール適用）
  translation: string;       // その文の和訳
  sub_structures?: Array<{    // 複雑な部分の分解リスト（ズームイン解析）
    target_chunk: string;     // 分解対象の文字列（例: "that the world could..."）
    analyzed_text: string;    // 分解後のタグ付きテキスト（例: "[the world]<{S'}> could..."）
  }>;
  vocab_list?: Array<{        // 重要単語・熟語リスト
    word: string;             // 例: "keep up with"
    meaning: string;          // 例: "～に遅れずについていく"
    isIdiom?: boolean;        // イディオムかどうか（オプション）
    explanation?: string;      // イディオムの説明（オプション）
  }>;
  grammar_note?: string;      // ワンポイント文法解説
  structure_explanations?: Array<{  // 難しい部分の詳しい説明（アコーディオン用）
    target_text: string;      // 説明対象のテキスト（例: "because it frightened their horses"）
    explanation: string;      // 詳しい構造説明
    difficulty_level?: 'easy' | 'medium' | 'hard'; // 難易度（オプション）
  }>;
  advanced_grammar_explanation?: string | null; // 高度な文法解説（名詞節・WH節・倒置・関係詞の非制限用法など）
}

/**
 * 翻訳結果
 */
export interface TranslationResult {
  originalText: string;   // 原文（後方互換用）
  translatedText: string; // 翻訳文（後方互換用）
  
  // 一文完結型のリスト形式（新形式・英語学習モード用）
  sentences?: SentenceResult[];
  
  // 後方互換用（オプション）
  marked_text?: string;        // 全文の記号付きテキスト（後方互換用）
  japanese_translation?: string; // 全文の自然な日本語訳（後方互換用）
  structure?: StructureElement[]; // 構造要素配列（非推奨）
  chunks?: Chunk[];       // チャンク（意味の塊）ごとの構造解析（後方互換用）
  teacherComment?: string; // 先生からの総評（英語学習モード用）
  
  // 多言語翻訳モード用（オプション）
  summary?: string;       // 3行まとめ（要旨）
  textType?: 'academic' | 'email' | 'manual' | 'general'; // 判定されたテキストタイプ
  tone?: string;          // 使用された口調の説明
  technicalTerms?: Array<{ // 専門用語とその補足説明
    term: string;
    explanation: string;
  }>;
}

/**
 * 翻訳履歴
 */
export interface TranslationHistory {
  id: string;
  originalText: string;
  translatedText: string;
  createdAt: string;   // ISO日付文字列
  imageUrl?: string;   // スキャン元画像のURL（オプション）
  // 英文解釈モードのデータ（オプション）
  sentences?: SentenceResult[];
  marked_text?: string;
  japanese_translation?: string;
  chunks?: Chunk[];   // 構造解析カード用のデータ
}

/**
 * クイズ履歴（フリークエスト用）
 */
export interface QuizHistory {
  id: string;
  quiz: QuizRaw;
  result: QuizResult;
  createdAt: string;   // ISO日付文字列
  usedQuestionIndices: number[];  // 出題済み問題のインデックス
  ocrText?: string;    // OCRで読み取ったテキスト（後方互換用）
  structuredOCR?: StructuredOCR;  // 構造化OCRデータ（位置情報付き）
}

/**
 * 島データ
 */
export interface Island {
  id: number;
  distance: number;    // この島までの累計距離
  name: string;
  keywords: string[];  // この島で獲得したキーワード
  unlockedAt: string;  // ISO日付文字列
}

// ===== User State Types =====

/**
 * ユーザーの状態
 */
export interface UserState {
  // ユーザーID（Firebase Auth）
  uid?: string | null;

  // リソース
  coins: number;                 // 所持コイン
  tickets: number;               // ガチャチケット
  stamina: number;               // スタミナ (Max 5)
  
  // 課金状態
  isVIP: boolean;                // VIP会員フラグ
  vipExpiresAt?: Date;           // VIP有効期限
  
  // 日次制限
  dailyScanCount: number;        // 本日のスキャン済み回数
  lastScanDate: string;          // 最終スキャン日 (YYYY-MM-DD)
  dailyFreeQuestGenerationCount: number;  // 本日のフリークエスト新問題生成回数
  lastFreeQuestGenerationDate: string;     // 最終フリークエスト生成日 (YYYY-MM-DD)
  dailyTranslationCount: number;  // 本日の翻訳回数
  lastTranslationDate: string;    // 最終翻訳日 (YYYY-MM-DD)
  
  // ログイン
  lastLoginDate: string;         // 最終ログイン日 (YYYY-MM-DD)
  consecutiveLoginDays: number;  // 連続ログイン日数
  
  // 統計
  totalScans: number;            // 累計スキャン回数
  totalQuizzes: number;          // 累計クイズプレイ回数
  totalCorrectAnswers: number;   // 累計正解数
  totalDistance: number;         // 累計移動距離 (km)
  totalQuizClears: number;       // 累計クイズクリア回数（アフィリエイト表示用）
  
  // 所持アイテム
  inventory: InventoryItem[];    // インベントリ
  equipment: EquippedItems;      // 装備中アイテム
}

/**
 * インベントリ内のアイテム
 */
export interface InventoryItem {
  itemId: string;     // アイテムID
  quantity: number;   // 所持数
  obtainedAt: Date;   // 最初に入手した日時
}

/**
 * 装備中のアイテム
 */
export interface EquippedItems {
  head?: string;      // 頭装備のアイテムID
  body?: string;      // 体装備のアイテムID
  face?: string;      // 顔装備のアイテムID
  accessory?: string; // アクセサリーのアイテムID
}

// ===== Game Session Types =====

/**
 * クイズセッションの結果
 */
export interface QuizResult {
  quizId: string;
  correctCount: number;       // 正解数
  totalQuestions: number;     // 問題数
  isPerfect: boolean;         // パーフェクトかどうか
  earnedCoins: number;        // 獲得コイン
  earnedDistance: number;     // 獲得距離
  isDoubled: boolean;         // コイン2倍が適用されたか
  timestamp: Date;
}

/**
 * ガチャ結果
 */
export interface GachaResult {
  item: Item;
  isNew: boolean;             // 新規入手かどうか
  timestamp: Date;
}

// ===== Map & Location Types =====

/**
 * マップ上の座標
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * フラッグ (マップ上のピン)
 */
export interface Flag {
  id: string;
  quizId: string;
  keywords: string[];         // 表示用キーワード
  position: Coordinate;       // マップ上の位置
  distance: number;           // 原点からの距離 (km)
  createdAt: Date;
}

/**
 * 旅の軌跡
 */
export interface Journey {
  totalDistance: number;      // 累計距離
  flags: Flag[];              // 設置したフラッグ
  currentPosition: Coordinate; // 現在位置
}

// ===== Ad & Monetization Types =====

/**
 * 広告タイプ
 */
export type AdType = 'scan_recovery' | 'coin_doubler';

/**
 * 広告視聴結果
 */
export interface AdWatchResult {
  type: AdType;
  success: boolean;
  timestamp: Date;
}

// ===== API Response Types =====

/**
 * API共通レスポンス
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * スキャンAPIレスポンス
 */
export interface ScanResponse extends ApiResponse<QuizRaw> {
  processedImageUrl?: string;
}

// ===== Utility Types =====

/**
 * 日付文字列 (YYYY-MM-DD形式)
 */
export type DateString = string;

/**
 * アイテムのレアリティ
 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

/**
 * 装備カテゴリ
 */
export type EquipmentCategory = 'head' | 'body' | 'face' | 'accessory';

