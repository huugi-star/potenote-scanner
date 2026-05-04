import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

const ReqSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(3),
});

// ─── 型 ──────────────────────────────────────────────────────────────────────

type GeminiModel = {
  generateContent: (prompt: string) => Promise<{
    response: {
      text: () => string;
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
  }>;
};

type SanitizedQuestion = {
  questionNumber: string;
  answer: string;
  structure: string;
  reason: string;
  remember: string;
  derived: string[];
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

const normalizeQuestionTypeJa = (value: string): string => {
  const n = value.toLowerCase();
  if (n.includes('vocabulary') || n.includes('word')) return '語彙';
  if (n.includes('comprehension') || n.includes('content')) return '内容一致';
  if (n.includes('ordering') || n.includes('arrange')) return '並べ替え';
  if (n.includes('grammar')) return '文法';
  if (n.includes('blank') || n.includes('fill')) return '穴埋め';
  if (n.includes('multiple')) return '複合問題';
  return value;
};

const toStr = (v: unknown, fallback = '根拠不足') => {
  const s = String(v ?? '').trim();
  return s || fallback;
};

const oneLine = (v: unknown, fallback = '根拠不足') =>
  toStr(v, fallback).replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim() || fallback;

const shortLine = (v: unknown, fallback = '根拠不足', max = 48) => {
  const s = oneLine(v, fallback);
  return s.length <= max ? s : `${s.slice(0, max)}…`;
};

const cleanJson = (text: string): string => {
  let s = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1) s = s.substring(a, b + 1);
  return s.replace(/,\s*([}\]])/g, '$1');
};

const safeParseWithRepair = (text: string): unknown => {
  const clean = cleanJson(text.replace(/^\uFEFF/, '').trim());
  try { return JSON.parse(clean); } catch { /* fall through */ }
  try { return JSON.parse(text); } catch { /* fall through */ }
  return JSON.parse(jsonrepair(clean));
};

function extractText(res: Awaited<ReturnType<GeminiModel['generateContent']>>): string {
  try { return res.response.text(); } catch {
    return (res.response.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('');
  }
}

async function callGemini(model: GeminiModel, prompt: string, stage: string): Promise<unknown> {
  const res = await model.generateContent(prompt);
  const text = extractText(res);
  if (!text.trim()) {
    const fr = res.response.candidates?.[0]?.finishReason;
    throw new Error(`Gemini出力が空 (${stage}${fr ? ` / ${fr}` : ''})`);
  }
  try {
    return safeParseWithRepair(text);
  } catch (e) {
    console.error(`[english-pattern-scan] JSON parse failed (${stage})`, text.slice(0, 600), e);
    throw new Error(`JSON解析失敗 (${stage})`);
  }
}

async function runVisionOcr(imageDataUrl: string): Promise<string> {
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: {
        languageHints: ['en', 'ja'],
        textDetectionParams: { enableTextDetectionConfidenceScore: true },
      },
    }],
  };
  const r = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Vision API Error: ${await r.text()}`);
  const data = await r.json();
  return String(data.responses?.[0]?.fullTextAnnotation?.text ?? '').trim();
}

// ─── メインハンドラ ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_VISION_API_KEY)
      return NextResponse.json({ error: 'GOOGLE_VISION_API_KEY未設定' }, { status: 500 });
    if (!process.env.GOOGLE_GEMINI_API_KEY)
      return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY未設定' }, { status: 500 });

    const raw = await req.json();
    const parsed = ReqSchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ error: '画像データの形式が正しくありません（1〜3枚）' }, { status: 400 });

    const { images } = parsed.data;
    const MAX = 10 * 1024 * 1024;
    for (const img of images)
      if (img.length > MAX)
        return NextResponse.json({ error: '画像が大きすぎます' }, { status: 400 });

    // ── STEP 1: OCR ──────────────────────────────────────────────────────────
    const texts = await Promise.all(images.map(runVisionOcr));
    const pages = texts
      .map((t, i) => ({ t: t.trim(), i }))
      .filter((v) => v.t.length > 0)
      .map((v) => `=== page ${v.i + 1} ===\n${v.t}`);

    if (!pages.length)
      return NextResponse.json({ error: '文字が読み取れませんでした' }, { status: 400 });

    // OCR原文は常に参照できるよう保持する（全処理で共有）
    const ocrRaw = pages.join('\n\n').slice(0, 24000);

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const cfg = { responseMimeType: 'application/json' as const, temperature: 0.1 };

    const modelAlign = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { ...cfg, maxOutputTokens: 6000 },
    }) as unknown as GeminiModel;

    const modelSolve = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { ...cfg, maxOutputTokens: 14000 },
    }) as unknown as GeminiModel;

    // ── STEP 2: 設問抽出（OCR原文から設問のみ列挙、架空生成禁止） ────────────
    const alignPrompt = `
