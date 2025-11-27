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
  
  // ログイン
  lastLoginDate: string;         // 最終ログイン日 (YYYY-MM-DD)
  consecutiveLoginDays: number;  // 連続ログイン日数
  
  // 統計
  totalScans: number;            // 累計スキャン回数
  totalQuizzes: number;          // 累計クイズプレイ回数
  totalCorrectAnswers: number;   // 累計正解数
  totalDistance: number;         // 累計移動距離 (km)
  
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

