import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { jsonrepair } from "jsonrepair";
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

const StructureExplanationSchema = z.object({
  target_text: z.string(),
  explanation: z.string(),
  difficulty_level: z.enum(["easy", "medium", "hard"]).optional(),
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
  structure_explanations: z.array(StructureExplanationSchema).optional(),
  advanced_grammar_explanation: z.string().optional(),
});

const ResponseSchema = z.object({
  clean_text: z.string(),
  sentences: z.array(SentenceSchema),
  splitNotice: z.string().optional(),
});

// ===== Types for Syntax Analysis =====
type SyntaxToken = {
  text: string;
  beginOffset: number;
  pos: { tag: string | null };
  dep: {
    headTokenIndex: number | null;
    label: string | null;
  };
  lemma: string | null;
};

type SyntaxAnalysisResult = {
  language: string | null;
  tokens: SyntaxToken[];
};

/** NL tokens から 1KB 未満の構造サマリを生成。Gemini にはこれのみ渡す（tokens は絶対に渡さない） */
function buildStructureSummary(tokens: SyntaxToken[]): string {
  if (!tokens || tokens.length === 0) return "{}";
  const idxToText = (i: number) => (tokens[i]?.text ?? "").trim() || `t${i}`;
  const label = (t: SyntaxToken) => (t.dep?.label ?? "").toUpperCase();
  const headIdx = (t: SyntaxToken) => t.dep?.headTokenIndex ?? -1;

  const root: string[] = [];
  const subjects: string[] = [];
  const objects: string[] = [];
  const negation: string[] = [];
  const modifiers: string[] = [];

  tokens.forEach((t) => {
    const lab = label(t);
    const txt = (t.text ?? "").trim();
    if (!txt) return;
    if (lab === "ROOT") root.push(txt);
    if (lab === "NSUBJ" || lab === "NSUBJPASS") subjects.push(txt);
    if (lab === "OBJ" || lab === "DOBJ" || lab === "IOBJ") objects.push(txt);
    if (lab === "NEG") negation.push(txt);
    if (lab === "AMOD" || lab === "ADVMOD") {
      const h = headIdx(t);
      const headTxt = h >= 0 ? idxToText(h) : "";
      if (headTxt) modifiers.push(`${txt}->${headTxt}`);
    }
  });

  const out: Record<string, unknown> = {
    root: root.length ? root[0] : null,
    subjects: subjects.length ? subjects : undefined,
    objects: objects.length ? objects : undefined,
    neg: negation.length ? negation : undefined,
    mods: modifiers.length ? modifiers.slice(0, 12) : undefined, // 爆発防止で上限
  };
  // 空のキーを削除して短く
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined || (Array.isArray(out[k]) && (out[k] as unknown[]).length === 0)) delete out[k];
  });
  let s = JSON.stringify(out);
  if (s.length > 1000) s = JSON.stringify({ root: out.root, subjects: (out.subjects as string[])?.slice(0, 3), objects: (out.objects as string[])?.slice(0, 2), mods: (out.mods as string[])?.slice(0, 5) });
  return s;
}

/** 構文解析結果がある場合: 説明のみ生成用プロンプト。構造サマリのみ渡す（tokens は絶対に入れない） */
function buildSyntaxPrompt(structureSummary: string, cleaned: string): string {
  return (
    "あなたは「ビジュアル英文解釈（伊藤和夫）」のエキスパートです。\n" +
    "**重要**: 以下の構造サマリ（root/subjects/objects/mods）を参考にしつつ、説明のみを生成してください。\n\n" +
    "【構造サマリ（参考）】\n" +
    structureSummary +
    "\n\n【あなたの役割】\n" +
    "1. **入力された英文の全文を必ず解析すること。途中で切れず、すべての文を sentences に含めること。**\n" +
    "2. 上記の構造サマリを参考に S/V/O/M の構成を把握する\n" +
    "3. 英文をチャンクに分け、各チャンクに日本語訳と役割を割り当てる\n" +
    "4. 構造（root/subjects/objects）はサマリを尊重する\n" +
    "5. 和訳と解説のみを生成する\n" +
    "6. **details は必ず1つ以上出力すること**（文の構造の概要説明。例: \"副詞節が主節のVを修飾している\"）\n" +
    "7. **名詞節・形容詞節・副詞節などの複雑な節がある場合、sub_structures に必ず記述すること**\n" +
    "8. **vocab_list には重要単語・イディオム・熟語を必ず含めること**（語彙学習に役立つものを3〜8個選び、{ \"word\": \"英語\", \"meaning\": \"日本語の意味\" } 形式で出力）\n\n" +
    "【sub_structures の形式】各要素: { \"target_text\": \"節の文字列\", \"explanation\": \"役割と内部構造の解説\", \"chunks\": [{ \"text\": \"\", \"translation\": \"\", \"type\": \"noun|verb|modifier|connector\", \"role\": \"S|V|O|C|M|CONN\" }] }\n\n" +
    "【出力JSONフォーマット】\n" +
    '{"clean_text":"<CLEANED>","sentences":[{"sentence_id":1,"original_text":"<CLEANED>","translation":"和訳","main_structure":[{"text":"","translation":"","type":"noun|verb|modifier|connector","role":"S|V|O|C|M|CONN"}],"chunks":[],"vocab_list":[],"details":["構造の概要説明をここに"],"sub_structures":[{"target_text":"節の文字列","explanation":"解説","chunks":[{"text":"","translation":"","type":"noun","role":"S"}]}]}]}\n\n' +
    "【実際の解析対象】\n" +
    cleaned
  ).replace(/<CLEANED>/g, cleaned);
}

