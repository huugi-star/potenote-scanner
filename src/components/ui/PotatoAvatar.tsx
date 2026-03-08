/**
 * PotatoAvatar.tsx
 *
 * 500x500 基準のPNG/SVGレイヤー合成アバター。
 * props.size で表示倍率を制御し、内部座標は常に500px固定。
 *
 * レイヤー順（下→上）:
 * SSRパーティクル → base.png → arms → face.svg → equipment → EmotionEffect
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useEffect, useRef, useState } from 'react';
import type { Item } from '@/data/items';
import { getRarityColor } from '@/data/items';

// ===== Types =====

export type PotatoEmotion = 'normal' | 'happy' | 'confused' | 'smart';
export type AvatarPose    = 'idle' | 'wave' | 'up';
export type AvatarFacing  = 'right' | 'left';

interface PotatoAvatarProps {
  equipped?: {
    head?      : Item;
    body?      : Item;
    face?      : Item;
    accessory? : Item;
  };
  emotion?  : PotatoEmotion;
  ssrEffect?: boolean;
  size?     : number;
  className?: string;
  pose?     : AvatarPose;
  facing?   : AvatarFacing;
}

// ===== Arm image map =====

const ARM_IMAGES: Record<AvatarPose, { left: string; right: string }> = {
  idle: {
    left : '/avatar/arm_left_down.png',
    right: '/avatar/arm_right_down.png',
  },
  wave: {
    left : '/avatar/arm_left_down.png',
    right: '/avatar/arm_right_up.png',
  },
  up: {
    left : '/avatar/arm_left_up.png',
    right: '/avatar/arm_right_up.png',
  },
};

// ===== Sub Components =====

/** SSRパーティクルエフェクト（SVGオーバーレイ） */
const SSRParticles = ({ size }: { size: number }) => {
  const BASE = 500;
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id      : i,
      angle   : (i * 30) * (Math.PI / 180),
      delay   : i * 0.1,
      distance: BASE * 0.6 + Math.random() * BASE * 0.2,
    }));
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BASE} ${BASE}`}
      className="absolute inset-0 pointer-events-none"
    >
      <defs>
        <linearGradient id="ssrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFD700" />
          <stop offset="50%"  stopColor="#FFF8DC" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
      </defs>
      {particles.map((p) => (
        <motion.circle
          key={p.id}
          r={6}
          fill="#FFD700"
          initial={{ cx: BASE / 2, cy: BASE / 2, opacity: 0, scale: 0 }}
          animate={{
            cx     : [BASE / 2, BASE / 2 + Math.cos(p.angle) * p.distance * 0.5, BASE / 2 + Math.cos(p.angle) * p.distance],
            cy     : [BASE / 2, BASE / 2 + Math.sin(p.angle) * p.distance * 0.5, BASE / 2 + Math.sin(p.angle) * p.distance],
            opacity: [0, 1, 0],
            scale  : [0, 1.5, 0],
          }}
          transition={{ duration: 2, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <motion.circle
        cx={BASE / 2}
        cy={BASE / 2}
        r={BASE * 0.45}
        fill="none"
        stroke="url(#ssrGradient)"
        strokeWidth={4}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  );
};

/** 感情エフェクト（SVGオーバーレイ） */
const EmotionEffect = ({ emotion, size }: { emotion: PotatoEmotion; size: number }) => {
  const BASE    = 500;
  const centerX = BASE / 2;
  const topY    = BASE * 0.08;

  const inner = (() => {
    switch (emotion) {
      case 'confused':
        return (
          <g>
            <motion.path
              d={`M ${BASE * 0.78} ${BASE * 0.15}
                  Q ${BASE * 0.81} ${BASE * 0.2} ${BASE * 0.78} ${BASE * 0.27}
                  Q ${BASE * 0.75} ${BASE * 0.2} ${BASE * 0.78} ${BASE * 0.15}`}
              fill="#87CEEB"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: [0, 1, 1, 0], y: [0, 5, 10, 15] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.text
              x={BASE * 0.85}
              y={BASE * 0.28}
              fontSize={BASE * 0.12}
              fill="#6B7280"
              fontWeight="bold"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              ?
            </motion.text>
          </g>
        );

      case 'smart':
        return (
          <g>
            <motion.g
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.ellipse
                cx={centerX}
                cy={topY}
                rx={BASE * 0.06}
                ry={BASE * 0.08}
                fill="#FEF08A"
                stroke="#F59E0B"
                strokeWidth={3}
                animate={{ fill: ['#FEF08A', '#FDE047', '#FEF08A'] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <rect
                x={centerX - BASE * 0.03}
                y={topY + BASE * 0.06}
                width={BASE * 0.06}
                height={BASE * 0.025}
                fill="#9CA3AF"
                rx={2}
              />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <motion.line
                  key={angle}
                  x1={centerX + Math.cos(angle * Math.PI / 180) * BASE * 0.1}
                  y1={topY    + Math.sin(angle * Math.PI / 180) * BASE * 0.1}
                  x2={centerX + Math.cos(angle * Math.PI / 180) * BASE * 0.14}
                  y2={topY    + Math.sin(angle * Math.PI / 180) * BASE * 0.14}
                  stroke="#F59E0B"
                  strokeWidth={3}
                  strokeLinecap="round"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, delay: i * 0.1, repeat: Infinity }}
                />
              ))}
            </motion.g>
            <motion.text
              x={BASE * 0.82}
              y={BASE * 0.2}
              fontSize={BASE * 0.14}
              fill="#F59E0B"
              fontWeight="bold"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [0, 1.3, 1] }}
              transition={{ duration: 0.4 }}
            >
              !
            </motion.text>
          </g>
        );

      case 'happy':
        return (
          <g>
            {[
              { x: BASE * 0.15, y: BASE * 0.2,  delay: 0   },
              { x: BASE * 0.85, y: BASE * 0.25, delay: 0.3 },
              { x: BASE * 0.1,  y: BASE * 0.5,  delay: 0.6 },
              { x: BASE * 0.9,  y: BASE * 0.45, delay: 0.9 },
            ].map((star, i) => (
              <motion.g
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 180, 360] }}
                transition={{ duration: 1.5, delay: star.delay, repeat: Infinity, repeatDelay: 1 }}
              >
                <path
                  d={`M ${star.x} ${star.y - 10} L ${star.x + 3} ${star.y - 3} L ${star.x + 10} ${star.y} L ${star.x + 3} ${star.y + 3} L ${star.x} ${star.y + 10} L ${star.x - 3} ${star.y + 3} L ${star.x - 10} ${star.y} L ${star.x - 3} ${star.y - 3} Z`}
                  fill="#FFD700"
                />
              </motion.g>
            ))}
          </g>
        );

      default:
        return null;
    }
  })();

  if (!inner) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BASE} ${BASE}`}
      className="absolute inset-0 pointer-events-none"
    >
      {inner}
    </svg>
  );
};

