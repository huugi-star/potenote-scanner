/**
 * rakuten-items/route.ts
 * 
 * 楽天APIから商品を取得するAPI Route
 * CORS問題を回避するためにサーバーサイドで実行
 */

import { NextResponse } from 'next/server';

// 楽天API設定（※IDは必ず.env.localに保存し、コード上には直書きしない）
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFF_ID = process.env.RAKUTEN_AFF_ID;

// カテゴリごとの検索パラメータ
// ※ IchibaItem Search API は genreId が厳密なので、キーワード検索に寄せる
const SEARCH_PARAMS = {
  books: {
    keyword: '勉強 本 学習 参考書',
  },
  gadgets: {
    keyword: '勉強 文房具 ガジェット ペン ノート',
  },
  health: {
    keyword: '学習 椅子 デスク 姿勢 クッション 健康',
  },
} as const;

export async function GET(request: Request) {
  try {
    // 環境変数未設定時は安全にエラーを返す
    if (!RAKUTEN_APP_ID || !RAKUTEN_AFF_ID) {
      console.error('Rakuten API keys are not set in environment variables');
      return NextResponse.json(
        { error: 'Rakuten API keys are not configured on the server.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as keyof typeof SEARCH_PARAMS | null;
    
    if (!category || !SEARCH_PARAMS[category]) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const { keyword } = SEARCH_PARAMS[category];

    // 楽天APIを呼び出し
    const searchUrl =
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?` +
      `applicationId=${encodeURIComponent(RAKUTEN_APP_ID)}&` +
      `affiliateId=${encodeURIComponent(RAKUTEN_AFF_ID)}&` +
      `keyword=${encodeURIComponent(keyword)}&` +
      `hits=10&` +
      `sort=-itemPrice&` +
      `availability=1`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      // レスポンス本文もログに出して原因を特定しやすくする
      const errorText = await response.text();
      console.error('Rakuten API response error:', response.status, errorText);
      throw new Error(`楽天APIエラー: ${response.status}`);
    }

    const data = await response.json();
    
    // 商品データを整形（楽天APIのレスポンス形式に合わせて安全に変換）
    const items = data.Items?.map((raw: any) => {
      const item = raw.Item ?? raw.item ?? raw;
      const mediumImageUrls: string[] =
        Array.isArray(item.mediumImageUrls)
          ? item.mediumImageUrls
              .map((img: any) => img?.imageUrl)
              .filter((url: unknown): url is string => typeof url === 'string')
          : [];

      return {
        itemName: item.itemName,
        itemPrice: String(item.itemPrice),
        itemUrl: item.itemUrl,
        mediumImageUrls,
        shopName: item.shopName,
        affiliateUrl: item.affiliateUrl,
      };
    }) || [];

    return NextResponse.json({ items });
  } catch (error) {
    console.error('楽天APIエラー:', error);
    
    // エラー時はモックデータを返す
    const mockItems = Array.from({ length: 10 }, (_, i) => ({
      itemName: `学習に役立つ商品 ${i + 1}`,
      itemPrice: `${Math.floor(Math.random() * 5000 + 1000)}`,
      itemUrl: `https://example.com/item${i + 1}`,
      mediumImageUrls: [`https://via.placeholder.com/300x300?text=Item${i + 1}`],
      shopName: 'サンプルショップ',
      affiliateUrl: `https://example.com/affiliate${i + 1}`,
    }));

    return NextResponse.json({ items: mockItems });
  }
}

