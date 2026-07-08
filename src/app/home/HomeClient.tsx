'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ClientBottomNav } from '@/components/BottomNav';
import { Plus, Minus, ShoppingBag, ShoppingCart, Trash2, MapPin, MessageCircle, ChevronDown, Check, X } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { CustomerGuard } from '@/components/CustomerGuard';
import { motion, AnimatePresence } from 'framer-motion';

type Category = { id: string; name: string; color?: string; card_color?: string; color_dark?: string; card_color_dark?: string };
type Extra    = { id: string; name: string; price: number };
type Item     = {
  id: string; name: string; price: number; description: string;
  image_url: string | null; category_id: string; is_available: boolean; item_status?: string; extras_json?: string;
};

function formatOpenTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatCloseTimeFull(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'مساءً' : 'صباحاً';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getStatus(item: Item): 'available' | 'unavailable' | 'hidden' {
  if (item.item_status === 'unavailable') return 'unavailable';
  if (item.item_status === 'hidden')      return 'hidden';
  if (item.item_status === 'available')   return 'available';
  return item.is_available ? 'available' : 'unavailable';
}

type Props = {
  initialCategories: Category[];
  initialItems: Item[];
  restaurantId?: string;
  restaurantSlug?: string;
  showBestSellers?: boolean;
  bestSellerItemIds?: string[];
};

const BEST_SELLERS_ID = '__best_sellers__';

export default function HomeClient({ initialCategories, initialItems, restaurantId, restaurantSlug, showBestSellers, bestSellerItemIds }: Props) {
  const { dark } = useDarkMode();
  const { items: cartItems, addItem, decrementItem, removeItem, clearCart, total, orderType, setOrderType, ensureRestaurant } = useCart();
  const [priceFlash, setPriceFlash] = useState(false);
  const prevTotal = useRef(total);
  useEffect(() => {
    if (total > prevTotal.current) {
      setPriceFlash(true);
      const t = setTimeout(() => setPriceFlash(false), 600);
      return () => clearTimeout(t);
    }
    prevTotal.current = total;
  }, [total]);

  const [modalPriceFlash, setModalPriceFlash] = useState(false);
  const prevModalPrice = useRef(0);
  const { restaurant_name, primary_color, logo_url, loaded: settingsLoaded, is_closed, opens_at, whatsapp_number, location_url, schedule } = useSettings();
  const { setRestaurant } = useRestaurant();

  // تسجيل المطعم الحالي في RestaurantContext لكي يصفّي SettingsContext بشكل صحيح
  useEffect(() => {
    if (restaurantId) setRestaurant(restaurantId, null);
  }, [restaurantId, setRestaurant]);

  const brandName  = restaurant_name || "المطعم";
  const rawColor   = primary_color || "#000000";

  const isTooDark = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const isTooLight = rawColor.toLowerCase() === '#ffffff' || rawColor.toLowerCase() === '#fff';
  const brandColor = (dark && isTooDark) ? '#ffffff' : (!dark && isTooLight) ? '#000000' : rawColor;

  const brandLogo = logo_url;
  const p = brandColor;

  const getTextColor = (hex: string): string => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#000000' : '#ffffff';
  };

  const textOnBrand = getTextColor(brandColor);

  const todayHours = (() => {
    if (!schedule?.days) return null;
    const day = schedule.days[String(new Date().getDay())];
    if (!day?.enabled) return null;
    return { open: day.open, close: day.close };
  })();

  const isClosingSoon = (() => {
    if (!todayHours || is_closed) return false;
    const now = new Date();
    const [closeH, closeM] = todayHours.close.split(':').map(Number);
    const closeMinutes = closeH * 60 + closeM;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = closeMinutes - nowMinutes;
    return diff > 0 && diff <= 60;
  })();

  const [categories,   setCategories]   = useState<Category[]>(initialCategories);
  const [items,        setItems]        = useState<Item[]>(initialItems);
  const [dataLoading,  setDataLoading]  = useState(initialItems.length === 0);
  const [dataError,    setDataError]    = useState<string | null>(null);
  const [activeCategory,   setActiveCategory]   = useState('');
  const [showClosedToast,  setShowClosedToast]  = useState(false);
  const [showCartResetToast, setShowCartResetToast] = useState(false);
  const [showCartPanel,  setShowCartPanel]  = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const scrollLockPos = useRef<number | null>(null);

  const [selectedItem,        setSelectedItem]        = useState<Item | null>(null);
  const [selectedModalExtras, setSelectedModalExtras] = useState<Set<string>>(new Set());

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef    = useRef<HTMLDivElement>(null);
  const scrolling   = useRef(false);

  const fetchData = async (id: string | undefined) => {
    if (!id) return; // لا نجلب بدون restaurant_id — يمنع تسريب بيانات مطاعم أخرى
    setDataLoading(true);
    setDataError(null);
    try {
      const [{ data: cats, error: catsErr }, { data: its, error: itsErr }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', id).order('sort_order', { ascending: true, nullsFirst: false }),
        supabase.from('items').select('*').eq('restaurant_id', id).order('name'),
      ]);
      if (catsErr) throw catsErr;
      if (itsErr)  throw itsErr;
      setCategories(cats || []);
      setItems(its || []);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || 'خطأ في تحميل القائمة';
      setDataError(msg);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchData(restaurantId);
    const ch = supabase.channel(`menu-live-${restaurantId ?? 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' },      () => fetchData(restaurantId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData(restaurantId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // "الأكثر مبيعاً" — قسم ثابت يظهر دائماً أولاً، بأفضل 3 وجبات مبيعاً (إن كان مفعّلاً وتوفرت وجبات)
  const bestSellerItems = useMemo(() => (bestSellerItemIds || [])
    .map(id => items.find(i => i.id === id))
    .filter((i): i is Item => !!i && getStatus(i) !== 'hidden'), [bestSellerItemIds, items]);

  const displayCategories = useMemo(() => (
    showBestSellers && bestSellerItems.length > 0
      ? [{ id: BEST_SELLERS_ID, name: 'الأكثر مبيعاً' } as Category, ...categories]
      : categories
  ), [showBestSellers, bestSellerItems, categories]);

  useEffect(() => {
    if (displayCategories.length === 0) return;
    const observers: IntersectionObserver[] = [];
    displayCategories.forEach(cat => {
      const el = sectionRefs.current[cat.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !scrolling.current) setActiveCategory(cat.id);
        },
        { rootMargin: '-20% 0px -60% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [displayCategories, items]);

  useEffect(() => {
    const container = pillsRef.current;
    if (!container) return;
    const pill = container.querySelector<HTMLElement>(`[data-cat="${activeCategory}"]`);
    if (!pill) return;
    const pillOffset = pill.offsetLeft;
    const pillWidth  = pill.offsetWidth;
    const containerWidth = container.offsetWidth;
    container.scrollTo({
      left: pillOffset - (containerWidth / 2) + (pillWidth / 2),
      behavior: 'smooth'
    });
  }, [activeCategory]);

  useEffect(() => { setShowCartPanel(cartItems.length > 0); }, [cartItems.length]);
  useEffect(() => { /* cart panel appears without scrolling */ }, [showCartPanel]);
  useEffect(() => { setSelectedModalExtras(new Set()); }, [selectedItem]);

  useEffect(() => {
    if (!showClosedToast) return;
    const t = setTimeout(() => setShowClosedToast(false), 2000);
    return () => clearTimeout(t);
  }, [showClosedToast]);

  useEffect(() => {
    if (!showCartResetToast) return;
    const t = setTimeout(() => setShowCartResetToast(false), 2500);
    return () => clearTimeout(t);
  }, [showCartResetToast]);

  useEffect(() => {
    if (showCartDrawer) {
      scrollLockPos.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollLockPos.current}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else if (scrollLockPos.current !== null) {
      const pos = scrollLockPos.current;
      scrollLockPos.current = null;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, pos);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [showCartDrawer]);

  // حفظ restaurant_id في localStorage لاستخدامه في صفحة السلة
  useEffect(() => {
    if (restaurantId) localStorage.setItem('currentRestaurantId', restaurantId);
    if (restaurantSlug) localStorage.setItem('currentRestaurantSlug', restaurantSlug);
    // منع خلط سلة مطعم بسلة مطعم آخر — تفريغ تلقائي عند اكتشاف تغيّر المطعم
    if (restaurantId && ensureRestaurant(restaurantId)) {
      setShowCartResetToast(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, restaurantSlug]);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    scrolling.current = true;
    setTimeout(() => { scrolling.current = false; }, 800);
    const el = sectionRefs.current[catId];
    if (el) {
      const offset = el.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  const getExtras = (item: Item): Extra[] => {
    try { return JSON.parse(item.extras_json || '[]'); } catch { return []; }
  };

  useEffect(() => {
    if (!selectedItem) { prevModalPrice.current = 0; return; }
    const extras = getExtras(selectedItem);
    const extrasSum = extras.filter(e => selectedModalExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
    const quantity = cartItems.find(i => i.id === selectedItem.id)?.quantity || 0;
    const dp = quantity * (selectedItem.price + extrasSum);
    if (dp > prevModalPrice.current) {
      setModalPriceFlash(true);
      const t = setTimeout(() => setModalPriceFlash(false), 700);
      prevModalPrice.current = dp;
      return () => clearTimeout(t);
    }
    prevModalPrice.current = dp;
  }, [selectedModalExtras, selectedItem, cartItems]);

  const handleAdd = (item: Item, selectedExtrasNames?: string[], extrasPrice = 0) => {
    if (getStatus(item) !== 'available') return;
    addItem({ id: item.id, name: item.name, price: item.price + extrasPrice, image_url: item.image_url, extras_json: item.extras_json, selected_extras_names: selectedExtrasNames });
  };

  const qty = (id: string) => cartItems.find(i => i.id === id)?.quantity || 0;

  return (
    <CustomerGuard>
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950" style={isDesktop ? { paddingRight: '70px', paddingBottom: showCartPanel ? '10rem' : '2rem', transition: 'padding-bottom 0.35s ease' } : { paddingBottom: showCartPanel ? '14rem' : '9rem', transition: 'padding-bottom 0.35s ease' }}>

      {/* ══ HEADER ══ */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-100/50 dark:border-slate-800/50 px-4 h-20 flex items-center gap-2.5 shadow-[0_2px_20px_rgba(0,0,0,0.02)]">

        {/* اسم المطعم */}
        <div className="flex flex-col flex-1 min-w-0">
          <h1 className="max-w-full text-lg font-black tracking-tight leading-tight text-black dark:text-white truncate">{brandName}</h1>
          <div className="w-8 h-1 rounded-full mt-1 opacity-20" style={{ backgroundColor: brandColor }}/>
        </div>

        {/* زر نوع الطلب: يفتح نافذة لاختيار توصيل أو استلام */}
        <button
          type="button"
          onClick={() => setShowOrderTypeModal(true)}
          className="flex items-center gap-1.5 pl-2.5 pr-3.5 h-11 rounded-full bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm flex-shrink-0"
          aria-label="نوع الطلب: توصيل أو استلام"
        >
          <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{orderType === 'pickup' ? 'استلام الطلب' : 'توصيل الطلب'}</span>
          <ChevronDown size={17} className="text-gray-400" />
        </button>

        {/* الموقع والواتس جنب بعض */}
        {(location_url || whatsapp_number) && (
          <div className="flex flex-row items-center gap-1.5 flex-shrink-0">
            {location_url && (
              <motion.a
                href={location_url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm">
                <MapPin size={19} className="text-red-500"/>
              </motion.a>
            )}
            {whatsapp_number && (
              <motion.a
                href={`https://wa.me/${whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm">
                <MessageCircle size={19} className="text-green-500"/>
              </motion.a>
            )}
          </div>
        )}

        {/* صورة المطعم */}
        {brandLogo ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex-shrink-0">
            <Image src={brandLogo} alt={brandName} width={60} height={60} className="h-12 w-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md" unoptimized/>
          </motion.div>
        ) : (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 flex-shrink-0" style={{ backgroundColor: brandColor, color: textOnBrand }}>
             <ShoppingBag size={20} />
          </div>
        )}
      </motion.header>

      {/* ══ شريط الحالة والوقت ══ */}
      {settingsLoaded && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-bold ${
          is_closed
            ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
            : isClosingSoon
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
              : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            is_closed
              ? 'bg-red-500'
              : isClosingSoon
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-green-500 animate-pulse'
          }`} />
          {is_closed ? (
            <span>مغلق{opens_at ? ` • يفتح ${opens_at}` : ''}</span>
          ) : isClosingSoon ? (
            <span>يغلق الساعة {formatCloseTimeFull(todayHours?.close ?? null)} • سارع بالطلب</span>
          ) : (
            <span>مفتوح{todayHours ? ` • يغلق ${formatOpenTime(todayHours.close)}` : ''}</span>
          )}
        </div>
      )}

      {/* ══ CATEGORY PILLS (Sticky at top-0) ══ */}
      <div className="sticky top-0 z-40 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800">
        <div ref={pillsRef} className={`flex gap-2.5 overflow-x-auto scrollbar-hide flex-row-reverse px-4 py-3 ${is_closed ? 'pointer-events-none opacity-50' : ''}`}>
          {dataLoading && categories.length === 0 && (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-20 bg-gray-200 dark:bg-slate-700 rounded-2xl animate-pulse flex-shrink-0"/>
            ))
          )}
          {displayCategories.map((cat, idx) => {
            const isActive = activeCategory === cat.id;
            const isBestSellers = cat.id === BEST_SELLERS_ID;
            const catColor = (dark && cat.color_dark) ? cat.color_dark : (cat.color || brandColor);
            const catTextColor = getTextColor(catColor);
            return (
              <motion.button
                key={cat.id}
                data-cat={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-5 py-2.5 rounded-[1.2rem] text-base font-black whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                  isActive
                  ? 'shadow-md scale-[1.04]'
                  : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-300 shadow-sm'
                }`}
                style={isActive ? { backgroundColor: dark ? '#ffffff' : catColor, color: dark ? '#000000' : catTextColor } : {}}
              >
                {isBestSellers ? `🔥 ${cat.name}` : cat.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="px-4 pt-2">

        {/* ── حالة الخطأ: شاشة كاملة فقط إذا لا توجد بيانات ── */}
        {dataError && categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium px-6">{dataError}</p>
            <button
              onClick={() => fetchData(restaurantId)}
              className="px-6 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: brandColor, color: textOnBrand }}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {dataLoading && categories.length === 0 && (
          <div className="grid grid-cols-2 gap-3 px-1 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden border border-gray-100/80 dark:border-slate-800/80 animate-pulse">
                <div className="m-2 rounded-[1.4rem] h-32 sm:h-56 bg-gray-100 dark:bg-slate-800"/>
                <div className="p-3 sm:p-6 space-y-2">
                  <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded-full w-3/4 mr-auto"/>
                  <div className="h-3 bg-gray-50 dark:bg-slate-700 rounded-full w-1/2 mr-auto"/>
                  <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded-full w-1/3 mt-3"/>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-12">
          {displayCategories.map((cat) => {
            const isBestSellers = cat.id === BEST_SELLERS_ID;
            const catItems = isBestSellers ? bestSellerItems : items.filter(i => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            const catColor = (dark && cat.color_dark) ? cat.color_dark : (cat.color || brandColor);
            const catCardColor = dark ? (cat.card_color_dark || null) : (cat.card_color || null);
            const catTextColor = getTextColor(catColor);
            return (
              <motion.section
                key={cat.id}
                ref={el => { sectionRefs.current[cat.id] = el; }}>

                <div className="flex items-center gap-4 mb-6 flex-row-reverse px-2">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white whitespace-nowrap tracking-tight">
                    {isBestSellers ? `🔥 ${cat.name}` : cat.name}
                  </h2>
                  <div className="flex-1 h-[2px] bg-gradient-to-l from-black/10 to-transparent dark:from-white/10"/>
                </div>

                {/* ── Items Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-7 md:gap-10 px-1 sm:px-2">
                  {catItems.map((item) => {
                    const count  = qty(item.id);
                    const status = getStatus(item);
                    const isAvailable = !is_closed && status === 'available';
                    return (
                      <motion.div
                        key={item.id}
                        whileHover={is_closed ? {} : { y: -8 }}
                        onClick={() => {
                          if (is_closed) setShowClosedToast(true);
                          else setSelectedItem(item);
                        }}
                        className={`relative group rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden border border-gray-100/80 dark:border-slate-800/80 shadow-[0_8px_35px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col cursor-pointer ${!catCardColor ? 'bg-white dark:bg-slate-900' : ''} ${!isAvailable && !is_closed ? 'opacity-60' : ''}`}
                        style={catCardColor ? { backgroundColor: catCardColor } : undefined}>

                        {/* Image Wrapper */}
                        <div className="relative flex-shrink-0 overflow-hidden m-2 rounded-[1.4rem] sm:rounded-[2.2rem]">
                          <motion.div
                            animate={{ scale: 1 + Math.min(count, 5) * 0.05 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                          >
                            <Image
                              src={item.image_url || 'https://placehold.co/400x300/f5f5f5/ccc?text='}
                              alt={item.name}
                              width={400} height={300}
                              className={`w-full h-32 sm:h-56 object-cover transition-transform duration-700 group-hover:scale-110 ${!isAvailable && !is_closed ? 'grayscale' : ''}`}
                              unoptimized
                            />
                          </motion.div>
                          <AnimatePresence>
                            {!is_closed && status !== 'available' && (
                              <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="bg-white px-5 py-2.5 rounded-2xl shadow-2xl transform -rotate-2">
                                  <p className="text-gray-900 text-sm font-black tracking-widest">
                                    {status === 'unavailable' ? 'غير متوفر' : 'انتهى'}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Details */}
                        <div className="p-3 sm:p-6 flex flex-col flex-1">
                          <p className="font-black text-sm sm:text-xl text-gray-900 dark:text-slate-100 text-right leading-tight mb-1 sm:mb-2">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-500 text-right mb-2 sm:mb-6 line-clamp-1 sm:line-clamp-2 leading-relaxed font-medium">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-auto flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-2 sm:gap-4">
                            <div className="text-right flex-shrink-0">
                              <p className="font-black text-base sm:text-2xl text-black dark:text-white">
                                {item.price.toLocaleString()}
                              </p>
                              <p className="text-[8px] sm:text-[10px] font-black opacity-30 -mt-1 uppercase tracking-tighter">د . ع</p>
                            </div>

                            {isAvailable ? (
                              <div className="relative h-8 sm:h-12 flex items-center justify-end sm:justify-start">
                                <AnimatePresence mode="wait">
                                  {count > 0 ? (
                                    <motion.div
                                      key="counter"
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      className="flex items-center gap-2 sm:gap-3 p-1 rounded-full shadow-xl"
                                      style={{ backgroundColor: catColor }}>
                                      <motion.button
                                        whileTap={{ scale: 0.8 }}
                                        onClick={(e) => { e.stopPropagation(); addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url }); }}
                                        className="w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: dark ? '#ffffff' : catTextColor, color: dark ? '#000000' : catColor }}>
                                        <Plus size={14} strokeWidth={3}/>
                                      </motion.button>
                                      <motion.span
                                        key={count}
                                        initial={{ scale: 1.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="font-black text-xs sm:text-base w-4 sm:w-5 text-center"
                                        style={{ color: catTextColor }}>
                                        {count}
                                      </motion.span>
                                      <motion.button
                                        whileTap={{ scale: 0.8 }}
                                        onClick={(e) => { e.stopPropagation(); decrementItem(item.id); }}
                                        className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center"
                                        style={{ color: catTextColor }}>
                                        <Minus size={14} strokeWidth={3}/>
                                      </motion.button>
                                    </motion.div>
                                  ) : (
                                    <motion.button
                                      key="add-btn"
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={(e) => { e.stopPropagation(); handleAdd(item); }}
                                      className="h-10 sm:h-12 px-5 sm:px-7 rounded-full font-black text-xs sm:text-sm shadow-lg shadow-black/10 uppercase tracking-wider whitespace-nowrap"
                                      style={{ backgroundColor: dark ? '#ffffff' : catColor, color: dark ? '#000000' : catTextColor }}>
                                      إضافة
                                    </motion.button>
                                  )}
                                </AnimatePresence>
                              </div>
                            ) : (
                              !is_closed && (
                                <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 dark:bg-slate-700 rounded-xl text-center">
                                  <span className="text-xs sm:text-sm font-black text-gray-500 dark:text-slate-300">
                                    {status === 'unavailable' ? 'غير متوفر' : 'انتهى'}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        {/* ── تضليل المطعم المغلق ── */}
                        <AnimatePresence>
                          {is_closed && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-10 flex items-center justify-center"
                              style={{ backgroundColor: 'rgba(30,30,30,0.52)' }}
                            >
                              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-2xl text-center mx-3">
                                <p className="text-gray-900 dark:text-white text-xs sm:text-sm font-black tracking-wide">🔒 مغلق</p>
                                {opens_at && (
                                  <p className="text-gray-500 dark:text-slate-400 text-[9px] sm:text-[11px] font-bold mt-1">
                                    سيفتح {opens_at}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>

      {/* ══ شريط السلة السفلي ══ */}
      <AnimatePresence>
        {showCartPanel && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-700/50 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] px-5 py-4 z-40">
            <div className="flex items-center justify-between flex-row-reverse">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">السلة</p>
                  <motion.p
                    className="font-black text-xl"
                    animate={priceFlash ? { color: ['#dc2626', '#dc2626', dark ? '#ffffff' : '#000000'], scale: [1, 1.15, 1, 1.1, 1] } : {}}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >{total.toLocaleString()} د.ع</motion.p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => { if (confirm('هل تريد حذف كل شيء؟')) clearCart(); }}
                  className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center"
                >
                  <Trash2 size={17} className="text-red-500" />
                </motion.button>
              </div>

              {/* أيقونة السلة / إغلاق */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowCartDrawer(v => !v)}
                className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm"
              >
                {showCartDrawer
                  ? <X size={22} className="text-gray-600 dark:text-slate-300" />
                  : <>
                      <ShoppingCart size={22} className="text-gray-600 dark:text-slate-300" />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white shadow bg-red-500">
                        {cartItems.reduce((s, i) => s + i.quantity, 0)}
                      </span>
                    </>
                }
              </motion.button>

              <Link href="/cart" className="px-8 py-4 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-transform bg-red-600 text-white">
                التالي
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ درج تفاصيل السلة ══ */}
      <AnimatePresence>
        {showCartDrawer && (
          <div className="fixed inset-0 z-[55] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartDrawer(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative bg-white dark:bg-slate-900 rounded-t-[2.5rem] max-h-[78vh] flex flex-col shadow-2xl"
            >
              {/* المقبض */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700" />
              </div>

              {/* الرأس */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-slate-800 flex-row-reverse flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black">سلة التسوق</h3>
                  <span className="text-xs text-gray-400 font-bold">
                    ({cartItems.reduce((s, i) => s + i.quantity, 0)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCartDrawer(false)}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center"
                  >
                    <X size={18} className="text-gray-500" />
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { if(confirm('هل تريد إفراغ السلة بالكامل؟')) { clearCart(); setShowCartDrawer(false); } }}
                    className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center active:scale-90"
                    title="إفراغ السلة"
                  >
                    <Trash2 size={17} />
                  </motion.button>
                </div>
              </div>

              {/* قائمة العناصر */}
              <div className="flex-1 overflow-y-auto px-5 py-1">
                <AnimatePresence initial={false}>
                  {cartItems.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 py-3.5 border-b border-gray-50 dark:border-slate-800 flex-row-reverse overflow-hidden"
                    >
                      {/* صورة */}
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={52} height={52}
                          className="w-13 h-13 rounded-2xl object-cover flex-shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center">
                          <ShoppingBag size={18} className="opacity-30" />
                        </div>
                      )}

                      {/* الاسم والسعر والإضافات */}
                      <div className="flex-1 text-right min-w-0">
                        <p className="font-black text-sm truncate text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 font-bold mt-0.5">
                          {(item.price * item.quantity).toLocaleString()} د.ع
                        </p>
                        {item.selected_extras_names && item.selected_extras_names.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                            {item.selected_extras_names.map((name, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                                + {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* أزرار التحكم */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, extras_json: item.extras_json, selected_extras_names: item.selected_extras_names })}
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm active:scale-90"
                          style={{ backgroundColor: brandColor, color: getTextColor(brandColor) }}
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                        <span className="font-black text-sm w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => decrementItem(item.id)}
                          className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center active:scale-90"
                        >
                          <Minus size={14} strokeWidth={3} className="text-gray-600 dark:text-slate-300" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mr-1 active:scale-90"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* الذيل: المجموع + زر المتابعة */}
              <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
                <div className="flex justify-between items-center flex-row-reverse mb-4">
                  <span className="text-sm font-black text-gray-400">المجموع الكلي</span>
                  <motion.span
                    className="font-black text-xl"
                    animate={priceFlash ? { color: ['#dc2626', '#dc2626', dark ? '#ffffff' : '#111827'], scale: [1, 1.18, 1, 1.08, 1] } : {}}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  >{total.toLocaleString()} د.ع</motion.span>
                </div>
                <Link
                  href="/cart"
                  onClick={() => setShowCartDrawer(false)}
                  className="block w-full py-4 rounded-2xl font-black text-sm text-center shadow-xl bg-red-600 text-white active:scale-95 transition-transform"
                >
                  متابعة الطلب
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl"
            >
              {(() => {
                const modalCat = categories.find(c => c.id === selectedItem.category_id);
                const modalColor = (dark && modalCat?.color_dark) ? modalCat.color_dark : (modalCat?.color || brandColor);
                const modalTextColor = getTextColor(modalColor);
                return (
                <div className="flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden">
                   <div className="relative h-64 sm:h-72 w-full overflow-hidden">
                      <motion.div
                        animate={{ scale: 1 + Math.min(qty(selectedItem.id), 5) * 0.05 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="absolute inset-0"
                      >
                        <Image
                          src={selectedItem.image_url || 'https://placehold.co/600x400/f5f5f5/ccc?text='}
                          alt={selectedItem.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </motion.div>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center text-white">
                        <ChevronDown size={22} strokeWidth={2.5} />
                      </button>
                   </div>
                   <div className="p-6 sm:p-10 relative pb-24 sm:pb-28">
                      {(() => {
                        const modalExtras = getExtras(selectedItem);
                        const extrasSum = modalExtras.filter(e => selectedModalExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
                        const displayPrice = selectedItem.price + extrasSum;
                        return (
                          <>
                            <div className="flex justify-between items-center flex-row-reverse mb-4 sm:mb-6">
                              <h3 className="text-xl sm:text-3xl font-black text-right">{selectedItem.name}</h3>
                              <div className="text-left">
                                <p className="text-xl sm:text-2xl font-black dark:text-white">{displayPrice.toLocaleString()} <span className="text-[10px] opacity-40">د.ع</span></p>
                              </div>
                            </div>
                            <p className="text-gray-500 dark:text-slate-400 text-right leading-relaxed text-sm sm:text-lg">
                              {selectedItem.description || 'لا يوجد وصف متاح لهذا الطلب حالياً.'}
                            </p>

                            {modalExtras.length > 0 && (
                              <div className="mt-4 sm:mt-6" dir="rtl">
                                <p className="text-xs font-black text-gray-400 dark:text-slate-500 mb-2 uppercase tracking-wider">الإضافات</p>
                                <div className="flex flex-wrap gap-2">
                                  {modalExtras.map(e => {
                                    const on = selectedModalExtras.has(e.id);
                                    return (
                                      <motion.button
                                        key={e.id}
                                        whileTap={{ scale: 0.93 }}
                                        onClick={() => setSelectedModalExtras(prev => {
                                          const next = new Set(prev);
                                          on ? next.delete(e.id) : next.add(e.id);
                                          return next;
                                        })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                                        style={on
                                          ? { backgroundColor: modalColor, borderColor: modalColor, color: modalTextColor }
                                          : { backgroundColor: 'transparent', borderColor: '#d1d5db', color: '#9ca3af' }
                                        }
                                      >
                                        {on ? <Check size={11} strokeWidth={3}/> : <Plus size={11} strokeWidth={2.5}/>}
                                        {e.name}
                                        {e.price > 0 && <span className="opacity-75">+{e.price.toLocaleString()}</span>}
                                      </motion.button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {qty(selectedItem.id) > 0 && (
                      <div className="absolute bottom-5 left-5 flex flex-col items-start">
                        <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-0.5">المجموع</p>
                        <motion.p
                          className="font-black text-2xl dark:text-white"
                          animate={modalPriceFlash ? { color: ['#dc2626', '#dc2626', dark ? '#ffffff' : '#000000'], scale: [1, 1.15, 1, 1.1, 1] } : {}}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        >
                          {(() => {
                            const extras = getExtras(selectedItem);
                            const extrasSum = extras.filter(e => selectedModalExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
                            return (qty(selectedItem.id) * (selectedItem.price + extrasSum)).toLocaleString();
                          })()} <span className="text-[10px] opacity-40">د.ع</span>
                        </motion.p>
                      </div>
                      )}

                      {!is_closed && getStatus(selectedItem) === 'available' && (
                        <div className="absolute bottom-5 right-5">
                          <AnimatePresence mode="wait">
                            {qty(selectedItem.id) > 0 ? (
                              <motion.div
                                key="modal-counter"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-2 p-1 rounded-full shadow-xl"
                                style={{ backgroundColor: modalColor }}
                              >
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={(e) => { e.stopPropagation(); const extras = getExtras(selectedItem); const sel = extras.filter(ex => selectedModalExtras.has(ex.id)); const selectedNames = sel.map(ex => ex.name); const extrasPrice = sel.reduce((s, ex) => s + ex.price, 0); addItem({ id: selectedItem.id, name: selectedItem.name, price: selectedItem.price + extrasPrice, image_url: selectedItem.image_url, extras_json: selectedItem.extras_json, selected_extras_names: selectedNames.length > 0 ? selectedNames : undefined }); }}
                                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center"
                                >
                                  <Plus size={16} strokeWidth={3}/>
                                </motion.button>
                                <motion.span
                                  key={qty(selectedItem.id)}
                                  initial={{ scale: 1.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="font-black text-sm w-6 text-center"
                                  style={{ color: modalTextColor }}
                                >
                                  {qty(selectedItem.id)}
                                </motion.span>
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={(e) => { e.stopPropagation(); decrementItem(selectedItem.id); }}
                                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                                  style={{ color: modalTextColor }}
                                >
                                  <Minus size={16} strokeWidth={3}/>
                                </motion.button>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="modal-add-btn"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => { e.stopPropagation(); const extras = getExtras(selectedItem); const sel = extras.filter(ex => selectedModalExtras.has(ex.id)); const selectedNames = sel.map(ex => ex.name); const extrasPrice = sel.reduce((s, ex) => s + ex.price, 0); handleAdd(selectedItem, selectedNames.length > 0 ? selectedNames : undefined, extrasPrice); }}
                                className="flex items-center gap-2 px-6 py-3 rounded-full font-black text-sm shadow-2xl"
                                style={{ backgroundColor: modalColor, color: modalTextColor }}
                              >
                                <Plus size={18} strokeWidth={3}/>
                                إضافة للسلة
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                   </div>
                </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderTypeModal && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOrderTypeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="font-black text-base text-gray-900 dark:text-white">نوع الطلب</h3>
                <button onClick={() => setShowOrderTypeModal(false)} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <div className="px-3 pb-4 flex flex-col gap-1.5">
                {([
                  { key: 'delivery' as const, label: 'توصيل الطلب', hint: '(يوصلك الطلب لباب البيت)' },
                  { key: 'pickup'   as const, label: 'استلام الطلب', hint: '(تستلم طلبك من المطعم)' },
                ]).map(o => (
                  <button
                    key={o.key}
                    onClick={() => { setOrderType(o.key); setShowOrderTypeModal(false); }}
                    className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors"
                    style={orderType === o.key ? { backgroundColor: `${brandColor}1a` } : {}}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-sm" style={{ color: orderType === o.key ? brandColor : undefined }}>{o.label}</span>
                      <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{o.hint}</span>
                    </span>
                    {orderType === o.key && (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                        <Check size={14} style={{ color: textOnBrand }} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClosedToast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-slate-700 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-black whitespace-nowrap"
          >
            🔒 المطعم مغلق حالياً
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCartResetToast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-slate-700 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-black whitespace-nowrap"
          >
            🛒 تم تفريغ سلتك لأنك انتقلت لمطعم آخر
          </motion.div>
        )}
      </AnimatePresence>
      <ClientBottomNav />
    </div>
    </CustomerGuard>
  );
}
