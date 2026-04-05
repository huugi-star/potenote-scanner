'use client';

import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import {
  storyIntroPages,
  type StoryIntroPage,
  type StoryLine,
} from '@/data/storyIntroPages';

// ============================================================
// onDone を ref 化するユーティリティ
// ============================================================

function useStableCallback(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  return ref;
}

// ============================================================
// タイプライター Hook
// ============================================================

function useTypewriter(text: string, active: boolean, onDone: () => void) {
  const [displayed, setDisplayed] = useState('');
  const onDoneRef = useStableCallback(onDone);
  const iRef = useRef(0);
  const textRef = useRef(text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    // リセット
    iRef.current = 0;
    textRef.current = text;
    setDisplayed('');

    function scheduleNext() {
      if (timerRef.current) clearTimeout(timerRef.current);

      const i = iRef.current;
      const t = textRef.current;

      if (i >= t.length) {
        // 全文表示直後：文末の句読点のあと「余韻」を置いてから次ブロックへ
        const last = t.length > 0 ? t[t.length - 1] : '';
        const tailMs = '。！？…'.includes(last)
          ? 700
          : last === '\n'
            ? 550
            : '、，'.includes(last)
              ? 450
              : 600;
        timerRef.current = setTimeout(() => {
          onDoneRef.current();
        }, tailMs);
        return;
      }

      // 直前の文字（表示済みの末尾）で次の1文字までの待ちを決める
      const prevCh = i > 0 ? t[i - 1] : '';
      const delay =
        '。！？…．'.includes(prevCh)
          ? 700
          : prevCh === '\n'
            ? 520
            : '、，'.includes(prevCh)
              ? 380
              : 72;

      timerRef.current = setTimeout(() => {
        iRef.current += 1;
        setDisplayed(t.slice(0, iRef.current));
        scheduleNext();
      }, delay);
    }

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // クリーンアップ時にiRefを無効値にして古いコールバックを止める
      iRef.current = Infinity;
    };
  }, [active, text]);

  return displayed;
}

// ============================================================
// カーソル点滅
// ============================================================

const Cursor = () => (
  <span
    style={{
      display: 'inline-block',
      width: 2,
      height: '1.1em',
      background: 'rgba(200,170,255,.8)',
      verticalAlign: 'text-bottom',
      marginLeft: 2,
      animation: 'story-cursor .7s ease-in-out infinite',
    }}
  />
);

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
});

// ============================================================
// 各ブロック
// ============================================================