あなたはOCRテキストから英語問題を【正確に抽出】するエンジンです。

【絶対ルール】
- OCRテキストに存在しない設問を作ることを厳禁します
- 設問文は必ずOCRテキストから直接引用してください（言い換え禁止）
- 選択肢も必ずOCRテキストから引用してください
- 読み取り不可・存在が不明確な設問は questions に含めないでください
- 存在が確実な設問のみ出力してください

出力はJSONのみ。
{
  "overallType": "問題全体の種別（日本語）",
  "extractedSummary": "本文の日本語要約（OCRテキストに英文本文が存在する場合のみ）",
  "questions": [
    {
      "questionNumber": "問1",
      "questionType": "穴埋め|語彙|並べ替え|内容一致|文法|複合問題",
      "rawQuestion": "OCRテキストから直接コピーした設問文",
      "rawOptions": ["1. ...", "2. ...", "3. ...", "4. ..."],
      "ocrEvidence": "この設問がOCRテキストのどこに存在するか（直接引用で示す）"
    }
  ]
}

OCRテキスト:
${ocrRaw}
`.trim();

    type AlignResult = {
      overallType?: string;
      extractedSummary?: string;
      questions?: Array<{
        questionNumber?: string;
        questionType?: string;
        rawQuestion?: string;
        rawOptions?: string[];
        ocrEvidence?: string;
      }>;
    };

    let aligned: AlignResult = {};
    try {
      aligned = (await callGemini(modelAlign, alignPrompt, 'align')) as AlignResult;
    } catch (e) {
      console.warn('[english-pattern-scan] align failed', (e as Error)?.message);
    }

    const alignedQuestions = Array.isArray(aligned?.questions)
      ? aligned.questions.filter((q) => {
          // ocrEvidence が空・根拠不足の問題は除外
          const ev = String(q?.ocrEvidence ?? '').trim();
          return ev.length > 5 && !ev.includes('根拠不足') && !ev.includes('推定');
        })
      : [];

    if (alignedQuestions.length === 0) {
      // 抽出できた設問がゼロの場合、最小限のレスポンスを返す
      return NextResponse.json({
        result: {
          title: '英語問題解析',
          overallType: toStr(aligned?.overallType, '不明'),
          extractedSummary: toStr(aligned?.extractedSummary, 'OCRテキストから設問を検出できませんでした'),
          questions: [],
          overallScoringPatterns: ['設問が検出されませんでした。画像の品質を上げるか、1ページずつ送ってください'],
          suhimochiComment: 'テキストは読み取れましたが、設問の構造が判別できませんでした',
        },
      });
    }

    // ── STEP 3: 解答・解説生成（抽出済み設問のみ対象、架空生成厳禁） ─────────
    const solvePrompt = `
あなたは「一瞬で理解して再利用できる」試験英語コーチです。
目的は短時間で解いて次問へ応用すること。長文説明は禁止。

【絶対ルール】
- 抽出済み設問リストにない問題は作らない
- 解説は必ず1行
- 構造・覚えるは短く（記号レベルでOK）
- 派生は必ず3つ以内（最大3つ）
- 「文脈で判断」など曖昧表現は禁止
- 無駄な一般論は禁止

