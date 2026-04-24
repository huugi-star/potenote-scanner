/**
 * Potenote Scanner v2 - Game Store
 * 
 * Zustand + Persist による状態管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserState, EquippedItems, QuizResult, GachaResult, Flag, Coordinate, QuizRaw, QuizHistory, Island, TranslationResult, TranslationHistory, LectureScript, LectureHistory, WordCollectionScan, WordEnemy, WordCollectionScanResult, QuizQuestionAttempt, WordDexDictionary, WordDexRelation, WordDexWord, AcademyUserQuestion } from '@/types';
import type {
  AnataZukanEntry,
  AnataZukanExtractedEntry,
  SuhimochiKeyword,
  SuhimochiTimelinePost,
} from '@/lib/suhimochiConversationTypes';
import type { GeminiMessage, SuhimochiRequest } from '@/lib/suhimochiConversationEngine'; 
import { ALL_ITEMS, getItemById } from '@/data/items';
import { ACADEMY_SEED_QUESTIONS } from '@/data/academySeedQuestions';
import { REWARDS, LIMITS, GACHA, STAMINA, ERROR_MESSAGES } from '@/lib/constants';
import { getJstDateString } from '@/lib/dateUtils';
import { extractWords } from '@/lib/wordExtraction';
import { calculateSpiralPosition } from '@/lib/mapUtils';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit as fsLimit, where, serverTimestamp } from 'firebase/firestore';

// ===== Helper Functions =====

const getTodayString = (): string => {
  return getJstDateString();
};

// ローカル環境判定（開発環境では制限を外す）
const isLocalDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development' || 
         (typeof window !== 'undefined' && window.location.hostname === 'localhost');
};

const LOGOUT_RECOVERY_STORAGE_KEY = 'potenote-scanner-logout-recovery-v1';

const canUseLocalStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const readLogoutRecoveryState = (uid: string): Record<string, unknown> | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(LOGOUT_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      uid?: string;
      state?: Record<string, unknown>;
    };
    if (!parsed || parsed.uid !== uid || !parsed.state || typeof parsed.state !== 'object') {
      return null;
    }
    return parsed.state;
  } catch (error) {
    console.warn('[logoutRecovery] failed to read local backup:', error);
    return null;
  }
};

const clearLogoutRecoveryState = (): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(LOGOUT_RECOVERY_STORAGE_KEY);
  } catch (error) {
    console.warn('[logoutRecovery] failed to clear local backup:', error);
  }
};

const hasMeaningfulStateForCloudSync = (
  state: Pick<
    GameState,
    | 'coins'
    | 'tickets'
    | 'inventory'
    | 'equipment'
    | 'journey'
    | 'quizHistory'
    | 'translationHistory'
    | 'lectureHistory'
    | 'wordCollectionScans'
    | 'totalScans'
    | 'totalQuizzes'
    | 'totalCorrectAnswers'
    | 'totalDistance'
    | 'totalQuizClears'
  >
): boolean => {
  const hasInventory = Array.isArray(state.inventory) && state.inventory.length > 0;
  const hasEquipment = Object.values(state.equipment ?? {}).some(Boolean);
  const hasJourneyProgress =
    Number(state.journey?.totalDistance ?? 0) > 0 ||
    (Array.isArray(state.journey?.flags) && state.journey.flags.length > 0) ||
    (Array.isArray(state.journey?.islands) && state.journey.islands.length > 1);
  const hasAnyHistory =
    (state.quizHistory?.length ?? 0) > 0 ||
    (state.translationHistory?.length ?? 0) > 0 ||
    (state.lectureHistory?.length ?? 0) > 0;
  const hasWordProgress = (state.wordCollectionScans?.length ?? 0) > 0;
  const hasCounters =
    Number(state.coins ?? 0) > 0 ||
    Number(state.tickets ?? 0) > 0 ||
    Number(state.totalScans ?? 0) > 0 ||
    Number(state.totalQuizzes ?? 0) > 0 ||
    Number(state.totalCorrectAnswers ?? 0) > 0 ||
    Number(state.totalDistance ?? 0) > 0 ||
    Number(state.totalQuizClears ?? 0) > 0;
  return hasInventory || hasEquipment || hasJourneyProgress || hasAnyHistory || hasWordProgress || hasCounters;
};

const shouldBlockCloudOverwriteAsEmpty = (state: GameState): boolean => {
  return !hasMeaningfulStateForCloudSync(state);
};

const isCloudDataClearlyEmpty = (data: {
  bonusScanBalance?: unknown;
  dailyScanCount?: unknown;
  lastScanDate?: unknown;
  coins?: number;
  tickets?: number;
  inventory?: GameState['inventory'];
  equipment?: GameState['equipment'];
  journey?: GameState['journey'];
  quizHistory?: QuizHistory[];
  translationHistory?: TranslationHistory[];
  lectureHistory?: LectureHistory[];
  wordCollectionScans?: WordCollectionScan[];
  totalScans?: number;
  totalQuizzes?: number;
  totalCorrectAnswers?: number;
  totalDistance?: number;
  totalQuizClears?: number;
} | null | undefined): boolean => {
  if (!data) return true;

  if (typeof data.bonusScanBalance === 'number' && data.bonusScanBalance > 0) return false;
  if (typeof data.dailyScanCount === 'number' && data.dailyScanCount > 0) return false;
  if (data.lastScanDate) return false;

  return !hasMeaningfulStateForCloudSync({
    coins: data.coins ?? 0,
    tickets: data.tickets ?? 0,
    inventory: data.inventory ?? [],
    equipment: data.equipment ?? {},
    journey: data.journey ?? initialState.journey,
    quizHistory: data.quizHistory ?? [],
    translationHistory: data.translationHistory ?? [],
    lectureHistory: data.lectureHistory ?? [],
    wordCollectionScans: data.wordCollectionScans ?? [],
    totalScans: data.totalScans ?? 0,
    totalQuizzes: data.totalQuizzes ?? 0,
    totalCorrectAnswers: data.totalCorrectAnswers ?? 0,
    totalDistance: data.totalDistance ?? 0,
    totalQuizClears: data.totalQuizClears ?? 0,
  });
};

const isClearlyEmptyRecoveryState = (state: Partial<GameState> | null | undefined): boolean => {
  if (!state) return true;
  const emptyCandidate = {
    coins: Number(state.coins ?? 0),
    tickets: Number(state.tickets ?? 0),
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    equipment: state.equipment ?? {},
    journey: state.journey ?? initialState.journey,
    quizHistory: Array.isArray(state.quizHistory) ? state.quizHistory : [],
    translationHistory: Array.isArray(state.translationHistory) ? state.translationHistory : [],
    lectureHistory: Array.isArray(state.lectureHistory) ? state.lectureHistory : [],
    wordCollectionScans: Array.isArray(state.wordCollectionScans) ? state.wordCollectionScans : [],
    totalScans: Number(state.totalScans ?? 0),
    totalQuizzes: Number(state.totalQuizzes ?? 0),
    totalCorrectAnswers: Number(state.totalCorrectAnswers ?? 0),
    totalDistance: Number(state.totalDistance ?? 0),
    totalQuizClears: Number(state.totalQuizClears ?? 0),
  };
  return !hasMeaningfulStateForCloudSync(emptyCandidate);
};

const ACADEMY_QUESTIONS_COLLECTION = 'academy_questions';
const ACADEMY_OFFICIAL_QUESTIONS_COLLECTION = 'academy_official_questions';
const ACADEMY_QUESTION_STATS_COLLECTION = 'academy_question_stats';
const ACADEMY_LOGS_COLLECTION = 'academy_logs';

let academyQuestionRefreshInFlight: Promise<void> | null = null;

const applyAcademyQuestionStats = (
  questions: AcademyUserQuestion[],
  statsMap: Map<string, {
    playCount: number;
    correctCount: number;
    goodCount: number;
    badCount: number;
    choicePick0: number;
    choicePick1: number;
    choicePick2: number;
    choicePick3: number;
  }>
): AcademyUserQuestion[] =>
  questions.map((q) => {
    const stats = statsMap.get(q.id);
    if (!stats) return q;
    return {
      ...q,
      playCount: Math.max(Number(q.playCount ?? 0), stats.playCount),
      correctCount: Math.max(Number(q.correctCount ?? 0), stats.correctCount),
      goodCount: Math.max(Number(q.goodCount ?? 0), stats.goodCount),
      badCount: Math.max(Number(q.badCount ?? 0), stats.badCount),
      choicePick0: Math.max(Number(q.choicePick0 ?? 0), stats.choicePick0),
      choicePick1: Math.max(Number(q.choicePick1 ?? 0), stats.choicePick1),
      choicePick2: Math.max(Number(q.choicePick2 ?? 0), stats.choicePick2),
      choicePick3: Math.max(Number(q.choicePick3 ?? 0), stats.choicePick3),
    };
  });

const getFirestoreErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    return typeof c === 'string' ? c : String(c ?? 'unknown');
  }
  return 'unknown';
};

const refreshAcademyQuestionsFromFirestore = async (): Promise<void> => {
  if (!db) {
    console.warn('[academy_questions] refresh skipped: db is null (setState not run)');
    return;
  }
  if (academyQuestionRefreshInFlight) {
    await academyQuestionRefreshInFlight;
    return;
  }

  academyQuestionRefreshInFlight = (async () => {
    try {
      const firestore = db;
      const [postedSnap, officialSnap] = await Promise.all([
        getDocs(
          query(
            collection(firestore, ACADEMY_QUESTIONS_COLLECTION),
            where('status', '==', 'published'),
            fsLimit(300)
          )
        ),
        getDocs(
          query(
            collection(firestore, ACADEMY_OFFICIAL_QUESTIONS_COLLECTION),
            where('status', '==', 'published'),
            fsLimit(300)
          )
        ),
      ]);

      console.log(`[academy_questions] academy_questions fetched: ${postedSnap.size} docs`);
      console.log(`[academy_questions] academy_official_questions fetched: ${officialSnap.size} docs`);

      const posted = postedSnap.docs
        .map((d) => normalizeAcademyQuestion(d.id, d.data()))
        .filter((q): q is AcademyUserQuestion => q !== null && q.status === 'published');
      const official = officialSnap.docs
        .map((d) => normalizeAcademyQuestion(d.id, d.data()))
        .filter((q): q is AcademyUserQuestion => q !== null && q.status === 'published');

      const statsMap = new Map<string, {
        playCount: number;
        correctCount: number;
        goodCount: number;
        badCount: number;
        choicePick0: number;
        choicePick1: number;
        choicePick2: number;
        choicePick3: number;
      }>();
      try {
        const statsSnap = await getDocs(
          query(collection(firestore, ACADEMY_QUESTION_STATS_COLLECTION), fsLimit(1200))
        );
        console.log(`[academy_questions] academy_question_stats fetched: ${statsSnap.size} docs`);
        for (const d of statsSnap.docs) {
          const raw = d.data();
          const playCount = Math.max(0, Number(raw.playCount ?? 0));
          const correctCount = Math.max(0, Number(raw.correctCount ?? 0));
          const goodCount = Math.max(0, Number(raw.goodCount ?? 0));
          const badCount = Math.max(0, Number(raw.badCount ?? 0));
          const choicePick0 = Math.max(0, Number(raw.choicePick0 ?? 0));
          const choicePick1 = Math.max(0, Number(raw.choicePick1 ?? 0));
          const choicePick2 = Math.max(0, Number(raw.choicePick2 ?? 0));
          const choicePick3 = Math.max(0, Number(raw.choicePick3 ?? 0));
          statsMap.set(d.id, {
            playCount,
            correctCount,
            goodCount,
            badCount,
            choicePick0,
            choicePick1,
            choicePick2,
            choicePick3,
          });
        }
      } catch (statsError) {
        // stats 側が未デプロイ/権限未反映でも、問題本文の表示を止めない
        const code = getFirestoreErrorCode(statsError);
        console.warn(
          `[academy_question_stats] fetch failed error.code=${code} (continuing without stats):`,
          statsError
        );
      }

      const merged = mergeSeedAndPostedAcademyQuestions(official, posted);
      const nextAcademyUserQuestions = applyAcademyQuestionStats(merged, statsMap);
      console.log(
        `[academy_questions] academyUserQuestions final count: ${nextAcademyUserQuestions.length} (calling setState)`
      );
      useGameStore.setState({
        academyUserQuestions: nextAcademyUserQuestions,
      });
      console.log('[academy_questions] refresh setState completed');
    } catch (error) {
      const code = getFirestoreErrorCode(error);
      console.error(
        `[academy_questions] refresh failed error.code=${code} — setState NOT reached:`,
        error
      );
    } finally {
      academyQuestionRefreshInFlight = null;
    }
  })();

  await academyQuestionRefreshInFlight;
};

// db が利用可能なら即時取得（uid 不要・ゲスト閲覧でも正答率を反映）
if (typeof window !== 'undefined') {
  void refreshAcademyQuestionsFromFirestore();
}

const getAcademyAdminUids = (): string[] =>
  String(process.env.NEXT_PUBLIC_ACADEMY_ADMIN_UIDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const isAcademyAdminUid = (uid: string | null | undefined): boolean => {
  if (!uid) return false;
  return getAcademyAdminUids().includes(uid);
};

const writeAcademyAdminLog = async (params: {
  actorUid: string;
  actorName?: string;
  action: 'update' | 'soft_delete';
  targetQuestionId: string;
  beforeStatus?: string;
  afterStatus?: string;
}) => {
  if (!db) return;
  try {
    await setDoc(doc(collection(db, ACADEMY_LOGS_COLLECTION)), {
      actorUid: params.actorUid,
      actorName: params.actorName ?? 'admin',
      action: params.action,
      targetQuestionId: params.targetQuestionId,
      beforeStatus: params.beforeStatus ?? null,
      afterStatus: params.afterStatus ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[academy_logs] write failed:', error);
  }
};

const toIsoString = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return ((value as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const normalizeAcademyQuestion = (
  id: string,
  raw: unknown
): AcademyUserQuestion | null => {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const choices = Array.isArray(rec.choices)
    ? rec.choices.map((c) => String(c ?? '').trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!rec.question || choices.length !== 4) return null;
  const answerIndexRaw = Number(rec.answerIndex ?? 0);
  const fallbackDate = new Date(0).toISOString();
  const status = typeof rec.status === 'string' ? rec.status : 'published';
  return {
    id,
    createdAt: toIsoString(rec.createdAt, fallbackDate),
    updatedAt: rec.updatedAt ? toIsoString(rec.updatedAt, fallbackDate) : undefined,
    status: status === 'pending' || status === 'hidden' || status === 'deleted' ? status : 'published',
    authorUid: typeof rec.authorUid === 'string' ? rec.authorUid : undefined,
    authorName: typeof rec.authorName === 'string' ? rec.authorName : undefined,
    question: String(rec.question),
    choices,
    answerIndex: Number.isFinite(answerIndexRaw) ? Math.max(0, Math.min(3, Math.floor(answerIndexRaw))) : 0,
    explanation: String(rec.explanation ?? ''),
    keywords: Array.isArray(rec.keywords)
      ? rec.keywords.map((k) => String(k ?? '').trim()).filter(Boolean).slice(0, 8)
      : [],
    bigCategory: typeof rec.bigCategory === 'string' ? rec.bigCategory : undefined,
    subCategory: typeof rec.subCategory === 'string' ? rec.subCategory : undefined,
    subjectText: typeof rec.subjectText === 'string' ? rec.subjectText : undefined,
    detailText: typeof rec.detailText === 'string' ? rec.detailText : undefined,
    playCount: typeof rec.playCount === 'number' ? rec.playCount : 0,
    correctCount: typeof rec.correctCount === 'number' ? rec.correctCount : 0,
    goodCount: typeof rec.goodCount === 'number' ? rec.goodCount : 0,
    badCount: typeof rec.badCount === 'number' ? rec.badCount : 0,
    choicePick0: typeof rec.choicePick0 === 'number' ? rec.choicePick0 : 0,
    choicePick1: typeof rec.choicePick1 === 'number' ? rec.choicePick1 : 0,
    choicePick2: typeof rec.choicePick2 === 'number' ? rec.choicePick2 : 0,
    choicePick3: typeof rec.choicePick3 === 'number' ? rec.choicePick3 : 0,
    likeCount: typeof rec.likeCount === 'number' ? rec.likeCount : undefined,
  };
};

/** マージ後の上限。旧200だと公式seed+Firestore合算で末尾（日本史後半・世界史など）が落ち、高校受験「歴史」に揃わない。 */
const ACADEMY_MERGED_QUESTIONS_MAX = 4000;

