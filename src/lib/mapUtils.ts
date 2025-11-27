/**
 * Potenote Scanner v2 - Map Utilities
 * 
 * 黄金螺旋座標計算など、マップ関連のユーティリティ
 */

import type { Coordinate } from '@/types';
import { MAP } from '@/lib/constants';

/**
 * 黄金螺旋の角度増分
 * 黄金角 ≈ 137.5°
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399 radians

/**
 * 累計距離から黄金螺旋上の座標を計算
 * 
 * @param totalDistance - 累計移動距離 (km)
 * @returns 螺旋上の座標
 */
export const calculateSpiralPosition = (totalDistance: number): Coordinate => {
  // 距離に基づいてインデックスを計算
  // 距離が大きいほど外側に配置される
  const index = totalDistance;
  
  // 黄金螺旋の半径計算
  // r = a * θ^(1/φ) の形式（対数螺旋の変形）
  const theta = index * GOLDEN_ANGLE;
  const radius = MAP.GOLDEN_SPIRAL.INITIAL_RADIUS * Math.sqrt(index + 1);
  
  // 極座標から直交座標への変換
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  
  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
  };
};

/**
 * フィボナッチ螺旋上の座標を計算
 * より自然な分布を持つ螺旋
 * 
 * @param n - インデックス（0から始まる）
 * @param scale - スケール係数
 * @returns 螺旋上の座標
 */
export const calculateFibonacciPosition = (n: number, scale: number = 1): Coordinate => {
  const theta = n * GOLDEN_ANGLE;
  const radius = scale * Math.sqrt(n);
  
  return {
    x: Math.round(radius * Math.cos(theta) * 100) / 100,
    y: Math.round(radius * Math.sin(theta) * 100) / 100,
  };
};

/**
 * 2点間の距離を計算
 * 
 * @param p1 - 座標1
 * @param p2 - 座標2
 * @returns ユークリッド距離
 */
export const calculateDistance = (p1: Coordinate, p2: Coordinate): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 座標を正規化（0-1の範囲に）
 * 
 * @param coord - 座標
 * @param bounds - 境界 { minX, maxX, minY, maxY }
 * @returns 正規化された座標
 */
export const normalizeCoordinate = (
  coord: Coordinate,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): Coordinate => {
  return {
    x: (coord.x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (coord.y - bounds.minY) / (bounds.maxY - bounds.minY),
  };
};

/**
 * フラッグの配列から境界を計算
 * 
 * @param coordinates - 座標の配列
 * @param padding - 余白（割合）
 * @returns 境界 { minX, maxX, minY, maxY }
 */
export const calculateBounds = (
  coordinates: Coordinate[],
  padding: number = 0.1
): { minX: number; maxX: number; minY: number; maxY: number } => {
  if (coordinates.length === 0) {
    return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
  }
  
  const xs = coordinates.map(c => c.x);
  const ys = coordinates.map(c => c.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX || 100;
  const height = maxY - minY || 100;
  
  return {
    minX: minX - width * padding,
    maxX: maxX + width * padding,
    minY: minY - height * padding,
    maxY: maxY + height * padding,
  };
};

/**
 * 座標をキャンバス座標に変換
 * 
 * @param coord - 元座標
 * @param canvasWidth - キャンバス幅
 * @param canvasHeight - キャンバス高さ
 * @param bounds - 境界
 * @returns キャンバス座標
 */
export const toCanvasCoordinate = (
  coord: Coordinate,
  canvasWidth: number,
  canvasHeight: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): Coordinate => {
  const normalized = normalizeCoordinate(coord, bounds);
  
  return {
    x: normalized.x * canvasWidth,
    y: (1 - normalized.y) * canvasHeight, // Y軸は反転
  };
};

/**
 * SVGパスを生成（螺旋の軌跡用）
 * 
 * @param coordinates - 座標の配列
 * @param canvasWidth - キャンバス幅
 * @param canvasHeight - キャンバス高さ
 * @param bounds - 境界
 * @returns SVGパス文字列
 */
export const generateSpiralPath = (
  coordinates: Coordinate[],
  canvasWidth: number,
  canvasHeight: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): string => {
  if (coordinates.length === 0) {
    return '';
  }
  
  const canvasCoords = coordinates.map(c => 
    toCanvasCoordinate(c, canvasWidth, canvasHeight, bounds)
  );
  
  if (canvasCoords.length === 1) {
    return `M ${canvasCoords[0].x} ${canvasCoords[0].y}`;
  }
  
  // スムーズな曲線を描くためのベジェ曲線パス
  let path = `M ${canvasCoords[0].x} ${canvasCoords[0].y}`;
  
  for (let i = 1; i < canvasCoords.length; i++) {
    const current = canvasCoords[i];
    const prev = canvasCoords[i - 1];
    
    // 二次ベジェ曲線の制御点を計算
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    
    path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  
  // 最後の点まで線を引く
  const last = canvasCoords[canvasCoords.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
};

/**
 * アニメーション用のイージング関数
 */
export const easing = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
};

/**
 * 螺旋アニメーション用のステップ座標を生成
 * 
 * @param startDistance - 開始距離
 * @param endDistance - 終了距離
 * @param steps - ステップ数
 * @returns 座標の配列
 */
export const generateAnimationSteps = (
  startDistance: number,
  endDistance: number,
  steps: number = 60
): Coordinate[] => {
  const coordinates: Coordinate[] = [];
  
  for (let i = 0; i <= steps; i++) {
    const t = easing.easeOut(i / steps);
    const distance = startDistance + (endDistance - startDistance) * t;
    coordinates.push(calculateSpiralPosition(distance));
  }
  
  return coordinates;
};

