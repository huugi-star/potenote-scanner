/**
 * /api/suhimochi-gemini-reply
 *
 * 【変更点】
 * - 旧：basePrompt + dynamicPrompt を結合して1ターンで渡す
 * - 新：systemPrompt をシステム指示、conversationHistory で多ターン履歴を渡す
 *
 * Gemini API の仕様：
 *   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
 *   Body: { system_instruction, contents: [ {role, parts}... ] }
 *
 * 後方互換：
 *   旧フィールド（basePrompt / dynamicPrompt）でのリクエストも受け付ける
 */

import { NextResponse } from 'next/server';

// ---- 型定義 ----
type GeminiMessage = {
  role: 'user' | 'model';
  parts: [{ text: string }];
};

type RequestBody = {
  // 新しいシグネチャ
  systemPrompt?: string;
  userTurn?: string;
  conversationHistory?: GeminiMessage[];
  // 後方互換（旧シグネチャ）
  basePrompt?: string;
  dynamicPrompt?: string;
};

// ============================================================
// 入力トークン制限（最大3000文字）
// ============================================================

const MAX_INPUT_CHARS = 2500;

/**
 * systemPrompt + userTurn を優先して確保し、
 * 残り枠を履歴に使う。履歴は新しい順に詰める。
 */
const trimHistoryToFit = (
  systemPrompt: string,
  conversationHistory: GeminiMessage[],
  userTurn: string,
): GeminiMessage[] => {
  const fixedChars = systemPrompt.length + userTurn.length;
  const budget = MAX_INPUT_CHARS - fixedChars;

  if (budget <= 0) return [];

  const result: GeminiMessage[] = [];
  let used = 0;

  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    const len = msg.parts[0]?.text?.length ?? 0;
    if (used + len > budget) break;
    result.unshift(msg);
    used += len;
  }

  return result;
};

// ---- Gemini API 設定 ----
const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // コスト低・速度高。品質重視なら gemini-1.5-pro へ
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---- Generation Config ----
// すうひもちの口調に合わせた設定
// - temperature: 0.85（少し高め → 自然なバラエティ）
// - topP: 0.92（多様性を保ちつつ破綻を防ぐ）
// - maxOutputTokens: 150（1〜3文に収まる長さ）
const GENERATION_CONFIG = {
  temperature: 0.85,
  topP: 0.92,
  topK: 40,
  maxOutputTokens: 200,
  stopSequences: [], // 特定パターンで止めたい場合はここに追加
};

const estimateTokens = (text: string): number => Math.ceil(text.length / 2.2);

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ---- プロンプト解決（新旧シグネチャ対応） ----
  let systemInstruction: string;
  let contents: GeminiMessage[];

  if (body.systemPrompt && body.userTurn) {
    // ★ 新シグネチャ：systemPrompt + userTurn + conversationHistory
    systemInstruction = body.systemPrompt;
    const history = body.conversationHistory ?? [];
    const trimmedHistory = trimHistoryToFit(
      body.systemPrompt,
      history,
      body.userTurn,
    );
    contents = [
      ...trimmedHistory,
      { role: 'user', parts: [{ text: body.userTurn }] },
    ];
  } else if (body.basePrompt && body.dynamicPrompt) {
    // ★ 旧シグネチャ（後方互換）
    // basePrompt をシステム指示、dynamicPrompt をユーザーターンとして扱う
    systemInstruction = body.basePrompt;
    contents = [
      { role: 'user', parts: [{ text: body.dynamicPrompt }] },
    ];
  } else {
    return NextResponse.json({ error: 'Missing prompt fields' }, { status: 400 });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  const apiKeySource = process.env.GEMINI_API_KEY
    ? 'GEMINI_API_KEY'
    : process.env.GOOGLE_GEMINI_API_KEY
      ? 'GOOGLE_GEMINI_API_KEY'
      : process.env.GOOGLE_API_KEY
        ? 'GOOGLE_API_KEY'
        : 'none';

  // ---- Gemini API リクエスト ----
  const geminiBody = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: GENERATION_CONFIG,
    // Safety settings: すうひもちの会話は安全なので緩めに設定
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  const requestPromptText = `${systemInstruction}\n${contents
    .map((m) => m.parts?.map((p) => p.text ?? '').join('') ?? '')
    .join('\n')}`;
  const promptTokensEstimate = estimateTokens(requestPromptText);

  if (!apiKey) {
    console.error('[suhimochi-gemini-reply] GEMINI_API_KEY not configured');
    console.log(
      `[suhimochi-gemini-reply] 入力トークン: ${promptTokensEstimate} / 出力トークン: 0 / 合計: ${promptTokensEstimate} (key missing)`
    );
    return NextResponse.json({
      reply: 'いま言葉がうまくつながらないみたい。少ししてから、もう一回話しかけてくれる？',
    });
  }

  try {
    console.log(`[suhimochi-gemini-reply] apiKeySource=${apiKeySource}`);
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Gemini API Error]', res.status, errorText);
      console.log(
        `[suhimochi-gemini-reply] 入力トークン: ${promptTokensEstimate} / 出力トークン: 0 / 合計: ${promptTokensEstimate} (api error:${res.status})`
      );
      return NextResponse.json({
        reply: 'うまく言葉を受け取れなかった。もう一回だけ話してくれる？',
      });
    }

    const data = await res.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY') {
      // Safetyフィルターに引っかかった場合のフォールバック
      console.log(
        `[suhimochi-gemini-reply] 入力トークン: ${promptTokensEstimate} / 出力トークン: 0 / 合計: ${promptTokensEstimate} (no candidate/safety)`
      );
      return NextResponse.json({ reply: 'うん、ちょっと上手く言えなかった。もう一回話しかけてくれる？' });
    }

    const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const cleaned = text.trim().replace(/^["「『]|["」』]$/g, '');

    const promptTokens = data.usageMetadata?.promptTokenCount ?? promptTokensEstimate;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? estimateTokens(cleaned);
    const totalTokens = data.usageMetadata?.totalTokenCount ?? promptTokens + outputTokens;
    console.log(
      `[suhimochi-gemini-reply] 入力トークン: ${promptTokens} / 出力トークン: ${outputTokens} / 合計: ${totalTokens}`
    );

    if (!cleaned || cleaned.length < 3) {
      console.log(
        `[suhimochi-gemini-reply] 入力トークン: ${promptTokens} / 出力トークン: 0 / 合計: ${promptTokens} (empty response)`
      );
      return NextResponse.json({
        reply: 'ことばがうまくまとまらなかった。もう一度だけ聞かせてくれる？',
      });
    }

    return NextResponse.json({ reply: cleaned });
  } catch (err) {
    console.error('[Gemini Fetch Error]', err);
    console.log(
      `[suhimochi-gemini-reply] 入力トークン: ${promptTokensEstimate} / 出力トークン: 0 / 合計: ${promptTokensEstimate} (fetch error)`
    );
    return NextResponse.json({
      reply: 'いま通信が不安定みたい。少ししてから、もう一回話しかけてくれる？',
    });
  }
}