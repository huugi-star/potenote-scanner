/**
 * rakuten-items/route.ts
 * 
 * 楽天APIから商品を取得するAPI Route
 * CORS問題を回避するためにサーバーサイドで実行
 */

import { NextResponse } from 'next/server';

// Vercelでの動的レンダリングを強制（request.urlを使用するため）
export const dynamic = 'force-dynamic';

// 楽天API設定（※IDは必ず.env.localに保存し、コード上には直書きしない）
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFF_ID = process.env.RAKUTEN_AFF_ID;

// カテゴリごとの検索パラメータ
// ※ IchibaItem Search API は genreId が厳密なので、キーワード検索に寄せる
const SEARCH_PARAMS = {
  books: {
    // 学習・参考書系を優先（AND条件を避けるためシンプルに）
    keyword: '勉強 本',
    fallbackKeyword: '学習 本',
  },
  gadgets: {
    // 勉強向けガジェット・文房具
    keyword: '勉強 文房具',
    fallbackKeyword: '学習 文房具',
  },
  health: {
    // 学習環境・姿勢・集中力サポート
    keyword: '学習 椅子',
    fallbackKeyword: '学習 デスク',
  },
} as const;

// ノイズ除去用 NG キーワード（中古品・返礼品・レンタル等を避ける）
// Rakuten Ichiba API の NGKeyword パラメータに渡す
const NG_KEYWORDS =
  '中古 中古本 ふるさと納税 レンタル オークション 中古品 リサイクル 貸出 auction rental used';

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
    const categoryParam = searchParams.get('category') as keyof typeof SEARCH_PARAMS | null;
    const keywordParamRaw = searchParams.get('keyword') || undefined;
    const keywordParam = keywordParamRaw?.trim();
    const hitsParam = Number(searchParams.get('hits')) || 10;
    
    const category: keyof typeof SEARCH_PARAMS = categoryParam && SEARCH_PARAMS[categoryParam] ? categoryParam : 'books';
    const { keyword: defaultKeyword, fallbackKeyword } = SEARCH_PARAMS[category];
    const keyword = keywordParam && keywordParam.length > 0 ? keywordParam : defaultKeyword;
    // 楽天APIを呼び出し
    const searchUrl =
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?` +
      `applicationId=${encodeURIComponent(RAKUTEN_APP_ID)}&` +
      `affiliateId=${encodeURIComponent(RAKUTEN_AFF_ID)}&` +
      // 関連度順（標準）
      `sort=standard&` +
      // 学習関連キーワードで検索
      `keyword=${encodeURIComponent(keyword)}&` +
      // NGキーワードでノイズ除去（中古・ふるさと納税・レンタル等）
      `NGKeyword=${encodeURIComponent(NG_KEYWORDS)}&` +
      // 在庫ありのみ
      `availability=1&` +
      // 取得件数
      `hits=${Math.max(1, Math.min(hitsParam, 30))}`;

    const fetchItems = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Rakuten API response error:', response.status, errorText);
        return [];
      }
      const data = await response.json();
      return data.Items?.map((raw: any) => {
        const item = raw.Item ?? raw.item ?? raw;
        const mediumImageUrls: string[] =
          Array.isArray(item.mediumImageUrls)
            ? item.mediumImageUrls
                .map((img: any) => {
                  const u = img?.imageUrl;
                  if (!u) return u;
                  if (u.includes('_ex=')) return u.replace(/_ex=\d+x\d+/, '_ex=600x600');
                  return u.includes('?') ? `${u}&_ex=600x600` : `${u}?_ex=600x600`;
                })
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
    };

    let items = await fetchItems(searchUrl);

    // 0件またはAPIエラー時にフォールバックキーワードで再検索
    if ((!items.length || items.every((it: any) => !it.itemUrl)) && fallbackKeyword) {
      const fallbackUrl =
        `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?` +
        `applicationId=${encodeURIComponent(RAKUTEN_APP_ID)}&` +
        `affiliateId=${encodeURIComponent(RAKUTEN_AFF_ID)}&` +
        `sort=standard&` +
        `keyword=${encodeURIComponent(fallbackKeyword)}&` +
        `availability=1&` +
        `hits=${Math.max(1, Math.min(hitsParam, 30))}`;
      items = await fetchItems(fallbackUrl);
    }

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

