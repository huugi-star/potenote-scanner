/**
 * MapVisualizer.tsx
 * 
 * 島ベースのらせん状マップ
 * 始まりの島から100km毎に新しい島が出現
 */

import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Flag, Compass, Ship } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { Island, Flag as FlagType, Coordinate } from '@/types';

// ===== Types =====

export interface MapVisualizerProps {
  flags?: FlagType[];
  currentPosition?: Coordinate;
  totalDistance?: number;
  onFlagClick?: (flag: FlagType) => void;
  className?: string;
  onClose?: () => void;
}

interface IslandVisual {
  island: Island;
  x: number;
  y: number;
  size: number;
  angle: number;
}

// ===== Constants =====

const ISLAND_DISTANCE = 100; // 100km毎に新しい島
const BASE_ISLAND_SIZE = 60;
const SPIRAL_SPACING = 120; // 螺旋の間隔
const SPIRAL_GROWTH = 0.15; // 螺旋の成長率

// ===== Helper Functions =====

/**
 * 螺旋座標を計算（島の位置用）
 */
const calculateIslandPosition = (islandIndex: number): { x: number; y: number; angle: number } => {
  if (islandIndex === 0) {
    return { x: 0, y: 0, angle: 0 };
  }
  
  // アルキメデス螺旋: r = a + b*θ
  const angle = islandIndex * (Math.PI / 2); // 90度ずつ回転
  const radius = SPIRAL_SPACING + SPIRAL_GROWTH * angle * 50;
  
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    angle: angle * (180 / Math.PI),
  };
};

/**
 * 現在位置を計算（島間の進行度）
 */
const calculateCurrentPosition = (
  totalDistance: number,
  islands: IslandVisual[]
): { x: number; y: number } => {
  const currentIslandIndex = Math.floor(totalDistance / ISLAND_DISTANCE);
  const nextIslandIndex = currentIslandIndex + 1;
  const progress = (totalDistance % ISLAND_DISTANCE) / ISLAND_DISTANCE;
  
  const currentIsland = islands[currentIslandIndex];
  const nextIsland = islands[nextIslandIndex];
  
  if (!currentIsland) {
    return { x: 0, y: 0 };
  }
  
  if (!nextIsland) {
    // 次の島がまだない場合は現在の島から少し進んだ位置
    const nextPos = calculateIslandPosition(currentIslandIndex + 1);
    return {
      x: currentIsland.x + (nextPos.x - currentIsland.x) * progress,
      y: currentIsland.y + (nextPos.y - currentIsland.y) * progress,
    };
  }
  
  // 2つの島の間を補間
  return {
    x: currentIsland.x + (nextIsland.x - currentIsland.x) * progress,
    y: currentIsland.y + (nextIsland.y - currentIsland.y) * progress,
  };
};

// ===== Sub Components =====

const IslandNode = ({ 
  island, 
  x, 
  y, 
  size, 
  isStart,
  isCurrent,
  isLocked,
}: { 
  island: Island;
  x: number;
  y: number;
  size: number;
  isStart: boolean;
  isCurrent: boolean;
  isLocked: boolean;
}) => {
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15 }}
    >
      {/* 島の影 */}
      <ellipse
        cx={x + 3}
        cy={y + 5}
        rx={size * 0.6}
        ry={size * 0.3}
        fill="rgba(0,0,0,0.2)"
      />
      
      {/* 島本体 */}
      <motion.ellipse
        cx={x}
        cy={y}
        rx={size * 0.6}
        ry={size * 0.4}
        fill={isLocked ? '#4B5563' : isStart ? '#34D399' : '#60A5FA'}
        stroke={isCurrent ? '#FBBF24' : isLocked ? '#374151' : '#1D4ED8'}
        strokeWidth={isCurrent ? 3 : 2}
        animate={isCurrent ? { 
          strokeWidth: [3, 5, 3],
          stroke: ['#FBBF24', '#F59E0B', '#FBBF24']
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* 島の模様（木など） */}
      {!isLocked && (
        <>
          <circle cx={x - size * 0.15} cy={y - size * 0.1} r={size * 0.08} fill="#22C55E" />
          <circle cx={x + size * 0.1} cy={y - size * 0.05} r={size * 0.1} fill="#16A34A" />
          <circle cx={x} cy={y + size * 0.05} r={size * 0.06} fill="#15803D" />
        </>
      )}
      
      {/* 島名 */}
      <text
        x={x}
        y={y + size * 0.55}
        textAnchor="middle"
        fill={isLocked ? '#6B7280' : '#FFFFFF'}
        fontSize={10}
        fontWeight="bold"
      >
        {isLocked ? '???' : island.name}
      </text>
      
      {/* キーワードバッジ */}
      {!isLocked && island.keywords.length > 0 && (
        <g>
          <rect
            x={x - 25}
            y={y - size * 0.6}
            width={50}
            height={14}
            rx={7}
            fill="rgba(0,0,0,0.6)"
          />
          <text
            x={x}
            y={y - size * 0.6 + 10}
            textAnchor="middle"
            fill="#FBBF24"
            fontSize={8}
          >
            #{island.keywords[0]}
          </text>
        </g>
      )}
      
      {/* 始まりの島マーク */}
      {isStart && (
        <motion.g
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Compass 
            x={x - 8} 
            y={y - size * 0.3 - 16} 
            width={16} 
            height={16} 
            color="#FBBF24"
          />
        </motion.g>
      )}
    </motion.g>
  );
};

