import { Changa } from 'next/font/google';

export const changaFont = Changa({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-changa',
});

export const ADMIN_FONT_STYLE = {
  fontFamily: 'var(--font-changa), Tajawal, Arial, Helvetica, sans-serif',
} as const;
