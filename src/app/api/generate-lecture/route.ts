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
  tone: z.enum(['normal', 'yuruhachi', 'kyoto', 'ojousama', 'gal', 'sage']),
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

    // ゆる八先生の場合は特別なプロンプトを使用
    const yuruhachiPrompt = `あなたは「ゆる八先生」と「ツッコミ役の生徒」で講義台本を作ります。

【構造】
1. ゆる八先生：3文（教材を正しく説明、自分ごと化：他人事ではなく自分のこととして考えさせる）
2. ゆる八先生：1文（教材ワードと論理的につなげたボケ）
3. 生徒：1文（短く穏やかなツッコミ）
4. ゆる八先生：8文
   - 1文目：間違いを認める
   - 2文目：教材ワードで冗談を膨らませる
   - 3〜7文目：教材の重要ポイントをさらに詳しく説明する（自分ごと化を含む）
   - 8文目：考えさせて終わらせる（問いかけや思考を促す表現で締める）

【ルール】
・だるい口調「〜だぞ」「〜だな」
・生徒はツッコミのみ（短く穏やかに）
・脱線は1回だけ
・最後は考えさせて終わらせる（問いかけや思考を促す表現で締める）
・短文で読み上げ向き
・ボケは教材ワードと必ず論理的につなぐ（例：教材に「江戸時代」があれば「江戸時代にスマホがあった」など）
・教材の内容を自分ごと化にする（他人事ではなく自分のこととして考えさせる表現を使う）

以下の内容を講義してください：
「{{教材テキスト}}」

【重要】レスポンスはJSON形式のみを返してください。説明文やコメントは一切含めないでください。

【出力JSON】
{
  "teacher_intro": "3文を改行で区切って。教材を正しく説明する3文。",
  "teacher_boke": "教材ワードと論理的につなげたボケ1文",
  "student": "短く穏やかなツッコミ1文",
  "teacher_conclusion": [
    "間違いを認める1文目",
    "教材ワードで冗談を膨らませる2文目",
    "教材の重要ポイントをさらに詳しく説明する3文目（自分ごと化を含む）",
    "教材の重要ポイントをさらに詳しく説明する4文目",
    "教材の重要ポイントをさらに詳しく説明する5文目",
    "教材の重要ポイントをさらに詳しく説明する6文目",
    "教材の重要ポイントをさらに詳しく説明する7文目",
    "考えさせて終わらせる8文目（問いかけや思考を促す表現で締める）"
  ]
}`;

    // きょう丸先生の場合は特別なプロンプトを使用
    const kyotoPrompt = `あなたは「きょう丸先生（京都弁・少しうさん臭い講師）」として講義文を作ります。

【目的】
教材内容の中で「最も重要なポイント」を中心に、短い講義文を作成する。

【出力構造】
合計10文で出力する。

1〜4文目：教材の重要ポイントを正しく説明する（自分ごと化：他人事ではなく自分のこととして考えさせる）  
5文目：少し怪しい例え・ミスリード（脱線は1回だけ）  
6文目：ミスリードをやんわり回収する  
7〜9文目：教材の最重要ポイントに戻って、わかりやすく説明する
10文目：考えさせて終わらせる（問いかけや思考を促す表現）  

【話し方ルール】
・京都弁で話す
・理想の語尾を優先的に使う：〜やな、〜やろ、〜やで、〜いうことや
・「や」だけで終わる文は避ける（例：「〜や。」は避ける）
・やさしく、にやっとした口調
・少し意味深な言い回し
・一人称は「ぼく」
・命令や説教は禁止
・正解／不正解という評価表現は禁止
・短文で読み上げやすくする
・「どす」という語尾は禁止

【禁止表現】
・文末を「え」で終えない（例：「〜え。」は禁止）
・「テスト」「復習」「おしまい」「講義」などのメタ発言は禁止
・命令形（〜しなさい、覚えとき、復習して）は禁止

【内容ルール】
・教材から重要語句を2つ以上使う
・神話・都市伝説・専門知識が必要なネタは禁止
・誰でも分かる日常ネタか、教材ワードを使う
・教材の内容を自分ごと化にする（他人事ではなく自分のこととして考えさせる表現を使う）
・最後は考えさせて終わらせる（問いかけや思考を促す表現で締める）
・感想文やメタ説明は禁止

以下の内容を講義してください：
「{{教材テキスト}}」

【重要】レスポンスはJSON形式のみを返してください。説明文やコメントは一切含めないでください。

【黒板表示ルール】
・displayBoardフィールドには、実際に話している内容（textと同じ内容）を必ず設定してください
・黒板には講義ログの会話内容が文字で表示されます
・displayBoardとtextは同じ内容にしてください

【出力JSON】
{
  "items": [
    {
      "id": 1,
      "type": "introduction",
      "speaker": "teacher",
      "text": "[テーマ]を確認します",
      "displayBoard": "[テーマ]を確認します"
    },
    {
      "id": 2,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す講義内容の1文目（京都弁）",
      "displayBoard": "実際に話す講義内容の1文目（textと同じ内容）"
    },
    {
      "id": 3,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す講義内容の2文目",
      "displayBoard": "実際に話す講義内容の2文目（textと同じ内容）"
    },
    {
      "id": 4,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す講義内容の3文目",
      "displayBoard": "実際に話す講義内容の3文目（textと同じ内容）"
    },
    {
      "id": 5,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す講義内容の4文目",
      "displayBoard": "実際に話す講義内容の4文目（textと同じ内容）"
    },
    {
      "id": 6,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す怪しい例え・ミスリードの内容",
      "displayBoard": "実際に話す怪しい例え・ミスリードの内容（textと同じ内容）"
    },
    {
      "id": 7,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話すミスリード回収の内容",
      "displayBoard": "実際に話すミスリード回収の内容（textと同じ内容）"
    },
    {
      "id": 8,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す最重要ポイントの7文目",
      "displayBoard": "実際に話す最重要ポイントの7文目（textと同じ内容）"
    },
    {
      "id": 9,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す最重要ポイントの8文目",
      "displayBoard": "実際に話す最重要ポイントの8文目（textと同じ内容）"
    },
    {
      "id": 10,
      "type": "explanation",
      "speaker": "teacher",
      "text": "実際に話す最重要ポイントの9文目",
      "displayBoard": "実際に話す最重要ポイントの9文目（textと同じ内容）"
    },
    {
      "id": 11,
      "type": "explanation",
      "speaker": "teacher",
      "text": "考えさせて終わらせる内容（問いかけや思考を促す表現）",
      "displayBoard": "考えさせて終わらせる内容（問いかけや思考を促す表現、textと同じ内容）"
    }
  ],
  "tone": "kyoto",
  "sourceText": "{{教材テキスト}}"
}`;

    const systemPrompt = tone === 'yuruhachi' 
      ? yuruhachiPrompt.replace('{{教材テキスト}}', extractedText.replace(/"/g, '\\"'))
      : tone === 'kyoto'
      ? kyotoPrompt.replace('{{教材テキスト}}', extractedText.replace(/"/g, '\\"'))
      : `あなたは学習コンテンツを「暗記ドリル（音声教材）」に変換するMemory Optimization Engineです。

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
- 問いと正解文では主語と表現を完全に一致させること

【自分ごと化ルール】
- 教材の内容を自分ごと化にする（他人事ではなく自分のこととして考えさせる表現を使う）
- explanationやsummaryでは、学習者自身に関連付ける表現を入れる
- 「（自分ごと化：...）」のような説明文や括弧内の注釈は出力しない（自然な文章として自分ごと化を表現する）

【締め方ルール】
- 終了文は「以上です。」ではなく、「応用シナリオ問題」で終わらせる
- 単なるまとめの代わりに、学習内容を自分ごととして捉える「応用シナリオ問題」を1問だけ出題する
- "If you were..." (もしあなたが当時の人なら/当事者なら) という視点で問うこと
- 答えは必ず、今回の講義で習った重要単語のどれかになるようにすること
- 感想（オープンクエスチョン）は禁止。必ず正解があるクイズにする
- 最後は question → silence → answer → explanation の形式で終わる

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
      "text": "関ヶ原の戦いは1600年に行われた天下分け目の戦いです（自分ごと化を自然な文章として表現、説明文は含めない）",
      "displayBoard": "関ヶ原の戦いは1600年に行われた天下分け目の戦いです"
    },
    {
      "id": 6,
      "type": "question",
      "speaker": "teacher",
      "text": "応用シナリオ問題（例：あなたが縄文人で、最高の矢じりを作りたいなら、何という石を探しに行きますか？）",
      "displayBoard": "応用シナリオ問題（もしあなたが当時の人なら/当事者ならという視点で問う）"
    },
    {
      "id": 7,
      "type": "silence",
      "speaker": "teacher",
      "silenceSeconds": 3
    },
    {
      "id": 8,
      "type": "answer",
      "speaker": "student",
      "text": "重要単語（今回の講義で習った重要単語のどれか）",
      "keyword": "重要単語"
    },
    {
      "id": 9,
      "type": "explanation",
      "speaker": "teacher",
      "text": "応用シナリオ問題の説明",
      "displayBoard": "応用シナリオ問題の説明"
    }
  ],
  "tone": "${tone}",
  "sourceText": "${extractedText.replace(/"/g, '\\"')}"
}`;

    const userContent = tone === 'yuruhachi'
      ? `重要: レスポンスは有効なJSON形式のみを返してください。説明文、コメント、Markdownコードブロックは一切含めないでください。JSONオブジェクトのみを返してください。`
      : `以下はOCRで読み取った教材テキストです。このテキストから暗記用コール＆レスポンス台本を作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---

上記のテキストから、Memory Optimization Engineのルールに従って講義スクリプトを生成してください。

重要: レスポンスは必ず有効なJSON形式で返してください。Markdownコードブロックは使用しないでください。`;

    // テーマを抽出（yuruhachi、kyoto、normalトーンの場合）
    let lectureTitle: string | null = null;
    if (tone === 'yuruhachi' || tone === 'kyoto' || tone === 'normal') {
      console.log("[generate-lecture] Phase 0: Extracting lecture theme...");
      const endingText = tone === 'yuruhachi' ? 'を確認するぞ' : 'を確認します';
      const themePrompt = `次の教材内容から、最も重要なテーマを1つだけ抜き出してください。

必ず次の形式でタイトルを出力してください。

形式：
「{テーマ}${endingText}」

条件：
・必ず「${endingText}」で終わる
・テーマは10〜20文字程度
・ボケや比喩は禁止
・感想文は禁止
・記号（！や？）は禁止
・1行のみ出力
・説明文は出力しない

教材内容：
「${extractedText.replace(/"/g, '\\"').substring(0, 1000)}」

タイトル：`;

      try {
        const themeModel = genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash",
        });
        const themeResult = await themeModel.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: themePrompt }],
            },
          ],
        });
        const themeResponse = themeResult.response.text().trim();
        // 「を確認するぞ」または「を確認します」を含む行を抽出
        const endingPattern = tone === 'yuruhachi' ? 'を確認するぞ' : 'を確認します';
        // 正規表現で特殊文字をエスケープ
        const escapedPattern = endingPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const titleMatch = themeResponse.match(new RegExp(`(.+?)\\s*${escapedPattern}`));
        if (titleMatch) {
          lectureTitle = titleMatch[1].trim();
          console.log('[generate-lecture] Extracted lecture title:', lectureTitle);
        } else {
          // 「重要事項を確認するぞ」または「重要事項を確認します」も試す（後方互換性）
          const fallbackPattern = tone === 'yuruhachi' ? '重要事項を確認するぞ' : '重要事項を確認します';
          const escapedFallbackPattern = fallbackPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const titleMatch2 = themeResponse.match(new RegExp(`(.+?)\\s*${escapedFallbackPattern}`));
          if (titleMatch2) {
            lectureTitle = titleMatch2[1].trim();
            console.log('[generate-lecture] Extracted lecture title (fallback):', lectureTitle);
          } else {
            // マッチしない場合は、最初の行をタイトル候補とする
            const firstLine = themeResponse.split('\n')[0].trim();
            if (firstLine.length >= 5 && firstLine.length <= 30) {
              lectureTitle = firstLine.replace(/[！？]/g, '').replace(/\s*を確認.*$/, '').replace(/\s*重要事項を確認.*$/, '').trim();
              console.log('[generate-lecture] Using first line as title:', lectureTitle);
            }
          }
        }
      } catch (themeError) {
        console.error("[generate-lecture] Theme extraction error:", themeError);
        // エラーでも続行（タイトルなしで動作）
      }
    }

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
    
    // JSONの前後の不要な文字を削除（説明文など）
    // 最初の{から最後の}までを抽出（ネストされたJSONにも対応）
    const firstBrace = jsonText.indexOf('{');
    if (firstBrace === -1) {
      throw new Error('JSON object not found in response');
    }
    
    // ネストされたJSONを正しく抽出するため、括弧のバランスを取る
    let braceCount = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < jsonText.length; i++) {
      if (jsonText[i] === '{') {
        braceCount++;
      } else if (jsonText[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break;
        }
      }
    }
    
    if (lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Invalid JSON structure: unmatched braces');
    }
    
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    
    // さらにクリーンアップ：JSONの後に続く不要な文字を削除
    jsonText = jsonText.trim();

    let validatedData: z.infer<typeof LectureScriptSchema>;

    try {
      let json: any;
      
      // yuruhachiトーンの場合は、パースを試みる前にJSONをクリーンアップ
      if (tone === 'yuruhachi') {
        // JSONの後に続く不要な文字を削除（説明文など）
        // 最後の}の後に続く文字を削除
        const lastBraceIndex = jsonText.lastIndexOf('}');
        if (lastBraceIndex !== -1 && lastBraceIndex < jsonText.length - 1) {
          jsonText = jsonText.substring(0, lastBraceIndex + 1);
        }
        
        // コメントや説明文を削除
        jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, ''); // /* */ コメント
        jsonText = jsonText.replace(/\/\/.*$/gm, ''); // // コメント
      }
      
      json = JSON.parse(jsonText);
      
      // ゆる八先生の場合は新しいJSON形式を既存の形式に変換
      if (tone === 'yuruhachi' && json.teacher_intro && json.teacher_boke && json.student && json.teacher_conclusion) {
        console.log('[generate-lecture] Converting yuruhachi format to LectureItem array');
        
        // teacher_introを3文に分割（改行で区切られている想定）
        const introSentences = json.teacher_intro.split('\n').filter((s: string) => s.trim()).slice(0, 3);
        // 3文に満たない場合は、カンマや句点で分割を試みる
        if (introSentences.length < 3) {
          const allSentences = json.teacher_intro.split(/[。\n]/).filter((s: string) => s.trim());
          introSentences.length = 0;
          introSentences.push(...allSentences.slice(0, 3));
        }
        
        const items: z.infer<typeof LectureItemSchema>[] = [];
        let itemId = 1;
        
        // 講義タイトルを使用（AIで抽出したもの、またはフォールバック）
        let finalLectureTitle = lectureTitle;
        if (!finalLectureTitle) {
          // フォールバック：章タイトルまたは最初の行から抽出
          const chapterTitle = extractChapterTitle(extractedText);
          if (chapterTitle) {
            finalLectureTitle = chapterTitle;
          } else {
            const lines = extractedText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
            if (lines.length > 0) {
              const firstLine = lines[0];
              if (firstLine.length >= 3 && firstLine.length <= 40 && 
                  !firstLine.includes('。') && 
                  !firstLine.match(/^\d+$/)) {
                finalLectureTitle = firstLine;
              }
            }
          }
        }
        // 講義タイトルを「を確認するぞ」で終わる形式に設定
        const introText = finalLectureTitle ? `${finalLectureTitle}を確認するぞ` : '重要事項を確認するぞ';
        
        // introduction
        items.push({
          id: itemId++,
          type: 'introduction',
          speaker: 'teacher',
          text: introText,
          displayBoard: introText,
        });
        
        // teacher_introの3文
        for (const sentence of introSentences) {
          if (sentence.trim()) {
            items.push({
              id: itemId++,
              type: 'explanation',
              speaker: 'teacher',
              text: sentence.trim(),
              displayBoard: sentence.trim(),
            });
          }
        }
        
        // teacher_boke
        items.push({
          id: itemId++,
          type: 'explanation',
          speaker: 'teacher',
          text: json.teacher_boke.trim(),
          displayBoard: json.teacher_boke.trim(),
        });
        
        // student
        items.push({
          id: itemId++,
          type: 'answer',
          speaker: 'student',
          text: json.student.trim(),
          displayBoard: json.student.trim(),
        });
        
        // teacher_conclusionの8文
        const conclusion = Array.isArray(json.teacher_conclusion) 
          ? json.teacher_conclusion 
          : [json.teacher_conclusion];
        for (const sentence of conclusion.slice(0, 8)) {
          if (sentence && sentence.trim()) {
            items.push({
              id: itemId++,
              type: 'explanation',
              speaker: 'teacher',
              text: sentence.trim(),
              displayBoard: sentence.trim(),
            });
          }
        }
        
        // closingは削除（最後の文で終わる）
        
        validatedData = {
          items,
          tone: 'yuruhachi',
          sourceText: extractedText,
        };
        
        console.log('[generate-lecture] Converted yuruhachi format, items count:', validatedData.items.length);
      } else {
        // 通常の形式
        console.log('[generate-lecture] Parsed JSON items count:', json.items?.length);
        console.log('[generate-lecture] Sample items:', json.items?.slice(0, 3));
        validatedData = LectureScriptSchema.parse(json);
        console.log('[generate-lecture] Validated data items count:', validatedData.items.length);
        
        // 講義タイトルを使用（AIで抽出したもの、またはフォールバック）
        let finalLectureTitle = lectureTitle;
        if (!finalLectureTitle) {
          // フォールバック：章タイトルまたは最初の行から抽出
          const chapterTitle = extractChapterTitle(extractedText);
          if (chapterTitle) {
            finalLectureTitle = chapterTitle;
          } else {
            const lines = extractedText.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
            if (lines.length > 0) {
              const firstLine = lines[0];
              if (firstLine.length >= 5 && firstLine.length <= 30 && !firstLine.includes('。')) {
                finalLectureTitle = firstLine;
              }
            }
          }
        }
        if (finalLectureTitle && validatedData.items.length > 0) {
          const firstItem = validatedData.items[0];
          if (firstItem.type === 'introduction') {
            // 標準講師の場合は「{テーマ}を確認します」の形式
            const closingText = tone === 'yuruhachi' ? 'を確認するぞ' : 'を確認します';
            const newText = `${finalLectureTitle}${closingText}`;
            const newDisplayBoard = `${finalLectureTitle}${closingText}`;
            validatedData.items[0] = {
              ...firstItem,
              text: newText,
              displayBoard: newDisplayBoard,
            };
            console.log('[generate-lecture] Added lecture title to introduction:', finalLectureTitle);
          }
        }
      }
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error("[generate-lecture] JSON parse error:", errorMessage);
      console.error("[generate-lecture] Original response text:", responseText);
      console.error("[generate-lecture] Extracted JSON text:", jsonText);
      console.error("[generate-lecture] JSON text length:", jsonText.length);
      console.error("[generate-lecture] JSON text preview (first 500 chars):", jsonText.substring(0, 500));
      
      // デバッグ用：JSONテキストの最後の部分も確認
      if (jsonText.length > 500) {
        console.error("[generate-lecture] JSON text preview (last 500 chars):", jsonText.substring(jsonText.length - 500));
      }
      
      return NextResponse.json(
        { error: `Failed to parse or validate JSON: ${errorMessage}. Response preview: ${responseText.substring(0, 200)}...` },
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
