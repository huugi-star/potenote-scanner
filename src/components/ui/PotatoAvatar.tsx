/**
 * PotatoAvatar.tsx
 * 
 * ポテトのアバターコンポーネント
 * 人型で学生服を着た可愛いデザイン
 * 装備品をデータ駆動で描画し、感情表現とSSRエフェクトを実装
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import type { Item } from '@/data/items';
import { getRarityColor } from '@/data/items';

// ===== Types =====

export type PotatoEmotion = 'normal' | 'happy' | 'confused' | 'smart';

interface PotatoAvatarProps {
  equipped?: {
    head?: Item;
    body?: Item;
    face?: Item;
    accessory?: Item;
  };
  emotion?: PotatoEmotion;
  ssrEffect?: boolean;
  size?: number;
  className?: string;
}

// ===== Sub Components =====

/**
 * SSRパーティクルエフェクト
 */
const SSRParticles = ({ size }: { size: number }) => {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i * 30) * (Math.PI / 180),
      delay: i * 0.1,
      distance: size * 0.6 + Math.random() * size * 0.2,
    }));
  }, [size]);

  return (
    <g className="ssr-particles">
      {particles.map((p) => (
        <motion.circle
          key={p.id}
          r={3}
          fill="#FFD700"
          initial={{ 
            cx: size / 2, 
            cy: size / 2, 
            opacity: 0, 
            scale: 0 
          }}
          animate={{
            cx: [
              size / 2,
              size / 2 + Math.cos(p.angle) * p.distance * 0.5,
              size / 2 + Math.cos(p.angle) * p.distance,
            ],
            cy: [
              size / 2,
              size / 2 + Math.sin(p.angle) * p.distance * 0.5,
              size / 2 + Math.sin(p.angle) * p.distance,
            ],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 2,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={size * 0.45}
        fill="none"
        stroke="url(#ssrGradient)"
        strokeWidth={2}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: [0.3, 0.8, 0.3], 
          scale: [0.95, 1.05, 0.95] 
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </g>
  );
};

/**
 * 感情エフェクト
 */
const EmotionEffect = ({ emotion, size }: { emotion: PotatoEmotion; size: number }) => {
  const centerX = size / 2;
  const topY = size * 0.08;

  switch (emotion) {
    case 'confused':
      return (
        <g className="emotion-confused">
          <motion.path
            d={`M ${size * 0.78} ${size * 0.15} 
                Q ${size * 0.81} ${size * 0.2} ${size * 0.78} ${size * 0.27}
                Q ${size * 0.75} ${size * 0.2} ${size * 0.78} ${size * 0.15}`}
            fill="#87CEEB"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: [0, 1, 1, 0], y: [0, 5, 10, 15] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.text
            x={size * 0.85}
            y={size * 0.28}
            fontSize={size * 0.12}
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
        <g className="emotion-smart">
          <motion.g
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.ellipse
              cx={centerX}
              cy={topY}
              rx={size * 0.06}
              ry={size * 0.08}
              fill="#FEF08A"
              stroke="#F59E0B"
              strokeWidth={1.5}
              animate={{ fill: ['#FEF08A', '#FDE047', '#FEF08A'] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <rect
              x={centerX - size * 0.03}
              y={topY + size * 0.06}
              width={size * 0.06}
              height={size * 0.025}
              fill="#9CA3AF"
              rx={1}
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <motion.line
                key={angle}
                x1={centerX + Math.cos(angle * Math.PI / 180) * size * 0.1}
                y1={topY + Math.sin(angle * Math.PI / 180) * size * 0.1}
                x2={centerX + Math.cos(angle * Math.PI / 180) * size * 0.14}
                y2={topY + Math.sin(angle * Math.PI / 180) * size * 0.14}
                stroke="#F59E0B"
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 1, delay: i * 0.1, repeat: Infinity }}
              />
            ))}
          </motion.g>
          <motion.text
            x={size * 0.82}
            y={size * 0.2}
            fontSize={size * 0.14}
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
        <g className="emotion-happy">
          {[
            { x: size * 0.15, y: size * 0.2, delay: 0 },
            { x: size * 0.85, y: size * 0.25, delay: 0.3 },
            { x: size * 0.1, y: size * 0.5, delay: 0.6 },
            { x: size * 0.9, y: size * 0.45, delay: 0.9 },
          ].map((star, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                scale: [0, 1, 0],
                rotate: [0, 180, 360]
              }}
              transition={{ 
                duration: 1.5, 
                delay: star.delay, 
                repeat: Infinity,
                repeatDelay: 1
              }}
            >
              <path
                d={`M ${star.x} ${star.y - 5} L ${star.x + 1.5} ${star.y - 1.5} L ${star.x + 5} ${star.y} L ${star.x + 1.5} ${star.y + 1.5} L ${star.x} ${star.y + 5} L ${star.x - 1.5} ${star.y + 1.5} L ${star.x - 5} ${star.y} L ${star.x - 1.5} ${star.y - 1.5} Z`}
                fill="#FFD700"
              />
            </motion.g>
          ))}
        </g>
      );

    default:
      return null;
  }
};

