/**
 * ShareModal.tsx
 * 
 * シェアモーダルコンポーネント
 * QRコードとSNSシェアボタンを提供
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, Twitter, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { vibrateLight, vibrateSuccess } from '@/lib/haptics';

// ===== Types =====

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ===== Main Component =====

export const ShareModal = ({ isOpen, onClose }: ShareModalProps) => {
  const [copied, setCopied] = useState(false);
  
  // アプリのURLを取得
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // シェアテキスト
  const shareText = 'Potenote Scannerで英語を学ぼう！友達と一緒に勉強して、ガチャを回そう！';
  
  // URLをコピー
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      vibrateSuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };
  
  // X (Twitter) でシェア
  const handleShareTwitter = () => {
    vibrateLight();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(appUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };
  
  // LINEで送る
  const handleShareLINE = () => {
    vibrateLight();
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(appUrl)}`;
    window.open(lineUrl, '_blank', 'width=550,height=420');
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 max-w-md w-full border-2 border-cyan-500/30 shadow-2xl"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Potenote Scannerをシェア</h2>
            </div>
            <button
              onClick={() => {
                vibrateLight();
                onClose();
              }}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* 招待文言 */}
          <div className="mb-6 text-center">
            <p className="text-white text-lg font-medium mb-2">
              友達と一緒に勉強して、ガチャを回そう！
            </p>
            <p className="text-gray-400 text-sm">
              このアプリをシェアして、みんなで英語学習を楽しもう
            </p>
          </div>
          
          {/* QRコード */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white rounded-xl">
              <QRCodeSVG
                value={appUrl}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
          
          {/* 招待リンク */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              招待リンク
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={appUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    コピーしました
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    コピー
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* SNSシェアボタン */}
          <div className="space-y-3">
            <button
              onClick={handleShareTwitter}
              className="w-full py-3 px-4 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Twitter className="w-5 h-5" />
              X (Twitter) でシェア
            </button>
            
            <button
              onClick={handleShareLINE}
              className="w-full py-3 px-4 bg-[#06C755] hover:bg-[#05b348] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              LINEで送る
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareModal;

