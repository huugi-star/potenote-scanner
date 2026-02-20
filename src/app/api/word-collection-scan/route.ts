/**
 * word-collection-scan API
 *
 * 単コレ専用スキャン：Natural Language API (Syntax) で単語抽出
 * OCR → Syntax解析 → lemma統合・例文付与 → GeminiはactiveEnemies(最大21)のみ意味生成
 */

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LanguageServiceClient } from '@google-cloud/language';
import { jsonrepair } from 'jsonrepair';

const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
const ACTIVE_ENEMIES_MAX = 21;

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

type SyntaxToken = {
  text: string;
  beginOffset: number;
  pos: { tag: string | null };
  lemma: string | null;
};

/** 英文のみにクリーニング（OCR後処理） */
function cleanOCRText(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/ビジュアル\s*\d*/gi, '');
  cleaned = cleaned.replace(/文構造を解析し[，,]?\s*和訳しなさい/gi, '');
  cleaned = cleaned.replace(/英文解釈/gi, '');
  cleaned = cleaned.replace(/^[\s]*[\(（\[]?[A-Za-z]?\d+[\)）\]]?[\.。]?\s*/gm, '');
  cleaned = cleaned.replace(/\b\d{3,}\b/g, '');
  cleaned = cleaned.replace(/\s+[A-Z]{1,3}(?=\s|$|[,.;!?])/g, (match) => {
    const keep = ['I', 'A', 'US', 'UK', 'TV', 'PC', 'AI', 'IT', 'OK', 'AM', 'PM', 'Mr', 'Mrs', 'Ms', 'Dr'];
    return keep.includes(match.trim()) ? match : ' ';
  });
  cleaned = cleaned.replace(/^\s*[A-Z]{1,3}\s*$/gm, '');
  cleaned = cleaned.replace(/\b(Pl|RSS|WWW|URL|PDF|MP3|MP4|GPS)\b/gi, '');
  cleaned = cleaned.replace(/-{3,}/g, '');
  cleaned = cleaned.replace(/[^\w\s.,!?;:'"(){}\[\]-]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/** UTF-8 byte offset → 文字インデックス（Syntax API の beginOffset 用） */
function byteOffsetToCharIndex(str: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0;
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    bytes += Buffer.byteLength(str[i], 'utf8');
    if (bytes >= byteOffset) return i;
  }
  return str.length;
}

/** 文の境界で分割し、(開始位置, 終了位置, 文) の配列を返す */
function splitSentences(text: string): Array<{ start: number; end: number; sentence: string }> {
  const result: Array<{ start: number; end: number; sentence: string }> = [];
  const re = /[.!?]\s+/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + 1;
    const sentence = text.slice(lastEnd, end).trim();
    if (sentence) result.push({ start: lastEnd, end, sentence });
    lastEnd = m.index + m[0].length;
  }
  const tail = text.slice(lastEnd).trim();
  if (tail) result.push({ start: lastEnd, end: text.length, sentence: tail });
  return result;
}

/** 指定位置を含む文を取得 */
function findSentenceAt(
  sentences: Array<{ start: number; end: number; sentence: string }>,
  charIndex: number
): string | undefined {
  for (const s of sentences) {
    if (charIndex >= s.start && charIndex < s.end) return s.sentence;
  }
  return undefined;
}

/** lemma がノイズかどうか */
function isNoiseLemma(lemma: string): boolean {
  const w = lemma.toLowerCase().replace(/[^a-z]/g, '');
  if (!w || w.length === 0) return true;
  if (w.length <= 2 && !['a', 'i'].includes(w)) return true;
  if (/^(.)\1{4,}$/.test(w)) return true;
  return false;
}

/** Syntax の pos.tag をそのまま小文字で返す */
function normalizePosTag(tag: string | null): string | undefined {
  if (!tag || typeof tag !== 'string') return undefined;
  return tag.toLowerCase();
}

/** Syntax 結果から lemma 統合・例文付きの単語リストを生成 */
function buildWordsFromSyntax(
  text: string,
  tokens: SyntaxToken[]
): Array<{ lemma: string; pos: string | undefined; surfaceVariants: string[]; exampleSentence?: string }> {
  const sentences = splitSentences(text);
  const lemmaMap = new Map<
    string,
    { pos: string | undefined; surfaceVariants: Set<string>; firstCharIndex: number }
  >();

  for (const t of tokens) {
    const lemma = (t.lemma ?? t.text ?? '').trim();
    const surface = (t.text ?? '').trim();
    if (!lemma || !surface) continue;
    if (isNoiseLemma(lemma)) continue;

    const charIndex = byteOffsetToCharIndex(text, t.beginOffset);
    const pos = normalizePosTag(t.pos?.tag ?? null);

    const existing = lemmaMap.get(lemma);
    if (existing) {
      existing.surfaceVariants.add(surface);
      if (charIndex < existing.firstCharIndex) {
        existing.firstCharIndex = charIndex;
        existing.pos = pos;
      }
    } else {
      lemmaMap.set(lemma, {
        pos,
        surfaceVariants: new Set([surface]),
        firstCharIndex: charIndex,
      });
    }
  }

  const result: Array<{
    lemma: string;
    pos: string | undefined;
    surfaceVariants: string[];
    exampleSentence?: string;
  }> = [];

  for (const [lemma, data] of lemmaMap) {
    const exampleSentence = findSentenceAt(sentences, data.firstCharIndex);
    result.push({
      lemma,
      pos: data.pos,
      surfaceVariants: Array.from(data.surfaceVariants),
      exampleSentence,
    });
  }

  return result;
}