/**
 * 装備品の描画
 */
const Equipment = ({ 
  item, 
  category, 
  size 
}: { 
  item: Item; 
  category: string; 
  size: number;
}) => {
  const renderEquipment = () => {
    const { visual } = item;
    
    const positions = {
      head: { x: size / 2, y: size * 0.12 },
      face: { x: size / 2, y: size * 0.32 },
      body: { x: size / 2, y: size * 0.6 },
      accessory: { x: size * 0.8, y: size * 0.25 },
    };

    const pos = positions[category as keyof typeof positions] || positions.accessory;

    if (visual.type === 'svg_path') {
      return (
        <g transform={`translate(${pos.x - 12}, ${pos.y - 12})`}>
          <path
            d={visual.value}
            fill={getRarityColor(item.rarity)}
            stroke="#333"
            strokeWidth={1}
          />
        </g>
      );
    } else {
      const shapes = {
        head: (
          <ellipse 
            cx={pos.x} 
            cy={pos.y} 
            rx={size * 0.12} 
            ry={size * 0.06} 
            fill={visual.value}
            stroke="#333"
            strokeWidth={1}
          />
        ),
        face: (
          <rect
            x={pos.x - size * 0.15}
            y={pos.y - size * 0.025}
            width={size * 0.3}
            height={size * 0.05}
            rx={size * 0.025}
            fill={visual.value}
            stroke="#333"
            strokeWidth={1}
          />
        ),
        body: (
          <rect
            x={pos.x - size * 0.15}
            y={pos.y - size * 0.08}
            width={size * 0.3}
            height={size * 0.16}
            rx={size * 0.02}
            fill={visual.value}
            stroke="#333"
            strokeWidth={1}
          />
        ),
        accessory: (
          <circle
            cx={pos.x}
            cy={pos.y}
            r={size * 0.04}
            fill={visual.value}
            stroke="#333"
            strokeWidth={1}
          />
        ),
      };

      return shapes[category as keyof typeof shapes] || shapes.accessory;
    }
  };

  return (
    <motion.g
      className={`equipment-${category}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
    >
      {renderEquipment()}
      {item.rarity === 'SSR' && (
        <motion.circle
          cx={size / 2}
          cy={size * 0.25}
          r={size * 0.2}
          fill="none"
          stroke="#FFD700"
          strokeWidth={1}
          opacity={0.5}
          animate={{ 
            r: [size * 0.2, size * 0.25, size * 0.2],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
};

// ===== Main Component =====

export const PotatoAvatar = ({
  equipped = {},
  emotion = 'normal',
  ssrEffect = false,
  size = 120,
  className = '',
}: PotatoAvatarProps) => {
  const hasSSREquipped = Object.values(equipped).some(
    item => item?.rarity === 'SSR'
  );
  const showSSREffect = ssrEffect || hasSSREquipped;

  // サイズに基づいたスケーリング
  const s = size / 120; // 基準サイズ120に対する比率

  // 目の描画
  const renderEyes = () => {
    const leftEyeX = size * 0.4;
    const rightEyeX = size * 0.6;
    const eyeY = size * 0.32;
    const eyeSize = size * 0.035;

    switch (emotion) {
      case 'happy':
        return (
          <>
            <path
              d={`M ${leftEyeX - eyeSize * 1.5} ${eyeY} Q ${leftEyeX} ${eyeY - eyeSize * 2} ${leftEyeX + eyeSize * 1.5} ${eyeY}`}
              stroke="#3D2314"
              strokeWidth={2.5 * s}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${rightEyeX - eyeSize * 1.5} ${eyeY} Q ${rightEyeX} ${eyeY - eyeSize * 2} ${rightEyeX + eyeSize * 1.5} ${eyeY}`}
              stroke="#3D2314"
              strokeWidth={2.5 * s}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );

      case 'confused':
        return (
          <>
            <ellipse cx={leftEyeX} cy={eyeY} rx={eyeSize} ry={eyeSize * 1.2} fill="#3D2314" />
            <ellipse cx={rightEyeX} cy={eyeY} rx={eyeSize} ry={eyeSize * 1.2} fill="#3D2314" />
            <line
              x1={leftEyeX - eyeSize * 1.5}
              y1={eyeY - eyeSize * 2}
              x2={leftEyeX + eyeSize * 1.5}
              y2={eyeY - eyeSize * 1.2}
              stroke="#3D2314"
              strokeWidth={2 * s}
              strokeLinecap="round"
            />
            <line
              x1={rightEyeX - eyeSize * 1.5}
              y1={eyeY - eyeSize * 1.2}
              x2={rightEyeX + eyeSize * 1.5}
              y2={eyeY - eyeSize * 2}
              stroke="#3D2314"
              strokeWidth={2 * s}
              strokeLinecap="round"
            />
          </>
        );

      case 'smart':
        return (
          <>
            <motion.ellipse
              cx={leftEyeX}
              cy={eyeY}
              rx={eyeSize * 1.1}
              ry={eyeSize * 1.3}
              fill="#3D2314"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
            />
            <motion.ellipse
              cx={rightEyeX}
              cy={eyeY}
              rx={eyeSize * 1.1}
              ry={eyeSize * 1.3}
              fill="#3D2314"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
            />
            <circle cx={leftEyeX + 1.5 * s} cy={eyeY - 1.5 * s} r={eyeSize * 0.4} fill="white" />
            <circle cx={rightEyeX + 1.5 * s} cy={eyeY - 1.5 * s} r={eyeSize * 0.4} fill="white" />
          </>
        );

      default:
        return (
          <>
            <circle cx={leftEyeX} cy={eyeY} r={eyeSize} fill="#3D2314" />
            <circle cx={rightEyeX} cy={eyeY} r={eyeSize} fill="#3D2314" />
            <circle cx={leftEyeX + 1 * s} cy={eyeY - 1 * s} r={eyeSize * 0.35} fill="white" />
            <circle cx={rightEyeX + 1 * s} cy={eyeY - 1 * s} r={eyeSize * 0.35} fill="white" />
          </>
        );
    }
  };

  // 口の描画
  const renderMouth = () => {
    const mouthX = size / 2;
    const mouthY = size * 0.42;

    switch (emotion) {
      case 'happy':
        return (
          <path
            d={`M ${mouthX - size * 0.08} ${mouthY} Q ${mouthX} ${mouthY + size * 0.06} ${mouthX + size * 0.08} ${mouthY}`}
            stroke="#3D2314"
            strokeWidth={2.5 * s}
            fill="none"
            strokeLinecap="round"
          />
        );

      case 'confused':
        return (
          <path
            d={`M ${mouthX - size * 0.05} ${mouthY} Q ${mouthX - size * 0.02} ${mouthY - size * 0.015} ${mouthX} ${mouthY} Q ${mouthX + size * 0.02} ${mouthY + size * 0.015} ${mouthX + size * 0.05} ${mouthY}`}
            stroke="#3D2314"
            strokeWidth={2 * s}
            fill="none"
            strokeLinecap="round"
          />
        );

      case 'smart':
        return (
          <path
            d={`M ${mouthX - size * 0.06} ${mouthY - size * 0.01} Q ${mouthX} ${mouthY + size * 0.03} ${mouthX + size * 0.06} ${mouthY - size * 0.015}`}
            stroke="#3D2314"
            strokeWidth={2.5 * s}
            fill="none"
            strokeLinecap="round"
          />
        );

      default:
        return (
          <path
            d={`M ${mouthX - size * 0.04} ${mouthY} Q ${mouthX} ${mouthY + size * 0.025} ${mouthX + size * 0.04} ${mouthY}`}
            stroke="#3D2314"
            strokeWidth={2 * s}
            fill="none"
            strokeLinecap="round"
          />
        );
    }
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <defs>
        <radialGradient id="potatoSkinGradient" cx="40%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FFECD2" />
          <stop offset="50%" stopColor="#F5D6BA" />
          <stop offset="100%" stopColor="#E8C4A0" />
        </radialGradient>
        
        <linearGradient id="ssrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFF8DC" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>

        <linearGradient id="uniformGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2D3748" />
          <stop offset="100%" stopColor="#1A202C" />
        </linearGradient>

        <linearGradient id="collarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* SSRパーティクル（背景） */}
      {showSSREffect && <SSRParticles size={size} />}

      {/* 体（学生服） */}
      <motion.path
        d={`
          M ${size * 0.3} ${size * 0.5}
          Q ${size * 0.25} ${size * 0.55} ${size * 0.25} ${size * 0.65}
          L ${size * 0.25} ${size * 0.95}
          L ${size * 0.75} ${size * 0.95}
          L ${size * 0.75} ${size * 0.65}
          Q ${size * 0.75} ${size * 0.55} ${size * 0.7} ${size * 0.5}
          Z
        `}
        fill="url(#uniformGradient)"
        stroke="#1A202C"
        strokeWidth={1}
        filter="url(#shadow)"
      />

      {/* 襟 */}
      <path
        d={`
          M ${size * 0.35} ${size * 0.48}
          L ${size * 0.5} ${size * 0.58}
          L ${size * 0.65} ${size * 0.48}
        `}
        fill="url(#collarGradient)"
        stroke="#CBD5E0"
        strokeWidth={1}
      />

      {/* ボタン */}
      {[0.62, 0.72, 0.82].map((y, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size * y}
          r={size * 0.018}
          fill="#718096"
          stroke="#4A5568"
          strokeWidth={0.5}
        />
      ))}

      {/* 腕（左） */}
      <path
        d={`
          M ${size * 0.25} ${size * 0.55}
          Q ${size * 0.15} ${size * 0.6} ${size * 0.12} ${size * 0.75}
          L ${size * 0.18} ${size * 0.78}
          Q ${size * 0.2} ${size * 0.65} ${size * 0.28} ${size * 0.58}
          Z
        `}
        fill="url(#uniformGradient)"
        stroke="#1A202C"
        strokeWidth={1}
      />

      {/* 腕（右） */}
      <path
        d={`
          M ${size * 0.75} ${size * 0.55}
          Q ${size * 0.85} ${size * 0.6} ${size * 0.88} ${size * 0.75}
          L ${size * 0.82} ${size * 0.78}
          Q ${size * 0.8} ${size * 0.65} ${size * 0.72} ${size * 0.58}
          Z
        `}
        fill="url(#uniformGradient)"
        stroke="#1A202C"
        strokeWidth={1}
      />

      {/* 手（左） */}
      <ellipse
        cx={size * 0.15}
        cy={size * 0.77}
        rx={size * 0.045}
        ry={size * 0.04}
        fill="#F5D6BA"
        stroke="#E8C4A0"
        strokeWidth={1}
      />

      {/* 手（右） */}
      <ellipse
        cx={size * 0.85}
        cy={size * 0.77}
        rx={size * 0.045}
        ry={size * 0.04}
        fill="#F5D6BA"
        stroke="#E8C4A0"
        strokeWidth={1}
      />

      {/* 頭（ポテト型） */}
      <motion.ellipse
        cx={size / 2}
        cy={size * 0.32}
        rx={size * 0.22}
        ry={size * 0.24}
        fill="url(#potatoSkinGradient)"
        stroke="#D4A574"
        strokeWidth={1.5}
        filter="url(#shadow)"
        animate={emotion === 'happy' ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.5, repeat: emotion === 'happy' ? Infinity : 0 }}
      />

      {/* 髪の毛（ちょこんと） */}
      <path
        d={`
          M ${size * 0.45} ${size * 0.1}
          Q ${size * 0.48} ${size * 0.05} ${size * 0.5} ${size * 0.08}
          Q ${size * 0.52} ${size * 0.03} ${size * 0.55} ${size * 0.1}
        `}
        fill="#8B7355"
        stroke="#6B5344"
        strokeWidth={1}
      />

      {/* ほっぺ */}
      {(emotion === 'happy' || emotion === 'normal') && (
        <>
          <ellipse
            cx={size * 0.32}
            cy={size * 0.38}
            rx={size * 0.035}
            ry={size * 0.025}
            fill="#FFB6C1"
            opacity={0.6}
          />
          <ellipse
            cx={size * 0.68}
            cy={size * 0.38}
            rx={size * 0.035}
            ry={size * 0.025}
            fill="#FFB6C1"
            opacity={0.6}
          />
        </>
      )}

      {/* 目 */}
      {renderEyes()}

      {/* 口 */}
      {renderMouth()}

      {/* 感情エフェクト */}
      <AnimatePresence>
        <EmotionEffect emotion={emotion} size={size} />
      </AnimatePresence>

      {/* 装備品 */}
      <AnimatePresence>
        {equipped.body && (
          <Equipment item={equipped.body} category="body" size={size} />
        )}
        {equipped.head && (
          <Equipment item={equipped.head} category="head" size={size} />
        )}
        {equipped.face && (
          <Equipment item={equipped.face} category="face" size={size} />
        )}
        {equipped.accessory && (
          <Equipment item={equipped.accessory} category="accessory" size={size} />
        )}
      </AnimatePresence>
    </motion.svg>
  );
};

export default PotatoAvatar;
