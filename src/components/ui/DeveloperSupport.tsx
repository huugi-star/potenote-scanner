/**
 * DeveloperSupport.tsx
 * 
 * 開発者支援コンポーネント
 * noteへのリンクを提供
 */

import React from 'react';

// リンク先（後で定数ファイルに移動してもOK）
// TODO: 実際のnote記事URLに差し替えてください
const NOTE_URL = "https://note.com/aoi_potenote/n/n938994859678"; // ここにnote記事のURLを入れる

export const DeveloperSupport = () => {
  return (
    <div className="mx-4 my-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm text-center">
      {/* アイコンヘッダー */}
      <div className="text-4xl mb-3">🔬✨</div>
      
      {/* タイトル & メッセージ */}
      <h3 className="font-bold text-gray-800 text-lg mb-3">すうひもちコレクションを応援する</h3>
      <p className="text-sm text-gray-600 mb-6 leading-relaxed text-left">
      <strong className="block text-center">【あなたに寄り添う。言の葉の世界】</strong><br/>
      すうひもちコレクション は、失われたことば図書館を少しずつ復興していく学習RPGです。<br/>
現在 AI利用料や開発費を負担しながら、個人で開発・運営しています。<br/>
  「面白い」「続いてほしい」と感じていただけたら、<br/>
  note からご支援いただけると開発継続の大きな力になります。<br/>
  <br/>
  メンバーシップの一部特典として、<br/>
  スキャン回数、ガチャコイン、<strong>研究員番号（研究員図鑑に登録）</strong>、研究員専用のアバター装飾などをご用意しています。<br/>
  Potenote研究所の研究員として、ことばの世界を一緒に育てていただけたら嬉しいです。
</p>
      
      {/* アクションボタンエリア */}
      <div className="flex flex-col gap-4">
        
        {/* noteボタン (記事 & サポート) */}
        <div className="w-full">
          <a 
            href={NOTE_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-[#2cbd93] hover:opacity-90 text-white font-bold py-3 px-6 rounded-full shadow transition-all flex items-center justify-center gap-2"
          >
            <span>📖 開発日誌 / Potenote研究所を見る (note)</span>
          </a>
          <p className="text-[10px] text-gray-400 mt-1.5">
            ※ 記事のサポート機能やメンバーシップからご支援いただけます
          </p>
        </div>

      </div>
    </div>
  );
};

export default DeveloperSupport;

