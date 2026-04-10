/**
 * categories.ts  v2
 *
 * 設計方針:
 *   - 科目は SUBJECT_POOL で一元管理。strand で文系/理系を区別する。
 *   - 中学受験・高校受験・大学受験は「受験区分フィルター付きの科目ビュー」
 *   - 文系学問・理系学問は「全受験区分を横断した strand ビュー」
 *     → 中学受験の理科も、大学受験の物理も、社会人の統計も
 *       「理系学問」カードに自動で集約される
 *   - 問題（AcademyUserQuestion）は subjectId + grade に紐づくだけでよい
 */

// ============================================================
// 科目ストランド
// ============================================================

export type SubjectStrand = 'liberal' | 'science' | 'common';

export type ExamCategory = '中学受験' | '高校受験' | '大学受験';

export type SubjectDef = {
  id: string;
  label: string;
  strand: SubjectStrand;
  /** この科目が対応する受験区分 */
  examCategories: ExamCategory[];
};

// ============================================================
// 科目マスター（subjectPool）
// ============================================================

export const SUBJECT_POOL: SubjectDef[] = [
  // ── 共通 ──
  { id: 'japanese', label: '国語', strand: 'liberal', examCategories: ['中学受験', '高校受験', '大学受験'] },
  { id: 'english', label: '英語', strand: 'common', examCategories: ['高校受験', '大学受験'] },
  { id: 'society', label: '社会', strand: 'liberal', examCategories: ['中学受験', '高校受験'] },

  // ── 文系 ──
  { id: 'jpnHistory', label: '日本史', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'wldHistory', label: '世界史', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'geography', label: '地理', strand: 'liberal', examCategories: ['高校受験', '大学受験'] },
  { id: 'civics', label: '政治経済', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'ethics', label: '倫理', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'modernJpn', label: '現代文', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'classicJpn', label: '古文', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'chinese', label: '漢文', strand: 'liberal', examCategories: ['大学受験'] },
  { id: 'philosophy', label: '哲学', strand: 'liberal', examCategories: [] },
  { id: 'psychology', label: '心理学', strand: 'liberal', examCategories: [] },

  // ── 理系 ──
  { id: 'arithmetic', label: '算数', strand: 'science', examCategories: ['中学受験'] },
  { id: 'math', label: '数学', strand: 'science', examCategories: ['高校受験'] },
  { id: 'mathIA', label: '数学ⅠA', strand: 'science', examCategories: ['大学受験'] },
  { id: 'mathIIB', label: '数学ⅡB', strand: 'science', examCategories: ['大学受験'] },
  { id: 'mathIII', label: '数学Ⅲ', strand: 'science', examCategories: ['大学受験'] },
  { id: 'science', label: '理科', strand: 'science', examCategories: ['中学受験', '高校受験'] },
  { id: 'physics', label: '物理', strand: 'science', examCategories: ['大学受験'] },
  { id: 'chemistry', label: '化学', strand: 'science', examCategories: ['大学受験'] },
  { id: 'biology', label: '生物', strand: 'science', examCategories: ['大学受験'] },
  { id: 'earthSci', label: '地学', strand: 'science', examCategories: ['大学受験'] },
  { id: 'infoStat', label: '情報・統計', strand: 'science', examCategories: [] },
];

// ============================================================
// 学年
// ============================================================

export type Grade =
  | '小4' | '小5' | '小6'
  | '中1' | '中2' | '中3'
  | '高1' | '高2' | '高3'
  | '基礎' | '標準' | '応用' | '難関'
  | '全学年';

// ============================================================
// カテゴリーモード
// ============================================================

export type CategoryMode = 'quiz' | 'study' | 'cert';

// ============================================================
// study カテゴリー定義
// ============================================================

export type StudyCategoryDef = {
  mode: 'study';
  label: string;
  ruby: string;
  icon: string;
  description: string;
  /**
   * 文系学問 → 'liberal'
   * 理系学問 → 'science'
   * 受験カテゴリー → null（文理両方を含む）
   */
  strandFilter: SubjectStrand | null;
  /**
   * 中学受験 / 高校受験 / 大学受験 → 対応する値
   * 文系学問 / 理系学問 → null（全受験区分を横断）
   */
  examFilter: ExamCategory | null;
  /** カード内で選択できる学年軸 */
  grades: Grade[];
};

