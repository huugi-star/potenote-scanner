'use client';

/**
 * Potenote Scanner v2 - Main Page
 * 
 * GamePhase管理とすべての画面を統合
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Gem, Crown, Coins, Zap, BookOpen, Shirt, Share2, Languages, Sword, Users, GraduationCap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getItemById } from '@/data/items';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { QuizRaw, TranslationResult, LectureHistory, QuizQuestionAttempt } from '@/types';

// Screens
import { ScanningScreen } from '@/components/screens/ScanningScreen';
import { QuizGameScreen, type QuizMode } from '@/components/screens/QuizGameScreen';
import { ResultScreen } from '@/components/screens/ResultScreen';
import { GachaScreen } from '@/components/screens/GachaScreen';
import { ResearcherDexScreen } from '@/components/screens/ResearcherDexScreen';
import { DressUpScreen } from '@/components/screens/DressUpScreen';
import { FreeQuestScreen } from '@/components/screens/FreeQuestScreen';
import { QuizWordDexScreen } from '@/components/screens/QuizWordDexScreen';
import { TranslationResultScreen } from '@/components/screens/TranslationResultScreen';
import { TranslationHistoryScreen } from '@/components/screens/TranslationHistoryScreen';
import { LectureScreen } from '@/components/screens/LectureScreen';
import { LectureHistoryScreen } from '@/components/screens/LectureHistoryScreen';
import { SuhimochiRoomScreen } from '@/components/screens/SuhimochiRoomScreen';
import { AcademyScreen } from '@/components/screens/AcademyScreen';

// UI Components
import { LoginBonusModal } from '@/components/ui/LoginBonusModal';
// import { ShopModal } from '@/components/ui/ShopModal'; // 一時的に非表示
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthButton } from '@/components/ui/AuthButton';
import { OnboardingOverlay } from '@/components/ui/OnboardingOverlay';
import { ShareModal } from '@/components/ui/ShareModal';
import { DeveloperSupport } from '@/components/ui/DeveloperSupport';

import { vibrateLight } from '@/lib/haptics';
import { getRepairBookFragments, getRepairSpentFragments, migrateRepairProgressIfNeeded } from '@/lib/repairBookFragments';
import { calcBooksFromFragments, calcRankInfo } from '@/constants/rankSystem';

// ===== Types =====

type GamePhase = 
  | 'home'
  | 'mypage'
  | 'suhimochi_room'
  | 'academy'
  | 'adventure_menu'
  | 'scanning'
  | 'mode_select'
  | 'translation_mode_select' // 翻訳モード選択画面
  | 'quiz'
  | 'result'
  | 'gacha'
  | 'researcher_dex' // 研究員図鑑
  | 'dressup'
  | 'freequest'
  | 'worddex'
  | 'translation_result'
  | 'translation_history'
  | 'lecture'
  | 'lecture_history';

interface QuizSession {
  quiz: QuizRaw;
  imageUrl: string;
  mode: QuizMode;
  correctCount: number;
  speedRushTotalTime?: number; // speed rushモードでの正答の合計時間（秒）
  isFreeQuest?: boolean;
  batchId?: string;
  attempts?: QuizQuestionAttempt[];
}

const TEMP_DISPLAY_NAMES = ['すうひもち見習い', 'クイズ旅人', 'ポテノ研究員'] as const;

const pickTemporaryDisplayName = (): string => {
  return TEMP_DISPLAY_NAMES[Math.floor(Math.random() * TEMP_DISPLAY_NAMES.length)];
};

// ===== Sub Components =====

/**
 * 翻訳結果画面ラッパー（ストアから結果を取得）
 */
const TranslationResultScreenWrapper = ({ onBack }: { onBack: () => void }) => {
  const translationResult = useGameStore(state => state.translationResult);
  
  if (!translationResult) {
    return null;
  }
  
  return (
    <motion.div
      key="translation_result"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <TranslationResultScreen
        result={translationResult}
        onBack={onBack}
      />
    </motion.div>
  );
};

/**
 * 冒険メニュー画面
 * - 単コレ
 * - スキャンして冒険
 * - 英文解釈
 */
