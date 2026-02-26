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

/** 構文解析結果がある場合: 説明のみ生成用プロンプト（実装互換：FRAME/S_formal/S_real を使わない） */
function buildSyntaxPrompt(structureSummary: string, cleaned: string): string {
  return (
    "あなたは「ビジュアル英文解釈（伊藤和夫）」のエキスパートです。\n" +
    "**重要**: 以下の構造サマリ（root/subjects/objects/mods）を参考にしつつ、説明のみを生成してください。\n\n" +
    "【構造サマリ（参考）】\n" +
    structureSummary +
    "\n\n【あなたの役割】\n" +
    "1. **入力された英文の全文を必ず解析すること。途中で切れず、すべての文を sentences に含めること。**\n" +
    "2. **文頭・修飾語句・接続詞など、一字一句省略せず、入力の全文を main_structure のチャンクで網羅すること。省略禁止。**\n" +
    "3. **主語（S）の扱い**: 主語となる名詞句全体を一つの【】ブロックとして扱うこと。主語を説明する that節・関係詞節・分詞句・前置詞句などは、修飾（M）であっても主語の外に出さず、【】の内部に＜＞として入れ子構造で表示すること。S の text には例 \"【The man ＜who lives next door＞】\" のように＜＞で修飾を囲む。主語を途中で閉じてはいけない。主節の動詞（V）が現れるまで S は確定しない。\n" +
    "4. 上記の構造サマリを参考に S/V/O/M の構成を把握する\n" +
    "5. 英文をチャンクに分け、各チャンクに日本語訳と役割を割り当てる\n" +
    "6. 構造（root/subjects/objects）はサマリを尊重する\n" +
    "7. 和訳と解説のみを生成する\n" +
    "8. **details は必ず1つ以上出力すること**（文の構造の概要説明。例: \"副詞節が主節のVを修飾している\"）\n" +
    "9. **名詞節・形容詞節・副詞節などの複雑な節がある場合、sub_structures に必ず記述すること。main_structure にもその節の全文をチャンクとして含めること（ズームイン対象も main_structure で表示する）。**\n" +
    "10. **vocab_list には重要単語・イディオム・熟語を必ず含めること**（語彙学習に役立つものを3〜8個選び、{ \"word\": \"英語\", \"meaning\": \"日本語の意味\" } 形式で出力）\n\n" +
    "【表示整形ルール】\n" +
    "- 【】は主語(S)や目的語(O)など「名詞句ブロック」。名詞句は途中で閉じない。\n" +
    "- 名詞句を修飾する要素（that節/関係詞節/分詞句/名詞に係る前置詞句）は、文全体のMとして外に出さず、【】の内部に＜＞として入れ子にする。例: \"【The man ＜who lives next door＞】\"、\"【the fact ＜that he is honest＞】\"。\n" +
    "- 動詞を修飾する要素（副詞句・前置詞句など）は、動詞の外側に＜＞で置く。例: \"went ＜to school＞\"。\n" +
    "- 動詞(V)はそのまま表示する（括弧で囲まない）。\n\n" +
    "【It / There 構文の扱い（最重要・実装互換）】\n" +
    "0. **role は必ず次のいずれかのみを使うこと**: \"S\"|\"V\"|\"O\"|\"C\"|\"M\"|\"CONN\"|\"CONJ\"|\"S'\"|\"O'\"|\"C'\"|\"M'\"|\"V'\"。\n" +
    "   - **禁止**: role:\"FRAME\" / \"S_formal\" / \"S_real\" / \"O_formal\" / \"O_real\" などは一切使わない（実装側で M に潰れて崩れるため）。\n\n" +
    "1. **形式主語 It 構文**（It is ADJ to V / It is ADJ that ...）\n" +
    "   - It = role:\"S\"（文法上の主語）\n" +
    "   - be動詞 = role:\"V\"\n" +
    "   - 形容詞（important/clear など）= role:\"C\"\n" +
    "   - to不定詞句 / that節 = role:\"S'\"（真主語）\n" +
    "   - main_structure では to句/that節は **1つの塊** で出し、内部の分解は sub_structures に書く。\n\n" +
    "2. **強調構文**（It is A that/who B）\n" +
    "   - It = role:\"S\"、be動詞 = role:\"V\"、A = role:\"C\"（焦点）\n" +
    "   - that/who 以下は **A を修飾する節（形容詞節）** として sub_structures に記述する。\n" +
    "   - **禁止**: that/who節を main_structure の別チャンクで role:\"S\" に置かない（重複・崩れの原因）。\n\n" +
    "3. **天候・時間・距離の It**\n" +
    "   - 意味が薄くても文法上の主語なので It = role:\"S\"（Mには絶対にしない）。\n\n" +
    "4. **There is/are 構文（存在構文）**\n" +
    "   - There = role:\"S\"（形式主語として扱い、文頭Mにしない：UIが安定するため）\n" +
    "   - be動詞 = role:\"V\"\n" +
    "   - 後続名詞句 = role:\"S'\"（真主語：存在するモノ/人）\n" +
    "   - **重要（統一）**: 名詞句を修飾する場所/時間の前置詞句（on the desk / in the classroom / recently / tomorrow 等）は、原則として **【名詞句】の内部に＜＞で含める**。\n" +
    "     例: There is 【a book ＜on the desk＞】\n" +
    "     例: There are 【many students ＜in the classroom＞】\n" +
    "   - **禁止**: 上記の on the desk / in the classroom / tomorrow を main_structure の独立した M チャンクとして外に出す（重複・マージ関数と衝突するため）。\n\n" +
    "5. **【特効薬】It was not until ... that ... 構文**\n" +
    "   - \"It was not until ...\" は文の枠組みだが、role:\"FRAME\" は使えないため、main_structure では次のように整理する。\n" +
    "   - It = S / was = V / not until ... = M（時を表す大きな修飾）\n" +
    "   - that 以下の内容が主節の核（S/V/O/C）になるように main_structure を組む。\n\n" +
    "6. **It takes / cost / require などの構文**\n" +
    "   - 形式主語構文ではなく、通常の SVO(O) 構造として扱う。\n" +
    "   - It = role:\"S\"、takes/cost/require = role:\"V\"、後続の目的語（時間・金額・人など） = role:\"O\" とする。\n\n" +
    "【助動詞・準助動詞・疑問文の扱い】\n" +
    "- **基本**: 助動詞（can, will等）や準助動詞（have to, ought to等）は、MやSに含めず、本動詞と結合して【1つのV】として扱うこと。\n" +
    "- **be going to**: 「be going to + 動詞」は常に未来表現として扱い、進行形＋目的の不定詞には分けず、全体を結合して【1つのV】とすること。\n" +
    "- **疑問文・倒置**: 文頭の助動詞は M にせず単独で role:\"V\" にする。さらに、主語の後ろに残った「本動詞」も絶対に O に巻き込まず、必ず独立した role:\"V\" とすること。\n\n" +
    "【重要】and/or/but などの等位接続詞は S/V/O/C/M に含めず、role:\"CONJ\"、type:\"connector\" とすること。補語(C)として誤認しないこと。\n\n" +
    "【sub_structures の形式】各要素: { \"target_text\": \"節の文字列\", \"explanation\": \"役割と内部構造の解説\", \"chunks\": [{ \"text\": \"\", \"translation\": \"\", \"type\": \"noun|verb|modifier|connector\", \"role\": \"S|V|O|C|M|CONN|CONJ|S'|O'|C'|M'|V'\" }] }\n\n" +
    "【出力JSONフォーマット】\n" +
    '{"clean_text":"<入力された英文>","sentences":[{"sentence_id":1,"original_text":"<入力された英文>","translation":"和訳","main_structure":[{"text":"","translation":"","type":"noun|verb|modifier|connector","role":"S|V|O|C|M|CONN|CONJ|S\'|O\'|C\'|M\'|V\'"}],"chunks":[],"vocab_list":[],"details":["構造の概要説明をここに"],"sub_structures":[{"target_text":"節の文字列","explanation":"解説","chunks":[{"text":"","translation":"","type":"noun","role":"S"}]}]}]}\n\n' +
    "出力は必ずJSONのみとし、```json などのMarkdownブロック記法は一切含めないでください。\n\n" +
    "【実際の解析対象】\n" +
    cleaned
  ).replace(/<CLEANED>/g, cleaned);
}

