'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Flame,
  BookOpen,
  PenSquare,
  FolderOpen,
  Lock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useToast } from '@/components/ui/Toast';
import { MinnanoMondaiScreen } from '@/components/screens/MinnanoMondaiScreen';
import type { AcademyUserQuestion, QuizHistory } from '@/types';

// ============================================================
// 型
// ============================================================

type AcademySubview =
  | 'top'
  | 'everyone'
  | 'mine'
  | 'create_seed_list'   // ① テーマ選択
  | 'create_keyword'     // ② キーワード選択
  | 'create_category'    // ③ カテゴリ選択
  | 'create_detail'      // ④ 詳細入力（★新規追加）
  | 'create_editor'      // ⑤ 編集
  | 'create_done';       // ⑥ 完了

interface AcademyTheme {
  id: string;
  summary: string;
  keywords: string[];
}

interface KeywordCandidate {
  id: string;
  label: string;
  type: 'theme' | 'option';
}

interface DraftMcq {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

interface AcademyScreenProps {
  onBack: () => void;
}

// ============================================================
// カテゴリ定義
// ============================================================

const CATEGORIES: { label: string; sub: string[] }[] = [
  { label: '文系学問', sub: ['日本史', '世界史', '地理', '現代文', '古文', '漢文', '政治経済', '倫理'] },
  { label: '理系学問', sub: ['数学', '物理', '化学', '生物', '地学'] },
  { label: '言語',     sub: ['英単語', '英文法', '英会話', 'リーディング', 'リスニング', '韓国語', '中国語', 'その他言語'] },
  { label: '資格',     sub: ['宅建', '簿記', 'ITパスポート', '基本情報', '英検', 'TOEIC', 'その他資格'] },
  { label: 'エンタメ', sub: ['漫画・アニメ', 'ゲーム', '映画', 'ドラマ', '小説', '音楽'] },
  { label: '趣味・教養', sub: ['雑学', '心理学', '哲学', 'アート', 'スポーツ', '料理', '健康'] },
  { label: '生活',     sub: ['一般常識', 'マナー', '社会', 'ニュース'] },
  { label: 'オリジナル', sub: ['オリジナル'] },
];

// サブカテゴリごとの代表的な題材候補
const SUBCATEGORY_SUGGESTIONS: Record<string, string[]> = {
  '日本史':     ['縄文時代', '弥生時代', '奈良時代', '平安時代', '鎌倉幕府', '江戸幕府', '明治維新', '大正デモクラシー'],
  '世界史':     ['古代ローマ', 'フランス革命', '産業革命', '第一次世界大戦', '冷戦', 'ルネサンス'],
  '地理':       ['気候区分', '地形', '人口問題', '資源エネルギー', '農業', '工業'],
  '数学':       ['微分積分', '線形代数', '確率統計', '数列', '三角関数', '複素数'],
  '物理':       ['力学', '熱力学', '電磁気学', '波動', '量子力学', '相対性理論'],
  '化学':       ['有機化学', '無機化学', '電気化学', '高分子化学', '熱化学'],
  '生物':       ['細胞', 'DNA', '進化', '生態系', '光合成', '神経'],
  '英単語':     ['TOEIC頻出', '大学受験', 'ビジネス英語', '日常会話', 'イディオム'],
  '英文法':     ['時制', '仮定法', '関係代名詞', '不定詞', '分詞', '助動詞'],
  '韓国語':     ['ハングル文字', '基本文法', 'K-POP関連', '日常会話'],
  '中国語':     ['ピンイン', '声調', '基本文法', 'HSK'],
  '宅建':       ['民法', '宅建業法', '都市計画法', '建築基準法', '税法'],
  '簿記':       ['仕訳', '財務諸表', '原価計算', '損益計算書', '貸借対照表'],
  'ITパスポート':['情報セキュリティ', 'ネットワーク', 'データベース', 'プロジェクト管理'],
  '基本情報':   ['アルゴリズム', 'データ構造', 'OS', 'ネットワーク', 'SQL'],
  '英検':       ['英検2級', '英検準1級', '英検1級', '英検3級'],
  'TOEIC':      ['リスニング対策', 'リーディング対策', 'ビジネス英語', '文法問題'],
  '漫画・アニメ': ['ワンピース', '鬼滅の刃', '呪術廻戦', '進撃の巨人', 'ドラゴンボール', 'ナルト', 'ブリーチ', 'ハンターハンター', 'スラムダンク', '推しの子'],
  'ゲーム':     ['ポケモン', 'ゼルダの伝説', 'ファイナルファンタジー', 'ドラゴンクエスト', 'モンスターハンター', 'スプラトゥーン'],
  '映画':       ['マーベル', 'ジブリ', 'ディズニー', 'SF映画', 'ホラー映画', '邦画'],
  'ドラマ':     ['朝ドラ', '大河ドラマ', '韓国ドラマ', '海外ドラマ'],
  '小説':       ['純文学', 'ミステリー', 'SF小説', 'ライトノベル', '歴史小説'],
  '音楽':       ['J-POP', 'K-POP', 'クラシック', 'ロック', 'ジャズ', 'ボカロ'],
  '雑学':       ['動物', '食べ物', '地理', '宇宙', '人体', '言葉'],
  '心理学':     ['認知心理学', '社会心理学', '発達心理学', '臨床心理学'],
  '哲学':       ['西洋哲学', '東洋哲学', '倫理学', '存在論', '認識論'],
  'スポーツ':   ['野球', 'サッカー', 'バスケ', '陸上', 'テニス', '水泳', 'オリンピック'],
  '料理':       ['和食', '洋食', '中華', 'お菓子', '調理技法', '食材'],
};

// ============================================================
// 定数
// ============================================================

const CREATION_POLICY = {
  version: 'v1',
  quickNotice: '第三者の著作物の転載は禁止です。公開前に内容を確認してください。',
  checks: [
    { id: 'noRepost', label: '転載していません' },
    { id: 'reviewed', label: '内容を確認しました' },
  ] as const,
};

/** テーマ選択・自分の問題 など一覧の1ページあたり件数 */
const ACADEMY_LIST_PAGE_SIZE = 5;

/** すうひもちアカデミー共通ルート背景（写真の上に重ねる淡い紫＋暖色。主張を抑え気味に） */
const academyScreenRootBg: CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse 120% 55% at 50% -8%, rgba(255, 220, 190, 0.06) 0%, transparent 58%), linear-gradient(to bottom, rgba(53,45,82,0.22) 0%, rgba(66,58,104,0.16) 45%, rgba(78,70,128,0.12) 100%)',
};