export const STUDY_CATEGORIES: StudyCategoryDef[] = [
  // ── 受験ビュー ──
  {
    mode: 'study',
    label: '高校受験',
    ruby: 'こうこうじゅけん',
    icon: '📝',
    description: '数学・英語・国語・理科・社会',
    strandFilter: null,
    examFilter: '高校受験',
    grades: ['中1', '中2', '中3'],
  },
  {
    mode: 'study',
    label: '大学受験',
    ruby: 'だいがくじゅけん',
    icon: '🎓',
    description: '文系・理系・共通テスト全科目',
    strandFilter: null,
    examFilter: '大学受験',
    grades: ['高1', '高2', '高3'],
  },

  // ── 学問ビュー（受験を横断・社会人も含む） ──
  {
    mode: 'study',
    label: '文系学問',
    ruby: 'ぶんけいがくもん',
    icon: '📚',
    description: '歴史・地理・国語・倫理・哲学',
    strandFilter: 'liberal',
    examFilter: null,
    grades: ['基礎', '標準', '応用', '難関'],
  },
  {
    mode: 'study',
    label: '理系学問',
    ruby: 'りけいがくもん',
    icon: '🔬',
    description: '算数〜数学・理科〜物理化学・情報',
    strandFilter: 'science',
    examFilter: null,
    grades: ['基礎', '標準', '応用', '難関'],
  },
];

// ============================================================
// quiz / cert カテゴリー
// ============================================================

export type QuizCertCategoryDef = {
  mode: 'quiz' | 'cert';
  label: string;
  ruby: string;
  icon: string;
  description: string;
  sub: string[];
  levels?: string[];
};

export const QUIZ_CATEGORIES: QuizCertCategoryDef[] = [
  { mode: 'quiz', label: 'エンタメ', ruby: 'えんため', icon: '🎮', description: '漫画・アニメ・ゲーム・映画', sub: ['漫画・アニメ', 'ゲーム', '映画', 'ドラマ', '小説', '音楽'] },
  { mode: 'quiz', label: '趣味・教養', ruby: 'しゅみ・きょうよう', icon: '🎨', description: '雑学・スポーツ・料理・アート', sub: ['雑学', '心理学', '哲学', 'アート', 'スポーツ', '料理', '健康'] },
  { mode: 'quiz', label: '生活', ruby: 'せいかつ', icon: '🏠', description: '常識・マナー・社会・ニュース', sub: ['一般常識', 'マナー', '社会', 'ニュース'] },
  { mode: 'quiz', label: 'オリジナル', ruby: 'おりじなる', icon: '✨', description: 'ユーザー創作問題', sub: ['自由テーマ', 'コラボ', '期間限定'] },
];

export const CERT_CATEGORIES: QuizCertCategoryDef[] = [
  {
    mode: 'cert',
    label: '資格',
    ruby: 'しかく',
    icon: '🏅',
    description: '法律・IT・設備・医療・金融・食品',
    sub: ['法律・不動産', 'IT・情報', '設備・技術', '医療・福祉', 'ビジネス・金融', '食品・環境'],
    levels: ['入門', '基礎', '応用'],
  },
  { mode: 'cert', label: '英語', ruby: 'えいご', icon: '🌐', description: '英検・TOEIC・英会話', sub: ['英単語', '英文法', 'リーディング', 'リスニング', '英検', 'TOEIC', 'TOEFL'], levels: ['初級', '中級', '上級'] },
  { mode: 'cert', label: '韓国語・中国語', ruby: 'かんこくご・ちゅうごくご', icon: '🗣️', description: 'TOPIK・HSK', sub: ['韓国語', '中国語'], levels: ['初級', '中級', '上級'] },
  { mode: 'cert', label: 'その他言語', ruby: 'そのたげんご', icon: '💬', description: '仏語・独語・西語ほか', sub: ['フランス語', 'スペイン語', 'ドイツ語', 'その他'], levels: ['初級', '中級', '上級'] },
];

// ============================================================
// モードメタ（タブ表示用）
// ============================================================

export const MODE_META: Record<CategoryMode, { label: string; icon: string; description: string }> = {
  quiz: { label: 'クイズ', icon: '🎮', description: 'エンタメ・教養・雑学' },
  study: { label: '受験・学問', icon: '📖', description: '受験対策・社会人学習' },
  cert: { label: '資格・語学', icon: '🏅', description: '資格取得・語学学習' },
};

// ============================================================
// 問題フィルタークエリ型
// ============================================================

export type StudyQueryFilter = {
  /** 含める subjectId の OR リスト */
  subjectIds: string[];
  examCategory: ExamCategory | null;
  grade: Grade | null;
};

/**
 * StudyCategoryDef → StudyQueryFilter
 */
export const buildStudyQueryFilter = (
  cat: StudyCategoryDef,
  selectedGrade?: Grade
): StudyQueryFilter => {
  let subjects = SUBJECT_POOL;

  if (cat.strandFilter) {
    subjects = subjects.filter((s) => s.strand === cat.strandFilter);
  }

  if (cat.examFilter) {
    subjects = subjects.filter((s) => s.examCategories.includes(cat.examFilter as ExamCategory));
  }

  return {
    subjectIds: subjects.map((s) => s.id),
    examCategory: cat.examFilter,
    grade: selectedGrade ?? null,
  };
};

