export function normalizeReading(input: string): string {
  const raw = String(input ?? '');
  // NFKCで全角半角などを吸収
  let s = raw.normalize('NFKC');

  // スペース除去（前後・中間とも）
  s = s.replace(/\s+/g, '');

  // カタカナ→ひらがな
  s = s.replace(/[\u30A1-\u30F6]/g, (ch) => {
    const code = ch.charCodeAt(0) - 0x60;
    return String.fromCharCode(code);
  });

  // よくある記号ゆれ除去（読み判定に不要）
  s = s.replace(/[・·.。､，,]/g, '');

  return s;
}