const NarrationBlock = ({
  text, active, onDone,
}: { text: string; active: boolean; onDone: () => void }) => {
  const displayed = useTypewriter(text, active, onDone);
  if (!active && !displayed) return null;
  return (
    <motion.div {...fadeIn()}>
      <div style={{ borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.10)', padding: '14px 18px' }}>
        <p style={{ fontSize: 14, lineHeight: 2, color: 'rgba(220,210,255,.92)', whiteSpace: 'pre-line' }}>
          {displayed}
          {active && displayed.length < text.length && <Cursor />}
        </p>
      </div>
    </motion.div>
  );
};

const EmphasisBlock = ({
  prefix, word, suffix, active, onDone,
}: { prefix?: string; word: string; suffix?: string; active: boolean; onDone: () => void }) => {
  const displayed = useTypewriter(word, active, onDone);
  if (!active && !displayed) return null;
  return (
    <motion.div {...fadeIn()} style={{ textAlign: 'center', margin: '8px 0' }}>
      <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#3a0a0a,#220505)', border: '2px solid rgba(255,80,80,.45)', borderRadius: 16, padding: '16px 22px', boxShadow: '0 0 24px rgba(255,60,60,.20)' }}>
        {prefix && <p style={{ fontSize: 11, color: 'rgba(255,130,130,.65)', letterSpacing: '.2em', marginBottom: 6 }}>{prefix}</p>}
        <p style={{ fontSize: 18, fontWeight: 900, color: '#e55', letterSpacing: '.06em', animation: 'story-crack 2.4s ease-in-out infinite' }}>
          {displayed}
          {active && displayed.length < word.length && <Cursor />}
        </p>
        {suffix && <p style={{ fontSize: 13, color: 'rgba(255,180,180,.85)', marginTop: 6 }}>{suffix}</p>}
      </div>
    </motion.div>
  );
};

const DialogueLine = ({
  text, active, onDone,
}: { text: string; active: boolean; onDone: () => void }) => {
  const displayed = useTypewriter(text, active, onDone);
  return (
    <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: '12px 12px 12px 4px', padding: '12px 14px' }}>
      <p style={{ fontSize: 14, lineHeight: 2, color: 'rgba(240,230,255,.95)', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
        {displayed}
        {active && displayed.length < text.length && <Cursor />}
      </p>
    </div>
  );
};

const DialogueBlock = ({
  speaker, speakerImageKey, lines, active, onDone,
}: { speaker: string; speakerImageKey?: string; lines: string[]; active: boolean; onDone: () => void }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const onDoneRef = useStableCallback(onDone); // ← ref 化
  const allDone = lineIdx >= lines.length;

  useEffect(() => {
    if (allDone) onDoneRef.current(); // ← ref から呼ぶ
  }, [allDone]); // onDone を含めない

  if (!active && lineIdx === 0) return null;

  return (
    <motion.div {...fadeIn()}>
      <div style={{ background: 'linear-gradient(135deg,rgba(40,28,80,.92),rgba(28,18,60,.92))', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(200,160,255,.30)', boxShadow: '0 0 20px rgba(150,100,255,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 100, height: 100, borderRadius: '10%', background: 'linear-gradient(135deg,#3a2070,#200e50)', border: '1.5px dashed rgba(200,160,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {speakerImageKey
              ? <img src={`/images/story/${speakerImageKey}.png`} alt={speaker} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 9, color: 'rgba(200,160,255,.6)', textAlign: 'center', lineHeight: 1.3 }}>画像</span>
            }
          </div>
          <span style={{ fontSize: 10, letterSpacing: '.2em', color: 'rgba(200,160,255,.75)' }}>{speaker}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lines.slice(0, lineIdx + (allDone ? 0 : 1)).map((l, i) => (
            <DialogueLine
              key={i}
              text={l}
              active={active && i === lineIdx}
              onDone={() => setLineIdx(i + 1)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const ClimaxBlock = ({
  text, active, onDone,
}: { text: string; active: boolean; onDone: () => void }) => {
  const displayed = useTypewriter(text, active, onDone);
  if (!active && !displayed) return null;
  return (
    <motion.div {...fadeIn()} style={{ textAlign: 'center', margin: '8px 0' }}>
      <p style={{ fontSize: 18, fontWeight: 900, color: '#f5e8a0', letterSpacing: '.12em', textShadow: '0 0 16px rgba(245,200,80,.50)' }}>
        {displayed}
        {active && displayed.length < text.length && <Cursor />}
      </p>
    </motion.div>
  );
};

// ============================================================
// StoryLineBlock
// ============================================================

const StoryLineBlock = ({
  line, active, onDone,
}: { line: StoryLine; active: boolean; onDone: () => void }) => {
  const onDoneRef = useStableCallback(onDone); // ← ref 化

  useEffect(() => {
    if (active && line.type === 'spacer') {
      const t = setTimeout(() => onDoneRef.current(), 80);
      return () => clearTimeout(t);
    }
  }, [active, line.type]); // onDone を含めない

  if (line.type === 'spacer') return <div style={{ height: 8 }} />;
  if (line.type === 'narration') return <NarrationBlock text={line.text} active={active} onDone={onDone} />;
  if (line.type === 'emphasis') return <EmphasisBlock prefix={line.prefix} word={line.word} suffix={line.suffix} active={active} onDone={onDone} />;
  if (line.type === 'dialogue') return <DialogueBlock speaker={line.speaker} speakerImageKey={line.speakerImageKey} lines={line.lines} active={active} onDone={onDone} />;
  if (line.type === 'climax') return <ClimaxBlock text={line.text} active={active} onDone={onDone} />;
  return null;
};

// ============================================================
// TitleCard・STARS（変更なし）
// ============================================================

const TitleCard = ({ page }: { page: StoryIntroPage }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay: 0.1, type: 'spring', bounce: 0.45 }}
    style={{ textAlign: 'center', padding: '36px 20px 20px' }}
  >
    <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#1e2d6e,#2a1a5e)', border: '2px solid rgba(160,130,255,.45)', borderRadius: 20, padding: '18px 28px 16px', boxShadow: '0 0 30px rgba(120,80,255,.25), 0 0 0 1px rgba(255,255,255,.06) inset' }}>
      <div style={{ width: 300, height: 200, borderRadius: '16%', background: 'linear-gradient(135deg,#2a1060,#180840)', border: '2px dashed rgba(160,130,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', overflow: 'hidden' }}>
        {page.titleImageKey
          ? <img src={`/images/story/${page.titleImageKey}.png`} alt={page.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 11, color: 'rgba(160,130,255,.6)', textAlign: 'center', lineHeight: 1.4 }}>画像</span>
        }
      </div>
      {page.label && <p style={{ fontSize: 11, letterSpacing: '.4em', color: 'rgba(180,160,255,.7)', marginBottom: 8, textTransform: 'uppercase' }}>{page.label}</p>}
      <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '.08em', lineHeight: 1.3, textShadow: '0 0 20px rgba(160,120,255,.6)' }}>{page.title}</p>
    </div>
  </motion.div>
);

const STARS = [
  { left: '8%', top: '6%', size: 20, color: '#ffe88a', delay: 0.2 },
  { left: '83%', top: '10%', size: 13, color: '#aaddff', delay: 0.9 },
  { left: '91%', top: '30%', size: 9, color: '#ffccff', delay: 0.4 },
  { left: '5%', top: '44%', size: 11, color: '#ffe88a', delay: 1.3 },
  { left: '76%', top: '58%', size: 8, color: '#aaddff', delay: 0.7 },
  { left: '14%', top: '78%', size: 10, color: '#ffccff', delay: 1.8 },
  { left: '89%', top: '82%', size: 13, color: '#ffe88a', delay: 0.3 },
] as const;

// ============================================================
// メインコンポーネント
// ============================================================

export const StoryIntroScreen = ({
  page = storyIntroPages[0],
  onNext,
  embedded = false,
}: {
  page?: StoryIntroPage;
  onNext?: () => void;
  embedded?: boolean;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const allDone = activeIndex >= page.body.length;

  useEffect(() => {
    setActiveIndex(0);
  }, [page]);

  const rootStyle: CSSProperties = embedded
    ? { fontFamily: "'Noto Sans JP', sans-serif", background: 'linear-gradient(170deg,#0c1a3a 0%,#0a1128 55%,#140a2e 100%)', minHeight: 0, maxHeight: 'min(68vh, 620px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 24, position: 'relative', borderRadius: 16 }
    : { fontFamily: "'Noto Sans JP', sans-serif", background: 'linear-gradient(170deg,#0c1a3a 0%,#0a1128 55%,#140a2e 100%)', minHeight: '100vh', paddingBottom: 40, position: 'relative', overflow: 'hidden' };

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes story-twinkle { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes story-crack { 0%,100%{letter-spacing:.02em;color:#e55} 30%{letter-spacing:.18em;color:#ff2020;text-shadow:0 0 12px #ff4444} 60%{letter-spacing:-.02em;color:#c00} }
        @keyframes story-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
        .story-star { position:absolute; animation:story-twinkle 2.2s ease-in-out infinite; }
      `}</style>

      {STARS.map((s, i) => (
        <span key={i} className="story-star" style={{ left: s.left, top: s.top, fontSize: s.size, color: s.color, animationDelay: `${s.delay}s` }}>
          {i % 2 === 0 ? '✦' : '★'}
        </span>
      ))}

      <TitleCard page={page} />

      <div style={{ maxWidth: 360, margin: '0 auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {page.body.map((line, i) =>
          i <= activeIndex && (
            <StoryLineBlock
              key={i}
              line={line}
              active={i === activeIndex}
              onDone={() => setActiveIndex(i + 1)}
            />
          )
        )}

        {allDone && onNext && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginTop: 18 }}>
            <button
              type="button"
              onClick={onNext}
              style={{ background: 'linear-gradient(135deg,#5a3ecf,#8b5cf6)', color: '#fff', fontSize: 15, fontWeight: 700, padding: '14px 40px', borderRadius: 100, border: 'none', cursor: 'pointer', letterSpacing: '.1em', boxShadow: '0 4px 20px rgba(120,80,255,.40)', fontFamily: 'inherit' }}
            >
              つぎへ ▶
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};