import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

// タイムアウト対策（英語学習モードは処理に時間がかかるため120秒に設定）
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// 翻訳結果の型定義（一文完結型のリスト）
const TranslationSchema = z.object({
  sentences: z.array(z.object({
    marked_text: z.string(), // 構造化された原文（Big Chunkルール適用）
    translation: z.string(), // その文の和訳
    sub_structures: z.array(z.object({
      target_chunk: z.string(), // 分解対象の文字列（例: "that the world could..."）
      analyzed_text: z.string() // 分解後のタグ付きテキスト（例: "[the world]<{S'}> could..."）
    })).optional(), // 複雑な部分の分解リスト（ズームイン解析）
    vocab_list: z.array(z.object({
      word: z.string(),   // 例: "keep up with"
      meaning: z.string(), // 例: "～に遅れずについていく"
      isIdiom: z.boolean().optional(), // イディオムかどうか
      explanation: z.string().optional() // イディオムの説明（isIdiomがtrueの場合に推奨）
    })).optional(), // 重要単語・熟語リスト
    grammar_note: z.string().optional(), // ワンポイント文法解説
    structure_explanations: z.array(z.object({
      target_text: z.string(), // 説明対象のテキスト（例: "because it frightened their horses"）
      explanation: z.string(), // 詳しい構造説明
      difficulty_level: z.enum(['easy', 'medium', 'hard']).optional() // 難易度（オプション）
    })).optional() // 難しい部分の詳しい説明（アコーディオン用）
  }))
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text } = body;
    let extractedText = text;

    // 1. OCR処理 (Google Vision API)
    if (!extractedText) {
      if (!image) return NextResponse.json({ error: "No data" }, { status: 400 });
      
      const base64Content = image.replace(/^data:image\/\w+;base64,/, "");
      const visionResponse = await fetch(`${GOOGLE_VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Content },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }]
        })
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        throw new Error(`Vision API Error: ${errText}`);
      }
      
      const visionData = await visionResponse.json();
      extractedText = visionData.responses[0]?.fullTextAnnotation?.text;

      if (!extractedText) return NextResponse.json({ error: "No text found" }, { status: 400 });
    }

    // テキスト抽出完了

    // 2. 構造解析 (OpenAI) - Few-Shot方式のプロンプト
    const systemPrompt = `あなたは「ビジュアル英文解釈（伊藤和夫メソッド）」の専門家です。

ユーザーが入力した英文を、以下の**「模範解答（Examples）」の構造と論理に完全に従って**解析し、JSONを出力してください。

⚠️ ABSOLUTE PRIORITY: EXACT TEXT MATCH ⚠️
出力する marked_text は、入力された原文の単語・句読点を**1つたりとも省略・削除してはならない。**
すべての単語がいずれかのタグの中、あるいはタグの外に、必ず存在していることを保証せよ。

【解析の基本指針】
1. 文の骨格 (S/V/O/C) を最優先で特定する。
2. 修飾語 (M) は < > (副詞・前置詞句) か ( ) (形容詞・関係詞節) で括る。
3. 直読直解: 英語の語順通りに日本語訳を当てる。

【重要：模範解答 (Few-Shot Examples)】
以下のケーススタディを厳密に模倣すること。

PROCESS:
1. Split input into sentences
2. For EACH sentence, create:
   - marked_text: Structure markers with tags <{Role:Attribute:Meaning}> (MUST include ALL words from input)
   - translation: Natural Japanese translation (直読直解の順序)
   - vocab_list: Important words/phrases (optional, max 3 items)
     * If the word/phrase is an idiom, include isIdiom: true and explanation (brief explanation of the idiom's meaning)
     * Example: {"word": "break the ice", "meaning": "場の雰囲気を和らげる", "isIdiom": true, "explanation": "緊張した雰囲気を和らげることを意味します。"}
   - grammar_note: One-point grammar explanation (REQUIRED for complex sentences)
   - sub_structures: Detailed analysis of complex subordinate clauses (optional, for 5+ word clauses)

TAGGING FORMAT: <{Role:Attribute:Meaning}>
- Role: S, V, O, C, M, Conn
- Attribute: Grammar type or "_"
- Meaning: Direct Japanese translation

SYMBOLS (絶対遵守):
- [ ] = 名詞（S/O/Cになる文の骨格のみ。修飾語には絶対に使わない）
- ( ) = 形容詞・関係詞節（名詞を修飾する場合のみ）
- < > = 副詞・前置詞句・修飾語（Mの役割を持つものは必ず< >を使用）

【重要：記号の使い分けルール】
- 役割がM（修飾語）の場合、必ず< >を使用すること。[]は絶対に使わない。
- 副詞、前置詞句、副詞節は全て< >で囲む。
- NG例: [quickly]<{M}> → OK: <quickly><{M}>
- NG例: [often]<{M}> → OK: <often><{M}>
- NG例: [very good]<{C}> → OK: [very good]<{C}>（Cなので[]はOK）

【UI整形ルール（絶対遵守）】
1. 修飾語(M)は必ず< >を使用（最重要）:
   - 役割がM（修飾語）の場合、必ず< >を使用すること。[ ]は絶対に使わない。
   - 副詞、前置詞句、副詞節は全て< >で囲む。
   - NG: [quickly]<{M}> → OK: <quickly><{M}>
   - NG: [often]<{M}> → OK: <often><{M}>
   - NG: [very good]<{C}> → OK: [very good]<{C}>（Cなので[]はOK）
   - 副詞節（because, when, if, althoughで始まる）も必ず< ... ><{M}>として出力。
   - NG: <because><{M}> [it]<{S'}> ...
   - OK: <because it frightened their horses><{M:接続詞:なぜなら～だから}>

2. 形容詞節の丸カッコ (Round Brackets for Adjectives):
   - 名詞を後ろから修飾する「関係代名詞節 (that, who, which)」や「形容詞句」は、必ず ( ... ) で括ること。
   - 四角カッコ [ ] は骨格(SOC)専用であるため、修飾語(M)には使わない。
   - NG: [a law] [that said...]<{M}>
   - OK: [a law] ( that said... )<{M:関係詞節:～という}>

【模範解答 (Few-Shot Examples)】
以下のケーススタディを厳密に模倣すること。

#### Case 1: 複合動詞と前置詞句
Input: "For many years, the population began to increase."
Output Logic:
- For many years → 前置詞句なので M < ... > (不定詞ではない)
- began to increase → 「し始めた」という複合動詞なのでまとめて V (分解しない)
Output:
{
  "sentences": [{
    "marked_text": "<For many years><{M:前置詞句:長年の間}> , [the population]<{S:_:人口は}> began to increase<{V:_:増加し始めた}> .",
    "translation": "長年の間、人口は増加し始めた。",
    "vocab_list": [{"word": "increase", "meaning": "増加する"}],
    "grammar_note": "For many yearsは前置詞句(M)で、時間を表しています。began to increaseは複合動詞で、まとめてVとして扱います。"
  }]
}

#### Case 2: Wh節の倒置 (OSV)
Input: "No one knows how many people the earth can support."
Output Logic:
- how many people → supportの目的語が前に出ているので O'
- the earth → 主語 S'
Output:
{
  "sentences": [{
    "marked_text": "[No one]<{S:_:誰も}> knows<{V:_:知らない}> [how many people the earth can support]<{O:wh節:地球がどれだけの人を支えられるか}> .",
    "translation": "誰も、地球がどれだけの人を支えられるか知らない。",
    "vocab_list": [{"word": "support", "meaning": "支える"}],
    "grammar_note": "how many節全体がknowsの目的語(O)になっています。中身を見ると、『how many people』が目的語(O')、『the earth』が主語(S')、『can support』が動詞(V')という構造です。",
    "sub_structures": [{
      "target_chunk": "how many people the earth can support",
      "analyzed_text": "how many [people]<{O':_:どれだけの人を}> [the earth]<{S':_:地球が}> can support<{V':_:支えられるか}>"
    }]
  }]
}

#### Case 3: 第5文型 (SVOC) と 関係代名詞
Input: "They called it a devil wagon that frightened horses."
Output Logic:
- call O C の形なので it (O) と wagon (C) を分ける。
- that... は wagon にかかる形容詞節なので M ( ... ) で括る（[ ] は使わない）
Output:
{
  "sentences": [{
    "marked_text": "[They]<{S:_:彼らは}> called<{V:_:呼んだ}> [it]<{O:_:それを}> [a devil wagon]<{C:_:悪魔の車と}> (that frightened horses)<{M:関係詞節:馬を驚かせる}> .",
    "translation": "彼らはそれを、馬を驚かせる悪魔の車と呼んだ。",
    "vocab_list": [{"word": "devil wagon", "meaning": "悪魔の車"}],
    "grammar_note": "calledの直後にit (O)とa devil wagon (C)が続く第5文型(SVOC)です。that節はwagonを修飾する関係詞節(M)です。",
    "sub_structures": [{
      "target_chunk": "that frightened horses",
      "analyzed_text": "that frightened<{V':_:驚かせた}> [horses]<{O':_:馬を}>"
    }]
  }]
}

#### Case 3.5: 副詞節の完全凝集（追加例）
Input: "People were afraid because it frightened their horses."
Output Logic:
- because節は副詞節なので、メイン表示では内部を分解せず、一つの < ... ><{M}> として出力。
- 内部構造は sub_structures で生成。
Output:
{
  "sentences": [{
    "marked_text": "[People]<{S:_:人々は}> were<{V:_:だった}> [afraid]<{C:_:恐れていた}> <because it frightened their horses><{M:接続詞:なぜならそれが彼らの馬を驚かせたから}> .",
    "translation": "人々は恐れていた、なぜならそれが彼らの馬を驚かせたから。",
    "vocab_list": [{"word": "frighten", "meaning": "驚かせる"}],
    "grammar_note": "because節は理由を表す副詞節(M)です。",
    "sub_structures": [{
      "target_chunk": "because it frightened their horses",
      "analyzed_text": "because [it]<{S':_:それが}> frightened<{V':_:驚かせた}> [their horses]<{O':_:彼らの馬を}>"
    }]
  }]
}

#### Case 4: Be動詞と補語
Input: "The result was very good."
Output Logic:
- Be動詞 was は単独で V。後ろの形容詞は C。
Output:
{
  "sentences": [{
    "marked_text": "[The result]<{S:_:結果は}> was<{V:_:だった}> [very good]<{C:_:非常に良好}> .",
    "translation": "結果は非常に良好だった。",
    "vocab_list": [{"word": "result", "meaning": "結果"}],
    "grammar_note": "wasの直後のvery goodは補語(C)です。be動詞 + 形容詞の構造です。"
  }]
}

EXAMPLE with adverbs:
Input: "She quickly finished her homework yesterday."
Output:
{
  "sentences": [{
    "marked_text": "She<{S:_:彼女は}> <quickly><{M:副詞:素早く}> finished<{V:_:終えた}> [her homework]<{O:_:宿題を}> <yesterday><{M:副詞:昨日}>.",
    "translation": "彼女は昨日、素早く宿題を終えた。",
    "vocab_list": [{"word": "finish", "meaning": "終える"}],
    "grammar_note": "quicklyとyesterdayは副詞(M)で、動詞finishedを修飾しています。"
  }]
}

EXAMPLE with be verb + adjective (Rule 7):
Input: "Death rates were very high."
Output:
{
  "sentences": [{
    "marked_text": "[Death rates]<{S:_:死亡率は}> were<{V:_:だった}> [very high]<{C:_:非常に高かった}>.",
    "translation": "死亡率は非常に高かった。",
    "vocab_list": [{"word": "death rate", "meaning": "死亡率"}],
    "grammar_note": "wereの直後のvery highは補語(C)です。be動詞 + 形容詞の構造です。"
  }]
}

EXAMPLE with be verb + participle adjective (Rule 8 - SVC separation):
Input: "Scientists believe that the world will soon be overpopulated."
Output:
{
  "sentences": [{
    "marked_text": "[Scientists]<{S:_:科学者たちは}> believe<{V:_:信じている}> [that the world will soon be overpopulated]<{O:接続詞that(名詞節):世界がすぐに過密になるということを}>.",
    "translation": "科学者たちは、世界がすぐに過密になると信じている。",
    "vocab_list": [{"word": "overpopulated", "meaning": "過密な"}],
    "grammar_note": "that節全体がbelieveの目的語(O)になっています。中身を見ると、『the world』が主語(S')、『will soon be』が動詞(V')、『overpopulated』が補語(C')という構造です。",
    "sub_structures": [{
      "target_chunk": "that the world will soon be overpopulated",
      "analyzed_text": "that [the world]<{S':_:世界が}> will soon be<{V':_:すぐに～になる}> [overpopulated]<{C':_:過密な}>"
    }]
  }]
}
VERIFICATION: "will be" and "overpopulated" are separated. "will be" is V', "overpopulated" is C'. NOT combined as one V.

EXAMPLE with become + adjective (Rule 8):
Input: "She became famous."
Output:
{
  "sentences": [{
    "marked_text": "[She]<{S:_:彼女は}> became<{V:_:～になった}> [famous]<{C:_:有名な}>.",
    "translation": "彼女は有名になった。",
    "vocab_list": [{"word": "become", "meaning": "～になる"}],
    "grammar_note": "becameの直後のfamousは補語(C)です。become + 形容詞の構造です。"
  }]
}
VERIFICATION: "became" and "famous" are separated. NOT combined as one V.

EXAMPLE with SVOC separation (Rule 13):
Input: "People called it a 'devil wagon'."
Output:
{
  "sentences": [{
    "marked_text": "[People]<{S:_:人々は}> called<{V:_:呼んだ}> [it]<{O:_:それを}> [a 'devil wagon']<{C:_:悪魔の車と}>.",
    "translation": "人々はそれを悪魔の車と呼んだ。",
    "vocab_list": [{"word": "devil wagon", "meaning": "悪魔の車"}],
    "grammar_note": "calledの直後にit (O)とa 'devil wagon' (C)が続く第5文型(SVOC)です。"
  }]
}
VERIFICATION: "it" and "a 'devil wagon'" are separated. "it" is O, "a 'devil wagon'" is C. NOT combined as one O.

EXAMPLE with formal subject (Rule 14):
Input: "It is often necessary to pass laws."
Output:
{
  "sentences": [{
    "marked_text": "[It]<{S:形式主語:それは}> is<{V:_:だ}> <often><{M:副詞:しばしば}> [necessary]<{C:_:必要}> [to pass laws]<{S:真主語:法律を通すことは}>.",
    "translation": "法律を通すことはしばしば必要だ。",
    "vocab_list": [{"word": "necessary", "meaning": "必要な"}],
    "grammar_note": "Itは形式主語で、真主語はto pass lawsです。"
  }]
}
VERIFICATION: "It" is tagged as S (形式主語), "to pass laws" is tagged as S (真主語).

EXAMPLE with phrasal verb "stay off" (Rule 15):
Input: "Cars had to stay off the highways."
Output:
{
  "sentences": [{
    "marked_text": "[Cars]<{S:_:車は}> had to stay off<{V:_:立ち退かなければならなかった}> [the highways]<{O:_:高速道路から}>.",
    "translation": "車は高速道路から立ち退かなければ（入ってはいけ）なかった。",
    "vocab_list": [{"word": "stay off", "meaning": "～から離れている、～に入らない"}],
    "grammar_note": "stay offは「～から離れている（～に入らない）」という否定的なニュアンスを持つ句動詞です。"
  }]
}
VERIFICATION: "stay off" is translated correctly with negative nuance ("stay away from", "not enter"). NOT reversed to positive.

EXAMPLE with if clause at sentence start (Rule 9):
Input: "If the population continues to grow, the world will face problems."
Output:
{
  "sentences": [{
    "marked_text": "<If the population continues to grow><{M:接続詞if:もし人口が増え続けるなら}> [the world]<{S:_:世界は}> will face<{V:_:直面するだろう}> [problems]<{O:_:問題に}>.",
    "translation": "もし人口が増え続けるなら、世界は問題に直面するだろう。",
    "vocab_list": [{"word": "continue to", "meaning": "～し続ける"}],
    "grammar_note": "文頭のif節は条件を表す修飾語(M)です。"
  }]
}

EXAMPLE with Wh-clause OSV structure (Rule 10):
Input: "Scientists wonder how many people the earth can support."
Output:
{
  "sentences": [{
    "marked_text": "[Scientists]<{S:_:科学者たちは}> wonder<{V:_:疑問に思う}> [how many people the earth can support]<{O:接続詞how many(名詞節):地球がどれだけの人を支えられるか}>.",
    "translation": "科学者たちは、地球がどれだけの人を支えられるか疑問に思う。",
    "vocab_list": [{"word": "support", "meaning": "支える"}],
    "grammar_note": "how many節全体がwonderの目的語(O)になっています。中身を見ると、『how many people』が目的語(O')、『the earth』が主語(S')、『can support』が動詞(V')という構造です。",
    "sub_structures": [{
      "target_chunk": "how many people the earth can support",
      "analyzed_text": "how many [people]<{O':_:どれだけの人を}> [the earth]<{S':_:地球が}> can support<{V':_:支えられるか}>"
    }]
  }]
}

EXAMPLE with coordinating conjunction (Rule 11):
Input: "The population grew, and food production increased."
Output:
{
  "sentences": [{
    "marked_text": "[The population]<{S:_:人口は}> grew<{V:_:増加した}> and<{Conn:_:そして}> [food production]<{S:_:食料生産は}> increased<{V:_:増加した}>.",
    "translation": "人口は増加し、そして食料生産も増加した。",
    "vocab_list": [{"word": "production", "meaning": "生産"}],
    "grammar_note": "andは等位接続詞(Conn)で、2つの文を結んでいます。"
  }]
}

EXAMPLE with if clause showing complete text preservation:
Input: "If the population continues to grow at its present rate, the world will face problems."
Output:
{
  "sentences": [{
    "marked_text": "<If the population continues to grow at its present rate><{M:接続詞if:もし人口が現在のペースで増え続けるなら}> [the world]<{S:_:世界は}> will face<{V:_:直面するだろう}> [problems]<{O:_:問題に}>.",
    "translation": "もし人口が現在のペースで増え続けるなら、世界は問題に直面するだろう。",
    "vocab_list": [{"word": "at its present rate", "meaning": "現在のペースで"}],
    "grammar_note": "文頭のif節は条件を表す修飾語(M)です。if節内では、『the population』が主語(S')、『continues to grow』が動詞(V')、『at its present rate』が修飾語(M')です。"
  }]
}
VERIFICATION: All words from input ("If", "the", "population", "continues", "to", "grow", "at", "its", "present", "rate") appear in marked_text. NO words dropped.

EXAMPLE with compound sentence split (Rule 11):
Input: "Then death rates began to improve, and people learned to control diseases."
Output:
{
  "sentences": [{
    "marked_text": "Then<{M:副詞:その後}> [death rates]<{S:_:死亡率は}> began to improve<{V:_:改善し始めた}> and<{Conn:_:そして}> [people]<{S:_:人々は}> learned to control<{V:_:制御することを学んだ}> [diseases]<{O:_:病気を}>.",
    "translation": "その後、死亡率は改善し始め、そして人々は病気を制御することを学んだ。",
    "vocab_list": [{"word": "learn to", "meaning": "～することを学ぶ"}],
    "grammar_note": "andの後ろに新しい主語(people)と動詞(learned)が続く重文構造です。andで前の文と後ろの文を分けています。"
  }]
}
VERIFICATION: All words from input appear in marked_text. NO words dropped.

EXAMPLE with compound sentence split (Rule 11):
Input: "As a result, death rates began to drop, and the population grew rapidly."
Output:
{
  "sentences": [{
    "marked_text": "<As a result><{M:前置詞句:その結果}> [death rates]<{S:_:死亡率は}> began to drop<{V:_:低下し始めた}> and<{Conn:_:そして}> [the population]<{S:_:人口は}> grew<{V:_:増加した}> <rapidly><{M:副詞:急速に}>.",
    "translation": "その結果、死亡率は低下し始め、そして人口は急速に増加した。",
    "vocab_list": [{"word": "as a result", "meaning": "その結果"}],
    "grammar_note": "andの後ろに新しい主語(the population)と動詞(grew)が続く重文構造です。andで前の文と後ろの文を分けています。"
  }]
}

CRITICAL REQUIREMENTS:
1. EXACT TEXT MATCH (最高優先度): The output marked_text MUST contain EVERY SINGLE WORD from the input text. Count words: input word count = output word count. If any word is missing, the output is INVALID.
   - Before finalizing, verify: Extract all words from input (split by spaces), extract all words from marked_text (remove tags), compare counts - they MUST be equal.
2. Follow the 4 Case Studies above STRICTLY. Use their logic and structure as templates.
3. marked_text must be ORIGINAL ENGLISH TEXT. Process ALL sentences.
4. Apply the same patterns from Case Studies to similar structures:
   - Compound verbs (begin to, continue to, learn to) = ONE verb (like Case 1)
   - Wh-clauses with OSV = separate O' and S' (like Case 2)
   - SVOC structures = separate O and C (like Case 3)
   - Be verb + adjective = separate V and C (like Case 4)
5. For coordinating conjunctions (and, but, or, so) followed by new subject + verb, split at previous verb and tag conjunction as Conn.
6. For phrasal verbs with "off" (stay off, keep off), translate with negative nuance ("stay away from", "not enter").

GRAMMAR NOTE GENERATION:
When a subordinate clause (that/wh/if/because clause) appears, explain its INTERNAL structure:
- Template: "この[記号]節は、文全体の[役割]になっています。中身を見ると、『[単語]』が主語(S')、『[単語]』が動詞(V')という構造です。"
- For prepositional phrases: "これは[理由/時間/場所]を表す前置詞句です。"

STRUCTURE EXPLANATIONS (for difficult parts - accordion display):
Generate structure_explanations array for parts that users might find difficult:
- Subordinate clauses (that/wh/if/because clauses)
- Complex prepositional phrases
- Inverted word order
- Phrasal verbs
- Passive voice constructions
- Each explanation should include:
  * target_text: The exact text from marked_text that needs explanation
  * explanation: Detailed explanation of the structure (2-3 sentences)
  * difficulty_level: 'easy', 'medium', or 'hard' (optional)
- Example: {
    "target_text": "because it frightened their horses",
    "explanation": "これは接続詞becauseで始まる副詞節です。文全体では修飾語(M)の役割を果たしています。中身を見ると、'it'が主語(S')、'frightened'が動詞(V')、'their horses'が目的語(O')という構造になっています。",
    "difficulty_level": "medium"
  }

SUB-STRUCTURES (for complex clauses 5+ words):
- Extract chunk text from marked_text
- Analyze internal structure with S', V', O', C' tags

VALIDATION CHECKLIST (before outputting):
- [ ] All words from input appear in marked_text
- [ ] All punctuation marks are preserved
- [ ] Structure follows one of the 4 Case Studies
- [ ] Tags are correctly applied without dropping text`;

    // テキストが長すぎる場合は切り詰める（1300文字まで）
    const maxTextLength = 1300;
    const truncatedText = extractedText.length > maxTextLength 
      ? extractedText.substring(0, maxTextLength) + "..."
      : extractedText;
    
    // デバッグ: 切り詰め前後の文字数をログ出力
    console.log(`[translate-english] Original text length: ${extractedText.length}, Truncated length: ${truncatedText.length}`);

    // generateTextを使用して通常のAPI呼び出し（ストリーミングなし）
    try {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `${systemPrompt}\n\n${truncatedText}\n\nJSON:`,
        temperature: 0.3,
        maxTokens: 3000,
      });

      // JSONをパース
      let parsedResult;
      try {
        // JSON部分を抽出（```json や ``` を除去）
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw text:', text);
        throw new Error('AIの出力をJSONとして解析できませんでした');
      }

      // バリデーション
      const validatedResult = TranslationSchema.parse(parsedResult);

      return NextResponse.json(validatedResult);
    } catch (generateError: any) {
      console.error('翻訳処理エラー:', generateError);
      throw new Error(`翻訳処理に失敗しました。詳細: ${generateError.message}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to translate", details: errorMessage },
      { status: 500 }
    );
  }
}
