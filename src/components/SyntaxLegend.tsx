/**
 * SyntaxLegend.tsx
 * 
 * 記号とマークの読み方ガイド（凡例）
 * 初学者が解析結果の意味を理解できるよう、記号の説明を表示
 */

import React, { useState } from 'react';

export const SyntaxLegend = () => {
  const [isOpen, setIsOpen] = useState(false); // デフォルトは閉じても開いてもOK

  return (
    <div className="mt-8 border-t border-gray-700 pt-6 pb-20">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
      >
        <span className="font-bold text-white">📘 記号とマークの読み方</span>
        <span className="text-gray-400">{isOpen ? '閉じる ▲' : '開く ▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-6 px-2">
          
          {/* 1. カッコの説明 */}
          <section>
            <h3 className="font-bold text-sm text-gray-300 mb-3">カタマリの形</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="font-mono bg-blue-500 text-white px-2 py-1 rounded border border-blue-600 shadow-sm">[ ... ]</span>
                <div>
                  <p className="font-bold text-sm text-white">文の骨格（捨てちゃダメ！）</p>
                  <p className="text-xs text-gray-300">主語(S)や目的語(O)になる、文のメインパーツです。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono bg-green-500 text-white px-2 py-1 rounded border border-green-600 shadow-sm">( ... )</span>
                <div>
                  <p className="font-bold text-sm text-white">名詞の説明（肉付け）</p>
                  <p className="text-xs text-gray-300">直前の言葉を「どんな～？」と詳しく説明します。</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono bg-purple-500 text-white px-2 py-1 rounded border border-purple-600 shadow-sm">&lt; ... &gt;</span>
                <div>
                  <p className="font-bold text-sm text-white">おまけ・背景（修飾語）</p>
                  <p className="text-xs text-gray-300">「いつ・どこで」などの状況説明です。なくても文は成り立ちます。</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. SVOの説明 */}
          <section>
            <h3 className="font-bold text-sm text-gray-300 mb-3">役割のマーク</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 p-2 rounded border border-gray-700">
                <span className="font-bold text-blue-400">S (主語)</span>
                <p className="text-xs text-gray-300 mt-1">主人公<br/>「～は・が」</p>
              </div>
              <div className="bg-gray-800 p-2 rounded border border-gray-700">
                <span className="font-bold text-red-400">V (動詞)</span>
                <p className="text-xs text-gray-300 mt-1">動き・結論<br/>「～する・だ」</p>
              </div>
              <div className="bg-gray-800 p-2 rounded border border-gray-700">
                <span className="font-bold text-green-400">O (目的語)</span>
                <p className="text-xs text-gray-300 mt-1">ターゲット<br/>「～を・に」</p>
              </div>
              <div className="bg-gray-800 p-2 rounded border border-gray-700">
                <span className="font-bold text-yellow-400">C (補語)</span>
                <p className="text-xs text-gray-300 mt-1">イコール<br/>「S ＝ C」</p>
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

