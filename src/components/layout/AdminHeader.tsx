'use client';
import { ReactNode, CSSProperties } from 'react';
import Image from 'next/image';

interface AdminHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  className?: string;
  style?: CSSProperties;
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
        <Image
          src="/mashi-logo.png"
          alt="ماشي"
          width={949}
          height={579}
          preload
          className="h-6 w-auto"
        />
      </div>
    </header>
  );
}
