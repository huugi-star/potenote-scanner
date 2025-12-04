import { NextResponse } from "next/server";
import { z } from "zod";

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
    // 後方互換用の既存フィールド
    text: z.string().optional(),
    translation: z.string().optional(),
    type: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']).optional(),
    // 新しいフィールド（AI出力形式）
    chunk_text: z.string(), // チャンクのテキスト（記号付き）
    chunk_translation: z.string(), // その部分だけの直訳
    role: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']), // 文の要素（役割）
    symbol: z.enum(['[]', '<>', '()', 'none']), // 囲む記号 ([名詞], <形容詞>, (副詞))
    explanation: z.string().optional(), // 解説 (例: "主語")
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

    // 2. 構造解析 (OpenAI)
    const systemPrompt = `あなたは伝説の英語講師です。
ユーザーがスキャンした英文を、**伊藤和夫氏の『ビジュアル英文解釈』**のように、**「意味の塊（チャンク）」**ごとに大きく区切り、文の構造を視覚的に解説してください。

## 絶対ルール：単語ごとにバラバラにするな！

× [An] [individual's] [somatic] [cells] ... 
○ [ An individual's somatic cells ] ... (これ全体で一つの主語Sとして扱う)

## 解析記号のルール

以下の記号を使って、文法的な役割を明確にせよ。

1. **[ ... ] (角カッコ)**: **名詞の塊**。主語(S)、目的語(O)、補語(C)になるもの。

2. **( ... ) (丸カッコ)**: **形容詞の塊**。名詞を後ろから詳しく説明するもの（関係詞節、分詞など）。

3. **< ... > (山カッコ)**: **副詞の塊**。動詞を説明するもの、前置詞句(M)、挿入語など。

4. **none**: 動詞(V)や接続詞は囲まない。

## 出力構成

英文を頭から順に「意味の切れ目」で区切り、以下のJSON形式で出力せよ。

【重要：ビジュアル化出力】 解析結果のJSONには、以下の3要素を必ず含めること。

- marked_text: 記号付きの全文（例: "[ The news ] ( that he died ) was false."）
- japanese_translation: 全文の自然な日本語訳
- chunks: 分割されたチャンク情報

各チャンクには以下を含める：
- chunk_text: チャンクのテキスト（記号なしの生テキスト）
- chunk_translation: その部分だけの直訳
- role: S, V, O, C, M, Connect(接続詞) のいずれか（型と役割のIDだけ）
- symbol: '[]', '<>', '()', 'none' のいずれか
- explanation: 簡単な解説（例：「〜を修飾」）

## 出力 (JSON)

{
  "marked_text": "[ The news ] ( that he died ) was false.",
  "japanese_translation": "彼が亡くなったという知らせは、誤りだった。",
  "chunks": [
    { "chunk_text": "The news", "chunk_translation": "その知らせは", "role": "S", "symbol": "[]", "explanation": "主語" },
    { "chunk_text": "that he died", "chunk_translation": "彼が亡くなったという", "role": "M", "symbol": "()", "explanation": "名詞を修飾" },
    { "chunk_text": "was", "chunk_translation": "だった", "role": "V", "symbol": "none", "explanation": "動詞" },
    { "chunk_text": "false", "chunk_translation": "誤り", "role": "C", "symbol": "none", "explanation": "補語" }
  ],
  "teacherComment": "アドバイス"
}`;

    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `以下のテキストを構造解析せよ:\n\n${extractedText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // 構造解析はブレないように低温度
      max_tokens: 4000 // 長文でも切れないように倍増
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

    // データの正規化とクリーニング
    if (!json.chunks || !Array.isArray(json.chunks)) {
      console.error("chunks is missing or not an array:", json.chunks);
      throw new Error("chunks is required and must be an array");
    }

    json.chunks = json.chunks.map((chunk: any) => {
      const cleaned: any = {
        // 新しいフィールド（必須）
        chunk_text: String(chunk.chunk_text || chunk.text || ""),
        chunk_translation: String(chunk.chunk_translation || chunk.translation || ""),
        role: chunk.role || chunk.type || 'M',
        symbol: chunk.symbol || 'none',
        // 後方互換用の既存フィールド
        text: chunk.chunk_text || chunk.text || "",
        translation: chunk.chunk_translation || chunk.translation || "",
        type: chunk.role || chunk.type || 'M',
      };
      
      if (chunk.explanation && chunk.explanation !== "" && chunk.explanation !== null) {
        cleaned.explanation = String(chunk.explanation);
      }
      
      return cleaned;
    });

    // teacherCommentのデフォルト値設定
    if (!json.teacherComment || json.teacherComment === null) {
      json.teacherComment = "よくできました！";
    } else {
      json.teacherComment = String(json.teacherComment);
    }
    
    // marked_textとjapanese_translationの確認（必須）
    if (!json.marked_text) {
      // 後方互換：chunksから生成
      json.marked_text = json.chunks.map((chunk: any) => {
        const text = chunk.chunk_text || chunk.text || "";
        if (chunk.symbol === '[]') return `[ ${text} ]`;
        if (chunk.symbol === '<>') return `< ${text} >`;
        if (chunk.symbol === '()') return `( ${text} )`;
        return text;
      }).join(' ');
    }
    
    if (!json.japanese_translation) {
      // 後方互換：translatedTextを使用
      if (json.translatedText) {
        json.japanese_translation = json.translatedText;
      } else {
        throw new Error("japanese_translation is required");
      }
    }
    
    // 後方互換用のoriginalTextとtranslatedTextの設定
    if (!json.originalText) {
      json.originalText = extractedText;
    }
    if (!json.translatedText) {
      json.translatedText = json.japanese_translation;
    }

    let validatedData;
    try {
      validatedData = TranslationSchema.parse(json);
      console.log("Validation successful!");
    } catch (validationError) {
      console.error("Zod validation error:", validationError);
      console.error("Data that failed validation:", JSON.stringify(json, null, 2));
      if (validationError instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(validationError.issues, null, 2));
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
