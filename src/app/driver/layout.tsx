'use client';
import { usePathname } from 'next/navigation';
import DriverBottomNav from './_components/DriverBottomNav';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = pathname !== '/driver';

  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: 'var(--font-brand-name)' }}>
      {children}
      {showNav && <DriverBottomNav />}
    </div>
  );
}
