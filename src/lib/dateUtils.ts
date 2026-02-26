/**
 * 日本時間（JST）基準の日付文字列を返す（YYYY-MM-DD）。
 * offsetDays を使うと前日/翌日を取得できる。
 */
export const getJstDateString = (offsetDays = 0): string => {
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(jstMs).toISOString().split("T")[0];
};
