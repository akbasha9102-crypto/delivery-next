'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Truck, UtensilsCrossed, LayoutDashboard, ClipboardList, Palette, BarChart2, Car, Store } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';

const clientTabs = [
  { href: '/home',  icon: UtensilsCrossed, label: 'المنيو' },
  { href: '/track', icon: Truck,           label: 'تتبع طلبك' },
  { href: '/cart',  icon: ShoppingCart,    label: 'السلة' },
];

const adminTabs = [
  { href: '/admin/dashboard',   icon: LayoutDashboard, label: 'اللوحة' },
  { href: '/admin/local',       icon: Store,           label: 'المحل' },
  { href: '/admin/menu',        icon: UtensilsCrossed, label: 'المنيو' },
  { href: '/admin/drivers',     icon: Car,             label: 'السواقون' },
  { href: '/admin/statistics',  icon: BarChart2,       label: 'الإحصاء' },
  { href: '/admin/appearance',  icon: Palette,         label: 'المظهر' },
];

export function ClientBottomNav() {
  const path = usePathname();
  const { items } = useCart();
  const { is_closed } = useSettings();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex z-50">
      {clientTabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        const disabled = is_closed && (href === '/cart' || href === '/track');
        if (disabled) {
          return (
            <div key={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 opacity-35">
              <Icon size={22} className="text-gray-400 dark:text-slate-500" />
              <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{label}</span>
            </div>
          );
        }
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90 relative">
            <Icon size={22} className={active ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'} />
            {href === '/cart' && cartCount > 0 && (
              <span className="absolute top-2 right-1/2 translate-x-3 bg-[#e67e22] text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>
            )}
            <span className={`text-xs font-medium ${active ? 'text-[#e67e22]' : 'text-gray-400 dark:text-slate-500'}`}>{label}</span>
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex z-50">
      {adminTabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        const showBadge = href === '/admin/dashboard' && path !== '/admin/dashboard' && newCount > 0;
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90 relative">
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