const mergeSeedAndPostedAcademyQuestions = (
  official: AcademyUserQuestion[],
  posted: AcademyUserQuestion[]
): AcademyUserQuestion[] => {
  // ローカル `academySeedQuestions.ts` をベースにし、Firestore 公式で上書き、最後にユーザー投稿が同名idを優先。
  const byId = new Map<string, AcademyUserQuestion>();
  for (const q of ACADEMY_SEED_QUESTIONS) byId.set(q.id, q);
  for (const q of official) byId.set(q.id, q);
  for (const q of posted) byId.set(q.id, q);
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, ACADEMY_MERGED_QUESTIONS_MAX);
};

const submitAcademyQuestionViaApi = async (
  payload: Omit<AcademyUserQuestion, 'id' | 'createdAt' | 'authorUid' | 'authorName'>
): Promise<{ ok: boolean; reason?: string }> => {
  try {
    if (!auth?.currentUser) return { ok: false, reason: 'unauthenticated' };
    const idToken = await auth.currentUser.getIdToken(true);
    const res = await fetch('/api/academy-submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-firebase-id-token': idToken,
      },
      body: JSON.stringify({
        question: String(payload.question ?? '').trim().slice(0, 1000),
        choices: Array.isArray(payload.choices)
          ? payload.choices.map((c) => String(c ?? '').trim().slice(0, 300)).filter(Boolean).slice(0, 4)
          : [],
        answerIndex: Number.isInteger(payload.answerIndex) ? Math.max(0, Math.min(3, payload.answerIndex)) : 0,
        explanation: String(payload.explanation ?? '').trim().slice(0, 4000),
        keywords: Array.isArray(payload.keywords)
          ? payload.keywords.map((k) => String(k ?? '').trim().slice(0, 80)).filter(Boolean).slice(0, 8)
          : [],
        bigCategory: payload.bigCategory ? String(payload.bigCategory).slice(0, 100) : undefined,
        subCategory: payload.subCategory ? String(payload.subCategory).slice(0, 100) : undefined,
        subjectText: payload.subjectText ? String(payload.subjectText).slice(0, 200) : undefined,
        detailText: payload.detailText ? String(payload.detailText).slice(0, 1200) : undefined,
      }),
    });
    if (!res.ok) {
      let errorText = '';
      try {
        const body = (await res.json()) as { error?: string };
        errorText = body?.error ? `:${body.error}` : '';
      } catch {
        errorText = '';
      }
      return { ok: false, reason: `api_${res.status}${errorText}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `api_exception:${String((error as Error)?.message ?? error)}` };
  }
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

// 10連中の同期競合を避けるため、単発同期を一時停止するフラグ
let suppressGachaCloudSync = false;

const DEFAULT_WORD_DEX_DICTIONARIES: WordDexDictionary[] = [
  { id: 'dex_english', name: '英語図鑑', icon: '📘', theme: 'forest', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dex_chemistry', name: '科目図鑑', icon: '🧪', theme: 'neon', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dex_takken', name: '資格図鑑', icon: '🏠', theme: 'brown', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dex_hobby', name: '趣味図鑑', icon: '🎨', theme: 'rose', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'dex_other', name: 'その他図鑑', icon: '📚', theme: 'slate', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const normalizeWordName = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeSentence = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeWordDexRelations = (relations: WordDexRelation[]): WordDexRelation[] => {
  const seen = new Set<string>();
  const out: WordDexRelation[] = [];
  for (const r of relations) {
    const target = normalizeWordName(String(r.target ?? ''));
    const relation = normalizeSentence(String(r.relation ?? ''));
    if (!target || !relation) continue;
    const key = `${target.toLowerCase()}::${relation.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ target, relation });
  }
  return out;
};

const buildWordDexContextFromQuestion = (
  term: string,
  question: QuizRaw['questions'][number]
): { description: string; relatedFacts: string[]; relations: WordDexRelation[] } => {
  const qText = normalizeSentence(question.q || '');
  const explanation = normalizeSentence(question.explanation || '');
  const description = explanation || qText || `${term}に関する語`;

  const relatedFacts = Array.from(
    new Set([qText, explanation].filter((v) => !!v && v.length >= 4))
  ).slice(0, 3);

  const otherOptions = Array.from(
    new Set(
      (question.options || [])
        .map((o) => normalizeWordName(String(o || '')))
        .filter((o) => o && o !== term)
    )
  );

  const relationLabel = /誰|だれ|人物|キャラ|登場人物/.test(qText)
    ? '関連する人物'
    : /術式|能力|技|魔法/.test(qText)
      ? '関連する術式・能力'
      : '関連語';

  const relations = normalizeWordDexRelations(
    otherOptions.slice(0, 3).map((target) => ({
      target,
      relation: relationLabel,
    }))
  );

  return { description, relatedFacts, relations };
};

const mergeDefaultDictionaries = (dictionaries?: WordDexDictionary[]): WordDexDictionary[] => {
  // あなた図鑑は独立管理へ移行したため、ことば図鑑一覧から除外する
  const current = Array.isArray(dictionaries)
    ? dictionaries.filter((d) => d.id !== 'dex_anata')
    : [];
  const byId = new Map(current.map((d) => [d.id, d] as const));
  const merged = [...current];
  for (const def of DEFAULT_WORD_DEX_DICTIONARIES) {
    if (!byId.has(def.id)) merged.push(def);
  }
  return merged;
};

const includesAny = (text: string, keywords: string[]): boolean => {
  return keywords.some((k) => text.includes(k));
};

const inferDictionaryIdFromQuiz = (quiz: QuizRaw, dictionaries: WordDexDictionary[]): string => {
  const allText = [
    quiz.summary,
    quiz.keywords.join(' '),
    ...quiz.questions.map((q) => `${q.q} ${q.options.join(' ')} ${q.explanation}`),
  ]
    .join(' ')
    .toLowerCase();

  const hobbyKeywords = [
    'アニメ', '漫画', 'まんが', 'マンガ', 'アイドル', 'ゲーム', '推し', '声優', '映画', 'ドラマ', '音楽', 'バンド',
    'anime', 'manga', 'idol', 'otaku', 'youtube', 'vtuber',
  ];
  const chemistryKeywords = [
    '化学', '元素', '原子', '分子', 'イオン', '化学式', 'モル', '酸', '塩基', '酸化', '還元',
    'chemistry', 'atom', 'molecule', 'ion', 'molar',
  ];
  const takkenKeywords = [
    '宅建', '不動産', '借地', '借家', '登記', '区分所有', '法令上', '都市計画', '建築基準', '重要事項', '媒介',
    'real estate', 'property',
  ];
  const englishKeywords = [
    '英語', '英文', '文法', '単語', '熟語', 'toeic', '英検',
    'english', 'grammar', 'vocabulary',
  ];

  const hasDict = (id: string) => dictionaries.some((d) => d.id === id);
  if (includesAny(allText, hobbyKeywords) && hasDict('dex_hobby')) return 'dex_hobby';
  if (includesAny(allText, chemistryKeywords) && hasDict('dex_chemistry')) return 'dex_chemistry';
  if (includesAny(allText, takkenKeywords) && hasDict('dex_takken')) return 'dex_takken';
  if (includesAny(allText, englishKeywords) && hasDict('dex_english')) return 'dex_english';
  if (hasDict('dex_other')) return 'dex_other';
  return dictionaries[0]?.id ?? 'dex_english';
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

  // 単コレ日次制限
  dailyWordCollectionScanCount: number;
  lastWordCollectionScanDate: string;

  // 単コレ冒険ログ
  wordCollectionScans: WordCollectionScan[];

  // ワード図鑑：発見順（問題として初出した順）
  wordDexOrder: string[];

  // ことば図鑑
  wordDexDictionaries: WordDexDictionary[];
  wordDexWords: WordDexWord[];

  // すうひもちアカデミー: 表示用問題（公式 + ユーザー投稿のFirestoreマージ）
  academyUserQuestions: AcademyUserQuestion[];

  // 講義履歴
  lectureHistory: LectureHistory[];
  
  // スキャンタイプと翻訳結果
  scanType: 'quiz' | 'translation';
  translationMode: 'english_learning' | 'multilang' | null; // 翻訳モード
  englishLearningMode: 'STUDENT' | 'TOEIC'; // 英文解釈の学習プロファイル
  translationResult: TranslationResult | null;
  
  // 生成されたクイズ（ページ更新後も保持）
  generatedQuiz: QuizRaw | null;
  scanImageUrl: string | null;
  
  // スキャン時に保存したクイズの quizId（重複防止用）
  lastScanQuizId: string | null;
  
  // Speed Rushモードのベストタイム（クイズIDをキーとして保存）
  speedRushBestTimes: Record<string, number>; // { quizId: bestTimeInSeconds }

  // すうひもち SNS タイムライン MVP
  suhimochiInterests: string[];
  suhimochiKeywords: SuhimochiKeyword[];
  suhimochiTimeline: SuhimochiTimelinePost[];

  // すうひもち 親密度（永続化）
  suhimochiIntimacy: {
    points: number;
    level: 1 | 2 | 3 | 4 | 5;
    totalMessages: number;
  };

  // すうひもち 会話履歴（永続化・直近20ターン）
  suhimochiGeminiHistory: GeminiMessage[];

  // すうひもち 最後のメッセージ（開口メッセージ生成用）
  suhimochiLastMessage: string;

  // すうひもち 最終訪問日時
  suhimochiLastVisitedAt: number;

  /** 今日のすうひもち（1日1回更新・日付が変わるまで固定） */
  suhimochiTodayState: {
    date: string;
    mood: string;
    message: string;
  } | null;

  /** すうひもちからのお願い（未回答の質問カード用） */
  suhimochiCurrentRequest: SuhimochiRequest | null;

  // あなた図鑑（独立）
  anataZukanEntries: AnataZukanEntry[];

  // クラウド同期ガード（永続化しない内部フラグ）
  hydrationCompleted: boolean;
  cloudLoadInProgress: boolean;
  cloudLoaded: boolean;
  cloudLoadFailed: boolean;
  cloudLoadedUid: string | null;
  cloudSavePausedUntil: number;
}

