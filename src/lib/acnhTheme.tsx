'use client';

/**
 * どうぶつの森風カラーパレット・屋外デコレーション（ホーム・冒険メニュー・図鑑など共通）
 */

import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';

export const AC = {
  sky: '#D4EFF7',
  skyDeep: '#A8D8EA',
  grass: '#7EC8A4',
  grassDk: '#5BAF8A',
  cream: '#FFF8E8',
  yellow: '#FFD93D',
  yellowDk: '#E6B800',
  brown: '#A0744A',
  brownDk: '#7A5234',
  coral: '#FF8C69',
  mint: '#A8E6CF',
  lavender: '#D4A8E6',
  white: '#FFFFFF',
  textDk: '#5A3E28',
  textMd: '#7A5A3A',
  textLt: '#A08060',
} as const;

export function AcnhOutdoorDecor({ compact }: { compact: boolean }) {
  const floaters = [
    { emoji: '🌿', top: '8%', left: '5%', delay: 0, dur: 4.2, size: 18 },
    { emoji: '🌸', top: '12%', left: '85%', delay: 1.2, dur: 3.8, size: 16 },
    { emoji: '🍃', top: '5%', left: '65%', delay: 0.6, dur: 4.5, size: 14 },
    { emoji: '⭐', top: '20%', left: '92%', delay: 2.0, dur: 3.2, size: 13 },
    { emoji: '🌼', top: '18%', left: '2%', delay: 1.8, dur: 4.0, size: 15 },
  ];

  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '38%',
          background: `linear-gradient(180deg, transparent 0%, ${AC.mint}55 40%, ${AC.grass}44 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: compact ? -40 : -60,
          left: '-10%',
          right: '-10%',
          height: compact ? 100 : 140,
          background: `radial-gradient(ellipse at 50% 100%, ${AC.grassDk}88 0%, ${AC.grass}44 60%, transparent 100%)`,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {[
        { left: '-3%', bottom: compact ? 44 : 60, scale: compact ? 0.62 : 0.9 },
        { left: '82%', bottom: compact ? 40 : 55, scale: compact ? 0.58 : 0.85 },
        { left: '92%', bottom: compact ? 46 : 62, scale: compact ? 0.52 : 0.75 },
      ].map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: t.bottom,
            left: t.left,
            fontSize: 48 * t.scale,
            pointerEvents: 'none',
            zIndex: 1,
            opacity: compact ? 0.55 : 0.75,
          }}
        >
          🌳
        </div>
      ))}
      {(compact ? floaters.slice(0, 3) : floaters).map((f, i) => (
        <motion.span
          key={i}
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            zIndex: 2,
            top: f.top,
            left: f.left,
            fontSize: compact ? f.size * 0.82 : f.size,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
          }}
          animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {f.emoji}
        </motion.span>
      ))}
      {[
        { top: compact ? '4%' : '6%', left: '15%', w: compact ? 48 : 70, delay: 0 },
        ...(compact ? [] : [{ top: '3%', left: '55%', w: 55, delay: 1.5 }]),
      ].map((c, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: c.top,
            left: c.left,
            width: c.w,
            height: c.w * 0.5,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.85)',
            pointerEvents: 'none',
            zIndex: 1,
            boxShadow: '0 3px 10px rgba(255,255,255,0.6)',
          }}
          animate={{ x: [0, 12, 0] }}
          transition={{ duration: 8 + i * 2, delay: c.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

/** ホーム等と同一のフォントスタック */
export const ACNH_FONT_FAMILY =
  "'Rounded Mplus 1c', 'M PLUS Rounded 1c', 'Hiragino Maru Gothic Pro', 'Noto Sans JP', sans-serif";

export function acnhPageShellStyle(): CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    minHeight: '100dvh',
    overflowX: 'hidden',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: `linear-gradient(180deg, ${AC.skyDeep} 0%, ${AC.sky} 22%, ${AC.cream} 48%, #F0FAF0 100%)`,
    fontFamily: ACNH_FONT_FAMILY,
    boxSizing: 'border-box',
  };
}
