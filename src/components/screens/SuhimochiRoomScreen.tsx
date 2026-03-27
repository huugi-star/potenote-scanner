import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ScrollText,
  Paintbrush, Check, X, Box, Heart, MoreHorizontal,
  ChevronDown, ChevronUp, MessageCircle, Sparkles,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useRoomStore } from '@/store/useRoomStore';
import {
  generateSuhimochiReply,
  generateSuhimochiOpeningMessage,
  generateAutoPost,
  extractKeywords,
  extractKeywordsForAnataZukan,
} from '@/lib/suhimochiConversationEngine';
import type { SuhimochiOpeningOptions } from '@/lib/suhimochiConversationEngine';
import type {
  AnataCategory,
  AnataZukanEntry,
  ConversationChatMessage,
  SuhimochiCollectedWord,
  SuhimochiInterest,
} from '@/lib/suhimochiConversationTypes';
import { getItemById } from '@/data/items';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { useToast } from '@/components/ui/Toast';
import { vibrateLight } from '@/lib/haptics';

// ============================================================
// 型・定数
// ============================================================

interface SuhimochiRoomScreenProps {
  onBack: () => void;
  newlyLearnedWord?: SuhimochiCollectedWord;
}

type IntimacyLevel = 1 | 2 | 3 | 4 | 5;

const INTIMACY_LEVEL_LABELS: Record<IntimacyLevel, string> = {
  1: 'はじめまして',
  2: 'なかよし',
  3: 'ともだち',
  4: 'しんゆう',
  5: 'ずっといっしょ',
};

const INTIMACY_LEVEL_COLORS: Record<IntimacyLevel, string> = {
  1: 'from-rose-200 to-pink-300',
  2: 'from-pink-300 to-rose-400',
  3: 'from-rose-400 to-red-400',
  4: 'from-red-400 to-orange-400',
  5: 'from-orange-400 to-yellow-400',
};

const INTEREST_OPTIONS: Array<{ value: SuhimochiInterest; icon: string }> = [
  { value: 'アニメ',   icon: '🎌' },
  { value: 'YouTuber', icon: '📱' },
  { value: '映画',     icon: '🎬' },
  { value: '音楽',     icon: '🎵' },
  { value: 'ゲーム',   icon: '🎮' },
  { value: '仕事',     icon: '💼' },
  { value: 'SNS',      icon: '💬' },
];

const INTIMACY_POINTS = {
  message: 3,
  usedLearnedWord: 8,
  longMessage: 2,
  positiveEmotion: 3,
} as const;

// 無効語フィルタ
const INVALID_WORDS = new Set([
  'none', 'null', 'undefined', 'true', 'false', 'nan',
  'n/a', 'na', 'no', 'yes', 'ok', 'ng',
]);

