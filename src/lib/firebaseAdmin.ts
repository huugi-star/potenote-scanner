import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Vercel の環境変数に保存された FIREBASE_PRIVATE_KEY を正規化する。
 *
 * Vercel での保存形式は複数パターンある:
 *   A) -----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
 *      （\n がリテラル文字列 "\\n" として保存される）
 *   B) 実際の改行が含まれた状態
 *   C) JSON.stringify された文字列（外側にダブルクォートあり）
 *
 * 対処:
 *   1. 外側のクォート除去
 *   2. JSON.parse を試みて二重エスケープを解除
 *   3. \\n リテラルを実際の改行に変換
 *   4. \r\n → \n に統一
 */
const parsePrivateKey = (raw: string): string => {
  let key = raw.trim();

  // 外側のシングル/ダブルクォートを除去
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // JSON.parse で二重エスケープを解除（"\\n" → "\n" など）
  try {
    const parsed = JSON.parse(`"${key.replace(/"/g, '\\"')}"`);
    if (typeof parsed === "string" && parsed.includes("-----BEGIN")) {
      key = parsed;
    }
  } catch {
    // JSON.parse 失敗は無視して次の処理へ
  }

  // \\n リテラル（バックスラッシュ+n）を実際の改行に変換
  key = key.replace(/\\n/g, "\n");

  // \r\n を \n に統一
  key = key.replace(/\r\n/g, "\n");

  return key;
};

const getFirebaseAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"|"$/g, "");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"|"$/g, "");
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    const missing = [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !rawPrivateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    throw new Error(`[firebaseAdmin] Missing required env vars: ${missing}`);
  }

  const privateKey = parsePrivateKey(rawPrivateKey);

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error(
      "[firebaseAdmin] FIREBASE_PRIVATE_KEY does not contain PEM header after parsing.",
      `rawLength=${rawPrivateKey.length}`,
      `parsedLength=${privateKey.length}`,
      `parsedPreview=${privateKey.slice(0, 60).replace(/\n/g, "\\n")}`
    );
    throw new Error("[firebaseAdmin] FIREBASE_PRIVATE_KEY_INVALID: PEM header not found");
  }

  console.log("[firebaseAdmin] initializing with cert. projectId:", projectId, "clientEmail:", clientEmail);

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
};

export const adminDb = getFirestore(getFirebaseAdminApp());
export const adminAuth = getAuth(getFirebaseAdminApp());
