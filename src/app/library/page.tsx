'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Sparkles, ChevronRight, X, BookOpen } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { AcademyUserQuestion } from '@/types';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { getItemById } from '@/data/items';

const BOOK_SIZE = 30;
const BOOKS_PER_SHELF = 8;
const PAGE_SIZE = 10;

type ShelfDef = {
  id: string; title: string; icon: string; accent: string;
  bgFrom: string; bgTo: string; tagBg: string; tagText: string;
  spineColors: string[];
  matches: (q: AcademyUserQuestion) => boolean;
};
type BookEntry = { id: string; title: string; pages: AcademyUserQuestion[]; recoveredCount: number; spineColor: string; spineWidth: number; };
type SubjectEntry = { name: string; books: BookEntry[]; recoveredCount: number; totalCount: number; };
type ShelfEntry = ShelfDef & { subjects: SubjectEntry[]; recoveredCount: number; totalCount: number; };

const normalize = (v: unknown): string => String(v ?? '').trim();
const includesAny = (v: string, words: string[]) => words.some((w) => v.includes(w));
const eqAny = (v: string, words: string[]) => words.includes(v);

const isLiberalCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  const subject = normalize(q.subjectText);
  if (big === '文系学問') return true;
  return (
    eqAny(sub, ['英語', '国語', '社会', '日本史', '世界史', '地理', '政治経済', '倫理', '公民', '現代文', '古文', '漢文', '哲学', '心理学']) ||
    includesAny(subject, ['英語', '国語', '社会', '日本史', '世界史', '地理', '政治経済', '倫理', '公民', '現代文', '古文', '漢文', '哲学', '心理学'])
  );
};

const isScienceCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  const subject = normalize(q.subjectText);
  if (big === '理系学問') return true;
  return (
    eqAny(sub, ['算数', '数学', '数学ⅠA', '数学ⅡB', '数学Ⅲ', '理科', '物理', '化学', '生物', '地学', '情報・統計']) ||
    includesAny(subject, ['算数', '数学', '数学ⅠA', '数学ⅡB', '数学Ⅲ', '理科', '物理', '化学', '生物', '地学', '情報・統計'])
  );
};

const isLanguageCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  if (big === '語学' || big === '言語' || big === '英語' || big === '韓国語・中国語' || big === 'その他言語') return true;
  return eqAny(sub, ['英語', '英単語', '英文法', '英熟語', '英会話', '韓国語', '中国語', 'フランス語', 'スペイン語', 'ドイツ語']);
};

const isAnimeMangaCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  return big === 'アニメ・漫画' || (big === 'エンタメ' && eqAny(sub, ['漫画・アニメ', 'ゲーム']));
};

const isEntertainmentCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  return big === '芸能' || (big === 'エンタメ' && eqAny(sub, ['映画', '音楽', 'ドラマ']));
};

const isHobbyCategory = (q: AcademyUserQuestion): boolean => normalize(q.bigCategory) === '趣味・教養';

const isCreativeCategory = (q: AcademyUserQuestion): boolean => {
  const big = normalize(q.bigCategory);
  const sub = normalize(q.subCategory);
  return big === '創作' || big === 'オリジナル' || eqAny(sub, ['ユーザー創作問題', '自由テーマ', 'コラボ', '期間限定']);
};

