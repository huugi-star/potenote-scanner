import { NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Google Vision APIのエンドポイント
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// 章タイトルを抽出する関数
function extractChapterTitle(text: string): string | null {
  if (!text) return null;
  
  // テキストを行に分割
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 最初の10行から章タイトルを探す
  const firstLines = lines.slice(0, 10);
  
  // パターン1: 「第○章」「第○節」などの形式
  for (const line of firstLines) {
    const chapterMatch = line.match(/^(第[一二三四五六七八九十\d]+[章節])\s*(.+)$/);
    if (chapterMatch) {
      return chapterMatch[0].trim();
    }
  }
  
  // パターン2: 「○章」「○節」などの形式
  for (const line of firstLines) {
    const chapterMatch = line.match(/^([一二三四五六七八九十\d]+[章節])\s*(.+)$/);
    if (chapterMatch) {
      return chapterMatch[0].trim();
    }
  }
  
  // パターン3: 最初の長めの行（10文字以上30文字以下）をタイトル候補とする
  for (const line of firstLines) {
    if (line.length >= 10 && line.length <= 30 && 
        !line.includes('。') && 
        !line.match(/^\d+/) &&
        !line.includes('は') && !line.includes('を') && !line.includes('が')) {
      return line;
    }
  }
  
  // パターン4: 最初の行が短い場合（5文字以上15文字以下）もタイトル候補
  if (firstLines.length > 0) {
    const firstLine = firstLines[0];
    if (firstLine.length >= 5 && firstLine.length <= 15 && 
        !firstLine.includes('。') &&
        !firstLine.match(/^\d+$/)) {
      return firstLine;
    }
  }
  
  return null;
}

// Zodスキーマ定義
const LectureItemSchema = z.object({
  id: z.number(),
  type: z.enum(['introduction', 'question', 'silence', 'answer', 'explanation', 'review', 'summary', 'closing']),
  speaker: z.enum(['teacher', 'student']),
  text: z.string().optional(), // silenceタイプの場合は不要
  speechText: z.string().optional(),
  displayBoard: z.string().optional(),
  keyword: z.string().optional(),
  silenceSeconds: z.number().optional(),
}).refine((data) => {
  // silenceタイプ以外はtextが必須
  if (data.type !== 'silence' && !data.text) {
    return false;
  }
  // silenceタイプの場合はsilenceSecondsが必須
  if (data.type === 'silence' && !data.silenceSeconds) {
    return false;
  }
  return true;
}, {
  message: "text is required for non-silence items, silenceSeconds is required for silence items"
});

const LectureScriptSchema = z.object({
  items: z.array(LectureItemSchema),
  tone: z.enum(['normal', 'lazy', 'kyoto', 'ojousama', 'gal', 'sage']),
  sourceText: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text, tone = 'normal' } = body;

    let extractedText = text || "";

    // OCR処理（画像が提供された場合）
    if (!extractedText && image) {
      if (!process.env.GOOGLE_VISION_API_KEY) {
        return NextResponse.json(
          { error: "GOOGLE_VISION_API_KEY is not configured" },
          { status: 500 }
        );
      }

      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");

      const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Content },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      });

      if (!visionResponse.ok) {
        const err = await visionResponse.text();
        throw new Error(`Vision API Error: ${err}`);
      }

      const visionData = await visionResponse.json();
      extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || "";

      if (!extractedText) {
        return NextResponse.json(
          { error: "文字が読み取れませんでした" },
          { status: 400 }
        );
      }
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: "Text or image is required" },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Phase 1: 講義スクリプト生成
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const systemPrompt = `あなたは学習コンテンツを「暗記ドリル（音声教材）」に変換するMemory Optimization Engineです。

目的は、入力形式に依存せず、均質で周回可能な「問い → 想起 → 固定」を生成することです。

【Universal Extraction Rules】
入力テキストが以下のいずれであっても、適切に分類・変換してください。

1. 事実・歴史・法律：
- 主語・用語・日付・結果を抽出
- 問いは必ず主語を含める
- 答えは単語または短文のみ

2. 単語・定義：
- 定義を問い、用語を答えにする

3. 法則・数式：
- 現象または名称を問い、公式または結果を答えにする

4. 作品・人物：
- 作品 ↔ 作者、出来事 ↔ 人物 の対応関係を問う

【絶対制約】
- 挨拶・励まし・比喩・感想は禁止
- 教師口調（重要です・覚えましょう）禁止
- 問いは必ず具体的な主語を含める
- 出力は日本語
- Markdown装飾は禁止

【Drill Format】
すべて以下の構造を厳守：

問い（疑問形）
……（沈黙 n秒）
答え。
正解文（断定・1文）

【Explanationルール】
- 断定文のみ
- 感想・評価・指示は禁止
- 最大1文
- 情報追加は事実補足のみ

【Reviewルール】
- drills で出した内容の再確認のみ
- 新情報は禁止
- 問いは短縮形・主語付き

【黒板ルール】
- 黒板には必ず「質問文そのもの」を表示する
- 疑問文のまま、語尾を変えない
- 答えやヒントは一切書かない
- introduction, answer, explanation, summaryタイプでも黒板を使用する
- introductionのテキストは「[章タイトル] 重要事項を確認します」の形式とする（章タイトルがない場合は「重要事項を確認します」のみ）

【意味整合チェックルール】
- 問いと答えは「同じ概念レベル」で対応させること
- 問いが「いつ・どの場合」を聞いている場合、答えは「条件」ではなく「結果」にする
- 問いは20〜30文字程度に簡潔化する
- 正解文は事実を1文で述べる
- 終了文は「以上です。」のみとする
- 問いと正解文では主語と表現を完全に一致させること

【出力形式】
以下のJSON構造を厳守してください：

{
  "items": [
    {
      "id": 1,
      "type": "introduction",
      "speaker": "teacher",
      "text": "重要事項を確認します",
      "displayBoard": "重要事項を確認します"
    },
    {
      "id": 2,
      "type": "question",
      "speaker": "teacher",
      "text": "1600年の天下分け目の戦いは？",
      "displayBoard": "1600年の天下分け目の戦いは？"
    },
    {
      "id": 3,
      "type": "silence",
      "speaker": "teacher",
      "silenceSeconds": 3
    },
    {
      "id": 4,
      "type": "answer",
      "speaker": "student",
      "text": "関ヶ原の戦い",
      "keyword": "関ヶ原の戦い"
    },
    {
      "id": 5,
      "type": "explanation",
      "speaker": "teacher",
      "text": "関ヶ原の戦いは1600年に行われた天下分け目の戦いです",
      "displayBoard": "関ヶ原の戦いは1600年に行われた天下分け目の戦いです"
    },
    {
      "id": 6,
      "type": "closing",
      "speaker": "teacher",
      "text": "以上です。",
      "displayBoard": "以上です。"
    }
  ],
  "tone": "${tone}",
  "sourceText": "${extractedText.replace(/"/g, '\\"')}"
}`;

    const userContent = `以下はOCRで読み取った教材テキストです。このテキストから暗記用コール＆レスポンス台本を作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---

上記のテキストから、Memory Optimization Engineのルールに従って講義スクリプトを生成してください。

重要: レスポンスは必ず有効なJSON形式で返してください。Markdownコードブロックは使用しないでください。`;

    console.log("[generate-lecture] Phase 1: Generating lecture script...");

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
        },
      ],
    });

    const response = result.response;
    let responseText = response.text();

    // JSON抽出（responseMimeType: "application/json"を使用している場合、直接JSONが返される可能性がある）
    let jsonText = responseText.trim();
    
    // Markdownコードブロックを削除
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // 最初の{から最後の}までを抽出
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }

    let validatedData: z.infer<typeof LectureScriptSchema>;

    try {
      const json = JSON.parse(jsonText);
      console.log('[generate-lecture] Parsed JSON items count:', json.items?.length);
      console.log('[generate-lecture] Sample items:', json.items?.slice(0, 3));
      validatedData = LectureScriptSchema.parse(json);
      console.log('[generate-lecture] Validated data items count:', validatedData.items.length);
      
      // 章タイトルを抽出してintroductionに追加
      const chapterTitle = extractChapterTitle(extractedText);
      if (chapterTitle && validatedData.items.length > 0) {
        const firstItem = validatedData.items[0];
        if (firstItem.type === 'introduction') {
          const newText = `${chapterTitle} 重要事項を確認します`;
          const newDisplayBoard = `${chapterTitle} 重要事項を確認します`;
          validatedData.items[0] = {
            ...firstItem,
            text: newText,
            displayBoard: newDisplayBoard,
          };
          console.log('[generate-lecture] Added chapter title to introduction:', chapterTitle);
        }
      }
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error("[generate-lecture] JSON parse error:", errorMessage);
      console.error("[generate-lecture] Original response text:", responseText);
      console.error("[generate-lecture] Extracted JSON text:", jsonText);
      return NextResponse.json(
        { error: `Failed to parse or validate JSON: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Phase 2: speechText変換
    console.log("[generate-lecture] Phase 2: Converting to speech text...");

    const speechTextItems = validatedData.items
      .filter(item => ['question', 'answer', 'explanation'].includes(item.type) && item.text)
      .map(item => ({ id: item.id, text: item.text! }));
    
    console.log('[generate-lecture] Speech text items to convert:', speechTextItems.length);

    if (speechTextItems.length > 0) {
      const conversionPrompt = `以下の文章を音声読み上げ専用テキストに変換せよ。

ルール:
・漢字はひらがな
・数字は日本語読み
・専門用語は正しい読み
・意味は変えない
・speechTextのみをJSONで返す

変換対象:
${JSON.stringify(speechTextItems, null, 2)}

出力形式:
{
  "items": [
    { "id": 1, "speechText": "ひらがなに変換されたテキスト" },
    ...
  ]
}`;

      try {
        const conversionModel = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        
        const conversionResult = await conversionModel.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: conversionPrompt }],
            },
          ],
        });

        const conversionResponse = conversionResult.response.text();
        const conversionJsonMatch = conversionResponse.match(/\{[\s\S]*\}/);

        if (conversionJsonMatch) {
          const conversionJson = JSON.parse(conversionJsonMatch[0]) as { items?: Array<{ id: number; speechText: string }> };
          const speechTextMap = new Map<number, string>(
            (conversionJson.items || []).map((item) => [item.id, item.speechText])
          );

          // speechTextを追加
          validatedData.items = validatedData.items.map(item => {
            const speechText = speechTextMap.get(item.id);
            if (speechText !== undefined && typeof speechText === 'string') {
              return { ...item, speechText };
            }
            return item;
          });
        }
      } catch (conversionError) {
        console.error("[generate-lecture] Speech text conversion error:", conversionError);
        // エラーでも続行（speechTextなしで動作）
      }
    }

    // トークン数ログ
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      const promptTokens = usageMetadata.promptTokenCount || 0;
      const completionTokens = usageMetadata.candidatesTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || 0;
      console.log(`[generate-lecture] Tokens - Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens}`);
    }

    return NextResponse.json(validatedData);

  } catch (error: any) {
    console.error("[generate-lecture] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
