import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const getFirebaseAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim().replace(/^"|"$/g, "");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim().replace(/^"|"$/g, "");
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  let privateKey: string | undefined;
  if (rawPrivateKey) {
    // Vercel は環境変数の改行を \n リテラルとして保存することがある
    // 1. 前後のクォートを除去
    // 2. \\n (バックスラッシュ+n) を実際の改行に変換
    // 3. すでに実際の改行が含まれている場合はそのまま
    privateKey = rawPrivateKey
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n");

    // -----BEGIN PRIVATE KEY----- が含まれているか確認
    if (!privateKey.includes("-----BEGIN")) {
      console.error("[firebaseAdmin] FIREBASE_PRIVATE_KEY does not contain expected PEM header. Raw length:", rawPrivateKey.length);
    }
  }

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  console.warn("[firebaseAdmin] Missing env vars, falling back to applicationDefault(). projectId:", !!projectId, "clientEmail:", !!clientEmail, "privateKey:", !!privateKey);
  return initializeApp({
    credential: applicationDefault(),
  });
};

export const adminDb = getFirestore(getFirebaseAdminApp());
export const adminAuth = getAuth(getFirebaseAdminApp());
