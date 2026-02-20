/**
 * wordExtraction.ts
 *
 * スキャンした英文から単語を抽出・正規化・重複除去
 * 単コレの「敵」登録用
 *
 * 仕様：
 * - アルファベットのみ
 * - 3文字以上（a, I は例外で許可）
 * - 記号除去・小文字化
 * - 重複は key で排除
 * - 除外：数字のみ、記号のみ、2文字以下、OCR崩れ
 */

const SAVE_LIMIT = 150;

/** 正規化：記号除去・小文字化 */
function normalizeWord(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z]/g, '') // アルファベット以外を除去
    .toLowerCase()
    .trim();
  return cleaned;
}

/** 2文字以下の例外（a, I） */
const SHORT_ALLOWED = new Set(['a', 'i']);

/** ノイズ判定：除外してよい単語か */
function isNoise(word: string): boolean {
  if (!word || word.length === 0) return true;
  // アルファベット以外が残っている（正規化後は空になるはずだが念のため）
  if (!/^[a-z]+$/.test(word)) return true;
  // 数字のみ・記号のみは正規化で除去済み
  // 2文字以下（a, I は例外）
  if (word.length <= 2 && !SHORT_ALLOWED.has(word)) return true;
  // 同一文字連続（OCR崩れ）
  if (/^(.)\1{4,}$/.test(word)) return true;
  return false;
}

/** 英文テキストから単語を抽出（ユニーク・正規化・上限150） */
export function extractWords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const tokens = text.split(/\s+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tokens) {
    const normalized = normalizeWord(raw);
    if (normalized && !isNoise(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= SAVE_LIMIT) break;
    }
  }

  return result;
}

export const WORD_SAVE_LIMIT = SAVE_LIMIT;