// ============================================================
// in-memory フィルター（Firestore を使わない環境向け）
// ============================================================

export const filterStudyQuestions = <
  T extends {
    subjectId?: string;
    subCategory?: string;
    bigCategory?: string;
    grade?: Grade;
  }
>(
  questions: T[],
  filter: StudyQueryFilter
): T[] => {
  return questions.filter((q) => {
    const subjectMatch =
      filter.subjectIds.length === 0 ||
      (!!q.subjectId && filter.subjectIds.includes(q.subjectId)) ||
      SUBJECT_POOL.some(
        (s) =>
          filter.subjectIds.includes(s.id) &&
          (q.subCategory === s.label || q.bigCategory === s.label)
      );

    if (!subjectMatch) return false;

    if (filter.grade && filter.grade !== '全学年') {
      if (q.grade && q.grade !== filter.grade) return false;
    }

    return true;
  });
};

// ============================================================
// 旧 EXAM_CATEGORIES 互換アダプター
// ============================================================

const modeStyle = (mode: CategoryMode) => {
  switch (mode) {
    case 'quiz':
      return {
        color: 'from-purple-600 via-fuchsia-500 to-pink-500',
        glow: '#d946ef',
        border: 'border-fuchsia-400/60',
        ribbonColor: '#a21caf',
        lightBg: 'linear-gradient(135deg, rgba(253,244,255,0.96) 0%, rgba(250,232,255,0.96) 100%)',
        lightBorder: 'rgba(217,70,239,0.28)',
      };
    case 'study':
      return {
        color: 'from-blue-600 via-indigo-500 to-violet-500',
        glow: '#6366f1',
        border: 'border-indigo-400/60',
        ribbonColor: '#4338ca',
        lightBg: 'linear-gradient(135deg, rgba(238,242,255,0.98) 0%, rgba(224,231,255,0.96) 100%)',
        lightBorder: 'rgba(99,102,241,0.28)',
      };
    case 'cert':
      return {
        color: 'from-teal-500 via-cyan-500 to-sky-400',
        glow: '#14b8a6',
        border: 'border-teal-400/60',
        ribbonColor: '#0f766e',
        lightBg: 'linear-gradient(135deg, rgba(240,253,250,0.98) 0%, rgba(224,242,254,0.96) 100%)',
        lightBorder: 'rgba(20,184,166,0.28)',
      };
  }
};

/**
 * 既存の MinnanoMondaiScreen が参照している EXAM_CATEGORIES 型互換の配列。
 */
export const EXAM_CATEGORIES = [
  ...QUIZ_CATEGORIES,
  ...STUDY_CATEGORIES,
  ...CERT_CATEGORIES,
].map((c) => ({
  label: c.label,
  ruby: c.ruby,
  icon: c.icon,
  kanji: c.label,
  kanjiSub: undefined as string | undefined,
  description: c.description,
  mode: c.mode as CategoryMode,
  ...modeStyle(c.mode as CategoryMode),
  // study 専用
  strandFilter: 'strandFilter' in c ? c.strandFilter : null,
  examFilter: 'examFilter' in c ? c.examFilter : null,
  grades: 'grades' in c ? c.grades : undefined,
  sub: 'sub' in c ? c.sub : undefined,
  levels: 'levels' in c ? c.levels : undefined,
}));

// ============================================================
// 題材候補
// ============================================================

