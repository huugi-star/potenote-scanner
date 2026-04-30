'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Calendar, Search, Crown
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { PotatoAvatar } from '@/components/ui/PotatoAvatar';
import { AdsModal } from '@/components/ui/AdsModal';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { LIMITS } from '@/lib/constants';
import { generateQuizPDF } from '@/lib/pdfUtils';
import { getItemById } from '@/data/items';
import type { QuizHistory, QuizRaw, QuizResult } from '@/types';

interface FreeQuestScreenProps {
  onBack: () => void;
  onStartQuiz: (quiz: QuizRaw, sourceHistoryId?: string) => void;
}

// ─── ACパレット ───────────────────────────────────────────────
const AC = {
  sky:       '#c8eaf5',
  green:     '#5cb85c',
  darkGreen: '#3a7a3a',
  leaf:      '#8dc63f',
  cream:     '#fef9ee',
  tan:       '#f0e6c8',
  sand:      '#e8d5a3',
  brown:     '#8b5e3c',
  text:      '#4a3728',
  muted:     '#9b7f6e',
  teal:      '#7dd4c0',
  yellow:    '#ffd966',
  pink:      '#ffb3c6',
  red:       '#e05555',
  blue:      '#5b9bd5',
};

const DECO = [
  { e:'🍃', t:'5%',  l:'3%',  s:20, r:-20, d:0   },
  { e:'🌿', t:'9%',  r:'4%',  s:18, r2:15, d:0.4 },
  { e:'🌸', t:'3%',  l:'38%', s:16, r:-8,  d:0.7 },
  { e:'⭐', t:'7%',  r:'20%', s:13, r2:10, d:0.3 },
  { e:'🍀', t:'14%', l:'7%',  s:14, r:-12, d:0.9 },
];

type PaginationItem = number | 'ellipsis';

function buildPaginationItems(totalPages: number, currentPage: number): PaginationItem[] {
  if (totalPages <= 0) return [];
  const cur = Math.max(1, Math.min(totalPages, currentPage));
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (const p of [cur - 1, cur, cur + 1]) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && prev != null && p - prev > 1) items.push('ellipsis');
    items.push(p);
  }
  return items;
}

const CIRCLED_NUMBERS: Record<number, string> = {
  1: '①',
  2: '②',
  3: '③',
  4: '④',
  5: '⑤',
  6: '⑥',
  7: '⑦',
  8: '⑧',
  9: '⑨',
  10: '⑩',
  11: '⑪',
  12: '⑫',
  13: '⑬',
  14: '⑭',
  15: '⑮',
  16: '⑯',
  17: '⑰',
  18: '⑱',
  19: '⑲',
  20: '⑳',
};

function circledNumber(n: number) {
  return CIRCLED_NUMBERS[n] ?? `(${n})`;
}

function parseCircledSuffix(title: string): number | null {
  const m = title.match(/(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|⑪|⑫|⑬|⑭|⑮|⑯|⑰|⑱|⑲|⑳)$/);
  if (!m) return null;
  const found = Object.entries(CIRCLED_NUMBERS).find(([, v]) => v === m[1]);
  return found ? Number(found[0]) : null;
}

