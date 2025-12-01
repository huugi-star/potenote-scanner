import { NextResponse } from "next/server";
import { z } from "zod";

// Google Vision APIのエンドポイント
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策と動的レンダリング設定
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義
const TranslationSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text } = body;

    let extractedText = text || "";

    // ===== Step 1: OCR（Google Vision API）=====
    if (!extractedText && image) {
      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");

      console.log("Step 1: OCR with Google Vision API (DOCUMENT_TEXT_DETECTION)...");

      const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Content },
              features: [
                { 
                  type: "DOCUMENT_TEXT_DETECTION",
                  maxResults: 50
                }
              ],
              imageContext: {
                languageHints: ["en", "ja", "zh", "ko", "es", "fr", "de"],
                textDetectionParams: {
                  enableTextDetectionConfidenceScore: true
                }
              }
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        throw new Error(`Google Vision API Error: ${errText}`);
      }

      const visionData = await visionResponse.json();
      extractedText = visionData.responses[0]?.fullTextAnnotation?.text || "";

      if (!extractedText) {
        return NextResponse.json({ error: "No text found (OCR failed)" }, { status: 400 });
      }

      console.log("OCR Success. Text length:", extractedText.length);
    }

    if (!extractedText) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }

    // ===== Step 2: 翻訳（OpenAI）=====
    console.log("Step 2: Translation with OpenAI...");

    const systemPrompt = `あなたはプロの翻訳家兼、学習アドバイザーです。
画像から読み取ったテキストを、学習者が理解しやすい自然な日本語に翻訳してください。

## 翻訳ルール

1. **自然な日本語**: 機械翻訳のような不自然な表現を避け、自然な日本語に翻訳してください。

2. **教育的配慮**: 専門用語には（）で簡単な補足を添えるなど、教育的な配慮を行ってください。

3. **文脈の保持**: 原文の文脈やニュアンスをできるだけ保持してください。

4. **構造の維持**: 段落や改行などの構造は可能な限り維持してください。

## 出力 (JSON)

{
  "originalText": "原文（OCRで読み取ったテキスト）",
  "translatedText": "翻訳後の日本語テキスト"
}`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `以下のテキストを日本語に翻訳してください:\n\n${extractedText}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000
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
    if (!content) throw new Error("No content");

    const json = JSON.parse(content);
    const validatedData = TranslationSchema.parse(json);

    return NextResponse.json({
      originalText: validatedData.originalText,
      translatedText: validatedData.translatedText,
      ocrText: extractedText,
    });

  } catch (error) {
    console.error("Translation API Error:", error);
    return NextResponse.json(
      { error: "Failed to translate", details: String(error) },
      { status: 500 }
    );
  }
}