const academyBackgroundImageUrl = '/images/backgrounds/gate.png';

const AcademyScreenBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <div
      className="absolute -inset-4 bg-cover bg-center"
      style={{
        backgroundImage: `url("${academyBackgroundImageUrl}")`,
        filter: 'blur(1px)',
      }}
    />
    {/* 写真の主張を抑え、全体を白〜ラベンダー寄りに寄せる */}
    <div
      className="absolute inset-0 z-[1]"
      style={{
        background:
          'linear-gradient(to bottom, rgba(255,255,255,0.38) 0%, rgba(248,245,252,0.38) 40%, rgba(242,238,250,0.38) 100%)',
      }}
    />
  </div>
);

// ============================================================
// キーワード抽出（強化版フィルタ）
// ============================================================

const KEYWORD_STOPWORDS = new Set([
  'これ', 'それ', 'あれ', 'どれ', 'ため', 'こと', 'もの',
  'です', 'ます', 'する', 'した', 'れる', 'られる',
  'about', 'with', 'from', 'this', 'that', 'what', 'when',
  'where', 'which', 'whose', 'there', 'their', 'have', 'has',
  'been', 'were', 'will', 'would', 'could', 'should',
]);

const KEYWORD_EXCLUDE_PATTERNS = [
  'ですか', 'ました', 'している', 'である', 'について', 'に関して',
  'として', 'とは何', 'された', 'される', 'しており',
  '？', '。', '、',
];

const JP_PARTICLES = [
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'や', 'の', 'も', 'から', 'まで', 'より', 'など',
];

const SENTENCE_ENDINGS = ['です', 'ます', 'でした', 'ました', 'した', 'して', 'する', 'である'];

const isLikelyPhrase = (value: string): boolean => {
  if (value.length >= 12) return true;
  if (JP_PARTICLES.some((p) => value.includes(p)) && value.length >= 7) return true;
  if (SENTENCE_ENDINGS.some((s) => value.endsWith(s))) return true;
  const hiraOnly = value.replace(/[ぁ-ん]/g, '');
  const hiraRatio = value.length > 0 ? (value.length - hiraOnly.length) / value.length : 0;
  if (hiraRatio >= 0.7 && value.length >= 7) return true;
  return false;
};

const extractKeywordCandidates = (text: string): string[] => {
  const src = String(text ?? '').normalize('NFKC');
  const chunks = src.match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}a-zA-Z0-9][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}a-zA-Z0-9_-]{1,24}/gu
  ) ?? [];
  const uniq = Array.from(new Set(chunks.map((w) => w.trim()).filter(Boolean)));

  return uniq.filter((w) => {
    if (KEYWORD_STOPWORDS.has(w.toLowerCase())) return false;
    if (/^\d+$/.test(w)) return false;
    if (w.length <= 1) return false;
    if (w.length >= 12) return false;
    if (KEYWORD_EXCLUDE_PATTERNS.some((p) => w.includes(p))) return false;
    if (isLikelyPhrase(w)) return false;
    return true;
  });
};

// ============================================================
// 履歴からテーマ一覧を生成
// ============================================================

const buildThemesFromHistory = (historyList: QuizHistory[]): AcademyTheme[] => {
  return historyList
    .filter((h) => {
      const summary = String(h.quiz?.summary ?? '').trim();
      const keywords = Array.isArray(h.quiz?.keywords) ? h.quiz.keywords : [];
      return summary.length > 0 && keywords.length > 0;
    })
    .map((h) => ({
      id: h.id,
      summary: String(h.quiz.summary ?? '').trim(),
      keywords: (Array.isArray(h.quiz.keywords) ? h.quiz.keywords : []).filter(Boolean),
    }));
};

const extractAllKeywordsFromTheme = (
  theme: AcademyTheme,
  historyList: QuizHistory[]
): KeywordCandidate[] => {
  const history = historyList.find((h) => h.id === theme.id);
  if (!history) {
    return theme.keywords
      .map((k, idx) => ({ id: `theme-${idx}-${k}`, label: k.trim(), type: 'theme' as const }))
      .filter((k) => !!k.label);
  }

  const questions = Array.isArray(history.quiz?.questions) ? history.quiz.questions : [];
  const themeFirst: KeywordCandidate[] = theme.keywords
    .map((k, idx) => ({ id: `theme-${idx}-${k}`, label: String(k ?? '').trim(), type: 'theme' as const }))
    .filter((k) => !!k.label && !isLikelyPhrase(k.label));

  const optionCandidates = questions.flatMap((q, qIdx) =>
    (Array.isArray(q.options) ? q.options : []).flatMap((opt, oIdx) =>
      extractKeywordCandidates(opt).map((word, wIdx) => ({
        id: `opt-${qIdx}-${oIdx}-${wIdx}-${word}`,
        label: word,
        type: 'option' as const,
      }))
    )
  );

  const byNorm = new Map<string, KeywordCandidate>();
  for (const item of [...themeFirst, ...optionCandidates]) {
    const norm = item.label.toLowerCase();
    if (!norm) continue;
    if (!byNorm.has(norm)) {
      byNorm.set(norm, item);
    } else {
      const current = byNorm.get(norm)!;
      if (current.type !== 'theme' && item.type === 'theme') {
        byNorm.set(norm, item);
      }
    }
  }
  return Array.from(byNorm.values()).slice(0, 24);
};

