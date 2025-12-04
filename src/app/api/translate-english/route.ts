import { NextResponse } from "next/server";
import { z } from "zod";
import { streamObject } from "ai";
import { openai } from "@ai-sdk/openai";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（ビジュアル解説用）
const TranslationSchema = z.object({
  originalText: z.string().optional(), // 後方互換用
  translatedText: z.string().optional(), // 後方互換用
  // 新しいフィールド（AI出力形式）
  marked_text: z.string(), // 記号付きの全文
  japanese_translation: z.string(), // 全文の自然な日本語訳
  // チャンク（意味の塊）ごとのリスト
  chunks: z.array(z.object({
    // 新しいフィールド（AI出力形式）
    chunk_text: z.string(), // チャンクのテキスト（記号なしの生テキスト）
    chunk_translation: z.string(), // その部分だけの直訳
    role: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']), // 文の要素（役割）
    symbol: z.enum(['[]', '<>', '()', 'none']), // 囲む記号 ([名詞], <形容詞>, (副詞))
    explanation: z.string().optional(), // 解説 (例: "主語")
    // 後方互換用の既存フィールド
    text: z.string().optional(),
    translation: z.string().optional(),
    type: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']).optional(),
  })),
  teacherComment: z.string().optional(),
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
      if (!image) return NextResponse.json({ error: "No data" }, { status: 400 });
      
      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");
      const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Content },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }]
        })
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        throw new Error(`Vision API Error: ${errText}`);
      }
      
      const visionData = await visionResponse.json();
      extractedText = visionData.responses[0]?.fullTextAnnotation?.text;

      if (!extractedText) return NextResponse.json({ error: "No text found" }, { status: 400 });
    }

    console.log("Translation Start...");
    console.log("Extracted text:", extractedText.substring(0, 200));

    // 2. 構造解析 (OpenAI) - プロンプトを最適化
    const systemPrompt = `英文をビジュアル英文解釈形式で構造解析してください。

【記号ルール】
- [ ]: 名詞の塊（S/O/C）
- ( ): 形容詞の塊（名詞修飾）
- < >: 副詞の塊（動詞修飾）
- none: 動詞(V)や接続詞

【出力形式】JSONのみ出力：
{
  "marked_text": "[ The news ] ( that he died ) was false.",
  "japanese_translation": "彼が亡くなったという知らせは、誤りだった。",
  "chunks": [
    { "chunk_text": "The news", "chunk_translation": "その知らせは", "role": "S", "symbol": "[]", "explanation": "主語" },
    { "chunk_text": "that he died", "chunk_translation": "彼が亡くなったという", "role": "M", "symbol": "()", "explanation": "名詞修飾" },
    { "chunk_text": "was", "chunk_translation": "だった", "role": "V", "symbol": "none", "explanation": "" },
    { "chunk_text": "false", "chunk_translation": "誤り", "role": "C", "symbol": "none", "explanation": "" }
  ],
  "teacherComment": "短いコメント"
}`;

    // テキストが長すぎる場合は切り詰める（1500文字まで）
    const maxTextLength = 1500;
    const truncatedText = extractedText.length > maxTextLength 
      ? extractedText.substring(0, maxTextLength) + "..."
      : extractedText;

    // ストリーミングAPIを使用
    const result = await streamObject({
      model: openai("gpt-4o-mini"),
      schema: TranslationSchema,
      prompt: `${systemPrompt}\n\n以下のテキストを構造解析せよ:\n\n${truncatedText}`,
      temperature: 0.2,
      maxTokens: 5000, // 長文でも切れないように5000を維持
    });

    // ストリーミングレスポンスを返す
    return result.toDataStreamResponse();
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
