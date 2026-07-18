import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'بوابة السائقين',
  description: 'منصة توصيل الطلبات للسائقين',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'بوابة السائقين' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className="bg-slate-900 min-h-screen">{children}</body>
    </html>
  );
}
