'use client';
import type { ReactNode } from 'react';

type Props = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export default function DriverHeader({ left, center, right }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-white/5 px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">{right}</div>
      <div className="flex items-center gap-2">{center}</div>
      <div className="flex items-center gap-2">{left}</div>
    </header>
  );
}