/** フォールバック: 従来のGemini単独解析用プロンプト */
function buildFallbackPrompt(cleaned: string): string {
  return (
    "あなたは「ビジュアル英文解釈（伊藤和夫）」のエキスパートです。\n" +
    "入力された英文を構造解析し、以下の厳格なJSONフォーマットのみを出力してください。\n" +
    "余計な会話やMarkdownの装飾は不要です。\n\n" +
    "【解析ルール】\n" +
    "1. **入力された英文の全文を必ず解析すること。途中で切れず、すべての文を sentences に含めること。**\n" +
    "2. S / V / O / C / M / CONN の役割を割り当てる。\n" +
    "3. M（修飾語句）は前置詞句や副詞節などの大きな塊でまとめ、文頭のイントロフレーズも必ず残す。\n" +
    "4. **名詞節・形容詞節・副詞節がある場合、sub_structures に必ず内部構造を記述する。** target_text, explanation, chunks を含めること。\n" +
    "5. S/O/C → noun、M → modifier、V → verb、CONN → connector のtypeを設定すること。\n" +
    "6. **details は必ず1つ以上出力すること**（文の構造の概要説明）。\n" +
    "7. **vocab_list には重要単語・イディオム・熟語を必ず含めること**（語彙学習に役立つものを3〜8個選び、{ \"word\": \"英語\", \"meaning\": \"日本語の意味\" } 形式で出力）\n\n" +
    "【sub_structures の形式】各要素: { \"target_text\": \"節の文字列\", \"explanation\": \"役割と内部構造の解説\", \"chunks\": [{ \"text\": \"\", \"translation\": \"\", \"type\": \"noun|verb|modifier|connector\", \"role\": \"S|V|O|C|M|CONN\" }] }\n\n" +
    "【出力JSONの例】\n" +
    '{"clean_text":"Because he was sick, he could not go to school.","sentences":[{"sentence_id":1,"original_text":"Because he was sick, he could not go to school.","translation":"彼は病気だったので、学校へ行けなかった。","main_structure":[{"text":"Because he was sick,","translation":"彼は病気だったので","type":"connector","role":"M"},{"text":"he","translation":"彼は","type":"noun","role":"S"},{"text":"could not go","translation":"行けなかった","type":"verb","role":"V"},{"text":"to school.","translation":"学校へ","type":"modifier","role":"M"}],"chunks":[],"vocab_list":[{"word":"sick","meaning":"病気の"},{"word":"could not go","meaning":"行けなかった（イディオム）"},{"word":"because","meaning":"～なので、～だから"}],"details":["副詞節(Because...)が主節のVを修飾している構造。"],"sub_structures":[{"target_text":"Because he was sick","explanation":"Because が導く副詞節。主節の述語 could not go を修飾し、理由を表す。","chunks":[{"text":"Because","translation":"なぜなら","type":"connector","role":"CONN"},{"text":"he","translation":"彼は","type":"noun","role":"S"},{"text":"was sick","translation":"病気だった","type":"verb","role":"V"}]}]}]}\n\n' +
    "【実際の解析対象】\n" +
    cleaned
  );
}

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
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return cleaned;
};

