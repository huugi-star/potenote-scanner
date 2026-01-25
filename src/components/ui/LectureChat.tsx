import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { LectureItem } from '@/types';

interface LectureChatProps {
  items: LectureItem[];
  currentItemId: number | null;
}

export function LectureChat({ items, currentItemId }: LectureChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const lastItemIdRef = useRef<number | null>(null);

  // ユーザーが手動でスクロールしているかチェック
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // ユーザーが一番下に近い位置にいない場合は手動スクロールと判断
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      userScrolledRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 自動スクロールは無効化（ユーザーが手動でスクロールできるようにする）
  // 新しいアイテムが再生されても自動スクロールしない
  useEffect(() => {
    if (currentItemId !== null && currentItemId !== lastItemIdRef.current) {
      lastItemIdRef.current = currentItemId;
      // 自動スクロールは行わない
    }
  }, [currentItemId]);

  const getBubbleColor = (item: LectureItem) => {
    // speakerに応じて背景色を設定（先生=青、生徒=緑）
    if (item.speaker === 'teacher') {
      return 'bg-blue-500 text-white';
    } else if (item.speaker === 'student') {
      return 'bg-green-500 text-white';
    }
    
    // speakerが設定されていない場合は、typeに応じて設定（後方互換性）
    switch (item.type) {
      case 'question':
        return 'bg-blue-500 text-white';
      case 'answer':
        return 'bg-green-500 text-white';
      case 'explanation':
        return 'bg-blue-500 text-white'; // 先生の説明は青
      case 'introduction':
      case 'summary':
      case 'closing':
        return 'bg-blue-500 text-white'; // 先生の発言は青
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getBubblePosition = (item: LectureItem) => {
    return item.speaker === 'teacher' ? 'items-start' : 'items-end';
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {items.map((item) => {
        if (item.type === 'silence') {
          return null;
        }

        const isCurrent = item.id === currentItemId;
        const bubbleColor = getBubbleColor(item);
        const position = getBubblePosition(item);
        const displayText = item.text || '';

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${position}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isCurrent ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
              } ${bubbleColor}`}
            >
              <div className="text-sm font-medium">{displayText}</div>
            </div>
          </motion.div>
        );
      })}
      <div ref={chatEndRef} />
    </div>
  );
}
