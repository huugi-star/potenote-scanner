// src/app/api/analyze-syntax/route.ts
import { NextResponse } from "next/server";
import { LanguageServiceClient } from "@google-cloud/language";

export const runtime = "nodejs"; // Cloud SDKはnode runtime推奨

type ReqBody = { text?: unknown };

// 最小フィールドだけ返す（教材用に十分）
function pickToken(t: any) {
  return {
    text: t.text?.content ?? "",
    beginOffset: t.text?.beginOffset ?? 0,
    pos: {
      tag: t.partOfSpeech?.tag ?? null,
    },
    dep: {
      headTokenIndex: t.dependencyEdge?.headTokenIndex ?? null,
      label: t.dependencyEdge?.label ?? null,
    },
    lemma: t.lemma ?? null,
  };
}

export async function POST(req: Request) {
  let body: ReqBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json(
      { error: "Missing 'text' (string)" },
      { status: 400 }
    );
  }

  // 本文やキーはログに出さない（長さだけ）
  // eslint-disable-next-line no-console
  console.info("[analyze-syntax] request received", { length: text.length });

  try {
    const client = new LanguageServiceClient();

    const [result] = await client.analyzeSyntax({
      document: { content: text, type: "PLAIN_TEXT" },
      encodingType: "UTF8",
    });

    const tokens = (result.tokens ?? []).map(pickToken);

    return NextResponse.json({
      language: result.language ?? null,
      tokens,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[analyze-syntax] failed", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
    });

    // ここは「サーバーエラー」として500に統一（権限不足もここに入る）
    return NextResponse.json(
      { error: "Failed to analyze syntax" },
      { status: 500 }
    );
  }
}
