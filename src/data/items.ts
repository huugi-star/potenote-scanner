/**
 * Potenote Scanner v2 - Item Data
 * 
 * ガチャアイテムのデータ定義
 * ロジックから分離して拡張・管理しやすくする
 */

export interface ItemVisual {
  type: 'svg_path' | 'color' | 'image';
  value: string;
}

export interface ItemThumbnail {
  size?    : string; // background-size (例: '150%', 'cover')
  position?: string; // background-position (例: '50% 30%')
}

export interface Item {
  id: string;
  name: string;
  type: 'consumable' | 'equipment';
  category?: 'head' | 'body' | 'face' | 'accessory';
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  dropWeight: number; // ガチャ排出の重み付け
  visual: ItemVisual; // データ駆動で見た目を定義
  thumbnail?: ItemThumbnail; // サムネ個別調整（未指定はカテゴリデフォルト）
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
  // 装備品(head)

  {
    id: 'n_head_simple_crown',
    name: 'シンプル王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/simple_crown.png' },
    thumbnail: { size: '200%', position: '50% -10%' },
    description: '飾りの少ない、素朴でかわいい王冠。',
  },
  {
    id: 'n_head_small_crown',
    name: '小さな王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/small_crown.png' },
    thumbnail: { size: '200%', position: '50% -10%' },
    description: 'ちょこんとのせられる小さな王冠。',
  },
  {
    id: 'n_head_beret',
    name: 'ベレー帽',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/beret.png' },
    thumbnail: { size: '200%', position: '50% -8%' },
    description: 'やわらかな雰囲気のベレー帽。',
  },
  {
    id: 'n_head_party_hat',
    name: 'パーティーハット',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/party_hat.png' },
    thumbnail: { size: '200%', position: '50% -12%' },
    description: 'お祝い気分になれる三角帽子。',
  },
  {
    id: 'n_head_ribbon_head',
    name: 'リボンヘッド',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/ribbon_head.png' },
    thumbnail: { size: '195%', position: '50% -6%' },
    description: '頭につけるだけで華やぐリボン。',
  },
  {
    id: 'n_head_simple_flower_wreath',
    name: 'シンプル花冠',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/simple_flower_wreath.png' },
    thumbnail: { size: '205%', position: '50% -8%' },
    description: 'やさしい花で編まれた花冠。',
  },
  {
    id: 'n_head_fluffy_hat',
    name: 'ふわふわ帽子',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/fluffy_hat.png' },
    thumbnail: { size: '205%', position: '50% -8%' },
    description: 'ふわっとした質感がかわいい帽子。',
  },
  {
    id: 'n_head_bunny_hat',
    name: 'うさみみ帽子',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/bunny_hat.png' },
    thumbnail: { size: '210%', position: '50% -18%' },
    description: '長いうさみみがぴょこんと伸びた帽子。',
  },
  {
    id: 'n_head_cat_hat',
    name: 'ねこみみ帽子',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/cat_hat.png' },
    thumbnail: { size: '205%', position: '50% -14%' },
    description: 'ねこみみ付きのかわいい帽子。',
  },
  {
    id: 'n_head_star_headband',
    name: '星ヘッドバンド',
    type: 'equipment',
    category: 'head',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/head/star_headband.png' },
    thumbnail: { size: '195%', position: '50% -5%' },
    description: '星飾りのついたヘッドバンド。',
  },

  {
    id: 'r_head_jewel_crown',
    name: '宝石王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/jewel_crown.png' },
    thumbnail: { size: '200%', position: '50% -10%' },
    description: '宝石がきらりと光る上品な王冠。',
  },
  {
    id: 'r_head_flower_crown',
    name: '花の王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/flower_crown.png' },
    thumbnail: { size: '205%', position: '50% -8%' },
    description: '色とりどりの花で彩られた王冠。',
  },
  {
    id: 'r_head_wizard_hat',
    name: '魔法帽子',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/wizard_hat.png' },
    thumbnail: { size: '215%', position: '50% -18%' },
    description: '見習い魔法使いのとんがり帽子。',
  },
  {
    id: 'r_head_prince_hat',
    name: '王子帽',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/prince_hat.png' },
    thumbnail: { size: '205%', position: '50% -12%' },
    description: '気品のある王子さま風の帽子。',
  },
  {
    id: 'r_head_headphones',
    name: 'ヘッドホン',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/headphones.png' },
    thumbnail: { size: '190%', position: '50% 0%' },
    description: '音楽好きにぴったりのヘッドホン。',
  },
  {
    id: 'r_head_flower_ribbon',
    name: '花リボン',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/flower_ribbon.png' },
    thumbnail: { size: '195%', position: '50% -6%' },
    description: '花飾りのついた華やかなリボン。',
  },
  {
    id: 'r_head_mushroom_hat',
    name: 'キノコ帽子',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/mushroom_hat.png' },
    thumbnail: { size: '205%', position: '50% -8%' },
    description: '森の住人みたいなキノコ帽子。',
  },
  {
    id: 'r_head_moon_crown',
    name: '月の冠',
    type: 'equipment',
    category: 'head',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/head/moon_crown.png' },
    thumbnail: { size: '200%', position: '50% -10%' },
    description: '三日月をかたどった幻想的な冠。',
  },

  {
    id: 'sr_head_glitter_crown',
    name: 'きらめき王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/head/glitter_crown.png' },
    thumbnail: { size: '205%', position: '50% -12%' },
    description: 'きらきらと輝く特別な王冠。',
  },
  {
    id: 'sr_head_star_crown',
    name: '星の王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/head/star_crown.png' },
    thumbnail: { size: '205%', position: '50% -12%' },
    description: '星の力を宿した神秘的な王冠。',
  },
  {
    id: 'sr_head_angel_halo',
    name: '天使の輪',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/head/angel_halo.png' },
    thumbnail: { size: '210%', position: '50% -24%' },
    description: 'ふんわり光る天使の輪。',
  },
  {
    id: 'sr_head_star_headdress',
    name: '星ヘッドドレス',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/head/star_headdress.png' },
    thumbnail: { size: '205%', position: '50% -10%' },
    description: '星飾りが並ぶヘッドドレス。',
  },
  {
    id: 'sr_head_magic_crystal_hat',
    name: '魔法結晶帽',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/head/magic_crystal_hat.png' },
    thumbnail: { size: '215%', position: '50% -18%' },
    description: '結晶の力がこもった魔法帽子。',
  },
  {
    id: 'sr_crown_oukan',
    name: 'ハートの王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SR',
    dropWeight: 5,
    visual: { type: 'image', value: '/items/head/oukan.png' },
  thumbnail: {
    size    : '200%',     // ズーム倍率
    position: '50% -10%',  // 中心位置
  },
    description: 'かわいい王冠。',
    
  },
  {
    id: 'ssr_head_rainbow_crown',
    name: '虹の王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SSR',
    dropWeight: 10,
    visual: { type: 'image', value: '/items/head/rainbow_crown.png' },
    thumbnail: { size: '210%', position: '50% -14%' },
    description: '七色の光をまとった伝説の王冠。',
  },
  {
    id: 'ssr_head_light_crown',
    name: '光の王冠',
    type: 'equipment',
    category: 'head',
    rarity: 'SSR',
    dropWeight: 10,
    visual: { type: 'image', value: '/items/head/light_crown.png' },
    thumbnail: { size: '210%', position: '50% -14%' },
    description: 'まばゆい光を放つ高貴な王冠。',
  },
   // 装備品(face)
   {
    id: 'n_face_round_glasses',
    name: '丸メガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/round_glasses.png' },
    thumbnail: { size: '170%', position: '50% 18%' },
    description: '知的に見えるシンプルな丸メガネ。',
  },
  {
    id: 'n_face_small_round_glasses',
    name: '小さな丸メガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/small_round_glasses.png' },
    thumbnail: { size: '165%', position: '50% 18%' },
    description: 'ちいさめサイズのかわいい丸メガネ。',
  },
  {
    id: 'n_face_simple_sunglasses',
    name: 'シンプルサングラス',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/simple_sunglasses.png' },
    thumbnail: { size: '170%', position: '50% 18%' },
    description: '気軽にかけられるサングラス。',
  },
  {
    id: 'n_face_heart_cheek',
    name: 'ハートほっぺ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/heart_cheek.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: 'ほっぺにちょこんとハート模様。',
  },
  {
    id: 'n_face_bandage',
    name: '絆創膏',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/bandage.png' },
    thumbnail: { size: '150%', position: '50% 20%' },
    description: 'やんちゃ感が出る小さな絆創膏。',
  },
  {
    id: 'n_face_star_cheek',
    name: '星ほっぺ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/star_cheek.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: '星マークのほっぺ飾り。',
  },
  {
    id: 'n_face_triangle_cheek',
    name: '三角ほっぺ',
    type: 'equipment',
    category: 'face',
    rarity: 'N',
    dropWeight: 40,
    visual: { type: 'image', value: '/items/face/triangle_cheek.png' },
    thumbnail: { size: '155%', position: '50% 20%' },
    description: '三角モチーフのユニークなほっぺ飾り。',
  },

  {
    id: 'r_face_heart_glasses',
    name: 'ハートメガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/heart_glasses.png' },
    thumbnail: { size: '170%', position: '50% 18%' },
    description: 'ハート型フレームのラブリーなメガネ。',
  },
  {
    id: 'r_face_monocle',
    name: 'モノクル',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/monocle.png' },
    thumbnail: { size: '160%', position: '50% 18%' },
    description: '気品が増す片眼鏡。',
  },
  {
    id: 'r_face_glitter_cheek',
    name: 'キラキラほっぺ',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/glitter_cheek.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: 'きらめき粒子が舞うほっぺ飾り。',
  },
  {
    id: 'r_face_mask',
    name: '仮面',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/mask.png' },
    thumbnail: { size: '175%', position: '50% 18%' },
    description: 'ミステリアスな雰囲気を出す仮面。',
  },
  {
    id: 'r_face_cat_whiskers',
    name: '猫ひげ',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/cat_whiskers.png' },
    thumbnail: { size: '165%', position: '50% 20%' },
    description: 'にゃんとかわいい猫ひげ。',
  },
  {
    id: 'r_face_cheek_star',
    name: 'ほっぺ星',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/cheek_star.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: 'ほっぺに星がきらりと光る。',
  },
  {
    id: 'r_face_glitter_glasses',
    name: 'きらめきメガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/glitter_glasses.png' },
    thumbnail: { size: '172%', position: '50% 18%' },
    description: '小さな輝きを散りばめたメガネ。',
  },
  {
    id: 'r_face_moon_tear',
    name: '月の涙',
    type: 'equipment',
    category: 'face',
    rarity: 'R',
    dropWeight: 30,
    visual: { type: 'image', value: '/items/face/moon_tear.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: '月のしずくのような涙飾り。',
  },

  {
    id: 'sr_face_star_glasses',
    name: '星メガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/face/star_glasses.png' },
    thumbnail: { size: '175%', position: '50% 18%' },
    description: '星型フレームが目を引くメガネ。',
  },
  {
    id: 'sr_face_angel_cheek',
    name: '天使のチーク',
    type: 'equipment',
    category: 'face',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/face/angel_cheek.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: 'やさしく光る天使のチーク。',
  },
  {
    id: 'sr_face_light_tear',
    name: '光の涙',
    type: 'equipment',
    category: 'face',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/face/light_tear.png' },
    thumbnail: { size: '160%', position: '50% 20%' },
    description: '光のしずくが頬を伝う顔飾り。',
  },
  {
    id: 'sr_face_rainbow_glasses',
    name: '虹メガネ',
    type: 'equipment',
    category: 'face',
    rarity: 'SR',
    dropWeight: 20,
    visual: { type: 'image', value: '/items/face/rainbow_glasses.png' },
    thumbnail: { size: '175%', position: '50% 18%' },
    description: '虹色にきらめく幻想的なメガネ。',
  },

  {
    id: 'ssr_face_star_eyes',
    name: '星の眼鏡',
    type: 'equipment',
    category: 'face',
    rarity: 'SSR',
    dropWeight: 10,
    visual: { type: 'image', value: '/items/face/star_eyes.png' },
    thumbnail: { size: '170%', position: '50% 18%' },
    description: '瞳に星が宿る特別な装い。',
  },
  {
    id: 'ssr_face_cosmic_eyes',
    name: '宇宙の眼鏡',
    type: 'equipment',
    category: 'face',
    rarity: 'SSR',
    dropWeight: 10,
    visual: { type: 'image', value: '/items/face/cosmic_eyes.png' },
    thumbnail: { size: '170%', position: '50% 18%' },
    description: '宇宙の奥行きを感じる神秘の瞳。',
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

