/**
 * Haptics & Sound Utilities
 * 
 * バイブレーションとサウンドエフェクト
 */

/**
 * バイブレーションを実行（対応ブラウザのみ）
 */
export const vibrate = (pattern: number | number[] = 50): boolean => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * ボタンタップ時の軽いバイブレーション
 */
export const vibrateLight = () => vibrate(30);

/**
 * 正解時のバイブレーション
 */
export const vibrateSuccess = () => vibrate([50, 30, 50]);

/**
 * 不正解時のバイブレーション
 */
export const vibrateError = () => vibrate([100, 50, 100]);

/**
 * ガチャ排出時のバイブレーション
 */
export const vibrateGacha = (rarity: 'N' | 'R' | 'SR' | 'SSR') => {
  switch (rarity) {
    case 'SSR':
      return vibrate([50, 30, 50, 30, 100, 50, 150]);
    case 'SR':
      return vibrate([50, 30, 50, 30, 100]);
    case 'R':
      return vibrate([50, 30, 50]);
    default:
      return vibrate(50);
  }
};

/**
 * パーフェクト時のバイブレーション
 */
export const vibratePerfect = () => vibrate([50, 50, 50, 50, 100, 100, 150]);