export const SUBCATEGORY_SUGGESTIONS: Record<string, string[]> = {
  '漫画・アニメ': ['ワンピース', '鬼滅の刃', '呪術廻戦', '進撃の巨人', 'ドラゴンボール', 'ナルト', 'ブリーチ', 'スラムダンク', '推しの子'],
  'アニメ': ['ワンピース', '鬼滅の刃', '呪術廻戦', '進撃の巨人', 'ガンダム', 'エヴァンゲリオン'],
  '漫画': ['ドラゴンボール', 'ナルト', 'ブリーチ', 'スラムダンク', 'ジョジョ', 'キングダム'],
  'ゲーム': ['ポケモン', 'ゼルダの伝説', 'ファイナルファンタジー', 'ドラゴンクエスト', 'モンスターハンター', 'スプラトゥーン'],
  '映画': ['マーベル', 'ジブリ', 'ディズニー', 'SF映画', 'ホラー映画', '邦画'],
  '芸能': ['俳優', '女優', 'バラエティ', 'アイドル', 'お笑い', '舞台'],
  'ドラマ': ['朝ドラ', '大河ドラマ', '韓国ドラマ', '海外ドラマ'],
  '小説': ['純文学', 'ミステリー', 'SF小説', 'ライトノベル', '歴史小説'],
  '音楽': ['J-POP', 'K-POP', 'クラシック', 'ロック', 'ジャズ', 'ボカロ'],
  '雑学': ['動物', '食べ物', '地理', '宇宙', '人体', '言葉'],
  '心理学': ['認知心理学', '社会心理学', '発達心理学', '臨床心理学'],
  '哲学': ['西洋哲学', '東洋哲学', '倫理学', '存在論', '認識論'],
  'スポーツ': ['野球', 'サッカー', 'バスケ', '陸上', 'テニス', '水泳', 'オリンピック'],
  '料理': ['和食', '洋食', '中華', 'お菓子', '調理技法', '食材'],
  '日本史': ['縄文〜弥生', '古代', '中世', '近世', '近代', '現代'],
  '世界史': ['古代文明', 'ヨーロッパ', 'アジア', '近代', '現代'],
  '地理': ['自然地理', '人文地理', '地誌', '地図'],
  '数学': ['計算', '方程式', '関数', '図形', '確率'],
  '数学ⅠA': ['数と式', '2次関数', '三角比', 'データ', '確率'],
  '数学ⅡB': ['指数対数', '三角関数', '数列', 'ベクトル', '微分積分'],
  '数学Ⅲ': ['複素数', '曲線', '積分'],
  '物理': ['力学', '熱力学', '電磁気学', '波動', '原子'],
  '化学': ['理論化学', '無機化学', '有機化学', '高分子'],
  '生物': ['細胞', '遺伝', '進化', '生態系'],
  '地学': ['地質', '気象', '天文', '海洋'],
  '宅建': ['民法', '宅建業法', '都市計画法', '建築基準法', '税法'],
  '簿記': ['仕訳', '財務諸表', '原価計算', '損益計算書', '貸借対照表'],
  '法律・不動産': ['宅建', '行政書士', '司法書士', 'マンション管理士', '社労士'],
  'IT・情報': ['ITパスポート', '基本情報技術者', '応用情報技術者', '情報セキュリティマネジメント'],
  '設備・技術': ['危険物取扱者', '電気工事士', '消防設備士', 'ボイラー技士'],
  '医療・福祉': ['医療事務', '介護福祉士', 'ケアマネージャー', '登録販売者'],
  'ビジネス・金融': ['FP3級', 'FP2級', '証券外務員', '秘書検定', '中小企業診断士'],
  '食品・環境': ['食品衛生責任者', '調理師', '環境計量士'],
  'IT系': ['基本情報', '応用情報', 'ITパスポート', 'ネットワーク', 'データベース', 'セキュリティ'],
  'その他': ['法律', '会計', 'ビジネス', '教養', '実務'],
  'ITパスポート': ['情報セキュリティ', 'ネットワーク', 'データベース', 'プロジェクト管理'],
  '基本情報': ['アルゴリズム', 'データ構造', 'OS', 'ネットワーク', 'SQL'],
  '英語': ['英単語', '英文法', '英会話', 'TOEIC', '英検'],
  '英検': ['英検5級〜3級', '英検2級', '英検準1級', '英検1級'],
  'TOEIC': ['リスニング', 'リーディング', 'ビジネス英語', '文法'],
  '韓国語': ['ハングル文字', '基本文法', 'K-POP関連', '日常会話', 'TOPIK'],
  '中国語': ['ピンイン', '声調', '基本文法', 'HSK'],
  'ユーザー創作問題': ['自由テーマ', 'オリジナル設定', 'コラボ企画', '期間限定問題'],
};

/**
 * 作問画面向け（旧 CATEGORIES 互換）
 * - 文系学問 / 理系学問は先頭に固定表示（受験区分→科目の2段階選択に使う）
 * - そのほかは sub を持つカテゴリーを表示
 */
export const CREATION_CATEGORIES: { label: string; sub: string[] }[] = [
  { label: '文系学問', sub: [] },
  { label: '理系学問', sub: [] },
  { label: '資格', sub: ['法律・不動産', 'IT・情報', '設備・技術', '医療・福祉', 'ビジネス・金融', '食品・環境'] },
  {
    label: '語学',
    sub: ['英単語', '英文法', '英熟語', '英会話', '韓国語', '中国語', 'フランス語', 'スペイン語', 'ドイツ語'],
  },
  { label: 'アニメ・漫画', sub: ['アニメ', '漫画', 'ゲーム'] },
  { label: '芸能', sub: ['映画', '音楽', '芸能'] },
  { label: '趣味・教養', sub: ['雑学', 'スポーツ'] },
  { label: '創作', sub: ['ユーザー創作問題'] },
];

