import { motion } from 'framer-motion';
import type { LectureItem } from '@/types';

interface LectureStageProps {
  currentItem: LectureItem | null;
  isSpeaking: boolean;
}

export function LectureStage({ currentItem, isSpeaking }: LectureStageProps) {
  // 黒板に表示するテキストを決定
  // 優先順位: displayBoard > text > keyword
  const displayText = currentItem?.displayBoard || currentItem?.text || currentItem?.keyword || '';
  const keyword = currentItem?.keyword;

  return (
    <div className="w-full h-[30vh] bg-gradient-to-br from-green-900 via-green-800 to-green-900 rounded-lg shadow-2xl relative overflow-hidden">
      {/* 黒板の質感 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.1) 2px,
            rgba(0,0,0,0.1) 4px
          )`
        }} />
      </div>

      {/* 黒板の枠 */}
      <div className="absolute inset-0 border-4 border-green-700 rounded-lg" />

      {/* コンテンツ */}
      <div className="relative w-full h-full flex items-center justify-center p-8">
        {displayText && (
          <motion.div
            key={currentItem?.id || 'empty'}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              scale: keyword ? 1.1 : 1,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`text-center ${
              keyword 
                ? 'text-4xl md:text-5xl font-bold text-yellow-300' 
                : 'text-3xl md:text-4xl font-semibold text-white'
            }`}
          >
            {keyword || displayText}
          </motion.div>
        )}

        {!displayText && (
          <div className="text-white/50 text-xl">
            講義を開始してください
          </div>
        )}
      </div>

      {/* 話者アイコン */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div className={`flex items-center gap-2 ${isSpeaking && currentItem?.speaker === 'teacher' ? 'animate-bounce' : ''}`}>
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            先
          </div>
        </div>
        <div className={`flex items-center gap-2 ${isSpeaking && currentItem?.speaker === 'student' ? 'animate-bounce' : ''}`}>
          <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
            生
          </div>
        </div>
      </div>
    </div>
  );
}
