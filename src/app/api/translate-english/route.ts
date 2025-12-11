import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// ===== Zod Schemas =====
const VocabSchema = z.object({
  word: z.string(),
  meaning: z.string(),
});

const ChunkSchema = z.object({
  text: z.string(),
  translation: z.string(),
  type: z.enum(["noun", "modifier", "verb", "connector"]),
  role: z.enum(["S", "O", "C", "M", "V", "S'", "O'", "C'", "M'", "V'", "CONN"]),
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
あなたは伊藤和夫「ビジュアル英文解釈」のエキスパートです。入力文を句・節ごとに塊で区切り、SVOCMの役割を示してください。出力は必ず有効なJSONのみ。

【最低限のルール】
- S / V / O / C を明確に。M は大きな塊（前置詞句・時/場所表現など）でまとめ、細切れにしない。
- 名詞節・形容詞節・副詞節は節全体を1ブロック（role: S'/O'/C'/M'）として扱い、内部構造は details / sub_structures で補足。
- 省略された that / which などは (that) などで明示。
- type は noun / modifier / verb / connector、role は S,V,O,C,M,S',V',O',C',M',CONN を使用。

【JSONフォーマット】
{
  "clean_text": "OCR補正後の英文",
  "sentences": [
    {
      "sentence_id": 1,
      "original_text": "原文",
      "main_structure": [ { "text": "...", "translation": "...", "type": "...", "role": "S" } ],
      "chunks": [同上または互換配列],
      "translation": "和訳",
      "full_translation": "和訳（省略可）",
      "vocab_list": [{ "word": "...", "meaning": "..." }],
      "details": ["構造説明やズームインの解説（文字列）"],
      "sub_structures": [
        { "target_text": "...", "explanation": "...", "chunks": [ { "text": "...", "translation": "...", "type": "...", "role": "S'" } ] }
      ]
    }
  ]
}

【解析対象】
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

    // Role/Typeの正規化処理（前回と同じ）
    const normalizeRole = (role: any): z.infer<typeof ChunkSchema>["role"] => {
      if (!role) return "M";
      const r = String(role).trim().replace(/''+/g, "'").toUpperCase();
      switch (r) {
        case "S": return "S";
        case "O": return "O";
        case "C": return "C";
        case "M": return "M";
        case "V": return "V";
        case "S'": return "S'";
        case "O'": return "O'";
        case "C'": return "C'";
        case "M'": return "M'";
        case "V'": return "V'";
        case "CONN": return "CONN";
        default: return "M";
      }
    };

const normalizeType = (type: any, role: any): z.infer<typeof ChunkSchema>["type"] => {
    if (["noun", "modifier", "verb", "connector"].includes(type)) return type;
    if (String(role || "").toUpperCase().startsWith("V")) return "verb";
    if (String(role || "").toUpperCase() === "CONN") return "connector";
    if (String(role || "").toUpperCase().startsWith("M")) return "modifier";
    return "noun";
};

    const normalizeChunkArray = (arr: any): z.infer<typeof ChunkSchema>[] => {
      return Array.isArray(arr)
        ? arr.map((c: any) => {
            const role = normalizeRole(c?.role);
            const type = normalizeType(c?.type, role);
            return {
              text: c?.text ?? "",
              translation: c?.translation ?? c?.text ?? "",
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
    return NextResponse.json(
      { error: "Internal Server Error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}