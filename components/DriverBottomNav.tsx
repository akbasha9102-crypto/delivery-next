'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Archive } from 'lucide-react';

const tabs = [
  { href: '/dashboard',         icon: Home,    label: 'الرئيسية' },
  { href: '/dashboard/archive', icon: Archive, label: 'الأرشيف' },
];

export default function DriverBottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 h-16 bg-slate-800/95 backdrop-blur border-t border-slate-700/60 flex pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        return (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all">
            <Icon size={22} className={active ? 'text-blue-400' : 'text-slate-500'} />
            <span className={`text-xs font-bold ${active ? 'text-blue-400' : 'text-slate-500'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
