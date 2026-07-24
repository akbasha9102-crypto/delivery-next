import { Baloo_Bhaijaan_2, Reem_Kufi } from 'next/font/google';

export const mashiRoundedFont = Baloo_Bhaijaan_2({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-mashi-rounded',
});

export const MASHI_FONT = {
  fontFamily: 'ui-rounded, "SF Pro Rounded", var(--font-mashi-rounded), sans-serif',
};

export const mashiWordmarkFont = Reem_Kufi({
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-mashi-wordmark',
});

export const MASHI_WORDMARK_FONT_FAMILY = {
  fontFamily: 'var(--font-mashi-wordmark), "Reem Kufi", sans-serif',
} as const;

export const BRAND = {
  green: '#15803D',
  accent: '#4ADE80',
  dark: '#1d1d1f',
  bgAlt: '#f5f5f7',
  textMuted: '#6e6e73',
  textFaint: '#86868b',
} as const;