// ============================================================
// AI作問（フォールバック）
// ============================================================

const generateDraftFromKeywords = (params: {
  selectedKeywords: string[];
  bigCategory: string;
  subCategory: string;
  detailText: string;
  poolKeywords: string[];
}): DraftMcq => {
  const { selectedKeywords, bigCategory, subCategory, detailText, poolKeywords } = params;
  const main = selectedKeywords[0] ?? 'キーワード';
  const distractorPool = Array.from(new Set(
    [...poolKeywords, ...selectedKeywords].filter((k) => k !== main)
  ));
  while (distractorPool.length < 3) distractorPool.push(`選択肢${distractorPool.length + 1}`);
  const wrong = distractorPool.slice(0, 3);
  const allChoices = [main, ...wrong];
  const answerIndex = Math.floor(Math.random() * 4);
  const shuffled = [...allChoices];
  [shuffled[0], shuffled[answerIndex]] = [shuffled[answerIndex], shuffled[0]];

  const detailNote = detailText.trim() ? `（補足: ${detailText.trim()}）` : '';
  return {
    question: `次のうち「${main}」に最も関連が深いものを選びなさい。${detailNote}`,
    choices: shuffled,
    answerIndex,
    explanation: `カテゴリ「${bigCategory} / ${subCategory}」のキーワード（${selectedKeywords.join(' / ')}）をもとに作成しました。公開前に内容を確認・編集してください。`,
  };
};

// ============================================================
// 共通ヘッダー
// ============================================================

const CardHeader = ({
  title,
  onBack,
  tone = 'onDark',
}: {
  title: string;
  onBack: () => void;
  /** onLight: 明るい背景用（カテゴリ選択の写真背景など） */
  tone?: 'onDark' | 'onLight';
}) => (
  <div className="flex items-center justify-between gap-2 mb-5">
    <motion.button
      type="button"
      onClick={onBack}
      className={
        tone === 'onLight'
          ? 'inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-300/90 bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-md shadow-slate-900/10 backdrop-blur-sm transition-colors hover:border-indigo-300/70 hover:bg-white hover:text-indigo-900'
          : 'inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-800/20 bg-white/92 px-3 py-1.5 text-sm font-semibold text-black shadow-md shadow-slate-900/10 backdrop-blur-sm transition-colors hover:border-slate-800/40 hover:bg-white'
      }
      whileTap={{ scale: 0.96 }}
    >
      <ArrowLeft className="h-4 w-4 opacity-90" />
      戻る
    </motion.button>
    <h1
      className={
        tone === 'onLight'
          ? 'text-center text-base font-bold text-gray-900 line-clamp-2 min-w-0 flex-1'
          : 'text-center text-base font-bold text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] line-clamp-2 min-w-0 flex-1'
      }
    >
      {title}
    </h1>
    <div className="w-12 shrink-0" aria-hidden />
  </div>
);

// ============================================================
// メインコンポーネント
// ============================================================