/** 切り詰め・不正JSONを修復してパース。jsonrepair で復元を試みる */
const safeParseWithRepair = (text: string): any => {
  const strip = (t: string) => t.replace(/^\uFEFF/, "").trim();
  const base = strip(text);
  const cleaned = cleanJsonOutput(base);

  const tryParse = (s: string): any => {
    try {
      return JSON.parse(s);
    } catch {
      throw new Error("Parse failed");
    }
  };

  try {
    return tryParse(cleaned);
  } catch {
    try {
      return tryParse(base);
    } catch {
      try {
        const repaired = jsonrepair(cleaned);
        return JSON.parse(repaired);
      } catch (err) {
        console.error("JSON repair failed:", err);
        throw err;
      }
    }
  }
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

    // ===== Step 1: Cloud Natural Language APIで構文解析 =====
    let syntaxStructure: string | null = null;
    let useSyntaxAnalysis = false;
    try {
      const baseUrl = process.env.VERCEL_URL
        ? "https://" + process.env.VERCEL_URL
        : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
      const syntaxRes = await fetch(baseUrl + "/api/analyze-syntax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
      });
      if (syntaxRes.ok) {
        const syntaxResult: SyntaxAnalysisResult = await syntaxRes.json();
        if (syntaxResult.tokens && syntaxResult.tokens.length > 0) {
          syntaxStructure = buildStructureSummary(syntaxResult.tokens);
          useSyntaxAnalysis = true;
          console.log("[translate-english] Using NL structure summary (chars:", syntaxStructure.length, ")");
        }
      }
    } catch (e: unknown) {
      console.warn("[translate-english] Syntax analysis failed, falling back to Gemini-only:", (e as Error)?.message);
    }

    // Geminiモデル設定（全文解析のため十分な出力を確保）
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const prompt = useSyntaxAnalysis && syntaxStructure ? buildSyntaxPrompt(syntaxStructure, cleaned) : buildFallbackPrompt(cleaned);
    const promptCharCount = prompt.length;

    const apiResult = await model.generateContent(prompt);
    const response = apiResult.response;

    // トークン使用量とコストのログ出力（爆発検知用）
    const usage = response.usageMetadata;
    if (usage) {
      const inputTokens = usage.promptTokenCount || 0;
      const outputTokens = usage.candidatesTokenCount ?? 0;
      const totalCost = (inputTokens * 0.0000225) + (outputTokens * 0.00009);
      console.log("🧾 ============ レシート ============");
      console.log(`📥 Gemini入力: ${promptCharCount} 文字 (${inputTokens} tokens)`);
      console.log(`📤 出力トークン: ${outputTokens} tokens`);
      console.log(`💰 Cost  : 約 ${totalCost.toFixed(4)} 円`);
      if (outputTokens > 7500) console.warn("⚠️ 出力トークンが上限に近いです。");
      console.log("===================================");
    }

    let out: string;
    try {
      out = response.text();
    } catch (err) {
      out = "";
    }

    // JSONクリーニング実行（jsonrepair で切り詰め・不正JSONを修復）
    let parsed: any;
    try {
      parsed = safeParseWithRepair(out);
    } catch (err2) {
      console.error("JSON Parsing Failed (incl. repair). Sample:", out.slice(0, 200) + "...");
      console.error("Error details:", err2);
      return NextResponse.json({ error: "AIの回答を解析できませんでした。もう一度お試しください。", details: String(err2) }, { status: 500 });
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

        // details を structure_explanations にマッピング（ズームイン解析用）
        const structure_explanations = Array.isArray(s?.structure_explanations) && s.structure_explanations.length > 0
          ? s.structure_explanations
          : normalizedDetails.map((d: string) => ({ target_text: s?.original_text ?? "", explanation: d }));

        // vocab_list 正規化（meaning が undefined の場合は definition/translation をフォールバック、なければ空文字）
        const vocab_list = Array.isArray(s?.vocab_list)
          ? s.vocab_list
              .map((v: any) => ({
                word: String(v?.word ?? "").trim(),
                meaning: String(v?.meaning ?? v?.definition ?? v?.translation ?? "").trim(),
              }))
              .filter((item: { word: string; meaning: string }) => item.word.length > 0)
          : [];

        return {
          sentence_id: typeof s?.sentence_id === "number" ? s.sentence_id : idx + 1,
          original_text: s?.original_text ?? "",
          main_structure,
          chunks,
          translation: s?.translation ?? s?.full_translation ?? "",
          full_translation: s?.full_translation ?? s?.translation ?? "",
          vocab_list,
          details: normalizedDetails,
          sub_structures,
          structure_explanations,
          advanced_grammar_explanation: s?.advanced_grammar_explanation ?? (normalizedDetails[0] || null),
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