'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, Crown, Lock, Sparkles } from 'lucide-react';
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

type LibraryTitleSelectScreenProps = {
  onBack: () => void;
};

export function LibraryTitleSelectScreen({ onBack }: LibraryTitleSelectScreenProps) {
  const { addToast } = useToast();
  const equipped = useGameStore((s) => s.equippedLibraryTitleTierIndex);
  const setEquipped = useGameStore((s) => s.setEquippedLibraryTitleTierIndex);
  const equippedPreset = useGameStore((s) => s.equippedShoulderPresetId);
  const setEquippedPreset = useGameStore((s) => s.setEquippedShoulderPresetId);
  const isVIP = useGameStore((s) => s.isVIP);
  const libraryRank = useLibraryRankSnapshot();
  const unlockedMax = libraryRank.tierIndex;

  const presetActive = equippedPreset != null;
  const clampEquipped = equipped != null ? Math.min(equipped, unlockedMax) : null;

  const isRowSelected = (i: number, locked: boolean) => {
    if (locked || presetActive) return false;
    if (clampEquipped === null) return i === unlockedMax;
    return clampEquipped === i;
  };

  const selectPreset = (id: EquippedShoulderPresetId) => {
    vibrateSuccess();
    setEquippedPreset(id);
    addToast('success', '称号を設定しました');
    onBack();
  };

  const selectTier = (i: number) => {
    if (i > unlockedMax) return;
    vibrateSuccess();
    /** 現在の最高ティア行も含めて常にインデックスを保存（null に戻すと反映しない／級表示に戻る誤解の原因になる） */
    setEquipped(i);
    addToast('success', '称号を設定しました');
    onBack();
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-950 text-white pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-gray-900/95 backdrop-blur border-b border-amber-500/15">
        <button
          type="button"
          onClick={() => {
            vibrateLight();
            onBack();
          }}
          className="flex items-center gap-1 text-amber-200/90 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          戻る
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-amber-100 flex items-center gap-2 truncate">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            称号を選ぶ
          </h1>
          <p className="text-[10px] text-amber-200/50 truncate">特別な肩書きまたは図書館ランクをホーム上部に表示（級は出しません）</p>
        </div>
        {isVIP && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-yellow-200 bg-yellow-500/15 px-2 py-1 rounded-lg border border-yellow-500/30">
            <Crown className="w-3 h-3" />
            VIP
          </span>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-3">
        <button
          type="button"
          onClick={() => {
            vibrateLight();
            setEquippedPreset(null);
            setEquipped(null);
            addToast('success', '進行ランクに合わせました');
            onBack();
          }}
          className="w-full py-3 rounded-xl border border-amber-400/35 bg-amber-500/10 text-amber-100 text-sm font-bold hover:bg-amber-500/15 transition-colors"
        >
          進行ランクに合わせる（おすすめの肩書き）
        </button>

        <p className="text-xs font-bold text-gray-400 px-1 pt-1">特別な肩書き</p>
        <ul className="space-y-2">
          {EQUIPPED_SHOULDER_PRESET_IDS.map((id) => {
            const cfg = SHOULDER_TITLE_PRESETS[id];
            const selected = equippedPreset === id;
            return (
              <li key={id}>
                <motion.button
                  type="button"
                  onClick={() => selectPreset(id)}
                  className={`w-full text-left rounded-2xl border px-4 py-4 flex items-center gap-3 transition-colors ${
                    selected
                      ? 'bg-gradient-to-r from-gray-900/90 to-gray-800/70'
                      : 'border-gray-600/70 bg-gray-800/35 hover:bg-gray-800/60 cursor-pointer active:scale-[0.99]'
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: `${cfg.glow}aa`,
                          boxShadow: `0 0 0 2px ${cfg.glow}55, inset 0 1px 0 ${cfg.light}33`,
                        }
                      : { borderColor: 'rgba(75,85,99,0.55)' }
                  }
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${cfg.glow}99, ${cfg.glow}33)`,
                      boxShadow: `0 0 16px ${cfg.glow}44`,
                    }}
                  >
                    {id === 'suhimochi_master' ? '💬' : '🌱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[15px] tracking-tight text-white">{cfg.label}</span>
                      {selected && (
                        <span className="text-[10px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full">
                          装備中
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">いつでも選べます</p>
                  </div>
                  <Sparkles className="w-5 h-5 shrink-0 text-amber-200/70" />
                </motion.button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs font-bold text-gray-400 px-1 pt-3">図書館ランク</p>
        <p className="text-xs text-gray-500 px-1 pb-1">
          ランクアップで次の称号が選べるようになります。
        </p>

        <ul className="space-y-2 pb-8">
          {RANK_TIERS.map((tier, i) => {
            const locked = i > unlockedMax;
            const selected = isRowSelected(i, locked);
            return (
              <li key={tier.name}>
                <motion.button
                  type="button"
                  disabled={locked}
                  onClick={() => selectTier(i)}
                  className={`w-full text-left rounded-2xl border px-4 py-4 flex items-center gap-3 transition-colors ${
                    locked
                      ? 'border-gray-700/80 bg-gray-900/40 opacity-55 cursor-not-allowed'
                      : selected
                        ? 'bg-gradient-to-r from-gray-900/90 to-gray-800/70'
                        : 'border-gray-600/70 bg-gray-800/35 hover:bg-gray-800/60 cursor-pointer active:scale-[0.99]'
                  }`}
                  style={
                    selected && !locked
                      ? {
                          borderColor: `${tier.glow}aa`,
                          boxShadow: `0 0 0 2px ${tier.glow}55, inset 0 1px 0 ${tier.light}33`,
                        }
                      : !selected && !locked
                        ? { borderColor: 'rgba(75,85,99,0.55)' }
                        : undefined
                  }
                  whileHover={locked ? {} : { scale: 1.01 }}
                  whileTap={locked ? {} : { scale: 0.99 }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${tier.color}aa, ${tier.color}33)`,
                      boxShadow: `0 0 16px ${tier.glow}44`,
                    }}
                  >
                    {locked ? <Lock className="w-5 h-5 text-gray-400" /> : '⚔️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-[15px] tracking-tight" style={{ color: tier.light }}>
                        {tier.name}
                      </span>
                      {locked && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">未獲得</span>
                      )}
                      {!locked && clampEquipped === null && i === unlockedMax && (
                        <span className="text-[10px] font-bold text-cyan-300/95 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-400/35">
                          進行中表示
                        </span>
                      )}
                      {selected && !locked && (
                        <span className="text-[10px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full">
                          装備中
                        </span>
                      )}
                    </div>
                    {!locked && i < unlockedMax && (
                      <p className="text-[11px] text-gray-500 mt-1">過去ランクとして表示できます</p>
                    )}
                  </div>
                  {!locked && <Sparkles className="w-5 h-5 shrink-0 text-amber-200/70" />}
                </motion.button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