export const FreeQuestScreen = ({ onBack, onStartQuiz }: FreeQuestScreenProps) => {
  const [searchQuery,    setSearchQuery]    = useState('');
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [generatingId,   setGeneratingId]   = useState<string | null>(null);
  const [showAdsModal,   setShowAdsModal]   = useState(false);
  const [selectedQuizIds,setSelectedQuizIds]= useState<Set<string>>(new Set());
  const [currentPage,    setCurrentPage]    = useState(1);
  const [pageJumpDraft,  setPageJumpDraft]  = useState('');

  const isVIP                         = useGameStore(s => s.isVIP);
  const uid                           = useGameStore(s => s.uid);
  const quizHistory                   = useGameStore(s => s.quizHistory);
  const equipment                     = useGameStore(s => s.equipment);
  const addQuestionsToHistory         = useGameStore(s => s.addQuestionsToHistory);
  const deleteQuizHistory             = useGameStore(s => s.deleteQuizHistory);
  const saveQuizHistory               = useGameStore(s => s.saveQuizHistory);
  const checkFreeQuestGenerationLimit = useGameStore(s => s.checkFreeQuestGenerationLimit);
  const incrementFreeQuestGenerationCount = useGameStore(s => s.incrementFreeQuestGenerationCount);
  const recoverFreeQuestGenerationCount   = useGameStore(s => s.recoverFreeQuestGenerationCount);
  const { addToast } = useToast();

  const equippedDetails = useMemo(() => ({
    head: equipment.head ? getItemById(equipment.head) : undefined,
    body: equipment.body ? getItemById(equipment.body) : undefined,
    face: equipment.face ? getItemById(equipment.face) : undefined,
    accessory: equipment.accessory ? getItemById(equipment.accessory) : undefined,
  }), [equipment.head, equipment.body, equipment.face, equipment.accessory]);

  const limitCheck         = checkFreeQuestGenerationLimit();
  const canGenerate        = isVIP || limitCheck.canGenerate;
  const remainingGenerations = isVIP
    ? LIMITS.VIP_USER.DAILY_FREE_QUEST_GENERATION_LIMIT
    : limitCheck.remaining;

  const filteredHistory = useMemo(() => {
    if (!searchQuery) return quizHistory;
    const q = searchQuery.toLowerCase();
    return quizHistory.filter(h =>
      (h.quiz.title || h.quiz.summary).toLowerCase().includes(q) ||
      h.quiz.keywords.some(k => k.toLowerCase().includes(q))
    );
  }, [quizHistory, searchQuery]);

  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  useEffect(() => {
    // 検索や履歴変化でページ外参照になったら補正
    setCurrentPage((p) => Math.max(1, Math.min(totalPages, p)));
  }, [totalPages]);

  useEffect(() => {
    // 検索が変わったら先頭ページへ
    setCurrentPage(1);
  }, [searchQuery]);

  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, currentPage]);

  const canGenerateFromSeed = (h: QuizHistory) =>
    !!h.quiz?.summary?.trim() &&
    Array.isArray(h.quiz?.keywords) && h.quiz.keywords.length > 0 &&
    Array.isArray(h.quiz?.questions) && h.quiz.questions.length > 0;

  const handleNewQuiz = async (history: QuizHistory) => {
    vibrateLight();
    if (!canGenerate) { addToast('error', limitCheck.error || '上限に達しました'); return; }
    if (!canGenerateFromSeed(history)) {
      addToast('info', '既存問題で挑戦します'); onStartQuiz(history.quiz, history.id); return;
    }
    setIsGenerating(true); setGeneratingId(history.id);
    try {
      const existingQA = history.quiz.questions.map(q => `問: ${q.q} → 正解: ${q.options[q.a]}`).join('\n');
      const existingQuestions = history.quiz.questions.map(q => ({ question: q.q, answer: q.options[q.a], choices: q.options }));
      const response = await fetch('/api/generate-quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'seed', uid: uid ?? undefined, summary: history.quiz.summary, keywords: history.quiz.keywords, existingQuestions, questionCount: 5, difficulty: 'normal', verifiedFacts: existingQA }),
      });
      if (response.status === 429) { alert('本日の上限に達しました。明日またお試しください！'); return; }
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      const newQuiz = result.quiz;
      if (newQuiz?.questions?.length > 0) {
        incrementFreeQuestGenerationCount();
        addQuestionsToHistory(history.id, newQuiz.questions);
        const newQuizId = `freequest_new_${Date.now()}`;
        const baseTitle = (history.quiz.title || history.quiz.summary || 'クイズ').trim();
        const maxExisting =
          quizHistory
            .filter((h) => (h.quiz?.title ?? '').startsWith(baseTitle))
            .map((h) => parseCircledSuffix(h.quiz.title))
            .filter((n): n is number => typeof n === 'number')
            .reduce((mx, n) => Math.max(mx, n), 1);
        const nextN = Math.min(99, Math.max(2, maxExisting + 1));
        const numberedTitle = `${baseTitle}${circledNumber(nextN)}`;
        const newQuizWithTitle: QuizRaw = { ...newQuiz, title: numberedTitle };
        const tempResult: QuizResult = { quizId: newQuizId, correctCount: 0, totalQuestions: newQuiz.questions.length, isPerfect: false, earnedCoins: 0, earnedDistance: 0, isDoubled: false, timestamp: new Date() };
        await saveQuizHistory(newQuizWithTitle, tempResult);
        addToast('success', '類題を生成しました！');
        onStartQuiz(newQuizWithTitle, newQuizId);
      } else throw new Error('No questions');
    } catch { addToast('error', '生成に失敗。既存問題で挑戦します'); onStartQuiz(history.quiz, history.id); }
    finally { setIsGenerating(false); setGeneratingId(null); }
  };

  const handleAdRewardClaimed = (adType: 'scan_recovery' | 'coin_doubler') => {
    if (adType === 'scan_recovery') {
      recoverFreeQuestGenerationCount(); setShowAdsModal(false); vibrateSuccess();
      addToast('success', '類題生成回数が3回回復しました！');
    }
  };

  const handleRetryQuiz = (history: QuizHistory) => {
    vibrateLight();
    const shuffled = [...history.quiz.questions].sort(() => Math.random() - 0.5);
    onStartQuiz({ ...history.quiz, questions: shuffled.slice(0, 5) }, history.id);
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm('このクイズを削除しますか？')) return;
    vibrateLight();
    try { await deleteQuizHistory(id); vibrateSuccess(); addToast('success', '削除しました'); }
    catch { addToast('error', '削除に失敗しました'); }
  };

  const handleExportPDF = async (history: QuizHistory) => {
    vibrateLight();
    try { await generateQuizPDF([history]); vibrateSuccess(); addToast('success', 'PDF生成しました'); }
    catch { addToast('error', 'PDF生成に失敗しました'); }
  };

  const toggleSelect = (id: string) => {
    vibrateLight();
    setSelectedQuizIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    vibrateLight();
    setSelectedQuizIds(selectedQuizIds.size === filteredHistory.length ? new Set() : new Set(filteredHistory.map(h => h.id)));
  };

  const handleExportSelectedPDFs = async () => {
    if (!selectedQuizIds.size) { addToast('info', 'PDF化する問題を選択してください'); return; }
    vibrateLight();
    try {
      await generateQuizPDF(filteredHistory.filter(h => selectedQuizIds.has(h.id)));
      vibrateSuccess(); addToast('success', `${selectedQuizIds.size}件をPDF化しました`); setSelectedQuizIds(new Set());
    } catch { addToast('error', 'PDF生成に失敗しました'); }
  };

  const formatDate = (s: string) => new Date(s).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: `linear-gradient(180deg, ${AC.sky} 0%, #daf0e8 28%, ${AC.cream} 58%, ${AC.tan} 100%)`,
      color: AC.text, position: 'relative', overflow: 'hidden',
    }}>

      {/* ─── 背景装飾 ─── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {DECO.map((d, i) => (
          (() => {
            const rotateBase =
              typeof (d as any).r === 'number'
                ? (d as any).r
                : typeof (d as any).r2 === 'number'
                  ? (d as any).r2
                  : 0;
            return (
          <motion.span key={i} style={{
            position: 'absolute', fontSize: d.s, opacity: 0.4,
            top: d.t, left: 'l' in d ? (d as any).l : undefined, right: 'r' in d ? (d as any).r : undefined,
            rotate: rotateBase,
          }}
            animate={{ y: [0, -6, 0], rotate: [rotateBase, rotateBase + 9, rotateBase] }}
            transition={{ duration: 3.5 + i * 0.3, delay: d.d, repeat: Infinity, ease: 'easeInOut' }}
          >{d.e}</motion.span>
            );
          })()
        ))}
      </div>

      {/* ─── ヘッダー ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(10px)',
        borderBottom: `3px solid ${AC.darkGreen}`,
        boxShadow: `0 3px 0 ${AC.leaf}55`,
      }}>
        <motion.button type="button" onClick={() => { vibrateLight(); onBack(); }} whileTap={{ scale: 0.9 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px 5px 8px',
            borderRadius: 99, background: AC.green, color: '#fff',
            border: `2px solid ${AC.darkGreen}`, boxShadow: `0 3px 0 ${AC.darkGreen}`,
            fontSize: 13, fontWeight: 900, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />もどる
        </motion.button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: AC.darkGreen }}>✦ きろくのしょこ ✦</div>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>記録の書庫</h1>
        </div>
        {isVIP
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 99, background: AC.yellow, color: AC.brown, border: `2px solid ${AC.brown}`, boxShadow: `0 2px 0 ${AC.brown}` }}><Crown style={{ width: 12, height: 12 }} />VIP</span>
          : <div style={{ width: 52 }} />
        }
      </header>

      {/* ─── コンテンツ ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 100px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* キャラ説明 */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: 20, padding: '12px 14px',
              background: 'rgba(255,255,255,0.75)',
              border: `2px solid ${AC.sand}`,
              boxShadow: `0 4px 0 ${AC.sand}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <PotatoAvatar
              emotion="smart"
              size={56}
              equipped={equippedDetails}
              showEmotionEffect={false}
              idleAnimation={false}
              showShadow={false}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: AC.darkGreen, marginBottom: 2 }}>📖 復習モード</div>
              <div style={{ fontSize: 12, color: AC.muted, lineHeight: 1.6 }}>
                過去のスキャンを何度でも復習できるよ！
                <br />
                スキャン回数は消費しないよ！
              </div>
            </div>
          </motion.div>

          {/* 生成回数バー */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{
              borderRadius: 16, padding: '10px 14px',
              background: isVIP ? `${AC.yellow}33` : canGenerate ? `${AC.teal}33` : `${AC.red}22`,
              border: `2px solid ${isVIP ? AC.yellow : canGenerate ? AC.teal : AC.red}`,
              boxShadow: `0 3px 0 ${isVIP ? '#c8a800' : canGenerate ? '#4aaa96' : '#b03030'}55`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isVIP ? 0 : 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {isVIP
                  ? <><span style={{ fontSize: 16 }}>👑</span><span style={{ fontSize: 13, fontWeight: 900, color: AC.brown }}>VIP: 1日100回まで類題生成OK!</span></>
                  : <><span style={{ fontSize: 16 }}>{canGenerate ? '✨' : '⚠️'}</span><span style={{ fontSize: 13, fontWeight: 900, color: canGenerate ? AC.darkGreen : AC.red }}>類題生成 残り {remainingGenerations}/{LIMITS.FREE_USER.DAILY_FREE_QUEST_GENERATION_LIMIT} 回</span></>
                }
              </div>
            </div>
            {!isVIP && (
              <div style={{
                height: 10, borderRadius: 99, background: 'rgba(0,0,0,0.12)',
                overflow: 'hidden', border: `1px solid rgba(0,0,0,0.1)`,
              }}>
                <motion.div
                  animate={{ width: `${(remainingGenerations / LIMITS.FREE_USER.DAILY_FREE_QUEST_GENERATION_LIMIT) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 99,
                    background: canGenerate
                      ? `linear-gradient(90deg, ${AC.teal}, ${AC.green})`
                      : `linear-gradient(90deg, ${AC.red}, #ff8a80)`,
                  }}
                />
              </div>
            )}
          </motion.div>

          {/* 検索バー */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: AC.muted }} />
            <input
              type="text" placeholder="キーワードで探す…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
                borderRadius: 99, fontSize: 13, color: AC.text,
                background: 'rgba(255,255,255,0.85)',
                border: `2px solid ${AC.sand}`,
                boxShadow: `0 3px 0 ${AC.sand}`,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ヘッダー行 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 16 }}>📚</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: AC.text }}>
                {filteredHistory.length}件のクイズ
              </span>
            </div>
            {filteredHistory.length > 0 && (
              <button onClick={toggleSelectAll} style={{
                fontSize: 12, fontWeight: 900, color: AC.darkGreen,
                padding: '4px 12px', borderRadius: 99,
                background: 'rgba(255,255,255,0.7)',
                border: `2px solid ${AC.leaf}`,
                boxShadow: `0 2px 0 ${AC.darkGreen}55`,
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}>
                {selectedQuizIds.size === filteredHistory.length ? '✓ 全解除' : '✓ 全選択'}
              </button>
            )}
          </div>

          {/* 空状態 */}
          {filteredHistory.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                textAlign: 'center', padding: '40px 20px',
                borderRadius: 24, background: 'rgba(255,255,255,0.6)',
                border: `2px dashed ${AC.sand}`,
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: AC.text, marginBottom: 6 }}>
                {searchQuery ? '見つからなかったよ' : 'まだクイズがないよ'}
              </div>
              <div style={{ fontSize: 12, color: AC.muted }}>
                {searchQuery ? '別のキーワードで探してみてね' : 'スキャンしてクイズを作ろう！'}
              </div>
            </motion.div>
          )}

          {/* クイズカード一覧 */}
          {pagedHistory.map((history, idx) => {
            const selected = selectedQuizIds.has(history.id);
            const isPerfect = history.result.isPerfect;
            const score = `${history.result.correctCount}/${history.result.totalQuestions}`;
            const generating = isGenerating && generatingId === history.id;

            return (
              <motion.div key={history.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  borderRadius: 20, overflow: 'hidden',
                  background: selected ? `${AC.leaf}18` : 'rgba(255,255,255,0.82)',
                  border: `2px solid ${selected ? AC.leaf : AC.sand}`,
                  boxShadow: selected
                    ? `0 4px 0 ${AC.darkGreen}55`
                    : `0 4px 0 ${AC.sand}`,
                  transition: 'all 0.15s',
                }}
              >
                {/* カードヘッダー */}
                <div style={{ padding: '12px 14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* チェック */}
                    <motion.button type="button" onClick={() => toggleSelect(history.id)} whileTap={{ scale: 0.85 }}
                      style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                        background: selected ? AC.leaf : 'rgba(255,255,255,0.8)',
                        border: `2px solid ${selected ? AC.darkGreen : AC.sand}`,
                        boxShadow: `0 2px 0 ${selected ? AC.darkGreen : AC.sand}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {selected && <span style={{ fontSize: 14, color: '#fff' }}>✓</span>}
                    </motion.button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: AC.text, lineHeight: 1.4, marginBottom: 2 }}>
                        {history.quiz.title || history.quiz.summary}
                      </div>
                      {history.quiz.summary && history.quiz.title && (
                        <div style={{ fontSize: 11, color: AC.muted, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {history.quiz.summary}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: AC.muted, fontSize: 11 }}>
                        <Calendar style={{ width: 11, height: 11 }} />
                        {formatDate(history.createdAt)}
                      </div>
                    </div>

                    {/* スコアバッジ */}
                    <div style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      padding: '6px 10px', borderRadius: 12,
                      background: isPerfect ? `${AC.yellow}44` : `${AC.teal}33`,
                      border: `2px solid ${isPerfect ? '#d4a800' : AC.teal}`,
                      boxShadow: `0 2px 0 ${isPerfect ? '#a07800' : '#4aaa96'}55`,
                    }}>
                      <span style={{ fontSize: 16 }}>{isPerfect ? '⭐' : '✅'}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: isPerfect ? AC.brown : AC.darkGreen }}>{score}</span>
                    </div>
                  </div>

                  {/* キーワード */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '10px 0 0' }}>
                    {history.quiz.keywords.slice(0, 5).map((kw, i) => (
                      <span key={i} style={{
                        fontSize: 10, fontWeight: 700,
                        padding: '3px 9px', borderRadius: 99,
                        background: AC.tan,
                        border: `1.5px solid ${AC.sand}`,
                        color: AC.brown,
                      }}>#{kw}</span>
                    ))}
                  </div>
                </div>

                {/* アクションボタン行 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 7, padding: '10px 12px 12px' }}>
                  {/* 再挑戦 */}
                  <AcButton
                    label="再挑戦" icon="🔁"
                    from={AC.teal} shadow="#3d8c7e"
                    disabled={isGenerating}
                    onClick={() => handleRetryQuiz(history)}
                  />

                  {/* 類題を作る */}
                  <AcButton
                    label={generating ? '生成中…' : '類題を作る'} icon={generating ? '⚙️' : '✨'}
                    from={canGenerate && canGenerateFromSeed(history) ? AC.green : AC.muted}
                    shadow={canGenerate && canGenerateFromSeed(history) ? AC.darkGreen : '#666'}
                    disabled={isGenerating || !canGenerateFromSeed(history) || !canGenerate}
                    spinning={generating}
                    onClick={() => handleNewQuiz(history)}
                  />

                  {/* PDF */}
                  <IconAcButton emoji="📄" color={AC.blue} shadow="#3a6fa0" disabled={isGenerating} onClick={() => handleExportPDF(history)} title="PDF化" />
                  {/* 削除 */}
                  <IconAcButton emoji="🗑️" color={AC.red} shadow="#8b2020" disabled={isGenerating} onClick={() => handleDeleteQuiz(history.id)} title="削除" />
                </div>
              </motion.div>
            );
          })}

          {/* ページネーション */}
          {filteredHistory.length > 0 && totalPages > 1 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'center',
              padding: '6px 0 2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => { vibrateLight(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                  disabled={currentPage <= 1}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: currentPage <= 1 ? 'default' : 'pointer',
                    background: currentPage <= 1 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                    color: currentPage <= 1 ? AC.muted : AC.text,
                    border: `2px solid ${AC.sand}`,
                    boxShadow: currentPage <= 1 ? 'none' : `0 3px 0 ${AC.sand}`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  ‹ 前へ
                </button>

                {buildPaginationItems(totalPages, currentPage).map((it, i) => {
                  if (it === 'ellipsis') {
                    return (
                      <span key={`e-${i}`} style={{ padding: '0 6px', color: AC.muted, fontWeight: 900 }}>
                        …
                      </span>
                    );
                  }
                  const isCurrent = it === currentPage;
                  return (
                    <button
                      key={it}
                      type="button"
                      onClick={() => { vibrateLight(); setCurrentPage(it); }}
                      disabled={isCurrent}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 900,
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? AC.green : 'rgba(255,255,255,0.92)',
                        color: isCurrent ? '#fff' : AC.text,
                        border: `2px solid ${isCurrent ? AC.darkGreen : AC.sand}`,
                        boxShadow: isCurrent ? `0 3px 0 ${AC.darkGreen}` : `0 3px 0 ${AC.sand}`,
                        transform: isCurrent ? 'translateY(2px)' : 'translateY(0)',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      {it}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => { vibrateLight(); setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                  disabled={currentPage >= totalPages}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: currentPage >= totalPages ? 'default' : 'pointer',
                    background: currentPage >= totalPages ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                    color: currentPage >= totalPages ? AC.muted : AC.text,
                    border: `2px solid ${AC.sand}`,
                    boxShadow: currentPage >= totalPages ? 'none' : `0 3px 0 ${AC.sand}`,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  次へ ›
                </button>
              </div>

              {totalPages > 20 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,0.75)',
                  border: `2px solid ${AC.sand}`,
                  boxShadow: `0 3px 0 ${AC.sand}`,
                  borderRadius: 14,
                  padding: '8px 10px',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: AC.muted }}>ページ</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageJumpDraft}
                    onChange={(e) => setPageJumpDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const n = Number(pageJumpDraft);
                      if (!Number.isFinite(n) || n <= 0) return;
                      vibrateLight();
                      setCurrentPage(Math.max(1, Math.min(totalPages, n)));
                      setPageJumpDraft('');
                    }}
                    placeholder={`${currentPage}`}
                    style={{
                      width: 66,
                      padding: '6px 10px',
                      borderRadius: 10,
                      border: `2px solid ${AC.sand}`,
                      outline: 'none',
                      fontSize: 12,
                      fontWeight: 900,
                      color: AC.text,
                      background: 'rgba(255,255,255,0.95)',
                      boxShadow: `0 2px 0 ${AC.sand}`,
                    }}
                    aria-label="ページ番号を入力して移動（Enter）"
                  />
                  <span style={{ fontSize: 12, fontWeight: 900, color: AC.muted }}>/ {totalPages}</span>
                  <span style={{ fontSize: 10, color: AC.muted }}>Enterで移動</span>
                </div>
              )}
            </div>
          )}

          {/* 生成上限時の回復 */}
          {!isVIP && !canGenerate && (
            <motion.button type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => { vibrateLight(); setShowAdsModal(true); }}
              whileTap={{ scale: 0.96 }}
              style={{
                width: '100%', padding: '14px', borderRadius: 18,
                background: `linear-gradient(180deg, ${AC.teal} 0%, #4aaa96 100%)`,
                border: `2px solid rgba(255,255,255,0.3)`, borderBottom: `5px solid #2d7a6e`,
                color: '#fff', fontSize: 15, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', boxSizing: 'border-box',
                boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 20 }}>📺</span>
              動画を見て3回回復する
            </motion.button>
          )}
        </div>
      </div>

      {/* ─── 選択PDF固定フッター ─── */}
      <AnimatePresence>
        {selectedQuizIds.size > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              padding: '12px 16px 20px',
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
              borderTop: `3px solid ${AC.darkGreen}`,
              boxShadow: `0 -4px 0 ${AC.leaf}44`,
            }}
          >
            <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: AC.text }}>
                📝 {selectedQuizIds.size}件選択中
              </div>
              <motion.button type="button" onClick={handleExportSelectedPDFs} whileTap={{ scale: 0.95 }}
                style={{
                  padding: '10px 20px', borderRadius: 99,
                  background: `linear-gradient(180deg, ${AC.green} 0%, ${AC.darkGreen} 100%)`,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderBottom: `4px solid #1f5c1f`,
                  color: '#fff', fontSize: 13, fontWeight: 900,
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 16 }}>📄</span>
                まとめてPDF化
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdsModal isOpen={showAdsModal} onClose={() => setShowAdsModal(false)} adType="scan_recovery" onRewardClaimed={handleAdRewardClaimed} />
    </div>
  );
};

