import { NextResponse } from "next/server";
import { z } from "zod";

// Google Vision APIのエンドポイント
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// Node.js Runtime (タイムアウト60秒)
export const maxDuration = 60;

// ハルシネーション防止用の型定義
const QuizSchema = z.object({
  summary: z.string(),
  keywords: z.array(z.string()),
  questions: z.array(
    z.object({
      q: z.string(),
      options: z.array(z.string()),
      a: z.number(),
      explanation: z.string(),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text, verifiedFacts } = body;

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
                languageHints: ["ja", "en"],
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

      // OCR結果をログ出力（デバッグ用）
      console.log("=== OCR RESULT ===");
      console.log(extractedText);
      console.log("==================");
    }

    if (!extractedText) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }

    // ===== Step 2: クイズ生成（OpenAI）=====
    console.log("Step 2: Quiz generation with OpenAI...");

    const systemPrompt = `あなたは学習教材からクイズを作成する専門家です。

入力されるテキストはOCRで読み取られた教材です。

## 教材の構造を理解する

教材には以下のパターンがあります：
- 問題番号（1, 2, ①, (1)など）の後に問題文
- 「解答」「正解」「答」などのセクションに正解が記載
- 問題と解答の番号は対応している

## 重要：正解の特定方法

1. テキスト内の「解答」「正解」「答」セクションを探す
2. そこに書かれた内容が各問題の正解
3. 問題文の中の記述は「問い」であり「答え」ではない

## クイズ作成ルール

- 問題数：5問
- options[0]に正解を入れる
- 誤答は正解と紛らわしいが明確に間違いの選択肢
- 解説は60文字以内

## 出力 (JSON)
{
  "summary": "教材の要約",
  "keywords": ["重要語句1", "重要語句2"],
  "questions": [
    { "q": "問題文", "options": ["正解", "誤答1", "誤答2", "誤答3"], "a": 0, "explanation": "解説" }
  ]
}`;

    let userContent = `以下はOCRで読み取った教材テキストです。このテキストからクイズを作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---`;
    
    // 温度設定（新問題生成時は高めに）
    let temperature = 0.3;
    
    if (verifiedFacts) {
      userContent += `

★★★【重要：以下の問題は既に出題済み。絶対に同じ問題を作るな】★★★
${verifiedFacts}

上記と同じ問いかけ、同じ切り口の問題は禁止。
必ず異なる視点、異なるトピック、異なる問い方で新しい問題を作成せよ。`;
      
      // 新問題生成時は温度を上げて多様性を出す
      temperature = 0.8;
    }

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: userContent
        }
      ],
      response_format: { type: "json_object" },
      temperature,
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

    // 正解インデックスをシャッフル
    if (json.questions) {
      json.questions = json.questions.map((q: { options: string[]; a: number }) => {
        const correctAnswer = q.options[q.a];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        const newIndex = shuffled.indexOf(correctAnswer);
        return { ...q, options: shuffled, a: newIndex };
      });
    }

    const validatedData = QuizSchema.parse(json);

    return NextResponse.json({
      quiz: validatedData,
      ocrText: extractedText,
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz", details: String(error) },
      { status: 500 }
    );
  }
}