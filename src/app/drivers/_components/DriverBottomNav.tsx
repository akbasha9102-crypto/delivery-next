'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History } from 'lucide-react';

const tabs = [
  { href: '/drivers/dashboard', icon: Home,    label: 'الرئيسية' },
  { href: '/drivers/archive',   icon: History, label: 'السجل' },
];

export default function DriverBottomNav() {
  const path = usePathname();

  if (path === '/drivers') return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-white/5 flex pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90"
          >
            <Icon size={22} className={active ? 'text-white' : 'text-slate-500'} />
            <span className={`text-xs font-medium ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
