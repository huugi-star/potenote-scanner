/**
 * 図書館ランク以外から選べる肩書きプリセット
 */

export const EQUIPPED_SHOULDER_PRESET_IDS = ['beginner', 'suhimochi_master'] as const;
export type EquippedShoulderPresetId = (typeof EQUIPPED_SHOULDER_PRESET_IDS)[number];

export const SHOULDER_TITLE_PRESETS: Record<
  EquippedShoulderPresetId,
  { label: string; glow: string; light: string }
> = {
  beginner: {
    label: '初心者',
    glow: '#94a3b8',
    light: '#e2e8f0',
  },
  suhimochi_master: {
    label: 'すうひもちのマスター',
    glow: '#ec4899',
    light: '#fbcfe8',
  },
};

export function isEquippedShoulderPresetId(v: unknown): v is EquippedShoulderPresetId {
  return typeof v === 'string' && (EQUIPPED_SHOULDER_PRESET_IDS as readonly string[]).includes(v);
}
