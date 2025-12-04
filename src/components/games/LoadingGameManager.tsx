/**
 * LoadingGameManager.tsx
 * 
 * ローディング中のゲームを管理するマネージャー
 * ランダムで異なるゲームを表示
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PrepositionGameScreen } from './PrepositionGameScreen';
import { SyntaxPuzzleScreen } from './SyntaxPuzzleScreen';
import { NuanceSwipeScreen } from './NuanceSwipeScreen';

interface LoadingGameManagerProps {
  onComplete?: () => void;
  progress?: number; // 進行度（0-100）
}

type GameType = 'PrepositionShoot' | 'SyntaxPuzzle' | 'NuanceSwipe';

const GAMES: GameType[] = ['PrepositionShoot', 'SyntaxPuzzle', 'NuanceSwipe'];

export const LoadingGameManager = ({ onComplete, progress = 0 }: LoadingGameManagerProps) => {
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);

  useEffect(() => {
    // ランダムでゲームを選択
    const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)];
    setSelectedGame(randomGame);
  }, []);

  if (!selectedGame) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">ゲームを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* 進行度バー（上部固定） */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b-2 border-cyan-400/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm font-medium">英文解釈中</span>
            <span className="text-cyan-400 font-bold text-sm">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{
                duration: 0.3,
                ease: "easeOut"
              }}
            />
          </div>
        </div>
      </div>

      {/* ゲーム本体（上部に余白を追加） */}
      <div className="pt-20">
        {selectedGame === 'PrepositionShoot' && (
          <PrepositionGameScreen />
        )}
        {selectedGame === 'SyntaxPuzzle' && (
          <SyntaxPuzzleScreen />
        )}
        {selectedGame === 'NuanceSwipe' && (
          <NuanceSwipeScreen />
        )}
      </div>
    </div>
  );
};

