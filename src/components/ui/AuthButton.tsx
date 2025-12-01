'use client';

import { useState } from 'react';
import { LogIn, LogOut, AlertCircle } from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useGameStore } from '@/store/useGameStore';

export const AuthButton = () => {
  const uid = useGameStore(state => state.uid);
  const setUserId = useGameStore(state => state.setUserId);
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);

  const isLoggedIn = !!uid;

  const handleLogin = async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase Auth is not configured');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await setUserId(user.uid);
    } catch (error) {
      console.error('Google Login Error:', error);
    } finally {
      setLoading(false);
      setShowLoginConfirm(false);
    }
  };

  const handleConfirmLogout = async () => {
    setLoading(true);
    try {
      if (auth) {
        try {
          await signOut(auth);
        } catch (error) {
          console.error('Logout Error:', error);
        }
      }
      // UIDをクリアしつつ、ローカル状態を完全リセット
      await setUserId(null);
      useGameStore.getState().reset();
    } finally {
      setLoading(false);
      setShowLogoutConfirm(false);
    }
  };

  const shortId = isLoggedIn && uid ? `${uid.slice(0, 4)}...` : null;
  const displayName = isLoggedIn && auth?.currentUser?.displayName
    ? auth.currentUser.displayName
    : null;

  return (
    <>
      {/* メインボタン */}
      <button
        onClick={isLoggedIn ? () => setShowLogoutConfirm(true) : () => setShowLoginConfirm(true)}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-60 border border-white/10"
        title={isLoggedIn ? (displayName || 'ログイン中') : 'Googleでログイン'}
      >
        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
          <img
            src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png"
            alt="Google"
            className="w-4 h-4"
          />
        </div>
        <span className="flex items-center gap-1 max-w-[120px] truncate">
          {loading
            ? '処理中...'
            : isLoggedIn
              ? (displayName || shortId || 'ログイン中')
              : 'ログイン'}
        </span>
        {!isLoggedIn && !loading && (
          <LogIn className="w-4 h-4 hidden sm:inline" />
        )}
        {loading && (
          <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
        )}
      </button>

      {/* ログイン確認モーダル */}
      {showLoginConfirm && !isLoggedIn && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xs sm:max-w-sm bg-gray-900 rounded-2xl border border-gray-700 p-5 shadow-xl">
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-300 mb-1">
                【データのバックアップについて】
              </p>
              <p className="text-xs text-gray-300 leading-relaxed">
                クラウドに同期（引き継ぎ）されるクイズや翻訳の履歴は、通信節約のため
                <span className="font-semibold">最新の30件まで</span>となります。
                （※現在お使いの端末内には、引き続きすべての履歴が無制限に保存されます）
              </p>
              <p className="text-xs text-gray-200 mt-2">
                Googleアカウントでログインして、データを保存しますか？
              </p>
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => setShowLoginConfirm(false)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'ログイン中...' : 'Googleでログインして保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ログアウト確認モーダル */}
      {showLogoutConfirm && isLoggedIn && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xs sm:max-w-sm bg-gray-900 rounded-2xl border border-gray-700 p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">ログアウトしますか？</p>
                <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                  あなたの学習データは、クラウドに安全にバックアップされています。
                  この端末からは一時的にデータが消去されますが、次回ログインすればいつでも続きから再開できます。
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                {loading ? 'ログアウト中...' : 'ログアウト'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

