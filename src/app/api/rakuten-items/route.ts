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

// カテゴリのジャンルID
const GENRE_IDS = {
  books: '001001',      // 楽天ブックス
  gadgets: '100227',    // 文房具・事務用品
  health: '100804',     // 健康・美容
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
    const category = searchParams.get('category') as keyof typeof GENRE_IDS | null;
    
    if (!category || !GENRE_IDS[category]) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const genreId = GENRE_IDS[category];

    // 楽天APIを呼び出し
    const response = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?` +
      `applicationId=${RAKUTEN_APP_ID}&` +
      `affiliateId=${RAKUTEN_AFF_ID}&` +
      `genreId=${genreId}&` +
      `hits=10&` +
      `sort=-itemPrice&` +
      `availability=1`
    );

    if (!response.ok) {
      throw new Error(`楽天APIエラー: ${response.status}`);
    }

    const data = await response.json();
    
    // 商品データを整形
    const items = data.Items?.map((item: any) => ({
      itemName: item.Item.itemName,
      itemPrice: item.Item.itemPrice,
      itemUrl: item.Item.itemUrl,
      mediumImageUrls: item.Item.mediumImageUrls,
      shopName: item.Item.shopName,
      affiliateUrl: item.Item.affiliateUrl,
    })) || [];

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

