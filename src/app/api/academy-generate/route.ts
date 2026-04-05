import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  keywords: z.array(z.string()).min(1),
  bigCategory: z.string().min(1),
  subCategory: z.string().min(1),
  // ★ 詳細テキスト（任意）
  detailText: z.string().max(400).optional(),
});

const DraftSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { keywords, bigCategory, subCategory, detailText } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
    }

    const systemPrompt = [
      'あなたは大手進学塾のベテラン講師です。',
      'ユーザーが与えたキーワードとカテゴリをもとに、理解力を測る高品質な四択クイズを1問だけ作成してください。',
      '',
      '出力は必ず有効なJSONオブジェクト1つだけ。他の文字は出さない。',
      '制約:',
      '- 第三者の文章・問題文・選択肢の転載・引用は禁止。自分の言葉で書く。',
      '- キーワードとカテゴリだけをヒントに、一般化したオリジナルの問題を作る。',
      '- 選択肢は4つ。正解は1つ。',
      '- JSONキー: question, choices(文字列4要素), answerIndex(0-3), explanation',
      '- 問題は提供されたseed情報のみで解けるようにする',
      '- 他作品や外部知識に依存しない',
      '- 選択肢は同一テーマ内の語句で構成する',
    ].join('\n');

    // ★ detailText がある場合はユーザー指示として追加
    const userContent = [
      `大カテゴリ: ${bigCategory}`,
      `小カテゴリ: ${subCategory}`,
      `キーワード: ${keywords.join(', ')}`,
      detailText?.trim()
        ? `\n【作問の追加指示】\n${detailText.trim()}`
        : '',
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('[academy-generate] OpenAI error:', errText);
      return NextResponse.json({ error: 'OpenAI request failed' }, { status: 502 });
    }

    const openaiData = (await openaiResponse.json()) as {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
      choices?: Array<{ message?: { content?: string } }>;
    };

    const usage = openaiData.usage ?? {};
    const promptTokens     = usage.prompt_tokens     ?? usage.promptTokens     ?? 0;
    const completionTokens = usage.completion_tokens ?? usage.completionTokens ?? 0;
    const totalTokens      = usage.total_tokens      ?? usage.totalTokens      ?? promptTokens + completionTokens;

    console.log(
      `[academy-generate] OpenAI billing tokens — prompt: ${promptTokens} completion: ${completionTokens} total: ${totalTokens}`
    );

    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No content from model' }, { status: 502 });
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        json = JSON.parse(braceMatch[0]);
      } else {
        return NextResponse.json({ error: 'Invalid JSON from model' }, { status: 502 });
      }
    }

    const draftParsed = DraftSchema.safeParse(json);
    if (!draftParsed.success) {
      console.error('[academy-generate] Draft schema:', draftParsed.error.flatten());
      return NextResponse.json({ error: 'Draft validation failed' }, { status: 502 });
    }

    const draft = draftParsed.data;

    return NextResponse.json({
      draft: {
        question: draft.question,
        choices: draft.choices,
        answerIndex: draft.answerIndex,
        explanation: draft.explanation,
      },
      usage: { promptTokens, completionTokens, totalTokens },
    });
  } catch (e) {
    console.error('[academy-generate]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}