出力はJSONのみ。以下のキー名・順序を守ること:
{
  "title": "解ける英文 超速解説",
  "overallType": "${toStr(aligned?.overallType, '推定')}",
  "coreRules": ["前置詞 -> ing", "make it -> 形容詞 -> to", "内容一致 -> 数字", "語彙 -> 役割"],
  "questions": [
    {
      "questionNumber": "問1",
      "answer": "3. getting",
      "structure": "on -> 前置詞 -> 動詞ing",
      "reason": "onの直後は動名詞なのでgettingを選ぶ",
      "remember": "前置詞 -> ing",
      "derived": [
        "① focus on ( ) English every day. -> studying",
        "② be good at ( ) speeches. -> making",
        "③ look forward to ( ) you. -> seeing"
      ]
    }
  ],
  "suhimochiComment": "短く一言"
}

【抽出済み設問リスト（これのみを解答）】
${JSON.stringify(alignedQuestions, null, 2).slice(0, 8000)}

【OCRテキスト（根拠確認用）】
${ocrRaw.slice(0, 12000)}
`.trim();

    let solveResult: unknown;
    try {
      solveResult = await callGemini(modelSolve, solvePrompt, 'solve');
    } catch (e) {
      console.warn('[english-pattern-scan] solve failed', (e as Error)?.message);
      solveResult = {
        title: '解ける英文 超速解説',
        overallType: toStr(aligned?.overallType, '推定'),
        coreRules: ['根拠不足'],
        questions: [],
        overallScoringPatterns: ['解答生成に失敗しました'],
        suhimochiComment: '詳細解説の取得に失敗しました',
      };
    }

    // ── STEP 4: サニタイズ ────────────────────────────────────────────────────
    const r = solveResult as any;
    const rawQuestions: unknown[] = Array.isArray(r?.questions) ? r.questions : [];

    const sanitized: SanitizedQuestion[] = rawQuestions.map((q: unknown, idx) => {
      const qq = q as any;
      const derivedRaw = Array.isArray(qq?.derived) ? qq.derived : [];
      const derived = derivedRaw
        .map((v: unknown, i: number) => {
          const base = oneLine(v);
          if (/^[①-③]/.test(base)) return base;
          const marks = ['①', '②', '③'];
          return `${marks[Math.min(i, 2)]} ${base}`;
        })
        .filter(Boolean)
        .slice(0, 3);
      return {
        questionNumber: toStr(qq?.questionNumber, `問${idx + 1}`),
        answer: oneLine(qq?.answer),
        structure: shortLine(qq?.structure ?? qq?.scoringPattern),
        reason: oneLine(qq?.reason ?? qq?.explanation),
        remember: shortLine(qq?.remember ?? qq?.reusablePattern?.rule),
        derived: derived.length ? derived : ['① 根拠不足 -> 根拠不足'],
      };
    });

    const coreRules = (Array.isArray(r?.coreRules) ? r.coreRules : r?.overallScoringPatterns)
      ? (Array.isArray(r?.coreRules) ? r.coreRules : r?.overallScoringPatterns)
          .map((v: unknown) => shortLine(v))
          .filter(Boolean)
          .slice(0, 4)
      : [];

    const result = {
      title:           toStr(r?.title, '解ける英文 超速解説'),
      overallType:     normalizeQuestionTypeJa(toStr(r?.overallType ?? r?.questionType, '推定')),
      extractedSummary: toStr(r?.extractedSummary ?? r?.summary, '根拠不足'),
      coreRules: coreRules.length ? coreRules : ['根拠不足'],
      questions: sanitized,
      overallScoringPatterns:
        Array.isArray(r?.overallScoringPatterns) && r.overallScoringPatterns.length
          ? (r.overallScoringPatterns as unknown[]).map((p) => toStr(p)).filter(Boolean)
          : ['根拠パターンの抽出に失敗しました'],
      suhimochiComment: toStr(r?.suhimochiComment),
    };

    return NextResponse.json({ result });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[english-pattern-scan] POST error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}