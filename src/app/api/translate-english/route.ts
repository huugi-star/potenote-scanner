import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策（英語学習モードは処理に時間がかかるため120秒に設定）
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（ビジュアル解説用）
const TranslationSchema = z.object({
  originalText: z.string().optional(), // 後方互換用
  translatedText: z.string().optional(), // 後方互換用
  // 新しいフィールド（AI出力形式）
  marked_text: z.string().min(1), // 記号付きの全文（必須）
  japanese_translation: z.string().min(1), // 全文の自然な日本語訳（必須）
  // チャンク（意味の塊）ごとのリスト
  chunks: z.array(z.object({
    // 新しいフィールド（AI出力形式）
    chunk_text: z.string().min(1), // チャンクのテキスト（記号なしの生テキスト、必須）
    chunk_translation: z.string().min(1), // その部分だけの直訳（必須）
    role: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']), // 文の要素（役割、必須）
    symbol: z.enum(['[]', '<>', '()', 'none']), // 囲む記号 ([名詞], <形容詞>, (副詞)、必須)
    explanation: z.string().optional(), // 解説 (例: "主語")
    // 後方互換用の既存フィールド
    text: z.string().optional(),
    translation: z.string().optional(),
    type: z.enum(['S', 'V', 'O', 'C', 'M', 'Connect']).optional(),
  })).min(1), // chunksは少なくとも1つ必要
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
    const systemPrompt = `You are an expert English teacher. Parse and translate the ENTIRE English text provided into Japanese with visual structure analysis.

CRITICAL: You MUST parse and translate EVERY sentence. Do NOT truncate, summarize, or skip any part.

【Symbol Rules】
- [ ]: Noun chunks (S/O/C)
- ( ): Adjective chunks (modifying nouns)
- < >: Adverb chunks (modifying verbs)
- none: Verbs (V) or conjunctions

【Output Format】Output ONLY valid JSON matching this exact structure:
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
}

IMPORTANT: 
- "marked_text" must contain the FULL text with symbols
- "japanese_translation" must be the COMPLETE translation
- "chunks" must be an array with ALL parts of the sentence
- Each chunk MUST have: chunk_text, chunk_translation, role, symbol
- role must be one of: S, V, O, C, M, Connect
- symbol must be one of: [], <>, (), none`;

    // テキストが長すぎる場合は切り詰める（2000文字まで）
    const maxTextLength = 2000;
    const truncatedText = extractedText.length > maxTextLength 
      ? extractedText.substring(0, maxTextLength) + "..."
      : extractedText;

    // generateObjectを使用（ストリーミング廃止）
    console.log("Translation Start...");
    console.log("Text length:", truncatedText.length);
    
    let result;
    try {
      result = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: TranslationSchema,
        prompt: `${systemPrompt}\n\nParse and translate this text:\n\n${truncatedText}`,
        temperature: 0.2,
        maxTokens: 8192, // 長文でも切れないように8192に設定
      });

      console.log("Translation completed");
      console.log("Result keys:", Object.keys(result.object));
      console.log("Has marked_text:", !!result.object.marked_text);
      console.log("Has japanese_translation:", !!result.object.japanese_translation);
      console.log("Chunks count:", result.object.chunks?.length || 0);
      console.log("Result preview:", JSON.stringify(result.object, null, 2).substring(0, 1000));
    } catch (generateError: any) {
      console.error("GenerateObject error:", generateError);
      console.error("Error name:", generateError.name);
      console.error("Error message:", generateError.message);
      console.error("Error stack:", generateError.stack);
      
      // スキーマエラーの場合、詳細をログに出力
      if (generateError.message?.includes('schema') || 
          generateError.message?.includes('match') ||
          generateError.message?.includes('No object generated') ||
          generateError.cause) {
        console.error("Schema validation failed. This usually means the AI output didn't match the expected format.");
        console.error("The text might be too long or the AI couldn't generate valid JSON.");
        console.error("Full error:", JSON.stringify(generateError, Object.getOwnPropertyNames(generateError), 2));
        
        // より詳細なエラーメッセージを返す
        const errorDetails = generateError.cause?.message || generateError.message || 'Unknown error';
        throw new Error(`AI出力がスキーマに一致しませんでした。テキストが長すぎるか、形式が正しくない可能性があります。詳細: ${errorDetails}`);
      }
      throw generateError;
    }

    // データの正規化とクリーニング
    const json = result.object;

    // chunksの後方互換性処理
    if (json.chunks && Array.isArray(json.chunks)) {
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
    }

    // teacherCommentのデフォルト値設定
    if (!json.teacherComment || json.teacherComment === null) {
      json.teacherComment = "よくできました！";
    } else {
      json.teacherComment = String(json.teacherComment);
    }
    
    // 後方互換用のoriginalTextとtranslatedTextの設定
    if (!json.originalText) {
      json.originalText = extractedText;
    }
    if (!json.translatedText) {
      json.translatedText = json.japanese_translation || '';
    }

    // バリデーション
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
