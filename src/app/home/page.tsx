'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ClientBottomNav } from '@/components/BottomNav';
import { Moon, Sun, Plus, Minus, X } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

type Category = { id: string; name: string; color?: string };
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

export default function HomePage() {
  const { dark, toggleDark } = useDarkMode();
  const { items: cartItems, addItem, decrementItem, removeItem, total } = useCart();
  const { restaurant_name, primary_color, logo_url, loaded: settingsLoaded, is_closed, opens_at } = useSettings();
  const p = primary_color; // shorthand for inline styles

  const [categories, setCategories] = useState<Category[]>([]);
  const [items,      setItems]      = useState<Item[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCartPanel,  setShowCartPanel]  = useState(false);

  const [extrasItem,     setExtrasItem]     = useState<Item | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef    = useRef<HTMLDivElement>(null);
  const scrolling   = useRef(false); // منع تعارض الـ observer مع الـ scroll المبرمج

  // ── Fetch + Realtime ──
  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      const { data: its }  = await supabase.from('items').select('*').order('name');
      setCategories(cats || []);
      setItems(its || []);
      setLoading(false);
    };
    fetchData();

    const ch = supabase.channel('menu-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' },      fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── IntersectionObserver: يحدّث الـ pill النشط أثناء السكرول ──
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
        { rootMargin: '-15% 0px -75% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [categories, items]);

  // ── يمرر الـ pill النشط للمنتصف ──
  useEffect(() => {
    const pill = pillsRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCategory}"]`);
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategory]);

  useEffect(() => { setShowCartPanel(cartItems.length > 0); }, [cartItems.length]);

  // ── اضغط على الـ pill → انتقل للقسم ──
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
      const offset = el.getBoundingClientRect().top + window.scrollY - 112;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  const getExtras = (item: Item): Extra[] => {
    try { return JSON.parse(item.extras_json || '[]'); } catch { return []; }
  };

  const handleAdd = (item: Item) => {
    if (getStatus(item) !== 'available') return;
    const extras = getExtras(item);
    if (extras.length > 0) { setExtrasItem(item); setSelectedExtras(new Set()); }
    else addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url });
  };

  const confirmExtras = () => {
    if (!extrasItem) return;
    const extras    = getExtras(extrasItem);
    const extraCost = extras.filter(e => selectedExtras.has(e.id)).reduce((s, e) => s + e.price, 0);
    const extraNames = extras.filter(e => selectedExtras.has(e.id)).map(e => e.name).join('، ');
    addItem({
      id: extrasItem.id,
      name: extraNames ? `${extrasItem.name} (${extraNames})` : extrasItem.name,
      price: extrasItem.price + extraCost,
      image_url: extrasItem.image_url,
    });
    setExtrasItem(null);
  };

  const qty = (id: string) => cartItems.find(i => i.id === id)?.quantity || 0;

  if (!settingsLoaded) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-36">

      {/* ══ HEADER ══ */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 h-14 flex items-center justify-between">
        <button onClick={toggleDark} className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 transition-all active:scale-90">
          {dark ? <Sun size={18} className="text-yellow-400"/> : <Moon size={18} className="text-gray-500"/>}
        </button>
        {logo_url ? (
          <Image src={logo_url} alt={restaurant_name} width={120} height={36} className="h-9 w-auto object-contain" unoptimized/>
        ) : (
          <h1 className="text-xl font-bold" style={{ color: p }}>{restaurant_name}</h1>
        )}
        <div className="w-9"/>
      </header>

      {/* ══ CATEGORY PILLS (sticky) ══ */}
      <div className="sticky top-14 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-700 px-4 py-2.5">
        <div ref={pillsRef} className={`flex gap-2 overflow-x-auto scrollbar-hide flex-row-reverse ${is_closed ? 'pointer-events-none opacity-50' : ''}`}>
          {[{ id: 'all', name: 'الكل' } as Category, ...categories].map(cat => (
            <button
              key={cat.id}
              data-cat={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
              style={activeCategory === cat.id
                ? { backgroundColor: cat.color || p, color: '#fff' }
                : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center mt-24">
            <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${p} transparent transparent transparent` }}/>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              const c = cat.color || p;
              return (
                <section key={cat.id} ref={el => { sectionRefs.current[cat.id] = el; }}>

                  {/* ── Section Header ── */}
                  <div className="flex items-center gap-3 mb-4 flex-row-reverse">
                    <h2 className="text-base font-extrabold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                      {cat.name}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-l from-gray-200 to-transparent dark:from-slate-700"/>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c }}/>
                  </div>

                  {/* ── Items Grid ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {catItems.map(item => {
                      const count  = qty(item.id);
                      const status = getStatus(item);
                      const closedLabel = opens_at ? `سيفتح ${formatOpenTime(opens_at)}` : 'مغلق حاليًا';
                      const isAvailable = !is_closed && status === 'available';
                      const statusLabel = is_closed
                        ? closedLabel
                        : status === 'unavailable' ? 'غير متوفر حاليا' : status === 'hidden' ? 'انتهى' : '';
                      return (
                        <div key={item.id}
                          className={`bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col ${!isAvailable ? 'opacity-60' : ''}`}>

                          {/* Image */}
                          <div className="relative flex-shrink-0 overflow-hidden">
                            <Image
                              src={item.image_url || 'https://placehold.co/300x200/f5f5f5/ccc?text='}
                              alt={item.name}
                              width={300} height={180}
                              className={`w-full h-36 object-cover ${!isAvailable ? 'grayscale' : ''}`}
                              style={isAvailable ? {
                                transform: `scale(${1 + Math.min(count, 10) * 0.08})`,
                                transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                              } : {}}
                              unoptimized
                            />
                            {!isAvailable && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-2">
                                <span className="text-white text-xs font-bold bg-black/70 px-3 py-1.5 rounded-xl text-center leading-snug">{statusLabel}</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3 flex flex-col flex-1">
                            <p className="font-bold text-sm text-gray-900 dark:text-slate-100 text-right leading-snug mb-1">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-gray-400 dark:text-slate-500 text-right mb-2 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                            <div className="mt-auto pt-1">
                              <p className="font-extrabold text-sm text-right mb-2" style={{ color: isAvailable ? c : '#9ca3af' }}>
                                {item.price.toLocaleString()} د.ع
                              </p>
                              {isAvailable && count > 0 ? (
                                <div className="flex items-center justify-between rounded-xl px-2 py-1.5" style={{ backgroundColor: c + '18' }}>
                                  <button
                                    onClick={() => addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url })}
                                    className="w-7 h-7 rounded-full text-white flex items-center justify-center active:scale-90"
                                    style={{ backgroundColor: c }}>
                                    <Plus size={14}/>
                                  </button>
                                  <span className="font-bold text-sm" style={{ color: c }}>{count}</span>
                                  <button
                                    onClick={() => decrementItem(item.id)}
                                    className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 flex items-center justify-center active:scale-90">
                                    <Minus size={14}/>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAdd(item)}
                                  disabled={!isAvailable}
                                  className="w-full font-bold text-sm py-2 rounded-xl transition-all active:scale-95 disabled:cursor-not-allowed"
                                  style={isAvailable
                                    ? { backgroundColor: c, color: '#fff' }
                                    : { backgroundColor: '#e5e7eb', color: '#9ca3af' }}>
                                  {isAvailable ? '+ أضف' : statusLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ CART PANEL ══ */}
      {showCartPanel && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-2xl rounded-t-2xl px-4 pt-3 pb-4 z-40">
          <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-3"/>
          <div className="max-h-28 overflow-y-auto mb-3">
            {cartItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <button onClick={() => removeItem(item.id)} className="text-red-400 p-1">
                  <X size={14}/>
                </button>
                <span className="flex-1 text-right text-sm text-gray-700 dark:text-slate-300 mx-2">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-sm font-bold" style={{ color: p }}>
                  {(item.price * item.quantity).toLocaleString()} د.ع
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-700 pt-3">
            <Link href="/cart"
              className="text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
              style={{ backgroundColor: p }}>
              تأكيد الطلب
            </Link>
            <div className="text-right">
              <p className="text-xs text-gray-400 dark:text-slate-500">الإجمالي</p>
              <p className="font-bold text-lg" style={{ color: p }}>{total.toLocaleString()} د.ع</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXTRAS MODAL ══ */}
      {extrasItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setExtrasItem(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-600 rounded-full mx-auto mb-4"/>
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-sm">اختياري</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">أضف للطلب 🧂</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-right mb-4">اختر الإضافات التي تريدها</p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {getExtras(extrasItem).map(e => (
                <button key={e.id}
                  onClick={() => setSelectedExtras(prev => {
                    const n = new Set(prev);
                    n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                    return n;
                  })}
                  className="w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-all bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600"
                  style={selectedExtras.has(e.id) ? { borderColor: p, backgroundColor: p + '18' } : {}}>
                  <span className="font-bold text-sm" style={{ color: selectedExtras.has(e.id) ? p : '#9ca3af' }}>
                    {selectedExtras.has(e.id) ? '✓' : '○'}
                  </span>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{e.name}</p>
                    {e.price > 0 && <p className="text-xs" style={{ color: p }}>+{e.price.toLocaleString()} د.ع</p>}
                    {e.price === 0 && <p className="text-gray-400 text-xs">مجاني</p>}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={confirmExtras}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
              style={{ backgroundColor: p }}>
              إضافة للسلة
            </button>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
