import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// ===== Zod Schemas (緩和版) =====
const VocabSchema = z.object({
  word: z.string(),
  meaning: z.string(),
});

const ChunkSchema = z.object({
  text: z.string(),
  translation: z.string(),
  // enumは使用せずstringで受け、後段で正規化
  type: z.string(),
  role: z.string(),
  explanation: z.string().optional(),
  modifies: z.string().optional(),
  note: z.string().optional(),
});

const SubStructureSchema = z.object({
  target_text: z.string().optional(),
  target_chunk: z.string().optional(),
  analyzed_text: z.string().optional(),
  explanation: z.string().optional(),
  chunks: z.array(ChunkSchema).optional(),
});

const SentenceSchema = z.object({
  sentence_id: z.number(),
  original_text: z.string(),
  chunks: z.array(ChunkSchema),
  main_structure: z.array(ChunkSchema).optional(),
  translation: z.string(),
  full_translation: z.string().optional(),
  vocab_list: z.array(VocabSchema).optional(),
  details: z.array(z.string()),
  sub_structures: z.array(SubStructureSchema).optional(),
});

const ResponseSchema = z.object({
  clean_text: z.string(),
  sentences: z.array(SentenceSchema),
});

// ===== Helpers =====
const cleanOCRText = (text: string): string => {
  let cleaned = text;
  cleaned = cleaned.replace(/ビジュアル\s*\d*/gi, "");
  cleaned = cleaned.replace(/文構造を解析し[，,]?\s*和訳しなさい/gi, "");
  cleaned = cleaned.replace(/英文解釈/gi, "");
  cleaned = cleaned.replace(/^[\s]*[\(（\[]?[A-Za-z]?\d+[\)）\]]?[\.。]?\s*/gm, "");
  cleaned = cleaned.replace(/\b\d{3,}\b/g, "");
  cleaned = cleaned.replace(/\s+[A-Z]{1,3}(?=\s|$|[,.;!?])/g, (match) => {
    const keep = ["I", "A", "US", "UK", "TV", "PC", "AI", "IT", "OK", "AM", "PM", "Mr", "Mrs", "Ms", "Dr"];
    return keep.includes(match.trim()) ? match : " ";
  });
  cleaned = cleaned.replace(/^\s*[A-Z]{1,3}\s*$/gm, "");
  cleaned = cleaned.replace(/\b(Pl|RSS|WWW|URL|PDF|MP3|MP4|GPS)\b/gi, "");
  cleaned = cleaned.replace(/-{3,}/g, "");
  cleaned = cleaned.replace(/[^\w\s.,!?;:'"(){}\[\]-]+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

// ★修正: 強力なJSONクリーニング関数
const cleanJsonOutput = (text: string): string => {
  if (!text) return "";
  
  // 1. Markdownの ```json ... ``` を削除
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

  // 2. 最初と最後の { } を探して、余計な文字（"Here is the JSON:"など）を削除
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. よくある構文エラーの修正
  // 末尾のカンマ削除:  , }  ->  }   や   , ]  ->  ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  
  return cleaned;
};

// ===== Main =====
export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const { image, text } = await req.json();
    let extractedText: string | undefined = text;

    // OCR処理
    if (!extractedText && image) {
      if (!process.env.GOOGLE_VISION_API_KEY) {
        return NextResponse.json({ error: "GOOGLE_VISION_API_KEY is not configured" }, { status: 500 });
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
      extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text;
      if (!extractedText) {
        return NextResponse.json({ error: "文字が読み取れませんでした" }, { status: 400 });
      }
    }

    if (!extractedText) {
      return NextResponse.json({ error: "テキストが提供されていません" }, { status: 400 });
    }

    const cleaned = cleanOCRText(extractedText);

    // Geminiモデル設定（Gemini 2.0 Flash / Lite / 1.5 Flash-8B などお好きなものに）
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", 
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
あなたは「ビジュアル英文解釈（伊藤和夫）」のエキスパートです。
入力された英文を構造解析し、以下の厳格なJSONフォーマットのみを出力してください。
余計な会話やMarkdownの装飾（\`\`\`json など）は不要です。

【解析ルール】
1. S / V / O / C / M / CONN の役割を割り当てる。
2. M（修飾語句）は前置詞句や副詞節などの大きな塊でまとめ、文頭のイントロフレーズも必ず残す。
3. 名詞節・形容詞節・副詞節は、内部構造（S' V' など）を sub_structures に記述する。
4. **括弧（ブラケット）規則**（出力上で示すか、必ず役割に対応するtypeを設定すること）
   - S/O/C → noun とし、表示上は【 】で囲まれる想定
   - M      → modifier とし、表示上は＜ ＞で囲まれる想定
   - V      → verb とし、括弧なしで表示される想定
   - CONN   → connector とし、役割に応じて節全体の外側括弧を決める（副詞節ならM扱いで＜ ＞、名詞節ならO扱いで【 】 など）

【出力JSONの例（One-shot Example）】
入力: "Because he was sick, he could not go to school."
出力:
{
  "clean_text": "Because he was sick, he could not go to school.",
  "sentences": [
    {
      "sentence_id": 1,
      "original_text": "Because he was sick, he could not go to school.",
      "translation": "彼は病気だったので、学校へ行けなかった。",
      "main_structure": [
        { "text": "Because he was sick,", "translation": "彼は病気だったので", "type": "connector", "role": "M" },
        { "text": "he", "translation": "彼は", "type": "noun", "role": "S" },
        { "text": "could not go", "translation": "行けなかった", "type": "verb", "role": "V" },
        { "text": "to school.", "translation": "学校へ", "type": "modifier", "role": "M" }
      ],
      "chunks": [],
      "vocab_list": [{ "word": "sick", "meaning": "病気の" }],
      "details": ["副詞節(Because...)が主節のVを修飾している構造。"],
      "sub_structures": [
        {
          "target_text": "Because he was sick,",
          "explanation": "理由を表す副詞節",
          "chunks": [
             { "text": "Because", "type": "connector", "role": "CONN" },
             { "text": "he", "type": "noun", "role": "S'" },
             { "text": "was", "type": "verb", "role": "V'" },
             { "text": "sick", "type": "modifier", "role": "C'" }
          ]
        }
      ]
    }
  ]
}

【ズームイン解析（初心者向けの図解フォーマット）】
- sub_structures 内の each節 は、以下の「ブロック表記」で文字列を組むこと（リストではなく1つのテキストブロックでよい）。
- 角括弧 [ ] は接続詞・関係詞に、隅付き括弧【 】はS'/O'/C'に、V'は括弧なし。
- 関係代名詞が主語を兼ねる場合は [ S' / who ] のようにS'として扱う（決してC'にしない）。
- 長い引用や文は【O'】としてひとかたまりにする。
- 各行の表示順は必ず「英語→日本語訳→役割」。英語の下に英語を重ねないこと。訳が無い場合でも簡潔な日本語を入れる。

ブロック例（One-shot）:
解析対象: "that said, "A driver must..."
(役割: 直前の a law を詳しく説明する関係代名詞節)
> [ that ] (S' / 関係代名詞)
> 　↓
> said (V'：〜と書いてあった)
> 　↓
> 【 "A driver must..." 】 (O'：引用文)

【実際の解析対象】
${cleaned}
`;

    const apiResult = await model.generateContent(prompt);
    const response = apiResult.response;

    // トークン使用量とコストのログ出力（レシート）
    const usage = response.usageMetadata;
    if (usage) {
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        // Gemini 2.0 Flash 概算レート ($1=150円)
        const totalCost = (inputTokens * 0.0000225) + (outputTokens * 0.00009);
        
        console.log("🧾 ============ レシート ============");
        console.log(`📥 Input : ${inputTokens} tokens`);
        console.log(`📤 Output: ${outputTokens} tokens`);
        console.log(`💰 Cost  : 約 ${totalCost.toFixed(4)} 円`);
        console.log("===================================");
    }

    let out: string;
    try {
      out = response.text();
    } catch (err) {
      out = "";
    }

    // ===== Safe JSON Parse with multiple fallbacks =====
    const safeParse = (text: string): any => {
      const strip = (t: string) => t.replace(/^\uFEFF/, "").trim();
      const removeTrailingCommas = (t: string) => t.replace(/,\s*([}\]])/g, "$1");
      const core = removeTrailingCommas(strip(text));
      const direct = core;
      const braceMatch = core.match(/\{[\s\S]*\}/);
      const inner = braceMatch ? removeTrailingCommas(braceMatch[0]) : core;
      try {
        return JSON.parse(direct);
      } catch (_) {
        try {
          return JSON.parse(inner);
        } catch (err2) {
          console.error("JSON Parsing Failed (safeParse)", err2);
          throw err2;
        }
      }
    };

    // JSONクリーニング実行
    const jsonString = cleanJsonOutput(out);
    
    let parsed: any;
    try {
      parsed = safeParse(jsonString);
    } catch (err) {
      try {
        parsed = safeParse(out); // raw fallback
      } catch (err2) {
        console.error("JSON Parsing Failed (all fallbacks). Sample:", jsonString.slice(0, 200) + "...");
        console.error("Error details:", err2);
        return NextResponse.json({ error: "AIの回答を解析できませんでした。もう一度お試しください。", details: String(err2) }, { status: 500 });
      }
    }

    // LLMが配列で返すケースに対応（先頭要素を採用）
    if (Array.isArray(parsed)) {
      parsed = parsed[0] ?? {};
    }
    // 依然としてオブジェクトでなければエラーを返す
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error("Parsed JSON is not an object:", parsed);
      return NextResponse.json({ error: "AIの回答形式が不正です。もう一度お試しください。" }, { status: 500 });
    }

    // sentences が無い場合のフォールバック（単文を想定して包む）
    if (!Array.isArray(parsed.sentences)) {
      const fallbackChunks = parsed.chunks || parsed.main_structure || [];
      parsed.sentences = [
        {
          sentence_id: 1,
          original_text: parsed.original_text || parsed.clean_text || cleaned || "",
          chunks: fallbackChunks,
          main_structure: parsed.main_structure || fallbackChunks,
          translation: parsed.translation || parsed.full_translation || parsed.japanese_translation || parsed.translatedText || "",
          full_translation: parsed.full_translation || parsed.translation || "",
          vocab_list: Array.isArray(parsed.vocab_list) ? parsed.vocab_list : [],
          details: parsed.details || [],
          sub_structures: parsed.sub_structures || [],
        },
      ];
    }

    // Roleの正規化（強力版）
    const normalizeRole = (role: any): string => {
      if (!role) return "M";
      const r = String(role).trim().replace(/''+/g, "'").toUpperCase();

      // 表記揺れ吸収
      if (r === "SUBJECT" || r === "SUBJ") return "S";
      if (r === "OBJECT" || r === "OBJ") return "O";
      if (r === "VERB") return "V";
      if (r === "COMPLEMENT") return "C";
      if (r === "MODIFIER" || r === "MOD") return "M";
      if (r === "CONNECT" || r === "CONNECTOR" || r === "CONJUNCTION") return "CONN";

      // ダッシュ付き
      if (r.startsWith("S")) return r.includes("'") ? "S'" : "S";
      if (r.startsWith("O")) return r.includes("'") ? "O'" : "O";
      if (r.startsWith("C")) return r.includes("'") ? "C'" : "C";
      if (r.startsWith("V")) return r.includes("'") ? "V'" : "V";

      const validRoles = ["S", "O", "C", "M", "V", "S'", "O'", "C'", "M'", "V'", "CONN"];
      return validRoles.includes(r) ? r : "M";
    };

    // Typeの正規化（強力版）: 役割を最優先で型に落とす
    const normalizeType = (type: any, role: any): string => {
      const r = String(role || "").trim().toUpperCase();
      // 役割優先マッピング（括弧規則に直結）
      if (r === "S" || r === "O" || r === "C" || r === "S'" || r === "O'" || r === "C'") return "noun";
      if (r.startsWith("M")) return "modifier";
      if (r.startsWith("V")) return "verb";
      if (r === "CONN") return "connector";

      const t = String(type || "").trim().toLowerCase();
      if (t.includes("noun")) return "noun";
      if (t.includes("verb")) return "verb";
      if (t.includes("modif") || t.includes("adj") || t.includes("adv")) return "modifier";
      if (t.includes("conn") || t.includes("conj")) return "connector";

      return "noun";
    };

    const normalizeChunkArray = (arr: any): z.infer<typeof ChunkSchema>[] => {
      return Array.isArray(arr)
        ? arr.map((c: any) => {
            const role = normalizeRole(c?.role);
            const type = normalizeType(c?.type, role);
            return {
              text: c?.text ?? "",
              // ズームインでは英語重複を避けるため、訳が無ければ空文字
              translation: c?.translation ?? c?.meaning ?? "",
              type,
              role,
              explanation: c?.explanation ?? "",
              modifies: c?.modifies ?? undefined,
              note: c?.note ?? "",
            };
          })
        : [];
    };

    if (parsed?.sentences && Array.isArray(parsed.sentences)) {
      parsed.sentences = parsed.sentences.map((s: any, idx: number) => {
        const main_structure = normalizeChunkArray(s?.main_structure ?? s?.chunks);
        const chunks = normalizeChunkArray(s?.chunks ?? s?.main_structure);

        // sub_structures正規化
        const sub_structures = Array.isArray(s?.sub_structures)
          ? s.sub_structures.map((sub: any) => ({
              target_text: sub?.target_text ?? sub?.target_chunk ?? "",
              target_chunk: sub?.target_chunk ?? sub?.target_text ?? "",
              analyzed_text: sub?.analyzed_text ?? "",
              explanation: sub?.explanation ?? "",
              chunks: normalizeChunkArray(sub?.chunks),
            }))
          : [];

        // detailsを文字列に正規化（LLMがオブジェクトを返す場合に備える）
        const normalizedDetails = Array.isArray(s?.details)
          ? s.details
              .map((d: any) => {
                if (typeof d === "string") return d;
                try {
                  return JSON.stringify(d);
                } catch {
                  return String(d ?? "");
                }
              })
              .filter((d: any) => typeof d === "string" && d.trim().length > 0)
          : [];

        // details 先頭が空ならフォールバックで概要を作る
        if (normalizedDetails.length === 0 && main_structure.length > 0) {
          const sChunk = main_structure.find((c) => c.role === "S")?.text || "";
          const vChunk = main_structure.find((c) => c.role === "V")?.text || "";
          const ocChunk = main_structure.find((c) => c.role === "O" || c.role === "C")?.text || "";
          const mChunks = main_structure.filter((c) => c.role?.startsWith("M")).map((c) => c.text).join(" / ");
          normalizedDetails.unshift(
            [
              `Sentence: ${s?.original_text ?? ""}`,
              `[構造解析]: ${main_structure.map((c) => `${c.text}(${c.role})`).join(" | ")}`,
              `S: ${sChunk}`,
              `V: ${vChunk}`,
              `O/C: ${ocChunk}`,
              `M: ${mChunks}`,
              `Japanese Translation: ${s?.translation ?? s?.full_translation ?? ""}`,
            ].join("\n")
          );
        }

        return {
          sentence_id: typeof s?.sentence_id === "number" ? s.sentence_id : idx + 1,
          original_text: s?.original_text ?? "",
          main_structure,
          chunks,
          translation: s?.translation ?? s?.full_translation ?? "",
          full_translation: s?.full_translation ?? s?.translation ?? "",
          vocab_list: Array.isArray(s?.vocab_list) ? s.vocab_list : [],
          details: normalizedDetails,
          sub_structures,
        };
      });
    }

    parsed.clean_text = parsed?.clean_text ?? cleaned;

    const validated = ResponseSchema.parse(parsed);
    return NextResponse.json(validated);

  } catch (e: any) {
    console.error("Server Error:", e?.message || String(e));

    const errorMessage = e?.message || String(e);
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
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}