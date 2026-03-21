import { useMemo, useRef, useEffect, useState } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MessageCircle, BookMarked, PencilLine, ScrollText, Paintbrush, Check, X, Box } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useRoomStore } from '@/store/useRoomStore';
import { generateSuhimochiReply } from '@/lib/suhimochiConversationEngine';
import type { ConversationChatMessage, SuhimochiIntent, SuhimochiTopic } from '@/lib/suhimochiConversationTypes';
import { getItemById } from '@/data/items';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { useToast } from '@/components/ui/Toast';
import { vibrateLight } from '@/lib/haptics';

interface SuhimochiRoomScreenProps {
  onBack: () => void;
}

const RECENT_WORDS = ['友情', 'gravity', '約束'];

export const SuhimochiRoomScreen = ({ onBack }: SuhimochiRoomScreenProps) => {
  const { addToast } = useToast();
  const equipment = useGameStore((state) => state.equipment);
  const placedItems = useRoomStore((state) => state.placedItems);
  const inventory = useRoomStore((state) => state.inventory);
  const addFurnitureToRoom = useRoomStore((state) => state.addFurnitureToRoom);
  const removeFurnitureFromRoom = useRoomStore((state) => state.removeFurnitureFromRoom);
  const moveFurnitureByOffset = useRoomStore((state) => state.moveFurnitureByOffset);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [charPosition, setCharPosition] = useState(400);
  const hopControls = useAnimation();

  // --- 家具のステート管理 ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTalkOpen, setIsTalkOpen] = useState(false);
  const [talkInput, setTalkInput] = useState('');
  const [lastIntent, setLastIntent] = useState<SuhimochiIntent | undefined>(undefined);
  const [lastTopic, setLastTopic] = useState<SuhimochiTopic | undefined>(undefined);
  const [lastReply, setLastReply] = useState<string | undefined>(undefined);
  const [talkMessages, setTalkMessages] = useState<ConversationChatMessage[]>([
    {
      id: 'init-suhimochi',
      role: 'suhimochi',
      text: 'おかえり。今日はどんな言葉を見つけたの？',
    },
  ]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const equippedDetails = useMemo(
    () => ({
      head: equipment.head ? getItemById(equipment.head) : undefined,
      body: equipment.body ? getItemById(equipment.body) : undefined,
      face: equipment.face ? getItemById(equipment.face) : undefined,
      accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
    }),
    [equipment.head, equipment.body, equipment.face, equipment.accessory]
  );

  const handleDummyAction = (label: string) => {
    vibrateLight();
    addToast('info', `「${label}」は準備中です`);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      container.scrollLeft = (scrollWidth - clientWidth) / 2;
    }
  }, []);

  const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    vibrateLight();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const safeX = Math.max(120, Math.min(clickX, 800 - 120));
    setCharPosition(safeX);
  };

  useEffect(() => {
    hopControls.start({
      y: [0, -17, 0, -20, 0], 
      rotate: [0, -3, 3, -3, 0],
      transition: { duration: 1.2, ease: "easeInOut" }
    });
  }, [charPosition, hopControls]);

  // --- 家具の追加・削除ロジック ---
  const handleAddFurniture = (item: { id: string; name: string; emoji: string }) => {
    vibrateLight();

    // 現在のスクロール位置の中央あたりに出現させる
    const currentScroll = scrollRef.current?.scrollLeft || 0;
    const appearX = currentScroll + 150; 

    // 部屋に追加 + 収納から削除
    addFurnitureToRoom(item, appearX, 280);
  };

  const handleRemoveFurniture = (item: { id: string; name: string; emoji: string }) => {
    vibrateLight();
    // 部屋から削除 + 収納に戻す
    removeFurnitureFromRoom(item);
  };

  const handleOpenTalk = () => {
    vibrateLight();
    setIsTalkOpen((prev) => !prev);
  };

  const handleSendTalk = () => {
    const userText = talkInput.trim();
    if (!userText) return;
    vibrateLight();

    const result = generateSuhimochiReply(userText, { lastIntent, lastTopic, lastReply });
    const timestamp = Date.now();
    setTalkMessages((prev) => [
      ...prev,
      { id: `user-${timestamp}`, role: 'user', text: userText },
      {
        id: `suhimochi-${timestamp + 1}`,
        role: 'suhimochi',
        text: result.reply,
        analysis: {
          emotion: result.emotion,
          topic: result.topic,
          intent: result.intent,
          reason: result.reason,
        },
      },
    ]);
    setLastIntent(result.intent);
    setLastTopic(result.topic);
    setLastReply(result.reply);
    setTalkInput('');
  };

  const latestSuhimochiMessage = useMemo(() => {
    const latest = [...talkMessages].reverse().find((msg) => msg.role === 'suhimochi');
    return latest?.text ?? 'おかえり。今日はどんな言葉を見つけたの？';
  }, [talkMessages]);

  const recentTalkLogs = useMemo(() => {
    return talkMessages.slice(-6);
  }, [talkMessages]);

  const bubbleLeft = Math.max(16, Math.min(charPosition - 170, 800 - 340));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-emerald-50 p-4 pb-24">
      <div className="max-w-md mx-auto pt-4 flex flex-col h-full">
        {/* ヘッダー */}
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => { vibrateLight(); onBack(); }} className="flex items-center gap-1 text-amber-800/80 transition-colors hover:text-amber-900">
            <ChevronLeft className="h-5 w-5" />戻る
          </button>
          <h1 className="text-xl font-bold text-amber-900">すうひもちの部屋</h1>
          <div className="w-16" />
        </div>

        {/* --- 部屋セクション --- */}
        <section className={`relative h-[520px] shrink-0 overflow-hidden rounded-3xl border-2 shadow-lg transition-colors ${isEditMode ? 'border-amber-400 bg-[#f0ebd9] shadow-amber-300/50' : 'border-amber-900/10 bg-[#e8e4d9] shadow-amber-200/50'}`}>
          
          <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="relative h-full w-[800px]">
              
              {/* 1. 背景・壁レイヤー (z-0) */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-8 left-1/2 -translate-x-1/2 flex h-36 w-36 flex-col justify-evenly overflow-hidden rounded-full border-4 border-[#7a5c43] bg-[#fdfbf7] shadow-inner opacity-90">
                  <div className="h-px w-full bg-[#e8ddc5]" /><div className="h-px w-full bg-[#e8ddc5]" />
                  <div className="absolute inset-y-0 left-1/3 w-px bg-[#e8ddc5]" /><div className="absolute inset-y-0 right-1/3 w-px bg-[#e8ddc5]" />
                </div>
                <div className="absolute top-52 left-0 right-0 h-3 bg-[#7a5c43] shadow-sm" />
                <div className="absolute bottom-0 top-0 left-4 w-3 bg-[#7a5c43] shadow-sm" />
                <div className="absolute bottom-0 top-0 left-[260px] w-2 bg-[#7a5c43] shadow-sm opacity-50" />
                <div className="absolute bottom-0 top-0 right-[260px] w-2 bg-[#7a5c43] shadow-sm opacity-50" />
                <div className="absolute bottom-0 top-0 right-4 w-3 bg-[#7a5c43] shadow-sm" />
              </div>

              {/* 2. 床レイヤー・畳 (z-10) */}
              <div className="absolute bottom-0 left-0 right-0 h-56 bg-[#cddb9b] border-t-4 border-[#7a5c43] z-10 pointer-events-none">
                <div className="absolute top-0 bottom-0 left-1/3 w-1 bg-[#5a6b31] opacity-30" />
                <div className="absolute top-0 bottom-0 right-1/3 w-1 bg-[#5a6b31] opacity-30" />
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#5a6b31] opacity-30" />
                {isEditMode && (
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4zIiBzdHJva2Utd2lkdGg9IjEiIC8+Cjwvc3ZnPg==')] opacity-50" />
                )}
              </div>

              {/* 3. キャラクター移動用タップ判定エリア (z-20) */}
              <div 
                className={`absolute bottom-0 left-0 right-0 h-56 z-20 ${isEditMode ? 'pointer-events-none' : 'cursor-pointer pointer-events-auto'}`}
                onClick={handleFloorClick}
              />

              {/* 4. 家具配置レイヤー (z-20) */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                <AnimatePresence>
                  {placedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      drag={isEditMode}
                      dragMomentum={false}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, x: item.x, y: item.y }}
                      exit={{ scale: 0, opacity: 0 }}
                      className={`absolute flex items-center justify-center ${isEditMode ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                      onDragEnd={(_, info) => {
                        moveFurnitureByOffset(item.id, info.offset.x, info.offset.y);
                      }}
                      style={{ zIndex: Math.floor(item.y || 0) }}
                    >
                      <div className="relative">
                        {/* 模様替えモード中のみ「片付ける（✖️）」ボタンを表示 */}
                        {isEditMode && (
                          <button
                            onPointerDown={(e) => {
                              // ドラッグイベントが発火しないようにブロック
                              e.stopPropagation();
                              handleRemoveFurniture(item);
                            }}
                            className="absolute -right-2 -top-2 z-50 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-90"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {/* 家具本体 */}
                        <div className={`flex h-16 w-16 items-center justify-center text-5xl transition-all ${isEditMode ? 'rounded-xl border-2 border-dashed border-amber-500 bg-white/40 shadow-lg scale-110' : 'drop-shadow-md'}`}>
                          {item.emoji}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* 5. キャラクターレイヤー (z-30) */}
              <motion.div className="absolute bottom-16 left-0 z-30 pointer-events-none" animate={{ x: charPosition - 120 }} transition={{ type: "tween", duration: 1.2, ease: "linear" }}>
                <motion.div animate={hopControls}>
                  <PotatoAvatar
                    equipped={equippedDetails}
                    emotion="happy"
                    size={240}
                    ssrEffect={false}
                    showShadow={false}
                  />
                </motion.div>
              </motion.div>

              {/* 6. すうひもち吹き出し（最新返答） */}
              <div
                className="absolute bottom-[280px] z-40 w-[320px] pointer-events-none"
                style={{ left: bubbleLeft }}
              >
                <div className="rounded-2xl border-2 border-amber-800/10 bg-white/95 px-4 py-3 text-amber-900 shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium leading-relaxed">{latestSuhimochiMessage}</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* --- UI切り替えエリア（通常時 ⇔ 模様替え時） --- */}
        <div className="mt-4 flex-1">
          {isEditMode ? (
            // 【模様替えモード中】収納ボックス（インベントリ）を表示
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              className="flex h-full flex-col rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-inner"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900">
                  <Box className="h-5 w-5" />
                  <h3 className="font-bold">収納ボックス</h3>
                </div>
                <motion.button 
                  onClick={() => { vibrateLight(); setIsEditMode(false); }} 
                  className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-amber-500/30"
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                >
                  <Check className="h-4 w-4" /> 完了
                </motion.button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {inventory.length === 0 ? (
                  <p className="flex h-16 w-full items-center justify-center text-sm text-amber-900/50">収納に家具がありません</p>
                ) : (
                  inventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddFurniture(item)}
                      className="group flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-200 bg-white text-3xl shadow-sm transition-all hover:border-amber-400 hover:bg-amber-100 active:scale-95"
                    >
                      {item.emoji}
                      <span className="absolute -bottom-6 text-xs font-medium text-amber-800 opacity-0 transition-opacity group-hover:opacity-100">{item.name}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            // 【通常モード中】アクションボタンを表示
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
              <section className="grid grid-cols-2 gap-3">
                <motion.button onClick={handleOpenTalk} className="flex items-center justify-center gap-2 rounded-xl bg-orange-300/80 px-4 py-3 font-semibold text-amber-950 shadow-md shadow-orange-200" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}><MessageCircle className="h-5 w-5" />話す</motion.button>
                <motion.button onClick={() => handleDummyAction('言葉を教える')} className="flex items-center justify-center gap-2 rounded-xl bg-lime-200/90 px-4 py-3 font-semibold text-lime-900 shadow-md shadow-lime-100" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}><BookMarked className="h-5 w-5" />言葉を教える</motion.button>
                <motion.button onClick={() => handleDummyAction('図鑑を見る')} className="flex items-center justify-center gap-2 rounded-xl bg-sky-200/90 px-4 py-3 font-semibold text-sky-900 shadow-md shadow-sky-100" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}><ScrollText className="h-5 w-5" />図鑑を見る</motion.button>
                
                {/* 模様替え開始ボタン */}
                <motion.button onClick={() => { vibrateLight(); setIsEditMode(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-amber-200/80 px-4 py-3 font-semibold text-amber-900 shadow-md shadow-amber-100" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}><Paintbrush className="h-5 w-5" />模様替え</motion.button>
                
                <motion.button onClick={() => handleDummyAction('言葉を修正する')} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-rose-200/90 px-4 py-3 font-semibold text-rose-900 shadow-md shadow-rose-100" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}><PencilLine className="h-5 w-5" />言葉を修正する</motion.button>
              </section>

              {isTalkOpen && (
                <section className="rounded-2xl border border-amber-200 bg-white/70 p-3">
                  <button
                    onClick={() => {
                      vibrateLight();
                      setIsHistoryOpen((prev) => !prev);
                    }}
                    className="w-full text-left text-xs font-bold text-amber-900/80"
                  >
                    会話ログ {isHistoryOpen ? 'を閉じる' : 'を開く'}
                  </button>
                  {isHistoryOpen && (
                    <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                      {recentTalkLogs.map((msg) => (
                        <div key={msg.id}>
                          <p className="text-xs text-amber-900/80">
                            <span className="font-semibold">{msg.role === 'user' ? 'あなた' : 'すうひもち'}: </span>
                            {msg.text}
                          </p>
                          {process.env.NODE_ENV === 'development' && msg.analysis?.reason && (
                            <div className="mt-1 text-xs text-gray-400">
                              {msg.analysis.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-amber-200 bg-white/80 p-4">
                <h2 className="mb-3 text-sm font-bold text-amber-900">最近の言葉</h2>
                <div className="flex flex-wrap gap-2">
                  {RECENT_WORDS.map((word) => (
                    <span key={word} className="rounded-full border border-amber-200 bg-amber-100/70 px-3 py-1 text-sm text-amber-900">{word}</span>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </div>
      </div>

      {isTalkOpen && !isEditMode && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <div className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50/95 p-2 shadow-xl shadow-amber-200/60 backdrop-blur-sm">
            <input
              value={talkInput}
              onChange={(e) => setTalkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendTalk();
              }}
              placeholder="すうひもちに話しかける"
              className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 outline-none focus:border-amber-400"
            />
            <motion.button
              onClick={handleSendTalk}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-amber-500/30"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              送信
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
};