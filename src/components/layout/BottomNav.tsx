'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { User, Route, UtensilsCrossed, ClipboardList, BarChart2, Car, Menu, Archive, ShoppingBag, Package } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useNewOrders } from '@/context/NewOrdersContext';
import { useSuperAdminNotifications } from '@/context/SuperAdminNotificationsContext';

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
    const slugFromParams = params?.restaurantSlug as string | undefined;
    if (slugFromParams) {
      localStorage.setItem('currentRestaurantSlug', slugFromParams);
      setSavedSlug(slugFromParams);
    } else {
      setSavedSlug(localStorage.getItem('currentRestaurantSlug'));
    }
  }, [params?.restaurantSlug]);

  const menuSlug = (params?.restaurantSlug as string | undefined) ?? savedSlug;
  const menuHref = menuSlug ? `/${menuSlug}/menu` : '/home';

  const clientTabs = [
    { href: menuHref, icon: UtensilsCrossed, label: 'قائمة الطعام' },
    { href: '/track',   icon: Route,           label: 'تتبع طلبك' },
    { href: '/orders',  icon: ShoppingBag,     label: 'طلباتي' },
    { href: '/profile', icon: User,            label: 'معلوماتي' },
  ];

  const pathSegments = path.split('/').filter(Boolean);
  const isMenuPath = pathSegments.length === 2 && pathSegments[1] === 'menu';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex z-50 md:top-0 md:bottom-0 md:left-auto md:w-[70px] md:flex-col md:border-t-0 md:border-l">
      {clientTabs.map(({ href, icon: Icon, label }) => {
        const active = path === href || (href === menuHref && isMenuPath);
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
  const { unreadCount: saUnread } = useSuperAdminNotifications();

  // الكاشير له نفس صلاحيات وواجهة المالك بالكامل — نفس شريط adminTabs للجميع.
  const tabs = adminTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#212121] border-t border-gray-200 dark:border-slate-700 flex z-50 md:top-0 md:bottom-0 md:left-auto md:w-[70px] md:flex-col md:border-t-0 md:border-l">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        // /admin/dashboard: يُخفى إن كان المستخدم بنفس الصفحة حالياً. /admin/settings: يبقى
        // ظاهراً حتى يفتح فعلياً قائمة الإشعارات ويُستدعى markAllRead (لا علاقة بمجرد فتح الصفحة).
        const badgeCount = href === '/admin/dashboard' ? newCount : href === '/admin/settings' ? saUnread : 0;
        const showBadge = href === '/admin/dashboard' ? (path !== '/admin/dashboard' && newCount > 0) : href === '/admin/settings' ? saUnread > 0 : false;
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all active:scale-90 relative md:flex-none md:w-full md:py-5">
            <Icon size={22} className={active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'} />
            {showBadge && (
              <span className="absolute top-1.5 right-1/2 translate-x-3.5 bg-red-500 text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1 leading-none">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
            <span className={`text-xs font-medium ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
