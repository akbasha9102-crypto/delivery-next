'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { User, Route, UtensilsCrossed, ClipboardList, BarChart2, Car, Menu, Archive, ShoppingBag, Package } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';

const adminTabs = [
  { href: '/admin/dashboard',   icon: ClipboardList,   label: 'الطلبات' },
  { href: '/admin/menu',        icon: UtensilsCrossed, label: 'المنيو' },
  { href: '/admin/drivers',     icon: Car,             label: 'السائقين' },
  { href: '/admin/inventory',   icon: Package,         label: 'المخزون' },
  { href: '/admin/settings',    icon: Menu,            label: 'الإعدادات' },
];

export function ClientBottomNav() {
  const path = usePathname();
  const params = useParams();
  const { is_closed } = useSettings();

  // تذكّر الـ slug الحالي — من الـ params أولاً ثم من localStorage
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  useEffect(() => {
    const slugFromParams = params?.slug as string | undefined;
    if (slugFromParams) {
      localStorage.setItem('currentRestaurantSlug', slugFromParams);
      setSavedSlug(slugFromParams);
    } else {
      setSavedSlug(localStorage.getItem('currentRestaurantSlug'));
    }
  }, [params?.slug]);

  const menuSlug = (params?.slug as string | undefined) ?? savedSlug;
  const menuHref = menuSlug ? `/menu/${menuSlug}` : '/home';

  const clientTabs = [
    { href: menuHref, icon: UtensilsCrossed, label: 'قائمة الطعام' },
    { href: '/track',   icon: Route,           label: 'تتبع طلبك' },
    { href: '/orders',  icon: ShoppingBag,     label: 'طلباتي' },
    { href: '/profile', icon: User,            label: 'معلوماتي' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex z-50 md:top-0 md:bottom-0 md:left-auto md:w-[70px] md:flex-col md:border-t-0 md:border-l">
      {clientTabs.map(({ href, icon: Icon, label }) => {
        const active = path === href || (href.startsWith('/menu/') && path.startsWith('/menu/'));
        const disabled = is_closed && href === '/track';
        if (disabled) {
          return (
            <div key={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 opacity-35 md:flex-none md:w-full md:py-5">
              <Icon size={22} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
            </div>
          );
        }
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90 relative md:flex-none md:w-full md:py-5">
            <Icon size={22} className={active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'} />
            <span className={`text-xs font-medium ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminBottomNav() {
  const path = usePathname();
  const { newCount } = useNewOrders();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex z-50 md:top-0 md:bottom-0 md:left-auto md:w-[70px] md:flex-col md:border-t-0 md:border-l">
      {adminTabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        const showBadge = href === '/admin/dashboard' && path !== '/admin/dashboard' && newCount > 0;
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90 relative md:flex-none md:w-full md:py-5">
            <Icon size={22} className={active ? 'text-[#2563eb]' : 'text-gray-400 dark:text-slate-500'} />
            {showBadge && (
              <span className="absolute top-1.5 right-1/2 translate-x-3.5 bg-red-500 text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1 leading-none">
                {newCount > 99 ? '99+' : newCount}
              </span>
            )}
            <span className={`text-xs font-medium ${active ? 'text-[#2563eb]' : 'text-gray-400 dark:text-slate-500'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