interface GameActions {
  loginCheck: () => { isNewDay: boolean; bonusCoins: number };
  
  checkScanLimit: (amount?: number) => { canScan: boolean; remaining: number; error?: string };
  incrementScanCount: (amount?: number) => void;
  recoverScanCount: () => void;
  purchaseScanRecovery: () => { success: boolean; message: string };
  
  checkFreeQuestGenerationLimit: () => { canGenerate: boolean; remaining: number; error?: string };
  incrementFreeQuestGenerationCount: () => void;
  recoverFreeQuestGenerationCount: () => void;
  
  checkTranslationLimit: () => { canTranslate: boolean; remaining: number; error?: string };
  incrementTranslationCount: () => void;
  
  setScanType: (type: 'quiz' | 'translation') => void;
  setTranslationMode: (mode: 'english_learning' | 'multilang' | null) => void;
  setEnglishLearningMode: (mode: 'STUDENT' | 'TOEIC') => void;
  setTranslationResult: (result: TranslationResult | null) => void;
  
  // 生成されたクイズの保存・取得
  setGeneratedQuiz: (quiz: QuizRaw | null, imageUrl?: string | null) => void;
  clearGeneratedQuiz: () => void;
  setLastScanQuizId: (quizId: string | null) => void;
  
  // 翻訳履歴管理
  saveTranslationHistory: (result: TranslationResult, imageUrl?: string) => void;
  getTranslationHistory: () => TranslationHistory[];
  deleteTranslationHistory: (id: string) => void;

  // 単コレ冒険ログ管理
  // 戻り値: 追加されたスキャンの id（失敗時は undefined）
  saveWordCollectionScan: (result: TranslationResult | WordCollectionScanResult, imageUrl?: string) => string | undefined;
  getWordCollectionScans: () => WordCollectionScan[];
  getWordCollectionScanById: (id: string) => WordCollectionScan | undefined;
  updateWordEnemyState: (scanId: string, word: string, updates: Partial<Pick<WordEnemy, 'hp' | 'asked' | 'wrongCount'>>) => void;
  refillActiveEnemies: (scanId: string) => void;
  saveAdventureSnapshot: (scanId: string, snapshot: {
    timestamp: string;
    capturedCount: number;
    defeatedCount: number;
    remainingCount: number;
    total: number;
    capturedWords: WordEnemy[];
    defeatedWords: WordEnemy[];
  }) => void;
  registerWordDexWords: (words: string[]) => void;
  getWordDexOrder: () => string[];

  // ことば図鑑
  getWordDexDictionaries: () => WordDexDictionary[];
  addWordDexDictionary: (payload: { name: string; icon?: string; theme?: WordDexDictionary['theme'] }) => void;
  renameWordDexDictionary: (dictionaryId: string, nextName: string) => void;
  deleteWordDexDictionary: (dictionaryId: string) => void;
  registerQuizBatchToWordDex: (quiz: QuizRaw, batchId: string, dictionaryId?: string) => void;
  upsertWordDexWordContext: (
    wordId: string,
    patch: Partial<Pick<WordDexWord, 'description' | 'relatedFacts' | 'relations'>>
  ) => void;
  applyQuizAttemptsToWordDex: (batchId: string, attempts: QuizQuestionAttempt[]) => void;
  moveWordDexBatch: (batchId: string, toDictionaryId: string) => void;

  // すうひもちアカデミー
  addAcademyUserQuestion: (payload: Omit<AcademyUserQuestion, 'id' | 'createdAt' | 'authorUid' | 'authorName'>) => Promise<{ ok: boolean; reason?: string }>;
  updateAcademyUserQuestion: (id: string, patch: Partial<Pick<AcademyUserQuestion, 'question' | 'choices' | 'answerIndex' | 'explanation'>>) => Promise<boolean>;
  deleteAcademyUserQuestion: (id: string) => Promise<boolean>;
  getAcademyUserQuestions: () => AcademyUserQuestion[];
  refreshAcademyQuestions: () => Promise<void>;
  isAcademyAdmin: () => boolean;

  // 講義履歴管理
  saveLectureHistory: (script: LectureScript, imageUrl?: string) => void;
  getLectureHistory: () => LectureHistory[];
  deleteLectureHistory: (id: string) => void;
  
  calculateResult: (correctCount: number, totalQuestions: number, isAdWatched: boolean) => QuizResult;
  applyQuizResult: (result: QuizResult) => void;
  
  // クイズ履歴
  saveQuizHistory: (quiz: QuizRaw, result: QuizResult) => Promise<void>;
  getQuizHistory: () => QuizHistory[];
  deleteQuizHistory: (historyId: string) => Promise<void>;
  updateQuizHistoryUsedIndices: (historyId: string, newIndices: number[]) => void;
  addQuestionsToHistory: (historyId: string, newQuestions: QuizHistory['quiz']['questions']) => void;
  
  // Speed Rushベストタイム管理
  updateSpeedRushBestTime: (quizId: string, totalTime: number) => void;
  getSpeedRushBestTime: (quizId: string) => number | undefined;
  
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
  setDisplayName: (name: string) => void;

  // すうひもち SNS タイムライン MVP
  setSuhimochiInterests: (interests: string[]) => void;
  addSuhimochiKeywords: (words: string[], source?: 'user' | 'system') => void;
  decaySuhimochiKeywords: () => void;
  addSuhimochiTimelinePost: (post: SuhimochiTimelinePost) => void;
  removeSuhimochiTimelinePost: (id: string) => void;

  updateSuhimochiIntimacy: (gain: number) => { newLevel: number; leveledUp: boolean };
  appendSuhimochiGeminiHistory: (userText: string, reply: string) => void;
  /** 手紙返信：手紙(model) -> ユーザー返信(user) -> すうひもち返信(model) を履歴へ保存 */
  appendSuhimochiGeminiLetterReplyHistory: (letterText: string, userText: string, reply: string) => void;
  /** お願い：橋渡しuser + すうひもちの質問model（会話ログと揃える） */
  appendSuhimochiGeminiRequestPreamble: (bridgeUserText: string, modelQuestion: string) => void;
  setSuhimochiOpeningHistory: (openingText: string) => void;
  clearSuhimochiGeminiHistory: () => void;
  updateSuhimochiLastVisit: (message: string) => void;
  setSuhimochiTodayState: (state: { date: string; mood: string; message: string }) => void;
  setSuhimochiCurrentRequest: (req: SuhimochiRequest | null) => void;
  answerSuhimochiRequest: () => void;
  registerAnataZukanWords: (entries: AnataZukanExtractedEntry[]) => void;
  updateAnataZukanEntry: (id: string, patch: Partial<Pick<AnataZukanEntry, 'name' | 'relation' | 'category' | 'likePoint'>>) => void;
  deleteAnataZukanEntry: (id: string) => void;
  
  reset: () => void;
  resetPreserveGuestUsage: () => void;

  // ===== Auth & Cloud Sync =====
  setUserId: (uid: string | null) => Promise<void>;
  syncWithCloud: () => Promise<void>;
}

type GameStore = GameState & GameActions;

// ===== Initial State =====

// ローカル開発時は全装備品を所持済みにする
const DEV_INVENTORY = isLocalDevelopment()
  ? ALL_ITEMS.filter(item => item.type === 'equipment').map(item => ({
      itemId: item.id,
      quantity: 1,
      obtainedAt: new Date(),
    }))
  : [];

const initialState: GameState = {
  uid: null,
  displayName: '',
  coins: isLocalDevelopment() ? 999999 : 0,
  tickets: isLocalDevelopment() ? 999 : 0,
  stamina: STAMINA.MAX,
  
  // VIP機能は廃止（常にfalseとして扱う）
  isVIP: false,
  vipExpiresAt: undefined,
  
  dailyScanCount: 0,
  lastScanDate: '',
  bonusScanBalance: isLocalDevelopment() ? 999 : 0,
  dailyWordCollectionScanCount: 0,
  lastWordCollectionScanDate: '',
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
  
  inventory: DEV_INVENTORY,
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
  wordCollectionScans: [],
  wordDexOrder: [],
  wordDexDictionaries: DEFAULT_WORD_DEX_DICTIONARIES,
  wordDexWords: [],
  academyUserQuestions: mergeSeedAndPostedAcademyQuestions([], []),

  lectureHistory: [],
  
  scanType: 'quiz',
  translationMode: null,
  englishLearningMode: 'STUDENT',
  translationResult: null,
  
  generatedQuiz: null,
  scanImageUrl: null,
  
  lastScanQuizId: null,
  
  speedRushBestTimes: {},

  suhimochiInterests: [],
  suhimochiKeywords: [],
  suhimochiTimeline: [],

  suhimochiIntimacy: { points: 0, level: 1, totalMessages: 0 },
  suhimochiGeminiHistory: [],
  suhimochiLastMessage: '',
  suhimochiLastVisitedAt: 0,
  suhimochiTodayState: null,
  suhimochiCurrentRequest: null,
  anataZukanEntries: [],
  hydrationCompleted: false,
  cloudLoadInProgress: false,
  cloudLoaded: false,
  cloudLoadFailed: false,
  cloudLoadedUid: null,
  cloudSavePausedUntil: 0,
};

