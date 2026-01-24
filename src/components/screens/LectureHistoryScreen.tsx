/**
 * LectureHistoryScreen.tsx
 * 
 * 講義履歴一覧画面
 * 過去に生成した講義を一覧表示し、再表示・削除できる
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronLeft, Play, Calendar } from 'lucide-react';
import { vibrateLight } from '@/lib/haptics';
import { useGameStore } from '@/store/useGameStore';
import type { LectureHistory } from '@/types';

// ===== Types =====

interface LectureHistoryScreenProps {
  onBack: () => void;
  onSelectLecture?: (history: LectureHistory) => void;
}

// ===== Helper Functions =====

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getToneLabel = (tone: string): string => {
  const toneMap: Record<string, string> = {
    normal: '標準',
    lazy: '気だるげ',
    kyoto: '京都弁',
    ojousama: 'お嬢様',
    gal: 'ギャル',
    sage: '賢者',
  };
  return toneMap[tone] || tone;
};

const getLectureTitle = (script: { items: Array<{ displayBoard?: string; text?: string }>; sourceText?: string }): string => {
  // 最初のアイテムのdisplayBoardまたはtextを使用
  if (script.items && script.items.length > 0) {
    const firstItem = script.items[0];
    let title = firstItem.displayBoard || firstItem.text || '';
    
    if (title) {
      // 「重要事項を確認します」の部分を削除して章タイトルのみを抽出
      title = title.replace(/\s*重要事項を確認します\s*$/, '').trim();
      
      // 長すぎる場合は50文字で切り詰め
      if (title.length > 50) {
        return title.substring(0, 50) + '...';
      }
      
      // タイトルが空になった場合は「重要事項を確認します」を返す
      return title || '重要事項を確認します';
    }
  }
  
  // sourceTextから最初の50文字を取得（フォールバック）
  if (script.sourceText) {
    const text = script.sourceText.trim();
    if (text.length > 50) {
      return text.substring(0, 50) + '...';
    }
    return text || '講義';
  }
  
  return '講義';
};

// ===== Main Component =====

export const LectureHistoryScreen = ({ onBack, onSelectLecture }: LectureHistoryScreenProps) => {
  const lectureHistory = useGameStore(state => state.getLectureHistory());
  const deleteLectureHistory = useGameStore(state => state.deleteLectureHistory);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    vibrateLight();
    if (window.confirm('この講義履歴を削除しますか？')) {
      setDeletingId(id);
      deleteLectureHistory(id);
      setTimeout(() => setDeletingId(null), 300);
    }
  };

  const handleSelect = (history: LectureHistory) => {
    vibrateLight();
    if (onSelectLecture) {
      onSelectLecture(history);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              vibrateLight();
              onBack();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">講義履歴</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {lectureHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Calendar className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">講義履歴がありません</p>
              <p className="text-gray-500 text-sm mt-2">音声講義を生成すると、ここに履歴が表示されます</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {lectureHistory.map((history) => (
                  <motion.div
                    key={history.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: deletingId === history.id ? 0 : 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {getToneLabel(history.script.tone)}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(history.createdAt)}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-base font-semibold text-gray-800 mb-1">
                            {getLectureTitle(history.script)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {history.script.items.length}項目
                          </p>
                        </div>

                        {history.imageUrl && (
                          <div className="mb-3">
                            <img
                              src={history.imageUrl}
                              alt="講義元画像"
                              className="max-w-full h-32 object-contain rounded border border-gray-200"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelect(history)}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium flex items-center gap-2 hover:from-purple-500 hover:to-pink-400 transition-all text-sm"
                          >
                            <Play className="w-4 h-4" />
                            講義を表示
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(history.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