const AdventureMenuScreen = ({
  onBack,
  onOpenScanAdventure,
  onOpenEnglishReading,
}: {
  onBack: () => void;
  onOpenScanAdventure: () => void;
  onOpenEnglishReading: () => void;
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-md mx-auto pt-6">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">ことばを集める</h2>
        <p className="text-gray-400 text-sm text-center mb-6">遊び方を選んでください</p>

        <div className="space-y-3">
          <Link href="/word-collection" onClick={() => vibrateLight()}>
            <motion.div
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sword className="w-5 h-5" />
              単コレ
            </motion.div>
          </Link>

          <motion.button
            onClick={() => {
              vibrateLight();
              onOpenScanAdventure();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            スキャンして冒険
          </motion.button>

          <motion.button
            onClick={() => {
              vibrateLight();
              onOpenEnglishReading();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Languages className="w-5 h-5" />
            英文解釈
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 w-full py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

/**
 * ホーム画面
 */
const HomeScreen = ({
  onNavigate,
  onShowShare,
  onOpenMyPage,
}: {
  onNavigate: (phase: GamePhase) => void;
  onShowShare: () => void;
  onOpenMyPage: () => void;
}) => {
  const coins = useGameStore(state => state.coins);
  const isVIP = useGameStore(state => state.isVIP);
  const equipment = useGameStore(state => state.equipment);

  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  const [kotobaLeafCount, setKotobaLeafCount] = useState(0);
  const [repairSpentCount, setRepairSpentCount] = useState(0);

  useEffect(() => {
    migrateRepairProgressIfNeeded();
    const sync = () => {
      setKotobaLeafCount(getRepairBookFragments());
      setRepairSpentCount(getRepairSpentFragments());
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(sync, 800);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, []);

  const libraryRankInfo = useMemo(() => {
    const { totalBooks } = calcBooksFromFragments(repairSpentCount);
    return calcRankInfo(totalBooks);
  }, [repairSpentCount]);

  return (
    // ★ 背景画像レイヤー追加
    <div className="relative min-h-screen pb-24">

      {/* ── 背景画像（public/images/backgrounds/home.png に置くと表示） ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/images/backgrounds/home.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* 背景に重ねるグラデーションオーバーレイ（画像がない場合は従来の背景色として機能） */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(17,24,39,0.15) 0%, rgba(31,41,55,0.70) 50%, rgba(17,24,39,0.90) 100%)',
        }}
      />
      {/* 画像がない場合のフォールバック背景色 */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />

      {/* ── コンテンツ（z-10 で背景の上に） ── */}
      <div className="relative z-10 p-4 max-w-md mx-auto pt-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6 gap-2">

          {/* ★ タイトル部分を修正 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0">
              {/* whitespace-nowrap を外して折り返し可能に。フォントサイズも可変に */}
              <h1 className="text-lg font-bold gradient-text leading-tight">
                すうひもちと
              </h1>
              <p className="text-[10px] font-semibold text-gray-300/80 leading-tight">
                失われたことば図書館
              </p>
            </div>
            {isVIP && (
              <div className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                <Crown className="w-3 h-3 text-yellow-400" />
                VIP
              </div>
            )}
          </div>

          {/* 右上ボタン群 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { vibrateLight(); onOpenMyPage(); }}
              className="px-3 py-2 rounded-full bg-gray-700/80 hover:bg-gray-600 text-gray-200 transition-colors text-sm font-semibold whitespace-nowrap backdrop-blur-sm"
            >
              マイページ
            </button>
            <button
              onClick={() => { vibrateLight(); onShowShare(); }}
              className="p-2 rounded-full bg-gray-700/80 hover:bg-gray-600 text-gray-300 transition-colors backdrop-blur-sm"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <AuthButton />
          </div>
        </div>

        {/* ステータスバー */}
        <div className="mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/60 rounded-xl border border-gray-700/80 backdrop-blur-sm">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold">{coins}</span>
          </div>
        </div>

        {/* 図書館ランク・ことの葉（アバター直上 / ゲーム感ステータス） */}
        <div className="flex justify-center mb-4 px-1">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-sm rounded-3xl overflow-hidden border backdrop-blur-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(17,24,39,0.78), rgba(30,27,75,0.58), rgba(15,23,42,0.78))',
              borderColor: `${libraryRankInfo.tier.glow}55`,
              boxShadow: `0 16px 40px rgba(0,0,0,0.35), 0 0 32px ${libraryRankInfo.tier.glow}22`,
            }}
          >
            {/* 上部グロー */}
            <div
              className="pointer-events-none absolute -top-10 left-1/2 h-24 w-72 -translate-x-1/2 rounded-full blur-2xl"
              style={{ background: `${libraryRankInfo.tier.glow}33` }}
              aria-hidden
            />

            <div className="relative px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black tracking-[0.18em] text-white/70">
                      図書館ランク
                    </span>
                    <motion.span
                      className="h-2 w-2 rounded-full"
                      style={{ background: libraryRankInfo.tier.glow, boxShadow: `0 0 14px ${libraryRankInfo.tier.glow}` }}
                      animate={{ opacity: [0.55, 1, 0.55] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden
                    />
                  </div>
                  <div
                    className="mt-1 text-xl sm:text-2xl font-black leading-tight line-clamp-2"
                    style={{
                      color: libraryRankInfo.tier.light,
                      textShadow: `0 0 18px ${libraryRankInfo.tier.glow}55, 0 2px 10px rgba(0,0,0,0.35)`,
                    }}
                  >
                    {libraryRankInfo.fullTitle}
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl px-3 py-2 border"
                  style={{
                    background: 'rgba(0,0,0,0.22)',
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" style={{ color: libraryRankInfo.tier.glow }} />
                    <span className="text-[11px] font-bold text-white/75">ことの葉</span>
                  </div>
                  <div className="mt-0.5 tabular-nums text-right">
                    <span className="text-2xl font-black" style={{ color: 'rgba(167,243,208,0.98)', textShadow: '0 1px 8px rgba(16,185,129,0.25)' }}>
                      {kotobaLeafCount}
                    </span>
                    <span className="text-xs font-bold text-emerald-100/80 ml-1">枚</span>
                  </div>
                </div>
              </div>

              {/* 下部リボン */}
              <div
                className="mt-3 rounded-2xl px-4 py-2 border"
                style={{
                  background: `linear-gradient(135deg, ${libraryRankInfo.tier.glow}22, rgba(255,255,255,0.06))`,
                  borderColor: `${libraryRankInfo.tier.glow}33`,
                }}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                  <span className="text-white/70">修繕してランクアップ</span>
                  <span className="text-white/75">クイズでことの葉を集めよう</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ポテトアバター */}
        <motion.button
          className="flex justify-center mb-4 mx-auto relative"
          onClick={() => { vibrateLight(); onNavigate('dressup'); }}
          whileTap={{ scale: 0.97 }}
        >
          <PotatoAvatar
            equipped={equippedDetails}
            emotion="happy"
            size={260}
            ssrEffect={false}
          />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-pink-500/80 text-white text-xs rounded-full flex items-center gap-1">
            <Shirt className="w-3 h-3" />
            着せ替え
          </div>
        </motion.button>

        {/* メインボタン群 */}
        <div className="space-y-3">
          <motion.button
            onClick={() => { vibrateLight(); onNavigate('suhimochi_room'); }}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Languages className="w-7 h-7" />
            すうひもちと会話する
          </motion.button>

          <motion.button
            onClick={() => { vibrateLight(); onNavigate('academy'); }}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <GraduationCap className="w-7 h-7" />
            ことば図書館
          </motion.button>

          <motion.button
            onClick={() => { vibrateLight(); onNavigate('adventure_menu'); }}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-amber-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sword className="w-7 h-7" />
            ことばを集める
          </motion.button>
        </div>

        {/* サブアクション */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.button
            onClick={() => { vibrateLight(); onNavigate('gacha'); }}
            className="py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Gem className="w-5 h-5" />
            ガチャ
          </motion.button>

          <motion.button
            onClick={() => { vibrateLight(); onNavigate('researcher_dex'); }}
            className="py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Users className="w-5 h-5" />
            研究員図鑑
          </motion.button>
        </div>

        <DeveloperSupport />
      </div>
    </div>
  );
};

const MyPageScreen = ({
  displayName,
  onBack,
  onEditName,
}: {
  displayName: string;
  onBack: () => void;
  onEditName: () => void;
}) => {
  const totalScans = useGameStore((s) => s.totalScans);
  const totalQuizzes = useGameStore((s) => s.totalQuizzes);
  const totalMessages = useGameStore((s) => s.suhimochiIntimacy.totalMessages);
  const intimacyLevel = useGameStore((s) => s.suhimochiIntimacy.level);
  const intimacyPoints = useGameStore((s) => s.suhimochiIntimacy.points);
  const consecutiveDays = useGameStore((s) => s.consecutiveLoginDays);
  const isVIP = useGameStore((s) => s.isVIP);
  const coins = useGameStore((s) => s.coins);
  const equipment = useGameStore((s) => s.equipment);

  const equippedDetails = useMemo(
    () => ({
      head: equipment.head ? getItemById(equipment.head) : undefined,
      body: equipment.body ? getItemById(equipment.body) : undefined,
      face: equipment.face ? getItemById(equipment.face) : undefined,
      accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
    }),
    [equipment.head, equipment.body, equipment.face, equipment.accessory]
  );


  const INTIMACY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'はじめまして',
    2: 'なかよし',
    3: 'ともだち',
    4: 'しんゆう',
    5: 'ずっといっしょ',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 bg-gray-900/80 backdrop-blur border-b border-gray-700/50">
        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-white font-bold text-base">マイページ</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <PotatoAvatar
                equipped={equippedDetails}
                emotion="happy"
                size={80}
                ssrEffect={false}
                showShadow={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white text-xl font-bold truncate max-w-[180px]">
                  {displayName || '未設定'}
                </p>
                {isVIP && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    👑 VIP
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-1">{consecutiveDays}日連続ログイン中</p>
              <div className="mt-1 flex items-center gap-1 text-yellow-400 text-sm font-semibold">
                <Coins className="w-3.5 h-3.5" />
                {coins} コイン
              </div>
            </div>
          </div>

          <motion.button
            onClick={() => {
              vibrateLight();
              onEditName();
            }}
            className="mt-4 w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            whileTap={{ scale: 0.98 }}
          >
            ✏️ 名前を変更
          </motion.button>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧸</span>
            <h2 className="text-rose-200 font-bold text-sm">すうひもちとの関係</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-2xl font-bold">
                {INTIMACY_LABELS[intimacyLevel as 1 | 2 | 3 | 4 | 5]}
              </p>
              <p className="text-rose-300/70 text-xs mt-0.5">{totalMessages}回会話した</p>
            </div>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5] as const).map((lv) => (
                <div
                  key={lv}
                  className={`rounded-full transition-all ${
                    lv <= intimacyLevel ? 'w-3 h-3 bg-rose-400' : 'w-2.5 h-2.5 bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (intimacyPoints / 1000) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs text-rose-400/60 mt-1">Lv.{intimacyLevel} / 5</p>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📊</span>
            <h2 className="text-gray-200 font-bold text-sm">学習の記録</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'スキャン回数', value: totalScans, unit: '回' },
              { label: 'クイズ回答数', value: totalQuizzes, unit: '問' },
              { label: '会話回数', value: totalMessages, unit: '回' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-gray-700/50 px-4 py-3 text-center">
                <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
                <p className="text-white text-2xl font-bold">
                  {stat.value}
                  <span className="text-gray-400 text-sm font-normal ml-0.5">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔐</span>
            <h2 className="text-gray-200 font-bold text-sm">アカウント</h2>
          </div>
          <p className="text-gray-400 text-xs mb-4">
            Googleアカウントでログインすると、データが複数の端末で引き継げます。
          </p>
          <AuthButton />
        </div>
      </div>
    </div>
  );
};

/**
 * 翻訳モード選択画面
 */
const TranslationModeSelectScreen = ({
  onSelectMode,
  onBack,
  onOpenHistory,
}: {
  onSelectMode: (mode: 'english_learning' | 'multilang') => void;
  onBack: () => void;
  onOpenHistory: () => void;
}) => {
  const translationHistoryCount = useGameStore(state => state.translationHistory.length);
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 pb-24">
      <div className="max-w-md mx-auto pt-6">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">翻訳モードを選択</h2>
        <p className="text-gray-400 text-sm text-center mb-6">目的に合わせてモードを選んでください</p>

        {/* 翻訳履歴へのショートカット */}
        {translationHistoryCount > 0 && (
          <div className="mb-4 flex justify-center">
            <motion.button
              onClick={() => {
                vibrateLight();
                onOpenHistory();
              }}
              className="px-3 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-200 text-xs flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Languages className="w-3 h-3" />
              翻訳履歴を見る
              <span className="ml-1 px-2 py-0.5 bg-white/10 rounded-full text-[10px]">
                {translationHistoryCount}
              </span>
            </motion.button>
          </div>
        )}

        <div className="space-y-4">
          {/* 英語学習・構造解析モード */}
          <motion.button
            onClick={() => {
              vibrateLight();
              useGameStore.getState().setTranslationMode('english_learning');
              useGameStore.getState().setScanType('translation');
              onSelectMode('english_learning');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-left shadow-lg shadow-blue-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎓</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">英語学習・構造解析モード</h3>
                <p className="text-sm text-blue-100 leading-relaxed">
                  初学者からTOEIC学習者まで、英文の骨格（S+V+O）や修飾関係を可視化し、直読直解の練習をサポートします。
                  <br />
                  語順のまま理解するための構造カードとシンプルな解説で、文法の要点を押さえながら読み進められます。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">初学者</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">TOEIC対応</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">構造解析</span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* 多言語・翻訳モード */}
          <motion.button
            onClick={() => {
              vibrateLight();
              useGameStore.getState().setTranslationMode('multilang');
              useGameStore.getState().setScanType('translation');
              onSelectMode('multilang');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 text-white text-left shadow-lg shadow-green-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">🌏</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">多言語・翻訳モード</h3>
                <p className="text-sm text-green-100 leading-relaxed">
                  全世界の言語に対応。文脈を読み取り、自然で分かりやすい日本語に意訳します。
                  <br />
                  論文の要約や、第二外国語の勉強、海外製品の説明書などに。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">多言語対応</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">自然な日本語</span>
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">文脈理解</span>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 w-full py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

/**
 * モード選択画面
 */
const ModeSelectScreen = ({
  onSelectMode,
  onBack,
}: {
  onSelectMode: (mode: QuizMode) => void;
  onBack: () => void;
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 p-4 flex flex-col">
      <div className="max-w-md mx-auto flex-1 flex flex-col justify-center">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          モードを選択
        </h2>

        <div className="space-y-4">
          {/* Speed Rush */}
          <motion.button
            onClick={() => {
              vibrateLight();
              onSelectMode('speed_rush');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/50 text-left hover:border-cyan-400 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Speed Rush</h3>
                <p className="text-gray-400 text-sm">
                  タイムアタック！素早く答えて敵を倒せ
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">タイマーあり</span>
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">ハイスコア</span>
            </div>
          </motion.button>

          {/* Potato Pupil */}
          <motion.button
            onClick={() => {
              vibrateLight();
              onSelectMode('potato_pupil');
            }}
            className="w-full p-6 rounded-2xl bg-gradient-to-br from-[#1a3c28] to-[#2d5a3f] border-2 border-orange-500/50 text-left hover:border-orange-400 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Potato Pupil</h3>
                <p className="text-gray-300 text-sm">
                  ポテトと一緒に楽しく学ぼう
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">解説付き</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">初心者向け</span>
            </div>
          </motion.button>
        </div>

        <button
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="mt-8 py-3 text-gray-400 hover:text-white transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  );
};

// ===== Main App Content =====

const AppContent = () => {
  // State
  const [phase, setPhase] = useState<GamePhase>('home');
  const [wordDexBackPhase, setWordDexBackPhase] = useState<GamePhase>('scanning');
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusData, setLoginBonusData] = useState({ coins: 0, days: 1 });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedLectureHistory, setSelectedLectureHistory] = useState<LectureHistory | null>(null);

  // Store
  const isVIP = useGameStore(state => state.isVIP);
  const displayName = useGameStore(state => state.displayName);
  const setDisplayName = useGameStore(state => state.setDisplayName);
  const setUserId = useGameStore(state => state.setUserId);
  const equipment = useGameStore(state => state.equipment);
  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  // 初回起動時のログインチェック & Firebase認証状態の反映（1回のみ）
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // 初回のみ実行
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const loginCheck = useGameStore.getState().loginCheck;
    const launched = useGameStore.getState().hasLaunched;

    // 1. ローカルのログインボーナスなど（初回のみ）
    const result = loginCheck();
    if (result.isNewDay && result.bonusCoins > 0) {
      setLoginBonusData({
        coins: result.bonusCoins,
        days: useGameStore.getState().consecutiveLoginDays,
      });
      setShowLoginBonus(true);
    }

    if (!launched) {
      setShowOnboarding(true);
    }

    // 2. Firebase Auth のログイン状態をストアに反映（リロード後もログイン継続）
    if (auth) {
      const authInstance = auth;
      let disposed = false;
      let nullUserTimer: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (disposed) return;

        // user がいれば即時反映
        if (user) {
          if (nullUserTimer) {
            clearTimeout(nullUserTimer);
            nullUserTimer = null;
          }
          await setUserId(user.uid);
          return;
        }

        // リロード直後に一瞬 null が来る環境向け:
        // 少し待って currentUser を再確認してからログアウト扱いにする
        if (nullUserTimer) {
          clearTimeout(nullUserTimer);
        }
        nullUserTimer = setTimeout(async () => {
          if (disposed) return;
          const restoredUser = authInstance.currentUser;
          await setUserId(restoredUser ? restoredUser.uid : null);
        }, 400);
      });
      return () => {
        disposed = true;
        if (nullUserTimer) {
          clearTimeout(nullUserTimer);
          nullUserTimer = null;
        }
        unsubscribe();
      };
    }

    return;
  }, [setUserId]);

  // オンボーディング終了
  const handleDismissOnboarding = useCallback(() => {
    vibrateLight();
    setShowOnboarding(false);
    useGameStore.getState().setHasLaunched();
    const currentDisplayName = useGameStore.getState().displayName;
    if (!String(currentDisplayName ?? '').trim()) {
      setDisplayNameDraft('');
      setIsEditingDisplayName(false);
      setShowDisplayNameModal(true);
    }
  }, []);

  const handleSaveDisplayName = useCallback(() => {
    const normalized = displayNameDraft.trim().slice(0, 12);
    if (!normalized) return;
    setDisplayName(normalized);
    setShowDisplayNameModal(false);
    setIsEditingDisplayName(false);
  }, [displayNameDraft, setDisplayName]);

  const handleSkipDisplayName = useCallback(() => {
    const tempName = pickTemporaryDisplayName();
    setDisplayName(tempName);
    setDisplayNameDraft(tempName);
    setShowDisplayNameModal(false);
    setIsEditingDisplayName(false);
  }, [setDisplayName]);

  const handleOpenDisplayNameEdit = useCallback(() => {
    setDisplayNameDraft(displayName || '');
    setIsEditingDisplayName(true);
    setShowDisplayNameModal(true);
  }, [displayName]);

  // クイズ準備完了
  const handleQuizReady = useCallback((quiz: QuizRaw, imageUrl: string) => {
    const batchId = useGameStore.getState().lastScanQuizId ?? undefined;
    setQuizSession({
      quiz,
      imageUrl,
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: false,
      batchId,
    });
    setPhase('mode_select');
  }, []);

  // 翻訳準備完了
  const handleTranslationReady = useCallback((result: TranslationResult, imageUrl?: string) => {
    const store = useGameStore.getState();
    store.setTranslationResult(result);
    // 翻訳履歴に保存（imageUrlも含む）
    store.saveTranslationHistory(result, imageUrl);
    setPhase('translation_result');
  }, []);

  // フリークエスト開始
  const handleFreeQuestStart = useCallback((quiz: QuizRaw, sourceHistoryId?: string) => {
    // フリークエストは既存履歴を上書き更新するため、開始元履歴IDを保持する
    useGameStore.getState().setLastScanQuizId(sourceHistoryId ?? null);
    setQuizSession({
      quiz,
      imageUrl: '',
      mode: 'potato_pupil',
      correctCount: 0,
      isFreeQuest: true,
      batchId: sourceHistoryId,
    });
    setPhase('mode_select');
  }, []);

  // モード選択
  const handleModeSelect = useCallback((mode: QuizMode) => {
    if (quizSession) {
      setQuizSession({ ...quizSession, mode });
      setPhase('quiz');
    }
  }, [quizSession]);

  // クイズ完了
  const handleQuizComplete = useCallback((correctCount: number, _totalQuestions: number, speedRushTotalTime?: number, attempts?: QuizQuestionAttempt[]) => {
    if (quizSession) {
      setQuizSession({ ...quizSession, correctCount, speedRushTotalTime, attempts });
      setPhase('result');
    }
  }, [quizSession]);

  // ナビゲーション
  const handleNavigate = useCallback((newPhase: GamePhase) => {
    setPhase(newPhase);
  }, []);

  const handleOpenWordDex = useCallback((backPhase: GamePhase) => {
    setWordDexBackPhase(backPhase);
    setPhase('worddex');
  }, []);

  // ホームに戻る
  const handleBackToHome = useCallback(() => {
    setPhase('home');
    setQuizSession(null);
  }, []);

  // フェーズ変更時に必ずスクロール位置を先頭に戻す
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [phase]);

  return (
    <main className="relative">
      <AnimatePresence mode="wait">
        {phase === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HomeScreen 
              onNavigate={handleNavigate} 
              onShowShare={() => setShowShareModal(true)}
              onOpenMyPage={() => handleNavigate('mypage')}
            />
          </motion.div>
        )}

        {phase === 'mypage' && (
          <motion.div
            key="mypage"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <MyPageScreen
              displayName={displayName}
              onBack={handleBackToHome}
              onEditName={handleOpenDisplayNameEdit}
            />
          </motion.div>
        )}

        {phase === 'translation_mode_select' && (
          <motion.div
            key="translation_mode_select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TranslationModeSelectScreen
              onSelectMode={() => {
                handleNavigate('scanning');
              }}
              onBack={() => handleNavigate('home')}
              onOpenHistory={() => handleNavigate('translation_history')}
            />
          </motion.div>
        )}

        {phase === 'adventure_menu' && (
          <motion.div
            key="adventure_menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AdventureMenuScreen
              onBack={() => handleNavigate('home')}
              onOpenScanAdventure={() => {
                useGameStore.getState().setScanType('quiz');
                handleNavigate('scanning');
              }}
              onOpenEnglishReading={() => {
                useGameStore.getState().setTranslationMode('english_learning');
                useGameStore.getState().setScanType('translation');
                handleNavigate('scanning');
              }}
            />
          </motion.div>
        )}

        {phase === 'suhimochi_room' && (
          <motion.div
            key="suhimochi_room"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SuhimochiRoomScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'academy' && (
          <motion.div
            key="academy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <AcademyScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ScanningScreen 
              onQuizReady={handleQuizReady}
              onTranslationReady={handleTranslationReady}
              onOpenFreeQuest={() => handleNavigate('freequest')}
              onOpenWordDex={() => handleOpenWordDex('scanning')}
              onBack={handleBackToHome}
            />
          </motion.div>
        )}

        {phase === 'translation_result' && (
          <TranslationResultScreenWrapper 
            onBack={handleBackToHome}
          />
        )}

        {phase === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ModeSelectScreen
              onSelectMode={handleModeSelect}
              onBack={() => quizSession?.isFreeQuest ? setPhase('freequest') : setPhase('scanning')}
            />
          </motion.div>
        )}

        {phase === 'quiz' && quizSession && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <QuizGameScreen
              quiz={quizSession.quiz}
              mode={quizSession.mode}
              onComplete={handleQuizComplete}
              equipped={equippedDetails}
            />
          </motion.div>
        )}

        {phase === 'result' && quizSession && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultScreen
              quiz={quizSession.quiz}
              correctCount={quizSession.correctCount}
              totalQuestions={quizSession.quiz.questions.length}
              onContinue={handleBackToHome}
              onContinueFreeQuest={quizSession.isFreeQuest ? () => setPhase('freequest') : undefined}
              onOpenWordDex={() => handleOpenWordDex('scanning')}
              isFreeQuest={quizSession.isFreeQuest}
              batchId={quizSession.batchId}
              attempts={quizSession.attempts}
              mode={quizSession.mode}
              speedRushTotalTime={quizSession.speedRushTotalTime}
            />
          </motion.div>
        )}

        {phase === 'worddex' && (
          <motion.div
            key="worddex"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <QuizWordDexScreen onBack={() => setPhase(wordDexBackPhase)} />
          </motion.div>
        )}

        {phase === 'gacha' && (
          <motion.div
            key="gacha"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GachaScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'researcher_dex' && (
          <motion.div
            key="researcher_dex"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ResearcherDexScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'dressup' && (
          <motion.div
            key="dressup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <DressUpScreen onBack={handleBackToHome} />
          </motion.div>
        )}

        {phase === 'freequest' && (
          <motion.div
            key="freequest"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <FreeQuestScreen 
              onBack={handleBackToHome}
              onStartQuiz={handleFreeQuestStart}
            />
          </motion.div>
        )}

        {phase === 'translation_history' && (
          <motion.div
            key="translation_history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TranslationHistoryScreen 
              onBack={handleBackToHome}
            />
          </motion.div>
        )}

        {phase === 'lecture' && (
          <motion.div
            key="lecture"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <LectureScreen 
              onBack={() => {
                setSelectedLectureHistory(null);
                handleBackToHome();
              }}
              initialHistory={selectedLectureHistory || undefined}
            />
          </motion.div>
        )}

        {phase === 'lecture_history' && (
          <motion.div
            key="lecture_history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <LectureHistoryScreen 
              onBack={handleBackToHome}
              onSelectLecture={(history) => {
                // 講義履歴から選択した場合は、講義画面に遷移してその講義を表示
                setSelectedLectureHistory(history);
                handleNavigate('lecture');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ログインボーナスモーダル */}
      <LoginBonusModal
        isOpen={showLoginBonus}
        onClose={() => setShowLoginBonus(false)}
        bonusCoins={loginBonusData.coins}
        consecutiveDays={loginBonusData.days}
        isVIP={isVIP}
      />

      {/* オンボーディングオーバーレイ */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay onDismiss={handleDismissOnboarding} />
        )}
      </AnimatePresence>

      {/* 表示名設定モーダル（初回/編集） */}
      <AnimatePresence>
        {showDisplayNameModal && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-5"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
            >
              <h3 className="text-white text-lg font-bold mb-2">
                {isEditingDisplayName ? '表示名を変更' : '表示名を決めよう'}
              </h3>
              <p className="text-gray-300 text-sm mb-4">あとで変更できます</p>

              <input
                type="text"
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value.slice(0, 12))}
                placeholder="1〜12文字で入力"
                className="w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                maxLength={12}
              />
              <p className="text-right text-xs text-gray-400 mt-1">{displayNameDraft.length}/12</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    vibrateLight();
                    if (isEditingDisplayName) {
                      setShowDisplayNameModal(false);
                      setIsEditingDisplayName(false);
                      return;
                    }
                    handleSkipDisplayName();
                  }}
                  className="py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold"
                >
                  {isEditingDisplayName ? 'キャンセル' : 'スキップ'}
                </button>
                <button
                  onClick={() => {
                    vibrateLight();
                    handleSaveDisplayName();
                  }}
                  disabled={!displayNameDraft.trim()}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:text-gray-400 text-white font-bold"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* シェアモーダル */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </main>
  );
};

// ===== Main Component =====

export default function Home() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
