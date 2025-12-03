import { NextResponse } from "next/server";
import { z } from "zod";

// Google Vision API (OCR用)
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（ビジュアル解説用）
const TranslationSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(), // 自然な意訳
  
  // ★ここがキモ：ビジュアル解説用の構造データ
  structureAnalysis: z.array(z.object({
    chunk: z.string(),      // 英語の塊 (例: "I met a man")
    meaning: z.string(),    // その意味 (例: "私は男性に会った")
    role: z.string(),       // 役割 (例: "主節(S+V)", "関係詞節", "接続詞" など)
    grammarNote: z.string().optional().or(z.literal("")), // ワンポイント解説 (例: "whoはmanを説明している")
  })),
  teacherComment: z.string(), // 先生からの総評
});

export async function POST(req: Request) {
  try {
    console.log("translate-english API called");
    const body = await req.json();
    const { image, text } = body;
    let extractedText = text;
    
    console.log("Request body:", { hasImage: !!image, hasText: !!text, textLength: text?.length });

    // 1. OCR処理 (Google Vision API)
    if (!extractedText) {
      if (!image) {
        return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
      }
      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");
      
      const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Content },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }] 
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        throw new Error(`Google Vision API Error: ${errText}`);
      }

      const visionData = await visionResponse.json();
      extractedText = visionData.responses[0]?.fullTextAnnotation?.text;

      if (!extractedText) {
        return NextResponse.json({ error: "No text found" }, { status: 400 });
      }
    }

    console.log("Translation Start...");

    // 2. 翻訳 & 構造解析 (OpenAI)
    const systemPrompt = `あなたは「直読直解」を指導するプロの英語講師です。
ユーザーがスキャンした英文を、**「英語の語順のまま理解できる」**ように、意味の塊（チャンク）ごとに分解して解説してください。
かつての「ビジュアル英文解釈」のように、文の構造（S+V+Oや修飾関係）を明確に示してください。

## 解説ルール
1. **チャンク分割**: 意味の切れ目（関係詞の前、前置詞の前、接続詞の前など）で文を区切ること。
2. **前方からの理解**: 日本語訳は「後ろから戻る訳」ではなく、「前から順に意味を取る訳」にすること。
3. **役割の明示**: 各チャンクが「主語・動詞（メイン）」なのか、「修飾（説明）」なのかをラベル付けすること。
4. **文法用語の抑制**: 難しい用語は避け、「〜という説明」「〜する時」といった直感的な言葉を使うこと。

## 出力フォーマット (JSON)
{
  "originalText": "原文（OCR補正済み）",
  "translatedText": "全体の自然な日本語訳（答え合わせ用）",
  "structureAnalysis": [
    {
      "chunk": "I met a man",
      "meaning": "私はある男性に会った",
      "role": "メイン(S+V)",
      "grammarNote": "まずは誰が何をしたか結論"
    },
    {
      "chunk": "who wanted to buy",
      "meaning": "その人は買いたがっていた",
      "role": "説明(関係詞)",
      "grammarNote": "whoはその人の説明が始まる合図"
    },
    {
      "chunk": "the car.",
      "meaning": "その車をね。",
      "role": "目的語(O)",
      "grammarNote": ""
    }
  ],
  "teacherComment": "学習者への励ましとアドバイス（60文字以内）"
}`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `以下のテキストを構造解析してください:\n\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, 
      max_tokens: 2000
    };

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(openaiPayload)
    });

    if (!openaiResponse.ok) {
       const err = await openaiResponse.text();
       throw new Error(`OpenAI Error: ${err}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0]?.message?.content;

    if (!content) {
      console.error("OpenAI response has no content:", JSON.stringify(openaiData, null, 2));
      throw new Error("No content from OpenAI");
    }

    console.log("OpenAI content received:", content.substring(0, 200));

    let json;
    try {
      json = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content that failed to parse:", content);
      throw new Error(`Failed to parse JSON: ${String(parseError)}`);
    }

    console.log("Parsed JSON:", JSON.stringify(json, null, 2));

    // grammarNoteが空文字列の場合はundefinedに変換
    if (json.structureAnalysis && Array.isArray(json.structureAnalysis)) {
      json.structureAnalysis = json.structureAnalysis.map((item: any) => ({
        ...item,
        grammarNote: item.grammarNote === "" || !item.grammarNote ? undefined : item.grammarNote,
      }));
    }

    let validatedData;
    try {
      validatedData = TranslationSchema.parse(json);
    } catch (validationError) {
      console.error("Zod validation error:", validationError);
      console.error("Data that failed validation:", JSON.stringify(json, null, 2));
      if (validationError instanceof z.ZodError) {
        console.error("Validation errors:", validationError.issues);
      }
      throw new Error(`Validation failed: ${String(validationError)}`);
    }

    return NextResponse.json(validatedData);
  } catch (error) {
    console.error("Translation API Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      { error: "Failed to translate", details: errorMessage },
      { status: 500 }
    );
  }
}