/** フォールバック: Gemini単独解析用プロンプト（実装互換：FRAME/S_formal/S_real を使わない） */
function buildFallbackPrompt(cleaned: string): string {
  return (
    "あなたは「ビジュアル英文解釈（伊藤和夫）」のエキスパートです。\n" +
    "入力された英文を構造解析し、以下の厳格なJSONフォーマットのみを出力してください。\n" +
    "余計な会話やMarkdownの装飾は不要です。\n\n" +
    "【解析ルール】\n" +
    "1. **入力された英文の全文を必ず解析すること。途中で切れず、すべての文を sentences に含めること。**\n" +
    "2. **文頭・修飾語句・接続詞・句読点など、一字一句省略せず、入力の全文を main_structure のチャンクで網羅すること。省略は厳禁。**\n" +
    "3. **主語（S）の扱い**: 主語となる名詞句全体を一つの【】ブロックとして扱うこと。主語を説明する that節・関係詞節・分詞句・前置詞句などは、修飾（M）であっても主語の外に出さず、【】の内部に＜＞として入れ子構造で表示すること。S の text には例 \"【The man ＜who lives next door＞】\" のように＜＞で修飾を囲む。主語を途中で閉じてはいけない。主節の動詞（V）が現れるまで S は確定しない。\n" +
    "4. S / V / O / C / M / CONN / CONJ の役割を割り当てる。**and/or/but などの等位接続詞は S/V/O/C/M に含めず、必ず role:\"CONJ\"、type:\"connector\" とすること。補語(C)として誤認しないこと。**\n" +
    "5. M（修飾語句）は前置詞句や副詞節などの大きな塊でまとめ、文頭のイントロフレーズ・副詞節・前置詞句も必ず省略せず残す。\n" +
    "6. **名詞節・形容詞節・副詞節がある場合、sub_structures に必ず内部構造を記述する。** target_text, explanation, chunks を含めること。節内の語も省略しないこと。**main_structure には sub_structures の target_text に相当する全文チャンクを必ず含めること。**\n" +
    "7. S/O/C → noun、M → modifier、V → verb、CONN/CONJ → connector のtypeを設定すること。\n" +
    "8. **details は必ず1つ以上出力すること**（文の構造の概要説明）。\n" +
    "9. **vocab_list には重要単語・イディオム・熟語を必ず含めること**（語彙学習に役立つものを3〜8個選び、{ \"word\": \"英語\", \"meaning\": \"日本語の意味\" } 形式で出力）\n\n" +
    "【表示整形ルール】\n" +
    "- 【】は主語(S)や目的語(O)など「名詞句ブロック」。名詞句は途中で閉じない。\n" +
    "- 名詞句を修飾する要素（that節/関係詞節/分詞句/名詞に係る前置詞句）は、文全体のMとして外に出さず、【】の内部に＜＞として入れ子にする。\n" +
    "- 動詞を修飾する要素（副詞句・前置詞句など）は、動詞の外側に＜＞で置く。\n" +
    "- 動詞(V)はそのまま表示する（括弧で囲まない）。\n\n" +
    "【It / There 構文の扱い（最重要・実装互換）】\n" +
    "0. **role は必ず次のいずれかのみを使うこと**: \"S\"|\"V\"|\"O\"|\"C\"|\"M\"|\"CONN\"|\"CONJ\"|\"S'\"|\"O'\"|\"C'\"|\"M'\"|\"V'\"。\n" +
    "   - **禁止**: role:\"FRAME\" / \"S_formal\" / \"S_real\" / \"O_formal\" / \"O_real\" などは一切使わない（実装側で M に潰れて崩れるため）。\n\n" +
    "1. **形式主語 It 構文**（It is ADJ to V / It is ADJ that ...）\n" +
    "   - It = role:\"S\"、be動詞 = role:\"V\"、形容詞 = role:\"C\"。\n" +
    "   - to不定詞句 / that節 = role:\"S'\"（真主語）。main_structure では **1つの塊** で出し、内部は sub_structures に記述する。\n\n" +
    "2. **強調構文**（It is A that/who B）\n" +
    "   - It = S / is(or was) = V / A = C。\n" +
    "   - that/who 以下は **A を修飾する形容詞節** として sub_structures に記述する。\n" +
    "   - **禁止**: that/who節を main_structure の別チャンクで role:\"S\" に置く。\n\n" +
    "3. **天候・時間・距離の It**\n" +
    "   - It = role:\"S\"（Mにしない）。\n\n" +
    "4. **There is/are 構文（存在構文）**\n" +
    "   - There = role:\"S\"（形式主語として固定し、文頭Mにしない：UIが安定するため）\n" +
    "   - be動詞 = role:\"V\"\n" +
    "   - 後続名詞句 = role:\"S'\"（真主語：存在するモノ/人）\n" +
    "   - 名詞句を修飾する場所/時間の句（on the desk / in the classroom / recently / tomorrow 等）は、**原則として【名詞句】内に＜＞で含める**。\n" +
    "   - **禁止**: それらを main_structure の独立 M として外に出す（重複の原因）。\n\n" +
    "5. **It was not until ... that ...**\n" +
    "   - It = S / was = V / not until ... = M。\n" +
    "   - that 以下の内容が主節の核（S/V/O/C）になるように main_structure を組む。\n\n" +
    "6. **It takes / cost / require などの構文**\n" +
    "   - 形式主語構文ではなく、通常の SVO(O) 構造として扱う。\n" +
    "   - It = role:\"S\"、takes/cost/require = role:\"V\"、後続の目的語（時間・金額・人など） = role:\"O\" とする。\n\n" +
    "【助動詞・準助動詞・疑問文の扱い】\n" +
    "- **基本**: 助動詞（can, will等）や準助動詞（have to, ought to等）は、MやSに含めず、本動詞と結合して【1つのV】として扱うこと。\n" +
    "- **be going to**: 「be going to + 動詞」は常に未来表現として扱い、進行形＋目的の不定詞には分けず、全体を結合して【1つのV】とすること。\n" +
    "- **疑問文・倒置**: 文頭の助動詞は M にせず単独で role:\"V\" にする。さらに、主語の後ろに残った「本動詞」も絶対に O に巻き込まず、必ず独立した role:\"V\" とすること。\n\n" +
    "【sub_structures の形式】各要素: { \"target_text\": \"節の文字列\", \"explanation\": \"役割と内部構造の解説\", \"chunks\": [{ \"text\": \"\", \"translation\": \"\", \"type\": \"noun|verb|modifier|connector\", \"role\": \"S|V|O|C|M|CONN|CONJ|S'|O'|C'|M'|V'\" }] }\n\n" +
    "【出力JSONフォーマット】\n" +
    '{"clean_text":"<入力された英文>","sentences":[{"sentence_id":1,"original_text":"<入力された英文>","translation":"和訳","main_structure":[{"text":"","translation":"","type":"noun|verb|modifier|connector","role":"S|V|O|C|M|CONN|CONJ|S\'|O\'|C\'|M\'|V\'"}],"chunks":[],"vocab_list":[],"details":["構造の概要説明をここに"],"sub_structures":[{"target_text":"節の文字列","explanation":"解説","chunks":[{"text":"","translation":"","type":"noun","role":"S"}]}]}]}\n\n' +
    "出力は必ずJSONのみとし、```json などのMarkdownブロック記法は一切含めないでください。\n\n" +
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
  // 英文構造を壊さないよう、未知文字は空白にせず削除のみ（空白にすると単語が分断される）
  cleaned = cleaned.replace(/[^\w\s.,!?;:'"(){}\[\]-]/g, "");
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
    let extractedText: string | undefined = typeof text === "string" ? text : undefined;

    // 入力サイズ制限（DoS防止）
    const MAX_TEXT_LEN = 12000;
    const MAX_IMAGE_BASE64 = 10 * 1024 * 1024; // 10MB
    if (extractedText && extractedText.length > MAX_TEXT_LEN) {
      return NextResponse.json({ error: "テキストが長すぎます。10,000文字以内にしてください。" }, { status: 400 });
    }
    if (image && typeof image === "string" && image.length > MAX_IMAGE_BASE64) {
      return NextResponse.json({ error: "画像が大きすぎます。" }, { status: 400 });
    }

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

    // OCR由来のテキストも含め長さチェック（暴走防止）
    if (extractedText.length > MAX_TEXT_LEN) {
      return NextResponse.json({ error: "テキストが長すぎます。10,000文字以内にしてください。" }, { status: 400 });
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
        maxOutputTokens: 10000,
        temperature: 0, // ★これを追加しないと毎回結果が変わります
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
      return NextResponse.json({ error: "AIの回答を解析できませんでした。もう一度お試しください。" }, { status: 500 });
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
      // 等位接続詞(and/or/but) → CONJ、従属接続詞(because/when等) → CONN
      if (r === "CONJ" || r === "CONJUNCTION") return "CONJ";
      if (r === "CONNECT" || r === "CONNECTOR") return "CONN";

      // ダッシュ付き（C'は補語の従属なので CONJ と区別）
      if (r.startsWith("S")) return r.includes("'") ? "S'" : "S";
      if (r.startsWith("O")) return r.includes("'") ? "O'" : "O";
      if (r === "C" || r === "C'") return r; // C, C' は補語。CONJ と混同しない
      if (r.startsWith("V")) return r.includes("'") ? "V'" : "V";

      const validRoles = ["S", "O", "C", "M", "V", "S'", "O'", "C'", "M'", "V'", "CONN", "CONJ"];
      return validRoles.includes(r) ? r : "M";
    };

    // Typeの正規化（強力版）: 役割を最優先で型に落とす
    const normalizeType = (type: any, role: any): string => {
      const r = String(role || "").trim().toUpperCase();
      // 役割優先マッピング（括弧規則に直結）
      if (r === "S" || r === "O" || r === "C" || r === "S'" || r === "O'" || r === "C'") return "noun";
      if (r.startsWith("M")) return "modifier";
      if (r.startsWith("V")) return "verb";
      if (r === "CONN" || r === "CONJ") return "connector";

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

    parsed.clean_text = parsed?.clean_text ?? cleaned;

    // 全文をブロック単位でsentencesに同期（AIの欠落を補う）
    const blocksFromClean = cleaned.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
    if (parsed?.sentences && Array.isArray(parsed.sentences) && blocksFromClean.length > 0) {
      const synced: any[] = [];
      for (let i = 0; i < Math.max(parsed.sentences.length, blocksFromClean.length); i++) {
        const block = blocksFromClean[i] ?? "";
        const s = parsed.sentences[i];
        if (s) {
          synced.push({ ...s, original_text: block || s.original_text || "" });
        } else {
          synced.push({
            sentence_id: i + 1,
            original_text: block,
            main_structure: [],
            chunks: [],
            translation: "",
            full_translation: "",
            vocab_list: [],
            details: [],
            sub_structures: [],
            structure_explanations: [],
          });
        }
      }
      parsed.sentences = synced;
    }

    /** 名詞句(S/O/C)直後の修飾(M)を【】内に＜＞で入れ子にマージ。表示整形ルールに従う */
    const mergeModifiersIntoNounPhrases = (arr: z.infer<typeof ChunkSchema>[]): z.infer<typeof ChunkSchema>[] => {
      if (!arr || arr.length === 0) return arr;
      const result: z.infer<typeof ChunkSchema>[] = [];
      let i = 0;
      while (i < arr.length) {
        const c = arr[i];
        const role = (c?.role ?? "").toString().toUpperCase();
        const isNoun = role === "S" || role === "O" || role === "C" || role === "S'" || role === "O'" || role === "C'";
        if (isNoun) {
          let mergedText = (c?.text ?? "").trim();
          let mergedTranslation = (c?.translation ?? "").trim();
          let j = i + 1;
          while (j < arr.length) {
            const m = arr[j];
            const mRole = (m?.role ?? "").toString().toUpperCase();
            if (!mRole.startsWith("M")) break;
            const mText = (m?.text ?? "").trim();
            if (!mText) { j++; continue; }
            if (role === "O" || role === "C" || role === "O'" || role === "C'") {
              const isNounMod = /^(who|which|whom|whose|that)\s/i.test(mText) ||
                /^(being|having|known|given|seen|made|called|based)\s/i.test(mText) ||
                /^(from|in|on|at|with|for)\s+\w+/i.test(mText);
              if (!isNounMod) break;
            }
            const mTrans = (m?.translation ?? "").trim();
            mergedText += " ＜" + mText + "＞";
            if (mTrans) mergedTranslation += " " + mTrans;
            j++;
          }
          if (j > i + 1) {
            result.push({ ...c, text: mergedText, translation: mergedTranslation });
            i = j;
          } else {
            result.push(c);
            i++;
          }
        } else {
          result.push(c);
          i++;
        }
      }
      return result;
    };

    /** main_structure に sub_structures の target_text が抜けている場合、追加・展開して全文を網羅 */
    const ensureFullMainStructure = (orig: string, main: any[], subs: any[]): any[] => {
      if (!orig || subs.length === 0) return main;
      let result = main.map((c: any) => ({ ...c }));
      for (const sub of subs) {
        const t = (sub?.target_text ?? sub?.target_chunk ?? "").trim();
        if (!t) continue;
        const pos = orig.indexOf(t);
        if (pos === -1) continue;
        const tNorm = t.replace(/\s+/g, "");
        const coveredNorm = result.map((c: any) => (c?.text ?? "").trim().replace(/\s+/g, "")).join("");
        if (coveredNorm.includes(tNorm)) continue;
        const subChunk = { text: t, translation: "", type: "noun" as const, role: "O" as const };
        const expandIdx = result.findIndex((c: any) => {
          const ct = (c?.text ?? "").trim().replace(/\s+/g, "");
          return ct && tNorm.includes(ct);
        });
        if (expandIdx >= 0) {
          result[expandIdx] = { ...result[expandIdx], text: t };
        } else {
          const withPos = result.map((c: any) => {
            const txt = (c?.text ?? "").trim();
            const p = orig.indexOf(txt);
            return { chunk: c, pos: p >= 0 ? p : orig.length };
          });
          withPos.push({ chunk: subChunk, pos });
          withPos.sort((a, b) => a.pos - b.pos);
          result = withPos.map((x) => x.chunk);
        }
      }
      return result;
    };

    if (parsed?.sentences && Array.isArray(parsed.sentences)) {
      parsed.sentences = parsed.sentences.map((s: any, idx: number) => {
        let main_structure = normalizeChunkArray(s?.main_structure ?? s?.chunks);
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

        // main_structure にズームインの target_text が抜けている場合は補完
        const orig = (s?.original_text ?? "").trim();
        main_structure = ensureFullMainStructure(orig, main_structure, sub_structures);
        // 名詞句直後のMを【】内に＜＞で入れ子にマージ（表示整形）
        main_structure = mergeModifiersIntoNounPhrases(main_structure);

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
          original_text: (s?.original_text ?? "").trim(),
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

    if (!parsed.clean_text) parsed.clean_text = cleaned;

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
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}