import { NextResponse } from "next/server";
import { z } from "zod";
import { ASP_ADS } from "@/data/aspAds";

// Firebase関連のインポート
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, limit, Timestamp } from "firebase/firestore";

// Google Vision APIのエンドポイント
const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策と動的レンダリング設定 (Node.js Runtime)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

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
  // AIによる広告推奨（必須ではない）
  ad_recommendation: z.object({
    ad_id: z.string(),
    reason: z.string(),
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
    const body = await req.json();
    const { image, text, verifiedFacts } = body;
    
    // デバッグ用ログ
    console.log("=== Generate Quiz API Called ===");
    console.log("Has image:", !!image);
    console.log("Has text:", !!text);
    console.log("Has verifiedFacts:", !!verifiedFacts);

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

    console.log("Step 2: Preparing Sales Logic...");

    // ---------------------------------------------------------
    // 2. セールスロジックの準備 (Firebase & 0円マッチ)
    // ---------------------------------------------------------
    let preSelectedAdId: string | null = null;
    let preSelectedReason: string | null = null;

    // 広告リストをシャッフルしてチェック（毎回同じ広告にならないように）
    const shuffledAds = shuffleArray(ASP_ADS);

    for (const ad of shuffledAds) {
      // 広告に設定されたキーワードが含まれているか？
      // aspAds.ts に keywords プロパティが設定されている前提
      const keywords = (ad as any).keywords || [];
      if (keywords.length > 0) {
        const isMatch = keywords.some((keyword: string) => extractedText.includes(keyword));
        
        if (isMatch) {
          console.log(`Keyword Match Found: ${ad.name}`);

          // ★Firebaseチェック: この広告の「名作コピー」が保存されているか？
          // Firebaseが利用可能な場合のみ実行（エラー時はスキップしてAI生成に回す）
          try {
            if (db) {
              const copyQuery = query(
                collection(db, "ad_copies"),
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
2. **解説の充実**: 短く分かりやすい解説（60文字以内）をつけること。
3. **誤答の質**: 事実として正しい記述を誤答に混ぜないこと。
4. 問題数：5問
5. options[0]に正解を入れる

## 出力 (JSON)

{
  "summary": "要約",
  "keywords": ["語句1", "語句2"],
  "questions": [ ... ],
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

テキストの内容（科目・難易度）からユーザーの「悩み」を推測し、リストから**最も解決に役立つサービスを1つだけ**選べ。

そして、そのサービスを勧めるための**「心に刺さるメッセージ（60文字以内）」**を \`reason\` に出力せよ。

- リスト:

${adListText}

## 禁止事項

- **捏造の禁止**: 提案文を作成する際、リストの「特徴・ターゲット」に記載されていないプラン名や機能（例：存在しない「大学講座」など）を勝手に創作してはならない。

- **正直な提案**: 適切な商品がない場合は、無理に選ばず \`ad_recommendation\` を null にせよ。

## 出力 (JSON)

{
  "summary": "要約",
  "keywords": ["語句1", "語句2"],
  "questions": [ ... ],
  "ad_recommendation": {
    "ad_id": "ID",
    "reason": "メッセージ"
  }
}`;
    }

    let userContent = `以下はOCRで読み取った教材テキストです。このテキストからクイズを作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---`;
    
    // 温度設定（新問題生成時は高めに）
    let temperature = preSelectedAdId ? 0.3 : 0.7; // 広告選定時は少し高めに
    
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

    // ---------------------------------------------------------
    // 4. Firebaseへの保存（資産化）
    // ---------------------------------------------------------
    // パターンBで新しく生成されたコピーなら、Firebaseに保存してストックする
    if (!preSelectedReason && validatedData.ad_recommendation && validatedData.ad_recommendation.ad_id) {
      try {
        if (db) {
          await addDoc(collection(db, "ad_copies"), {
            ad_id: validatedData.ad_recommendation.ad_id,
            reason: validatedData.ad_recommendation.reason,
            keywords: validatedData.keywords || [],
            created_at: Timestamp.now(),
            click_count: 0, // 将来の分析用
            view_count: 0   // 将来の分析用
          });
          console.log("✨ New Sales Copy Saved to Firebase!");
        }
      } catch (e) {
        console.error("Firebase Save Error (Ignored):", e);
        // 保存に失敗しても、クイズ生成自体は止めない
      }
    }

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