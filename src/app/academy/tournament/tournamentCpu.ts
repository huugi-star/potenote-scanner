import { ALL_ITEMS } from '@/data/items';
import { CPU_NAME_CANDIDATES } from './tournamentConstants';
import type { CpuPlayer, CpuStatus, EquippedSet } from './tournamentTypes';

function pickOne<T>(items: T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}

function randomIntBelow(max: number): number {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = 0x100000000 - (0x100000000 % max);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Fisher-Yates（CPU・問題用にモジュール外から利用） */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomIntBelow(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { randomIntBelow };

export function randomCpuEquipment(): EquippedSet {
  const items = ALL_ITEMS.filter((i) => i.type === 'equipment' && !!i.category && !i.gachaExcluded);
  return {
    head:      pickOne(items.filter((i) => i.category === 'head')),
    body:      pickOne(items.filter((i) => i.category === 'body')),
    face:      pickOne(items.filter((i) => i.category === 'face')),
    accessory: pickOne(items.filter((i) => i.category === 'accessory')),
  };
}

export function createCpuPlayers(): CpuPlayer[] {
  return shuffle(CPU_NAME_CANDIDATES).slice(0, 4).map((name, i) => ({
    id: `cpu-${i + 1}`,
    name,
    accuracy: Number((0.5 + Math.random() * 0.25).toFixed(2)),
    score: 0,
    status: 'thinking' as CpuStatus,
    equipped: randomCpuEquipment(),
    correctCount: 0,
    answerTimesMs: [],
    pending: null,
  }));
}