/** 装備品レイヤー（image / color / svg_path すべて対応） */
const EquipmentLayer = ({
  item,
  size,
  pose = 'idle',
}: {
  item: Item;
  size: number;
  pose?: AvatarPose;
}) => {
  const { visual, category } = item;
  if (!visual?.value) return null;

  const BASE = 500;

  // カテゴリごとの描画位置（500px 基準）
  const positions: Record<string, { x: number; y: number }> = {
    head     : { x: BASE / 2,    y: BASE * 0.12 },
    face     : { x: BASE / 2,    y: BASE * 0.32 },
    body     : { x: BASE / 2,    y: BASE * 0.60 },
    accessory: { x: BASE * 0.80, y: BASE * 0.25 },
  };
  const pos = positions[category ?? 'accessory'] ?? positions.accessory;

  const renderShape = () => {
    if (visual.type === 'image') {
      // pose=up の場合は visual.up を優先、なければ visual.value にフォールバック
      const src = (pose === 'up' && visual.up) ? visual.up : visual.value;
      return (
        <image
          href={src}
          x={0} y={0}
          width={BASE} height={BASE}
          preserveAspectRatio="xMidYMid meet"
        />
      );
    }

    if (visual.type === 'svg_path') {
      // items.ts の path は 24px 座標系
      const scale = BASE / 24;
      return (
        <g transform={`translate(${pos.x - 12 * scale}, ${pos.y - 12 * scale}) scale(${scale})`}>
          <path
            d={visual.value}
            fill={getRarityColor(item.rarity)}
            stroke="#333"
            strokeWidth={1 / scale}
          />
        </g>
      );
    }

    // color
    const shapes: Record<string, React.ReactNode> = {
      head: (
        <ellipse
          cx={pos.x} cy={pos.y}
          rx={BASE * 0.12} ry={BASE * 0.06}
          fill={visual.value} stroke="#333" strokeWidth={2}
        />
      ),
      face: (
        <rect
          x={pos.x - BASE * 0.15} y={pos.y - BASE * 0.025}
          width={BASE * 0.3} height={BASE * 0.05}
          rx={BASE * 0.025}
          fill={visual.value} stroke="#333" strokeWidth={2}
        />
      ),
      body: (
        <rect
          x={pos.x - BASE * 0.15} y={pos.y - BASE * 0.08}
          width={BASE * 0.3} height={BASE * 0.16}
          rx={BASE * 0.02}
          fill={visual.value} stroke="#333" strokeWidth={2}
        />
      ),
      accessory: (
        <circle
          cx={pos.x} cy={pos.y}
          r={BASE * 0.04}
          fill={visual.value} stroke="#333" strokeWidth={2}
        />
      ),
    };
    return shapes[category ?? 'accessory'] ?? shapes.accessory;
  };

  // レアリティごとの glow フィルター設定
  const glowConfig = item.rarity === 'SSR'
    ? { id: `glow-ssr-${item.id}`, color: '#FFD700', blur: 14, strength: 1.8 }
    : item.rarity === 'SR'
    ? { id: `glow-sr-${item.id}`,  color: '#FFF176', blur: 8,  strength: 1.2 }
    : null;

  return (
    <motion.svg
      key={item.id}
      width={size}
      height={size}
      viewBox={`0 0 ${BASE} ${BASE}`}
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      {/* glow フィルター定義 */}
      {glowConfig && (
        <defs>
          <filter id={glowConfig.id} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={glowConfig.blur} result="blur" />
            <feFlood floodColor={glowConfig.color} floodOpacity={glowConfig.strength} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* glow を装備品そのものに適用 */}
      <g filter={glowConfig ? `url(#${glowConfig.id})` : undefined}>
        {renderShape()}
      </g>
    </motion.svg>
  );
};

// ===== Idle animation hooks =====

/** ランダム間隔で一瞬だけ true にするフック */
function useRandomBlink(minMs: number, maxMs: number, durationMs: number) {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      const delay = minMs + Math.random() * (maxMs - minMs);
      timerRef.current = setTimeout(() => {
        setActive(true);
        setTimeout(() => {
          setActive(false);
          schedule();
        }, durationMs);
      }, delay);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [minMs, maxMs, durationMs]);

  return active;
}

