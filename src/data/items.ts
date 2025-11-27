/**
 * Potenote Scanner v2 - Item Data
 * 
 * ガチャアイテムのデータ定義
 * ロジックから分離して拡張・管理しやすくする
 */

export interface ItemVisual {
  type: 'svg_path' | 'color';
  value: string;
}

export interface Item {
  id: string;
  name: string;
  type: 'consumable' | 'equipment';
  category?: 'head' | 'body' | 'face' | 'accessory';
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  dropWeight: number; // ガチャ排出の重み付け
  visual: ItemVisual; // データ駆動で見た目を定義
  description?: string;
}

/**
 * レアリティごとの基本排出重み
 * N: 60%, R: 25%, SR: 12%, SSR: 3%
 */
export const RARITY_BASE_WEIGHTS = {
  N: 60,
  R: 25,
  SR: 12,
  SSR: 3,
} as const;

/**
 * 全アイテムデータ
 * 
 * dropWeightはレアリティ内での相対的な重み
 * 例: N内でdropWeight: 10とdropWeight: 5なら、10は5の2倍出やすい
 */
export const ALL_ITEMS: Item[] = [
  // ===== N レアリティ (コモン) =====
  // 消耗品
  {
    id: 'n_potion_hp_s',
    name: 'ミニ回復薬',
    type: 'consumable',
    rarity: 'N',
    dropWeight: 15,
    visual: { type: 'color', value: '#7CFC00' },
    description: '小さな回復薬。スタミナを1回復する。',
  },
  {
    id: 'n_coin_bag_s',
    name: '小銭袋',
    type: 'consumable',
    rarity: 'N',
    dropWeight: 15,
    visual: { type: 'color', value: '#FFD700' },
    description: '少しのコインが入った袋。10コイン獲得。',
  },
  {
    id: 'n_map_fragment',
    name: '地図の欠片',
    type: 'consumable',
    rarity: 'N',
    dropWeight: 12,
    visual: { type: 'color', value: '#DEB887' },
    description: '古びた地図の一部。集めると何かが起こる？',
  },
  // 装備品
  {
    id: 'n_glasses_plain',
    name: 'シンプルメガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 10,
    visual: { type: 'svg_path', value: 'M4,12 C4,8 8,8 12,12 C16,8 20,8 20,12' },
    description: '飾り気のないメガネ。知的に見える。',
  },
  {
    id: 'n_cap_basic',
    name: 'ベーシックキャップ',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 10,
    visual: { type: 'color', value: '#4169E1' },
    description: 'シンプルな野球帽。',
  },
  {
    id: 'n_scarf_cotton',
    name: 'コットンスカーフ',
    type: 'equipment',
    category: 'accessory',
    rarity: 'N',
    dropWeight: 8,
    visual: { type: 'color', value: '#F5DEB3' },
    description: '柔らかい綿のスカーフ。',
  },

  // ===== R レアリティ (レア) =====
  // 消耗品
  {
    id: 'r_potion_hp_m',
    name: '回復薬',
    type: 'consumable',
    rarity: 'R',
    dropWeight: 12,
    visual: { type: 'color', value: '#32CD32' },
    description: 'スタミナを2回復する。',
  },
  {
    id: 'r_coin_bag_m',
    name: '銀貨袋',
    type: 'consumable',
    rarity: 'R',
    dropWeight: 12,
    visual: { type: 'color', value: '#C0C0C0' },
    description: '銀貨がたくさん。30コイン獲得。',
  },
  {
    id: 'r_exp_book',
    name: '知識の書',
    type: 'consumable',
    rarity: 'R',
    dropWeight: 10,
    visual: { type: 'color', value: '#8B4513' },
    description: '経験値が少し増える本。',
  },
  // 装備品
  {
    id: 'r_glasses_smart',
    name: 'スマートグラス',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 8,
    visual: { type: 'svg_path', value: 'M3,12 Q3,7 8,10 L10,10 Q12,7 17,10 Q22,7 22,12' },
    description: 'おしゃれなスマートグラス。',
  },
  {
    id: 'r_hat_wizard',
    name: '見習い魔法帽',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 8,
    visual: { type: 'color', value: '#4B0082' },
    description: '魔法使い見習いの帽子。',
  },
  {
    id: 'r_necklace_star',
    name: '星のネックレス',
    type: 'equipment',
    category: 'accessory',
    rarity: 'R',
    dropWeight: 7,
    visual: { type: 'svg_path', value: 'M12,2 L14,8 L20,9 L15,14 L17,20 L12,16 L7,20 L9,14 L4,9 L10,8 Z' },
    description: '小さな星のペンダント。',
  },
  {
    id: 'r_shirt_stripe',
    name: 'ストライプシャツ',
    type: 'equipment',
    category: 'body',
    rarity: 'R',
    dropWeight: 8,
    visual: { type: 'color', value: '#87CEEB' },
    description: '爽やかなストライプ柄。',
  },

  // ===== SR レアリティ (スーパーレア) =====
  // 消耗品
  {
    id: 'sr_potion_hp_l',
    name: '高級回復薬',
    type: 'consumable',
    rarity: 'SR',
    dropWeight: 8,
    visual: { type: 'color', value: '#00FF00' },
    description: 'スタミナを全回復する。',
  },
  {
    id: 'sr_coin_bag_l',
    name: '金貨袋',
    type: 'consumable',
    rarity: 'SR',
    dropWeight: 8,
    visual: { type: 'color', value: '#FFD700' },
    description: '金貨がたっぷり。100コイン獲得。',
  },
  {
    id: 'sr_gacha_ticket',
    name: 'ガチャチケット',
    type: 'consumable',
    rarity: 'SR',
    dropWeight: 6,
    visual: { type: 'color', value: '#FF69B4' },
    description: '無料でガチャを1回引ける。',
  },
  // 装備品
  {
    id: 'sr_glasses_vr',
    name: 'VRゴーグル',
    type: 'equipment',
    category: 'face',
    rarity: 'SR',
    dropWeight: 5,
    visual: { type: 'color', value: '#1E1E1E' },
    description: '未来的なVRゴーグル。',
  },
  {
    id: 'sr_crown_silver',
    name: '銀の冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 5,
    visual: { type: 'svg_path', value: 'M4,16 L4,8 L8,12 L12,6 L16,12 L20,8 L20,16 Z' },
    description: '気品ある銀の冠。',
  },
  {
    id: 'sr_cape_hero',
    name: 'ヒーローマント',
    type: 'equipment',
    category: 'body',
    rarity: 'SR',
    dropWeight: 5,
    visual: { type: 'color', value: '#DC143C' },
    description: '風になびく赤いマント。',
  },
  {
    id: 'sr_ring_magic',
    name: '魔法の指輪',
    type: 'equipment',
    category: 'accessory',
    rarity: 'SR',
    dropWeight: 4,
    visual: { type: 'color', value: '#9400D3' },
    description: '不思議な力を秘めた指輪。',
  },

  // ===== SSR レアリティ (スーパースーパーレア) =====
  // 消耗品
  {
    id: 'ssr_elixir',
    name: 'エリクサー',
    type: 'consumable',
    rarity: 'SSR',
    dropWeight: 4,
    visual: { type: 'color', value: '#E6E6FA' },
    description: '全ての状態を完全回復する伝説の霊薬。',
  },
  {
    id: 'ssr_coin_treasure',
    name: '宝箱',
    type: 'consumable',
    rarity: 'SSR',
    dropWeight: 3,
    visual: { type: 'svg_path', value: 'M4,10 L4,18 L20,18 L20,10 M2,10 L22,10 L20,6 L4,6 Z' },
    description: '財宝がぎっしり！500コイン獲得。',
  },
  // 装備品
  {
    id: 'ssr_crown_gold',
    name: '黄金の王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SSR',
    dropWeight: 2,
    visual: { type: 'svg_path', value: 'M3,18 L3,10 L7,14 L12,6 L17,14 L21,10 L21,18 Z M6,10 L6,6 M12,6 L12,2 M18,10 L18,6' },
    description: '王者だけが被ることを許された至高の冠。',
  },
  {
    id: 'ssr_glasses_legendary',
    name: '賢者のモノクル',
    type: 'equipment',
    category: 'face',
    rarity: 'SSR',
    dropWeight: 2,
    visual: { type: 'svg_path', value: 'M14,12 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M18,10 L22,6' },
    description: '真実を見通す伝説のモノクル。',
  },
  {
    id: 'ssr_armor_dragon',
    name: 'ドラゴンアーマー',
    type: 'equipment',
    category: 'body',
    rarity: 'SSR',
    dropWeight: 2,
    visual: { type: 'color', value: '#B22222' },
    description: '龍の鱗で作られた最強の鎧。',
  },
  {
    id: 'ssr_wings_angel',
    name: '天使の羽',
    type: 'equipment',
    category: 'accessory',
    rarity: 'SSR',
    dropWeight: 2,
    visual: { type: 'svg_path', value: 'M12,12 C8,8 2,10 2,6 C2,2 8,4 12,8 C16,4 22,2 22,6 C22,10 16,8 12,12' },
    description: '天界から舞い降りた神聖な翼。',
  },
];

