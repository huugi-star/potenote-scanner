import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義
const MultilangTranslationSchema = z.object({
  summary: z.string().describe("3行まとめ（要旨）。翻訳結果の冒頭に必ず表示される要約"),
  translatedText: z.string().describe("全文の翻訳（口調変換と専門用語の補足説明を含む）"),
  textType: z.enum(['academic', 'email', 'manual', 'general']).describe("判定されたテキストタイプ"),
  tone: z.string().describe("使用された口調の説明（例: '論理的・硬め'、'親しみやすく'、'簡潔・命令形'）"),
  technicalTerms: z.array(z.object({
    term: z.string(),
    explanation: z.string()
  })).optional().describe("専門用語とその補足説明のリスト")
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text } = body;
    let extractedText = text;

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
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: {
              languageHints: ["en", "ja", "zh", "ko", "fr", "de", "es", "it", "pt", "ru", "ar", "hi", "th", "vi"]
            }
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

    // 2. 多言語翻訳処理 (OpenAI)
    const systemPrompt = `あなたは多言語翻訳の専門家です。入力されたテキストを、以下の仕様に従って日本語に翻訳してください。

【必須機能】

1. **要約（3行まとめ）**
   - 翻訳結果の冒頭に、必ず「3行まとめ（要旨）」を追加してください。
   - 形式: 「📋 3行まとめ\n[要約内容を3行で]」
   - 論文や長文記事の場合、「この記事、読む価値あるかな？」を瞬時に判断できる内容にしてください。

2. **口調変換（TPOに合わせた自動判定）**
   入力されたテキストの種類を自動判定し、適切な口調で翻訳してください：
   
   - **論文・契約書**: 「～である」「～と推定される」「～と考えられる」（論理的・硬め）
   - **メール・チャット**: 「～です」「～ですよね」「～ですね」（親しみやすく）
   - **マニュアル**: 「～してください」「～禁止」「～すること」（簡潔・命令形）
   - **一般記事**: 「～です」「～ます」（標準的な丁寧語）

3. **専門用語の補足説明**
   翻訳の中に難しい専門用語が出てきたら、自動的に（注釈）を入れてください。
   
   例:
   - 原文: "...using CRISPR-Cas9..."
   - 翻訳: 「...クリスパー・キャスナイン**（遺伝子編集技術の一種）**を用いて...」
   
   - 原文: "...quantum computing..."
   - 翻訳: 「...量子コンピューティング**（量子力学の原理を利用した計算技術）**...」

【出力形式】

JSON形式で以下の構造で出力してください：
{
  "summary": "3行まとめ（要旨）の内容",
  "translatedText": "全文の翻訳（要約を含む）",
  "textType": "academic" | "email" | "manual" | "general",
  "tone": "使用された口調の説明",
  "technicalTerms": [
    {
      "term": "専門用語",
      "explanation": "補足説明"
    }
  ]
}

【重要】
- translatedTextの冒頭に必ず「📋 3行まとめ\n[要約内容]\n\n」を含めてください
- 専門用語には必ず**（注釈）**を追加してください（太字で囲む）
- テキストタイプを正確に判定してください（academic, email, manual, general）
- 口調を一貫して保ってください
- summaryフィールドには、translatedTextの冒頭の要約部分を抽出して入れてください`;

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: `以下のテキストを翻訳してください：\n\n${extractedText}`,
      temperature: 0.3,
    });

    // トークン使用量をログ（ターミナル出力）
    const usage: any = (result as any)?.usage ?? {};
    const promptTokens = usage.promptTokens ?? usage.prompt_tokens ?? 0;
    const completionTokens = usage.completionTokens ?? usage.completion_tokens ?? 0;
    const totalTokens = usage.totalTokens ?? usage.total_tokens ?? (promptTokens + completionTokens);
    console.log(`[translate] Tokens - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens}`);

    // JSONパース
    let parsedResult;
    try {
      // テキストからJSONを抽出
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("JSON not found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // フォールバック: シンプルな翻訳結果を返す
      parsedResult = {
        summary: "要約を生成できませんでした",
        translatedText: result.text,
        textType: "general",
        tone: "標準的な丁寧語",
        technicalTerms: []
      };
    }

    // バリデーション
    const validated = MultilangTranslationSchema.parse(parsedResult);

    // 後方互換性のため、TranslationResult形式に変換
    const translationResult = {
      originalText: extractedText,
      translatedText: validated.translatedText,
      summary: validated.summary,
      textType: validated.textType,
      tone: validated.tone,
      technicalTerms: validated.technicalTerms || []
    };

    return NextResponse.json(translationResult);
  } catch (error: any) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: error.message || "Translation failed" },
      { status: 500 }
    );
  }
}
