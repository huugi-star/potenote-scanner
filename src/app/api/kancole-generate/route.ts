import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ReqSchema = z.object({
  text: z.string().min(1),
  count: z.number().int().min(1).max(50).optional().default(20),
});

const ResSchema = z.object({
  items: z.array(z.object({
    term: z.string().min(1),
    reading: z.string().min(1),
    meaning: z.string().min(1),
    explanation: z.string().min(1),
    sourceSnippet: z.string().optional(),
  })),
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
    }

    const body = ReqSchema.parse(await req.json());
    const text = body.text.slice(0, 12000);
    const count = body.count;

    const system = [
      'あなたは日本語教材から「漢字語の読み」を作る先生です。',
      '入力はOCR/スキャン由来の本文です。',
      '本文に実際に出てきた「漢字語（2〜6文字程度）」だけを対象にし、読み問題を作ってください。',
      '',
      '出力は必ずJSONのみ（前後に説明文なし）。',
      '読みは「ひらがな」だけ。長音符や中黒は使わない。',
      'meaningは短い日本語の意味。',
      'explanationは軽い解説（短く）。',
      '固有名詞っぽいもの、人名、住所、電話番号、記号だらけ、英数字だけ、1文字だけは避ける。',
      '同じtermを重複させない。',
      '誤読を誘発する無理な言い換えはしない（厳密寄り）。',
    ].join('\n');

    const user = [
      `本文から${count}個、漢字語の読み問題を作ってください。`,
      '',
      'JSON形式:',
      '{ "items": [ { "term": "漢字語", "reading": "ひらがな", "meaning": "意味", "explanation": "軽い解説", "sourceSnippet": "出典(任意)" } ] }',
      '',
      '本文:',
      text,
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2200,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI Error: ${await openaiResponse.text()}`);
    }
    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content');

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Failed to parse OpenAI response');
      json = JSON.parse(match[0]);
    }

    const parsed = ResSchema.parse(json);
    const items = parsed.items
      .map((it) => ({
        term: String(it.term).trim(),
        reading: String(it.reading).trim(),
        meaning: String(it.meaning).trim(),
        explanation: String(it.explanation).trim(),
        sourceSnippet: it.sourceSnippet ? String(it.sourceSnippet).trim() : undefined,
      }))
      .filter((it) => it.term && it.reading);

    // term重複除去 + count制限
    const seen = new Set<string>();
    const uniq = [];
    for (const it of items) {
      if (seen.has(it.term)) continue;
      seen.add(it.term);
      uniq.push(it);
      if (uniq.length >= count) break;
    }

    return NextResponse.json({ items: uniq });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

