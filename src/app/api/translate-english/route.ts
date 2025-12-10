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

const SentenceSchema = z.object({
  sentence_id: z.number(),
  original_text: z.string(),
  chunks: z.array(ChunkSchema),
  translation: z.string(),
  vocab_list: z.array(VocabSchema).optional(),
  details: z.array(z.string()),
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
あなたは伊藤和夫「ビジュアル英文解釈」のエキスパートです。
この構文解析はAIが自動で行っています。精度は100%ではなく、特にS/Vや節の境界に誤りが含まれる場合があります。大枠の構造理解の型、直読直解の流れや呼吸をつかむ補助として利用してください。
以下の英文を伊藤メソッドに従って解析し、指定のJSONのみを出力してください。

【JSON出力の絶対厳守ルール】
1. **ValidなJSON**であること。末尾に不要なカンマ（trailing comma）をつけないこと。
2. 文字列内のダブルクォーテーションは必ずエスケープすること（例: "彼は\\"悪魔\\"と言った"）。
3. JSON以外の解説テキストは一切出力しないこと。

【OCR誤字訂正】
- 入力はOCR由来です。文脈から正しい英文へ復元してください。
- "The1r"→"Their", 不自然なピリオドの除去など。

【チャンク分割と記号ルール】
1) 名詞的要素（S/O/C/名詞節）: type "noun", role S/O/C/S'/O'/C'、記号は【】
2) 修飾的要素（副詞/前置詞句など）: type "modifier", role M/M'、記号は＜＞
3) 動詞的要素: type "verb", role V/V'、記号なし
4) 接続詞: type "connector", role CONN

【節と矢印の扱い】
- that節・wh節は「節全体」を O として1ブロックで扱う
- details 配列には、従属節やthat節の内部構造（S' V' O'）の解説を必ず含める





【構文解析の絶対ルール（上書き）】
1. **There is 構文の例外処理**:
   - "There is/are/was/were S" の構文において、"There" は必ず type: "modifier", role: "M" とせよ。
   - 後ろの名詞（意味上の主語）を role: "S" または "S'" とせよ。決して "C" としてはならない。
   
2. **句動詞 (Phrasal Verbs) の整合性**:
   - "stay off", "look at" などの群動詞を V と認定した場合、その対象語は必ず role: "O" (目的語) とせよ。
   - × stay off(V) <the road>(M)
   - ○ stay off(V) [the road](O)

3. **Be動詞の補語**:
   - Be動詞の後ろにある前置詞句（例: only for horses）が C (補語) になる場合、記号は副詞用の ＜＞ ではなく、形容詞用の ( ) または名詞用の [ ] を使用せよ。

【解析の優先順位（Safe-Fail Strategy）】
- 最優先はVの特定とSVOCの骨格維持。SとO/Cの境界を明確に。
- 修飾語の係り先が曖昧なら、無理にmodifiesを書かず、< > や ( ) だけで示す（誤指定するより空欄を選ぶ）。
- 節内部が複雑で自信が持てないときは、節全体を [名詞節] や <副詞節> の大きな塊として示し、内部を無理に分解しない。
【出力JSONフォーマット】
{
  "clean_text": "OCR補正後の正しい英文",
  "sentences": [
    {
      "sentence_id": 1,
      "original_text": "原文",
      "chunks": [
        { "text": "...", "translation": "...", "type": "noun", "role": "S", "explanation": "...", "modifies": "...", "note": "..." }
      ],
      "translation": "和訳",
      "vocab_list": [ { "word": "...", "meaning": "..." } ],
      "details": [ "詳しい解説..." ]
    }
  ]
}

【解析対象の英文】
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

    // JSONクリーニング実行
    const jsonString = cleanJsonOutput(out);
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      console.error("JSON Parsing Failed. Raw text sample:", jsonString.slice(0, 200) + "...");
      console.error("Error details:", err);
      // エラー時は生のテキストを返すか、エラーメッセージを返す
      return NextResponse.json({ error: "AIの回答を解析できませんでした。もう一度お試しください。", details: String(err) }, { status: 500 });
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
        if (role.startsWith("V")) return "verb";
        if (role === "CONN") return "connector";
        if (role.startsWith("M")) return "modifier";
        return "noun";
    };

    if (parsed?.sentences && Array.isArray(parsed.sentences)) {
      parsed.sentences = parsed.sentences.map((s: any, idx: number) => {
        const chunks = Array.isArray(s.chunks) ? s.chunks.map((c: any) => {
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
        }) : [];
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

        return {
          sentence_id: typeof s?.sentence_id === "number" ? s.sentence_id : idx + 1,
          original_text: s?.original_text ?? "",
          chunks,
          translation: s?.translation ?? s?.full_translation ?? "",
          vocab_list: Array.isArray(s?.vocab_list) ? s.vocab_list : [],
          details: normalizedDetails,
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