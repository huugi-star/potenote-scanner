'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Crown, Lock, Check } from 'lucide-react';
import { useState, useMemo } from 'react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { useGameStore } from '@/store/useGameStore';
import { RANK_TIERS } from '@/constants/rankSystem';
import { useLibraryRankSnapshot } from '@/hooks/useLibraryRankSnapshot';
import {
  EQUIPPED_SHOULDER_PRESET_IDS,
  SHOULDER_TITLE_PRESETS,
  type EquippedShoulderPresetId,
} from '@/data/shoulderTitlePresets';

type Tab = 'special' | 'rank';

const TIER_ICONS = ['📖','📚','🗂️','🏛️','👑','🌟','⚡','💎','🔮','✨'];

// ACカラーパレット
const AC = {
  sky:    '#b8e4f7',
  green:  '#6cbf72',
  darkGreen: '#3d8c44',
  cream:  '#fef9ee',
  tan:    '#f0e6c8',
  brown:  '#8b5e3c',
  sand:   '#e8d5a3',
  leaf:   '#8dc63f',
  yellow: '#ffd966',
  pink:   '#ffb3c6',
  teal:   '#7dd4c0',
  text:   '#4a3728',
  muted:  '#9b7f6e',
};

const DECORATION_LEAVES = [
  { emoji: '🍃', top: '6%',  left: '4%',  size: 22, rotate: -25, delay: 0 },
  { emoji: '🌿', top: '12%', right: '5%', size: 20, rotate: 18,  delay: 0.3 },
  { emoji: '🍀', top: '3%',  left: '42%', size: 18, rotate: 5,   delay: 0.6 },
  { emoji: '🌸', top: '18%', left: '8%',  size: 16, rotate: -10, delay: 0.9 },
  { emoji: '⭐', top: '8%',  right: '22%',size: 14, rotate: 15,  delay: 0.4 },
];

type LibraryTitleSelectScreenProps = {
  onBack: () => void;
};