const shelfDefinitions: ShelfDef[] = [
  { id: 'liberal', title: '文系学問の本棚', icon: '📚', accent: '#db2777', bgFrom: '#fce7f3', bgTo: '#fdf2f8', tagBg: '#fce7f3', tagText: '#9d174d', spineColors: ['#f472b6','#ec4899','#db2777','#be185d','#fbcfe8','#f9a8d4','#fda4af','#fb7185'], matches: (q) => isLiberalCategory(q) },
  { id: 'science', title: '理系学問の本棚', icon: '🔬', accent: '#2563eb', bgFrom: '#dbeafe', bgTo: '#eff6ff', tagBg: '#dbeafe', tagText: '#1e40af', spineColors: ['#60a5fa','#3b82f6','#2563eb','#1d4ed8','#93c5fd','#bfdbfe','#7dd3fc','#38bdf8'], matches: (q) => isScienceCategory(q) },
  { id: 'cert', title: '資格の本棚', icon: '🏅', accent: '#d97706', bgFrom: '#fef3c7', bgTo: '#fffbeb', tagBg: '#fef3c7', tagText: '#92400e', spineColors: ['#fbbf24','#f59e0b','#d97706','#b45309','#fde68a','#fef08a','#fcd34d','#fb923c'], matches: (q) => normalize(q.bigCategory) === '資格' },
  { id: 'language', title: '語学の本棚', icon: '🌍', accent: '#0891b2', bgFrom: '#cffafe', bgTo: '#ecfeff', tagBg: '#cffafe', tagText: '#164e63', spineColors: ['#22d3ee','#06b6d4','#0891b2','#0e7490','#a5f3fc','#67e8f9','#38bdf8','#7dd3fc'], matches: (q) => isLanguageCategory(q) },
  { id: 'anime', title: 'アニメ・漫画の本棚', icon: '🎬', accent: '#9333ea', bgFrom: '#f3e8ff', bgTo: '#faf5ff', tagBg: '#f3e8ff', tagText: '#6b21a8', spineColors: ['#c084fc','#a855f7','#9333ea','#7e22ce','#ddd6fe','#e9d5ff','#f0abfc','#d946ef'], matches: (q) => isAnimeMangaCategory(q) },
  { id: 'entertainment', title: '芸能の本棚', icon: '🎤', accent: '#e11d48', bgFrom: '#ffe4e6', bgTo: '#fff1f2', tagBg: '#ffe4e6', tagText: '#9f1239', spineColors: ['#fb7185','#f43f5e','#e11d48','#be123c','#fecdd3','#fda4af','#fda4af','#fb7185'], matches: (q) => isEntertainmentCategory(q) },
  { id: 'hobby', title: '教養の本棚', icon: '🧩', accent: '#059669', bgFrom: '#dcfce7', bgTo: '#f0fdf4', tagBg: '#dcfce7', tagText: '#065f46', spineColors: ['#34d399','#10b981','#059669','#047857','#a7f3d0','#6ee7b7','#5eead4','#2dd4bf'], matches: (q) => isHobbyCategory(q) },
  { id: 'creative', title: '創作の本棚', icon: '✍️', accent: '#f59e0b', bgFrom: '#fef3c7', bgTo: '#fff7ed', tagBg: '#fef3c7', tagText: '#92400e', spineColors: ['#fbbf24','#f59e0b','#d97706','#b45309','#fde68a','#fcd34d','#fdba74','#fb923c'], matches: (q) => isCreativeCategory(q) },
];

// ① 半角数字 → 全角数字（縦書き背表紙用）
const toVerticalNum = (n: number): string =>
  String(n).split('').map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join('');

