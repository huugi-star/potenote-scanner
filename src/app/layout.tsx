import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Potenote Scanner v2',
  description: '学習RPG - スキャンして学び、旅をしよう',
  // ▼▼ サーチコンソールの確認コードはここに書くのが正解です ▼▼
  verification: {
    google: '-paAAzC_eZ8Eo4Oc8noUNf7heoGoXTtzPuyVvFU8a_E',
  },
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
        {children}
      </body>
    </html>
  );
}

