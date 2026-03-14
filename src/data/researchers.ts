/**
 * 研究員図鑑用データ
 * 研究員番号は参加順（No.001〜）。昇格しても変更しない。
 */

export type ResearcherRank =
  | '研究員見習い'
  | '研究員'
  | '上級研究員'
  | '特別顧問';

/** 階級ごとのアイコン・表示色 */
export const RANK_CONFIG: Record<ResearcherRank, { icon: string; className: string }> = {
  '研究員見習い': { icon: '🔰', className: 'text-gray-400' },
  '研究員': { icon: '🔬', className: 'text-blue-400' },
  '上級研究員': { icon: '✨', className: 'text-purple-400' },
  '特別顧問': { icon: '⭐', className: 'text-amber-400' },
  '開発者': { icon: '💻', className: 'text-green-400' },
};

export interface Researcher {
  /** 研究員番号（参加順の連番、1始まり） */
  number: number;
  /** 名前 */
  name: string;
  /** 階級 */
  rank: ResearcherRank;
  /** 研究分野 */
  field: string;
  /** 参加日 (YYYY-MM-DD) */
  joinedAt: string;
}

/** 研究員一覧（番号昇順で管理） */
export const RESEARCHERS: Researcher[] = [
  {
    number: 1,
    name: "Aoi",
    rank: "開発者",
    field: "AIゲーム研究",
    joinedAt: "2026-03-14"
  },
  {
    number: 2,
    name: "user123",
    rank: "研究員見習い",
    field: "英語研究",
    joinedAt: "2026-03-15"
  }
];

/** No.xxx 形式の表示用文字列 */
export function formatResearcherNumber(n: number): string {
  return `No.${String(n).padStart(3, '0')}`;
}
