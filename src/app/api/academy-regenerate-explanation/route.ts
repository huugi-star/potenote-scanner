import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  question: z.string().min(1).max(900),
  choices: z.array(z.string().min(1).max(220)).length(4),
  answerIndex: z.number().int().min(0).max(3),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { question, choices, answerIndex } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 503 });
    }

    const systemPrompt = [
      'あなたは大手進学塾のベテラン講師です。',
      '与えられた四択問題について、正解（answerIndex）に整合する解説文だけを日本語で作成してください。',
      '',
      '制約:',
      '- 出力は解説文の本文のみ（JSON不要、余計な前置き不要）。',
      '- 解説は2〜5文。短く、学習者に優しく。',
      '- 正解以外が正しいような書き方をしない。',
      '- 解説の中で正解の選択肢の文言を1回以上引用してよい。',
    ].join('\n');

    const userContent = [
      `問題: ${question}`,
      `選択肢:`,
      `A. ${choices[0]}`,
      `B. ${choices[1]}`,
      `C. ${choices[2]}`,
      `D. ${choices[3]}`,
      `正解: ${String.fromCharCode(65 + answerIndex)}（${choices[answerIndex]}）`,
      '',
      'この正解に合わせて解説文のみを書いてください。',
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
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('[academy-regenerate-explanation] OpenAI error:', errText);
      return NextResponse.json({ error: 'OpenAI request failed' }, { status: 502 });
    }

    const openaiData = (await openaiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = openaiData.choices?.[0]?.message?.content ?? '';
    const explanation = String(content).trim();
    if (!explanation) {
      return NextResponse.json({ error: 'No content from model' }, { status: 502 });
    }

    return NextResponse.json({ explanation });
  } catch (e) {
    console.error('[academy-regenerate-explanation]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

