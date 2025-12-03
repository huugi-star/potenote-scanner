import { NextResponse } from "next/server";
import { z } from "zod";

// Google Vision API (OCR用)
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（ビジュアル英文解釈用）
const TranslationSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(), // 自然な意訳
  
  // ★ビジュアル英文解釈：単語レベルの構造解析
  structureAnalysis: z.array(z.object({
    word: z.string(),           // 単語または句 (例: "I", "met", "a man")
    visualMarkup: z.string(),   // 記号付き表示 (例: "[I]", "met", "<a> [man]")
    grammaticalRole: z.string(), // 文法的役割 (例: "S", "V", "O", "C", "修飾語")
    meaning: z.string(),        // 意味 (例: "私は", "会った", "ある男性を")
    modifies: z.string().optional(), // 修飾先（被修飾語）(例: "man" を修飾する場合は "man")
    grammarNote: z.string().optional(), // ワンポイント解説
  })),
  
  // 文の骨組み（S, V, O, C）
  sentenceStructure: z.object({
    subject: z.string(),        // 主語 (例: "[I]")
    verb: z.string(),          // 動詞 (例: "met")
    object: z.string().optional(), // 目的語 (例: "<a> [man]")
    complement: z.string().optional(), // 補語
  }),
  
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

    // 2. 翻訳 & 構造解析 (OpenAI) - ビジュアル英文解釈メソッド
    const systemPrompt = `あなたは伊藤和夫氏の『ビジュアル英文解釈』のメソッドを再現するAIです。
英文を単に翻訳するのではなく、**構造を理解するための解剖図**として可視化してください。

## 記号ルール（必須）
- **[ 名詞 ]**: 名詞を角カッコで囲む
- **( 副詞 )**: 副詞を丸カッコで囲む
- **< 形容詞 >**: 形容詞を山カッコで囲む
- **S, V, O, C**: 文の骨組みを明確に分離

## 解析ルール
1. **単語レベルで分解**: チャンクではなく、単語または最小の意味単位で分解すること。
2. **記号で可視化**: 各単語に [名詞], (副詞), <形容詞> の記号を付けること。
3. **S, V, O, C の明示**: 文の骨組み（主語・動詞・目的語・補語）を明確に分離すること。
4. **修飾関係の明示**: 修飾語句については「どの単語にかかっているか（被修飾語）」を明示すること。
5. **前方からの理解**: 日本語訳は「前から順に意味を取る訳」にすること。

## 出力フォーマット (JSON)
{
  "originalText": "原文（OCR補正済み）",
  "translatedText": "全体の自然な日本語訳（答え合わせ用）",
  "structureAnalysis": [
    {
      "word": "I",
      "visualMarkup": "[I]",
      "grammaticalRole": "S",
      "meaning": "私は",
      "modifies": null,
      "grammarNote": "主語"
    },
    {
      "word": "met",
      "visualMarkup": "met",
      "grammaticalRole": "V",
      "meaning": "会った",
      "modifies": null,
      "grammarNote": "動詞"
    },
    {
      "word": "a",
      "visualMarkup": "<a>",
      "grammaticalRole": "修飾語",
      "meaning": "ある",
      "modifies": "man",
      "grammarNote": "manを修飾"
    },
    {
      "word": "man",
      "visualMarkup": "[man]",
      "grammaticalRole": "O",
      "meaning": "男性を",
      "modifies": null,
      "grammarNote": "目的語"
    },
    {
      "word": "who",
      "visualMarkup": "[who]",
      "grammaticalRole": "関係詞",
      "meaning": "その人は",
      "modifies": "man",
      "grammarNote": "manを説明する関係詞"
    },
    {
      "word": "wanted",
      "visualMarkup": "wanted",
      "grammaticalRole": "V",
      "meaning": "欲しがっていた",
      "modifies": null,
      "grammarNote": ""
    },
    {
      "word": "to buy",
      "visualMarkup": "(to buy)",
      "grammaticalRole": "修飾語",
      "meaning": "買うことを",
      "modifies": "wanted",
      "grammarNote": "wantedを修飾"
    },
    {
      "word": "the",
      "visualMarkup": "<the>",
      "grammaticalRole": "修飾語",
      "meaning": "その",
      "modifies": "car",
      "grammarNote": "carを修飾"
    },
    {
      "word": "car",
      "visualMarkup": "[car]",
      "grammaticalRole": "O",
      "meaning": "車を",
      "modifies": null,
      "grammarNote": "buyの目的語"
    }
  ],
  "sentenceStructure": {
    "subject": "[I]",
    "verb": "met",
    "object": "<a> [man] [who] wanted (to buy) <the> [car]",
    "complement": null
  },
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

    // grammarNoteとmodifiesが空文字列またはnullの場合はundefinedに変換
    if (json.structureAnalysis && Array.isArray(json.structureAnalysis)) {
      json.structureAnalysis = json.structureAnalysis.map((item: any) => ({
        ...item,
        grammarNote: item.grammarNote === "" || !item.grammarNote ? undefined : item.grammarNote,
        modifies: item.modifies === "" || !item.modifies || item.modifies === null ? undefined : item.modifies,
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

