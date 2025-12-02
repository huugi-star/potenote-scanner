/**
 * Potenote Scanner v2 - Game Store
 * 
 * Zustand + Persist による状態管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserState, EquippedItems, QuizResult, GachaResult, Flag, Coordinate, QuizRaw, QuizHistory, Island, StructuredOCR, TranslationResult, TranslationHistory } from '@/types';
import { ALL_ITEMS, getItemById } from '@/data/items';
import { REWARDS, DISTANCE, LIMITS, GACHA, STAMINA, ERROR_MESSAGES } from '@/lib/constants';
import { calculateSpiralPosition } from '@/lib/mapUtils';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit as fsLimit } from 'firebase/firestore';

// ===== Helper Functions =====

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const randomInRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

const weightedRandom = <T extends { dropWeight: number }>(items: T[]): T => {
  const totalWeight = items.reduce((sum, item) => sum + item.dropWeight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.dropWeight;
    if (random <= 0) {
      return item;
    }
  }
  
  return items[items.length - 1];
};

// ===== Store Types =====

interface GameState extends UserState {
  journey: {
    totalDistance: number;
    flags: Flag[];
    currentPosition: Coordinate;
    islands: Island[];
  };
  
  gachaPity: {
    srCounter: number;
    ssrCounter: number;
  };
  
  hasLaunched: boolean;
  
  // クイズ履歴（フリークエスト用）
  quizHistory: QuizHistory[];
  
  // 翻訳履歴
  translationHistory: TranslationHistory[];
  
  // スキャンタイプと翻訳結果
  scanType: 'quiz' | 'translation';
  translationResult: TranslationResult | null;
  
  // 生成されたクイズ（ページ更新後も保持）
  generatedQuiz: QuizRaw | null;
  scanImageUrl: string | null;
  scanOcrText: string | undefined;
  scanStructuredOCR: StructuredOCR | undefined;
  
  // スキャン時に保存したクイズの quizId（重複防止用）
  lastScanQuizId: string | null;
}

interface GameActions {
  loginCheck: () => { isNewDay: boolean; bonusCoins: number };
  
  checkScanLimit: () => { canScan: boolean; remaining: number; error?: string };
  incrementScanCount: () => void;
  recoverScanCount: () => void;
  
  checkFreeQuestGenerationLimit: () => { canGenerate: boolean; remaining: number; error?: string };
  incrementFreeQuestGenerationCount: () => void;
  recoverFreeQuestGenerationCount: () => void;
  
  checkTranslationLimit: () => { canTranslate: boolean; remaining: number; error?: string };
  incrementTranslationCount: () => void;
  
  setScanType: (type: 'quiz' | 'translation') => void;
  setTranslationResult: (result: TranslationResult | null) => void;
  
  // 生成されたクイズの保存・取得
  setGeneratedQuiz: (quiz: QuizRaw | null, imageUrl?: string | null, ocrText?: string, structuredOCR?: StructuredOCR) => void;
  clearGeneratedQuiz: () => void;
  
  // 翻訳履歴管理
  saveTranslationHistory: (result: TranslationResult, imageUrl?: string) => void;
  getTranslationHistory: () => TranslationHistory[];
  deleteTranslationHistory: (id: string) => void;
  
  calculateResult: (correctCount: number, totalQuestions: number, isAdWatched: boolean) => QuizResult;
  applyQuizResult: (result: QuizResult) => void;
  
  // クイズ履歴
  saveQuizHistory: (quiz: QuizRaw, result: QuizResult, ocrText?: string, structuredOCR?: StructuredOCR) => Promise<void>;
  getQuizHistory: () => QuizHistory[];
  updateQuizHistoryUsedIndices: (historyId: string, newIndices: number[]) => void;
  addQuestionsToHistory: (historyId: string, newQuestions: QuizHistory['quiz']['questions']) => void;
  
  pullGacha: (useTicket?: boolean) => GachaResult | { error: string };
  pullGachaTen: () => GachaResult[] | { error: string };
  
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addTickets: (amount: number) => void;
  useTicket: () => boolean;
  useStamina: (amount?: number) => boolean;
  recoverStamina: (amount?: number) => void;
  
  addItem: (itemId: string, quantity?: number) => void;
  removeItem: (itemId: string, quantity?: number) => boolean;
  equipItem: (itemId: string) => boolean;
  unequipItem: (category: keyof EquippedItems) => void;
  
  activateVIP: (expiresAt: Date) => void;
  deactivateVIP: () => void;
  checkVIPStatus: () => boolean;
  
  addFlag: (quizId: string, keywords: string[], earnedDistance: number) => Flag;
  checkAndUnlockIsland: () => Island | null;
  
  setHasLaunched: () => void;
  
  reset: () => void;

  // ===== Auth & Cloud Sync =====
  setUserId: (uid: string | null) => Promise<void>;
  syncWithCloud: () => Promise<void>;
}

type GameStore = GameState & GameActions;

// ===== Initial State =====

const initialState: GameState = {
  uid: null,
  coins: 0,
  tickets: 0,
  stamina: STAMINA.MAX,
  
  isVIP: false,
  vipExpiresAt: undefined,
  
  dailyScanCount: 0,
  lastScanDate: '',
  dailyFreeQuestGenerationCount: 0,
  lastFreeQuestGenerationDate: '',
  dailyTranslationCount: 0,
  lastTranslationDate: '',
  
  lastLoginDate: '',
  consecutiveLoginDays: 0,
  
  totalScans: 0,
  totalQuizzes: 0,
  totalCorrectAnswers: 0,
  totalDistance: 0,
  totalQuizClears: 0,
  
  inventory: [],
  equipment: {},
  
  journey: {
    totalDistance: 0,
    flags: [],
    currentPosition: { x: 0, y: 0 },
    islands: [],
  },
  
  gachaPity: {
    srCounter: 0,
    ssrCounter: 0,
  },
  
  hasLaunched: false,
  
  quizHistory: [],
  
  translationHistory: [],
  
  scanType: 'quiz',
  translationResult: null,
  
  generatedQuiz: null,
  scanImageUrl: null,
  scanOcrText: undefined,
  scanStructuredOCR: undefined,
  
  lastScanQuizId: null,
};

// ===== Store Implementation =====

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // ===== Auth & Cloud Sync =====
      
      setUserId: async (uid) => {
        // ローカルのUIDを更新
        set({ uid });

        if (!uid || !db) return;

        try {
          const userRef = doc(db, 'users', uid);
          const snap = await getDoc(userRef);
          const state = get();

          if (snap.exists()) {
            const cloudData = snap.data() as any;

            // ログインボーナスチェック前に lastLoginDate を保存（上書きを防ぐため）
            const currentLastLoginDate = state.lastLoginDate;
            const today = getTodayString();
            
            set({
              // ユーザー状態系（努力の結晶のみ）
              uid,
              coins: cloudData.userState?.coins ?? state.coins,
              tickets: cloudData.userState?.tickets ?? state.tickets,
              stamina: cloudData.userState?.stamina ?? state.stamina,
              isVIP: cloudData.userState?.isVIP ?? state.isVIP,
              vipExpiresAt: cloudData.userState?.vipExpiresAt
                ? new Date(cloudData.userState.vipExpiresAt)
                : state.vipExpiresAt,
              dailyScanCount: cloudData.userState?.dailyScanCount ?? state.dailyScanCount,
              lastScanDate: cloudData.userState?.lastScanDate ?? state.lastScanDate,
              dailyFreeQuestGenerationCount:
                cloudData.userState?.dailyFreeQuestGenerationCount ?? state.dailyFreeQuestGenerationCount,
              lastFreeQuestGenerationDate:
                cloudData.userState?.lastFreeQuestGenerationDate ?? state.lastFreeQuestGenerationDate,
              dailyTranslationCount:
                cloudData.userState?.dailyTranslationCount ?? state.dailyTranslationCount,
              lastTranslationDate:
                cloudData.userState?.lastTranslationDate ?? state.lastTranslationDate,
              // ログインボーナスが既に付与されている場合は、lastLoginDate を上書きしない
              lastLoginDate: (currentLastLoginDate === today) ? currentLastLoginDate : (cloudData.userState?.lastLoginDate ?? state.lastLoginDate),
              consecutiveLoginDays:
                cloudData.userState?.consecutiveLoginDays ?? state.consecutiveLoginDays,
              totalScans: cloudData.userState?.totalScans ?? state.totalScans,
              totalQuizzes: cloudData.userState?.totalQuizzes ?? state.totalQuizzes,
              totalCorrectAnswers:
                cloudData.userState?.totalCorrectAnswers ?? state.totalCorrectAnswers,
              totalDistance: cloudData.userState?.totalDistance ?? state.totalDistance,
              totalQuizClears:
                cloudData.userState?.totalQuizClears ?? state.totalQuizClears,

              // インベントリ系
              inventory: cloudData.inventory ?? state.inventory,
              equipment: cloudData.equipment ?? state.equipment,

              // マップ／旅路
              journey: cloudData.journey ?? state.journey,

              // 生成されたクイズは保持（クラウドには保存しないが、ローカルでは保持）
              generatedQuiz: state.generatedQuiz,
              scanImageUrl: state.scanImageUrl,
              scanOcrText: state.scanOcrText,
              scanStructuredOCR: state.scanStructuredOCR,

              // 履歴はこの後サブコレクションから読み込む
            });

            // ===== 履歴サブコレクションの読み込み =====
            try {
              // クイズ履歴（クラウドは最新30件まで）
              const quizCol = collection(db, 'users', uid, 'quiz_history');
              const quizSnap = await getDocs(
                query(quizCol, orderBy('createdAt', 'desc'), fsLimit(30))
              );
              const cloudQuizHistory: QuizHistory[] = quizSnap.docs.map(
                (d) => d.data() as QuizHistory
              );

              // 翻訳履歴（クラウドは最新30件まで）
              const transCol = collection(db, 'users', uid, 'translation_history');
              const transSnap = await getDocs(
                query(transCol, orderBy('createdAt', 'desc'), fsLimit(30))
              );
              const cloudTranslationHistory: TranslationHistory[] = transSnap.docs.map(
                (d) => d.data() as TranslationHistory
              );

              // 既存ローカル履歴とクラウド履歴をマージ（IDベースで重複除去）
              const currentState = get();

              const mergedQuizHistory: QuizHistory[] = [
                ...cloudQuizHistory,
                ...currentState.quizHistory.filter(
                  (local) => !cloudQuizHistory.some((cloud) => cloud.id === local.id)
                ),
              ];

              const mergedTranslationHistory: TranslationHistory[] = [
                ...cloudTranslationHistory,
                ...currentState.translationHistory.filter(
                  (local) => !cloudTranslationHistory.some((cloud) => cloud.id === local.id)
                ),
              ];

              set({
                quizHistory: mergedQuizHistory,
                translationHistory: mergedTranslationHistory,
              });
            } catch (historyError) {
              console.error('Cloud history load error:', historyError);
            }
          } else {
            // 初回ログイン: 現在のローカル状態をクラウドへ
            await get().syncWithCloud();
          }
        } catch (error) {
          console.error('Cloud Load Error:', error);
        }
      },

      syncWithCloud: async () => {
        const state = get();
        if (!db || !state.uid) return;

        try {
          const userRef = doc(db, 'users', state.uid);
          const now = new Date().toISOString();

          await setDoc(
            userRef,
            {
              userState: {
                uid: state.uid,
                coins: state.coins,
                tickets: state.tickets,
                stamina: state.stamina,
                isVIP: state.isVIP,
                vipExpiresAt: state.vipExpiresAt
                  ? state.vipExpiresAt.toISOString?.() ?? state.vipExpiresAt
                  : null,
                dailyScanCount: state.dailyScanCount,
                lastScanDate: state.lastScanDate,
                dailyFreeQuestGenerationCount:
                  state.dailyFreeQuestGenerationCount,
                lastFreeQuestGenerationDate:
                  state.lastFreeQuestGenerationDate,
                dailyTranslationCount: state.dailyTranslationCount,
                lastTranslationDate: state.lastTranslationDate,
                lastLoginDate: state.lastLoginDate,
                consecutiveLoginDays: state.consecutiveLoginDays,
                totalScans: state.totalScans,
                totalQuizzes: state.totalQuizzes,
                totalCorrectAnswers: state.totalCorrectAnswers,
                totalDistance: state.totalDistance,
                totalQuizClears: state.totalQuizClears,
              },
              inventory: state.inventory,
              equipment: state.equipment,
              journey: state.journey,
              updatedAt: now,
            },
            { merge: true }
          );
          console.log('Data synced to cloud');
        } catch (error) {
          console.error('Cloud Sync Error:', error);
        }
      },
      
      // ===== Login & Daily Reset =====
      
      loginCheck: () => {
        const state = get();
        const today = getTodayString();
        const isNewDay = state.lastLoginDate !== today;
        
        // 始まりの島がなければ追加
        if (state.journey.islands.length === 0) {
          set({
            journey: {
              ...state.journey,
              islands: [{
                id: 0,
                distance: 0,
                name: '始まりの島',
                keywords: [],
                unlockedAt: new Date().toISOString(),
              }],
            },
          });
        }
        
        if (!isNewDay) {
          return { isNewDay: false, bonusCoins: 0 };
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];
        const isConsecutive = state.lastLoginDate === yesterdayString;
        
        const bonusCoins = state.isVIP 
          ? REWARDS.LOGIN_BONUS.VIP_COINS 
          : REWARDS.LOGIN_BONUS.FREE_COINS;
        
        set({
          lastLoginDate: today,
          lastScanDate: today,
          dailyScanCount: 0,
          consecutiveLoginDays: isConsecutive ? state.consecutiveLoginDays + 1 : 1,
          coins: state.coins + bonusCoins,
        });
        
        // ログイン時の状態をクラウドに保存
        get().syncWithCloud();

        return { isNewDay: true, bonusCoins };
      },
      
      // ===== Scan Management =====
      
      checkScanLimit: () => {
        const state = get();
        const today = getTodayString();
        
        if (state.lastScanDate !== today) {
          set({ dailyScanCount: 0, lastScanDate: today });
          return { 
            canScan: true, 
            remaining: state.isVIP ? Infinity : LIMITS.FREE_USER.DAILY_SCAN_LIMIT 
          };
        }
        
        if (state.isVIP) {
          return { canScan: true, remaining: Infinity };
        }
        
        const remaining = LIMITS.FREE_USER.DAILY_SCAN_LIMIT - state.dailyScanCount;
        
        if (remaining <= 0) {
          return { 
            canScan: false, 
            remaining: 0, 
            error: ERROR_MESSAGES.SCAN_LIMIT_REACHED 
          };
        }
        
        return { canScan: true, remaining };
      },
      
      incrementScanCount: () => {
        const state = get();
        set({
          dailyScanCount: state.dailyScanCount + 1,
          totalScans: state.totalScans + 1,
        });
        get().syncWithCloud();
      },
      
      recoverScanCount: () => {
        const state = get();
        const newCount = Math.max(0, state.dailyScanCount - REWARDS.AD_REWARDS.SCAN_RECOVERY_COUNT);
        set({ dailyScanCount: newCount });
        get().syncWithCloud();
      },
      
      // ===== Free Quest Generation Management =====
      
      checkFreeQuestGenerationLimit: () => {
        const state = get();
        const today = getTodayString();
        
        if (state.lastFreeQuestGenerationDate !== today) {
          set({ dailyFreeQuestGenerationCount: 0, lastFreeQuestGenerationDate: today });
          const limit = state.isVIP 
            ? LIMITS.VIP_USER.DAILY_FREE_QUEST_GENERATION_LIMIT 
            : LIMITS.FREE_USER.DAILY_FREE_QUEST_GENERATION_LIMIT;
          return { 
            canGenerate: true, 
            remaining: limit 
          };
        }
        
        const limit = state.isVIP 
          ? LIMITS.VIP_USER.DAILY_FREE_QUEST_GENERATION_LIMIT 
          : LIMITS.FREE_USER.DAILY_FREE_QUEST_GENERATION_LIMIT;
        const remaining = limit - state.dailyFreeQuestGenerationCount;
        
        if (remaining <= 0) {
          return { 
            canGenerate: false, 
            remaining: 0, 
            error: ERROR_MESSAGES.FREE_QUEST_GENERATION_LIMIT_REACHED 
          };
        }
        
        return { canGenerate: true, remaining };
      },
      
      incrementFreeQuestGenerationCount: () => {
        const state = get();
        set({
          dailyFreeQuestGenerationCount: state.dailyFreeQuestGenerationCount + 1,
        });
      },
      
      recoverFreeQuestGenerationCount: () => {
        const state = get();
        const newCount = Math.max(0, state.dailyFreeQuestGenerationCount - REWARDS.AD_REWARDS.FREE_QUEST_GENERATION_RECOVERY_COUNT);
        set({ dailyFreeQuestGenerationCount: newCount });
      },
      
      // ===== Translation Management =====
      
      checkTranslationLimit: () => {
        const state = get();
        const today = getTodayString();
        
        if (state.lastTranslationDate !== today) {
          set({ dailyTranslationCount: 0, lastTranslationDate: today });
          const limit = state.isVIP 
            ? LIMITS.VIP_USER.DAILY_TRANSLATION_LIMIT 
            : LIMITS.FREE_USER.DAILY_TRANSLATION_LIMIT;
          return { 
            canTranslate: true, 
            remaining: limit === Infinity ? Infinity : limit 
          };
        }
        
        if (state.isVIP) {
          return { canTranslate: true, remaining: Infinity };
        }
        
        const remaining = LIMITS.FREE_USER.DAILY_TRANSLATION_LIMIT - state.dailyTranslationCount;
        
        if (remaining <= 0) {
          return { 
            canTranslate: false, 
            remaining: 0, 
            error: ERROR_MESSAGES.TRANSLATION_LIMIT_REACHED 
          };
        }
        
        return { canTranslate: true, remaining };
      },
      
      incrementTranslationCount: () => {
        const state = get();
        set({
          dailyTranslationCount: state.dailyTranslationCount + 1,
        });
      },
      
      setScanType: (type) => {
        set({ scanType: type });
      },
      
      setTranslationResult: (result) => {
        set({ translationResult: result });
      },
      
      // 生成されたクイズの保存
      setGeneratedQuiz: (quiz, imageUrl, ocrText, structuredOCR) => {
        set({
          generatedQuiz: quiz,
          scanImageUrl: imageUrl ?? null,
          scanOcrText: ocrText,
          scanStructuredOCR: structuredOCR,
        });
      },
      
      // スキャン時に保存した quizId を記録
      setLastScanQuizId: (quizId: string | null) => {
        set({ lastScanQuizId: quizId });
      },
      
      // 生成されたクイズのクリア
      clearGeneratedQuiz: () => {
        set({
          generatedQuiz: null,
          scanImageUrl: null,
          scanOcrText: undefined,
          scanStructuredOCR: undefined,
        });
      },
      
      // ===== Translation History Management =====
      
      saveTranslationHistory: (result, imageUrl) => {
        const state = get();
        
        // 重複チェック: 同じ内容の翻訳が既に存在する場合は追加しない
        const isDuplicate = state.translationHistory.some(
          (history) =>
            history.originalText === result.originalText &&
            history.translatedText === result.translatedText
        );
        
        if (isDuplicate) {
          console.log('Translation history duplicate detected, skipping save');
          return;
        }
        
        const newHistory: TranslationHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          originalText: result.originalText,
          translatedText: result.translatedText,
          createdAt: new Date().toISOString(),
          imageUrl,
        };
        set({
          translationHistory: [newHistory, ...state.translationHistory],
        });

        // クラウドにも保存（テキストのみなので軽量）
        if (db && state.uid) {
          (async () => {
            try {
              const colRef = collection(db, 'users', state.uid!, 'translation_history');
              await setDoc(doc(colRef, newHistory.id), newHistory, { merge: true });
            } catch (e) {
              console.error('Cloud translation history save error:', e);
            }
          })();
        }
      },
      
      getTranslationHistory: () => {
        return get().translationHistory;
      },
      
      deleteTranslationHistory: (id) => {
        const state = get();
        set({
          translationHistory: state.translationHistory.filter(h => h.id !== id),
        });
      },
      
      // ===== Quiz & Rewards =====
      
      calculateResult: (correctCount, totalQuestions, isAdWatched) => {
        const state = get();
        const isPerfect = correctCount === totalQuestions;
        
        let baseCoins = REWARDS.QUEST_CLEAR.BASE_COINS;
        if (isPerfect) {
          baseCoins += REWARDS.QUEST_CLEAR.PERFECT_BONUS;
        }
        
        const shouldDouble = state.isVIP || isAdWatched;
        const earnedCoins = shouldDouble ? baseCoins * 2 : baseCoins;
        
        const scanBaseDistance = randomInRange(DISTANCE.SCAN_BASE.MIN, DISTANCE.SCAN_BASE.MAX);
        const correctBonus = correctCount * DISTANCE.CORRECT_ANSWER;
        const perfectBonus = isPerfect ? DISTANCE.PERFECT_BONUS : 0;
        const earnedDistance = scanBaseDistance + correctBonus + perfectBonus;
        
        return {
          quizId: `quiz_${Date.now()}`,
          correctCount,
          totalQuestions,
          isPerfect,
          earnedCoins,
          earnedDistance: Math.round(earnedDistance * 100) / 100,
          isDoubled: shouldDouble,
          timestamp: new Date(),
        };
      },
      
      applyQuizResult: (result) => {
        const state = get();
        set({
          coins: state.coins + result.earnedCoins,
          totalQuizzes: state.totalQuizzes + 1,
          totalCorrectAnswers: state.totalCorrectAnswers + result.correctCount,
          totalDistance: state.totalDistance + result.earnedDistance,
          totalQuizClears: state.totalQuizClears + 1,
          journey: {
            ...state.journey,
            totalDistance: state.journey.totalDistance + result.earnedDistance,
          },
        });
      },
      
      // ===== Quiz History =====
      
      saveQuizHistory: async (quiz, result, ocrText, structuredOCR) => {
        const state = get();
        
        // スキャン時に保存した quizId が存在し、それが結果画面で保存しようとしている quizId と一致する場合は、既存の履歴を更新する
        let targetQuizId = result.quizId;
        const existingHistoryIndex = state.quizHistory.findIndex(h => h.id === state.lastScanQuizId);
        
        let history: QuizHistory;
        
        if (state.lastScanQuizId && existingHistoryIndex >= 0) {
          // 既存の履歴を更新（スキャン時のテンプレートを結果で上書き）
          targetQuizId = state.lastScanQuizId;
          const updatedHistory = [...state.quizHistory];
          updatedHistory[existingHistoryIndex] = {
            ...updatedHistory[existingHistoryIndex],
            quiz,
            result: {
              ...result,
              quizId: targetQuizId, // quizId を統一
            },
            ocrText: ocrText ?? updatedHistory[existingHistoryIndex].ocrText,
            structuredOCR: structuredOCR ?? updatedHistory[existingHistoryIndex].structuredOCR,
          };
          set({ 
            quizHistory: updatedHistory,
            lastScanQuizId: null, // 使用したのでクリア
          });
          history = updatedHistory[existingHistoryIndex];
        } else {
          // 新規保存
          history = {
            id: targetQuizId,
            quiz,
            result: {
              ...result,
              quizId: targetQuizId,
            },
            createdAt: new Date().toISOString(),
            usedQuestionIndices: [],
            ocrText,
            structuredOCR, // 構造化OCRを保存（位置情報付き）
          };
          
          // 端末ローカルでは履歴を無制限に保持（クラウド側で最新件数を制御）
          const newHistory = [history, ...state.quizHistory];
          set({ quizHistory: newHistory });
        }

        // クラウドにも保存（テキスト＋スコア程度なので軽量）
        // uid がストアにまだ反映されていない場合でも、Firebase Auth の currentUser から取得して保存を試みる
        const effectiveUid = state.uid ?? auth?.currentUser?.uid ?? null;
        
        // デバッグログ
        console.log('[saveQuizHistory] Debug:', {
          stateUid: state.uid,
          authCurrentUserUid: auth?.currentUser?.uid,
          effectiveUid,
          dbExists: !!db,
          historyId: history.id,
          isUpdate: state.lastScanQuizId && existingHistoryIndex >= 0,
        });

        if (db && effectiveUid) {
          try {
            const colRef = collection(db, 'users', effectiveUid, 'quiz_history');
            console.log('[saveQuizHistory] Attempting to save to Firestore:', {
              path: `users/${effectiveUid}/quiz_history/${history.id}`,
            });
            
            // Firestore は undefined をサポートしていないため、undefined のフィールドを削除
            const historyForFirestore: any = {
              id: history.id,
              quiz: history.quiz,
              result: {
                quizId: history.result.quizId,
                correctCount: history.result.correctCount,
                totalQuestions: history.result.totalQuestions,
                isPerfect: history.result.isPerfect,
                earnedCoins: history.result.earnedCoins,
                earnedDistance: history.result.earnedDistance,
                isDoubled: history.result.isDoubled,
                timestamp: history.result.timestamp.toISOString?.() ?? history.result.timestamp,
              },
              createdAt: history.createdAt,
              usedQuestionIndices: history.usedQuestionIndices,
            };
            
            // undefined でない場合のみ追加
            if (history.ocrText !== undefined) {
              historyForFirestore.ocrText = history.ocrText;
            }
            if (history.structuredOCR !== undefined) {
              historyForFirestore.structuredOCR = history.structuredOCR;
            }
            
            await setDoc(doc(colRef, history.id), historyForFirestore, { merge: true });
            console.log('[saveQuizHistory] Successfully saved to Firestore!');
          } catch (e) {
            console.error('[saveQuizHistory] Cloud quiz history save error:', e);
          }
        } else {
          console.warn('[saveQuizHistory] Skipping cloud save:', {
            db: !!db,
            effectiveUid,
          });
        }
      },
      
      getQuizHistory: () => {
        return get().quizHistory;
      },
      
      // フリークエスト用: 出題済みインデックスを更新
      updateQuizHistoryUsedIndices: (historyId: string, newIndices: number[]) => {
        const state = get();
        const updated = state.quizHistory.map(h => 
          h.id === historyId 
            ? { ...h, usedQuestionIndices: [...(h.usedQuestionIndices || []), ...newIndices] }
            : h
        );
        set({ quizHistory: updated });
      },

      // フリークエスト用: 新しい問題を履歴に追加（再挑戦用）
      addQuestionsToHistory: (historyId: string, newQuestions: QuizHistory['quiz']['questions']) => {
        const state = get();
        const updated = state.quizHistory.map(h => {
          if (h.id !== historyId) return h;
          // 既存の問題と新しい問題を結合（重複除去）
          const existingQs = h.quiz.questions.map(q => q.q);
          const uniqueNewQs = newQuestions.filter(q => !existingQs.includes(q.q));
          return {
            ...h,
            quiz: {
              ...h.quiz,
              questions: [...h.quiz.questions, ...uniqueNewQs],
            },
          };
        });
        set({ quizHistory: updated });
      },
      
      // ===== Gacha =====
      
      pullGacha: (useTicket = false) => {
        const state = get();
        
        if (useTicket) {
          if (state.tickets < 1) {
            return { error: ERROR_MESSAGES.INSUFFICIENT_TICKETS };
          }
        } else {
          if (state.coins < GACHA.COST.SINGLE) {
            return { error: ERROR_MESSAGES.INSUFFICIENT_COINS };
          }
        }
        
        let guaranteedRarity: 'SR' | 'SSR' | null = null;
        const newSrCounter = state.gachaPity.srCounter + 1;
        const newSsrCounter = state.gachaPity.ssrCounter + 1;
        
        if (newSsrCounter >= GACHA.PITY.SSR_GUARANTEE) {
          guaranteedRarity = 'SSR';
        } else if (newSrCounter >= GACHA.PITY.SR_GUARANTEE) {
          guaranteedRarity = 'SR';
        }
        
        let selectedRarity: 'N' | 'R' | 'SR' | 'SSR';
        
        if (guaranteedRarity === 'SSR') {
          selectedRarity = 'SSR';
        } else if (guaranteedRarity === 'SR') {
          const roll = Math.random() * (GACHA.RATES.SR + GACHA.RATES.SSR);
          selectedRarity = roll < GACHA.RATES.SSR ? 'SSR' : 'SR';
        } else {
          const roll = Math.random() * 100;
          if (roll < GACHA.RATES.SSR) {
            selectedRarity = 'SSR';
          } else if (roll < GACHA.RATES.SSR + GACHA.RATES.SR) {
            selectedRarity = 'SR';
          } else if (roll < GACHA.RATES.SSR + GACHA.RATES.SR + GACHA.RATES.R) {
            selectedRarity = 'R';
          } else {
            selectedRarity = 'N';
          }
        }
        
        const itemsOfRarity = ALL_ITEMS.filter(item => item.rarity === selectedRarity);
        const selectedItem = weightedRandom(itemsOfRarity);
        
        const existingItem = state.inventory.find(inv => inv.itemId === selectedItem.id);
        const isNew = !existingItem;
        
        const updatedPity = {
          srCounter: selectedRarity === 'SR' || selectedRarity === 'SSR' ? 0 : newSrCounter,
          ssrCounter: selectedRarity === 'SSR' ? 0 : newSsrCounter,
        };
        
        const newInventory = [...state.inventory];
        if (existingItem) {
          const index = newInventory.findIndex(inv => inv.itemId === selectedItem.id);
          newInventory[index] = {
            ...existingItem,
            quantity: Math.min(existingItem.quantity + 1, LIMITS.INVENTORY.MAX_STACK),
          };
        } else {
          newInventory.push({
            itemId: selectedItem.id,
            quantity: 1,
            obtainedAt: new Date(),
          });
        }
        
        set({
          coins: useTicket ? state.coins : state.coins - GACHA.COST.SINGLE,
          tickets: useTicket ? state.tickets - 1 : state.tickets,
          inventory: newInventory,
          gachaPity: updatedPity,
        });
        
        return {
          item: selectedItem,
          isNew,
          timestamp: new Date(),
        };
      },
      
      pullGachaTen: () => {
        const state = get();
        
        if (state.coins < GACHA.COST.TEN_PULL) {
          return { error: ERROR_MESSAGES.INSUFFICIENT_COINS };
        }
        
        const results: GachaResult[] = [];
        set({ coins: state.coins - GACHA.COST.TEN_PULL });
        
        for (let i = 0; i < 10; i++) {
          const tempCoins = get().coins;
          set({ coins: tempCoins + GACHA.COST.SINGLE });
          
          const result = get().pullGacha(false);
          
          if (!('error' in result)) {
            results.push(result);
          }
        }
        
        return results;
      },
      
      // ===== Resource Management =====
      
      addCoins: (amount) => {
        set(state => ({ coins: state.coins + amount }));
      },
      
      spendCoins: (amount) => {
        const state = get();
        if (state.coins < amount) {
          return false;
        }
        set({ coins: state.coins - amount });
        return true;
      },
      
      addTickets: (amount) => {
        set(state => ({ tickets: state.tickets + amount }));
      },
      
      useTicket: () => {
        const state = get();
        if (state.tickets < 1) {
          return false;
        }
        set({ tickets: state.tickets - 1 });
        return true;
      },
      
      useStamina: (amount = STAMINA.QUIZ_COST) => {
        const state = get();
        if (state.stamina < amount) {
          return false;
        }
        set({ stamina: state.stamina - amount });
        return true;
      },
      
      recoverStamina: (amount = 1) => {
        set(state => ({
          stamina: Math.min(state.stamina + amount, STAMINA.MAX),
        }));
      },
      
      // ===== Inventory & Equipment =====
      
      addItem: (itemId, quantity = 1) => {
        const state = get();
        const existingItem = state.inventory.find(inv => inv.itemId === itemId);
        
        if (existingItem) {
          const newQuantity = Math.min(
            existingItem.quantity + quantity,
            LIMITS.INVENTORY.MAX_STACK
          );
          set({
            inventory: state.inventory.map(inv =>
              inv.itemId === itemId
                ? { ...inv, quantity: newQuantity }
                : inv
            ),
          });
        } else {
          set({
            inventory: [
              ...state.inventory,
              { itemId, quantity, obtainedAt: new Date() },
            ],
          });
        }
      },
      
      removeItem: (itemId, quantity = 1) => {
        const state = get();
        const existingItem = state.inventory.find(inv => inv.itemId === itemId);
        
        if (!existingItem || existingItem.quantity < quantity) {
          return false;
        }
        
        const newQuantity = existingItem.quantity - quantity;
        
        if (newQuantity <= 0) {
          set({
            inventory: state.inventory.filter(inv => inv.itemId !== itemId),
          });
        } else {
          set({
            inventory: state.inventory.map(inv =>
              inv.itemId === itemId
                ? { ...inv, quantity: newQuantity }
                : inv
            ),
          });
        }
        
        return true;
      },
      
      equipItem: (itemId) => {
        const state = get();
        const item = getItemById(itemId);
        
        if (!item || item.type !== 'equipment' || !item.category) {
          return false;
        }
        
        const hasItem = state.inventory.some(inv => inv.itemId === itemId);
        if (!hasItem) {
          return false;
        }
        
        set({
          equipment: {
            ...state.equipment,
            [item.category]: itemId,
          },
        });
        
        return true;
      },
      
      unequipItem: (category) => {
        set(state => ({
          equipment: {
            ...state.equipment,
            [category]: undefined,
          },
        }));
      },
      
      // ===== VIP =====
      
      activateVIP: (expiresAt) => {
        set({
          isVIP: true,
          vipExpiresAt: expiresAt,
        });
      },
      
      deactivateVIP: () => {
        set({
          isVIP: false,
          vipExpiresAt: undefined,
        });
      },
      
      checkVIPStatus: () => {
        const state = get();
        
        if (!state.isVIP) {
          return false;
        }
        
        if (state.vipExpiresAt && new Date(state.vipExpiresAt) < new Date()) {
          get().deactivateVIP();
          return false;
        }
        
        return true;
      },
      
      // ===== Map & Journey =====
      
      addFlag: (quizId, keywords, earnedDistance) => {
        const state = get();
        const newTotalDistance = state.journey.totalDistance + earnedDistance;
        const newPosition = calculateSpiralPosition(newTotalDistance);
        
        const flag: Flag = {
          id: `flag_${Date.now()}`,
          quizId,
          keywords,
          position: newPosition,
          distance: newTotalDistance,
          createdAt: new Date(),
        };
        
        set({
          journey: {
            ...state.journey,
            totalDistance: newTotalDistance,
            flags: [...state.journey.flags, flag],
            currentPosition: newPosition,
          },
        });
        
        return flag;
      },
      
      checkAndUnlockIsland: () => {
        const state = get();
        const currentDistance = state.journey.totalDistance;
        const islandCount = state.journey.islands.length;
        const nextIslandDistance = islandCount * 100; // 100km毎に新しい島
        
        if (currentDistance >= nextIslandDistance) {
          // 最新のフラッグからキーワードを取得
          const recentFlags = state.journey.flags.slice(-5);
          const keywords = recentFlags.flatMap(f => f.keywords).slice(0, 3);
          
          const newIsland: Island = {
            id: islandCount,
            distance: nextIslandDistance,
            name: `島 ${islandCount + 1}`,
            keywords,
            unlockedAt: new Date().toISOString(),
          };
          
          set({
            journey: {
              ...state.journey,
              islands: [...state.journey.islands, newIsland],
            },
          });
          
          return newIsland;
        }
        
        return null;
      },
      
      // ===== Onboarding =====
      
      setHasLaunched: () => {
        set({ hasLaunched: true });
      },
      
      // ===== Utility =====
      
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'potenote-scanner-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        coins: state.coins,
        tickets: state.tickets,
        stamina: state.stamina,
        isVIP: state.isVIP,
        vipExpiresAt: state.vipExpiresAt,
        dailyScanCount: state.dailyScanCount,
        lastScanDate: state.lastScanDate,
        dailyFreeQuestGenerationCount: state.dailyFreeQuestGenerationCount,
        lastFreeQuestGenerationDate: state.lastFreeQuestGenerationDate,
        dailyTranslationCount: state.dailyTranslationCount,
        lastTranslationDate: state.lastTranslationDate,
        lastLoginDate: state.lastLoginDate,
        consecutiveLoginDays: state.consecutiveLoginDays,
        totalScans: state.totalScans,
        totalQuizzes: state.totalQuizzes,
        totalCorrectAnswers: state.totalCorrectAnswers,
        totalDistance: state.totalDistance,
        totalQuizClears: state.totalQuizClears,
        inventory: state.inventory,
        equipment: state.equipment,
        journey: state.journey,
        gachaPity: state.gachaPity,
        hasLaunched: state.hasLaunched,
        quizHistory: state.quizHistory,
        translationHistory: state.translationHistory,
        scanType: state.scanType,
        translationResult: state.translationResult,
        generatedQuiz: state.generatedQuiz,
        scanImageUrl: state.scanImageUrl,
        scanOcrText: state.scanOcrText,
        scanStructuredOCR: state.scanStructuredOCR,
        lastScanQuizId: state.lastScanQuizId,
      }),
    }
  )
);

// ===== Selectors =====

export const selectIsVIP = (state: GameState) => state.isVIP;

export const selectCanScan = (state: GameState) => {
  if (state.isVIP) return true;
  const today = getTodayString();
  if (state.lastScanDate !== today) return true;
  return state.dailyScanCount < LIMITS.FREE_USER.DAILY_SCAN_LIMIT;
};

export const selectRemainingScanCount = (state: GameState) => {
  if (state.isVIP) return Infinity;
  const today = getTodayString();
  if (state.lastScanDate !== today) return LIMITS.FREE_USER.DAILY_SCAN_LIMIT;
  return Math.max(0, LIMITS.FREE_USER.DAILY_SCAN_LIMIT - state.dailyScanCount);
};

export const selectEquippedItemDetails = (state: GameState) => {
  const { equipment } = state;
  return {
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  };
};
