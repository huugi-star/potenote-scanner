import { create } from 'zustand';

export type Furniture = {
  id: string;
  name: string;
  emoji: string; // ※将来的に imageUrl: string などに変更してSVG/PNGを読み込みます
  x?: number;
  y?: number;
};

interface RoomState {
  placedItems: Furniture[];
  inventory: Furniture[];
}

interface RoomActions {
  addFurnitureToRoom: (item: Furniture, x: number, y?: number) => void;
  removeFurnitureFromRoom: (item: Furniture) => void;
  moveFurnitureByOffset: (id: string, offsetX: number, offsetY: number) => void;
}

type RoomStore = RoomState & RoomActions;

const initialPlacedItems: Furniture[] = [
  { id: 'f1', name: 'ちゃぶ台', emoji: '🍵', x: 380, y: 350 },
  { id: 'f2', name: '座布団', emoji: '🪑', x: 450, y: 380 },
];

const initialInventory: Furniture[] = [
  { id: 'f3', name: '観葉植物', emoji: '🪴' },
  { id: 'f4', name: '掛け軸', emoji: '📜' },
  { id: 'f5', name: 'だるま', emoji: '🎎' },
  { id: 'f6', name: '壺', emoji: '🏺' },
];

export const useRoomStore = create<RoomStore>()((set) => ({
  placedItems: initialPlacedItems,
  inventory: initialInventory,

  addFurnitureToRoom: (item, x, y = 280) => {
    set((state) => ({
      inventory: state.inventory.filter((i) => i.id !== item.id),
      placedItems: [...state.placedItems, { ...item, x, y }],
    }));
  },

  removeFurnitureFromRoom: (item) => {
    set((state) => ({
      placedItems: state.placedItems.filter((i) => i.id !== item.id),
      inventory: [...state.inventory, { id: item.id, name: item.name, emoji: item.emoji }],
    }));
  },

  moveFurnitureByOffset: (id, offsetX, offsetY) => {
    set((state) => ({
      placedItems: state.placedItems.map((f) =>
        f.id === id
          ? { ...f, x: (f.x || 0) + offsetX, y: (f.y || 0) + offsetY }
          : f
      ),
    }));
  },
}));

