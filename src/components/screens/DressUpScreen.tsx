/**
 * DressUpScreen.tsx
 * 
 * 着せ替え画面
 * ガチャで手に入れたアイテムを装備する
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  Shirt, 
  Crown, 
  Glasses, 
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { getItemById, getRarityColor, getRarityGradient, type Item } from '@/data/items';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import type { EquipmentCategory } from '@/types';

// ===== Types =====

interface DressUpScreenProps {
  onBack: () => void;
}

const CATEGORIES: { key: EquipmentCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'head', label: '頭', icon: <Crown className="w-5 h-5" /> },
  { key: 'face', label: '顔', icon: <Glasses className="w-5 h-5" /> },
  { key: 'body', label: '体', icon: <Shirt className="w-5 h-5" /> },
  { key: 'accessory', label: 'アクセ', icon: <Sparkles className="w-5 h-5" /> },
];

// ===== Main Component =====

export const DressUpScreen = ({ onBack }: DressUpScreenProps) => {
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory>('head');
  
  // Store
  const inventory = useGameStore(state => state.inventory);
  const equipment = useGameStore(state => state.equipment);
  const equipItem = useGameStore(state => state.equipItem);
  const unequipItem = useGameStore(state => state.unequipItem);

  // 装備アイテムの詳細を取得（useMemoで安定化）
  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  // カテゴリ別のアイテムを取得
  const categoryItems = useMemo(() => {
    return inventory
      .map(inv => {
        const item = getItemById(inv.itemId);
        return item && item.type === 'equipment' && item.category === selectedCategory
          ? { ...item, quantity: inv.quantity }
          : null;
      })
      .filter((item): item is Item & { quantity: number } => item !== null);
  }, [inventory, selectedCategory]);

  const handleEquip = (itemId: string) => {
    vibrateLight();
    const currentEquipped = equipment[selectedCategory];
    
    if (currentEquipped === itemId) {
      // 既に装備中なら外す
      unequipItem(selectedCategory);
    } else {
      // 装備する
      equipItem(itemId);
      vibrateSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 p-4">
      {/* ヘッダー */}
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between py-4 mb-4">
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>

          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shirt className="w-6 h-6 text-pink-400" />
            着せ替え
          </h1>

          <div className="w-16" />
        </div>

        {/* プレビュー */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="relative"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <PotatoAvatar
              equipped={equippedDetails}
              emotion="happy"
              size={180}
              ssrEffect={Object.values(equippedDetails).some(i => i?.rarity === 'SSR')}
            />
          </motion.div>
        </div>

        {/* 現在の装備 */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700">
          <p className="text-sm text-gray-400 mb-3">装備中</p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map(cat => {
              const equipped = equippedDetails[cat.key];
              return (
                <div
                  key={cat.key}
                  className={`p-3 rounded-lg text-center ${
                    equipped 
                      ? 'bg-gray-700' 
                      : 'bg-gray-800/50 border border-dashed border-gray-600'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">{cat.label}</div>
                  {equipped ? (
                    <div 
                      className="w-8 h-8 mx-auto rounded-lg"
                      style={{ 
                        background: getRarityGradient(equipped.rarity) 
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 mx-auto rounded-lg bg-gray-700 flex items-center justify-center">
                      <X className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* カテゴリタブ */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => {
                vibrateLight();
                setSelectedCategory(cat.key);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.key
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* アイテムリスト */}
        <div className="grid grid-cols-3 gap-3">
          {categoryItems.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">
                この部位のアイテムがありません
              </p>
              <p className="text-gray-600 text-sm mt-1">
                ガチャで手に入れよう！
              </p>
            </div>
          ) : (
            categoryItems.map(item => {
              const isEquipped = equipment[selectedCategory] === item.id;
              
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleEquip(item.id)}
                  className={`relative p-3 rounded-xl border-2 transition-colors ${
                    isEquipped
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* レアリティバッジ */}
                  <div 
                    className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ 
                      backgroundColor: `${getRarityColor(item.rarity)}30`,
                      color: getRarityColor(item.rarity)
                    }}
                  >
                    {item.rarity}
                  </div>

                  {/* 装備中マーク */}
                  {isEquipped && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* アイテムビジュアル */}
                  <div 
                    className="w-12 h-12 mx-auto mb-2 rounded-lg flex items-center justify-center"
                    style={{ background: getRarityGradient(item.rarity) }}
                  >
                    {item.visual.type === 'svg_path' ? (
                      <svg viewBox="0 0 24 24" className="w-8 h-8">
                        <path d={item.visual.value} fill="white" />
                      </svg>
                    ) : (
                      <div 
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: item.visual.value }}
                      />
                    )}
                  </div>

                  {/* アイテム名 */}
                  <p className="text-white text-xs text-center truncate">
                    {item.name}
                  </p>
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DressUpScreen;

