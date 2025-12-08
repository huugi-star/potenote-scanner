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
  modifies: z.string().optional(), // Mがどこを修飾するか (例: "M → V: live")
  note: z.string().optional(), // 語法・冠詞など最小限の補足
});

const SentenceSchema = z.object({
  original_text: z.string(),
  chunks: z.array(ChunkSchema),
  full_translation: z.string(),
  vocab_list: z.array(VocabSchema).optional(),
  details: z.array(z.string()).optional(), // アコーディオン用の詳しい解説
});

const ResponseSchema = z.object({
  sentences: z.array(SentenceSchema),
});

// ===== Helpers =====
const cleanOCRText = (text: string): string => {
  let cleaned = text;

  // 日本語指示・ノイズ除去
  cleaned = cleaned.replace(/ビジュアル\s*\d*/gi, "");
  cleaned = cleaned.replace(/文構造を解析し[，,]?\s*和訳しなさい/gi, "");
  cleaned = cleaned.replace(/英文解釈/gi, "");

  // ページ・設問番号
  cleaned = cleaned.replace(/^[\s]*[\(（\[]?[A-Za-z]?\d+[\)）\]]?[\.。]?\s*/gm, "");
  cleaned = cleaned.replace(/\b\d{3,}\b/g, "");

  // 単独大文字ノイズ
  cleaned = cleaned.replace(/\s+[A-Z]{1,3}(?=\s|$|[,.;!?])/g, (match) => {
    const keep = ["I", "A", "US", "UK", "TV", "PC", "AI", "IT", "OK", "AM", "PM", "Mr", "Mrs", "Ms", "Dr"];
    return keep.includes(match.trim()) ? match : " ";
  });
  cleaned = cleaned.replace(/^\s*[A-Z]{1,3}\s*$/gm, "");
  cleaned = cleaned.replace(/\b(Pl|RSS|WWW|URL|PDF|MP3|MP4|GPS)\b/gi, "");

  // 記号・空白整理
  cleaned = cleaned.replace(/-{3,}/g, "");
  cleaned = cleaned.replace(/[^\w\s.,!?;:'"(){}\[\]-]+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

const stripCodeFences = (text: string): string => {
  if (!text) return "";
  return text.replace(/```json|```/g, "").trim();
};

// ===== Main =====
export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const { image, text } = await req.json();
    let extractedText: string | undefined = text;

    // OCR
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

    // クリーニング
    const cleaned = cleanOCRText(extractedText);

    // Geminiモデル
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
あなたは伊藤和夫「ビジュアル英文解釈」のエキスパートです。
以下の英文を伊藤メソッドに従って解析し、指定のJSONのみを出力してください。

【OCR誤字訂正（最重要）】
- 入力はOCR由来のため誤字・脱字・記号誤りを含みます。解析前に文脈から正しい英文へ復元してください。
- 例: "The1r"→"Their", "modem life"→"modern life"
- 不自然なピリオドは除去またはカンマに修正し、英文として自然な形に直してから解析すること

【前処理・クリーニング】
- 日本語指示、ページ番号、設問番号（(1), [A] 等）、意味不明な記号を完全に削除
- 文中改行は連結し、正しい英文に復元してから解析

【チャンク分割と記号ルール】
1) 名詞的要素（S/O/C/名詞節）: type "noun", role S/O/C/S'/O'/C'、記号は【】
2) 修飾的要素（副詞/前置詞句など）: type "modifier", role M/M'、記号は＜＞
3) 動詞的要素: type "verb", role V/V'、記号なし
4) 接続詞（and/butなど）: type "connector", role CONN とし、機能を note に「接続：並列」「接続：逆接」のように記載

【節と矢印の扱い（最重要）】
- that節・wh節は「節全体」を O として1ブロックで扱う（that単体にラベルを付けない）
- 主節・従属節ともに S → V → O の直線構造を意識して並べる（S' → V' → O'）
- 副詞節（if/when/because/althoughなど）は「副詞節：条件/理由/時/譲歩」など意味ラベルを note に付与し、修飾先（文全体やV）も明記
- 従属節・that節・関係詞節について、節の役割と内部構造を「詳しい解説」(details) に段落で追加する
- details 配列は必須で、各従属節/関係詞節/that節ごとに1段落以上入れる（アコーディオン表示用）

