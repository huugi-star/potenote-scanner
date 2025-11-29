/**
 * AffiliateSection.tsx
 * 
 * アフィリエイト商品表示コンポーネント
 * 楽天APIを使用してターゲット層に合わせた商品を提案
 * 3回クリアごとのマイルストーンとして表示
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ShoppingBag, Heart, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

// ===== Types =====

interface RakutenItem {
  itemName: string;
  itemPrice: string;
  itemUrl: string;
  mediumImageUrls: string[];
  shopName: string;
  affiliateUrl: string;
}

interface AffiliateSectionProps {
  milestoneCount: number; // 累計クリア回数（例：3, 6, 9...）
}

// ===== Constants =====

// カテゴリ設定（確率配分）
const CATEGORIES = {
  books: {
    name: '書籍',
    genreId: '001001', // 楽天ブックス
    weight: 0.5, // 50%
    icon: BookOpen,
    color: 'from-blue-500 to-blue-600',
  },
  gadgets: {
    name: 'ガジェット・文具',
    genreId: '100227', // 文房具・事務用品
    weight: 0.3, // 30%
    icon: ShoppingBag,
    color: 'from-purple-500 to-purple-600',
  },
  health: {
    name: '家具・健康',
    genreId: '100804', // 健康・美容
    weight: 0.2, // 20%
    icon: Heart,
    color: 'from-pink-500 to-pink-600',
  },
} as const;

// ===== Helper Functions =====

/**
 * 確率配分に基づいてカテゴリを選択
 */
const selectCategory = () => {
  const random = Math.random();
  let cumulative = 0;
  
  for (const [key, category] of Object.entries(CATEGORIES)) {
    cumulative += category.weight;
    if (random <= cumulative) {
      return { key, ...category };
    }
  }
  
  // フォールバック（通常は到達しない）
  return { key: 'books', ...CATEGORIES.books };
};

/**
 * 楽天APIから商品を取得（Next.js API Route経由）
 */
const fetchRakutenItems = async (categoryKey: string): Promise<RakutenItem[]> => {
  try {
    // Next.js API Route経由で呼び出し（CORS問題を回避）
    const response = await fetch(
      `/api/rakuten-items?category=${categoryKey}`
    );
    
    if (!response.ok) {
      throw new Error('楽天APIの呼び出しに失敗しました');
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('楽天APIエラー:', error);
    // エラー時はモックデータを返す
    return generateMockItems();
  }
};

/**
 * モックデータ生成（開発用）
 */
const generateMockItems = (): RakutenItem[] => {
  return Array.from({ length: 10 }, (_, i) => ({
    itemName: `学習に役立つ商品 ${i + 1}`,
    itemPrice: `${Math.floor(Math.random() * 5000 + 1000)}`,
    itemUrl: `https://example.com/item${i + 1}`,
    mediumImageUrls: [`https://via.placeholder.com/300x300?text=Item${i + 1}`],
    shopName: 'サンプルショップ',
    affiliateUrl: `https://example.com/affiliate${i + 1}`,
  }));
};

// ===== Main Component =====

export const AffiliateSection = ({ milestoneCount }: AffiliateSectionProps) => {
  const [items, setItems] = useState<RakutenItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ReturnType<typeof selectCategory> | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      const category = selectCategory();
      setSelectedCategory(category);
      
      const fetchedItems = await fetchRakutenItems(category.key);
      setItems(fetchedItems);
      setLoading(false);
    };

    loadItems();
  }, [milestoneCount]); // マイルストーンが変わるたびに再読み込み

  const scrollLeft = () => {
    const container = document.getElementById('affiliate-scroll');
    if (container) {
      const newPosition = Math.max(0, scrollPosition - 300);
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const scrollRight = () => {
    const container = document.getElementById('affiliate-scroll');
    if (container) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + 300);
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  if (loading) {
    return (
      <motion.div
        className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
        </div>
      </motion.div>
    );
  }

  const CategoryIcon = selectedCategory?.icon || BookOpen;

  return (
    <motion.div
      className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-6 border border-yellow-500/30 mb-6 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-gradient-to-r ${selectedCategory?.color || 'from-blue-500 to-blue-600'}`}>
            <CategoryIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {milestoneCount}クエスト達成！
            </h3>
            <p className="text-sm text-gray-400">
              {selectedCategory?.name}で学習を加速
            </p>
          </div>
        </div>
      </div>

      {/* 横スクロール商品リスト */}
      <div className="relative">
        {/* 左スクロールボタン */}
        {scrollPosition > 0 && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-900/80 rounded-full hover:bg-gray-800 transition-colors"
            aria-label="左にスクロール"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}

        {/* 商品スクロールエリア */}
        <div
          id="affiliate-scroll"
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {items.map((item, index) => (
            <motion.a
              key={index}
              href={item.affiliateUrl || item.itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-48 bg-gray-900/50 rounded-xl overflow-hidden border border-gray-700 hover:border-yellow-500/50 transition-all hover:scale-105"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              {/* 商品画像 */}
              <div className="relative w-full h-32 bg-gray-800">
                {item.mediumImageUrls?.[0] ? (
                  <img
                    src={item.mediumImageUrls[0]}
                    alt={item.itemName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 画像読み込みエラー時のフォールバック
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute top-2 right-2 p-1 bg-yellow-500/90 rounded-full">
                  <ExternalLink className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* 商品情報 */}
              <div className="p-3">
                <h4 className="text-sm font-medium text-white line-clamp-2 mb-2 min-h-[2.5rem]">
                  {item.itemName}
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-yellow-400">
                    ¥{parseInt(item.itemPrice).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.shopName}
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* 右スクロールボタン */}
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-900/80 rounded-full hover:bg-gray-800 transition-colors"
          aria-label="右にスクロール"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* フッター */}
      <p className="text-xs text-gray-500 text-center mt-4">
        ※ 商品リンクは楽天アフィリエイトを使用しています
      </p>
    </motion.div>
  );
};

export default AffiliateSection;