// ─── ACスタイルテキストボタン ──────────────────────────────────
function AcButton({ label, icon, from, shadow, disabled, spinning, onClick }: {
  label: string; icon: string; from: string; shadow: string;
  disabled?: boolean; spinning?: boolean; onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        padding: '9px 6px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        background: `linear-gradient(180deg, ${from} 0%, ${shadow} 100%)`,
        border: '2px solid rgba(255,255,255,0.28)',
        borderBottom: pressed ? `2px solid ${shadow}` : `4px solid ${shadow}`,
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        boxShadow: pressed ? 'none' : `0 4px 10px ${from}55`,
        color: '#fff', fontSize: 12, fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        opacity: disabled ? 0.5 : 1,
        transition: 'border-bottom .07s, transform .07s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <motion.span style={{ fontSize: 14, display: 'inline-block' }}
        animate={spinning ? { rotate: 360 } : {}}
        transition={spinning ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
      >{icon}</motion.span>
      {label}
    </button>
  );
}

// ─── ACスタイルアイコンボタン ──────────────────────────────────
function IconAcButton({ emoji, color, shadow, disabled, onClick, title }: {
  emoji: string; color: string; shadow: string;
  disabled?: boolean; onClick: () => void; title?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        width: 42, height: 42, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
        background: `linear-gradient(180deg, ${color} 0%, ${shadow} 100%)`,
        border: '2px solid rgba(255,255,255,0.28)',
        borderBottom: pressed ? `2px solid ${shadow}` : `4px solid ${shadow}`,
        transform: pressed ? 'translateY(2px)' : 'translateY(0)',
        boxShadow: pressed ? 'none' : `0 4px 10px ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        opacity: disabled ? 0.5 : 1,
        transition: 'border-bottom .07s, transform .07s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >{emoji}</button>
  );
}

export default FreeQuestScreen;