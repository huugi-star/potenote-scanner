/**
 * Confetti Utilities
 * 
 * canvas-confettiを使用した紙吹雪エフェクト
 */

import confetti from 'canvas-confetti';

/**
 * SSRガチャ排出時の豪華な紙吹雪
 */
export const confettiSSR = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  const colors = ['#FFD700', '#FFA500', '#FF6347', '#FFE4B5'];

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  // 中央から大きな爆発
  setTimeout(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
    });
  }, 500);
};

/**
 * クイズ満点時の紙吹雪
 */
export const confettiPerfect = () => {
  const colors = ['#22D3EE', '#A855F7', '#10B981', '#F59E0B'];

  // 左右から
  confetti({
    particleCount: 80,
    angle: 60,
    spread: 70,
    origin: { x: 0, y: 0.7 },
    colors,
  });
  confetti({
    particleCount: 80,
    angle: 120,
    spread: 70,
    origin: { x: 1, y: 0.7 },
    colors,
  });

  // 少し遅れて中央から
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.6 },
      colors,
    });
  }, 300);
};

/**
 * 島クリア時の特別な紙吹雪
 */
export const confettiIslandClear = () => {
  const duration = 4000;
  const end = Date.now() + duration;

  const colors = ['#22D3EE', '#06B6D4', '#0891B2', '#0E7490', '#FFD700'];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.5 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.5 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

/**
 * シンプルな紙吹雪
 */
export const confettiSimple = (options?: confetti.Options) => {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    ...options,
  });
};