// ===== Main Component =====

export const PotatoAvatar = ({
  equipped  = {},
  emotion   = 'normal',
  ssrEffect = false,
  size      = 120,
  className = '',
  pose      = 'idle',
  facing    = 'right',
}: PotatoAvatarProps) => {
  const showSSREffect = ssrEffect;

  // (4) まばたき: 3〜6秒に1回、120ms だけ face_close を表示
  const isBlinking = useRandomBlink(3000, 6000, 120);

  // (5) 手振り: 8〜14秒に1回、500〜700ms だけ pose=up に切替
  const [waving, setWaving] = useState(false);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const schedule = () => {
      const delay    = 8000 + Math.random() * 6000;
      const duration = 500  + Math.random() * 200;
      waveTimerRef.current = setTimeout(() => {
        setWaving(true);
        setTimeout(() => {
          setWaving(false);
          schedule();
        }, duration);
      }, delay);
    };
    schedule();
    return () => { if (waveTimerRef.current) clearTimeout(waveTimerRef.current); };
  }, []);

  const activePose = waving ? 'up' : pose;
  const arms       = ARM_IMAGES[activePose];
  const faceSrc    = isBlinking ? '/avatar/face_close.svg' : '/avatar/face.svg';

  const flipStyle: React.CSSProperties = facing === 'left' ? { transform: 'scaleX(-1)' } : {};

  return (
    // size + 影の分だけ縦に余白を確保
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size + size * 0.08, ...flipStyle }}
    >
      {/* SSRパーティクル（最背面） */}
      {showSSREffect && <SSRParticles size={size} />}

      <div
        className="absolute inset-0"
        style={{ height: size }}
      >
        {/* Layer 1: 素体 */}
        <img
          src="/avatar/base.png"
          alt="base"
          width={size}
          height={size}
          className="absolute inset-0 object-contain"
        />

        {/* Layer 2: 手持ちアクセ 下半分（腕の後ろ・head より後ろ） */}
        {equipped.accessory?.held && (
          <EquipmentLayer item={equipped.accessory} size={size} pose={activePose} />
        )}

        {/* Layer 3: 腕（左） */}
        <img
          src={arms.left}
          alt="arm-left"
          width={size}
          height={size}
          className="absolute inset-0 object-contain"
        />

        {/* Layer 4: 腕（右） */}
        <img
          src={arms.right}
          alt="arm-right"
          width={size}
          height={size}
          className="absolute inset-0 object-contain"
        />

        {/* Layer 5: 表情（まばたきで切替） */}
        <img
          src={faceSrc}
          alt="face"
          width={size}
          height={size}
          className="absolute inset-0 object-contain"
        />

        {/* Layer 6: 装備（body → face → head → 通常アクセ → 手持ちアクセ上書き） */}
        <AnimatePresence>
          {equipped.body && (
            <EquipmentLayer item={equipped.body} size={size} pose={activePose} />
          )}
          {equipped.face && (
            <EquipmentLayer item={equipped.face} size={size} pose={activePose} />
          )}
          {equipped.head && (
            <EquipmentLayer item={equipped.head} size={size} pose={activePose} />
          )}
          {/* 通常アクセ */}
          {equipped.accessory && !equipped.accessory.held && (
            <EquipmentLayer item={equipped.accessory} size={size} pose={activePose} />
          )}
          {/* 手持ちアクセを head の前にも重ねて描画（腕との重なりは Layer2 で表現済み） */}
          {equipped.accessory?.held && (
            <EquipmentLayer item={equipped.accessory} size={size} pose={activePose} />
          )}
        </AnimatePresence>

        {/* Layer 7: 感情エフェクト（最前面） */}
        <AnimatePresence>
          <EmotionEffect key={emotion} emotion={emotion} size={size} />
        </AnimatePresence>
      </div>

      {/* (3) 足元の影: アニメーションを削除して完全に静止した div に変更 */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/20"
        style={{ width: size * 0.5, height: size * 0.06 }}
      />
    </div>
  );
};

export default PotatoAvatar;