【修飾語の明示】
- M は必ず「どの語を修飾しているか」を modifies に “M → V” “M → S” のように明記する

【語法・冠詞の補足】
- note に the の特定性、such の強調、increase が自動詞/他動詞か、主語省略/再提示（and後のS/V）など最小限の補足を一行で入れる

【解説の質】
- 各チャンクの explanation に「なぜその役割か」を初心者向けに具体的に書く
  例: "前置詞inで始まる句なのでMです。動詞livedを修飾しています。"

【訳抜け防止・省略補完】
- 省略された that / which / when / because などは（that）（which）を補って解析
- 全チャンクの translation は必ず日本語。英語のままは禁止

【出力JSONフォーマット】
{
  "sentences": [
    {
      "original_text": "原文の一文",
      "chunks": [
        { "text": "...", "translation": "...", "type": "noun|modifier|verb|connector", "role": "S|O|C|M|V|S'|O'|C'|M'|V'|CONN", "explanation": "...", "modifies": "M → V など", "note": "副詞節: 条件 / 接続：並列 / 冠詞の特定性 など" }
      ],
      "full_translation": "文全体の自然な日本語訳",
      "vocab_list": [
        { "word": "highly", "meaning": "高く、大いに（副詞）" }
      ],
      "details": [
        "従属節・that節・関係詞節の役割と内部構造を説明した段落（アコーディオン用）"
      ]
    }
  ]
}

【解析対象の英文】
${cleaned}

JSON以外は出力しないでください。
`;

    const apiResult = await model.generateContent(prompt);
    const response = apiResult.response;

    let out: string;
    try {
      const textResp = response.text();
      if (typeof textResp === "string") {
        out = textResp;
      } else if (textResp && typeof textResp === "object") {
        out = JSON.stringify(textResp);
      } else {
        out = String(textResp || "");
      }
    } catch (err) {
      const cand = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!cand) throw err;
      out = cand;
    }

    out = stripCodeFences(out);

    let parsed: any;
    try {
      parsed = JSON.parse(out);
    } catch (err) {
      console.error("JSON parse error:", err, out);
      return NextResponse.json({ error: "JSON parse failed", details: String(err) }, { status: 500 });
    }

    // --- Post-process to normalize roles and types before validation ---
    const normalizeRole = (role: any): z.infer<typeof ChunkSchema>["role"] => {
      if (!role) return "M";
      const r = String(role).trim();
      // collapse double apostrophes like S'' -> S'
      const collapsed = r.replace(/''+/g, "'");
      const upper = collapsed.toUpperCase();
      switch (upper) {
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
        default: return "M";
      }
    };

    const normalizeType = (type: any, role: z.infer<typeof ChunkSchema>["role"]): z.infer<typeof ChunkSchema>["type"] => {
      if (type === "noun" || type === "modifier" || type === "verb") return type;
      if (role === "V" || role === "V'") return "verb";
      if (role === "M" || role === "M'") return "modifier";
      return "noun";
    };

    if (parsed?.sentences && Array.isArray(parsed.sentences)) {
      parsed.sentences = parsed.sentences.map((s: any) => {
        const chunks = Array.isArray(s.chunks) ? s.chunks.map((c: any) => {
          const role = normalizeRole(c?.role);
          const type = normalizeType(c?.type, role);
          return {
            text: c?.text ?? "",
            translation: c?.translation ?? c?.text ?? "",
            type,
            role,
            explanation: c?.explanation ?? "",
          };
        }) : [];
        return {
          original_text: s?.original_text ?? "",
          chunks,
          full_translation: s?.full_translation ?? "",
          vocab_list: Array.isArray(s?.vocab_list) ? s.vocab_list : [],
          details: Array.isArray(s?.details) ? s.details : [],
        };
      });
    }

    const validated = ResponseSchema.parse(parsed);
    return NextResponse.json(validated);
  } catch (e: any) {
    console.error("Translation error:", e?.message || String(e));
    return NextResponse.json(
      { error: "Failed to translate", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

