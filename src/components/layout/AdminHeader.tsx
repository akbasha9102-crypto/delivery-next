'use client';
import { ReactNode, CSSProperties } from 'react';
import { BRAND, mashiWordmarkFont, MASHI_WORDMARK_FONT_FAMILY } from '@/app/home/brand';

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
      className={`${mashiWordmarkFont.variable} text-[19px] font-bold leading-none select-none shrink-0`}
      dir="ltr"
      style={{ ...MASHI_WORDMARK_FONT_FAMILY, color: BRAND.green }}
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
      >M</span>
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
      >aShe</span>
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
