import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

const ReqSchema = z.object({
  image: z.string().min(1),
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
  clean_text: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_VISION_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_VISION_API_KEY is not configured' }, { status: 500 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const body = ReqSchema.parse(await req.json());

    const MAX_IMAGE_BASE64 = 10 * 1024 * 1024;
    if (typeof body.image !== 'string' || body.image.length > MAX_IMAGE_BASE64) {
      return NextResponse.json({ error: '画像が無効または大きすぎます' }, { status: 400 });
    }

    // ===== OCR (Google Vision) =====
    const base64Content = body.image.replace(/^data:image\/\w+;base64,/, '');
    const visionBody = {
      requests: [
        {
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: {
            languageHints: ['ja'],
            textDetectionParams: { enableTextDetectionConfidenceScore: true },
          },
        },
      ],
    };

    const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionBody),
    });

    if (!visionResponse.ok) {
      const err = await visionResponse.text();
      return NextResponse.json({ error: `Vision API Error: ${err}` }, { status: 500 });
    }

    const visionData = await visionResponse.json();
    const extractedText = String(visionData.responses?.[0]?.fullTextAnnotation?.text ?? '').trim();
    if (!extractedText) {
      return NextResponse.json({ error: '文字が読み取れませんでした' }, { status: 400 });
    }

    // 余計な空白を軽くならす（正規化しすぎない）
    const cleanText = extractedText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    // ===== KanCole item generation (OpenAI) =====
    const count = body.count;
    const system = [
      'あなたは日本語教材から「漢字語の読み」を作る先生です。',
      '入力はOCR/スキャン由来の本文です。',
      '本文に実際に出てきた「漢字語（2〜6文字程度）」だけを対象にし、読み問題を作ってください。',
      '',
      '出力は必ずJSONのみ（前後に説明文なし）。',
      'readingは「ひらがな」だけ。長音符や中黒は使わない。',
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
      cleanText.slice(0, 12000),
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
      return NextResponse.json({ error: `OpenAI Error: ${await openaiResponse.text()}` }, { status: 500 });
    }
    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'OpenAIの出力が空でした' }, { status: 500 });

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'OpenAI出力の解析に失敗しました' }, { status: 500 });
      json = JSON.parse(match[0]);
    }

    const parsed = ResSchema.partial({ clean_text: true }).parse({ ...(json as any), clean_text: cleanText });

    // term重複除去 + count制限
    const seen = new Set<string>();
    const uniq: any[] = [];
    for (const it of parsed.items ?? []) {
      const term = String(it.term ?? '').trim();
      if (!term || seen.has(term)) continue;
      seen.add(term);
      uniq.push({
        term,
        reading: String(it.reading ?? '').trim(),
        meaning: String(it.meaning ?? '').trim(),
        explanation: String(it.explanation ?? '').trim(),
        sourceSnippet: it.sourceSnippet ? String(it.sourceSnippet).trim() : undefined,
      });
      if (uniq.length >= count) break;
    }

    return NextResponse.json({ items: uniq, clean_text: cleanText });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

