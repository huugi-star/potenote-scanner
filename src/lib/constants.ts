/**
 * Potenote Scanner v2 - Constants
 * 
 * ゲーム内の定数定義
 * 報酬、制限、VIPプランなど
 */

// ===== Rewards (報酬) =====

export const REWARDS = {
  // クエストクリア報酬
  QUEST_CLEAR: {
    BASE_COINS: 3,           // 基本コイン（スキャン/フリークエスト共通）
    PERFECT_BONUS: 2,        // パーフェクトボーナス (+2コイン)
    TOTAL_PERFECT: 5,        // パーフェクト時の合計 (3+2)
  },
  
  // ログインボーナス
  LOGIN_BONUS: {
    FREE_COINS: 50,          // 無料ユーザーのログインボーナス
    VIP_COINS: 100,          // VIPユーザーのログインボーナス (2倍)
  },
  
  // 広告報酬
  AD_REWARDS: {
    SCAN_RECOVERY_COUNT: 3,  // スキャン回復数
    FREE_QUEST_GENERATION_RECOVERY_COUNT: 3,  // フリークエスト新問題生成回復数
    COIN_MULTIPLIER: 2,      // コイン倍率
  },
} as const;

// ===== Distance (距離計算) =====

export const DISTANCE = {
  // スキャン時の基本距離
  SCAN_BASE: {
    MIN: 0,                  // 0km（ベースなし）
    MAX: 0,                  // 0km（ベースなし）
  },
  
  // 正解ボーナス
  CORRECT_ANSWER: 1,         // 1問正解ごとに +1km
  
  // パーフェクトボーナス
  PERFECT_BONUS: 3,          // パーフェクト時 +3km
} as const;

// ===== VIP Plan (課金プラン) =====

export const VIP_PLAN = {
  // 価格
  PRICE: 550,                // ¥550 / 月
  CURRENCY: 'JPY',
  
  // 特典
  BENEFITS: {
    UNLIMITED_SCANS: true,   // スキャン無制限
    COIN_MULTIPLIER: 2,      // コイン常時2倍
    AD_FREE: true,           // 広告完全非表示
    LOGIN_BONUS_MULTIPLIER: 2, // ログインボーナス2倍
  },
} as const;

// ===== Limits (制限) =====

export const LIMITS = {
  // Free ユーザーの制限
  FREE_USER: {
    DAILY_SCAN_LIMIT: 3,     // 1日3回まで（スキャン）
    DAILY_FREE_QUEST_GENERATION_LIMIT: 3, // 1日3回まで（フリークエストの新問題生成）
    DAILY_TRANSLATION_LIMIT: 3, // 1日3回まで（翻訳）
    MAX_STAMINA: 5,          // 最大スタミナ
  },
  
  // VIP ユーザーの制限
  VIP_USER: {
    DAILY_SCAN_LIMIT: 100,   // 1日100回まで（課金で上限開放）
    DAILY_FREE_QUEST_GENERATION_LIMIT: 100, // 1日100回まで（課金で上限開放）
    DAILY_TRANSLATION_LIMIT: Infinity, // 無制限（翻訳）
    MAX_STAMINA: 5,          // 最大スタミナ (同じ)
  },
  
  // クイズ
  QUIZ: {
    QUESTIONS_PER_QUIZ: 5,   // 1クイズあたりの問題数
    OPTIONS_PER_QUESTION: 4, // 1問あたりの選択肢数
    TIME_LIMIT_SECONDS: 30,  // 1問あたりの制限時間
  },
  
  // インベントリ
  INVENTORY: {
    MAX_STACK: 99,           // 1アイテムの最大スタック数
  },
  
  // 翻訳履歴
  TRANSLATION_HISTORY: {
    MAX_ITEMS: 50,           // 最大保存数（localStorage容量対策）
  },
  
  // 講義履歴
  LECTURE_HISTORY: {
    MAX_ITEMS: 50,           // 最大保存数（localStorage容量対策）
  },
} as const;

// ===== Gacha (ガチャ) =====

export const GACHA = {
  // コスト
  COST: {
    SINGLE: 100,             // 単発ガチャ: 100コイン
    TEN_PULL: 900,           // 10連ガチャ: 900コイン (1回分お得)
  },
  
  // レアリティ確率 (%)
  RATES: {
    N: 60,
    R: 25,
    SR: 12,
    SSR: 3,
  },
  
  // 天井
  PITY: {
    SSR_GUARANTEE: 100,      // 100回でSSR確定
    SR_GUARANTEE: 10,        // 10回でSR以上確定
  },
} as const;

// ===== Stamina (スタミナ) =====

export const STAMINA = {
  MAX: 5,                    // 最大スタミナ
  QUIZ_COST: 1,              // クイズ1回のコスト
  RECOVERY_MINUTES: 30,      // 回復時間 (30分で1回復)
} as const;

// ===== Image Processing (画像処理) =====

export const IMAGE_PROCESSING = {
  MAX_WIDTH: 1024,           // 最大幅
  MAX_HEIGHT: 1024,          // 最大高さ
  QUALITY: 0.8,              // WebP品質 (0-1)
  FORMAT: 'image/webp' as const,
  MAX_SIZE_MB: 1,            // 最大ファイルサイズ (MB)
} as const;

// ===== Map (マップ) =====

export const MAP = {
  // 黄金螺旋のパラメータ
  GOLDEN_SPIRAL: {
    INITIAL_RADIUS: 10,      // 初期半径
    GROWTH_RATE: 0.1,        // 成長率
  },
  
  // 表示設定
  DISPLAY: {
    GRID_SIZE: 50,           // グリッドサイズ
    FLAG_SIZE: 24,           // フラッグのサイズ
  },
} as const;

// ===== Animation (アニメーション) =====

export const ANIMATION = {
  // ガチャ演出時間 (ms)
  GACHA: {
    ROLL_DURATION: 2000,     // 回転アニメーション
    REVEAL_DELAY: 500,       // 結果表示までの遅延
    SSR_EXTRA_DURATION: 1000, // SSR時の追加演出
  },
  
  // 画面遷移 (ms)
  TRANSITION: {
    PAGE: 300,
    MODAL: 200,
  },
} as const;

// ===== Error Messages (エラーメッセージ) =====

export const ERROR_MESSAGES = {
  SCAN_LIMIT_REACHED: '本日のスキャン回数（5回）の上限に達しました。広告を視聴して3回回復するか、VIPプラン（1日100回まで）にアップグレードしてください。',
  FREE_QUEST_GENERATION_LIMIT_REACHED: '本日の新問題生成回数（3回）の上限に達しました。広告を視聴して3回回復するか、VIPプラン（1日100回まで）にアップグレードしてください。',
  TRANSLATION_LIMIT_REACHED: '本日の翻訳回数（3回）の上限に達しました。VIPプラン（無制限）にアップグレードしてください。',
  INSUFFICIENT_COINS: 'コインが足りません。',
  INSUFFICIENT_STAMINA: 'スタミナが足りません。',
  INSUFFICIENT_TICKETS: 'チケットが足りません。',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。',
  IMAGE_TOO_LARGE: '画像サイズが大きすぎます。',
  INVALID_IMAGE: '無効な画像形式です。',
} as const;

// ===== Success Messages (成功メッセージ) =====

export const SUCCESS_MESSAGES = {
  SCAN_RECOVERED: 'スキャン回数が回復しました！',
  COINS_DOUBLED: 'コインが2倍になりました！',
  LOGIN_BONUS: 'ログインボーナスを獲得しました！',
  ITEM_OBTAINED: 'アイテムを獲得しました！',
} as const;

