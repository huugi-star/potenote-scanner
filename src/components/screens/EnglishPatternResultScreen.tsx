'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronDown } from 'lucide-react';

// ─── 型 ──────────────────────────────────────────────────────────────────────
type ReusablePattern = { name: string; rule: string; examples: string[] };
type ReviewQuestion = { question: string; answer: string; explanation: string };

type Question = {
  questionNumber: string;
  questionType: string;
  detectedQuestion: string;
  answer: string;
  evidence: string;
  explanation: string;
  scoringPattern: string;
  reusablePattern: ReusablePattern;
  reviewQuestion: ReviewQuestion;
};

type ScanResult = {
  title: string;
  overallType: string;
  extractedSummary: string;
  questions: Question[];
  overallScoringPatterns: string[];
  suhimochiComment: string;
};

interface Props {
  result: ScanResult;
  onBack: () => void;
}

// ─── ACパレット ───────────────────────────────────────────────────────────────
const AC = {
  sky: '#c8eaf5',
  green: '#5cb85c',
  darkGreen: '#3a7a3a',
  leaf: '#8dc63f',
  cream: '#fef9ee',
  tan: '#f0e6c8',
  sand: '#e8d5a3',
  brown: '#8b5e3c',
  text: '#4a3728',
  muted: '#9b7f6e',
  teal: '#7dd4c0',
  yellow: '#ffd966',
  amber: '#f5a623',
  red: '#e05555',
  blue: '#5b9bd5',
  purple: '#9b59b6',
};

const TYPE_META: Record<string, { emoji: string; color: string; shadow: string }> = {
  穴埋め: { emoji: '✏️', color: AC.blue, shadow: '#3a6fa0' },
  語彙: { emoji: '📖', color: AC.green, shadow: AC.darkGreen },
  内容一致: { emoji: '🔍', color: AC.teal, shadow: '#4aaa96' },
  並べ替え: { emoji: '🔀', color: AC.purple, shadow: '#6c3483' },
  文法: { emoji: '📐', color: AC.amber, shadow: '#c07800' },
  複合問題: { emoji: '🧩', color: AC.red, shadow: '#8b2020' },
};
const getTypeMeta = (t: string) => TYPE_META[t] ?? { emoji: '❓', color: AC.muted, shadow: AC.brown };

// ─── 小コンポーネント ─────────────────────────────────────────────────────────

function AcTag({ label, emoji, color, shadow }: { label: string; emoji?: string; color: string; shadow: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 900,
        padding: '4px 11px',
        borderRadius: 99,
        background: `${color}28`,
        border: `1.5px solid ${color}77`,
        boxShadow: `0 2px 0 ${shadow}55`,
        color: shadow,
      }}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </span>
  );
}

function SectionCard({
  children,
  accent = AC.sand,
  accentShadow = AC.brown,
  headerContent,
}: {
  children: ReactNode;
  accent?: string;
  accentShadow?: string;
  headerContent?: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.85)',
        border: `2px solid ${accent}`,
        boxShadow: `0 4px 0 ${accentShadow}44`,
      }}
    >
      {headerContent && (
        <div
          style={{
            padding: '8px 14px 7px',
            background: `${accent}33`,
            borderBottom: `1.5px solid ${accent}`,
          }}
        >
          {headerContent}
        </div>
      )}
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

function CollapseSection({
  title,
  emoji,
  color,
  children,
  defaultOpen = false,
}: {
  title: string;
  emoji: string;
  color: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: `1.5px solid ${color}44`,
        background: 'rgba(255,255,255,0.7)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '9px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `${color}18`,
          border: 'none',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: AC.text,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{emoji}</span>
          {title}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ color: AC.muted }}>
          <ChevronDown style={{ width: 14, height: 14 }} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '10px 12px 12px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 設問カード ───────────────────────────────────────────────────────────────