/**
 * レアリティでアイテムをフィルタリング
 */
export const getItemsByRarity = (rarity: Item['rarity']): Item[] => {
  return ALL_ITEMS.filter((item) => item.rarity === rarity);
};

/**
 * タイプでアイテムをフィルタリング
 */
export const getItemsByType = (type: Item['type']): Item[] => {
  return ALL_ITEMS.filter((item) => item.type === type);
};

/**
 * カテゴリでアイテムをフィルタリング
 */
export const getItemsByCategory = (category: Item['category']): Item[] => {
  return ALL_ITEMS.filter((item) => item.category === category);
};

/**
 * IDでアイテムを取得
 */
export const getItemById = (id: string): Item | undefined => {
  return ALL_ITEMS.find((item) => item.id === id);
};

/**
 * レアリティの色を取得
 */
export const getRarityColor = (rarity: Item['rarity']): string => {
  const colors = {
    N: '#9CA3AF',    // Gray
    R: '#3B82F6',    // Blue
    SR: '#A855F7',   // Purple
    SSR: '#F59E0B',  // Amber/Gold
  };
  return colors[rarity];
};

/**
 * レアリティのグラデーションを取得
 */
export const getRarityGradient = (rarity: Item['rarity']): string => {
  const gradients = {
    N: 'linear-gradient(135deg, #6B7280, #9CA3AF)',
    R: 'linear-gradient(135deg, #2563EB, #60A5FA)',
    SR: 'linear-gradient(135deg, #7C3AED, #C084FC)',
    SSR: 'linear-gradient(135deg, #D97706, #FCD34D, #F59E0B)',
  };
  return gradients[rarity];
};