const ShipMarker = ({ x, y }: { x: number; y: number }) => {
  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ 
        scale: 1,
        y: [0, -3, 0]
      }}
      transition={{ 
        scale: { type: 'spring' },
        y: { duration: 1.5, repeat: Infinity }
      }}
    >
      {/* 船の影 */}
      <ellipse
        cx={x + 2}
        cy={y + 12}
        rx={12}
        ry={4}
        fill="rgba(0,0,0,0.3)"
      />
      
      {/* 船本体 */}
      <path
        d={`M ${x - 15} ${y + 5} 
            Q ${x - 18} ${y} ${x - 12} ${y - 5}
            L ${x + 12} ${y - 5}
            Q ${x + 18} ${y} ${x + 15} ${y + 5}
            Z`}
        fill="#8B4513"
        stroke="#5D3A1A"
        strokeWidth={1}
      />
      
      {/* マスト */}
      <line
        x1={x}
        y1={y - 5}
        x2={x}
        y2={y - 25}
        stroke="#5D3A1A"
        strokeWidth={2}
      />
      
      {/* 帆 */}
      <path
        d={`M ${x} ${y - 25}
            L ${x + 12} ${y - 15}
            L ${x} ${y - 8}
            Z`}
        fill="#FFFFFF"
        stroke="#E5E7EB"
        strokeWidth={1}
      />
      
      {/* 旗 */}
      <path
        d={`M ${x} ${y - 25}
            L ${x + 8} ${y - 28}
            L ${x} ${y - 31}
            Z`}
        fill="#EF4444"
      />
    </motion.g>
  );
};

const PathBetweenIslands = ({ 
  from, 
  to, 
  isCompleted 
}: { 
  from: { x: number; y: number };
  to: { x: number; y: number };
  isCompleted: boolean;
}) => {
  // 曲線パスを生成
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const controlOffset = 30;
  
  const pathD = `M ${from.x} ${from.y} 
                 Q ${midX + controlOffset} ${midY - controlOffset} ${to.x} ${to.y}`;
  
  return (
    <g>
      {/* 破線の航路 */}
      <path
        d={pathD}
        fill="none"
        stroke={isCompleted ? '#60A5FA' : '#4B5563'}
        strokeWidth={2}
        strokeDasharray={isCompleted ? 'none' : '8 4'}
        opacity={0.6}
      />
      
      {/* 完了時の波エフェクト */}
      {isCompleted && (
        <motion.path
          d={pathD}
          fill="none"
          stroke="#93C5FD"
          strokeWidth={4}
          strokeDasharray="4 8"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -24 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          opacity={0.4}
        />
      )}
    </g>
  );
};

// ===== Main Component =====