function QuestionCard({ q, index }: { q: Question; index: number }) {
  const meta = getTypeMeta(q.questionType);
  const isInsufficient = q.answer.includes('根拠テキストなし') || q.answer.includes('根拠不足');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.88)',
        border: `2px solid ${meta.color}55`,
        boxShadow: `0 5px 0 ${meta.shadow}44, 0 8px 20px rgba(0,0,0,0.07)`,
      }}
    >
      <div
        style={{
          padding: '10px 14px 9px',
          background: `linear-gradient(135deg,${meta.color}22,rgba(255,255,255,0.4))`,
          borderBottom: `1.5px solid ${meta.color}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              flexShrink: 0,
              background: `${meta.color}33`,
              border: `2px solid ${meta.color}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            {meta.emoji}
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: meta.shadow, letterSpacing: '0.15em' }}>{q.questionNumber}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: AC.text }}>{q.questionType}</div>
          </div>
        </div>
        <div
          style={{
            padding: '5px 12px',
            borderRadius: 99,
            background: isInsufficient ? `${AC.muted}22` : `${meta.color}22`,
            border: `1.5px solid ${isInsufficient ? AC.muted : meta.color}66`,
            boxShadow: `0 2px 0 ${isInsufficient ? AC.brown : meta.shadow}44`,
            fontSize: 12,
            fontWeight: 900,
            color: isInsufficient ? AC.muted : meta.shadow,
            maxWidth: 180,
            textAlign: 'center',
          }}
        >
          {isInsufficient ? '⚠️ 確認要' : `✅ ${q.answer}`}
        </div>
      </div>

      <div style={{ padding: '12px 14px 8px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: AC.text,
            lineHeight: 1.7,
            padding: '10px 12px',
            borderRadius: 12,
            background: `${AC.tan}88`,
            border: `1.5px solid ${AC.sand}`,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {q.detectedQuestion}
        </div>
      </div>

      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <CollapseSection title="OCR根拠テキスト" emoji="🔎" color={AC.blue} defaultOpen={false}>
          <p
            style={{
              fontSize: 12,
              color: AC.text,
              lineHeight: 1.7,
              background: `${AC.blue}11`,
              borderRadius: 10,
              padding: '8px 10px',
              border: `1px solid ${AC.blue}33`,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {q.evidence}
          </p>
        </CollapseSection>

        <CollapseSection title="解説" emoji="💡" color={AC.amber} defaultOpen={true}>
          <p style={{ fontSize: 12, color: AC.text, lineHeight: 1.8 }}>{q.explanation}</p>
        </CollapseSection>

        <CollapseSection title="得点パターン" emoji="🎯" color={AC.green} defaultOpen={false}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: `${AC.green}18`,
              border: `1.5px solid ${AC.leaf}55`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: AC.darkGreen, marginBottom: 4 }}>📌 {q.reusablePattern.name}</div>
            <p style={{ fontSize: 12, color: AC.text, lineHeight: 1.7, margin: '0 0 8px' }}>{q.reusablePattern.rule}</p>
            <div style={{ fontSize: 10, fontWeight: 900, color: AC.muted, marginBottom: 4, letterSpacing: '0.1em' }}>例文</div>
            {q.reusablePattern.examples.map((ex, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: AC.darkGreen,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.7)',
                  border: `1px solid ${AC.leaf}44`,
                  marginBottom: 4,
                }}
              >
                {ex}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: AC.muted, fontWeight: 700 }}>このラウンドのポイント: {q.scoringPattern}</div>
        </CollapseSection>

        <CollapseSection title="類題で定着確認" emoji="📝" color={AC.purple} defaultOpen={false}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: `${AC.purple}12`,
              border: `1.5px solid ${AC.purple}33`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: AC.text, marginBottom: 6 }}>Q. {q.reviewQuestion.question}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: AC.purple,
                padding: '4px 10px',
                borderRadius: 99,
                background: `${AC.purple}18`,
                border: `1px solid ${AC.purple}44`,
                display: 'inline-block',
                marginBottom: 6,
              }}
            >
              A. {q.reviewQuestion.answer}
            </div>
            <p style={{ fontSize: 11, color: AC.muted, lineHeight: 1.7, margin: 0 }}>{q.reviewQuestion.explanation}</p>
          </div>
        </CollapseSection>
      </div>
    </motion.div>
  );
}

