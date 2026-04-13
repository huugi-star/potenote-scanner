import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'すうひもちと失われた図書館',
  description: '失われたことば図書館 — スキャンして学び、ことばの世界を復興しよう',
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

