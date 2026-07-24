'use client';
import { ReactNode, CSSProperties } from 'react';
import { Ruwudu } from 'next/font/google';
import { BRAND } from '@/app/home/brand';

const mashiHeaderWordmarkFont = Ruwudu({
  subsets: ['arabic'],
  weight: '700',
  display: 'swap',
  variable: '--font-mashi-header-wordmark',
});

const MASHI_HEADER_WORDMARK_FONT_FAMILY = {
  fontFamily: 'var(--font-mashi-header-wordmark), "Ruwudu", sans-serif',
} as const;

const HEADER_WORDMARK_COLOR = '#DD7855';

interface AdminHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function MashiWordmark() {
  return (
    <span
      className={`${mashiHeaderWordmarkFont.variable} text-[19px] font-bold leading-none select-none shrink-0`}
      style={{ ...MASHI_HEADER_WORDMARK_FONT_FAMILY, color: HEADER_WORDMARK_COLOR }}
    >
      <span
        style={{
          WebkitTextStroke: `0.2px ${BRAND.dark}`,
          textShadow: [
            `0.2px 0 0 ${BRAND.dark}`, `-0.2px 0 0 ${BRAND.dark}`,
            `0 0.2px 0 ${BRAND.dark}`, `0 -0.2px 0 ${BRAND.dark}`,
            `0.2px 0.2px 0 ${BRAND.dark}`, `-0.2px 0.2px 0 ${BRAND.dark}`,
            `0.2px -0.2px 0 ${BRAND.dark}`, `-0.2px -0.2px 0 ${BRAND.dark}`,
          ].join(', '),
        }}
      >م</span>
      <span
        style={{
          WebkitTextStroke: `0.1px ${BRAND.dark}`,
          textShadow: [
            `0.1px 0 0 ${BRAND.dark}`, `-0.1px 0 0 ${BRAND.dark}`,
            `0 0.1px 0 ${BRAND.dark}`, `0 -0.1px 0 ${BRAND.dark}`,
            `0.1px 0.1px 0 ${BRAND.dark}`, `-0.1px 0.1px 0 ${BRAND.dark}`,
            `0.1px -0.1px 0 ${BRAND.dark}`, `-0.1px -0.1px 0 ${BRAND.dark}`,
          ].join(', '),
        }}
      >اشي</span>
    </span>
  );
}

export function AdminHeader({ title, icon, right, left, className = '', style }: AdminHeaderProps) {
  return (
    <header
      style={style}
      className={`sticky top-0 z-40 h-16 px-4 flex items-center justify-between bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 ${className}`}
    >
      <div className="min-w-9 flex items-center justify-center shrink-0">{right}</div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-slate-100 truncate">
        {icon}{title}
      </h1>
      <div className="flex items-center gap-1.5 shrink-0">
        {left}
        <MashiWordmark />
      </div>
    </header>
  );
}
