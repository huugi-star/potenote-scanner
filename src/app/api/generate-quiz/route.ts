import { NextResponse } from "next/server";
import { z } from "zod";
import { ASP_ADS } from "@/data/aspAds";

// Firebase関連のインポート
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, limit, Timestamp } from "firebase/firestore";

// Google Vision APIのエンドポイント
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

type SeedQuestionInput = {
  question: string;
  answer: string;
  choices?: string[];
};

type GenerateQuizRequestBody = {
  mode?: "ocr" | "seed";
  uid?: string;
  image?: string;
  text?: string;
  verifiedFacts?: string;
  summary?: string;
  keywords?: string[];
  existingQuestions?: SeedQuestionInput[];
  questionCount?: number;
  difficulty?: "easy" | "normal" | "hard";
};

// タイムアウト対策と動的レンダリング設定 (Node.js Runtime)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ハルシネーション防止用の型定義
const QuizSchema = z.object({
  // 旧レスポンス互換: title が無い場合は空文字で受けて後段で補完
  title: z.string().optional().default(''),
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
  // AIによる広告推奨（必須ではない）
  ad_recommendation: z.object({
    ad_id: z.string(),
    reason: z.string(),
    url: z.string().optional(),
    name: z.string().optional(),
  }).optional().nullable(),
});

