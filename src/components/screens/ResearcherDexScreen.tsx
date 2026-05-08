/**
 * ResearcherDexScreen.tsx
 * 研究員図鑑画面（どうぶつの森風・ホームと同一トーン）
 */

import { motion } from 'framer-motion';
import { ChevronLeft, Users } from 'lucide-react';
import { RESEARCHERS, formatResearcherNumber, RANK_CONFIG } from '@/data/researchers';
import type { ResearcherRank } from '@/data/researchers';
import { vibrateLight } from '@/lib/haptics';
import { AC, AcnhOutdoorDecor, ACNH_FONT_FAMILY, acnhPageShellStyle } from '@/lib/acnhTheme';

interface ResearcherDexScreenProps {
  onBack: () => void;
}

/** 明るい背景用の階級ラベル色（Tailwind の dark 向け class は使わない） */
const RANK_LABEL_COLOR: Record<ResearcherRank, string> = {
  '研究員見習い': AC.textLt,
  '研究員': '#3A78B8',
  '上級研究員': '#8B5BB8',
  '特別顧問': '#B07820',
  '開発者': '#2D734F',
};

export const ResearcherDexScreen = ({ onBack }: ResearcherDexScreenProps) => {
  const sorted = [...RESEARCHERS].sort((a, b) => a.number - b.number);

  return (
    <div style={acnhPageShellStyle()}>
      <AcnhOutdoorDecor compact={false} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          minHeight: 0,
          padding:
            'max(10px, env(safe-area-inset-top, 0px)) 14px max(24px, calc(16px + env(safe-area-inset-bottom, 0px)))',
          maxWidth: 480,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          fontFamily: ACNH_FONT_FAMILY,
        }}
      >
        {/* 看板風ヘッダー */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 56,
              marginBottom: -4,
              position: 'relative',
              zIndex: 0,
            }}
          >
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 18,
                  borderRadius: '0 0 4px 4px',
                  background: `linear-gradient(180deg, ${AC.brownDk} 0%, ${AC.brown} 100%)`,
                  boxShadow: '2px 0 0 rgba(0,0,0,0.15)',
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'linear-gradient(180deg, #FFF9EC 0%, #F5E8C8 100%)',
              borderRadius: 16,
              border: `3px solid ${AC.brown}`,
              boxShadow: `0 5px 0 ${AC.brownDk}, 0 8px 20px rgba(0,0,0,0.12)`,
              padding: '10px 12px',
              minHeight: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => {
                vibrateLight();
                onBack();
              }}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                color: AC.textDk,
                background: AC.white,
                border: `2.5px solid ${AC.brown}44`,
                boxShadow: `0 3px 0 ${AC.brown}33, 0 4px 10px rgba(0,0,0,0.08)`,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <ChevronLeft style={{ width: 18, height: 18 }} />
              戻る
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0, paddingLeft: 88, paddingRight: 88 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #E07850 0%, #F5A07A 100%)',
                  border: `2px solid #B04820`,
                  boxShadow: '0 3px 0 #B0482088',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Users style={{ width: 20, height: 20, color: '#fff', strokeWidth: 2.5 }} />
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  color: AC.textDk,
                  textShadow: '0 1px 0 rgba(255,255,255,0.8)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                研究員図鑑
              </h1>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                textAlign: 'center',
                padding: '36px 20px',
                background: 'linear-gradient(135deg, #FDFFF5 0%, #F0FAF0 100%)',
                borderRadius: 20,
                border: `3px solid ${AC.grassDk}`,
                boxShadow: `0 5px 0 ${AC.grassDk}88, 0 8px 20px rgba(0,0,0,0.08)`,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>📖</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: AC.textMd }}>
                登録されている研究員はいません
              </p>
            </motion.div>
          ) : (
            sorted.map((r, index) => {
              const rankConfig = RANK_CONFIG[r.rank as ResearcherRank] ?? RANK_CONFIG['研究員見習い'];
              const rankColor = RANK_LABEL_COLOR[r.rank as ResearcherRank] ?? AC.textMd;
              return (
                <motion.div
                  key={r.number}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  style={{
                    borderRadius: 20,
                    border: `3px solid ${AC.grassDk}`,
                    boxShadow: `0 5px 0 ${AC.grassDk}88, 0 8px 20px rgba(0,0,0,0.08)`,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #FDFFF5 0%, #F0FAF0 100%)',
                  }}
                >
                  <div
                    style={{
                      background: `linear-gradient(90deg, ${AC.grass} 0%, ${AC.mint} 100%)`,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>🔬</span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: '#2A5A3A',
                        letterSpacing: '0.04em',
                      }}
                    >
                      研究員情報
                    </span>
                  </div>
                  <div style={{ padding: 14, display: 'flex', gap: 14 }}>
                    <div
                      style={{
                        flexShrink: 0,
                        width: 64,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        background: 'linear-gradient(180deg, #FFF8E8 0%, #FFEFD4 100%)',
                        borderRadius: 14,
                        border: `2px solid ${AC.yellowDk}55`,
                        boxShadow: `0 2px 0 ${AC.yellowDk}44`,
                        padding: '10px 6px',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 900, color: AC.textMd, letterSpacing: '0.06em' }}>
                        研究員
                      </span>
                      <span
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 17,
                          fontWeight: 900,
                          color: '#6A4800',
                        }}
                      >
                        {formatResearcherNumber(r.number)}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 18,
                          fontWeight: 900,
                          color: AC.textDk,
                          textShadow: '0 1px 0 rgba(255,255,255,0.7)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.name}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 800, color: rankColor }}>
                        {rankConfig.icon} {r.rank}
                      </p>
                      <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: AC.textMd, lineHeight: 1.5 }}>
                        <span style={{ color: AC.textLt, fontWeight: 800 }}>研究分野：</span>
                        {r.field}
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: AC.textLt }}>
                        参加日：{r.joinedAt}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
