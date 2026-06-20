import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { CartProvider } from '@/context/CartContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { RestaurantProvider } from '@/context/RestaurantContext';

export const metadata: Metadata = {
  title: 'CulinaShare',
  description: 'طلب وجبات',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CulinaShare',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full">
      <head>
        <meta name="theme-color" content="#f97316" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className="h-full bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100">
        <RestaurantProvider>
          <SettingsProvider>
            <ThemeProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </ThemeProvider>
          </SettingsProvider>
        </RestaurantProvider>
      </body>
    </html>
  );
}
