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
  // ── 追加: 元スキャン全文テキスト（seed時に渡す）
  originalText?: string;
};

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const QuizSchema = z.object({
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
  ad_recommendation: z.object({
    ad_id: z.string(),
    reason: z.string(),
    url: z.string().optional(),
    name: z.string().optional(),
  }).optional().nullable(),
});

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

    console.log("=== Generate Quiz API Called ===");
    console.log("mode:", mode);
    console.log("Has image:", !!image);
    console.log("Has text:", !!text);
    console.log("Has originalText:", !!body.originalText);
    console.log("Has verifiedFacts:", !!verifiedFacts);

    let extractedText = text || "";
    const seedSummary          = String(body.summary ?? "").trim();
    const seedKeywords         = Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k ?? "").trim()).filter(Boolean)
      : [];
    const seedExistingQuestions = Array.isArray(body.existingQuestions)
      ? body.existingQuestions
          .map((q) => ({
            question: String(q?.question ?? "").trim(),
            answer:   String(q?.answer   ?? "").trim(),
            choices:  Array.isArray(q?.choices)
              ? q.choices.map((c) => String(c ?? "").trim()).filter(Boolean)
              : undefined,
          }))
          .filter((q) => q.question && q.answer)
      : [];
    const seedQuestionCount = Math.min(10, Math.max(3, Number(body.questionCount ?? 5)));
    const seedDifficulty    = body.difficulty ?? "normal";
    // ── 追加: 元スキャンの全文テキスト（seed再生成時に使う）
    const originalText      = String(body.originalText ?? "").trim();

    // ===== Step 1: OCR =====
    if (mode === "ocr" && !extractedText && image) {
      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");
      console.log("Step 1: OCR with Google Vision API...");

      const visionResponse = await fetch(
        `${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Content },
              features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 50 }],
              imageContext: {
                languageHints: ["ja", "en"],
                textDetectionParams: { enableTextDetectionConfidenceScore: true },
              },
            }],
          }),
        }
      );

      if (!visionResponse.ok) {
        throw new Error(`Google Vision API Error: ${await visionResponse.text()}`);
      }
      const visionData = await visionResponse.json();
      extractedText = visionData.responses[0]?.fullTextAnnotation?.text || "";
      if (!extractedText) {
        return NextResponse.json({ error: "No text found (OCR failed)" }, { status: 400 });
      }
    }

    if (mode === "ocr"  && !extractedText) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }
    if (mode === "seed" && (!seedSummary || seedKeywords.length === 0 || seedExistingQuestions.length === 0)) {
      return NextResponse.json(
        { error: "Seed mode requires summary, keywords, and existingQuestions" },
        { status: 400 }
      );
    }

    // ===== Step 2: 広告プリマッチ =====
    console.log("Step 2: Sales logic...");
    let preSelectedAdId: string | null     = null;
    let preSelectedReason: string | null   = null;
    const shuffledAds = shuffleArray(ASP_ADS);
    const sourceTextForSales =
      mode === "seed"
        ? `${seedSummary}\n${seedKeywords.join(" ")}\n${seedExistingQuestions.map((q) => q.question).join(" ")}`
        : extractedText;

    for (const ad of shuffledAds) {
      const keywords = (ad as any).keywords || [];
      if (keywords.length > 0 && keywords.some((kw: string) => sourceTextForSales.includes(kw))) {
        console.log(`Keyword Match: ${ad.name}`);
        try {
          if (canUseFirestoreAds) {
            const snap = await getDocs(query(
              collection(db!, "ad_copies"),
              where("ad_id", "==", ad.id),
              limit(30)
            ));
            const stock = snap.size;
            const shouldCreateNew = stock < 30 ? Math.random() < 0.5 : Math.random() < 0.1;
            if (!snap.empty && !shouldCreateNew) {
              const docs = snap.docs;
              const data = docs[Math.floor(Math.random() * docs.length)].data();
              if (data.reason) {
                preSelectedAdId    = ad.id;
                preSelectedReason  = data.reason;
                console.log(`Firebase Hit! Stock: ${stock}`);
              }
            } else {
              console.log(`Creating new copy (Stock: ${stock})`);
            }
          }
        } catch (e) {
          console.error("Firebase Read Error (Ignored):", e);
        }
        break;
      }
    }

    // ===== Step 3: プロンプト構築 =====
    console.log("Step 3: Building prompt...");

    const adListText = shuffledAds.slice(0, 15).map(ad =>
      `- ID: "${ad.id}"\n  商材名: ${ad.name}\n  特徴・ターゲット: ${ad.descriptionForAI}`
    ).join('\n');

    // ── 既出問題リストを箇条書きに変換（AIが確実に読める形）
    const existingQBlock = seedExistingQuestions.length > 0
      ? seedExistingQuestions.map((q, i) =>
          `  ${i + 1}. 【問】${q.question}\n     【正解】${q.answer}${
            q.choices?.length ? `\n     【選択肢】${q.choices.join(" | ")}` : ""
          }`
        ).join("\n")
      : "  （なし）";

    // ── seed モードで使う「元テキスト」ブロック
    // originalText があればそれを優先、なければ summary + keywords で代替
    const sourceTextBlock = originalText
      ? `--- 元スキャンテキスト ---\n${originalText}\n--- 元スキャンテキスト終わり ---`
      : `--- 教材要約 ---\n${seedSummary}\n\n--- 重要キーワード ---\n${seedKeywords.join(" / ")}`;

    let systemPrompt = "";
    let userContent  = "";
    let temperature  = 0.3;

    // ───────────────────────────────────────────────────────────────────
    // OCR モード
    // ───────────────────────────────────────────────────────────────────
    if (mode === "ocr") {
      const focusModes = [
        "【用語の定義と本質】",
        "【因果関係と理由】",
        "【正誤判定とひっかけ】",
        "【要約と主旨】",
        "【具体例と実践】",
      ];
      const currentFocus = focusModes[Math.floor(Math.random() * focusModes.length)];

      if (preSelectedAdId && preSelectedReason) {
        systemPrompt = `あなたは大手進学塾のベテラン講師です。
OCRで読み取られた学習教材のテキストから、生徒の真の理解力を試す「良質な4択クイズ」を5問作成してください。

## 今回の重要テーマ: ${currentFocus}

## 教材の構造を理解する
- 問題番号（1, 2, ①, (1)など）の後に問題文
- 「解答」「正解」「答」などのセクションに正解が記載
- 問題文中の記述は「問い」であり「答え」ではない

## クイズ作成ルール
1. 暗記ではなく理解を問う。背景や意義を問う問題を作成。
2. テキストの冒頭・中間・末尾からまんべんなく抽出すること。前半だけから作るのは禁止。
3. 解説は短く分かりやすく（60文字以内）。
4. 誤答は事実として正しい記述を使わない。
5. 問題数：5問 / options[0] に正解を入れる。

## 出力 (JSON)
{
  "title": "短いタイトル（10〜20文字・句点なし）",
  "summary": "教材の要約（50〜80文字程度）",
  "keywords": ["重要語句1", "重要語句2", "重要語句3"],
  "questions": [
    {"q": "問題文", "options": ["正解","誤答1","誤答2","誤答3"], "a": 0, "explanation": "解説（60文字以内）"}
  ],
  "ad_recommendation": {"ad_id": "${preSelectedAdId}", "reason": "${preSelectedReason}"}
}`;
        temperature = 0.3;
      } else {
        systemPrompt = `あなたは学習カリスマカウンセラーです。
教材テキストからクイズを作成し、学習の悩みを解決するツールを提案してください。

## 今回の重要テーマ: ${currentFocus}

## クイズ作成ルール
1. 5問の4択クイズ。解説は60文字以内。
2. テキストの冒頭・中間・末尾からまんべんなく抽出すること。
3. options[0] に正解を入れる。

## 広告候補
${adListText}

## 提案文ルール
- 教材の具体的なトピック（用語・単元名）に必ず言及する
- 単なる商品宣伝は禁止

## 出力 (JSON)
{
  "title": "タイトル（10〜20文字）",
  "summary": "要約（50〜80文字）",
  "keywords": ["語句1","語句2","語句3"],
  "questions": [
    {"q": "問題文", "options": ["正解","誤答1","誤答2","誤答3"], "a": 0, "explanation": "解説"}
  ],
  "ad_recommendation": {"ad_id": "ID", "reason": "メッセージ"}
}`;
        temperature = 0.7;
      }

      userContent = `以下はOCRで読み取った教材テキストです。このテキストからクイズを作成してください。

--- OCRテキスト開始 ---
${extractedText}
--- OCRテキスト終了 ---`;

      if (verifiedFacts) {
        userContent += `\n\n★★★【重要：以下は既出問題。絶対に同じ問題を作るな】★★★\n${verifiedFacts}\n\n上記と同じ問いかけ・切り口・正答の問題は禁止。必ず異なる視点で作成せよ。`;
        temperature = 0.8;
      }
    }

    // ───────────────────────────────────────────────────────────────────
    // SEED モード（大幅改善）
    // ───────────────────────────────────────────────────────────────────
    if (mode === "seed") {

      const difficultyLabel = {
        easy:   "易しめ（基礎定着・用語の定義を問う）",
        normal: "標準（理解度確認・因果関係を問う）",
        hard:   "応用（考察・判断力を問う・引っかけ含む）",
      }[seedDifficulty];

      if (preSelectedAdId && preSelectedReason) {
        // ── パターンA: 広告プリセット
        systemPrompt = `あなたは大手進学塾のベテラン講師です。
以下の「元スキャンテキスト（または要約）」と「既出問題リスト」を使い、
**まだ出題されていないトピック**から新しい4択クイズを${seedQuestionCount}問作成してください。

## 絶対に守るルール

### ① 既出問題と被らせない（最重要）
- 以下の既出問題と「同じ問い・同じ正答・似た切り口」の問題は一切禁止。
- 問いかけ方が違っても、実質同じ知識を問う問題も禁止。
- 既出問題で使われた選択肢の組み合わせを再利用しない。

### ② 未出題トピックを探す
- 元テキスト（または要約）を精読し、まだ問題になっていないトピック・段落・用語を探す。
- 既出問題が扱っている段落やセクションは避け、別の箇所から出題する。

### ③ 品質基準
- 難易度: ${difficultyLabel}
- 問題数: ${seedQuestionCount}問
- options[0] に正解を入れる
- 解説は60文字以内で、なぜそれが正解かを明記する
- 誤答は紛らわしいが明確に間違いのものにする

## 出力 (JSON)
{
  "title": "タイトル（10〜20文字・句点なし）",
  "summary": "要約（50〜80文字）",
  "keywords": ["語句1","語句2","語句3"],
  "questions": [
    {"q": "問題文", "options": ["正解","誤答1","誤答2","誤答3"], "a": 0, "explanation": "解説（60文字以内）"}
  ],
  "ad_recommendation": {"ad_id": "${preSelectedAdId}", "reason": "${preSelectedReason}"}
}`;
        temperature = 0.45;
      } else {
        // ── パターンB: 広告もAI選定
        systemPrompt = `あなたは学習カリスマカウンセラーです。
以下の「元スキャンテキスト（または要約）」と「既出問題リスト」を使い、
**まだ出題されていないトピック**から新しい4択クイズを${seedQuestionCount}問作成し、
学習支援ツールも提案してください。

## 絶対に守るルール

### ① 既出問題と被らせない（最重要）
- 以下の既出問題と「同じ問い・同じ正答・似た切り口」の問題は一切禁止。
- 問いかけ方が違っても、実質同じ知識を問う問題も禁止。
- 既出問題で使われた選択肢の組み合わせを再利用しない。

### ② 未出題トピックを探す
- 元テキスト（または要約）を精読し、まだ問題になっていないトピック・段落・用語を探す。
- 既出問題が扱っている段落やセクションは避け、別の箇所から出題する。

### ③ 品質基準
- 難易度: ${difficultyLabel}
- 問題数: ${seedQuestionCount}問
- options[0] に正解を入れる
- 解説は60文字以内で、なぜそれが正解かを明記する
- 誤答は紛らわしいが明確に間違いのものにする

## 広告候補
${adListText}

## 提案文ルール
- 教材の具体的なトピック（用語・単元名）に必ず言及する
- 単なる商品宣伝は禁止

## 出力 (JSON)
{
  "title": "タイトル（10〜20文字・句点なし）",
  "summary": "要約（50〜80文字）",
  "keywords": ["語句1","語句2","語句3"],
  "questions": [
    {"q": "問題文", "options": ["正解","誤答1","誤答2","誤答3"], "a": 0, "explanation": "解説（60文字以内）"}
  ],
  "ad_recommendation": {"ad_id": "ID", "reason": "メッセージ"}
}`;
        temperature = 0.55;
      }

      // ── userContent: 元テキスト + 既出問題を明示
      userContent = `${sourceTextBlock}

## 既出問題リスト（これらと被る問題は一切作るな）
${existingQBlock}

## 指示
上記の「元テキスト（または要約）」の中から、既出問題がまだカバーしていない箇所・トピックを特定し、
そこから${seedQuestionCount}問の新しいクイズを作成してください。

作成前に必ず自問してください：
「この問題は既出問題リストの何番と実質同じではないか？」
→ 少しでも被る可能性があれば別のトピックを選ぶこと。`;

      // 追加の重複防止ヒント（verifiedFacts / existingQuestionsの答え一覧）
      const allAnswers = seedExistingQuestions.map(q => q.answer).filter(Boolean);
      if (allAnswers.length > 0) {
        userContent += `\n\n### 既出の正解一覧（これを正解にする問題は禁止）\n${allAnswers.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`;
      }

      if (verifiedFacts) {
        userContent += `\n\n### 追加の禁止事項（verifiedFacts）\n${verifiedFacts}`;
        temperature = Math.max(temperature, 0.55);
      }
    }

    // ===== Step 4: OpenAI呼び出し =====
    console.log("Step 4: Calling OpenAI... temperature:", temperature);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent   },
        ],
        response_format: { type: "json_object" },
        temperature,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI Error: ${await openaiResponse.text()}`);
    }

    const openaiData = await openaiResponse.json();
    const usage            = openaiData.usage || {};
    const promptTokens     = usage.prompt_tokens     ?? 0;
    const completionTokens = usage.completion_tokens ?? 0;
    const totalTokens      = usage.total_tokens      ?? (promptTokens + completionTokens);
    console.log(`[generate-quiz] tokens prompt:${promptTokens} completion:${completionTokens} total:${totalTokens}`);

    const content = openaiData.choices[0]?.message?.content;
    if (!content) throw new Error("No content");

    // JSON パース
    let json: any;
    try {
      json = JSON.parse(content);
    } catch {
      const match = content?.match(/\{[\s\S]*\}/);
      if (match) { json = JSON.parse(match[0]); }
      else { throw new Error("Failed to parse OpenAI response"); }
    }

    console.log("OpenAI Response structure:", JSON.stringify(json, null, 2));

    // ── 正規化
    if (json.questions && Array.isArray(json.questions)) {
      json.questions = json.questions
        .map((q: any, index: number) => {
          const normalized = {
            q:           q.q           || q.question    || q.questionText || q.text || '',
            options:     q.options     || q.choices      || q.answers      || [],
            a:           typeof q.a === 'number' ? q.a
                       : typeof q.answer === 'number' ? q.answer
                       : typeof q.correctAnswer === 'number' ? q.correctAnswer
                       : typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || q.explain || q.reason || q.comment || '',
          };
          if (!normalized.q || !normalized.options || normalized.options.length === 0) {
            console.error(`Question ${index} normalization failed:`, q);
          }
          return normalized;
        })
        .filter((q: any) => {
          const valid = q.q && q.q.trim() && q.options && Array.isArray(q.options) && q.options.length >= 2;
          if (!valid) console.warn(`Filtered invalid question:`, q);
          return valid;
        });

      if (mode === "seed" && json.questions.length > seedQuestionCount) {
        json.questions = json.questions.slice(0, seedQuestionCount);
      }
      const expected = mode === "seed" ? seedQuestionCount : 5;
      if (json.questions.length < expected) {
        console.warn(`Only ${json.questions.length} valid questions (expected ${expected})`);
      }
    } else {
      throw new Error("OpenAI response does not contain a questions array");
    }

    // ── 選択肢シャッフル
    json.questions = json.questions.map((q: { options: string[]; a: number }) => {
      const correct  = q.options[q.a];
      const shuffled = [...q.options].sort(() => Math.random() - 0.5);
      return { ...q, options: shuffled, a: shuffled.indexOf(correct) };
    });

    // ── スキーマ検証
    let validatedData = QuizSchema.parse(json);

    // title フォールバック
    if (!validatedData.title?.trim()) {
      const fallback = (validatedData.keywords?.[0] || validatedData.summary.slice(0, 12)).trim();
      validatedData = { ...validatedData, title: fallback.replace(/[。．.]/g, '').slice(0, 20) || 'クイズ' };
    } else {
      validatedData = { ...validatedData, title: validatedData.title.replace(/[。．.]/g, '').slice(0, 20) };
    }

    // 楽天フォールバック
    if (!validatedData.ad_recommendation?.ad_id) {
      const kw      = validatedData.keywords?.[0] || "英語 学習";
      const encoded = encodeURIComponent(kw);
      validatedData = {
        ...validatedData,
        ad_recommendation: {
          ad_id:  "rakuten_fallback",
          reason: `該当する広告が見つかりませんでした。楽天で「${kw}」関連の商品をチェックしてみましょう。`,
          url:    `https://search.rakuten.co.jp/search/mall/${encoded}/?f=1&scid=af_sp_etc&sc2id=af_101_0_0`,
          name:   `楽天で「${kw}」を探す`,
        },
      };
    }

    // ── Firebase 保存（パターンB新規コピー）
    if (canUseFirestoreAds && !preSelectedReason && validatedData.ad_recommendation?.ad_id) {
      try {
        await addDoc(collection(db!, "ad_copies"), {
          ad_id:       validatedData.ad_recommendation.ad_id,
          reason:      validatedData.ad_recommendation.reason,
          keywords:    validatedData.keywords || [],
          created_at:  Timestamp.now(),
          click_count: 0,
          view_count:  0,
        });
        console.log("New Sales Copy Saved to Firebase!");
      } catch (e) {
        console.error("Firebase Save Error (Ignored):", e);
      }
    }

    return NextResponse.json({
      quiz: validatedData,
      tokenUsage: { promptTokens, completionTokens, totalTokens },
    });

  } catch (error) {
    const msg = (error as any)?.message || String(error);
    console.error("API Error:", msg);

    if (msg.includes("429") || msg.includes("Quota") || msg.includes("Resource has been exhausted")) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", details: "本日のAIサーバー利用上限に達しました。明日またご利用ください。" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}