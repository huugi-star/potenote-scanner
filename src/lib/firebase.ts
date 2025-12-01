// Firebase SDKの初期化

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ★重要: Step 1で取得したキーを .env.local に入れて、ここで読み込みます
// コードに直書きすると危険なので、環境変数を使います
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase初期化（環境変数が設定されている場合のみ）
let app: ReturnType<typeof initializeApp> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

try {
  // 最低限必要な環境変数が設定されているかチェック
  if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    googleProviderInstance = new GoogleAuthProvider();
  } else {
    console.warn("Firebase環境変数が不足しています。Firebase機能は無効化されます。");
  }
} catch (error) {
  console.error("Firebase初期化エラー:", error);
  // エラーが発生してもアプリは動作し続ける
}

// 認証機能（ログイン・課金管理用）
export const auth = authInstance;

// データベース機能（クイズ・広告コピー共有用）
export const db = dbInstance;

// Googleログイン用プロバイダ
export const googleProvider = googleProviderInstance;