const isValidWord = (word: string): boolean => {
  if (!word || word.length < 2) return false;
  if (INVALID_WORDS.has(word.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  return true;
};

// ============================================================
// ユーティリティ
// ============================================================

const formatTimelineTimestamp = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'たった今';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
  return `${Math.floor(diff / 86_400_000)}日前`;
};

const calcIntimacyGain = (
  userText: string,
  collectedWords: SuhimochiCollectedWord[],
  emotion: string,
): number => {
  let gain = INTIMACY_POINTS.message;
  const usedWord = collectedWords.some((w) =>
    userText.toLowerCase().includes(w.word.toLowerCase()),
  );
  if (usedWord) gain += INTIMACY_POINTS.usedLearnedWord;
  if (userText.length > 20) gain += INTIMACY_POINTS.longMessage;
  if (emotion === 'happy' || emotion === 'excited') gain += INTIMACY_POINTS.positiveEmotion;
  return gain;
};

// ============================================================
// コンポーネント
// ============================================================

export const SuhimochiRoomScreen = ({ onBack, newlyLearnedWord }: SuhimochiRoomScreenProps) => {
  const { addToast } = useToast();

  const equipment           = useGameStore((s) => s.equipment);
  const wordCollectionScans = useGameStore((s) => s.wordCollectionScans);
  const wordDexWords        = useGameStore((s) => s.wordDexWords);
  const placedItems         = useRoomStore((s) => s.placedItems);
  const inventory           = useRoomStore((s) => s.inventory);
  const addFurnitureToRoom      = useRoomStore((s) => s.addFurnitureToRoom);
  const removeFurnitureFromRoom = useRoomStore((s) => s.removeFurnitureFromRoom);
  const moveFurnitureByOffset   = useRoomStore((s) => s.moveFurnitureByOffset);

  const suhimochiIntimacy      = useGameStore((s) => s.suhimochiIntimacy);
  const suhimochiGeminiHistory = useGameStore((s) => s.suhimochiGeminiHistory);
  const suhimochiLastMessage   = useGameStore((s) => s.suhimochiLastMessage);
  const suhimochiLastVisitedAt = useGameStore((s) => s.suhimochiLastVisitedAt);
  const updateSuhimochiIntimacy      = useGameStore((s) => s.updateSuhimochiIntimacy);
  const appendSuhimochiGeminiHistory = useGameStore((s) => s.appendSuhimochiGeminiHistory);
  const updateSuhimochiLastVisit     = useGameStore((s) => s.updateSuhimochiLastVisit);

  const suhimochiInterests       = useGameStore((s) => s.suhimochiInterests);
  const suhimochiKeywords        = useGameStore((s) => s.suhimochiKeywords);
  const suhimochiTimeline        = useGameStore((s) => s.suhimochiTimeline);
  const anataZukanEntries        = useGameStore((s) => s.anataZukanEntries);
  const setSuhimochiInterests    = useGameStore((s) => s.setSuhimochiInterests);
  const addSuhimochiKeywords     = useGameStore((s) => s.addSuhimochiKeywords);
  const registerAnataZukanWords  = useGameStore((s) => s.registerAnataZukanWords);
  const updateAnataZukanEntry    = useGameStore((s) => s.updateAnataZukanEntry);
  const deleteAnataZukanEntry    = useGameStore((s) => s.deleteAnataZukanEntry);
  const decaySuhimochiKeywords   = useGameStore((s) => s.decaySuhimochiKeywords);
  const addSuhimochiTimelinePost = useGameStore((s) => s.addSuhimochiTimelinePost);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const openingInitRef = useRef(false);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [charPosition, setCharPosition] = useState(400);
  const hopControls = useAnimation();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogOpen,  setIsLogOpen]  = useState(false);
  const [talkInput,  setTalkInput]  = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replyTargetPost, setReplyTargetPost] = useState<{ id: string; text: string } | null>(null);
  const [isAnataZukanOpen, setIsAnataZukanOpen] = useState(false);
  const [editingAnataId, setEditingAnataId] = useState<string | null>(null);
  const [editingAnataName, setEditingAnataName] = useState('');
  const [editingAnataCategory, setEditingAnataCategory] = useState<AnataCategory>('other');
  const [currentEmotion, setCurrentEmotion] = useState<string>('happy');
  const [intimacyVisible, setIntimacyVisible] = useState(
    suhimochiIntimacy.totalMessages > 0
  );

  // セッションをまたいだ会話ログ復元（ログ表示用）
  const [talkMessages, setTalkMessages] = useState<ConversationChatMessage[]>(() => {
    const history = suhimochiGeminiHistory;
    if (history.length === 0) return [];

    // 直近6件（3往復）を表示用に変換
    const recentHistory = history.slice(-6);
    return recentHistory.map((msg, i) => ({
      id: `history-${i}`,
      role: msg.role === 'model' ? 'suhimochi' : 'user',
      text: msg.parts[0]?.text ?? '',
    } as ConversationChatMessage));
  });

  // ============================================================
  // 収集語（無効語フィルタ適用済み）
  // ============================================================

  const collectedWordsForTalk = useMemo<SuhimochiCollectedWord[]>(() => {
    const MAX = 200;
    const out: SuhimochiCollectedWord[] = [];
    const seen = new Set<string>();

    const extractCtx = (text: string): string[] => {
      const n = String(text ?? '').normalize('NFKC').toLowerCase().trim();
      if (!n) return [];
      return Array.from(new Set(
        n.split(/[。．.!！?？、,，／/・|｜\s「」『』（）()【】\[\]はがをにでとのもへやってなど]+/u)
          .map((t) => t.trim()).filter((t) => t.length >= 2 && t.length <= 24)
      )).slice(0, 8);
    };

    for (const scan of wordCollectionScans) {
      for (const w of scan.words ?? []) {
        const word = String(w.word ?? '').trim().toLowerCase();
        if (!isValidWord(word) || seen.has(word)) continue; // ★ 無効語フィルタ
        seen.add(word);
        out.push({
          word, source: 'word_collection', level: w.meaning ? 3 : 2,
          meaning: w.meaning?.trim() || undefined,
          note: w.exampleSentence?.trim() || undefined,
        });
        if (out.length >= MAX) return out;
      }
    }

    const sortedDex = [...wordDexWords].sort((a, b) => {
      const ad = Date.parse(a.lastAttemptDate || a.firstEncounterDate || '');
      const bd = Date.parse(b.lastAttemptDate || b.firstEncounterDate || '');
      return (Number.isNaN(bd) ? 0 : bd) - (Number.isNaN(ad) ? 0 : ad);
    });
    const toLevel = (w: (typeof sortedDex)[number]): 1|2|3|4|5 => {
      if (w.correctCount >= 8 || w.consecutiveCorrect >= 5) return 5;
      if (w.correctCount >= 4 || w.consecutiveCorrect >= 3) return 4;
      if (w.correctCount >= 2) return 3;
      if (w.totalAttempts >= 1) return 2;
      return 1;
    };
    for (const w of sortedDex) {
      const word = String(w.name ?? '').trim().toLowerCase();
      if (!isValidWord(word) || seen.has(word)) continue; // ★ 無効語フィルタ
      seen.add(word);
      out.push({
        word, source: 'word_dex', level: toLevel(w),
        meaning: w.description?.trim() || undefined,
        description: w.description?.trim() || undefined,
        relatedFacts: Array.isArray(w.relatedFacts) ? w.relatedFacts.map((f) => String(f).trim()).filter(Boolean).slice(0, 5) : undefined,
        relations: Array.isArray(w.relations) ? w.relations.map((r) => ({ target: String(r.target ?? '').trim(), relation: String(r.relation ?? '').trim() })).filter((r) => r.target && r.relation).slice(0, 5) : undefined,
        contextKeywords: extractCtx([w.description ?? '', ...(w.relatedFacts ?? []), ...((w.relations ?? []).map((r) => `${r.target} ${r.relation}`))].join(' ')),
        note: w.dictionaryId,
      });
      if (out.length >= MAX) break;
      for (const rel of w.relations ?? []) {
        const target = String(rel.target ?? '').trim().toLowerCase();
        if (!isValidWord(target) || seen.has(target)) continue; // ★ 無効語フィルタ
        seen.add(target);
        out.push({
          word: target, source: 'word_dex_relation', level: 1,
          description: `${w.name}との関連語`,
          relatedFacts: [`${w.name}との関係: ${String(rel.relation ?? '').trim()}`],
          relations: [{ target: word, relation: String(rel.relation ?? '').trim() || '関連語' }],
          contextKeywords: extractCtx(`${w.name} ${String(rel.relation ?? '')}`),
          note: w.dictionaryId,
        });
        if (out.length >= MAX) break;
      }
      if (out.length >= MAX) break;
    }
    return out;
  }, [wordCollectionScans, wordDexWords]);

  const equippedDetails = useMemo(() => ({
    head:      equipment.head      ? getItemById(equipment.head)      : undefined,
    body:      equipment.body      ? getItemById(equipment.body)      : undefined,
    face:      equipment.face      ? getItemById(equipment.face)      : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  // ============================================================
  // 初期化：開口メッセージ生成
  // ============================================================

  useEffect(() => {
    if (openingInitRef.current) return;
    openingInitRef.current = true;

    const opts: SuhimochiOpeningOptions = {
      collectedWords: collectedWordsForTalk,
      intimacyLevel: suhimochiIntimacy.level,
      lastVisitedAt: suhimochiLastVisitedAt > 0 ? suhimochiLastVisitedAt : undefined,
      lastSuhimochiMessage: suhimochiLastMessage || undefined,
      newlyLearnedWord,
    };

    generateSuhimochiOpeningMessage(opts).then((text) => {
      // 過去ログは残しつつ、開口メッセージを末尾に追加
      setTalkMessages((prev) => {
        if (prev.some((m) => m.id === 'init-suhimochi')) return prev;
        return [...prev, { id: 'init-suhimochi', role: 'suhimochi', text }];
      });
    });

    decaySuhimochiKeywords();
    if (suhimochiInterests.length > 0) {
      const lastPost = suhimochiTimeline[0];
      if (!lastPost || Date.now() - lastPost.timestamp > 60 * 60 * 1000) {
        void (async () => {
          const post = await generateAutoPost(suhimochiInterests, suhimochiKeywords);
          addSuhimochiTimelinePost(post);
        })();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLogOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [talkMessages, isLogOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      const c = scrollRef.current;
      c.scrollLeft = (c.scrollWidth - c.clientWidth) / 2;
    }
  }, []);

  const handleConfirmInterests = useCallback(async () => {
    if (selectedInterests.length < 2) return;
    setSuhimochiInterests(selectedInterests);
    const post = await generateAutoPost(selectedInterests, suhimochiKeywords);
    addSuhimochiTimelinePost(post);
  }, [selectedInterests, suhimochiKeywords, setSuhimochiInterests, addSuhimochiTimelinePost]);

  const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditMode) return;
    vibrateLight();
    const rect = e.currentTarget.getBoundingClientRect();
    setCharPosition(Math.max(120, Math.min(e.clientX - rect.left, 800 - 120)));
  };

  useEffect(() => {
    hopControls.start({
      y: [0, -17, 0, -20, 0],
      rotate: [0, -3, 3, -3, 0],
      transition: { duration: 1.2, ease: 'easeInOut' },
    });
  }, [charPosition, hopControls]);

  // ============================================================
  // 会話送信
  // ============================================================

  const handleSendTalk = useCallback(async () => {
    const userText = talkInput.trim();
    if (!userText || isReplying) return;
    vibrateLight();
    setTalkInput('');
    setIsReplying(true);

    setTalkMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: userText },
    ]);

    try {
      const historyForReply = replyTargetPost
        ? [
            ...suhimochiGeminiHistory,
            { role: 'model' as const, parts: [{ text: replyTargetPost.text }] as [{ text: string }] },
          ]
        : suhimochiGeminiHistory;

      const { reply, emotion } = await generateSuhimochiReply(
        userText,
        historyForReply,
        collectedWordsForTalk,
        suhimochiIntimacy.level,
      );

      setTalkMessages((prev) => [
        ...prev,
        { id: `suhimochi-${Date.now()}`, role: 'suhimochi', text: reply },
      ]);

      setCurrentEmotion(emotion);
      setIntimacyVisible(true);
      setReplyTargetPost(null);

      try {
        appendSuhimochiGeminiHistory(userText, reply);
        updateSuhimochiLastVisit(reply);

        const kws = extractKeywords(userText);
        if (kws.length > 0) addSuhimochiKeywords(kws, 'user');

        // あなた図鑑への自動登録（サイレント）
        const anataKws = extractKeywordsForAnataZukan(userText);
        if (anataKws.length > 0) registerAnataZukanWords(anataKws);

        const gain = calcIntimacyGain(userText, collectedWordsForTalk, emotion);
        const { newLevel, leveledUp } = updateSuhimochiIntimacy(gain);
        if (leveledUp) {
          addToast('success', `なかよし度が上がった！「${INTIMACY_LEVEL_LABELS[newLevel as IntimacyLevel]}」になったよ`);
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SuhimochiRoom] 会話後のストア更新に失敗', e);
        }
      }

    } catch {
      setTalkMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'suhimochi', text: 'ごめんね、うまく話せなかった。もう一回話しかけてくれる？' },
      ]);
    } finally {
      setIsReplying(false);
    }
  }, [
    talkInput, isReplying,
    suhimochiGeminiHistory, suhimochiIntimacy.level, replyTargetPost,
    collectedWordsForTalk,
    appendSuhimochiGeminiHistory, updateSuhimochiIntimacy,
    updateSuhimochiLastVisit, addSuhimochiKeywords, registerAnataZukanWords,
    addToast,
  ]);

  // ============================================================
  // 派生値
  // ============================================================

  const latestSuhimochiMessage = useMemo(() => {
    // 口元吹き出しには過去ログ(history-*)を表示しない
    const latest = [...talkMessages]
      .reverse()
      .find((m) => m.role === 'suhimochi' && !m.id.startsWith('history-'));
    return latest?.text ?? '';
  }, [talkMessages]);

  const bubbleLeft    = Math.max(16, Math.min(charPosition - 170, 800 - 340));
  const logMessages   = useMemo(() => talkMessages, [talkMessages]);
  const sortedAnataZukanEntries = useMemo<AnataZukanEntry[]>(
    () => [...anataZukanEntries].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [anataZukanEntries],
  );
  const anataZukanByCategory = useMemo(() => {
    const groups: Record<AnataCategory, AnataZukanEntry[]> = {
      work: [],
      character: [],
      topic: [],
      food: [],
      game: [],
      person: [],
      other: [],
    };
    const validCategories: AnataCategory[] = ['work', 'character', 'topic', 'food', 'game', 'person', 'other'];
    for (const e of sortedAnataZukanEntries) {
      const key = validCategories.includes(e.category as AnataCategory)
        ? (e.category as AnataCategory)
        : 'other';
      groups[key].push(e);
    }
    return groups;
  }, [sortedAnataZukanEntries]);
  const intimacyLevel  = suhimochiIntimacy.level as IntimacyLevel;
  const intimacyPoints = suhimochiIntimacy.points;
  const totalMessages  = suhimochiIntimacy.totalMessages;

  // ============================================================
  // 時間帯による窓の背景
  // ============================================================

  const windowBg = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 10) return (
      <div className="absolute inset-0 bg-gradient-to-b from-orange-200 via-amber-100 to-sky-200">
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-orange-300 shadow-lg shadow-orange-200" />
      </div>
    );
    if (h >= 10 && h < 17) return (
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-yellow-200 shadow-lg shadow-yellow-100" />
        <div className="absolute top-6 left-4 h-4 w-10 rounded-full bg-white/60" />
        <div className="absolute top-8 right-3 h-3 w-8 rounded-full bg-white/50" />
      </div>
    );
    if (h >= 17 && h < 20) return (
      <div className="absolute inset-0 bg-gradient-to-b from-orange-400 via-rose-300 to-purple-200">
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full bg-orange-200 shadow-lg" />
      </div>
    );
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900 via-indigo-700 to-purple-800">
        {[{t:'10%',l:'20%'},{t:'25%',l:'65%'},{t:'15%',l:'45%'},{t:'40%',l:'30%'},{t:'35%',l:'75%'}].map((s,i) => (
          <div key={i} className="absolute h-1 w-1 rounded-full bg-white opacity-80" style={{top:s.t,left:s.l}} />
        ))}
        <div className="absolute top-4 right-4 h-5 w-5 rounded-full bg-yellow-100/80" />
      </div>
    );
  }, []);

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-emerald-50">

      {/* ジャンル選択モーダル（初回のみ） */}
      <AnimatePresence>
        {suhimochiInterests.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-1 text-center text-3xl">🧸</div>
              <h2 className="mb-1 text-center text-lg font-bold text-amber-900">どんな話が好き？</h2>
              <p className="mb-5 text-center text-sm text-amber-600/70">2〜3個えらんでね</p>
              <div className="mb-5 grid grid-cols-3 gap-2">
                {INTEREST_OPTIONS.map((opt) => (
                  <button key={opt.value}
                    onClick={() => { vibrateLight(); setSelectedInterests((prev) => prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : prev.length < 3 ? [...prev, opt.value] : prev); }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-medium transition-all active:scale-95 ${selectedInterests.includes(opt.value) ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-amber-100 bg-amber-50/80 text-amber-600 hover:border-amber-200'}`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span>{opt.value}</span>
                  </button>
                ))}
              </div>
              <button onClick={handleConfirmInterests} disabled={selectedInterests.length < 2}
                className="w-full rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 py-3 text-sm font-bold text-white shadow-md disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {selectedInterests.length < 2 ? `あと${2 - selectedInterests.length}個えらんでね` : 'これで話しかけてみる！'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto px-4 pt-4 pb-8 flex flex-col gap-3">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <button onClick={() => { vibrateLight(); onBack(); }} className="flex items-center gap-1 text-amber-800/80 hover:text-amber-900">
            <ChevronLeft className="h-5 w-5" />戻る
          </button>
          <h1 className="text-xl font-bold text-amber-900">すうひもちの部屋</h1>
          <div className="relative">
            <button onClick={() => { vibrateLight(); setIsMenuOpen((p) => !p); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 active:scale-95"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl"
                  >
                    {[
                      { icon: <ScrollText className="h-4 w-4" />, label: '図鑑を見る', color: 'text-sky-700' },
                      { icon: <Paintbrush className="h-4 w-4" />, label: '模様替え', color: 'text-amber-700', isEdit: true },
                    ].map((item) => (
                      <button key={item.label}
                        onClick={() => {
                          vibrateLight();
                          setIsMenuOpen(false);
                          if (item.isEdit) {
                            setIsEditMode(true);
                            return;
                          }
                          if (item.label === '図鑑を見る') {
                            setIsAnataZukanOpen(true);
                            return;
                          }
                          addToast('info', `「${item.label}」は準備中です`);
                        }}
                        className={`flex w-full items-center gap-3 border-b border-amber-100 px-4 py-3 text-sm font-medium last:border-0 hover:bg-amber-50 ${item.color}`}
                      >
                        {item.icon}{item.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* あなた図鑑モーダル（図鑑を見るからのみ開く） */}
        <AnimatePresence>
          {isAnataZukanOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-4 shadow-2xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-rose-900">あなた図鑑</h2>
                  <button
                    onClick={() => setIsAnataZukanOpen(false)}
                    className="rounded-lg px-2 py-1 text-sm text-rose-700 hover:bg-rose-50"
                  >
                    閉じる
                  </button>
                </div>
                {sortedAnataZukanEntries.length === 0 ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700">
                    まだ登録がありません。会話すると少しずつ増えていきます。
                  </div>
                ) : (
                  <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                    {[
                      { key: 'work' as const, title: '好きな作品' },
                      { key: 'character' as const, title: '好きなキャラ' },
                      { key: 'person' as const, title: '好きな人' },
                      { key: 'game' as const, title: '好きなゲーム' },
                      { key: 'food' as const, title: '好きな食べ物' },
                      { key: 'topic' as const, title: '気になる話題' },
                      { key: 'other' as const, title: 'その他' },
                    ].map((section) => {
                      const items = anataZukanByCategory[section.key];
                      if (items.length === 0) return null;
                      return (
                        <div key={section.key} className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3">
                          <h3 className="mb-2 text-sm font-bold text-rose-800">{section.title}</h3>
                          <div className="space-y-2">
                            {items.map((e) => (
                              <div key={e.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                                {editingAnataId === e.id ? (
                                  <div className="space-y-2">
                                    <input
                                      value={editingAnataName}
                                      onChange={(ev) => setEditingAnataName(ev.target.value)}
                                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm text-rose-900 outline-none"
                                    />
                                    <select
                                      value={editingAnataCategory}
                                      onChange={(ev) => setEditingAnataCategory(ev.target.value as AnataCategory)}
                                      className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm text-rose-900 outline-none"
                                    >
                                      <option value="work">作品</option>
                                      <option value="character">キャラ</option>
                                      <option value="person">人</option>
                                      <option value="game">ゲーム</option>
                                      <option value="food">食べ物</option>
                                      <option value="topic">話題</option>
                                      <option value="other">その他</option>
                                    </select>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => setEditingAnataId(null)}
                                        className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                                      >
                                        キャンセル
                                      </button>
                                      <button
                                        onClick={() => {
                                          updateAnataZukanEntry(e.id, {
                                            name: editingAnataName.trim() || e.name,
                                            category: editingAnataCategory,
                                          });
                                          setEditingAnataId(null);
                                        }}
                                        className="rounded-lg bg-rose-500 px-2 py-1 text-xs text-white"
                                      >
                                        保存
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-rose-900">{e.name}</p>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingAnataId(e.id);
                                          setEditingAnataName(e.name);
                                          setEditingAnataCategory((e.category as AnataCategory) || 'other');
                                        }}
                                        className="text-xs text-rose-600 hover:underline"
                                      >
                                        編集
                                      </button>
                                      <button
                                        onClick={() => deleteAnataZukanEntry(e.id)}
                                        className="text-xs text-rose-500 hover:underline"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 親密度バー */}
        <AnimatePresence>
          {intimacyVisible && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
              transition={{ duration: 0.4 }} className="overflow-hidden"
            >
              <div className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-rose-400" />
                    <span className="text-sm font-bold text-amber-900">{INTIMACY_LEVEL_LABELS[intimacyLevel]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {([1,2,3,4,5] as IntimacyLevel[]).map((lv) => (
                      <motion.div key={lv}
                        className={`rounded-full transition-all duration-500 ${lv <= intimacyLevel ? 'h-2.5 w-2.5 bg-rose-400' : 'h-2 w-2 bg-amber-200'}`}
                        animate={lv === intimacyLevel ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.4 }}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-amber-100 shadow-inner">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${INTIMACY_LEVEL_COLORS[intimacyLevel]} shadow-sm`}
                    animate={{ width: `${intimacyPoints}%` }}
                    transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-amber-600/60">
                  <span>{totalMessages}回会話した</span>
                  <span>Lv.{intimacyLevel} / 5</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 部屋セクション */}
        <section className={`relative h-[420px] shrink-0 overflow-hidden rounded-3xl border-2 shadow-lg transition-colors ${isEditMode ? 'border-amber-400 bg-[#f0ebd9]' : 'border-amber-900/10 bg-[#e8e4d9]'}`}>
          <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="relative h-full w-[800px]">

              {/* 壁 */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 h-32 w-32 overflow-hidden rounded-full border-4 border-[#7a5c43] shadow-inner">
                  {windowBg}
                </div>
                <div className="absolute top-48 left-0 right-0 h-3 bg-[#7a5c43] shadow-sm" />
                <div className="absolute bottom-0 top-0 left-4 w-3 bg-[#7a5c43]" />
                <div className="absolute bottom-0 top-0 left-[260px] w-2 bg-[#7a5c43] opacity-50" />
                <div className="absolute bottom-0 top-0 right-[260px] w-2 bg-[#7a5c43] opacity-50" />
                <div className="absolute bottom-0 top-0 right-4 w-3 bg-[#7a5c43]" />
              </div>

              {/* 床 */}
              <div className="absolute bottom-0 left-0 right-0 h-52 bg-[#cddb9b] border-t-4 border-[#7a5c43] z-10 pointer-events-none">
                <div className="absolute top-0 bottom-0 left-1/3 w-1 bg-[#5a6b31] opacity-30" />
                <div className="absolute top-0 bottom-0 right-1/3 w-1 bg-[#5a6b31] opacity-30" />
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#5a6b31] opacity-30" />
                {isEditMode && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4zIiBzdHJva2Utd2lkdGg9IjEiIC8+Cjwvc3ZnPg==')] opacity-50" />}
              </div>

              {/* タップ判定 */}
              <div className={`absolute bottom-0 left-0 right-0 h-52 z-20 ${isEditMode ? 'pointer-events-none' : 'cursor-pointer pointer-events-auto'}`} onClick={handleFloorClick} />

              {/* 家具 */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                <AnimatePresence>
                  {placedItems.map((item) => (
                    <motion.div key={item.id} drag={isEditMode} dragMomentum={false}
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1, x: item.x, y: item.y }} exit={{ scale: 0, opacity: 0 }}
                      className={`absolute flex items-center justify-center ${isEditMode ? 'pointer-events-auto cursor-grab' : 'pointer-events-none'}`}
                      onDragEnd={(_, info) => moveFurnitureByOffset(item.id, info.offset.x, info.offset.y)}
                      style={{ zIndex: Math.floor(item.y || 0) }}
                    >
                      <div className="relative">
                        {isEditMode && (
                          <button onPointerDown={(e) => { e.stopPropagation(); vibrateLight(); removeFurnitureFromRoom(item); }}
                            className="absolute -right-2 -top-2 z-50 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-md">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <div className={`flex h-16 w-16 items-center justify-center text-5xl ${isEditMode ? 'rounded-xl border-2 border-dashed border-amber-500 bg-white/40 scale-110' : 'drop-shadow-md'}`}>
                          {item.emoji}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* キャラクター */}
              <motion.div className="absolute bottom-14 left-0 z-30 pointer-events-none"
                animate={{ x: charPosition - 120 }} transition={{ type: 'tween', duration: 1.2, ease: 'linear' }}>
                <motion.div animate={hopControls}>
                  <PotatoAvatar equipped={equippedDetails} emotion={currentEmotion as any} size={240} ssrEffect={false} showShadow={false} />
                </motion.div>
              </motion.div>

              {/* 吹き出し */}
              {latestSuhimochiMessage && (
                <div className="absolute bottom-[258px] z-40 w-[300px] pointer-events-none" style={{ left: bubbleLeft }}>
                  <div className="rounded-2xl border-2 border-amber-800/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
                    <AnimatePresence mode="wait">
                      <motion.p key={latestSuhimochiMessage}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="text-sm font-medium leading-relaxed text-amber-900"
                      >
                        {latestSuhimochiMessage}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* 模様替えオーバーレイ */}
              <AnimatePresence>
                {isEditMode && (
                  <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                    className="absolute bottom-0 left-0 right-0 z-50 rounded-b-3xl border-t-2 border-amber-300 bg-amber-50/95 p-3 backdrop-blur-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900">
                        <Box className="h-4 w-4" />
                        <span className="text-sm font-bold">収納ボックス</span>
                      </div>
                      <motion.button onClick={() => { vibrateLight(); setIsEditMode(false); }}
                        className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-md"
                        whileTap={{ scale: 0.95 }}>
                        <Check className="h-3 w-3" /> 完了
                      </motion.button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                      {inventory.length === 0
                        ? <p className="flex h-14 w-full items-center justify-center text-xs text-amber-900/50">収納に家具がありません</p>
                        : inventory.map((item) => (
                          <button key={item.id} onClick={() => { vibrateLight(); addFurnitureToRoom(item, (scrollRef.current?.scrollLeft || 0) + 150, 280); }}
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-3xl shadow-sm hover:bg-amber-100 active:scale-95">
                            {item.emoji}
                          </button>
                        ))
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* 最近の言葉タグ */}
        {collectedWordsForTalk.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-amber-700/60 shrink-0">最近の言葉：</span>
            {collectedWordsForTalk.slice(-5).map((w) => (
              <button key={w.word}
                onClick={() => {
                  if (isReplying) return;
                  vibrateLight();
                  setTalkInput(w.word);
                  inputRef.current?.focus();
                }}
                className={`rounded-full border border-amber-300 bg-amber-100/80 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 active:scale-95 transition-all ${isReplying ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {w.word}
              </button>
            ))}
          </div>
        )}

        {/* ★ 会話ログ（セッションをまたいだ過去ログ含む） */}
        {logMessages.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-white/60 overflow-hidden">
            <button onClick={() => { vibrateLight(); setIsLogOpen((p) => !p); }}
              className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-amber-50/60"
            >
              <div className="flex items-center gap-2 text-amber-800">
                <MessageCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold">会話ログ</span>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                  {logMessages.length}
                </span>
                {/* ★ 過去ログがある場合のラベル */}
                {suhimochiGeminiHistory.length > 0 && (
                  <span className="text-xs text-amber-500/70">（前回の続き含む）</span>
                )}
              </div>
              {isLogOpen ? <ChevronUp className="h-4 w-4 text-amber-500" /> : <ChevronDown className="h-4 w-4 text-amber-500" />}
            </button>
            <AnimatePresence initial={false}>
              {isLogOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }} className="overflow-hidden"
                >
                  <div className="max-h-52 overflow-y-auto px-4 pt-1 pb-3 space-y-2 border-t border-amber-100">
                    {logMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                        {msg.role === 'suhimochi' && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs mt-0.5">🧸</div>
                        )}
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-amber-400 text-white rounded-br-sm'
                            : 'bg-amber-50 border border-amber-200 text-amber-900 rounded-bl-sm'
                        } ${
                          // ★ 過去ログは少し薄く表示
                          msg.id.startsWith('history-') ? 'opacity-60' : ''
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 入力欄 */}
        {!isEditMode && (
          <div className="rounded-2xl border border-amber-300 bg-white/90 shadow-md shadow-amber-100 overflow-hidden">
            {replyTargetPost && (
              <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2">
                <p className="truncate text-xs text-amber-700">
                  返信先: {replyTargetPost.text}
                </p>
                <button
                  onClick={() => setReplyTargetPost(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-100"
                >
                  解除
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center p-2">
              <input
                ref={inputRef}
                value={talkInput}
                onChange={(e) => setTalkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendTalk(); }}
                placeholder={
                  isReplying
                    ? 'すうひもちが考えてる…'
                    : replyTargetPost
                      ? 'ひとり言への返事を書く'
                      : 'すうひもちに話しかける'
                }
                disabled={isReplying}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-amber-900 placeholder:text-amber-400 outline-none disabled:opacity-50"
              />
              <motion.button
                onClick={handleSendTalk}
                disabled={isReplying || !talkInput.trim()}
                className="shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-200 disabled:opacity-40"
                whileHover={{ scale: isReplying ? 1 : 1.04 }}
                whileTap={{ scale: isReplying ? 1 : 0.96 }}
              >
                {isReplying ? (
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-xs tracking-widest">···</motion.span>
                ) : '送信'}
              </motion.button>
            </div>
            {totalMessages > 0 && (
              <div className="pb-2 text-center text-xs text-amber-400">{totalMessages}回話した</div>
            )}
          </div>
        )}

        {/* タイムライン */}
        {suhimochiTimeline.length > 0 && suhimochiInterests.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-700/60">すうひもちのひとり言</span>
            </div>
            {suhimochiTimeline.slice(0, 5).map((post, i) => (
              <motion.div key={post.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base mt-0.5">🧸</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed text-amber-900">{post.text}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-amber-400">
                        {formatTimelineTimestamp(post.timestamp)}
                        {post.genre && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-600">{post.genre}</span>}
                      </span>
                      <button
                        onClick={() => {
                          if (isReplying) return;
                          vibrateLight();
                          setReplyTargetPost({ id: post.id, text: post.text });
                          setTalkInput('');
                          inputRef.current?.focus();
                        }}
                        className={`text-xs font-medium text-amber-500 hover:text-amber-700 active:scale-95 transition-all ${isReplying ? 'opacity-40 pointer-events-none' : ''}`}
                      >
                        返事する
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