export function LibraryTitleSelectScreen({ onBack }: LibraryTitleSelectScreenProps) {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('special');

  const equipped          = useGameStore((s) => s.equippedLibraryTitleTierIndex);
  const setEquipped       = useGameStore((s) => s.setEquippedLibraryTitleTierIndex);
  const equippedPreset    = useGameStore((s) => s.equippedShoulderPresetId);
  const setEquippedPreset = useGameStore((s) => s.setEquippedShoulderPresetId);
  const isVIP             = useGameStore((s) => s.isVIP);
  const libraryRank       = useLibraryRankSnapshot();
  const unlockedMax       = libraryRank.tierIndex;

  const clampEquipped = equipped != null ? Math.min(equipped, unlockedMax) : null;

  const isRankSelected = (i: number) => {
    if (equippedPreset != null) return false;
    return clampEquipped === null ? i === unlockedMax : clampEquipped === i;
  };

  // 現在装備中の称号テキストを取得
  const currentTitleText = useMemo(() => {
    if (equippedPreset != null) {
      return SHOULDER_TITLE_PRESETS[equippedPreset]?.label ?? '';
    }
    const idx = clampEquipped ?? unlockedMax;
    return RANK_TIERS[idx]?.name ?? '';
  }, [equippedPreset, clampEquipped, unlockedMax]);

  const currentTitleGlow = useMemo(() => {
    if (equippedPreset != null) {
      return SHOULDER_TITLE_PRESETS[equippedPreset]?.glow ?? AC.yellow;
    }
    const idx = clampEquipped ?? unlockedMax;
    return RANK_TIERS[idx]?.glow ?? AC.yellow;
  }, [equippedPreset, clampEquipped, unlockedMax]);

  const selectPreset = (id: EquippedShoulderPresetId) => {
    vibrateSuccess();
    setEquippedPreset(id);
    addToast('success', '称号を設定しました！');
    onBack();
  };

  const selectTier = (i: number) => {
    if (i > unlockedMax) return;
    vibrateSuccess();
    setEquipped(i);
    addToast('success', '称号を設定しました！');
    onBack();
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: `linear-gradient(180deg, ${AC.sky} 0%, #daf0e8 30%, ${AC.cream} 60%, ${AC.tan} 100%)`,
      color: AC.text,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ─── 背景装飾（葉っぱ・星） ─── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {DECORATION_LEAVES.map((d, i) => (
          <motion.span key={i}
            style={{
              position: 'absolute',
              fontSize: d.size,
              top: d.top,
              left: 'left' in d ? d.left : undefined,
              right: 'right' in d ? d.right : undefined,
              rotate: d.rotate,
              opacity: 0.45,
            }}
            animate={{ y: [0, -5, 0], rotate: [d.rotate, d.rotate + 8, d.rotate] }}
            transition={{ duration: 3.5 + i * 0.4, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
          >
            {d.emoji}
          </motion.span>
        ))}
        {/* 草ライン */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 48,
          background: `linear-gradient(180deg, transparent 0%, ${AC.leaf}22 100%)`,
        }} />
      </div>

      {/* ─── ヘッダー ─── */}
      <header style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(8px)',
        borderBottom: `3px solid ${AC.darkGreen}`,
        boxShadow: `0 3px 0 ${AC.leaf}55`,
      }}>
        <motion.button
          type="button"
          onClick={() => { vibrateLight(); onBack(); }}
          whileTap={{ scale: 0.9 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 12px 5px 8px', borderRadius: 99,
            background: AC.green, color: '#fff',
            border: `2px solid ${AC.darkGreen}`,
            boxShadow: `0 3px 0 ${AC.darkGreen}`,
            fontSize: 13, fontWeight: 900, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
          もどる
        </motion.button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: AC.darkGreen, lineHeight: 1 }}>
            ✦ しょうごうせんたく ✦
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: AC.text, margin: 0, letterSpacing: '0.04em' }}>
            称号を選ぶ
          </h1>
        </div>

        {isVIP ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 900,
            padding: '4px 10px', borderRadius: 99,
            background: AC.yellow, color: AC.brown,
            border: `2px solid ${AC.brown}`,
            boxShadow: `0 2px 0 ${AC.brown}`,
          }}>
            <Crown style={{ width: 12, height: 12 }} />VIP
          </span>
        ) : (
          <div style={{ width: 52 }} />
        )}
      </header>

      {/* ─── 現在の称号プレビュー ─── */}
      <motion.div
        style={{
          position: 'relative', zIndex: 10,
          margin: '12px 16px 0',
          padding: '10px 16px',
          borderRadius: 18,
          background: 'rgba(255,255,255,0.75)',
          border: `2px solid ${AC.sand}`,
          boxShadow: `0 3px 0 ${AC.brown}44`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <span style={{ fontSize: 24 }}>🏷️</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, color: AC.muted, letterSpacing: '0.15em' }}>いまのしょうごう</div>
          <div style={{
            fontSize: 17, fontWeight: 900, color: AC.text,
            textShadow: `0 0 12px ${currentTitleGlow}88`,
          }}>
            {currentTitleText}
          </div>
        </div>
        <motion.span
          style={{ marginLeft: 'auto', fontSize: 18 }}
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >✨</motion.span>
      </motion.div>

      {/* ─── タブ ─── */}
      <div style={{ position: 'relative', zIndex: 10, padding: '12px 16px 0' }}>
        <div style={{
          display: 'flex', gap: 8,
          background: 'rgba(255,255,255,0.5)',
          borderRadius: 99,
          padding: 4,
          border: `2px solid ${AC.sand}`,
        }}>
          {(['special', 'rank'] as Tab[]).map((t) => (
            <button key={t} type="button"
              onClick={() => { vibrateLight(); setTab(t); }}
              style={{
                flex: 1, position: 'relative',
                padding: '9px 0',
                borderRadius: 99,
                border: 'none',
                background: tab === t ? AC.green : 'transparent',
                boxShadow: tab === t ? `0 3px 0 ${AC.darkGreen}` : 'none',
                color: tab === t ? '#fff' : AC.muted,
                fontSize: 13, fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {t === 'special' ? '✦ 特別称号' : '⚔ 図書館ランク'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── コンテンツ ─── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 16px 80px',
        position: 'relative', zIndex: 10,
      }}>
        <AnimatePresence mode="wait">

          {/* SPECIAL TAB */}
          {tab === 'special' && (
            <motion.div key="special"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}
            >
              {/* 自動設定 */}
              <AcCard
                emoji="🔄" label="じどうせってい"
                sub="現在のランクを自動で表示"
                selected={equippedPreset === null && equipped === null}
                color={AC.teal}
                onSelect={() => {
                  vibrateSuccess();
                  setEquippedPreset(null);
                  setEquipped(null);
                  addToast('success', '自動設定に戻しました！');
                  onBack();
                }}
              />
              <SectionDivider label="とくべつしょうごう" emoji="🌟" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {EQUIPPED_SHOULDER_PRESET_IDS.map((id) => {
                  const cfg = SHOULDER_TITLE_PRESETS[id];
                  return (
                    <AcCardSquare
                      key={id}
                      emoji={id === 'suhimochi_master' ? '🐾' : '🌱'}
                      label={cfg.label}
                      selected={equippedPreset === id}
                      glow={cfg.glow}
                      onSelect={() => selectPreset(id)}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* RANK TAB */}
          {tab === 'rank' && (
            <motion.div key="rank"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
            >
              <SectionDivider label="かいほうずみ" emoji="🔓" />
              {/* 解放済み */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {RANK_TIERS.slice(0, unlockedMax + 1).map((tier, i) => (
                  <AcCardSquare
                    key={tier.name}
                    emoji={TIER_ICONS[i] ?? '⚔️'}
                    label={tier.name}
                    selected={isRankSelected(i)}
                    glow={tier.glow}
                    isCurrent={i === unlockedMax}
                    onSelect={() => selectTier(i)}
                  />
                ))}
              </div>

              {/* ロック中 */}
              {unlockedMax < RANK_TIERS.length - 1 && (
                <>
                  <SectionDivider label="まだひらいていない" emoji="🔒" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {RANK_TIERS.slice(unlockedMax + 1).map((tier, j) => {
                      const i = unlockedMax + 1 + j;
                      return (
                        <AcCardSquare
                          key={tier.name}
                          emoji="🔒"
                          label={tier.name}
                          selected={false}
                          locked
                          glow={tier.glow}
                          lockedSub={`あと${i - unlockedMax}ランク`}
                          onSelect={() => {}}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   横長カード（自動設定など1列用）
────────────────────────────────────────────────────── */
function AcCard({
  emoji, label, sub, selected, color = AC.green, onSelect,
}: {
  emoji: string; label: string; sub: string;
  selected: boolean; color?: string; onSelect: () => void;
}) {
  return (
    <motion.button type="button" onClick={onSelect}
      whileTap={{ scale: 0.96 }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 16, marginBottom: 10,
        background: selected ? `${color}22` : 'rgba(255,255,255,0.72)',
        border: `3px solid ${selected ? color : AC.sand}`,
        boxShadow: selected
          ? `0 4px 0 ${color}66, 0 6px 14px ${color}33`
          : `0 3px 0 ${AC.sand}`,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: selected ? `${color}30` : AC.tan,
        border: `2px solid ${selected ? color : AC.sand}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: AC.text }}>{label}</div>
        <div style={{ fontSize: 11, color: AC.muted, marginTop: 1 }}>{sub}</div>
      </div>
      {selected ? (
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: color,
            border: `2px solid #fff`,
            boxShadow: `0 2px 0 ${color}88`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Check style={{ width: 14, height: 14, color: '#fff' }} strokeWidth={3} />
        </motion.div>
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${AC.sand}`,
          background: AC.cream,
        }} />
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────
   正方形カード（グリッド用）
────────────────────────────────────────────────────── */
function AcCardSquare({
  emoji, label, selected, locked = false, glow = AC.yellow,
  isCurrent = false, lockedSub, onSelect,
}: {
  emoji: string; label: string;
  selected: boolean; locked?: boolean;
  glow?: string; isCurrent?: boolean;
  lockedSub?: string; onSelect: () => void;
}) {
  const borderColor = locked ? AC.sand : selected ? glow : AC.sand;
  const bg = locked
    ? 'rgba(255,255,255,0.4)'
    : selected
      ? `linear-gradient(135deg, ${glow}28 0%, rgba(255,255,255,0.82) 100%)`
      : 'rgba(255,255,255,0.75)';

  return (
    <motion.button
      type="button"
      disabled={locked}
      onClick={onSelect}
      whileTap={locked ? {} : { scale: 0.93 }}
      style={{
        position: 'relative',
        padding: '14px 10px 12px',
        borderRadius: 20,
        background: bg,
        border: `3px solid ${borderColor}`,
        boxShadow: locked
          ? `0 2px 0 ${AC.sand}`
          : selected
            ? `0 5px 0 ${glow}77, 0 8px 16px ${glow}33`
            : `0 4px 0 ${AC.sand}`,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.55 : 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        WebkitTapHighlightColor: 'transparent',
        transition: 'box-shadow 0.12s, border-color 0.12s',
      }}
    >
      {/* 選択スタンプ */}
      {selected && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: -12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{
            position: 'absolute', top: -10, right: -8,
            width: 32, height: 32, borderRadius: '50%',
            background: glow,
            border: '3px solid #fff',
            boxShadow: `0 2px 8px ${glow}88`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Check style={{ width: 14, height: 14, color: '#fff' }} strokeWidth={3} />
        </motion.div>
      )}

      {/* いまのランクリボン */}
      {isCurrent && !selected && (
        <div style={{
          position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
          background: AC.green, color: '#fff',
          fontSize: 9, fontWeight: 900,
          padding: '2px 10px', borderRadius: 99,
          border: `2px solid ${AC.darkGreen}`,
          boxShadow: `0 2px 0 ${AC.darkGreen}`,
          whiteSpace: 'nowrap',
        }}>いまのランク</div>
      )}

      {/* アイコン */}
      <motion.div
        style={{
          width: 54, height: 54, borderRadius: 16, flexShrink: 0,
          background: locked
            ? AC.tan
            : selected
              ? `${glow}30`
              : AC.tan,
          border: `2px solid ${locked ? AC.sand : selected ? glow : AC.sand}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
          boxShadow: selected ? `0 0 12px ${glow}55` : 'none',
        }}
        animate={selected ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {emoji}
      </motion.div>

      {/* ラベル */}
      <div style={{
        fontSize: 13, fontWeight: 900,
        color: locked ? AC.muted : selected ? AC.text : AC.text,
        textAlign: 'center', lineHeight: 1.3,
        textShadow: selected ? `0 0 8px ${glow}66` : 'none',
      }}>
        {label}
      </div>

      {/* サブテキスト */}
      {lockedSub && locked && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: AC.muted,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Lock style={{ width: 10, height: 10 }} />
          {lockedSub}
        </div>
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────
   セクション区切り
────────────────────────────────────────────────────── */
function SectionDivider({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '8px 0 10px',
    }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{
        fontSize: 10, fontWeight: 900, letterSpacing: '0.18em',
        color: AC.darkGreen,
        textTransform: 'uppercase' as const,
      }}>{label}</span>
      <div style={{
        flex: 1, height: 2, borderRadius: 99,
        background: `linear-gradient(90deg, ${AC.leaf}55, transparent)`,
      }} />
    </div>
  );
}