export const AcademyScreen = ({ onBack }: AcademyScreenProps) => {
  const { addToast } = useToast();
  const consecutiveLoginDays = useGameStore((s) => s.consecutiveLoginDays);
  const quizHistory          = useGameStore((s) => s.quizHistory);
  const academyUserQuestions = useGameStore((s) => s.academyUserQuestions);
  const uid = useGameStore((s) => s.uid);
  const isAcademyAdmin = useGameStore((s) => s.isAcademyAdmin());
  const addAcademyUserQuestion = useGameStore((s) => s.addAcademyUserQuestion);
  const updateAcademyUserQuestion = useGameStore((s) => s.updateAcademyUserQuestion);
  const deleteAcademyUserQuestion = useGameStore((s) => s.deleteAcademyUserQuestion);

  const [subview, setSubview] = useState<AcademySubview>('top');

  // 作問フロー用ステート
  const [selectedThemeId,          setSelectedThemeId]          = useState<string | null>(null);
  const [allExtractedKeywords,      setAllExtractedKeywords]      = useState<KeywordCandidate[]>([]);
  const [selectedKeywordsForDraft,  setSelectedKeywordsForDraft]  = useState<string[]>([]);
  const [selectedBigCategory,       setSelectedBigCategory]       = useState<string | null>(null);
  const [selectedSubCategory,       setSelectedSubCategory]       = useState<string | null>(null);
  // 科目名・作品名
  const [subjectText,               setSubjectText]               = useState('');
  // AIへの追加指示
  const [detailText,                setDetailText]                = useState('');
  const [draft,                     setDraft]                     = useState<DraftMcq | null>(null);
  const [isGenerating,              setIsGenerating]              = useState(false);
  const [showPublishModal,          setShowPublishModal]          = useState(false);
  const [publishChecks,             setPublishChecks]             = useState({ noRepost: false, reviewed: false });
  const [isDetailOpen, setIsDetailOpen] = useState(false); // ← ここに追加
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<DraftMcq | null>(null);
  /** 作問フロー「テーマ選択」のページ（1始まり）。キーワード画面から戻ったときも維持 */
  const [themeSeedListPage, setThemeSeedListPage] = useState(1);
  /** 「自分の問題」一覧のページ（1始まり） */
  const [mineQuestionsPage, setMineQuestionsPage] = useState(1);

  const magicStones    = 0;
  const todayAttendees = 24;

  const themes = useMemo(() => buildThemesFromHistory(quizHistory), [quizHistory]);
  const postedQuestions = useMemo(
    () => academyUserQuestions.filter((q) => !!q.authorUid),
    [academyUserQuestions]
  );
  const myQuestions = useMemo(() => {
    if (isAcademyAdmin) return postedQuestions;
    if (!uid) return [];
    return postedQuestions.filter((q) => q.authorUid === uid);
  }, [isAcademyAdmin, postedQuestions, uid]);

  const themeSeedTotalPages =
    themes.length > 0 ? Math.ceil(themes.length / ACADEMY_LIST_PAGE_SIZE) : 0;

  const mineListTotalPages =
    myQuestions.length > 0
      ? Math.ceil(myQuestions.length / ACADEMY_LIST_PAGE_SIZE)
      : 0;

  useEffect(() => {
    if (themeSeedTotalPages === 0) return;
    setThemeSeedListPage((p) => Math.min(Math.max(1, p), themeSeedTotalPages));
  }, [themeSeedTotalPages]);

  useEffect(() => {
    if (mineListTotalPages === 0) return;
    setMineQuestionsPage((p) => Math.min(Math.max(1, p), mineListTotalPages));
  }, [mineListTotalPages]);

  const selectedTheme = useMemo(
    () => themes.find((t) => t.id === selectedThemeId) ?? null,
    [themes, selectedThemeId]
  );

  const canPublish =
    publishChecks.noRepost &&
    publishChecks.reviewed &&
    !!draft &&
    draft.question.trim().length > 0 &&
    draft.choices.length === 4 &&
    draft.choices.every((c) => c.trim().length > 0);

  /**
   * ★ 完全リセット（トップに戻るとき）
   * カテゴリは保持しない
   */
  const resetCreationState = () => {
    setSelectedThemeId(null);
    setAllExtractedKeywords([]);
    setSelectedKeywordsForDraft([]);
    setSelectedBigCategory(null);
    setSelectedSubCategory(null);
    setSubjectText('');
    setDetailText('');
    setDraft(null);
    setShowPublishModal(false);
    setPublishChecks({ noRepost: false, reviewed: false });
    setThemeSeedListPage(1);
  };

  /**
   * ★ カテゴリを引き継いで次の問題を作る
   * bigCategory / subCategory はリセットしない
   */
  const resetForNextQuestion = () => {
    setSelectedThemeId(null);
    setAllExtractedKeywords([]);
    setSelectedKeywordsForDraft([]);
    setSubjectText('');
    setDetailText('');
    setDraft(null);
    setShowPublishModal(false);
    setPublishChecks({ noRepost: false, reviewed: false });
  };

  const handleSelectTheme = (theme: AcademyTheme) => {
    setSelectedThemeId(theme.id);
    const keywords = extractAllKeywordsFromTheme(theme, quizHistory);
    setAllExtractedKeywords(keywords);
    setSelectedKeywordsForDraft([]);
    setSubview('create_keyword');
  };

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywordsForDraft((prev) => {
      if (prev.includes(keyword)) {
        return prev.filter((k) => k !== keyword);
      }
      if (prev.length >= 2) {
        addToast('info', 'キーワードは2個までです');
        return prev;
      }
      return [...prev, keyword];
    });
  };

  const handleGenerate = async () => {
    if (!selectedBigCategory || !selectedSubCategory || selectedKeywordsForDraft.length === 0) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/academy-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: selectedKeywordsForDraft,
          bigCategory: selectedBigCategory,
          subCategory: selectedSubCategory,
          // 科目名＋追加指示をまとめてAIに渡す
          detailText: [subjectText.trim(), detailText.trim()].filter(Boolean).join('\n') || undefined,
        }),
      });
      const data = (await res.json()) as {
        draft?: DraftMcq;
        error?: string;
      };

      if (res.ok && data.draft) {
        setDraft(data.draft);
        setIsGenerating(false);
        setSubview('create_editor');
        return;
      }

      console.warn('[Academy] academy-generate failed, fallback local:', data.error ?? res.status);
    } catch (e) {
      console.warn('[Academy] academy-generate error, fallback local:', e);
    }

    const next = generateDraftFromKeywords({
      selectedKeywords: selectedKeywordsForDraft,
      bigCategory: selectedBigCategory,
      subCategory: selectedSubCategory,
      detailText: [subjectText.trim(), detailText.trim()].filter(Boolean).join('\n'),
      poolKeywords: allExtractedKeywords.map((k) => k.label),
    });
    setDraft(next);
    setIsGenerating(false);
    setSubview('create_editor');
  };

  // ── サブビューの描画 ──────────────────────────────────────

  if (subview === 'everyone') {
    return <MinnanoMondaiScreen onBack={() => setSubview('top')} />;
  }
  if (subview === 'mine') {
    const safeMinePage =
      mineListTotalPages > 0
        ? Math.min(Math.max(1, mineQuestionsPage), mineListTotalPages)
        : 1;
    const pagedMineQuestions = myQuestions.slice(
      (safeMinePage - 1) * ACADEMY_LIST_PAGE_SIZE,
      safeMinePage * ACADEMY_LIST_PAGE_SIZE
    );
    const showMinePagination = myQuestions.length > ACADEMY_LIST_PAGE_SIZE;

    const startEdit = (item: AcademyUserQuestion) => {
      setEditingQuestionId(item.id);
      setEditingDraft({
        question: item.question,
        choices: [...item.choices].slice(0, 4),
        answerIndex: item.answerIndex,
        explanation: item.explanation,
      });
    };
    const cancelEdit = () => {
      setEditingQuestionId(null);
      setEditingDraft(null);
    };
    const saveEdit = async () => {
      if (!editingQuestionId || !editingDraft) return;
      if (!editingDraft.question.trim() || editingDraft.choices.length !== 4 || editingDraft.choices.some((c) => !c.trim())) {
        addToast('error', '問題文と4つの選択肢を入力してください');
        return;
      }
      const ok = await updateAcademyUserQuestion(editingQuestionId, {
        question: editingDraft.question,
        choices: editingDraft.choices,
        answerIndex: editingDraft.answerIndex,
        explanation: editingDraft.explanation,
      });
      if (ok) {
        addToast('success', '問題を更新しました');
        cancelEdit();
      } else {
        addToast('error', '更新に失敗しました');
      }
    };
    return (
      <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
        <AcademyScreenBackdrop />
        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader title="自分の問題" onBack={() => setSubview('top')} />
          {myQuestions.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-8 text-center">
              <p className="text-gray-200 font-semibold mb-2">
                {isAcademyAdmin ? '投稿問題がまだありません' : 'まだ問題がありません'}
              </p>
              <p className="text-gray-400 text-sm">
                {isAcademyAdmin
                  ? 'ユーザー投稿があるとここに表示されます。'
                  : '「問題を作る」から投稿するとここに表示されます。'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedMineQuestions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-white font-semibold text-sm leading-relaxed">{item.question}</p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    {(item.bigCategory || item.subCategory) && (
                      <p className="text-xs text-indigo-300 mb-2">
                        {item.bigCategory || 'カテゴリ'} / {item.subCategory || '未設定'}
                      </p>
                    )}
                    <div className="space-y-1">
                      {item.choices.map((choice, idx) => (
                        <p
                          key={`${item.id}-${idx}`}
                          className={`text-xs ${idx === item.answerIndex ? 'text-emerald-300' : 'text-gray-300'}`}
                        >
                          {idx + 1}. {choice}
                        </p>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <motion.button
                        onClick={() => startEdit(item)}
                        className="flex-1 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-semibold"
                        whileTap={{ scale: 0.98 }}
                      >
                        編集
                      </motion.button>
                      <motion.button
                        onClick={async () => {
                          const ok = await deleteAcademyUserQuestion(item.id);
                          if (ok) {
                            addToast('success', '問題を削除しました');
                            if (editingQuestionId === item.id) cancelEdit();
                          } else {
                            addToast('error', '削除に失敗しました');
                          }
                        }}
                        className="flex-1 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold"
                        whileTap={{ scale: 0.98 }}
                      >
                        削除
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>

              {showMinePagination && (
                <nav
                  className="mt-6 flex flex-col items-stretch gap-3 border-t border-gray-700/60 pt-4"
                  aria-label="自分の問題のページ"
                >
                  <div className="flex items-center justify-center gap-2">
                    {safeMinePage > 1 ? (
                      <button
                        type="button"
                        onClick={() => setMineQuestionsPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700/80"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        前へ
                      </button>
                    ) : null}
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5 px-1">
                      {Array.from({ length: mineListTotalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMineQuestionsPage(n)}
                          className={`min-w-[2.25rem] rounded-lg px-2.5 py-2 text-sm font-bold transition-colors ${
                            n === safeMinePage
                              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                              : 'border border-gray-600 bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={safeMinePage >= mineListTotalPages}
                      onClick={() =>
                        setMineQuestionsPage((p) => Math.min(mineListTotalPages, p + 1))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-700/80"
                    >
                      次へ
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
        {editingQuestionId && editingDraft && (
          <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 space-y-3">
              <h2 className="text-white font-bold">問題を編集</h2>
              <textarea
                value={editingDraft.question}
                onChange={(e) => setEditingDraft({ ...editingDraft, question: e.target.value })}
                className="w-full rounded-lg bg-gray-800 border border-gray-600 text-white text-sm p-3 min-h-[80px]"
              />
              <div className="space-y-2">
                {editingDraft.choices.map((choice, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingDraft.answerIndex === idx}
                      onChange={() => setEditingDraft({ ...editingDraft, answerIndex: idx })}
                      className="accent-emerald-500"
                    />
                    <input
                      value={choice}
                      onChange={(e) => {
                        const next = [...editingDraft.choices];
                        next[idx] = e.target.value;
                        setEditingDraft({ ...editingDraft, choices: next });
                      }}
                      className="flex-1 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm p-2"
                    />
                  </div>
                ))}
              </div>
              <textarea
                value={editingDraft.explanation}
                onChange={(e) => setEditingDraft({ ...editingDraft, explanation: e.target.value })}
                className="w-full rounded-lg bg-gray-800 border border-gray-600 text-white text-sm p-3 min-h-[72px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  onClick={cancelEdit}
                  className="py-2.5 rounded-xl bg-gray-700 text-gray-200 font-semibold"
                  whileTap={{ scale: 0.98 }}
                >
                  キャンセル
                </motion.button>
                <motion.button
                  onClick={saveEdit}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white font-bold"
                  whileTap={{ scale: 0.98 }}
                >
                  保存
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ① テーマ選択
  if (subview === 'create_seed_list') {
    const safeListPage =
      themeSeedTotalPages > 0
        ? Math.min(Math.max(1, themeSeedListPage), themeSeedTotalPages)
        : 1;
    const pagedThemes = themes.slice(
      (safeListPage - 1) * ACADEMY_LIST_PAGE_SIZE,
      safeListPage * ACADEMY_LIST_PAGE_SIZE
    );
    const showThemePagination = themes.length > ACADEMY_LIST_PAGE_SIZE;

    return (
      <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
        <AcademyScreenBackdrop />
        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader title="問題を作る：テーマ選択" onBack={() => { resetCreationState(); setSubview('top'); }} />

          <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3 mb-4">
            <p className="text-amber-100 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {CREATION_POLICY.quickNotice}
            </p>
          </div>

          {themes.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-8 text-center">
              <p className="text-gray-200 font-semibold mb-2">テーマがまだありません</p>
              <p className="text-gray-400 text-sm">クイズをスキャンして履歴を作ると表示されます。</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedThemes.map((theme) => (
                  <motion.button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme)}
                    className="w-full text-left rounded-2xl border border-gray-700 bg-gray-800/60 p-4"
                    whileTap={{ scale: 0.98 }}
                  >
                    <p className="text-white font-semibold mb-2 line-clamp-2">{theme.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {theme.keywords.slice(0, 5).map((k) => (
                        <span key={k} className="px-2 py-0.5 rounded-full text-[10px] bg-gray-700 text-gray-200">
                          {k}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                ))}
              </div>

              {showThemePagination && (
                <nav
                  className="mt-6 flex flex-col items-stretch gap-3 border-t border-gray-700/60 pt-4"
                  aria-label="テーマ一覧のページ"
                >
                  <div className="flex items-center justify-center gap-2">
                    {safeListPage > 1 ? (
                      <button
                        type="button"
                        onClick={() => setThemeSeedListPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700/80"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        前へ
                      </button>
                    ) : null}
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5 px-1">
                      {Array.from({ length: themeSeedTotalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setThemeSeedListPage(n)}
                          className={`min-w-[2.25rem] rounded-lg px-2.5 py-2 text-sm font-bold transition-colors ${
                            n === safeListPage
                              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                              : 'border border-gray-600 bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={safeListPage >= themeSeedTotalPages}
                      onClick={() =>
                        setThemeSeedListPage((p) => Math.min(themeSeedTotalPages, p + 1))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-700/80"
                    >
                      次へ
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ② キーワード選択
  if (subview === 'create_keyword') {
    return (
      <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
        <AcademyScreenBackdrop />
        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader title="問題を作る：キーワード選択" onBack={() => setSubview('create_seed_list')} />

          {selectedTheme && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 mb-4">
              <p className="text-white text-sm font-semibold line-clamp-1">{selectedTheme.summary}</p>
            </div>
          )}

          <p className="text-gray-300 text-sm mb-3">使いたいキーワードを1〜2個選んでください</p>

          <div className="flex flex-wrap gap-2 mb-6">
            {allExtractedKeywords.length === 0 && (
              <p className="text-gray-500 text-sm">キーワード候補がありません</p>
            )}
            {allExtractedKeywords.map((kw) => {
              const picked = selectedKeywordsForDraft.includes(kw.label);
              return (
                <motion.button
                  key={kw.id}
                  onClick={() => toggleKeyword(kw.label)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    picked
                      ? 'bg-indigo-500/30 border-indigo-400 text-indigo-100'
                      : 'bg-gray-700 border-gray-600 text-gray-200'
                  }`}
                  whileTap={{ scale: 0.96 }}
                >
                  {kw.label}
                </motion.button>
              );
            })}
          </div>

          <motion.button
            onClick={() => {
              // ★ カテゴリが選択済みならカテゴリ選択をスキップして詳細入力へ
              if (selectedBigCategory && selectedSubCategory) {
                setSubview('create_detail');
              } else {
                setSubview('create_category');
              }
            }}
            disabled={selectedKeywordsForDraft.length === 0}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold"
            whileTap={{ scale: 0.98 }}
          >
            {selectedKeywordsForDraft.length > 0
              ? selectedBigCategory && selectedSubCategory
                // ★ カテゴリ引き継ぎ中は現在のカテゴリを表示
                ? `${selectedKeywordsForDraft.length}個選択中 → 詳細入力へ（${selectedSubCategory}）`
                : `${selectedKeywordsForDraft.length}個選択中 → カテゴリを選ぶ`
              : 'キーワードを1〜2個選んでください'}
          </motion.button>

          {/* ★ カテゴリ引き継ぎ中は変更リンクを表示 */}
          {selectedBigCategory && selectedSubCategory && (
            <button
              onClick={() => setSubview('create_category')}
              className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1"
            >
              カテゴリを変更する（現在: {selectedBigCategory} / {selectedSubCategory}）
            </button>
          )}
        </div>
      </div>
    );
  }

  // ③ カテゴリ選択
  if (subview === 'create_category') {
    return (
      <div className="relative min-h-screen overflow-x-hidden p-4 pb-24" style={academyScreenRootBg}>

        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader
            title="問題を作る：カテゴリ選択"
            onBack={() => setSubview('create_keyword')}
            tone="onLight"
          />

          <p className="text-gray-700 text-sm mb-4">大カテゴリを選んでください</p>

          <div className="space-y-2 mb-6">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedBigCategory === cat.label;
              return (
                <div key={cat.label}>
                  <motion.button
                    onClick={() => {
                      setSelectedBigCategory(isSelected ? null : cat.label);
                      setSelectedSubCategory(null);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-semibold transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-900/40 text-white'
                        : 'border-gray-500 bg-white/70 text-gray-800'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{cat.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-180' : ''}`}
                    />
                  </motion.button>

                  {isSelected && (
                    <div className="mt-2 ml-3 flex flex-wrap gap-2 pb-2">
                      {cat.sub.map((sub) => (
                        <motion.button
                          key={sub}
                          onClick={() => setSelectedSubCategory(sub)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            selectedSubCategory === sub
                              ? 'bg-indigo-500 border-indigo-400 text-white'
                              : 'bg-white/70 border-gray-500 text-gray-800'
                          }`}
                          whileTap={{ scale: 0.96 }}
                        >
                          {sub}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <motion.button
            onClick={() => setSubview('create_detail')}
            disabled={!selectedBigCategory || !selectedSubCategory}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold"
            whileTap={{ scale: 0.98 }}
          >
            {selectedBigCategory && selectedSubCategory
              ? `「${selectedBigCategory} / ${selectedSubCategory}」で次へ`
              : '中カテゴリまで選んでください'}
          </motion.button>
        </div>
      </div>
    );
  }

// ④ 科目・作品を選ぶ
if (subview === 'create_detail') {
  const suggestions = SUBCATEGORY_SUGGESTIONS[selectedSubCategory ?? ''] ?? [];

  return (
    <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
      <AcademyScreenBackdrop />
      <div className="relative z-10 max-w-md mx-auto pt-6">
        <CardHeader title="問題を作る：科目・作品を選ぶ" onBack={() => setSubview('create_category')} />

        {/* サマリー */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 mb-4 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-xs">カテゴリ</span>
            <span className="rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-xs text-indigo-200">
              {selectedBigCategory} / {selectedSubCategory}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-xs">キーワード</span>
            {selectedKeywordsForDraft.map((k) => (
              <span key={k} className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200">{k}</span>
            ))}
          </div>
        </div>

        {/* 科目・作品名（メイン） */}
        <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4 mb-4">
          <label className="block text-gray-300 text-sm font-semibold mb-3">
            科目名・作品名を選ぶ
            <span className="ml-1 text-gray-500 font-normal text-xs">（任意）</span>
          </label>

          {/* 候補チップ */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.map((s) => {
                const selected = subjectText === s;
                return (
                  <motion.button
                    key={s}
                    onClick={() => setSubjectText(selected ? '' : s)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selected
                        ? 'bg-indigo-500 border-indigo-400 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-400'
                    }`}
                    whileTap={{ scale: 0.96 }}
                  >
                    {s}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* 手入力 */}
          <input
            value={subjectText}
            onChange={(e) => setSubjectText(e.target.value)}
            placeholder={
              suggestions.length > 0
                ? `上から選ぶか直接入力（例: ${suggestions[0]}）`
                : '例: ワンピース、英検2級、江戸時代 など'
            }
            className="w-full rounded-lg bg-gray-900 border border-gray-600 text-white text-sm p-3 outline-none focus:border-indigo-500 placeholder:text-gray-600"
          />
        </div>

        {/* AIへの追加指示（折りたたみ） */}
        <div className="mb-5">
          <button
            onClick={() => setIsDetailOpen((p) => !p)}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 py-2 flex items-center gap-1"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isDetailOpen ? 'rotate-180' : ''}`} />
            AIへの追加指示を書く（任意）
          </button>
          {isDetailOpen && (
            <div className="mt-2 rounded-2xl border border-gray-700 bg-gray-800/60 p-4">
              <textarea
                value={detailText}
                onChange={(e) => setDetailText(e.target.value)}
                placeholder="難易度・出題形式など。空欄でもOK。"
                className="w-full rounded-lg bg-gray-900 border border-gray-600 text-white text-sm p-3 min-h-[80px] outline-none focus:border-indigo-500 placeholder:text-gray-600 resize-none"
              />
              <p className="text-gray-600 text-xs mt-1.5 text-right">{detailText.length} 文字</p>
            </div>
          )}
        </div>

        <motion.button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold"
          whileTap={{ scale: 0.98 }}
        >
          {isGenerating ? 'AIで問題を生成中...' : '問題を生成する'}
        </motion.button>
      </div>
    </div>
  );
}

  // ⑤ 編集
  if (subview === 'create_editor') {
    return (
      <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
        <AcademyScreenBackdrop />
        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader title="問題を作る：編集" onBack={() => setSubview('create_detail')} />

          <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3 mb-4">
            <p className="text-amber-100 text-xs">{CREATION_POLICY.quickNotice}</p>
          </div>

          {!draft ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-8 text-center">
              <p className="text-gray-400 text-sm">下書きがありません</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-4 space-y-4">

                {/* 問題文 */}
                <div>
                  <p className="text-gray-400 text-xs mb-1">問題文</p>
                  <textarea
                    value={draft.question}
                    onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                    className="w-full rounded-lg bg-gray-900 border border-gray-600 text-white text-sm p-3 min-h-[88px] outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 選択肢 */}
                <div>
                  <p className="text-gray-400 text-xs mb-2">選択肢（正解をラジオで選択）</p>
                  <div className="space-y-2">
                    {draft.choices.map((choice, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={draft.answerIndex === idx}
                          onChange={() => setDraft({ ...draft, answerIndex: idx })}
                          className="accent-emerald-500 shrink-0"
                        />
                        <input
                          value={choice}
                          onChange={(e) => {
                            const next = [...draft.choices];
                            next[idx] = e.target.value;
                            setDraft({ ...draft, choices: next });
                          }}
                          className="flex-1 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm p-2 outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 解説 */}
                <div>
                  <p className="text-gray-400 text-xs mb-1">解説</p>
                  <textarea
                    value={draft.explanation}
                    onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                    className="w-full rounded-lg bg-gray-900 border border-gray-600 text-white text-sm p-3 min-h-[80px] outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <motion.button
                  onClick={() => setShowPublishModal(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  whileTap={{ scale: 0.98 }}
                >
                  投稿する
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* 投稿確認モーダル */}
        {showPublishModal && (
          <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-5">
              <h2 className="text-white text-lg font-bold mb-1">公開前の確認</h2>
              <p className="text-gray-400 text-xs mb-4">ガイドライン {CREATION_POLICY.version}</p>
              <div className="space-y-2 mb-5">
                {CREATION_POLICY.checks.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={publishChecks[item.id]}
                      onChange={(e) =>
                        setPublishChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                      className="mt-0.5 accent-emerald-500"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  onClick={() => setShowPublishModal(false)}
                  className="py-2.5 rounded-xl bg-gray-700 text-gray-100 font-semibold"
                  whileTap={{ scale: 0.98 }}
                >
                  キャンセル
                </motion.button>
                <motion.button
                  onClick={async () => {
                    if (!canPublish) return;
                    if (draft) {
                      const ok = await addAcademyUserQuestion({
                        question: draft.question,
                        choices: draft.choices,
                        answerIndex: draft.answerIndex,
                        explanation: draft.explanation,
                        keywords: selectedKeywordsForDraft,
                        bigCategory: selectedBigCategory ?? undefined,
                        subCategory: selectedSubCategory ?? undefined,
                        subjectText: subjectText.trim() || undefined,
                        detailText: detailText.trim() || undefined,
                      });
                      if (!ok) {
                        addToast('error', '投稿に失敗しました（権限設定またはサーバー状態を確認してください）');
                        return;
                      }
                    }
                    setShowPublishModal(false);
                    setSubview('create_done');
                  }}
                  disabled={!canPublish}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:bg-gray-700 disabled:text-gray-500"
                  whileTap={{ scale: 0.98 }}
                >
                  公開する
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ⑥ 完了
  if (subview === 'create_done') {
    return (
      <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
        <AcademyScreenBackdrop />
        <div className="relative z-10 max-w-md mx-auto pt-6">
          <CardHeader
            title="問題を作る：完了"
            onBack={() => { resetCreationState(); setSubview('top'); }}
          />
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
            <p className="text-emerald-100 font-bold text-lg mb-1">投稿しました</p>
            <p className="text-emerald-200/70 text-sm">問題はリアルタイムでみんなの問題へ反映されます。</p>
          </div>

          {/* ★ 2つのボタンを並べる */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* カテゴリ引き継ぎで次の問題 */}
            <motion.button
              onClick={() => {
                resetForNextQuestion();
                setSubview('create_seed_list');
              }}
              className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
              whileTap={{ scale: 0.98 }}
            >
              同じカテゴリで<br />もう1問作る
              {selectedBigCategory && selectedSubCategory && (
                <span className="block text-xs font-normal opacity-70 mt-0.5">
                  {selectedSubCategory}
                </span>
              )}
            </motion.button>

            {/* 完全リセットしてトップへ */}
            <motion.button
              onClick={() => { resetCreationState(); setSubview('top'); }}
              className="py-3 rounded-xl bg-gray-700 text-gray-200 font-semibold text-sm"
              whileTap={{ scale: 0.98 }}
            >
              トップに<br />戻る
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // ── アカデミーTOP ────────────────────────────────────────

  return (
    <div className="relative min-h-screen p-4 pb-24" style={academyScreenRootBg}>
      <AcademyScreenBackdrop />
      <div className="relative z-10 max-w-md mx-auto pt-6">
        <CardHeader title="🎓 すうひもちアカデミー" onBack={onBack} tone="onLight" />

        {/* マジックアカデミーヘッダー */}
        <div className="rounded-2xl p-5 mb-5 border border-indigo-500/30 bg-gradient-to-br from-indigo-900/80 via-purple-900/70 to-slate-900/80">
          <p className="text-white text-2xl font-bold mb-4">🎓 見習い魔術師 10級</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
              <span className="text-indigo-100 text-sm">聖晶ポテト × {magicStones}</span>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-300 shrink-0" />
              <span className="text-indigo-100 text-sm">{consecutiveLoginDays}日連続出席</span>
            </div>
          </div>
          <p className="text-indigo-200/80 text-xs flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            今日の出席者 {todayAttendees}人
          </p>
        </div>

        {/* メニュー */}
        <div className="space-y-3">
          <motion.button
            onClick={() => setSubview('everyone')}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25"
            whileTap={{ scale: 0.98 }}
          >
            <BookOpen className="w-6 h-6" />
            みんなの問題
          </motion.button>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => { resetCreationState(); setSubview('create_seed_list'); }}
              className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 text-white font-bold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <PenSquare className="w-5 h-5" />
              問題を作る
            </motion.button>

            <motion.button
              onClick={() => setSubview('mine')}
              className="py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 font-bold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              <FolderOpen className="w-5 h-5" />
              自分の問題
            </motion.button>
          </div>

          <div className="rounded-xl border border-slate-300/80 bg-white/90 p-4 shadow-md shadow-slate-900/10 backdrop-blur-sm">
            <p className="text-slate-800 font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-600 shrink-0" />
              昇格試験・ダンジョン攻略
            </p>
            <p className="text-slate-600 text-xs mt-1">準備中・近日公開予定</p>
          </div>
        </div>
      </div>
    </div>
  );
};
