/**
 * DeveloperSupport.tsx
 * 
 * 開発者支援コンポーネント
 * noteとAmazonほしい物リストへのリンクを提供
 */

import React from 'react';

// リンク先（後で定数ファイルに移動してもOK）
// TODO: 実際のnote記事URLとAmazonほしい物リストURLに差し替えてください
const NOTE_URL = "https://note.com/aoi_potenote/n/n4b5b56006637; // ここにnote記事のURLを入れる
const AMAZON_URL = "https://www.amazon.jp/hz/wishlist/ls/YOUR_LIST_ID"; // ここにほしい物リストのURLを入れる

export const DeveloperSupport = () => {
  return (
    <div className="mx-4 my-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm text-center">
      {/* アイコンヘッダー */}
      <div className="text-4xl mb-3">👨‍💻 🤝 🎁</div>
      
      {/* タイトル & メッセージ */}
      <h3 className="font-bold text-gray-800 text-lg mb-3">開発者を応援する</h3>
      <p className="text-sm text-gray-600 mb-6 leading-relaxed text-left">
        Potenote Scannerは個人が情熱で開発・運営しています。<br/>
        現在、高性能AIのサーバー代はすべて自腹で負担しています...！😭<br/>
        <br/>
        もし「役に立った！」と思っていただけたら、以下の方法でご支援いただけると、開発継続の大きな力になります。
      </p>
      
      {/* アクションボタンエリア */}
      <div className="flex flex-col gap-4">
        
        {/* 1. noteボタン (記事 & サポート) */}
        <div className="w-full">
          <a 
            href={NOTE_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-[#2cbd93] hover:opacity-90 text-white font-bold py-3 px-6 rounded-full shadow transition-all flex items-center justify-center gap-2"
          >
            <span>📖 開発日誌を読む (note)</span>
          </a>
          <p className="text-[10px] text-gray-400 mt-1.5">
            ※ 記事の「サポート」機能からご支援いただけます
          </p>
        </div>

        {/* 2. Amazonボタン (モノ支援) */}
        <div className="w-full">
          <a 
            href={AMAZON_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-[#FF9900] hover:opacity-90 text-white font-bold py-3 px-6 rounded-full shadow transition-all flex items-center justify-center gap-2"
          >
            <span>🎁 Amazonで差し入れする</span>
          </a>
          <p className="text-[10px] text-gray-400 mt-1.5">
            ※ 匿名で送れる設定になっています
          </p>
        </div>

      </div>
    </div>
  );
};

export default DeveloperSupport;

