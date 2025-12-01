'use client';

import { useState } from 'react';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useGameStore } from '@/store/useGameStore';

export const AuthButton = () => {
  const uid = useGameStore(state => state.uid);
  const setUserId = useGameStore(state => state.setUserId);
  const [loading, setLoading] = useState(false);

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
    }
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Logout Error:', error);
      }
    }
    await setUserId(null);
  };

  const isLoggedIn = !!uid;

  return (
    <button
      onClick={isLoggedIn ? handleLogout : handleLogin}
      disabled={loading}
      className=\"inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors disabled:opacity-60\"
    >
      {loading ? (
        <Loader2 className=\"w-4 h-4 animate-spin\" />
      ) : isLoggedIn ? (
        <LogOut className=\"w-4 h-4\" />
      ) : (
        <LogIn className=\"w-4 h-4\" />
      )}
      <span>{loading ? '処理中...' : isLoggedIn ? 'ログアウト' : 'Googleでログイン'}</span>
    </button>
  );
};


