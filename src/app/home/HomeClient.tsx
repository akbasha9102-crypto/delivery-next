'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ClientBottomNav } from '@/components/BottomNav';
import { Moon, Sun, Plus, Minus, X, ShoppingBag, Trash2, MapPin, MessageCircle } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
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

function getStatus(item: Item): 'available' | 'unavailable' | 'hidden' {
  if (item.item_status === 'unavailable') return 'unavailable';
  if (item.item_status === 'hidden')      return 'hidden';
  if (item.item_status === 'available')   return 'available';
  return item.is_available ? 'available' : 'unavailable';
}

type Props = {
  initialCategories: Category[];
  initialItems: Item[];
};

export default function HomeClient({ initialCategories, initialItems }: Props) {
  const { dark, toggleDark } = useDarkMode();
  const { items: cartItems, addItem, decrementItem, removeItem, clearCart, total } = useCart();
  const { restaurant_name, primary_color, logo_url, loaded: settingsLoaded, is_closed, opens_at, whatsapp_number, location_url, schedule } = useSettings();

  const brandName  = restaurant_name || "المطعم";
  const rawColor   = primary_color || "#000000";

  const isTooDark = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = (dark && isTooDark) ? '#ffffff' : rawColor;

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

  const [categories,   setCategories]   = useState<Category[]>(initialCategories);
  const [items,        setItems]        = useState<Item[]>(initialItems);
  const [dataLoading,  setDataLoading]  = useState(initialItems.length === 0);
  const [activeCategory,   setActiveCategory]   = useState('all');
  const [showClosedToast,  setShowClosedToast]  = useState(false);
  const [showCartPanel,  setShowCartPanel]  = useState(false);

  const [selectedItem,   setSelectedItem]   = useState<Item | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef    = useRef<HTMLDivElement>(null);
  const scrolling   = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pairs: [string, string][] = [
      ['_name',  'deliveryName'],
      ['_nick',  'deliveryNickname'],
      ['_phone', 'deliveryPhone'],
      ['_loc',   'deliveryLocationDesc'],
      ['_addr',  'deliveryAddressDetails'],
    ];
    let found = false;
    pairs.forEach(([param, key]) => {
      const val = params.get(param);
      if (val) { localStorage.setItem(key, val); found = true; }
    });
    if (found) {
      const clean = new URL(window.location.href);
      pairs.forEach(([param]) => clean.searchParams.delete(param));
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('sort_order', { ascending: true, nullsFirst: false });
      const { data: its }  = await supabase.from('items').select('*').order('name');
      setCategories(cats || []);
      setItems(its || []);
      setDataLoading(false);
    };
    fetchData();
    const ch = supabase.channel('menu-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' },      fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    const observers: IntersectionObserver[] = [];
    categories.forEach(cat => {
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
  }, [categories, items]);

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

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    scrolling.current = true;
    setTimeout(() => { scrolling.current = false; }, 800);
    if (catId === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = sectionRefs.current[catId];
    if (el) {
      const offset = el.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  const getExtras = (item: Item): Extra[] => {
    try { return JSON.parse(item.extras_json || '[]'); } catch { return []; }
  };

  const handleAdd = (item: Item) => {
    if (getStatus(item) !== 'available') return;
    addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, extras_json: item.extras_json });
  };

  const qty = (id: string) => cartItems.find(i => i.id === id)?.quantity || 0;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 pb-36">

      {/* ══ HEADER ══ */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-100/50 dark:border-slate-800/50 px-6 h-20 flex items-center justify-between shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleDark}
          className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center transition-all border border-gray-100 dark:border-slate-700 shadow-sm">
          {dark ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-gray-400"/>}
        </motion.button>

        <div className="flex flex-col items-center flex-1 mx-4">
          <h1 className="text-lg font-black tracking-tight text-center leading-tight text-black dark:text-white">{brandName}</h1>
          <div className="w-8 h-1 rounded-full mt-1 opacity-20" style={{ backgroundColor: brandColor }}/>
        </div>

        <div className="flex items-center gap-2">
          {location_url && (
            <motion.a
              href={location_url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center border border-gray-100 dark:border-slate-700 shadow-sm">
              <MapPin size={18} className="text-red-500"/>
            </motion.a>
          )}
          {whatsapp_number && (
            <motion.a
              href={`https://wa.me/${whatsapp_number.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center border border-gray-100 dark:border-slate-700 shadow-sm">
              <MessageCircle size={18} className="text-green-500"/>
            </motion.a>
          )}
          {brandLogo ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative">
              <Image src={brandLogo} alt={brandName} width={60} height={60} className="h-14 w-14 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md" unoptimized/>
            </motion.div>
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-black/10" style={{ backgroundColor: brandColor, color: textOnBrand }}>
               <ShoppingBag size={20} />
            </div>
          )}
        </div>
      </motion.header>

      {/* ══ شريط الحالة والوقت ══ */}
      {settingsLoaded && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-bold ${is_closed ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${is_closed ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
          {is_closed ? (
            <span>مغلق{opens_at ? ` • يفتح ${opens_at}` : ''}</span>
          ) : (
            <span>مفتوح{todayHours ? ` • يغلق ${todayHours.close}` : ''}</span>
          )}
        </div>
      )}

      {/* ══ CATEGORY PILLS (Sticky at top-0) ══ */}
      <div className="sticky top-0 z-40 px-0 sm:px-4 py-4 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-slate-800">
        <div ref={pillsRef} className={`flex gap-3 overflow-x-auto scrollbar-hide flex-row-reverse pb-2 px-4 ${is_closed ? 'pointer-events-none opacity-50' : ''}`}>
          {dataLoading && categories.length === 0 && (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-20 bg-gray-200 dark:bg-slate-700 rounded-[1.2rem] animate-pulse flex-shrink-0"/>
            ))
          )}
          {[{ id: 'all', name: 'الكل' } as Category, ...categories].map((cat, idx) => {
            const isActive = activeCategory === cat.id;
            const catColor = (dark && cat.color_dark) ? cat.color_dark : (cat.color || brandColor);
            const catTextColor = getTextColor(catColor);
            return (
              <motion.button
                key={cat.id}
                data-cat={cat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-6 py-2.5 rounded-[1.2rem] text-sm font-black whitespace-nowrap transition-all duration-300 flex-shrink-0 border ${
                  isActive
                  ? 'shadow-[0_10px_20px_rgba(0,0,0,0.15)] scale-105'
                  : 'bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-gray-500 dark:text-white border-gray-100 dark:border-slate-700 hover:bg-gray-50 shadow-sm'
                }`}
                style={isActive ? { backgroundColor: catColor, borderColor: catColor, color: catTextColor } : {}}
              >
                {cat.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="px-4 pt-2">
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
          {categories.map((cat) => {
            const catItems = items.filter(i => i.category_id === cat.id);
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
                    {cat.name}
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
                        whileHover={{ y: -8 }}
                        onClick={() => {
                          if (is_closed) setShowClosedToast(true);
                          else setSelectedItem(item);
                        }}
                        className={`group rounded-[1.8rem] sm:rounded-[2.5rem] overflow-hidden border border-gray-100/80 dark:border-slate-800/80 shadow-[0_8px_35px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col cursor-pointer ${!catCardColor ? 'bg-white dark:bg-slate-900' : ''} ${!isAvailable && !is_closed ? 'opacity-60' : ''}`}
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
                            {(is_closed || status !== 'available') && (
                              <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="bg-white px-5 py-2.5 rounded-2xl shadow-2xl transform -rotate-2">
                                  <p className="text-gray-900 text-sm font-black tracking-widest">
                                    {is_closed ? 'مغلق' : status === 'unavailable' ? 'غير متوفر' : 'انتهى'}
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
                                        className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-black text-black dark:text-white flex items-center justify-center">
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
                                      style={{ backgroundColor: catColor, color: catTextColor }}>
                                      إضافة
                                    </motion.button>
                                  )}
                                </AnimatePresence>
                              </div>
                            ) : (
                              <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-100 dark:bg-slate-700 rounded-xl text-center">
                                <span className="text-xs sm:text-sm font-black text-gray-500 dark:text-slate-300">
                                  {is_closed ? 'مغلق' : status === 'unavailable' ? 'غير متوفر' : 'انتهى'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showCartPanel && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-700/50 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] p-6 z-40">
            <div className="flex items-center justify-between mb-6 flex-row-reverse">
               <div className="flex items-center gap-3">
                 <button
                   onClick={() => { if(confirm('هل تريد إفراغ السلة بالكامل؟')) clearCart(); }}
                   className="w-10 h-10 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                   title="إفراغ السلة"
                 >
                   <Trash2 size={20} />
                 </button>
                 <div className="text-right">
                   <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">السلة</p>
                   <p className="font-black text-xl">{total.toLocaleString()} د.ع</p>
                 </div>
                 <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl" style={{ backgroundColor: brandColor, color: textOnBrand }}>
                    <ShoppingBag size={22} />
                 </div>
               </div>
               <Link href="/cart" className="px-8 py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform bg-red-600 text-white">
                 إتمام الطلب
               </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 flex-row-reverse scrollbar-hide">
              {cartItems.map(item => (
                <motion.div layout initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={item.id} className="bg-gray-50 dark:bg-slate-800 px-4 py-2 rounded-xl flex items-center gap-2 border border-gray-100 dark:border-slate-700 whitespace-nowrap">
                   <span className="font-black text-xs">{item.quantity}×</span>
                   <span className="text-xs font-bold opacity-70">{item.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden"
            >
              {(() => {
                const modalCat = categories.find(c => c.id === selectedItem.category_id);
                const modalColor = (dark && modalCat?.color_dark) ? modalCat.color_dark : (modalCat?.color || brandColor);
                const modalTextColor = getTextColor(modalColor);
                return (
                <div className="flex flex-col">
                   <div className="relative h-64 sm:h-72 w-full">
                      <Image
                        src={selectedItem.image_url || 'https://placehold.co/600x400/f5f5f5/ccc?text='}
                        alt={selectedItem.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center text-white">
                        <X size={20} />
                      </button>
                   </div>
                   <div className="p-6 sm:p-10">
                      <div className="flex justify-between items-center flex-row-reverse mb-4 sm:mb-6">
                        <h3 className="text-xl sm:text-3xl font-black text-right">{selectedItem.name}</h3>
                        <div className="text-left">
                          <p className="text-xl sm:text-2xl font-black">{selectedItem.price.toLocaleString()} <span className="text-[10px] opacity-40">د.ع</span></p>
                        </div>
                      </div>
                      <p className="text-gray-500 dark:text-slate-400 text-right leading-relaxed mb-8 sm:mb-10 text-sm sm:text-lg">
                        {selectedItem.description || 'لا يوجد وصف متاح لهذا الطلب حالياً.'}
                      </p>

                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { handleAdd(selectedItem); setSelectedItem(null); }}
                        className="w-full py-4 sm:py-6 rounded-[1.5rem] sm:rounded-[2rem] font-black text-base sm:text-lg shadow-2xl flex items-center justify-center gap-3"
                        style={{ backgroundColor: modalColor, color: modalTextColor }}
                      >
                        <Plus size={20} />
                        إضافة إلى السلة
                      </motion.button>
                   </div>
                </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ClientBottomNav />
    </div>
  );
}
