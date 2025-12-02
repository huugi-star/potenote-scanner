import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Potenote Scanner v2',
  description: '学習RPG - スキャンして学び、旅をしよう',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head />
      <body className={inter.className}>
        {/* Google AdSense - body 内に配置して data-nscript 属性の問題を回避 */}
        <Script
          id="adsbygoogle-init"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              (adsbygoogle = window.adsbygoogle || []).push({
                google_ad_client: "ca-pub-5524219244906928",
                enable_page_level_ads: true
              });
            `,
          }}
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5524219244906928"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        {children}
      </body>
    </html>
  );
}