const buildShelves = (questions: AcademyUserQuestion[]): ShelfEntry[] => {
  const sorted = [...questions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return shelfDefinitions.map((def) => {
    const sq = sorted.filter((q) => def.matches(q));
    const bySubject = new Map<string, AcademyUserQuestion[]>();
    for (const q of sq) {
      const key = normalize(q.subjectText) || normalize(q.subCategory) || '未分類';
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(q);
    }
    let globalBookIdx = 0;
    const subjects: SubjectEntry[] = Array.from(bySubject.entries()).map(([name, qs]) => {
      const books: BookEntry[] = [];
      for (let i = 0; i < qs.length; i += BOOK_SIZE) {
        const chunk = qs.slice(i, i + BOOK_SIZE);
        if (!chunk.length) continue;
        const bookNum = Math.floor(i / BOOK_SIZE) + 1;
        const spineColor = def.spineColors[globalBookIdx % def.spineColors.length];
        const spineWidth = Math.min(36, Math.max(24, 22 + Math.floor(chunk.length / 8) * 3));
        books.push({
          id: `${def.id}-${name}-${bookNum}`,
          // ① 2冊目以降の番号を全角縦書き用数字に変換
          title: bookNum === 1 ? name : `${name}${toVerticalNum(bookNum)}`,
          pages: chunk,
          recoveredCount: chunk.filter((p) => (p.correctCount ?? 0) > 0).length,
          spineColor, spineWidth,
        });
        globalBookIdx++;
      }
      return { name, books, recoveredCount: books.reduce((s, b) => s + b.recoveredCount, 0), totalCount: books.reduce((s, b) => s + b.pages.length, 0) };
    });
    return { ...def, subjects, recoveredCount: subjects.reduce((s, sub) => s + sub.recoveredCount, 0), totalCount: subjects.reduce((s, sub) => s + sub.totalCount, 0) };
  });
};

const RestoreBar = ({ rate, accent }: { rate: number; accent: string }) => (
  <div style={{ height: 6, borderRadius: 100, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(rate * 100)}%` }} transition={{ duration: 1.1, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 100, background: accent, boxShadow: `0 2px 6px ${accent}55` }} />
  </div>
);

const BookshelfRow = ({ books, onSelectBook, rowIndex }: { books: BookEntry[]; onSelectBook: (book: BookEntry) => void; rowIndex: number; }) => {
  const emptySlots = Math.max(0, 4 - books.length);
  return (
    <div style={{ borderRadius: rowIndex === 0 ? '16px 16px 0 0' : '0', overflow: 'hidden', background: 'linear-gradient(to bottom, #faf5eb, #f5f0e0)', border: '2px solid #d4b896', borderBottom: 'none', boxShadow: '0 2px 8px rgba(139,90,43,0.08)' }}>
      <div style={{ height: 8, background: 'linear-gradient(to bottom, #c8a882, #b8946e)', borderBottom: '2px solid #a07850' }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, padding: '12px 12px 0', minHeight: 90, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {books.map((book, i) => {
          const rate = book.pages.length > 0 ? book.recoveredCount / book.pages.length : 0;
          const isComplete = rate >= 1;
          const hasAny = book.recoveredCount > 0;
          const spineHeight = hasAny ? Math.max(44, Math.round(44 + rate * 36)) : 44;
          return (
            <motion.button key={book.id} onClick={() => onSelectBook(book)}
              style={{ width: book.spineWidth, height: spineHeight, borderRadius: '4px 4px 0 0', flexShrink: 0, background: hasAny ? `linear-gradient(to right, ${book.spineColor}cc, ${book.spineColor}, ${book.spineColor}dd)` : 'linear-gradient(to right, #e5e7eb, #d1d5db)', boxShadow: hasAny ? '2px 0 6px rgba(0,0,0,0.15), inset 2px 0 4px rgba(255,255,255,0.3)' : '1px 0 4px rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
              initial={{ height: 20, opacity: 0.4 }} animate={{ height: spineHeight, opacity: 1 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 160, damping: 20 }}
              whileHover={{ y: -5 }} whileTap={{ scale: 0.96 }}
            >
              {hasAny && (
                <p style={{ writingMode: 'vertical-rl', fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 3px rgba(0,0,0,0.4)', letterSpacing: '0.05em', maxHeight: '80%', overflow: 'hidden' }}>
                  {book.title}
                </p>
              )}
              {isComplete && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ position: 'absolute', top: 2, right: 1, fontSize: 7 }}>✨</motion.div>}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '100%', background: 'linear-gradient(to right, rgba(255,255,255,0.22), transparent)', pointerEvents: 'none' }} />
            </motion.button>
          );
        })}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`e-${i}`} style={{ width: 26, height: 44, borderRadius: '4px 4px 0 0', background: 'linear-gradient(to right, #f3f4f6, #e9ecef)', border: '1px dashed #d1d5db', opacity: 0.45 }} />
        ))}
      </div>
      <div style={{ height: 14, background: 'linear-gradient(to bottom, #b8946e, #a07850)', boxShadow: '0 3px 8px rgba(100,60,20,0.20)' }} />
    </div>
  );
};

const BookshelfVisual = ({ shelf, onSelectBook }: { shelf: ShelfEntry; onSelectBook: (book: BookEntry) => void; }) => {
  const allBooks = shelf.subjects.flatMap((s) => s.books);
  const rows: BookEntry[][] = [];
  for (let i = 0; i < allBooks.length; i += BOOKS_PER_SHELF) rows.push(allBooks.slice(i, i + BOOKS_PER_SHELF));
  if (rows.length === 0) rows.push([]);
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '2px solid #d4b896' }}>
      {rows.map((rowBooks, ri) => <BookshelfRow key={ri} books={rowBooks} onSelectBook={onSelectBook} rowIndex={ri} />)}
      <div style={{ height: 10, background: 'linear-gradient(to bottom, #8B5E3C, #6B4226)', borderTop: '2px solid #5a3520' }} />
    </div>
  );
};

const SuhimochiComment = ({ message, emoji }: { message: string; emoji: string }) => {
  const equipment = useGameStore((s) => s.equipment);
  const equippedDetails = useMemo(() => ({ head: equipment.head ? getItemById(equipment.head) : undefined, body: equipment.body ? getItemById(equipment.body) : undefined, face: equipment.face ? getItemById(equipment.face) : undefined, accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined }), [equipment]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 180 }} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
      <div style={{ flexShrink: 0 }}><PotatoAvatar equipped={equippedDetails} emotion="happy" size={68} ssrEffect={false} showShadow={false} /></div>
      <motion.div style={{ background: 'white', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '2px solid #f3e8ff', flex: 1 }} animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8', lineHeight: 1.5 }}>{emoji} {message}</p>
      </motion.div>
    </motion.div>
  );
};

const QuestionDetailSheet = ({ page, accent, onClose }: { page: AcademyUserQuestion; accent: string; onClose: () => void }) => {
  const recovered = (page.correctCount ?? 0) > 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 30 }} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, borderRadius: '24px 24px 0 0', background: 'white', padding: '0 0 40px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}><div style={{ width: 40, height: 4, borderRadius: 100, background: '#e5e7eb' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 12px', borderBottom: `2px solid ${accent}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: recovered ? accent : '#d1d5db', boxShadow: recovered ? `0 0 8px ${accent}88` : 'none' }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: recovered ? accent : '#9ca3af' }}>{recovered ? '✓ 回収済み' : '未回収'}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: 16, height: 16, color: '#6b7280' }} /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '14px 16px', borderRadius: 16, background: `linear-gradient(135deg, ${accent}0e, ${accent}06)`, border: `1.5px solid ${accent}22` }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: accent, marginBottom: 6 }}><BookOpen style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />問題文</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', lineHeight: 1.6 }}>{page.question}</p>
          </div>
          {page.choices && page.choices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>選択肢</p>
              {page.choices.map((choice, i) => { const isAnswer = i === page.answerIndex; return (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 12, background: isAnswer ? `${accent}12` : '#f9fafb', border: `1.5px solid ${isAnswer ? accent + '44' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: isAnswer ? accent : '#e5e7eb', color: isAnswer ? 'white' : '#9ca3af', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{['①','②','③','④'][i]}</span>
                  <p style={{ fontSize: 13, fontWeight: isAnswer ? 700 : 500, color: isAnswer ? '#1f2937' : '#6b7280' }}>{choice}</p>
                  {isAnswer && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: accent, background: `${accent}18`, padding: '2px 8px', borderRadius: 100, border: `1px solid ${accent}33`, flexShrink: 0 }}>正解</span>}
                </div>
              ); })}
            </div>
          )}
          {page.explanation && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 6 }}>💡 解説</p>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{page.explanation}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const PageSelector = ({ current, total, accent, tagBg, tagText, onChange }: { current: number; total: number; accent: string; tagBg: string; tagText: string; onChange: (p: number) => void; }) => {
  if (total <= 1) return null;
  const getPageNums = () => {
    const nums: (number | '...')[] = [];
    if (total <= 7) { for (let i = 0; i < total; i++) nums.push(i); return nums; }
    nums.push(0);
    if (current > 2) nums.push('...');
    for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) nums.push(i);
    if (current < total - 3) nums.push('...');
    nums.push(total - 1);
    return nums;
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px 16px', flexWrap: 'wrap' }}>
      <motion.button onClick={() => onChange(Math.max(0, current - 1))} disabled={current === 0} style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${current === 0 ? '#e5e7eb' : accent + '55'}`, background: current === 0 ? '#f9fafb' : tagBg, color: current === 0 ? '#d1d5db' : tagText, fontSize: 11, fontWeight: 700, cursor: current === 0 ? 'default' : 'pointer' }} whileHover={current > 0 ? { scale: 1.05 } : {}} whileTap={current > 0 ? { scale: 0.95 } : {}}>←</motion.button>
      {getPageNums().map((num, i) => num === '...' ? <span key={`d${i}`} style={{ fontSize: 12, color: '#9ca3af', padding: '0 2px' }}>…</span> : <motion.button key={num} onClick={() => onChange(num)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: num === current ? accent : 'transparent', color: num === current ? 'white' : '#6b7280', fontSize: 12, fontWeight: num === current ? 800 : 500, cursor: 'pointer', boxShadow: num === current ? `0 2px 8px ${accent}44` : 'none' }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}>{num + 1}</motion.button>)}
      <motion.button onClick={() => onChange(Math.min(total - 1, current + 1))} disabled={current === total - 1} style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${current === total - 1 ? '#e5e7eb' : accent + '55'}`, background: current === total - 1 ? '#f9fafb' : tagBg, color: current === total - 1 ? '#d1d5db' : tagText, fontSize: 11, fontWeight: 700, cursor: current === total - 1 ? 'default' : 'pointer' }} whileHover={current < total - 1 ? { scale: 1.05 } : {}} whileTap={current < total - 1 ? { scale: 0.95 } : {}}>→</motion.button>
    </div>
  );
};

type NavPhase = 'shelves' | 'subjects' | 'books' | 'pages';

export default function LibraryPage() {
  const academyUserQuestions = useGameStore((s) => s.academyUserQuestions);
  const refreshAcademyQuestions = useGameStore((s) => s.refreshAcademyQuestions);
  const [phase, setPhase] = useState<NavPhase>('shelves');
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<AcademyUserQuestion | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => { void refreshAcademyQuestions(); }, [refreshAcademyQuestions]);

  const shelves = useMemo(() => buildShelves(academyUserQuestions), [academyUserQuestions]);
  const totals = useMemo(() => ({ total: shelves.reduce((s, sh) => s + sh.totalCount, 0), recovered: shelves.reduce((s, sh) => s + sh.recoveredCount, 0) }), [shelves]);
  const ratio = totals.total > 0 ? totals.recovered / totals.total : 0;
  const pct = Math.round(ratio * 100);
  const getStage = (r: number) => { if (r >= 1) return { message: 'すべてのことばが集まったよ！すごい！', emoji: '🎉' }; if (r >= 0.7) return { message: 'あともう少し！一緒にがんばろう！', emoji: '✨' }; if (r >= 0.3) return { message: 'どんどんことばが増えてきたね！', emoji: '📖' }; return { message: 'ことばを集めて図書館を完成させよう！', emoji: '🌱' }; };
  const stage = getStage(ratio);

  const selectedShelf = useMemo(() => shelves.find((s) => s.id === selectedShelfId) ?? null, [shelves, selectedShelfId]);
  const selectedSubject = useMemo(() => selectedShelf?.subjects.find((s) => s.name === selectedSubjectName) ?? null, [selectedShelf, selectedSubjectName]);
  const selectedBook = useMemo(() => selectedSubject?.books.find((b) => b.id === selectedBookId) ?? null, [selectedSubject, selectedBookId]);
  const totalPages = selectedBook ? Math.ceil(selectedBook.pages.length / PAGE_SIZE) : 1;
  const pagedQuestions = useMemo(() => { if (!selectedBook) return []; return selectedBook.pages.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE); }, [selectedBook, pageIndex]);

  const goToBook = (book: BookEntry, shelfId: string, subjectName: string) => { setSelectedShelfId(shelfId); setSelectedSubjectName(subjectName); setSelectedBookId(book.id); setPageIndex(0); setPhase('pages'); };
  const handleSelectShelf = (shelf: ShelfEntry) => { setSelectedShelfId(shelf.id); setSelectedSubjectName(null); setSelectedBookId(null); setPageIndex(0); setPhase('subjects'); };
  const handleSelectSubject = (subject: SubjectEntry) => { setSelectedSubjectName(subject.name); setSelectedBookId(null); setPageIndex(0); if (subject.books.length === 1) { setSelectedBookId(subject.books[0].id); setPhase('pages'); } else { setPhase('books'); } };
  const handleSelectBook = (book: BookEntry) => { setSelectedBookId(book.id); setPageIndex(0); setPhase('pages'); };
  const handleBack = () => { if (phase === 'pages') { if (selectedSubject && selectedSubject.books.length === 1) { setPhase('subjects'); } else { setPhase('books'); } setSelectedBookId(null); setPageIndex(0); } else if (phase === 'books') { setPhase('subjects'); setSelectedSubjectName(null); } else if (phase === 'subjects') { setPhase('shelves'); setSelectedShelfId(null); } };

  const breadcrumb = [
    { label: '本棚', phase: 'shelves' as NavPhase },
    ...(selectedShelf ? [{ label: selectedShelf.title, phase: 'subjects' as NavPhase }] : []),
    ...(selectedSubject ? [{ label: selectedSubject.name, phase: 'books' as NavPhase }] : []),
    ...(selectedBook && selectedSubject && selectedSubject.books.length > 1 ? [{ label: selectedBook.title, phase: 'pages' as NavPhase }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fdf4ff 0%, #f0f9ff 40%, #f0fdf4 100%)', paddingBottom: 80, fontFamily: "'Noto Sans JP', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`@keyframes lib-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}.lib-deco{position:absolute;pointer-events:none;}`}</style>
      <div className="lib-deco" style={{ top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #f3e8ff88, transparent)' }} />
      <div className="lib-deco" style={{ bottom: 100, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, #dbeafe66, transparent)' }} />
      {(['✦','★','✦','⭐'] as const).map((s, i) => (<span key={i} className="lib-deco" style={{ left: `${[8,88,5,92][i]}%`, top: `${[10,6,55,35][i]}%`, fontSize: [14,10,8,12][i], color: ['#c084fc','#93c5fd','#86efac','#fcd34d'][i], opacity: 0.45, animation: `lib-float ${[2.2,3.1,2.7,3.5][i]}s ease-in-out ${[0,0.8,1.2,0.4][i]}s infinite` }}>{s}</span>))}

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', borderBottom: '2px solid #f3e8ff', boxShadow: '0 2px 12px rgba(168,85,247,0.08)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          {phase === 'shelves' ? (<Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#7c3aed', textDecoration: 'none', fontWeight: 700 }}><ArrowLeft style={{ width: 14, height: 14 }} />戻る</Link>) : (<button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#7c3aed', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}><ArrowLeft style={{ width: 14, height: 14 }} />戻る</button>)}
          <div style={{ textAlign: 'center' }}><p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 1 }}>Kotoba Library</p><p style={{ fontSize: 15, fontWeight: 900, color: '#6b21a8' }}>📚 ことば図書館</p></div>
          <div style={{ textAlign: 'right' }}><p style={{ fontSize: 9, color: '#a78bfa' }}>回収</p><p style={{ fontSize: 15, fontWeight: 900, color: '#7c3aed' }}>{totals.recovered}<span style={{ fontSize: 10, fontWeight: 500, color: '#c084fc', marginLeft: 2 }}>語</span></p></div>
        </div>
        {phase !== 'shelves' && (
          <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            {breadcrumb.map((crumb, i) => (<span key={crumb.phase} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{i > 0 && <ChevronRight style={{ width: 10, height: 10, color: '#d1d5db' }} />}<span style={{ fontSize: 11, fontWeight: i === breadcrumb.length - 1 ? 800 : 600, color: i === breadcrumb.length - 1 ? '#7c3aed' : '#9ca3af' }}>{crumb.label}</span></span>))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '16px 16px 0' }}>
        <AnimatePresence mode="wait">
          {phase === 'shelves' && (
            <motion.div key="shelves" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <SuhimochiComment message={stage.message} emoji={stage.emoji} />
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: 20, padding: '16px 18px', marginBottom: 20, background: 'white', border: '2px solid #f3e8ff', boxShadow: '0 4px 20px rgba(168,85,247,0.10)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #f3e8ff, #ddd6fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkles style={{ width: 16, height: 16, color: '#7c3aed' }} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><p style={{ fontSize: 13, fontWeight: 800, color: '#374151' }}>図書館の回収率</p><p style={{ fontSize: 14, fontWeight: 900, color: '#7c3aed' }}>{pct}%</p></div>
                    <RestoreBar rate={ratio} accent="#7c3aed" />
                    <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{totals.recovered} / {totals.total} ことばを回収済み</p>
                  </div>
                </div>
              </motion.div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {shelves.map((shelf, i) => { const rate = shelf.totalCount > 0 ? shelf.recoveredCount / shelf.totalCount : 0; return (
                  <motion.div key={shelf.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>{shelf.icon}</span><div><p style={{ fontSize: 14, fontWeight: 900, color: '#1f2937' }}>{shelf.title}</p><p style={{ fontSize: 10, color: '#9ca3af' }}>{shelf.subjects.length}科目 ・ {shelf.recoveredCount}/{shelf.totalCount} 回収済み</p></div></div>
                      <motion.button onClick={() => handleSelectShelf(shelf)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 100, background: shelf.tagBg, color: shelf.tagText, border: `1.5px solid ${shelf.accent}33`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>本を見る <ChevronRight style={{ width: 12, height: 12 }} /></motion.button>
                    </div>
                    <div style={{ marginBottom: 8 }}><RestoreBar rate={rate} accent={shelf.accent} /></div>
                    <BookshelfVisual shelf={shelf} onSelectBook={(book) => { const sub = shelf.subjects.find((s) => s.books.some((b) => b.id === book.id)); if (sub) goToBook(book, shelf.id, sub.name); }} />
                  </motion.div>
                ); })}
              </div>
            </motion.div>
          )}

          {phase === 'subjects' && selectedShelf && (
            <motion.div key="subjects" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
              <div style={{ marginBottom: 12 }}><BookshelfVisual shelf={selectedShelf} onSelectBook={(book) => { const sub = selectedShelf.subjects.find((s) => s.books.some((b) => b.id === book.id)); if (sub) goToBook(book, selectedShelf.id, sub.name); }} /></div>
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 14, fontWeight: 600 }}>科目を選んでください</p>
              {selectedShelf.subjects.length === 0 ? (<div style={{ borderRadius: 16, padding: '24px', textAlign: 'center', background: 'white', border: '2px dashed #e5e7eb' }}><p style={{ fontSize: 32, marginBottom: 8 }}>📭</p><p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.7, fontWeight: 600 }}>まだ本がありません。<br />みんなの問題を解いて本棚を埋めよう！</p></div>) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedShelf.subjects.map((subject, i) => { const rate = subject.totalCount > 0 ? subject.recoveredCount / subject.totalCount : 0; return (
                    <motion.button key={subject.name} onClick={() => handleSelectSubject(subject)} style={{ borderRadius: 16, border: `2px solid ${rate >= 1 ? selectedShelf.accent + '66' : subject.recoveredCount > 0 ? selectedShelf.accent + '33' : '#e5e7eb'}`, background: subject.recoveredCount > 0 ? `linear-gradient(135deg, ${selectedShelf.bgFrom}88, ${selectedShelf.bgTo}88)` : '#f9fafb', padding: '12px 14px', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 700, color: subject.recoveredCount > 0 ? '#1f2937' : '#9ca3af', marginBottom: 6 }}>{subject.name}</p><RestoreBar rate={rate} accent={selectedShelf.accent} /><p style={{ fontSize: 10, color: subject.recoveredCount > 0 ? selectedShelf.accent : '#d1d5db', marginTop: 4 }}>{subject.books.length}冊 ・ {subject.recoveredCount}/{subject.totalCount} 回収済み</p></div>
                      <ChevronRight style={{ width: 16, height: 16, color: '#d1d5db', flexShrink: 0 }} />
                    </motion.button>
                  ); })}
                </div>
              )}
            </motion.div>
          )}

          {phase === 'books' && selectedSubject && selectedShelf && (
            <motion.div key="books" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 12 }}>{selectedSubject.name} の本</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedSubject.books.map((book, i) => { const rate = book.pages.length > 0 ? book.recoveredCount / book.pages.length : 0; return (
                  <motion.button key={book.id} onClick={() => handleSelectBook(book)} style={{ borderRadius: 16, border: `2px solid ${rate >= 1 ? selectedShelf.accent + '66' : book.recoveredCount > 0 ? selectedShelf.accent + '33' : '#e5e7eb'}`, background: book.recoveredCount > 0 ? `linear-gradient(135deg, ${selectedShelf.bgFrom}88, ${selectedShelf.bgTo}88)` : '#f9fafb', padding: '12px 14px', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}>
                    <div style={{ width: 10, height: 48, borderRadius: 5, flexShrink: 0, background: book.recoveredCount > 0 ? book.spineColor : '#e5e7eb', boxShadow: book.recoveredCount > 0 ? `0 2px 8px ${book.spineColor}55` : 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 700, color: book.recoveredCount > 0 ? '#1f2937' : '#9ca3af', marginBottom: 6 }}>{book.title}</p><RestoreBar rate={rate} accent={selectedShelf.accent} /><p style={{ fontSize: 10, color: book.recoveredCount > 0 ? selectedShelf.accent : '#d1d5db', marginTop: 4 }}>{book.recoveredCount}/{book.pages.length} ページ回収済み</p></div>
                    {rate >= 1 && <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 100, background: selectedShelf.tagBg, color: selectedShelf.tagText, border: `1px solid ${selectedShelf.accent}44`, flexShrink: 0 }}>✨ 完成</span>}
                    <ChevronRight style={{ width: 16, height: 16, color: '#d1d5db', flexShrink: 0 }} />
                  </motion.button>
                ); })}
              </div>
            </motion.div>
          )}

          {phase === 'pages' && selectedBook && selectedShelf && (
            <motion.div key="pages" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
              <div style={{ borderRadius: '16px 16px 0 0', padding: '14px 16px', background: `linear-gradient(135deg, ${selectedShelf.bgFrom}, ${selectedShelf.bgTo})`, border: `2px solid ${selectedShelf.accent}33`, borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 52, borderRadius: 5, background: selectedBook.spineColor, boxShadow: `0 2px 8px ${selectedBook.spineColor}55` }} />
                  <div><p style={{ fontSize: 10, color: selectedShelf.accent, fontWeight: 600, marginBottom: 2 }}>{selectedShelf.icon} {selectedShelf.title}</p><p style={{ fontSize: 17, fontWeight: 900, color: '#1f2937' }}>{selectedBook.title}</p></div>
                </div>
                <div style={{ textAlign: 'right' }}><p style={{ fontSize: 16, fontWeight: 900, color: selectedShelf.accent }}>{Math.round((selectedBook.recoveredCount / Math.max(selectedBook.pages.length, 1)) * 100)}%</p><p style={{ fontSize: 9, color: '#9ca3af' }}>{selectedBook.recoveredCount}/{selectedBook.pages.length}</p></div>
              </div>
              <div style={{ borderRadius: '0 0 16px 16px', border: `2px solid ${selectedShelf.accent}22`, borderTop: 'none', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 12px 8px' }}>
                  {pagedQuestions.map((page, i) => { const recovered = (page.correctCount ?? 0) > 0; const globalIdx = pageIndex * PAGE_SIZE + i; return (
                    <motion.button key={page.id} onClick={() => setDetailPage(page)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 12, textAlign: 'left', width: '100%', cursor: 'pointer', background: recovered ? 'rgba(255,255,255,0.9)' : 'rgba(249,250,251,0.8)', border: `1.5px solid ${recovered ? selectedShelf.accent + '33' : '#e5e7eb'}`, boxShadow: recovered ? `0 2px 8px ${selectedShelf.accent}11` : 'none' }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ scale: 1.01, x: 2 }} whileTap={{ scale: 0.98 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: recovered ? selectedShelf.accent : '#d1d5db', boxShadow: recovered ? `0 0 6px ${selectedShelf.accent}66` : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 10, color: recovered ? selectedShelf.accent : '#9ca3af', marginBottom: 3, fontWeight: 700 }}>ページ {globalIdx + 1}　{recovered ? '✓ 回収済み' : '未回収'}</p><p style={{ fontSize: 13, color: recovered ? '#1f2937' : '#9ca3af', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{page.question}</p></div>
                      <ChevronRight style={{ width: 14, height: 14, color: '#d1d5db', flexShrink: 0, marginTop: 2 }} />
                    </motion.button>
                  ); })}
                </div>
                <PageSelector current={pageIndex} total={totalPages} accent={selectedShelf.accent} tagBg={selectedShelf.tagBg} tagText={selectedShelf.tagText} onChange={(p) => { setPageIndex(p); }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {detailPage && selectedShelf && (<QuestionDetailSheet page={detailPage} accent={selectedShelf.accent} onClose={() => setDetailPage(null)} />)}
      </AnimatePresence>
    </div>
  );
}