// ===== Store Implementation =====

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // ===== Auth & Cloud Sync =====
      
      setUserId: async (uid) => {
        const previousUid = get().uid;
        const now = Date.now();

        // UID切替直後は自動保存を一時停止（ログイン直後の白紙上書きを防ぐ）
        set({
          uid,
          cloudLoadInProgress: !!uid,
          cloudLoaded: false,
          cloudLoadFailed: false,
          cloudLoadedUid: null,
          cloudSavePausedUntil: uid && previousUid !== uid ? now + 8000 : now + 3000,
        });

        // academy_questions / academy_official_questions / academy_question_stats を通常取得で更新する。
        void refreshAcademyQuestionsFromFirestore();

        if (!uid) {
          return;
        }

        if (!db) {
          set({
            cloudLoadInProgress: false,
            cloudLoaded: false,
            cloudLoadFailed: true,
            cloudLoadedUid: null,
          });
          return;
        }

        const rawRecoveryState = readLogoutRecoveryState(uid) as Partial<GameState> | null;
        const recoveryState = isClearlyEmptyRecoveryState(rawRecoveryState) ? null : rawRecoveryState;
        if (rawRecoveryState && !recoveryState) {
          console.warn('[setUserId] logout recovery exists but is clearly empty; ignored');
        }

        try {
          const userRef = doc(db, 'users', uid);
          const snap = await getDoc(userRef);
          const state = get();
          const baseState = recoveryState ? { ...state, ...recoveryState, uid } : state;

          if (snap.exists()) {
            const cloudData = snap.data() as any;

            // ログインボーナスチェック前に lastLoginDate を保存（上書きを防ぐため）
            const currentLastLoginDate = state.lastLoginDate;
            const today = getTodayString();

            // DEBUG: snapshot presence before merging cloud state
            try {
              console.log('[setUserId] BEFORE merge: local scans snapshot flags ->', state.wordCollectionScans.map(s => ({ id: s.id, hasSnap: !!s.lastAdventureSnapshot })));
            } catch (e) {
              /* ignore */
            }

            set({
              // ユーザー状態系（努力の結晶のみ）
              uid,
              displayName: cloudData.userState?.displayName ?? baseState.displayName,
              coins: cloudData.userState?.coins ?? baseState.coins,
              tickets: cloudData.userState?.tickets ?? baseState.tickets,
              stamina: cloudData.userState?.stamina ?? baseState.stamina,
              // VIP機能は廃止（クラウド値も取り込まない）
              isVIP: false,
              vipExpiresAt: undefined,
              dailyScanCount: cloudData.userState?.dailyScanCount ?? baseState.dailyScanCount,
              lastScanDate: cloudData.userState?.lastScanDate ?? baseState.lastScanDate,
              bonusScanBalance: cloudData.userState?.bonusScanBalance ?? baseState.bonusScanBalance,
              dailyFreeQuestGenerationCount:
                cloudData.userState?.dailyFreeQuestGenerationCount ?? baseState.dailyFreeQuestGenerationCount,
              lastFreeQuestGenerationDate:
                cloudData.userState?.lastFreeQuestGenerationDate ?? baseState.lastFreeQuestGenerationDate,
              dailyTranslationCount:
                cloudData.userState?.dailyTranslationCount ?? baseState.dailyTranslationCount,
              lastTranslationDate:
                cloudData.userState?.lastTranslationDate ?? baseState.lastTranslationDate,
              // ログインボーナスが既に付与されている場合は、lastLoginDate を上書きしない
              lastLoginDate: (currentLastLoginDate === today) ? currentLastLoginDate : (cloudData.userState?.lastLoginDate ?? baseState.lastLoginDate),
              consecutiveLoginDays:
                cloudData.userState?.consecutiveLoginDays ?? baseState.consecutiveLoginDays,
              totalScans: cloudData.userState?.totalScans ?? baseState.totalScans,
              totalQuizzes: cloudData.userState?.totalQuizzes ?? baseState.totalQuizzes,
              totalCorrectAnswers:
                cloudData.userState?.totalCorrectAnswers ?? baseState.totalCorrectAnswers,
              totalDistance: cloudData.userState?.totalDistance ?? baseState.totalDistance,
              totalQuizClears:
                cloudData.userState?.totalQuizClears ?? baseState.totalQuizClears,

              // インベントリ系
              inventory: cloudData.inventory ?? baseState.inventory,
              equipment: cloudData.equipment ?? baseState.equipment,

              // マップ／旅路
              journey: cloudData.journey ?? baseState.journey,

              // 生成されたクイズは保持（クラウドには保存しないが、ローカルでは保持）
              generatedQuiz: baseState.generatedQuiz,
              scanImageUrl: baseState.scanImageUrl,

              // クラウド未同期時でもローカル退避データを復元できるように維持
              wordCollectionScans: baseState.wordCollectionScans,
              wordDexOrder: baseState.wordDexOrder,
              wordDexDictionaries: baseState.wordDexDictionaries,
              wordDexWords: baseState.wordDexWords,
              quizHistory: baseState.quizHistory,
              translationHistory: baseState.translationHistory,
              lectureHistory: baseState.lectureHistory,
              scanType: baseState.scanType,
              translationMode: baseState.translationMode,
              englishLearningMode: baseState.englishLearningMode,
              lastScanQuizId: baseState.lastScanQuizId,

              // 履歴はこの後サブコレクションから読み込む
            });

            // DEBUG: verify snapshot presence after merge
            try {
              const after = get();
              console.log('[setUserId] AFTER merge: local scans snapshot flags ->', (after.wordCollectionScans || []).map(s => ({ id: s.id, hasSnap: !!s.lastAdventureSnapshot })));
              const prevHad = state.wordCollectionScans.some(s => !!s.lastAdventureSnapshot);
              const nextHas = (after.wordCollectionScans || []).some(s => !!s.lastAdventureSnapshot);
              if (prevHad && !nextHas) {
                console.warn('[setUserId] WARNING: snapshot existed before merge but missing after merge');
              }
            } catch (e) {
              /* ignore */
            }

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

              // 講義履歴（クラウドは最新30件まで）
              const lectureCol = collection(db, 'users', uid, 'lecture_history');
              const lectureSnap = await getDocs(
                query(lectureCol, orderBy('createdAt', 'desc'), fsLimit(30))
              );
              const cloudLectureHistory: LectureHistory[] = lectureSnap.docs.map(
                (d) => d.data() as LectureHistory
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

              const mergedLectureHistory: LectureHistory[] = [
                ...cloudLectureHistory,
                ...currentState.lectureHistory.filter(
                  (local) => !cloudLectureHistory.some((cloud) => cloud.id === local.id)
                ),
              ];

              const cloudDataForEmptyCheck = {
                bonusScanBalance: cloudData.userState?.bonusScanBalance,
                dailyScanCount: cloudData.userState?.dailyScanCount,
                lastScanDate: cloudData.userState?.lastScanDate,
                coins: cloudData.userState?.coins ?? 0,
                tickets: cloudData.userState?.tickets ?? 0,
                inventory: cloudData.inventory ?? [],
                equipment: cloudData.equipment ?? {},
                journey: cloudData.journey ?? initialState.journey,
                quizHistory: cloudQuizHistory,
                translationHistory: cloudTranslationHistory,
                lectureHistory: cloudLectureHistory,
                wordCollectionScans: baseState.wordCollectionScans ?? [],
                totalScans: cloudData.userState?.totalScans ?? 0,
                totalQuizzes: cloudData.userState?.totalQuizzes ?? 0,
                totalCorrectAnswers: cloudData.userState?.totalCorrectAnswers ?? 0,
                totalDistance: cloudData.userState?.totalDistance ?? 0,
                totalQuizClears: cloudData.userState?.totalQuizClears ?? 0,
              };
              const cloudRestoreLooksEmpty =
                isCloudDataClearlyEmpty(cloudDataForEmptyCheck) &&
                !hasMeaningfulStateForCloudSync(baseState);

              console.log('[cloud load] data=', cloudDataForEmptyCheck);
              console.log('[cloud load] empty判定=', isCloudDataClearlyEmpty(cloudDataForEmptyCheck));

              if (cloudRestoreLooksEmpty) {
                console.warn('[setUserId] cloud restore looks empty; treating as failed restore');
                set({
                  cloudLoadInProgress: false,
                  cloudLoaded: false,
                  cloudLoadFailed: true,
                  cloudLoadedUid: null,
                });
                return;
              }

              set({
                quizHistory: mergedQuizHistory,
                translationHistory: mergedTranslationHistory,
                lectureHistory: mergedLectureHistory,
                cloudLoadInProgress: false,
                cloudLoaded: true,
                cloudLoadFailed: false,
                cloudLoadedUid: uid,
              });
            } catch (historyError) {
              console.error('Cloud history load error:', historyError);
              set({
                cloudLoadInProgress: false,
                cloudLoaded: true,
                cloudLoadFailed: false,
                cloudLoadedUid: uid,
              });
            }
          } else {
            // 初回ログイン: 現在のローカル状態をクラウドへ
            if (recoveryState) {
              set({
                ...initialState,
                ...(recoveryState as Partial<GameState>),
                uid,
              });
            }
            set({
              cloudLoadInProgress: false,
              cloudLoaded: true,
              cloudLoadFailed: false,
              cloudLoadedUid: uid,
            });

            const shouldSkipInitialCloudSync = shouldBlockCloudOverwriteAsEmpty(get());
            if (!shouldSkipInitialCloudSync) {
              await get().syncWithCloud();
            } else {
              console.warn('[setUserId] initial cloud sync skipped because state is empty');
            }
          }
          clearLogoutRecoveryState();
        } catch (error) {
          console.error('Cloud Load Error:', error);
          if (recoveryState) {
            set({
              ...get(),
              ...(recoveryState as Partial<GameState>),
              uid,
            });
          }
          set({
            cloudLoadInProgress: false,
            cloudLoaded: false,
            cloudLoadFailed: true,
            cloudLoadedUid: null,
          });
        }
      },

      syncWithCloud: async () => {
        const state = get();
        if (!db || !state.uid) return;

        if (!state.hydrationCompleted) {
          console.log('[syncWithCloud] blocked: hydration not completed');
          return;
        }
        if (state.cloudLoadInProgress) {
          console.log('[syncWithCloud] blocked: cloud loading in progress');
          return;
        }
        if (!state.cloudLoaded || state.cloudLoadedUid !== state.uid) {
          console.log('[syncWithCloud] blocked: cloud restore not ready for current uid');
          return;
        }
        if (state.cloudLoadFailed) {
          console.warn('[syncWithCloud] blocked: previous cloud restore failed');
          return;
        }
        if (Date.now() < Number(state.cloudSavePausedUntil ?? 0)) {
          console.log('[syncWithCloud] blocked: save paused after uid switch');
          return;
        }
        if (shouldBlockCloudOverwriteAsEmpty(state)) {
          console.warn('[syncWithCloud] blocked dangerous empty overwrite payload');
          return;
        }

        // ローカル開発時はクラウドへの書き込みをスキップ（DEV_INVENTORY等で本番データを汚染しない）
        if (isLocalDevelopment()) {
          console.log('[syncWithCloud] skipped in local development');
          return;
        }

        try {
          const userRef = doc(db, 'users', state.uid);
          const now = new Date().toISOString();

          await setDoc(
            userRef,
            {
              userState: {
                uid: state.uid,
                displayName: state.displayName,
                coins: state.coins,
                tickets: state.tickets,
                stamina: state.stamina,
                isVIP: state.isVIP,
                vipExpiresAt: state.vipExpiresAt
                  ? state.vipExpiresAt.toISOString?.() ?? state.vipExpiresAt
                  : null,
                dailyScanCount: state.dailyScanCount,
                lastScanDate: state.lastScanDate,
                bonusScanBalance: state.bonusScanBalance,
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
        const yesterdayString = getJstDateString(-1);
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
      
      checkScanLimit: (amount = 1) => {
        // ローカル環境では制限を外す
        if (isLocalDevelopment()) {
          return { canScan: true, remaining: Infinity };
        }
        
        const state = get();
        const today = getTodayString();
        const freeLimit = LIMITS.FREE_USER.DAILY_SCAN_LIMIT;
        const currentDailyScanCount = state.lastScanDate !== today ? 0 : state.dailyScanCount;
        const bonusScanBalance = state.bonusScanBalance ?? 0;
        
        if (state.lastScanDate !== today) {
          set({ dailyScanCount: 0, lastScanDate: today });
          const freeRemaining = Math.max(0, freeLimit - currentDailyScanCount);
          return {
            canScan: true,
            remaining: state.isVIP ? Infinity : (freeRemaining + bonusScanBalance),
          };
        }
        
        if (state.isVIP) {
          return { canScan: true, remaining: Infinity };
        }
        
        const freeRemaining = Math.max(0, freeLimit - currentDailyScanCount);
        const remaining = freeRemaining + bonusScanBalance;
        
        if (remaining < amount) {
          return { 
            canScan: false, 
            remaining: 0, 
            error: ERROR_MESSAGES.SCAN_LIMIT_REACHED 
          };
        }
        
        return { canScan: true, remaining };
      },
      
      incrementScanCount: (amount = 1) => {
        const state = get();
        const today = getTodayString();
        const freeLimit = LIMITS.FREE_USER.DAILY_SCAN_LIMIT;
        const isNewDay = state.lastScanDate !== today;
        const currentDailyScanCount = isNewDay ? 0 : state.dailyScanCount;
        const freeRemaining = Math.max(0, freeLimit - currentDailyScanCount);
        const useFree = Math.min(amount, freeRemaining);
        const useBonus = Math.max(0, amount - useFree);
        set({
          dailyScanCount: Math.min(freeLimit, currentDailyScanCount + useFree),
          lastScanDate: today,
          bonusScanBalance: Math.max(0, (state.bonusScanBalance ?? 0) - useBonus),
          totalScans: state.totalScans + amount,
        });
        get().syncWithCloud();
      },
      
      recoverScanCount: () => {
        const state = get();
        set({
          bonusScanBalance: (state.bonusScanBalance ?? 0) + REWARDS.AD_REWARDS.SCAN_RECOVERY_COUNT,
        });
        get().syncWithCloud();
      },

      // 100コインでスキャンを1回分回復（消費カウントを1減らす）
      purchaseScanRecovery: () => {
        const state = get();
        const today = getTodayString();
        // 日付が変わっていたらリセットしてから判定
        if (state.lastScanDate !== today) {
          set({ dailyScanCount: 0, lastScanDate: today });
        }

        // VIPは実質無制限なので処理不要
        if (state.isVIP) {
          return { success: false, message: 'VIPは回復不要です' };
        }

        // コイン消費チェック（100コイン固定）
        const cost = 100;
        if (!get().spendCoins(cost)) {
          return { success: false, message: 'コインが不足しています (100コイン必要)' };
        }

        // 追加回数はボーナス残高として付与（無料枠超過分から消費される）
        set(state => ({
          bonusScanBalance: (state.bonusScanBalance ?? 0) + 1,
        }));
        get().syncWithCloud();
        return { success: true, message: 'ボーナススキャンを1回付与しました' };
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
        // ローカル環境では制限を外す
        if (isLocalDevelopment()) {
          return { canTranslate: true, remaining: Infinity };
        }
        
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
      
      setTranslationMode: (mode) => {
        set({ translationMode: mode });
      },

      setEnglishLearningMode: (mode) => {
        set({ englishLearningMode: mode });
      },
      
      setTranslationResult: (result) => {
        set({ translationResult: result });
      },
      
      // 生成されたクイズの保存
      setGeneratedQuiz: (quiz, imageUrl) => {
        set({
          generatedQuiz: quiz,
          scanImageUrl: imageUrl ?? null,
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
        
        // sentences配列がある場合（英文解釈モード）は、それも保存
        const newHistory: TranslationHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          originalText: result.originalText,
          translatedText: result.translatedText,
          createdAt: new Date().toISOString(),
          imageUrl, // 画像URLは容量を消費するため、必要に応じて削除を検討
          // 英文解釈モードのデータも保存
          sentences: result.sentences,
          marked_text: result.marked_text,
          japanese_translation: result.japanese_translation,
          chunks: result.chunks, // 構造解析カード用のデータも保存
        };
        
        // 新しい履歴を追加し、最大保存数を超える場合は古い履歴を削除
        const updatedHistory = [newHistory, ...state.translationHistory];
        const limitedHistory = updatedHistory.slice(0, LIMITS.TRANSLATION_HISTORY.MAX_ITEMS);
        
        set({
          translationHistory: limitedHistory,
        });

        // 単コレ：英文解釈モードのスキャンから単語を抽出して登録
        get().saveWordCollectionScan(result, imageUrl);

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

      // ===== Word Collection (単コレ) Management =====

      saveWordCollectionScan: (result, imageUrl) => {
        const state = get();
        // Enforce daily limit only in production-like environments
        const today = getTodayString();
        const dailyLimit = LIMITS.WORD_COLLECTION_SCANS.DAILY_SCAN_LIMIT ?? 3;
        const isNewDay = state.lastWordCollectionScanDate !== today;
        const currentDailyCount = isNewDay ? 0 : (state.dailyWordCollectionScanCount ?? 0);
        const freeRemaining = Math.max(0, dailyLimit - currentDailyCount);
        const bonusBalance = state.bonusScanBalance ?? 0;
        const useBonus = !state.isVIP && freeRemaining <= 0 ? 1 : 0;
        if (!isLocalDevelopment()) {
          if (!state.isVIP && freeRemaining <= 0 && bonusBalance <= 0) {
            console.warn('[saveWordCollectionScan] daily limit reached');
            return undefined;
          }
        }
        const ACTIVE_MAX = LIMITS.WORD_COLLECTION_SCANS.ACTIVE_ENEMIES_MAX ?? 21;

        const isWordCollectionResult = 'words' in result && Array.isArray((result as WordCollectionScanResult).words);
        let words: WordEnemy[];
        let text: string;

        if (isWordCollectionResult) {
          const wcResult = result as WordCollectionScanResult;
          text = wcResult.clean_text || '';
          words = wcResult.words.map((w) => ({
            word: String(w.word ?? '').trim().toLowerCase(),
            meaning: (w.meaning && String(w.meaning).trim()) || undefined,
            pos: w.pos ? String(w.pos).toLowerCase() : undefined,
            surfaceVariants: Array.isArray(w.surfaceVariants) ? w.surfaceVariants : undefined,
            exampleSentence: w.exampleSentence && String(w.exampleSentence).trim() ? String(w.exampleSentence).trim() : undefined,
            hp: 2,
            asked: false,
            wrongCount: 0,
          })).filter((w) => w.word);
        } else {
          const trResult = result as TranslationResult;
          text =
            trResult.clean_text ||
            trResult.originalText ||
            (trResult.sentences
              ?.map((s: any) => s.original_text || s.marked_text || s.originalText || '')
              .filter(Boolean)
              .join(' ') || '');
          if (!text.trim()) return;

          const vocabMap = new Map<string, string>();
          for (const s of trResult.sentences || []) {
            for (const v of s.vocab_list || []) {
              const w = String(v?.word ?? '').trim().toLowerCase();
              const m = String(v?.meaning ?? '').trim();
              if (w && m && !vocabMap.has(w)) vocabMap.set(w, m);
            }
          }

          const wordsRaw = extractWords(text);
          if (wordsRaw.length === 0) return;

          words = wordsRaw.map((w) => ({
            word: w,
            meaning: vocabMap.get(w) || undefined,
            hp: 2,
            asked: false,
            wrongCount: 0,
          }));
        }

        if (words.length === 0) return;

        // 同一lemmaの重複を統合（20/21重複対策）
        const wordMap = new Map<string, WordEnemy>();
        for (const w of words) {
          const key = w.word;
          const prev = wordMap.get(key);
          if (!prev) {
            wordMap.set(key, { ...w });
            continue;
          }
          wordMap.set(key, {
            ...prev,
            // 欠けている情報を補完
            meaning: prev.meaning || w.meaning,
            pos: prev.pos || w.pos,
            exampleSentence: prev.exampleSentence || w.exampleSentence,
            surfaceVariants: Array.from(new Set([...(prev.surfaceVariants ?? []), ...(w.surfaceVariants ?? [])])),
          });
        }
        words = Array.from(wordMap.values());

        const shortTitle = text.slice(0, 25).trim() + (text.length > 25 ? '…' : '') || new Date().toLocaleDateString('ja-JP');
        const scanNum = state.wordCollectionScans.length + 1;
        const title = `スキャン${scanNum}：${shortTitle}`;

        const dexSet = new Set(state.wordDexOrder ?? []);
        const withMeaning = words.filter((w) => w.meaning?.trim() && w.hp > 0);
        const unregisteredForActive = withMeaning.filter((w) => !dexSet.has(w.word));
        const registeredForActive = withMeaning.filter((w) => dexSet.has(w.word));
        const sortCandidates = (arr: WordEnemy[]) =>
          [...arr].sort((a, b) => {
            if (a.asked !== b.asked) return a.asked ? 1 : -1;
            if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
            return Math.random() - 0.5;
          });
        // 未登録優先。ただし枠が不足する場合は登録済みで補充して分母を崩さない
        const prioritized = [...sortCandidates(unregisteredForActive), ...sortCandidates(registeredForActive)];
        const initialActive = prioritized.slice(0, ACTIVE_MAX).map((w) => w.word);

        const newScan: WordCollectionScan = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          createdAt: new Date().toISOString(),
          imageUrl,
          words,
          activeEnemyWords: initialActive.length > 0 ? initialActive : undefined,
          activeEnemyTotal: initialActive.length,
        };

        const updated = [newScan, ...state.wordCollectionScans];
        const limited = updated.slice(0, LIMITS.WORD_COLLECTION_SCANS.MAX_ITEMS);

        // increment daily counter and persist new scan list
        set({
          wordCollectionScans: limited,
          dailyWordCollectionScanCount: currentDailyCount + (freeRemaining > 0 || state.isVIP ? 1 : 0),
          lastWordCollectionScanDate: today,
          bonusScanBalance: Math.max(0, bonusBalance - useBonus),
        });
        return newScan.id;
      },

      getWordCollectionScans: () => get().wordCollectionScans,

      getWordCollectionScanById: (id) => {
        return get().wordCollectionScans.find((s) => s.id === id);
      },

      updateWordEnemyState: (scanId, word, updates) => {
        const state = get();
        const scan = state.wordCollectionScans.find((s) => s.id === scanId);
        if (!scan) return;
        const hasTarget = scan.words.some((w) => w.word === word);
        if (!hasTarget) return;
        // 同じ lemma が複数行あるケースでも状態が分裂しないよう、同一単語は一括更新する
        const updatedWords = scan.words.map((w) =>
          w.word === word ? { ...w, ...updates } : w
        );
        // compute defeated increment: how many HP points were reduced (usually 1)
        // (previously computed defeatedDelta here; now rely on hp state for display)
        // NOTE:
        // Do not remove a word from activeEnemyWords when it's captured (hp === 0).
        // activeEnemyWords represents the fixed set selected for this adventure (the denominator).
        // Only update the words array (hp/asked/etc.). activeEnemyWords is preserved so
        // the UI can consistently display the original adventure total.
        const activeEnemyWords = scan.activeEnemyWords ?? [];
        set({
          wordCollectionScans: state.wordCollectionScans.map((s) =>
            s.id === scanId
              ? {
                  ...s,
                  words: updatedWords,
                  activeEnemyWords: activeEnemyWords.length > 0 ? activeEnemyWords : undefined,
                }
              : s
          ),
        });
        // Immediately persist the updated words to localStorage to avoid race conditions
        try {
          const key = 'potenote-scanner-v2';
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.wordCollectionScans)) {
              parsed.wordCollectionScans = parsed.wordCollectionScans.map((s: any) =>
                s.id === scanId
                  ? { ...s, words: updatedWords, activeEnemyWords: activeEnemyWords.length > 0 ? activeEnemyWords : undefined, lastAdventureSnapshot: s.lastAdventureSnapshot }
                  : s
              );
              localStorage.setItem(key, JSON.stringify(parsed));
              console.log('[updateWordEnemyState] persisted updated words to localStorage for', scanId);
            }
          }
        } catch (e) {
          console.warn('[updateWordEnemyState] failed to persist directly', e);
        }
      },

      refillActiveEnemies: (scanId) => {
        const state = get();
        const scan = state.wordCollectionScans.find((s) => s.id === scanId);
        if (!scan) return;
        const ACTIVE_MAX = LIMITS.WORD_COLLECTION_SCANS.ACTIVE_ENEMIES_MAX ?? 21;
        const dexSet = new Set(state.wordDexOrder ?? []);
        // 毎回、未出題(asked=false)を最優先してアクティブ枠を再構成する。
        // これにより同一scanIdで複数回プレイしても未出題単語を出し切れる。
        const sortCandidates = (arr: WordEnemy[]) =>
          [...arr].sort((a, b) => {
            if (a.asked !== b.asked) return a.asked ? 1 : -1;
            if ((a.wrongCount ?? 0) !== (b.wrongCount ?? 0)) return (b.wrongCount ?? 0) - (a.wrongCount ?? 0);
            return Math.random() - 0.5;
          });
        const reserveUnregistered = scan.words.filter((w) => w.hp > 0 && w.meaning?.trim() && !dexSet.has(w.word));
        const reserveRegistered = scan.words.filter((w) => w.hp > 0 && w.meaning?.trim() && dexSet.has(w.word));
        // 未登録優先 + 足りない分を登録済みで補充
        const reserve = [...sortCandidates(reserveUnregistered), ...sortCandidates(reserveRegistered)];

        const newActive = reserve.slice(0, ACTIVE_MAX).map((w) => w.word);
        // Debug: log snapshot presence before updating active list
        try {
          const target = state.wordCollectionScans.find((x) => x.id === scanId);
          console.log('[refillActiveEnemies] before update:', { scanId, hadSnapshot: !!target?.lastAdventureSnapshot, lastSnapshot: target?.lastAdventureSnapshot });
        } catch (e) {}

        set({
          wordCollectionScans: state.wordCollectionScans.map((s) =>
            s.id === scanId
              ? {
                  ...s,
                  activeEnemyWords: newActive.length > 0 ? newActive : undefined,
                  // 分母は捕獲しても崩さない（初期設定値を維持）
                  activeEnemyTotal: s.activeEnemyTotal,
                  lastAdventureSnapshot: s.lastAdventureSnapshot,
                }
              : s
          ),
        });

        // Debug: verify snapshot preserved after update
        try {
          const after = get().wordCollectionScans.find((x) => x.id === scanId);
          console.log('[refillActiveEnemies] after update:', { scanId, hasSnapshot: !!after?.lastAdventureSnapshot, lastSnapshot: after?.lastAdventureSnapshot });
        } catch (e) {}
      },
      
      // Save an adventure snapshot at the end of a quest so the log screen can display
      // what happened at the time of completion without being affected by later state changes.
      saveAdventureSnapshot: (scanId: string, snapshot: { timestamp: string; capturedCount: number; defeatedCount: number; remainingCount: number; total: number; capturedWords: WordEnemy[]; defeatedWords: WordEnemy[] }) => {
        const state = get();
        console.log('[saveAdventureSnapshot] saving snapshot for', scanId, snapshot);
        set({
          wordCollectionScans: state.wordCollectionScans.map((s) =>
            s.id === scanId
              ? (() => {
                  const prev = s.lastAdventureSnapshot;
                  const total = prev?.total ?? snapshot.total;
                  // capturedWords は累積（重複を除外して加算）
                  const mergedCapturedMap = new Map<string, WordEnemy>();
                  for (const w of prev?.capturedWords ?? []) mergedCapturedMap.set(w.word, w);
                  for (const w of snapshot.capturedWords ?? []) mergedCapturedMap.set(w.word, w);
                  const mergedCapturedWords = Array.from(mergedCapturedMap.values());
                  const capturedCount = Math.min(total, mergedCapturedWords.length);
                  const defeatedCount = Math.max(0, snapshot.defeatedCount);
                  const remainingCount = Math.max(0, total - capturedCount - defeatedCount);
                  return {
                    ...s,
                    lastAdventureSnapshot: {
                      ...snapshot,
                      total,
                      capturedCount,
                      defeatedCount,
                      remainingCount,
                      capturedWords: mergedCapturedWords,
                    },
                  };
                })()
              : s
          ),
        });
        // Ensure persisted storage is updated immediately to avoid race with HMR/refresh.
        try {
          const key = 'potenote-scanner-v2';
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.wordCollectionScans)) {
              parsed.wordCollectionScans = parsed.wordCollectionScans.map((s: any) => {
                if (s.id !== scanId) return s;
                const prev = s.lastAdventureSnapshot;
                const total = prev?.total ?? snapshot.total;
                const mergedCapturedMap = new Map<string, any>();
                for (const w of prev?.capturedWords ?? []) mergedCapturedMap.set(w.word, w);
                for (const w of snapshot.capturedWords ?? []) mergedCapturedMap.set(w.word, w);
                const mergedCapturedWords = Array.from(mergedCapturedMap.values());
                const capturedCount = Math.min(total, mergedCapturedWords.length);
                const defeatedCount = Math.max(0, snapshot.defeatedCount);
                const remainingCount = Math.max(0, total - capturedCount - defeatedCount);
                return {
                  ...s,
                  lastAdventureSnapshot: {
                    ...snapshot,
                    total,
                    capturedCount,
                    defeatedCount,
                    remainingCount,
                    capturedWords: mergedCapturedWords,
                  },
                };
              });
              localStorage.setItem(key, JSON.stringify(parsed));
              console.log('[saveAdventureSnapshot] persisted snapshot to localStorage');
            }
          }
        } catch (e) {
          console.warn('[saveAdventureSnapshot] failed to persist directly', e);
        }
      },

      registerWordDexWords: (words) => {
        const state = get();
        const order = [...state.wordDexOrder];
        const seen = new Set(order);
        let changed = false;
        for (const w of words) {
          if (w && !seen.has(w)) {
            seen.add(w);
            order.push(w);
            changed = true;
          }
        }
        if (changed) set({ wordDexOrder: order });
      },

      getWordDexOrder: () => get().wordDexOrder,

      // ===== ことば図鑑 =====
      getWordDexDictionaries: () => {
        const state = get();
        if (!state.wordDexDictionaries || state.wordDexDictionaries.length === 0) {
          set({ wordDexDictionaries: DEFAULT_WORD_DEX_DICTIONARIES });
          return DEFAULT_WORD_DEX_DICTIONARIES;
        }
        const merged = mergeDefaultDictionaries(state.wordDexDictionaries);
        if (merged.length !== state.wordDexDictionaries.length) {
          set({ wordDexDictionaries: merged });
        }
        return merged;
      },

      addWordDexDictionary: (payload) => {
        const name = payload.name.trim();
        if (!name) return;
        const state = get();
        const now = new Date().toISOString();
        const dictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
        const id = `dex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const next: WordDexDictionary = {
          id,
          name,
          icon: payload.icon || '📘',
          theme: payload.theme || 'forest',
          createdAt: now,
          updatedAt: now,
        };
        set({ wordDexDictionaries: [next, ...dictionaries] });
      },

      renameWordDexDictionary: (dictionaryId, nextName) => {
        const trimmed = nextName.trim();
        if (!trimmed) return;
        const state = get();
        const now = new Date().toISOString();
        const dictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
        set({
          wordDexDictionaries: dictionaries.map((d) =>
            d.id === dictionaryId ? { ...d, name: trimmed, updatedAt: now } : d
          ),
        });
      },

      deleteWordDexDictionary: (dictionaryId) => {
        const state = get();
        const dictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
        const remaining = dictionaries.filter((d) => d.id !== dictionaryId);
        // Move words in deleted dictionary to 'dex_other' if exists, otherwise keep dictionaryId
        const other = remaining.find((d) => d.id === 'dex_other');
        const newWords = state.wordDexWords.map((w) =>
          w.dictionaryId === dictionaryId ? { ...w, dictionaryId: other ? other.id : w.dictionaryId } : w
        );
        set({
          wordDexDictionaries: remaining,
          wordDexWords: newWords,
        });
      },

      registerQuizBatchToWordDex: (quiz, batchId, dictionaryId) => {
        const state = get();
        const dictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
        const targetDictionaryId = dictionaryId || inferDictionaryIdFromQuiz(quiz, dictionaries);
        const now = new Date().toISOString();

        const currentWords = [...state.wordDexWords];
        const order = [...state.wordDexOrder];
        const seenOrder = new Set(order);

        quiz.questions.forEach((q, idx) => {
          const term = normalizeWordName(q.options[q.a] || q.q);
          if (!term) return;
          const generated = buildWordDexContextFromQuestion(term, q);

          const wordId = `${batchId}_${idx}`;
          const existingIndex = currentWords.findIndex((w) => w.id === wordId);
          if (existingIndex >= 0) {
            const prev = currentWords[existingIndex];
            currentWords[existingIndex] = {
              ...prev,
              name: term,
              // 既存説明がなければ、問題文/解説由来の説明を補完
              description: prev.description || generated.description,
              // 既存がなければ関連情報を自動補完
              relatedFacts:
                prev.relatedFacts && prev.relatedFacts.length > 0
                  ? prev.relatedFacts
                  : generated.relatedFacts,
              relations:
                prev.relations && prev.relations.length > 0 ? prev.relations : generated.relations,
              dictionaryId: prev.dictionaryId || targetDictionaryId,
            };
          } else {
            currentWords.push({
              id: wordId,
              name: term,
              description: generated.description,
              relatedFacts: generated.relatedFacts,
              relations: generated.relations,
              dictionaryId: targetDictionaryId,
              batchId,
              correctCount: 0,
              wrongCount: 0,
              totalAttempts: 0,
              consecutiveCorrect: 0,
              firstEncounterDate: now,
              lastAttemptDate: now,
            });
          }

          if (!seenOrder.has(term)) {
            seenOrder.add(term);
            order.push(term);
          }
        });

        set({
          wordDexDictionaries: dictionaries,
          wordDexWords: currentWords,
          wordDexOrder: order,
        });
      },

      upsertWordDexWordContext: (wordId, patch) => {
        const state = get();
        const description = normalizeSentence(String(patch.description ?? ''));
        const relatedFacts = Array.from(
          new Set((patch.relatedFacts ?? []).map((f) => normalizeSentence(String(f ?? ''))).filter(Boolean))
        ).slice(0, 8);
        const relations = normalizeWordDexRelations(patch.relations ?? []).slice(0, 8);

        set({
          wordDexWords: state.wordDexWords.map((word) =>
            word.id !== wordId
              ? word
              : {
                  ...word,
                  description: description || word.description,
                  relatedFacts: relatedFacts.length > 0 ? relatedFacts : word.relatedFacts,
                  relations: relations.length > 0 ? relations : word.relations,
                }
          ),
        });
      },

      applyQuizAttemptsToWordDex: (batchId, attempts) => {
        if (!attempts || attempts.length === 0) return;
        const state = get();
        const now = new Date().toISOString();

        const updatedWords = state.wordDexWords.map((word) => {
          if (word.batchId !== batchId) return word;
          const idxPart = word.id.replace(`${batchId}_`, '');
          const questionIndex = Number(idxPart);
          if (Number.isNaN(questionIndex)) return word;

          const attempt = attempts.find((a) => a.questionIndex === questionIndex);
          if (!attempt) return word;

          const isCorrect = !!attempt.isCorrect;
          return {
            ...word,
            totalAttempts: word.totalAttempts + 1,
            correctCount: word.correctCount + (isCorrect ? 1 : 0),
            wrongCount: word.wrongCount + (isCorrect ? 0 : 1),
            consecutiveCorrect: isCorrect ? word.consecutiveCorrect + 1 : 0,
            lastAttemptDate: now,
          };
        });

        set({ wordDexWords: updatedWords });
      },

      moveWordDexBatch: (batchId, toDictionaryId) => {
        const state = get();
        const dictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
        if (!dictionaries.some((d) => d.id === toDictionaryId)) return;

        set({
          wordDexWords: state.wordDexWords.map((word) =>
            word.batchId === batchId ? { ...word, dictionaryId: toDictionaryId } : word
          ),
        });
      },

      // ===== すうひもちアカデミー =====
      addAcademyUserQuestion: async (payload) => {
        if (!db) return { ok: false, reason: 'db_unavailable' };
        const uid = get().uid ?? auth?.currentUser?.uid ?? null;
        if (!uid) return { ok: false, reason: 'unauthenticated' };
        if (get().uid !== uid) {
          set({ uid });
        }

        // 本番はまず認証済み API 経由を優先（rules 差分や権限揺れの影響を受けにくい）
        const apiResult = await submitAcademyQuestionViaApi(payload);
        if (apiResult.ok) return { ok: true };
        if (apiResult.reason === 'unauthenticated') {
          return { ok: false, reason: apiResult.reason };
        }
        // API 側が 401/500 で失敗する運用環境向けに、クライアント直書きへフォールバック
        const shouldTryClientFallback =
          typeof apiResult.reason === 'string' &&
          (apiResult.reason.startsWith('api_401') || apiResult.reason.startsWith('api_500'));
        if (!shouldTryClientFallback && apiResult.reason?.startsWith('api_')) {
          return { ok: false, reason: apiResult.reason };
        }

        const questionRef = doc(collection(db, ACADEMY_QUESTIONS_COLLECTION));
        const normalizedChoices = Array.isArray(payload.choices)
          ? payload.choices.map((c) => String(c ?? '').trim()).filter(Boolean).slice(0, 4)
          : [];
        const safeAnswerIndex = Number.isInteger(payload.answerIndex)
          ? Math.max(0, Math.min(3, payload.answerIndex))
          : 0;
        const safeQuestion = String(payload.question ?? '').trim();
        if (!safeQuestion || normalizedChoices.length !== 4) {
          return { ok: false, reason: 'invalid_payload' };
        }
        try {
          const fallbackDoc: Record<string, unknown> = {
            id: questionRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'published',
            // authorUid は必ず auth.uid を採用（外部入力値は使わない）
            authorUid: uid,
            authorName: String(get().displayName ?? '').trim() || '匿名ユーザー',
            goodCount: 0,
            badCount: 0,
            question: safeQuestion,
            choices: normalizedChoices,
            answerIndex: safeAnswerIndex,
            explanation: String(payload.explanation ?? '').trim(),
            keywords: Array.isArray(payload.keywords)
              ? payload.keywords.map((k) => String(k ?? '').trim()).filter(Boolean).slice(0, 8)
              : [],
          };
          if (payload.bigCategory !== undefined) fallbackDoc.bigCategory = payload.bigCategory;
          if (payload.subCategory !== undefined) fallbackDoc.subCategory = payload.subCategory;
          if (payload.subjectText !== undefined) fallbackDoc.subjectText = payload.subjectText;
          if (payload.detailText !== undefined) fallbackDoc.detailText = payload.detailText;

          await setDoc(questionRef, fallbackDoc);
          return { ok: true };
        } catch (error) {
          console.error('[academy_questions] add failed:', error);
          const code = String((error as { code?: string } | undefined)?.code ?? 'firestore_add_failed');
          return {
            ok: false,
            reason: `${apiResult.reason ?? 'api_failed'};fallback_${code}`,
          };
        }
      },
      updateAcademyUserQuestion: async (id, patch) => {
        if (!db) return false;
        const uid = get().uid ?? auth?.currentUser?.uid ?? null;
        if (!uid) return false;
        if (get().uid !== uid) {
          set({ uid });
        }
        const ref = doc(db, ACADEMY_QUESTIONS_COLLECTION, id);
        try {
          const snap = await getDoc(ref);
          if (!snap.exists()) return false;
          const current = normalizeAcademyQuestion(id, snap.data());
          if (!current) return false;
          if (current.status === 'deleted') return false;
          const nextChoices = Array.isArray(patch.choices)
            ? patch.choices.map((c) => String(c ?? '').trim()).filter(Boolean).slice(0, 4)
            : current.choices;
          const nextAnswer = typeof patch.answerIndex === 'number'
            ? Math.max(0, Math.min(3, patch.answerIndex))
            : current.answerIndex;
          await setDoc(ref, {
            question: patch.question !== undefined ? String(patch.question).trim() : current.question,
            choices: nextChoices.length === 4 ? nextChoices : current.choices,
            answerIndex: nextAnswer,
            explanation: patch.explanation !== undefined ? String(patch.explanation).trim() : current.explanation,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          if (isAcademyAdminUid(uid) && current.authorUid !== uid) {
            await writeAcademyAdminLog({
              actorUid: uid,
              actorName: String(get().displayName ?? '').trim() || 'admin',
              action: 'update',
              targetQuestionId: id,
              beforeStatus: current.status,
              afterStatus: current.status,
            });
          }
          return true;
        } catch (error) {
          console.error('[academy_questions] update failed:', error);
          return false;
        }
      },
      deleteAcademyUserQuestion: async (id) => {
        if (!db) return false;
        const uid = get().uid ?? auth?.currentUser?.uid ?? null;
        if (!uid) return false;
        if (get().uid !== uid) {
          set({ uid });
        }
        const ref = doc(db, ACADEMY_QUESTIONS_COLLECTION, id);
        try {
          const snap = await getDoc(ref);
          if (!snap.exists()) return false;
          const current = normalizeAcademyQuestion(id, snap.data());
          if (!current) return false;
          if (current.status === 'deleted') return true;
          await setDoc(ref, {
            status: 'deleted',
            updatedAt: serverTimestamp(),
          }, { merge: true });
          if (isAcademyAdminUid(uid)) {
            await writeAcademyAdminLog({
              actorUid: uid,
              actorName: String(get().displayName ?? '').trim() || 'admin',
              action: 'soft_delete',
              targetQuestionId: id,
              beforeStatus: current.status,
              afterStatus: 'deleted',
            });
          }
          return true;
        } catch (error) {
          console.error('[academy_questions] delete failed:', error);
          return false;
        }
      },
      getAcademyUserQuestions: () => get().academyUserQuestions ?? [],
      refreshAcademyQuestions: async () => {
        await refreshAcademyQuestionsFromFirestore();
      },
      isAcademyAdmin: () => isAcademyAdminUid(get().uid),

      // ===== Lecture History Management =====
      
      saveLectureHistory: (script, imageUrl) => {
        const state = get();
        
        // 重複チェック: 同じ内容の講義が既に存在する場合は追加しない
        const isDuplicate = state.lectureHistory.some(
          (history) =>
            history.script.sourceText === script.sourceText &&
            history.script.tone === script.tone
        );
        
        if (isDuplicate) {
          console.log('Lecture history duplicate detected, skipping save');
          return;
        }
        
        const newHistory: LectureHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          script,
          imageUrl,
          createdAt: new Date().toISOString(),
        };
        
        // 新しい履歴を追加し、最大保存数を超える場合は古い履歴を削除
        const updatedHistory = [newHistory, ...state.lectureHistory];
        const limitedHistory = updatedHistory.slice(0, LIMITS.LECTURE_HISTORY.MAX_ITEMS);
        
        set({
          lectureHistory: limitedHistory,
        });

        // クラウドにも保存
        if (db && state.uid) {
          (async () => {
            try {
              const colRef = collection(db, 'users', state.uid!, 'lecture_history');
              await setDoc(doc(colRef, newHistory.id), newHistory, { merge: true });
            } catch (e) {
              console.error('Cloud lecture history save error:', e);
            }
          })();
        }
      },
      
      getLectureHistory: () => {
        return get().lectureHistory;
      },
      
      deleteLectureHistory: (id) => {
        const state = get();
        set({
          lectureHistory: state.lectureHistory.filter(h => h.id !== id),
        });
        
        // クラウドからも削除
        if (db && state.uid) {
          (async () => {
            try {
              const colRef = collection(db, 'users', state.uid!, 'lecture_history');
              await deleteDoc(doc(colRef, id));
            } catch (e) {
              console.error('Cloud lecture history delete error:', e);
            }
          })();
        }
      },
      
      // ===== Quiz & Rewards =====
      
      calculateResult: (correctCount, totalQuestions, isAdWatched) => {
        const state = get();
        const isPerfect = correctCount === totalQuestions;
        
        let baseCoins = REWARDS.QUEST_CLEAR.BASE_COINS; // スキャン/通常クエスト共通 +3
        if (isPerfect) {
          baseCoins += REWARDS.QUEST_CLEAR.PERFECT_BONUS; // パーフェクト +2
        }
        
        const shouldDouble = state.isVIP || isAdWatched;
        const earnedCoins = shouldDouble ? baseCoins * 2 : baseCoins;
        
        // マップ機能廃止: 冒険での距離報酬は付与しない
        const earnedDistance = 0;
        
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
        void get().syncWithCloud();
      },
      
      // ===== Quiz History =====
      
      saveQuizHistory: async (quiz, result) => {
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
      
      // クイズ履歴の削除
      deleteQuizHistory: async (historyId: string) => {
        const state = get();
        
        // ローカルから削除
        const updatedHistory = state.quizHistory.filter(h => h.id !== historyId);
        set({ quizHistory: updatedHistory });
        
        // クラウドからも削除
        const effectiveUid = state.uid ?? auth?.currentUser?.uid ?? null;
        if (db && effectiveUid) {
          try {
            const colRef = collection(db, 'users', effectiveUid, 'quiz_history');
            await deleteDoc(doc(colRef, historyId));
            console.log('[deleteQuizHistory] Successfully deleted from Firestore:', historyId);
          } catch (e) {
            console.error('[deleteQuizHistory] Cloud quiz history delete error:', e);
          }
        }
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
      
      // Speed Rushベストタイム管理
      updateSpeedRushBestTime: (quizId: string, totalTime: number) => {
        const state = get();
        const currentBest = state.speedRushBestTimes[quizId];
        
        // ベストタイムが未設定、または今回のタイムがより速い場合のみ更新
        if (currentBest === undefined || totalTime < currentBest) {
          set({
            speedRushBestTimes: {
              ...state.speedRushBestTimes,
              [quizId]: totalTime,
            },
          });
        }
      },
      
      getSpeedRushBestTime: (quizId: string) => {
        const state = get();
        return state.speedRushBestTimes[quizId];
      },
      
      // ===== Gacha =====
      
      pullGacha: (useTicket = false) => {
        const state = get();
        
        if (!isLocalDevelopment()) {
          if (useTicket) {
            if (state.tickets < 1) {
              return { error: ERROR_MESSAGES.INSUFFICIENT_TICKETS };
            }
          } else {
            if (state.coins < GACHA.COST.SINGLE) {
              return { error: ERROR_MESSAGES.INSUFFICIENT_COINS };
            }
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
        
        const itemsOfRarity = ALL_ITEMS.filter(
          (item) => item.rarity === selectedRarity && !item.gachaExcluded
        );
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

        // ガチャ結果（コイン消費・所持品追加）をクラウドへ即時同期
        if (!suppressGachaCloudSync) {
          void get().syncWithCloud();
        }
        
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
        
        suppressGachaCloudSync = true;
        try {
          for (let i = 0; i < 10; i++) {
            const tempCoins = get().coins;
            set({ coins: tempCoins + GACHA.COST.SINGLE });
            
            const result = get().pullGacha(false);
            
            if (!('error' in result)) {
              results.push(result);
            }
          }
        } finally {
          suppressGachaCloudSync = false;
        }

        // 10連結果を最後に1回だけ同期（競合による巻き戻り防止）
        void get().syncWithCloud();
        
        return results;
      },
      
      // ===== Resource Management =====
      
      addCoins: (amount) => {
        set(state => ({ coins: state.coins + amount }));
        void get().syncWithCloud();
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
        if (isLocalDevelopment()) return true;
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

        // 装備変更をクラウドへ同期（リロード時に外れるのを防ぐ）
        void get().syncWithCloud();
        
        return true;
      },
      
      unequipItem: (category) => {
        set(state => ({
          equipment: {
            ...state.equipment,
            [category]: undefined,
          },
        }));

        // 装備解除もクラウドへ同期
        void get().syncWithCloud();
      },
      
      // ===== VIP =====
      
      activateVIP: (_expiresAt) => {
        // VIP機能は廃止（互換のため残すが何もしない）
        set({ isVIP: false, vipExpiresAt: undefined });
      },
      
      deactivateVIP: () => {
        set({ isVIP: false, vipExpiresAt: undefined });
      },
      
      checkVIPStatus: () => {
        return false;
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

      setDisplayName: (name) => {
        const normalized = String(name ?? '').trim().slice(0, 12);
        if (!normalized) return;
        set({ displayName: normalized });
      },

      // ===== すうひもち SNS タイムライン MVP =====

      setSuhimochiInterests: (interests) => {
        set({ suhimochiInterests: interests });
      },

      addSuhimochiKeywords: (words, source = 'user') => {
        const now = Date.now();
        const list = get().suhimochiKeywords ?? [];
        const kwMap = new Map(list.map((k) => [k.word, k]));
        for (const word of words) {
          if (!word || word.length < 2) continue;
          const existing = kwMap.get(word);
          if (existing) {
            kwMap.set(word, { ...existing, weight: Math.min(100, existing.weight + 10), lastUsed: now });
          } else {
            kwMap.set(word, { word, weight: 30, lastUsed: now, source });
          }
        }
        set({ suhimochiKeywords: Array.from(kwMap.values()) });
      },

      decaySuhimochiKeywords: () => {
        const DECAY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7日
        const now = Date.now();
        const updated = (get().suhimochiKeywords ?? [])
          .map((k) =>
            now - k.lastUsed >= DECAY_THRESHOLD_MS && k.weight > 0
              ? { ...k, weight: Math.max(0, k.weight - 5) }
              : k
          )
          .filter((k) => k.weight > 0);
        set({ suhimochiKeywords: updated });
      },

      addSuhimochiTimelinePost: (post) => {
        set((state) => ({
          suhimochiTimeline: [post, ...(state.suhimochiTimeline ?? [])].slice(0, 50),
        }));
      },

      removeSuhimochiTimelinePost: (id) => {
        set((state) => ({
          suhimochiTimeline: (state.suhimochiTimeline ?? []).filter((p) => p.id !== id),
        }));
      },

      updateSuhimochiIntimacy: (gain) => {
        const state = get();
        const prev = state.suhimochiIntimacy ?? {
          points: 0,
          level: 1 as const,
          totalMessages: 0,
        };
        const newPoints = Math.min(1000, prev.points + gain);
        const calcLevel = (pts: number): 1 | 2 | 3 | 4 | 5 => {
          if (pts >= 850) return 5;
          if (pts >= 650) return 4;
          if (pts >= 400) return 3;
          if (pts >= 200) return 2;
          return 1;
        };
        const newLevel = calcLevel(newPoints);
        const leveledUp = newLevel > prev.level;
        set({
          suhimochiIntimacy: {
            points: newPoints,
            level: newLevel,
            totalMessages: prev.totalMessages + 1,
          },
        });
        return { newLevel, leveledUp };
      },

      appendSuhimochiGeminiHistory: (userText, reply) => {
        const MAX_TURNS = 20; // 直近20往復を保持
        const state = get();
        const next: GeminiMessage[] = [
          ...state.suhimochiGeminiHistory,
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: reply }] },
        ];
        // 上限を超えたら古いものから削除（2件ずつ = 1往復単位で削除）
        const trimmed =
          next.length > MAX_TURNS * 2 ? next.slice(next.length - MAX_TURNS * 2) : next;
        set({ suhimochiGeminiHistory: trimmed });
      },

      appendSuhimochiGeminiLetterReplyHistory: (letterText, userText, reply) => {
        const MAX_MESSAGES = 41; // 通常40件(20往復) + 手紙文脈1件を許容
        const state = get();
        const normalizedLetter = String(letterText ?? '').trim();
        const next: GeminiMessage[] = [
          ...state.suhimochiGeminiHistory,
          { role: 'model', parts: [{ text: normalizedLetter }] },
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: reply }] },
        ];
        const trimmed =
          next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
        set({ suhimochiGeminiHistory: trimmed });
      },

      appendSuhimochiGeminiRequestPreamble: (bridgeUserText, modelQuestion) => {
        const MAX_TURNS = 20;
        const state = get();
        const next: GeminiMessage[] = [
          ...state.suhimochiGeminiHistory,
          { role: 'user', parts: [{ text: bridgeUserText }] },
          { role: 'model', parts: [{ text: modelQuestion }] },
        ];
        const trimmed =
          next.length > MAX_TURNS * 2 ? next.slice(next.length - MAX_TURNS * 2) : next;
        set({ suhimochiGeminiHistory: trimmed });
      },

      setSuhimochiOpeningHistory: (_openingText) => {
        // 意図的に何もしない（空実装）
        // 開口メッセージを履歴に追加すると訪問ごとにmodelメッセージが積み重なるため
      },

      clearSuhimochiGeminiHistory: () => {
        set({ suhimochiGeminiHistory: [] });
      },

      updateSuhimochiLastVisit: (message) => {
        set({
          suhimochiLastMessage: message,
          suhimochiLastVisitedAt: Date.now(),
        });
      },

      setSuhimochiTodayState: (todayState) => {
        set({ suhimochiTodayState: todayState });
      },

      setSuhimochiCurrentRequest: (req) => {
        set({ suhimochiCurrentRequest: req });
      },

      answerSuhimochiRequest: () => {
        set({ suhimochiCurrentRequest: null });
      },

      registerAnataZukanWords: (entries) => {
        const state = get();
        const now = new Date().toISOString();
        const current = Array.isArray(state.anataZukanEntries) ? state.anataZukanEntries : [];
        const byKey = new Map<string, AnataZukanEntry>(
          current.map((e) => [e.normalizedName, e] as const),
        );

        const normalizeName = (v: string): string =>
          v
            .normalize('NFKC')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\p{L}\p{N}_-]/gu, '')
            .slice(0, 40);

        for (const raw of entries ?? []) {
          const name = String(raw.name ?? '').trim();
          if (!name || name.length < 2) continue;
          if (raw.confidence < 0.7) continue;
          const likePoint = String((raw as { likePoint?: unknown }).likePoint ?? '').trim();

          const normalizedName = normalizeName(name);
          if (!normalizedName) continue;
          const key = normalizedName;
          const prev = byKey.get(key);

          if (prev) {
            byKey.set(key, {
              ...prev,
              relation: raw.confidence >= prev.confidence ? raw.relation : prev.relation,
              category: raw.confidence >= prev.confidence ? raw.category : prev.category,
              confidence: Math.max(prev.confidence, raw.confidence),
              sourceText: raw.sourceText || prev.sourceText,
              likePoint: likePoint || prev.likePoint,
              mentionCount: prev.mentionCount + 1,
              updatedAt: now,
            });
          } else {
            byKey.set(key, {
              id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name,
              normalizedName,
              relation: raw.relation,
              category: raw.category,
              likePoint: likePoint || undefined,
              confidence: raw.confidence,
              sourceText: raw.sourceText,
              mentionCount: 1,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        set({ anataZukanEntries: Array.from(byKey.values()) });
      },

      updateAnataZukanEntry: (id, patch) => {
        set((state) => ({
          anataZukanEntries: state.anataZukanEntries.map((e) => {
            if (e.id !== id) return e;
            const nextName = patch.name !== undefined ? String(patch.name).trim() : e.name;
            const nextNormalized = nextName
              .normalize('NFKC')
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^\p{L}\p{N}_-]/gu, '')
              .slice(0, 40) || e.normalizedName;
            const nextLikePointRaw = patch.likePoint !== undefined ? String(patch.likePoint ?? '').trim() : (e.likePoint ?? '');
            const nextLikePoint = nextLikePointRaw ? nextLikePointRaw.slice(0, 120) : undefined;
            return {
              ...e,
              name: nextName || e.name,
              normalizedName: nextNormalized,
              relation: patch.relation ?? e.relation,
              category: patch.category ?? e.category,
              likePoint: nextLikePoint,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      deleteAnataZukanEntry: (id) => {
        set((state) => ({
          anataZukanEntries: state.anataZukanEntries.filter((e) => e.id !== id),
        }));
      },

      // ===== Utility =====
      
      reset: () => {
        const hydrated = get().hydrationCompleted;
        set({
          ...initialState,
          hydrationCompleted: hydrated,
        });
      },

      // ログアウト時にゲストのスキャン回数を保持したままリセット
      resetPreserveGuestUsage: () => {
        const { dailyScanCount, lastScanDate, bonusScanBalance, hydrationCompleted } = get();
        set({
          ...initialState,
          dailyScanCount,
          lastScanDate,
          bonusScanBalance,
          hydrationCompleted,
        });
      },
    }),
    {
      name: 'potenote-scanner-v2',
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = { ...((persistedState as Partial<GameState> | undefined) ?? {}) };
        // academyUserQuestions は常に「公式 + ユーザー投稿」のFirestoreから再構成する。
        delete (persisted as Partial<GameState>).academyUserQuestions;
        return {
          ...currentState,
          ...persisted,
          // VIP機能は廃止（永続化データがあっても無効化）
          isVIP: false,
          vipExpiresAt: undefined,
          academyUserQuestions: mergeSeedAndPostedAcademyQuestions([], []),
        };
      },
      onRehydrateStorage: () => (state) => {
        // ストレージから復元する際に翻訳履歴をクリーンアップ
        if (state && state.translationHistory && state.translationHistory.length > LIMITS.TRANSLATION_HISTORY.MAX_ITEMS) {
          console.log(`Cleaning up translation history: ${state.translationHistory.length} -> ${LIMITS.TRANSLATION_HISTORY.MAX_ITEMS}`);
          state.translationHistory = state.translationHistory.slice(0, LIMITS.TRANSLATION_HISTORY.MAX_ITEMS);
        }
        if (state && state.lectureHistory && state.lectureHistory.length > LIMITS.LECTURE_HISTORY.MAX_ITEMS) {
          console.log(`Cleaning up lecture history: ${state.lectureHistory.length} -> ${LIMITS.LECTURE_HISTORY.MAX_ITEMS}`);
          state.lectureHistory = state.lectureHistory.slice(0, LIMITS.LECTURE_HISTORY.MAX_ITEMS);
        }
        // NOTE:
        // 単語HPの最大値を 2 に統一するため、復元時に上限をクランプする。
        if (state && Array.isArray(state.wordCollectionScans)) {
          state.wordCollectionScans = state.wordCollectionScans.map((scan) => ({
            ...scan,
            words: Array.isArray(scan.words)
              ? scan.words.map((w) => ({ ...w, hp: Math.max(0, Math.min(2, Number(w.hp ?? 0))) }))
              : [],
          }));
        }
        if (state && !Array.isArray(state.wordDexOrder)) {
          state.wordDexOrder = [];
          useGameStore.setState({ wordDexOrder: [] });
        }
        if (state) {
          const mergedDictionaries = mergeDefaultDictionaries(state.wordDexDictionaries);
          if (!Array.isArray(state.wordDexDictionaries) || mergedDictionaries.length !== state.wordDexDictionaries.length) {
            state.wordDexDictionaries = mergedDictionaries;
            useGameStore.setState({ wordDexDictionaries: mergedDictionaries });
          }
        }
        if (state && !Array.isArray(state.wordDexWords)) {
          state.wordDexWords = [];
          useGameStore.setState({ wordDexWords: [] });
        }
        // ローカル開発時は常に全装備品を所持済みに強制上書き
        if (isLocalDevelopment() && state) {
          state.inventory = DEV_INVENTORY;
          useGameStore.setState({ inventory: DEV_INVENTORY });
        }
        // 旧バージョンで永続化されていたOCR本文は破棄（保存しない方針）
        if (state && typeof state === 'object') {
          delete (state as unknown as Record<string, unknown>).scanOcrText;
          delete (state as unknown as Record<string, unknown>).scanStructuredOCR;
          // アカデミー問題は永続化せず、公式 + ユーザー投稿Firestoreから再構成する
          delete (state as unknown as Record<string, unknown>).academyUserQuestions;
          state.academyUserQuestions = mergeSeedAndPostedAcademyQuestions([], []);
        }
        // すうひもち: 旧永続データにフィールドが無いと append/update 時に例外になり、会話UIが誤ってエラー表示する
        if (state) {
          const patch: Partial<GameState> = {};
          if (!state.suhimochiIntimacy || typeof state.suhimochiIntimacy.points !== 'number') {
            patch.suhimochiIntimacy = { points: 0, level: 1, totalMessages: 0 };
          }
          if (!Array.isArray(state.suhimochiGeminiHistory)) {
            patch.suhimochiGeminiHistory = [];
          }
          if (typeof state.suhimochiLastMessage !== 'string') {
            patch.suhimochiLastMessage = '';
          }
          if (typeof state.suhimochiLastVisitedAt !== 'number') {
            patch.suhimochiLastVisitedAt = 0;
          }
          if (!Array.isArray(state.suhimochiInterests)) {
            patch.suhimochiInterests = [];
          }
          if (!Array.isArray(state.suhimochiKeywords)) {
            patch.suhimochiKeywords = [];
          }
          if (!Array.isArray(state.suhimochiTimeline)) {
            patch.suhimochiTimeline = [];
          }
          if (!Array.isArray(state.anataZukanEntries)) {
            patch.anataZukanEntries = [];
          }
          if (state.suhimochiCurrentRequest === undefined) {
            patch.suhimochiCurrentRequest = null;
          } else if (state.suhimochiCurrentRequest !== null) {
            const r = state.suhimochiCurrentRequest;
            if (
              typeof r !== 'object' ||
              typeof r.id !== 'string' ||
              typeof r.question !== 'string' ||
              typeof r.timestamp !== 'number' ||
              typeof r.answered !== 'boolean' ||
              typeof r.type !== 'string'
            ) {
              patch.suhimochiCurrentRequest = null;
            }
          }
          if (Object.keys(patch).length > 0) {
            useGameStore.setState(patch);
          }
        }
        // アカデミー固定問題のマージは persist の merge オプションで実施
        useGameStore.setState({ hydrationCompleted: true });
      },
      partialize: (state) => ({
        coins: state.coins,
        displayName: state.displayName,
        tickets: state.tickets,
        stamina: state.stamina,
        dailyScanCount: state.dailyScanCount,
        lastScanDate: state.lastScanDate,
        bonusScanBalance: state.bonusScanBalance,
        dailyWordCollectionScanCount: state.dailyWordCollectionScanCount,
        lastWordCollectionScanDate: state.lastWordCollectionScanDate,
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
        wordCollectionScans: state.wordCollectionScans,
        wordDexOrder: state.wordDexOrder,
        wordDexDictionaries: state.wordDexDictionaries,
        wordDexWords: state.wordDexWords,
        lectureHistory: state.lectureHistory,
        scanType: state.scanType,
        translationResult: state.translationResult,
        generatedQuiz: state.generatedQuiz,
        scanImageUrl: state.scanImageUrl,
        lastScanQuizId: state.lastScanQuizId,

        suhimochiIntimacy: state.suhimochiIntimacy,
        suhimochiGeminiHistory: state.suhimochiGeminiHistory,
        suhimochiLastMessage: state.suhimochiLastMessage,
        suhimochiLastVisitedAt: state.suhimochiLastVisitedAt,
        suhimochiTodayState: state.suhimochiTodayState,
        suhimochiCurrentRequest: state.suhimochiCurrentRequest,
        suhimochiInterests: state.suhimochiInterests,
        suhimochiKeywords: state.suhimochiKeywords,
        suhimochiTimeline: state.suhimochiTimeline,
        anataZukanEntries: state.anataZukanEntries,
      }),
    }
  )
);

// ===== Selectors =====

export const selectIsVIP = (_state: GameState) => false;

export const selectCanScan = (state: GameState) => {
  const today = getTodayString();
  const dailyScanCount = state.lastScanDate !== today ? 0 : state.dailyScanCount;
  const freeRemaining = Math.max(0, LIMITS.FREE_USER.DAILY_SCAN_LIMIT - dailyScanCount);
  return freeRemaining + (state.bonusScanBalance ?? 0) > 0;
};

export const selectRemainingScanCount = (state: GameState) => {
  // ローカル環境では制限を外す
  if (isLocalDevelopment()) return Infinity;
  const today = getTodayString();
  const dailyScanCount = state.lastScanDate !== today ? 0 : state.dailyScanCount;
  const freeRemaining = Math.max(0, LIMITS.FREE_USER.DAILY_SCAN_LIMIT - dailyScanCount);
  return freeRemaining + (state.bonusScanBalance ?? 0);
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
