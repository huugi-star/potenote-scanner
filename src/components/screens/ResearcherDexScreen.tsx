/**
 * ResearcherDexScreen.tsx
 * 研究員図鑑画面
 * 研究員番号順（参加順）でカード一覧表示
 */

import { motion } from 'framer-motion';
import { ChevronLeft, Users } from 'lucide-react';
import { RESEARCHERS, formatResearcherNumber, RANK_CONFIG } from '@/data/researchers';
import type { ResearcherRank } from '@/data/researchers';
import { vibrateLight } from '@/lib/haptics';

interface ResearcherDexScreenProps {
  onBack: () => void;
}

export const ResearcherDexScreen = ({ onBack }: ResearcherDexScreenProps) => {
  // 研究員番号順（昇順）で表示
  const sorted = [...RESEARCHERS].sort((a, b) => a.number - b.number);

  return (
    <div className="min-h-screen bg-gray-900 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between py-4 mb-4">
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            研究員図鑑
          </h1>
          <div className="w-16" />
        </div>

        {/* カード一覧 */}
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>登録されている研究員はいません</p>
            </div>
          ) : (
            sorted.map((r, index) => {
              const rankConfig = RANK_CONFIG[r.rank as ResearcherRank] ?? RANK_CONFIG['研究員見習い'];
              return (
                <motion.div
                  key={r.number}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 shadow-lg flex gap-4"
                >
                  {/* 左：研究員 + 番号を強調 */}
                  <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-amber-400/80 text-xs font-semibold">研究員</span>
                    <span className="font-mono text-xl font-bold text-amber-400/90">
                      {formatResearcherNumber(r.number)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg truncate">{r.name}</p>
                    <p className={`text-sm font-medium mt-1 ${rankConfig.className}`}>
                      {rankConfig.icon} {r.rank}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">
                      <span className="text-gray-500">研究分野：</span>
                      {r.field}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      参加日：{r.joinedAt}
                    </p>
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
