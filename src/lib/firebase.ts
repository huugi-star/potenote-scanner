// Firebase SDKの初期化

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// サーバーサイドレンダリング(SSR)での多重初期化を防ぐおまじない
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 認証機能（ログイン・課金管理用）
export const auth = getAuth(app);

// データベース機能（クイズ・広告コピー共有用）
export const db = getFirestore(app);