export const MapVisualizer = ({ className = '' }: MapVisualizerProps) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Store
  const journey = useGameStore(state => state.journey);
  const totalDistance = journey.totalDistance;
  const islands = journey.islands;
  
  // 島のビジュアルデータを計算
  const islandVisuals = useMemo<IslandVisual[]>(() => {
    // 現在の島 + 次の島（ロック状態）を表示
    const currentIslandCount = islands.length;
    const displayIslands: IslandVisual[] = [];
    
    // 既存の島
    islands.forEach((island, index) => {
      const pos = calculateIslandPosition(index);
      displayIslands.push({
        island,
        x: pos.x,
        y: pos.y,
        size: index === 0 ? BASE_ISLAND_SIZE * 1.2 : BASE_ISLAND_SIZE,
        angle: pos.angle,
      });
    });
    
    // 次の島（ロック状態）
    const nextPos = calculateIslandPosition(currentIslandCount);
    displayIslands.push({
      island: {
        id: currentIslandCount,
        distance: currentIslandCount * ISLAND_DISTANCE,
        name: `島 ${currentIslandCount + 1}`,
        keywords: [],
        unlockedAt: '',
      },
      x: nextPos.x,
      y: nextPos.y,
      size: BASE_ISLAND_SIZE,
      angle: nextPos.angle,
    });
    
    return displayIslands;
  }, [islands]);
  
  // 現在位置
  const currentPosition = useMemo(() => {
    return calculateCurrentPosition(totalDistance, islandVisuals);
  }, [totalDistance, islandVisuals]);
  
  // ビューボックスを計算
  const viewBox = useMemo(() => {
    const padding = 150;
    let minX = -padding, maxX = padding, minY = -padding, maxY = padding;
    
    islandVisuals.forEach(iv => {
      minX = Math.min(minX, iv.x - iv.size);
      maxX = Math.max(maxX, iv.x + iv.size);
      minY = Math.min(minY, iv.y - iv.size);
      maxY = Math.max(maxY, iv.y + iv.size);
    });
    
    const width = (maxX - minX + padding * 2) / zoom;
    const height = (maxY - minY + padding * 2) / zoom;
    const centerX = (minX + maxX) / 2 - pan.x / zoom;
    const centerY = (minY + maxY) / 2 - pan.y / zoom;
    
    return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;
  }, [islandVisuals, zoom, pan]);
  
  // ドラッグ操作
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // 現在の島インデックス
  const currentIslandIndex = Math.floor(totalDistance / ISLAND_DISTANCE);
  const progressToNextIsland = (totalDistance % ISLAND_DISTANCE) / ISLAND_DISTANCE * 100;

  return (
    <div className={`relative bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 rounded-2xl overflow-hidden ${className}`}>
      {/* 背景の波模様 */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%">
          <pattern id="waves" x="0" y="0" width="100" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 0 10 Q 25 0, 50 10 T 100 10"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#waves)" />
        </svg>
      </div>
      
      {/* ズームコントロール */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
          className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}
          className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>
      
      {/* 進捗表示 */}
      <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-sm rounded-xl p-3">
        <div className="flex items-center gap-2 text-white text-sm mb-2">
          <Ship className="w-4 h-4" />
          <span>累計: {totalDistance.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 text-xs">
          <Flag className="w-3 h-3" />
          <span>次の島まで: {(ISLAND_DISTANCE - (totalDistance % ISLAND_DISTANCE)).toFixed(1)} km</span>
        </div>
        <div className="mt-2 w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressToNextIsland}%` }}
          />
        </div>
      </div>
      
      {/* マップSVG */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={viewBox}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ minHeight: 400 }}
      >
        {/* 島間のパス */}
        {islandVisuals.slice(0, -1).map((iv, index) => {
          const next = islandVisuals[index + 1];
          const isCompleted = index < currentIslandIndex;
          
          return (
            <PathBetweenIslands
              key={`path-${index}`}
              from={{ x: iv.x, y: iv.y }}
              to={{ x: next.x, y: next.y }}
              isCompleted={isCompleted}
            />
          );
        })}
        
        {/* 島 */}
        {islandVisuals.map((iv, index) => {
          const isStart = index === 0;
          const isCurrent = index === currentIslandIndex;
          const isLocked = index >= islands.length;
          
          return (
            <IslandNode
              key={`island-${iv.island.id}`}
              island={iv.island}
              x={iv.x}
              y={iv.y}
              size={iv.size}
              isStart={isStart}
              isCurrent={isCurrent}
              isLocked={isLocked}
            />
          );
        })}
        
        {/* 船（現在位置） */}
        <ShipMarker x={currentPosition.x} y={currentPosition.y} />
        
        {/* フラッグ（最近のもののみ表示） */}
        {journey.flags.slice(-10).map((flag, index) => (
          <motion.g
            key={flag.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <circle
              cx={flag.position.x}
              cy={flag.position.y}
              r={4}
              fill="#FBBF24"
              stroke="#F59E0B"
              strokeWidth={1}
            />
          </motion.g>
        ))}
      </svg>
      
      {/* 凡例 */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/40 backdrop-blur-sm rounded-lg p-2 text-xs text-gray-300">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span>始まりの島</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span>到達した島</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>未到達</span>
        </div>
      </div>
    </div>
  );
};

export default MapVisualizer;