type Deco = { e: string; t: string; s: number; d: number; l?: string; r?: number | string; rot?: number };

// ─── メインコンポーネント ──────────────────────────────────────────────────────
export function EnglishPatternResultScreen({ result, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'questions' | 'strategy'>('questions');

  const deco: Deco[] = [
    { e: '🍃', t: '4%', l: '2%', s: 20, rot: -20, d: 0 },
    { e: '🌿', t: '8%', r: '3%', s: 17, rot: 14, d: 0.4 },
    { e: '⭐', t: '5%', l: '44%', s: 13, rot: 5, d: 0.7 },
  ];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(180deg,${AC.sky} 0%,#daf0e8 28%,${AC.cream} 60%,${AC.tan} 100%)`,
        color: AC.text,
      }}
    >
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {deco.map((d, i) => (
          <motion.span
            key={i}
            style={{
              position: 'absolute',
              fontSize: d.s,
              opacity: 0.35,
              top: d.t,
              left: d.l,
              right: typeof d.r === 'string' ? d.r : undefined,
              rotate: d.rot ?? 0,
              zIndex: 0,
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.5 + i * 0.3, delay: d.d, repeat: Infinity, ease: 'easeInOut' }}
          >
            {d.e}
          </motion.span>
        ))}
      </div>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(10px)',
          borderBottom: `3px solid ${AC.darkGreen}`,
          boxShadow: `0 3px 0 ${AC.leaf}55`,
        }}
      >
        <motion.button
          type="button"
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 12px 5px 8px',
            borderRadius: 99,
            background: AC.green,
            color: '#fff',
            border: `2px solid ${AC.darkGreen}`,
            boxShadow: `0 3px 0 ${AC.darkGreen}`,
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
          もどる
        </motion.button>
        <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: AC.darkGreen }}>✦ えいご解析 ✦</div>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 900,
              margin: 0,
              color: AC.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.title}
          </h1>
        </div>
        <div style={{ width: 70 }} />
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 14px 80px',
          position: 'relative',
          zIndex: 1,
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: 22,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.88)',
            border: `2px solid ${AC.amber}88`,
            boxShadow: `0 5px 0 #c0780044`,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: `linear-gradient(135deg,${AC.yellow}44,${AC.amber}22)`,
              borderBottom: `1.5px solid ${AC.amber}66`,
            }}
          >
            <span style={{ fontSize: 28 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', color: AC.brown }}>✦ 合格目標 ✦</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: AC.text }}>{result.overallType}</div>
            </div>
            <AcTag label={`${result.questions.length}問`} emoji="📋" color={AC.amber} shadow="#c07800" />
          </div>

          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                flexShrink: 0,
                background: `${AC.teal}33`,
                border: `2px solid ${AC.teal}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🧸
            </div>
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 12,
                background: `${AC.teal}18`,
                border: `1px solid ${AC.teal}44`,
                fontSize: 12,
                color: AC.text,
                lineHeight: 1.7,
                fontWeight: 700,
              }}
            >
              {result.suhimochiComment}
            </div>
          </div>

          {result.extractedSummary && result.extractedSummary !== '根拠不足' && (
            <div
              style={{
                margin: '0 12px 12px',
                padding: '10px 12px',
                borderRadius: 14,
                background: AC.tan,
                border: `1.5px solid ${AC.sand}`,
                fontSize: 12,
                color: AC.text,
                lineHeight: 1.8,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 900, color: AC.muted, marginBottom: 4, letterSpacing: '0.12em' }}>📄 本文要約</div>
              {result.extractedSummary}
            </div>
          )}
        </motion.div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            background: 'rgba(255,255,255,0.55)',
            borderRadius: 99,
            padding: 4,
            border: `2px solid ${AC.sand}`,
          }}
        >
          {(
            [
              { key: 'questions' as const, label: '設問・解説', emoji: '📖' },
              { key: 'strategy' as const, label: '得点戦略', emoji: '🏆' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 99,
                border: 'none',
                background: activeTab === t.key ? AC.green : 'transparent',
                boxShadow: activeTab === t.key ? `0 3px 0 ${AC.darkGreen}` : 'none',
                color: activeTab === t.key ? '#fff' : AC.muted,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'all 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              {result.questions.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    borderRadius: 22,
                    background: 'rgba(255,255,255,0.7)',
                    border: `2px dashed ${AC.sand}`,
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: AC.text }}>設問が検出されませんでした</div>
                  <div style={{ fontSize: 12, color: AC.muted, marginTop: 4 }}>画像の品質を上げるか、1ページずつ送ってください</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Array.from(new Set(result.questions.map((q) => q.questionType))).map((t) => {
                      const m = getTypeMeta(t);
                      return <AcTag key={t} label={t} emoji={m.emoji} color={m.color} shadow={m.shadow} />;
                    })}
                  </div>

                  {result.questions.map((q, i) => (
                    <QuestionCard key={q.questionNumber} q={q} index={i} />
                  ))}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'strategy' && (
            <motion.div
              key="strategy"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <SectionCard
                accent={AC.amber}
                accentShadow="#c07800"
                headerContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>🏆</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: AC.brown, letterSpacing: '0.1em' }}>合格への得点パターン</span>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.overallScoringPatterns.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: `${AC.yellow}33`,
                        border: `1.5px solid ${AC.amber}55`,
                        boxShadow: `0 3px 0 #c0780033`,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          flexShrink: 0,
                          background: AC.amber,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 900,
                          boxShadow: `0 2px 0 #c07800`,
                        }}
                      >
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 12, color: AC.text, lineHeight: 1.7, margin: 0, flex: 1 }}>{p}</p>
                    </motion.div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                accent={AC.green}
                accentShadow={AC.darkGreen}
                headerContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>📌</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: AC.darkGreen, letterSpacing: '0.1em' }}>次も使える型まとめ</span>
                  </div>
                }
              >
                {result.questions.length === 0 ? (
                  <p style={{ fontSize: 12, color: AC.muted }}>設問なし</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.questions.map((q, i) => {
                      const m = getTypeMeta(q.questionType);
                      return (
                        <motion.div
                          key={q.questionNumber}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          style={{
                            borderRadius: 14,
                            overflow: 'hidden',
                            border: `1.5px solid ${m.color}44`,
                          }}
                        >
                          <div
                            style={{
                              padding: '7px 12px',
                              background: `${m.color}18`,
                              borderBottom: `1px solid ${m.color}33`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                            }}
                          >
                            <span>{m.emoji}</span>
                            <span style={{ fontSize: 11, fontWeight: 900, color: m.shadow }}>
                              {q.questionNumber} — {q.reusablePattern.name}
                            </span>
                          </div>
                          <div style={{ padding: '8px 12px' }}>
                            <p style={{ fontSize: 11, color: AC.text, lineHeight: 1.7, margin: '0 0 6px' }}>{q.reusablePattern.rule}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {q.reusablePattern.examples.slice(0, 2).map((ex, j) => (
                                <span
                                  key={j}
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'monospace',
                                    padding: '3px 9px',
                                    borderRadius: 99,
                                    background: `${m.color}18`,
                                    border: `1px solid ${m.color}44`,
                                    color: m.shadow,
                                  }}
                                >
                                  {ex}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                accent={AC.red}
                accentShadow="#8b2020"
                headerContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 16 }}>⚡</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#8b2020', letterSpacing: '0.1em' }}>試験直前チェックリスト</span>
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    '空所の直前・直後の前置詞・動詞を必ず確認する',
                    '選択肢は番号と語句を正確に対応させる',
                    '内容一致は本文に戻って証拠を確認してから選ぶ',
                    '並べ替えは動詞の位置と時制から組み立てる',
                    '語彙は文脈（前後の意味の流れ）で絞り込む',
                    ...result.overallScoringPatterns.slice(0, 2),
                  ].map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 12,
                        background: i % 2 === 0 ? `${AC.red}0c` : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          flexShrink: 0,
                          marginTop: 1,
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: `${AC.red}22`,
                          border: `1px solid ${AC.red}44`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: AC.red,
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ fontSize: 12, color: AC.text, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
