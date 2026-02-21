/**
 * ScanCard.tsx
 *
 * 冒険ログ用のスキャンカード
 * 今回の冒険（最大21体）の進行のみ表示。累計発見は表示しない。
 */

import { memo } from 'react';
import { Sword } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';

export interface ScanCardData {
  id: string;
  title: string;
  capturedInActive: number;
  defeatedInActive?: number;
  remainingInActive: number;
  activeTotal: number; // 今回の冒険の総数（最大21、既存データは全単語数）
}

interface ScanCardProps {
  data: ScanCardData;
  onExplore: (id: string) => void;
  onRetry: (id: string) => void;
}

/** capturedInActive/activeTotal を5段階の星に変換（0〜5） */
const getStarLevel = (captured: number, total: number): number => {
  if (total <= 0) return 0;
  if (captured >= total) return 5;
  return Math.floor((captured / total) * 5);
};

/** 進行状態を判定 */
const getProgressStatus = (
  capturedInActive: number,
  defeatedInActive: number,
  activeTotal: number
): { text: string; className: string } => {
  // 未着手: 捕獲も撃破もない場合
  if (capturedInActive === 0 && defeatedInActive === 0) {
    return {
      text: '未着手',
      className: 'bg-gray-700/50 text-gray-400 border-gray-600/50',
    };
  } else if (capturedInActive < activeTotal) {
    return {
      text: '進行中',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/10',
    };
  } else {
    return {
      text: '踏破',
      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10',
    };
  }
};

export const ScanCard = memo(({ data, onExplore, onRetry }: ScanCardProps) => {
  const { capturedInActive, defeatedInActive = 0, remainingInActive, activeTotal } = data;
  const starLevel = getStarLevel(capturedInActive, activeTotal);
  const status = getProgressStatus(capturedInActive, defeatedInActive, activeTotal);
  const isComplete = capturedInActive >= activeTotal && activeTotal > 0;

  return (
    <div className="rounded-2xl border border-gray-600/80 bg-gradient-to-b from-gray-800/90 to-gray-900/90 shadow-lg shadow-amber-500/5 p-5 space-y-4">
      {/* 上段：タイトル行 */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <Sword className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
          <h3 className="font-bold text-white text-base leading-tight flex-1">{data.title}</h3>
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
            {status.text}
          </span>
        </div>
      </div>

      {/* 中段：今回の冒険ステータス（累計発見は表示しない） */}
      <div>
        <p className="text-[10px] text-gray-500 mb-2">今回の冒険</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-400">
            捕獲 <span className="text-emerald-400/90 font-medium">{capturedInActive}</span> / {activeTotal}
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">
            撃破 <span className="text-white font-medium">{defeatedInActive}</span>
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">
            残り <span className="text-orange-400/90 font-medium">{remainingInActive}体</span>
          </span>
        </div>

        {/* 進行度の星 */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">進行：</span>
          <span
            className={`text-sm tracking-wider ${
              isComplete
                ? 'text-amber-400/90 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]'
                : 'text-blue-400/80'
            }`}
          >
            {'★'.repeat(starLevel)}
            <span className="text-gray-600">{'☆'.repeat(5 - starLevel)}</span>
          </span>
        </div>
      </div>

      {/* 安心の一文 */}
      <p className="text-[10px] text-gray-500">
        冒険の分母は開始時に固定されます
      </p>

      {/* 下段：アクションボタン */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={() => {
            vibrateLight();
            onExplore(data.id);
          }}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-sm shadow-md shadow-amber-500/20"
        >
          続きを探索する
        </button>
        {!isComplete && (
          <button
            onClick={() => {
              vibrateLight();
              onRetry(data.id);
            }}
            className="w-full py-2.5 rounded-xl border border-gray-600 text-gray-400 font-medium text-sm hover:bg-gray-700/40 hover:text-gray-300 transition-colors"
          >
            再戦する
          </button>
        )}
      </div>
    </div>
  );
});

ScanCard.displayName = 'ScanCard';