/** Gemini で activeEnemies のみ意味を生成（品詞は NL API の pos をそのまま使用） */
async function generateMeaningsForActive(lemmas: string[]): Promise<Map<string, string>> {
  if (lemmas.length === 0) return new Map();

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4000,
      temperature: 0,
    },
  });

  const wordList = lemmas.join(', ');
  const prompt = `あなたは英単語の意味を日本語で簡潔に教えるアシスタントです。
以下の英単語それぞれについて、JSON形式で出力してください。

【出力形式】必ず以下のJSON配列のみを出力。余計な説明は不要。
[{"word":"英単語","meaning":"日本語の意味（短く）"}]

【対象単語】
${wordList}

【出力例】
[{"word":"example","meaning":"例"},{"word":"run","meaning":"走る"}]`;

  const apiResult = await model.generateContent(prompt);
  const out = apiResult.response.text();

  let parsed: Array<{ word?: string; meaning?: string }>;
  try {
    const cleaned = out.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    const jsonStr =
      firstBracket >= 0 && lastBracket > firstBracket
        ? cleaned.substring(firstBracket, lastBracket + 1)
        : cleaned;
    parsed = JSON.parse(jsonrepair(jsonStr));
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) parsed = [];

  const map = new Map<string, string>();
  for (let i = 0; i < lemmas.length; i++) {
    const w = lemmas[i];
    const item = parsed[i] || parsed.find((p: any) => String(p?.word ?? '').toLowerCase() === w.toLowerCase());
    const meaning = (item?.meaning && String(item.meaning).trim()) || '';
    if (meaning) map.set(w.toLowerCase(), meaning);
  }
  return map;
}

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const { image } = await req.json();

    const MAX_IMAGE_BASE64 = 10 * 1024 * 1024;
    if (!image || typeof image !== 'string' || image.length > MAX_IMAGE_BASE64) {
      return NextResponse.json({ error: '画像が無効または大きすぎます' }, { status: 400 });
    }

    // OCR
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_VISION_API_KEY is not configured' }, { status: 500 });
    }

    const base64Content = image.replace(/^data:image\/\w+;base64,/, '');
    const visionBody = {
      requests: [
        {
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };
    const visionResponse = await fetch(
      `${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visionBody),
      }
    );

    if (!visionResponse.ok) {
      const err = await visionResponse.text();
      throw new Error(`Vision API Error: ${err}`);
    }

    const visionData = await visionResponse.json();
    const extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text;
    if (!extractedText) {
      return NextResponse.json({ error: '文字が読み取れませんでした' }, { status: 400 });
    }

    const cleanText = cleanOCRText(extractedText);
    if (!cleanText.trim()) {
      return NextResponse.json({ error: '英文が検出されませんでした' }, { status: 400 });
    }

    // Natural Language API (Syntax)
    const langClient = new LanguageServiceClient();
    const [syntaxResult] = await langClient.analyzeSyntax({
      document: { content: cleanText, type: 'PLAIN_TEXT' },
      encodingType: 'UTF8',
    });

    const rawTokens = syntaxResult.tokens ?? [];
    // トークン数をターミナルに出力（デバッグ用・本文は出さない）
    // NOTE: 出力は件数のみ。長い本文や機密情報は出力しない。
    // eslint-disable-next-line no-console
    console.info('[word-collection-scan] token_count=', rawTokens.length);
    const tokens: SyntaxToken[] = rawTokens.map((t: any) => ({
      text: t.text?.content ?? '',
      beginOffset: t.text?.beginOffset ?? 0,
      pos: { tag: t.partOfSpeech?.tag ?? null },
      lemma: t.lemma ?? null,
    }));

    const wordsFromSyntax = buildWordsFromSyntax(cleanText, tokens);
    if (wordsFromSyntax.length === 0) {
      return NextResponse.json({ error: '抽出できる単語がありませんでした' }, { status: 400 });
    }

    // activeEnemies: 最大21体を先頭から選択（出現順）
    const activeLemmas = wordsFromSyntax.slice(0, ACTIVE_ENEMIES_MAX).map((w) => w.lemma);

    // Gemini は activeEnemies のみ意味生成
    const meaningMap = await generateMeaningsForActive(activeLemmas);

    const words = wordsFromSyntax.map((w) => ({
      word: w.lemma,
      meaning: meaningMap.get(w.lemma.toLowerCase()),
      pos: w.pos, // Natural Language API の pos をそのまま
      surfaceVariants: w.surfaceVariants,
      exampleSentence: w.exampleSentence,
    }));

    return NextResponse.json({
      clean_text: cleanText,
      words,
    });
  } catch (e) {
    console.error('[word-collection-scan]', e);
    const msg = (e as Error)?.message || 'スキャンに失敗しました';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
