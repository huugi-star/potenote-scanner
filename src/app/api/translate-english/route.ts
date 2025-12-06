import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策（英語学習モードは処理に時間がかかるため120秒に設定）
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（一文完結型のリスト）
const TranslationSchema = z.object({
  sentences: z.array(z.object({
    marked_text: z.string(), // 構造化された原文（Big Chunkルール適用）
    translation: z.string(), // その文の和訳
    sub_structures: z.array(z.object({
      target_chunk: z.string(), // 分解対象の文字列（例: "that the world could..."）
      analyzed_text: z.string(), // 分解後のタグ付きテキスト（例: "[the world]<{S'}> could..."）
      explanation: z.string().optional() // その節の役割と内部構造の詳しい解説（日本語）
    })).optional(), // 複雑な部分の分解リスト（ズームイン解析）
    vocab_list: z.array(z.object({
      word: z.string(),   // 例: "keep up with"
      meaning: z.string(), // 例: "～に遅れずについていく"
      isIdiom: z.boolean().optional(), // イディオムかどうか
      explanation: z.string().optional() // イディオムの説明（isIdiomがtrueの場合に推奨）
    })).optional(), // 重要単語・熟語リスト
    grammar_note: z.string().optional(), // ワンポイント文法解説
    structure_explanations: z.array(z.object({
      target_text: z.string(), // 説明対象のテキスト（例: "because it frightened their horses"）
      explanation: z.string(), // 詳しい構造説明
      difficulty_level: z.enum(['easy', 'medium', 'hard']).optional() // 難易度（オプション）
    })).optional(), // 難しい部分の詳しい説明（アコーディオン用）
    advanced_grammar_explanation: z.string().nullable().optional() // 高度な文法解説（名詞節・WH節・倒置・関係詞の非制限用法など）
  }))
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

    // 2. 構造解析 (OpenAI) - 最適化されたプロンプト（トークン削減版）
    const systemPrompt = `あなたは「ビジュアル英文解釈（伊藤和夫メソッド）」の専門家です。英文を構造解析し、JSON形式で出力してください。

【基本ルール】
1. 省略の復元: 省略された接続詞(that)や関係詞(which)を( )で補完
2. 記号: [ ]=名詞(S/O/C), ( )=形容詞節, < >=副詞節・修飾語(M)
3. タグ: メイン構造は大文字(S/V/O/C/M)、従属節は小文字+ダッシュ(s'/v'/o'/c'/m')
4. 全文保持: 入力の全単語をmarked_textに含める（削除禁止）

【記号ルール（最重要）】
- 修飾語(M)は必ず< >を使用。[ ]は絶対に使わない
- 例: <quickly><{M}> ✓, [quickly]<{M}> ✗

【出力形式】
{
  "sentences": [{
    "marked_text": "[主語]<{S:_:意味}> 動詞<{V:_:意味}> [目的語]<{O:_:意味}>.",
    "translation": "自然な日本語訳",
    "vocab_list": [{"word": "単語", "meaning": "意味"}],
    "grammar_note": "文法解説",
    "sub_structures": [{
      "target_chunk": "節のテキスト",
      "analyzed_text": "that<{conn}> [he]<{s':_:彼が}> is<{v':_:～である}> [honest]<{c':_:正直な}>",
      "explanation": "節の役割と内部構造の説明"
    }],
    "structure_explanations": [{
      "target_text": "説明対象のテキスト",
      "explanation": "詳しい説明",
      "difficulty_level": "medium"
    }]
  }]
}

【例】
Input: "Many people think we need more laws."
Output:
{
  "sentences": [{
    "marked_text": "[Many people]<{S:_:多くの人々は}> think<{V:_:考える}> [ (that) we need more laws ]<{O:_:～ということを}>.",
    "translation": "多くの人々は、我々がより多くの法律を必要とする（ということを）考える。",
    "vocab_list": [{"word": "law", "meaning": "法律"}],
    "grammar_note": "thinkの直後に省略された接続詞thatがあります。このthat節は名詞節で、thinkの目的語(O)になっています。",
    "sub_structures": [{
      "target_chunk": "(that) we need more laws",
      "analyzed_text": "(that)<{conn}> [we]<{s':_:我々が}> need<{v':_:必要とする}> [more laws]<{o':_:より多くの法律を}>",
      "explanation": "このthat節は名詞節で、thinkの目的語(O)です。内部ではweが主語(s')、needが動詞(v')、more lawsが目的語(o')です。"
    }]
  }]
}

【必須生成条件】
- sub_structures: 名詞節・形容詞節・副詞節がある場合は必ず生成
- structure_explanations: 名詞節・長文・複雑な構造がある場合に生成
- 全単語をmarked_textに含める（削除禁止）

出力はJSONのみ。説明文は不要。`;

    // テキストが長すぎる場合は切り詰める（1300文字まで）
    const maxTextLength = 1300;
    const truncatedText = extractedText.length > maxTextLength 
      ? extractedText.substring(0, maxTextLength) + "..."
      : extractedText;
    
    // デバッグ: 切り詰め前後の文字数をログ出力
    console.log(`[translate-english] Original text length: ${extractedText.length}, Truncated length: ${truncatedText.length}`);

    // generateTextを使用して通常のAPI呼び出し（ストリーミングなし）
    try {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `${systemPrompt}\n\n${truncatedText}\n\nJSON:`,
        temperature: 0.3,
        maxTokens: 3000,
      });

      // JSONをパース
      let parsedResult;
      try {
        // JSON部分を抽出（```json や ``` を除去）
        let jsonText = text.trim();
        
        // マークダウンコードブロックを除去
        jsonText = jsonText.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
        
        // JSONオブジェクトを抽出（最初の{から最後の}まで）
        const jsonMatch = jsonText.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
          throw new Error('JSON object not found in AI response');
        }
        
        jsonText = jsonMatch[1];
        
        // デバッグ用：JSONテキストの最初と最後の100文字をログ出力
        console.log('=== JSON Parse Debug ===');
        console.log('JSON text length:', jsonText.length);
        console.log('First 200 chars:', jsonText.substring(0, 200));
        console.log('Last 200 chars:', jsonText.substring(Math.max(0, jsonText.length - 200)));
        
        parsedResult = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error('=== JSON Parse Error ===');
        console.error('Error:', parseError.message);
        console.error('Raw text length:', text.length);
        console.error('Raw text (first 500 chars):', text.substring(0, 500));
        console.error('Raw text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
        
        // より詳細なエラーメッセージを返す
        throw new Error(`AIの出力をJSONとして解析できませんでした: ${parseError.message}`);
      }

      // バリデーション
      const validatedResult = TranslationSchema.parse(parsedResult);

      // 記号の正規化: M（修飾語）が[]で囲まれている場合は<>に変換
      const normalizeMarkedText = (text: string): string => {
        if (!text) return text;
        
        // [text]<{M...}> のパターンを <text><{M...}> に変換
        // ネストしたカッコにも対応するため、より柔軟な正規表現を使用
        // パターン1: [text]<{M...}> → <text><{M...}>
        let normalized = text.replace(/\[([^\]]+)\]<\{M([^}]*)\}>/g, '<$1><{M$2}>');
        
        // パターン2: [text]<{M:...}> → <text><{M:...}>
        normalized = normalized.replace(/\[([^\]]+)\]<\{M:([^}]*)\}>/g, '<$1><{M:$2}>');
        
        // パターン3: [text]<{M:...:...}> → <text><{M:...:...}>
        normalized = normalized.replace(/\[([^\]]+)\]<\{M:([^}]*):([^}]*)\}>/g, '<$1><{M:$2:$3}>');
        
        return normalized;
      };

      // 各文のmarked_textを正規化
      if (validatedResult.sentences) {
        validatedResult.sentences = validatedResult.sentences.map(sentence => ({
          ...sentence,
          marked_text: normalizeMarkedText(sentence.marked_text),
          // sub_structuresのanalyzed_textも正規化
          sub_structures: sentence.sub_structures?.map(sub => ({
            ...sub,
            analyzed_text: normalizeMarkedText(sub.analyzed_text || '')
          }))
        }));
      }

      return NextResponse.json(validatedResult);
    } catch (generateError: any) {
      console.error('翻訳処理エラー:', generateError);
      throw new Error(`翻訳処理に失敗しました。詳細: ${generateError.message}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to translate", details: errorMessage },
      { status: 500 }
    );
  }
}