// 配列シャッフル関数
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as GenerateQuizRequestBody;
    const mode: "ocr" | "seed" = body.mode === "seed" ? "seed" : "ocr";
    const { image, text, verifiedFacts } = body;
    const canUseFirestoreAds = !!db && !!body.uid;
    
    // デバッグ用ログ
    console.log("=== Generate Quiz API Called ===");
    console.log("mode:", mode);
    console.log("Has image:", !!image);
    console.log("Has text:", !!text);
    console.log("Has verifiedFacts:", !!verifiedFacts);

    let extractedText = text || "";
    const seedSummary = String(body.summary ?? "").trim();
    const seedKeywords = Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k ?? "").trim()).filter(Boolean)
      : [];
    const seedExistingQuestions = Array.isArray(body.existingQuestions)
      ? body.existingQuestions
          .map((q) => ({
            question: String(q?.question ?? "").trim(),
            answer: String(q?.answer ?? "").trim(),
            choices: Array.isArray(q?.choices) ? q.choices.map((c) => String(c ?? "").trim()).filter(Boolean) : undefined,
          }))
          .filter((q) => q.question && q.answer)
      : [];
    const seedQuestionCount = Math.min(10, Math.max(3, Number(body.questionCount ?? 5)));
    const seedDifficulty = body.difficulty ?? "normal";

    // ===== Step 1: OCR（Google Vision API）=====
    if (mode === "ocr" && !extractedText && image) {
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

    }

    if (mode === "ocr" && !extractedText) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }
    if (mode === "seed" && (!seedSummary || seedKeywords.length === 0 || seedExistingQuestions.length === 0)) {
      return NextResponse.json(
        { error: "Seed mode requires summary, keywords, and existingQuestions" },
        { status: 400 }
      );
    }

    console.log("Step 2: Preparing Sales Logic...");

    // ---------------------------------------------------------
    // 2. セールスロジックの準備 (Firebase & 0円マッチ)
    // ---------------------------------------------------------
    let preSelectedAdId: string | null = null;
    let preSelectedReason: string | null = null;

    // 広告リストをシャッフルしてチェック（毎回同じ広告にならないように）
    const shuffledAds = shuffleArray(ASP_ADS);
    const sourceTextForSales =
      mode === "seed"
        ? `${seedSummary}\n${seedKeywords.join(" ")}\n${seedExistingQuestions.map((q) => q.question).join(" ")}`
        : extractedText;

    for (const ad of shuffledAds) {
      // 広告に設定されたキーワードが含まれているか？
      // aspAds.ts に keywords プロパティが設定されている前提
      const keywords = (ad as any).keywords || [];
      if (keywords.length > 0) {
        const isMatch = keywords.some((keyword: string) => sourceTextForSales.includes(keyword));
        
        if (isMatch) {
          console.log(`Keyword Match Found: ${ad.name}`);

          // ★Firebaseチェック: この広告の「名作コピー」が保存されているか？
          // Firebaseが利用可能な場合のみ実行（エラー時はスキップしてAI生成に回す）
          try {
            if (canUseFirestoreAds) {
              const copyQuery = query(
                collection(db!, "ad_copies"),
                where("ad_id", "==", ad.id),
                limit(30) // 30個まで取得（在庫チェック用）
              );
              const querySnapshot = await getDocs(copyQuery);
              const stockCount = querySnapshot.size;
              
              // 新陳代謝ロジック
              // 在庫が少ない時（30個未満）: 50%の確率で新規作成（どんどん貯める）
              // 在庫が多い時（30個以上）: 10%の確率であえて新規作成（マンネリ防止＆新しい当たりを探す）
              const shouldCreateNew = stockCount < 30 
                ? Math.random() < 0.5  // 50%の確率
                : Math.random() < 0.1; // 10%の確率
              
              if (!querySnapshot.empty && !shouldCreateNew) {
                // 在庫あり＆新規作成しない場合: ランダムに1つ選ぶ
                const docs = querySnapshot.docs;
                const randomDoc = docs[Math.floor(Math.random() * docs.length)];
                const data = randomDoc.data();
                
                if (data.reason) {
                  preSelectedAdId = ad.id;
                  preSelectedReason = data.reason;
                  console.log(`🔥 Firebase Hit! Using saved copy (Cost: 0). Stock: ${stockCount}`);
                }
              } else if (shouldCreateNew) {
                // 新規作成する場合: preSelectedAdId/preSelectedReason を null のままにして、AI生成に回す
                console.log(`📝 Creating new copy (Stock: ${stockCount}, Mode: ${stockCount < 30 ? '積極的' : '新陳代謝'})`);
              }
            }
          } catch (e) {
            // Firebase接続エラーは無視して、AI生成に回す
            console.error("Firebase Read Error (Ignored, falling back to AI generation):", e);
          }
          break; // 1つ見つかったらループ終了
        }
      }
    }

    // ===== Step 3: クイズ生成（OpenAI）=====
    console.log("Step 3: Quiz generation with OpenAI...");
    
    // OpenAI APIキーの確認
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    // AIへの指示（プロンプト）を構築
    let systemPrompt = "";
    
    // 広告リストのテキスト化（AI生成用）
    // AIに渡すのは上位15件に絞る（トークン節約）
    const adListText = shuffledAds.slice(0, 15).map(ad => 
      `- ID: "${ad.id}"\n  商材名: ${ad.name}\n  特徴・ターゲット: ${ad.descriptionForAI}`
    ).join('\n');

    // クイズの切り口ランダム決定
    const focusModes = [
      "【用語の定義と本質】",
      "【因果関係と理由】",
      "【正誤判定とひっかけ】",
      "【要約と主旨】",
      "【具体例と実践】"
    ];
    const currentFocus = focusModes[Math.floor(Math.random() * focusModes.length)];

    if (preSelectedAdId && preSelectedReason) {
      // ■ パターンA: 0円マッチ＆Firebase在庫あり！
      // AIには「クイズを作るだけ」を指示し、広告選定はさせない（コスト削減＆指示ブレ防止）
      // ※ただし、出力フォーマットを合わせるために reason は注入する指示を出す
      
      console.log("Mode: Quiz Generation Only (Ad pre-selected)");

      systemPrompt = `あなたは大手進学塾のベテラン講師です。
OCRで読み取られた学習教材のテキストから、生徒の真の理解力を試す「良質な4択クイズ」を5問作成してください。

## 今回の重要テーマ

**${currentFocus}**

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

1. **暗記ではなく理解を問う**: 背景や意義を問う問題を作成せよ。
2.**全体から抽出する（最重要）**:
   - 提供されたテキストには多数の問題（例: 20問程度）が含まれている。
   - **絶対にテキストの前半部分（最初の数問）だけに集中してはならない。**
   - テキストの「冒頭」「中間」「末尾」から、まんべんなくトピックを選定せよ。
   - 【禁止】元のテキストの上から順に5問作る行為。
3. **解説の充実**: 短く分かりやすい解説（60文字以内）をつけること。
4. **誤答の質**: 事実として正しい記述を誤答に混ぜないこと。
5. 問題数：5問
options[0]に正解を入れる

## 出力 (JSON)

**重要**: 必ず以下の形式で出力してください。キー名は正確に一致させること。

{
  "title": "短いタイトル（10〜20文字・句点なし）",
  "summary": "教材の要約（50〜80文字程度）",
  "keywords": ["重要語句1", "重要語句2", "重要語句3"],
  "questions": [
    {
      "q": "問題文（具体的な問いかけ）",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "a": 0,
      "explanation": "解説文（60文字以内）"
    },
    {
      "q": "問題文2",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "a": 1,
      "explanation": "解説文2"
    }
    // ... 合計5問
  ],
  "ad_recommendation": {
    "ad_id": "${preSelectedAdId}",
    "reason": "${preSelectedReason}"
  }
}`;
    } else {
      // ■ パターンB: マッチしなかった or 在庫なし
      // AIに「広告選定」と「コピー作成」をお願いする（AIの知能に頼る）
      
      console.log("Mode: Full Generation (Quiz + Ad Selection)");
      
      systemPrompt = `あなたは学習カリスマカウンセラーです。
教材テキストからクイズを作成し、同時に学習の悩みを解決するツールを提案してください。

## 教材の構造を理解する

教材には以下のパターンがあります：
- 問題番号（1, 2, ①, (1)など）の後に問題文
- 「解答」「正解」「答」などのセクションに正解が記載
- 問題と解答の番号は対応している

## 重要：正解の特定方法

1. テキスト内の「解答」「正解」「答」セクションを探す
2. そこに書かれた内容が各問題の正解
3. 問題文の中の記述は「問い」であり「答え」ではない

## タスク1: クイズ作成（通常通り）

- 5問の4択クイズを作成せよ。解説は短く分かりやすく（60文字以内）。
- options[0]に正解を入れる
- 誤答は正解と紛らわしいが明確に間違いの選択肢

## タスク2: ソリューション提案（AIセールス）

テキストの内容（科目・単元・難易度）を分析し、学習者が「今、具体的に何に躓いているか」を特定せよ。
その上で、リストから解決策を選び、**教材の内容と商品をリンクさせた**メッセージを作成せよ。

- リスト:

${adListText}

## 提案文（reason）の作成ルール（超重要）

**「単なる商品の宣伝」は禁止**です。必ず**「教材のトピック」**に触れてください。

1. **悪い例**: 「お子様に最適な塾を見つけ、成績アップをサポートします！」
   （↑教材の内容に触れていないためNG）

2. **良い例（縄文時代の場合）**: 「縄文と弥生の区別、紛らわしいですよね。歴史の暗記が苦手なら、プロの指導で効率よく覚えませんか？」
   （↑「紛らわしい」という具体的な悩みと解決策がリンクしているためOK）

3. **良い例（数学の関数の場合）**: 「グラフの変域で手が止まっていませんか？苦手な単元だけを集中して教われる塾を、今すぐ探せます。」

**指示**: テキスト内のキーワード（例: 歴史用語、数式、文法用語など）を意識し、「まさに今その勉強をしている君（または親御さん）」へのメッセージにすること。

## 禁止事項

- **捏造の禁止**: 提案文を作成する際、リストの「特徴・ターゲット」に記載されていないプラン名や機能（例：存在しない「大学講座」など）を勝手に創作してはならない。

- **正直な提案**: 適切な商品がない場合は、無理に選ばず \`ad_recommendation\` を null にせよ。

## 出力 (JSON)

**重要**: 必ず以下の形式で出力してください。キー名は正確に一致させること。

{
  "summary": "教材の要約（100文字程度）",
  "keywords": ["重要語句1", "重要語句2", "重要語句3"],
  "questions": [
    {
      "q": "問題文（具体的な問いかけ）",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "a": 0,
      "explanation": "解説文（60文字以内）"
    },
    {
      "q": "問題文2",
      "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "a": 1,
      "explanation": "解説文2"
    }
    // ... 合計5問
  ],
  "ad_recommendation": {
    "ad_id": "ID",
    "reason": "メッセージ"
  }
  // または適切な商品がない場合: "ad_recommendation": null
}`;
    }

    if (mode === "seed") {
      if (preSelectedAdId && preSelectedReason) {
        systemPrompt = `あなたは大手進学塾のベテラン講師です。
以下のシード情報（要約・キーワード・既出問題）を使い、同テーマの新しい4択クイズを作ってください。

必須ルール:
- 既出問題の焼き直しを禁止（同じ問い・同じ正答・同じ切り口はNG）
- 問題数は${seedQuestionCount}問
- 難易度は${seedDifficulty}
- options[0] に正解を入れる
- 解説は60文字以内

出力(JSON)は必ずこの形式:
{
  "summary": "要約",
  "keywords": ["語句1","語句2","語句3"],
  "questions": [{"q":"...","options":["..."],"a":0,"explanation":"..."}],
  "ad_recommendation": { "ad_id": "${preSelectedAdId}", "reason": "${preSelectedReason}" }
}`;
      } else {
        systemPrompt = `あなたは学習カリスマカウンセラーです。
以下のシード情報（要約・キーワード・既出問題）を使い、同テーマの新しい4択クイズを作成し、学習支援ツール提案も行ってください。

必須ルール:
- title: 10〜20文字程度、名詞中心の短いタイトル。説明文にせず、句点（。．.）は禁止。
- summary: 50〜80文字程度の要約文。
- 既出問題と重複しない問いを作る
- 問題数は${seedQuestionCount}問
- 難易度は${seedDifficulty}
- options[0] に正解を入れる
- 解説は60文字以内
- ad_recommendation は適切なものがなければ null

広告候補:
${adListText}

出力(JSON)は必ずこの形式:
{
  "title": "短いタイトル（10〜20文字・句点なし）",
  "summary": "要約（50〜80文字程度）",
  "keywords": ["語句1","語句2","語句3"],
  "questions": [{"q":"...","options":["..."],"a":0,"explanation":"..."}],
  "ad_recommendation": { "ad_id": "ID", "reason": "メッセージ" }
}`;
      }
    }

    let userContent =
      mode === "seed"
        ? `以下は同テーマの再生成シードです。OCR本文は使わず、ここから新しい類題を作ってください。

--- シード要約 ---
${seedSummary}

--- シードキーワード ---
${seedKeywords.join(" / ")}

--- 既出問題 ---
${seedExistingQuestions
  .map((q, i) => `${i + 1}. 問: ${q.question}\n   正解: ${q.answer}${q.choices?.length ? `\n   選択肢: ${q.choices.join(" | ")}` : ""}`)
  .join("\n")}
`
        : `以下はOCRで読み取った教材テキストです。このテキストからクイズを作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---`;

    // 温度設定（新問題生成時は高めに）
    let temperature = preSelectedAdId ? 0.3 : 0.7; // 広告選定時は少し高めに
    const seedFacts = seedExistingQuestions
      .map((q) => `問: ${q.question} → 正解: ${q.answer}`)
      .join('\n');
    const antiDupFacts = verifiedFacts || seedFacts;

    if (antiDupFacts) {
      userContent += `

★★★【重要：以下の問題は既に出題済み。絶対に同じ問題を作るな】★★★
${antiDupFacts}

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
    
    const usage = openaiData.usage || {};
    const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0;
    const completionTokens = usage.completion_tokens ?? usage.completionTokens ?? 0;
    const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (promptTokens + completionTokens);
    console.log(`[generate-quiz] tokens prompt:${promptTokens} completion:${completionTokens} total:${totalTokens}`);

    const content = openaiData.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    let json;
    try {
      json = JSON.parse(content);
    } catch (parseError) {
      // フォールバック: 最初と最後の波括弧で囲まれた部分を抜き出して再パース
      const braceMatch = content?.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          json = JSON.parse(braceMatch[0]);
        } catch (err2) {
          console.error("Failed to parse OpenAI response (fallback also failed):", content);
          throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } else {
        console.error("Failed to parse OpenAI response (no JSON braces found):", content);
        throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    
    // デバッグ用: OpenAIレスポンスの構造をログ出力
    console.log("OpenAI Response JSON structure:", JSON.stringify(json, null, 2));
    
    // レスポンスの正規化（キー名の違いに対応）
    if (json.questions && Array.isArray(json.questions)) {
      json.questions = json.questions.map((q: any, index: number) => {
        // キー名のバリエーションに対応
        const normalized = {
          q: q.q || q.question || q.questionText || q.text || '',
          options: q.options || q.choices || q.answers || [],
          a: typeof q.a === 'number' ? q.a : (typeof q.answer === 'number' ? q.answer : (typeof q.correctAnswer === 'number' ? q.correctAnswer : (typeof q.correctIndex === 'number' ? q.correctIndex : 0))),
          explanation: q.explanation || q.explain || q.reason || q.comment || '',
        };
        
        // デバッグ: 正規化前のデータをログ出力
        if (!normalized.q || !normalized.options || normalized.options.length === 0) {
          console.error(`Question ${index} normalization failed:`, q);
        }
        
        return normalized;
      }).filter((q: any) => {
        // 無効な問題を除外（q, optionsが必須）
        const isValid = q.q && q.q.trim() !== '' && q.options && Array.isArray(q.options) && q.options.length >= 2;
        if (!isValid) {
          console.warn(`Filtered out invalid question:`, q);
        }
        return isValid;
      });

      if (mode === "seed" && json.questions.length > seedQuestionCount) {
        json.questions = json.questions.slice(0, seedQuestionCount);
      }
      
      // 問題数が不足している場合の警告
      const expectedCount = mode === "seed" ? seedQuestionCount : 5;
      if (json.questions.length < expectedCount) {
        console.warn(`Warning: Only ${json.questions.length} valid questions found (expected ${expectedCount})`);
      }
    } else {
      console.error("No questions array found in OpenAI response:", json);
      throw new Error("OpenAI response does not contain a questions array");
    }

    // 正解インデックスをシャッフル
    if (json.questions) {
      json.questions = json.questions.map((q: { options: string[]; a: number }) => {
        const correctAnswer = q.options[q.a];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        const newIndex = shuffled.indexOf(correctAnswer);
        return { ...q, options: shuffled, a: newIndex };
      });
    }

    let validatedData = QuizSchema.parse(json);
    // title が空のときは keywords からフォールバック生成
    if (!validatedData.title || !validatedData.title.trim()) {
      const fallback = (validatedData.keywords?.[0] || validatedData.summary.slice(0, 12)).trim();
      validatedData = {
        ...validatedData,
        title: fallback.replace(/[。．.]/g, '').slice(0, 20) || 'クイズ',
      };
    } else {
      validatedData = {
        ...validatedData,
        title: validatedData.title.replace(/[。．.]/g, '').slice(0, 20),
      };
    }

    // キーワード・ASPマッチなしの場合の楽天フォールバック
    if (!validatedData.ad_recommendation || !validatedData.ad_recommendation.ad_id) {
      const keywordForRakuten = (validatedData.keywords && validatedData.keywords[0]) || "英語 学習";
      const encoded = encodeURIComponent(keywordForRakuten);
      validatedData = {
        ...validatedData,
        ad_recommendation: {
          ad_id: "rakuten_fallback",
          reason: `該当する広告が見つかりませんでした。代わりに楽天で「${keywordForRakuten}」関連の商品をチェックしてみましょう。`,
          url: `https://search.rakuten.co.jp/search/mall/${encoded}/?f=1&scid=af_sp_etc&sc2id=af_101_0_0`,
          name: `楽天で「${keywordForRakuten}」を探す`
        }
      };
    }

    // ---------------------------------------------------------
    // 4. Firebaseへの保存（資産化）
    // ---------------------------------------------------------
    // パターンBで新しく生成されたコピーなら、Firebaseに保存してストックする
    if (canUseFirestoreAds && !preSelectedReason && validatedData.ad_recommendation && validatedData.ad_recommendation.ad_id) {
      try {
        await addDoc(collection(db!, "ad_copies"), {
          ad_id: validatedData.ad_recommendation.ad_id,
          reason: validatedData.ad_recommendation.reason,
          keywords: validatedData.keywords || [],
          created_at: Timestamp.now(),
          click_count: 0, // 将来の分析用
          view_count: 0   // 将来の分析用
        });
        console.log("✨ New Sales Copy Saved to Firebase!");
      } catch (e) {
        console.error("Firebase Save Error (Ignored):", e);
        // 保存に失敗しても、クイズ生成自体は止めない
      }
    }

    return NextResponse.json({
      quiz: validatedData,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
    });

  } catch (error) {
    const errorMessage = (error as any)?.message || String(error);
    console.error("API Error:", errorMessage);

    const isLimitError =
      errorMessage.includes("429") ||
      errorMessage.includes("Quota") ||
      errorMessage.includes("Resource has been exhausted");

    if (isLimitError) {
      return NextResponse.json(
        {
          error: "LIMIT_REACHED",
          details: "本日のAIサーバー利用上限に達しました。明日またご利用ください。",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}