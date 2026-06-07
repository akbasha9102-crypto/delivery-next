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
  
  // Force Dari Branding
  const brandName = "مطعم داري - Dari Restaurant";
  const brandColor = "#000000";
  const brandLogo = "https://i.imgur.com/Jh7bzNN.jpeg";
  const p = brandColor; 

  const [categories, setCategories] = useState<Category[]>([]);
  const [items,      setItems]      = useState<Item[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeCategory,   setActiveCategory]   = useState('all');
  const [showClosedToast,  setShowClosedToast]  = useState(false);
  const [showCartPanel,  setShowCartPanel]  = useState(false);

  const [extrasItem,     setExtrasItem]     = useState<Item | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef    = useRef<HTMLDivElement>(null);
  const scrolling   = useRef(false); // منع تعارض الـ observer مع الـ scroll المبرمج

  // ── Fetch + Realtime ──
  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('sort_order', { ascending: true, nullsFirst: false });
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
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-100/50 dark:border-slate-800/50 px-6 h-16 flex items-center justify-between shadow-[0_2px_20px_rgba(0,0,0,0.02)]">
        <button onClick={toggleDark} className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center transition-all active:scale-90 border border-gray-100 dark:border-slate-700 shadow-sm">
          {dark ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-gray-400"/>}
        </button>
        {brandLogo ? (
          <div className="relative group">
            <Image src={brandLogo} alt={brandName} width={120} height={40} className="h-10 w-auto object-contain transition-transform duration-500 group-hover:scale-105" unoptimized/>
          </div>
        ) : (
          <h1 className="text-xl font-black tracking-tight" style={{ color: p }}>{brandName}</h1>
        )}
        <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shadow-lg shadow-black/10">
           <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>
        </div>
      </header>

      {/* ══ CATEGORY PILLS (Floating Glassmorphism) ══ */}
      <div className="sticky top-16 z-30 px-4 py-4">
        <div ref={pillsRef} className={`flex gap-3 overflow-x-auto scrollbar-hide flex-row-reverse pb-2 ${is_closed ? 'pointer-events-none opacity-50' : ''}`}>
          {[{ id: 'all', name: 'الكل' } as Category, ...categories].map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                data-cat={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-6 py-2.5 rounded-[1.2rem] text-sm font-black whitespace-nowrap transition-all duration-300 flex-shrink-0 border ${
                  isActive 
                  ? 'bg-black text-white border-black shadow-[0_10px_20px_rgba(0,0,0,0.15)] scale-105' 
                  : 'bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-gray-500 border-gray-100 dark:border-slate-700 hover:bg-gray-50 shadow-sm'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
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
                      const isAvailable = !is_closed && status === 'available';
                      const statusLabel = status === 'unavailable' ? 'غير متوفر حاليا' : status === 'hidden' ? 'انتهى' : '';
                      return (
                        <div key={item.id}
                          onClick={() => { if (is_closed) setShowClosedToast(true); }}
                          className={`group bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden border border-gray-100/50 dark:border-slate-700/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col transform hover:-translate-y-2 ${!isAvailable && !is_closed ? 'opacity-60' : ''} ${is_closed ? 'cursor-pointer' : ''}`}>

                          {/* Image with 3D Zoom Effect */}
                          <div className="relative flex-shrink-0 overflow-hidden m-2 rounded-[1.5rem]">
                            <Image
                              src={item.image_url || 'https://placehold.co/300x200/f5f5f5/ccc?text='}
                              alt={item.name}
                              width={300} height={180}
                              className={`w-full h-40 object-cover transition-transform duration-700 group-hover:scale-110 ${!isAvailable && !is_closed ? 'grayscale' : ''}`}
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                            
                            {is_closed && (
                              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                                <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl transform -rotate-3">
                                  <p className="text-black text-xs font-black">مغلق حالياً</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Info Section with Premium Typography */}
                          <div className="p-4 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-2 flex-row-reverse">
                              <p className="font-black text-base text-gray-900 dark:text-slate-100 text-right leading-tight">
                                {item.name}
                              </p>
                            </div>
                            
                            {item.description && (
                              <p className="text-[11px] text-gray-500 dark:text-slate-400 text-right mb-4 line-clamp-2 leading-relaxed font-medium">
                                {item.description}
                              </p>
                            )}

                            <div className="mt-auto flex items-center justify-between flex-row-reverse">
                              <p className="font-black text-lg" style={{ color: isAvailable ? '#000' : '#9ca3af' }}>
                                {item.price.toLocaleString()} <span className="text-[10px] font-bold opacity-60">د.ع</span>
                              </p>
                              
                              {isAvailable ? (
                                count > 0 ? (
                                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 p-1 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-inner">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url }); }}
                                      className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-black/20">
                                      <Plus size={16}/>
                                    </button>
                                    <span className="font-black text-sm w-4 text-center">{count}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); decrementItem(item.id); }}
                                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 text-black flex items-center justify-center active:scale-90 transition-transform shadow-sm">
                                      <Minus size={16}/>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAdd(item); }}
                                    className="h-10 px-4 bg-black text-white rounded-2xl font-black text-sm shadow-[0_8px_20px_rgba(0,0,0,0.15)] active:scale-95 active:shadow-none transition-all duration-300">
                                    إضافة +
                                  </button>
                                )
                              ) : (
                                <div className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-xl">
                                  <span className="text-[10px] font-bold text-gray-400">{is_closed ? 'مغلق' : 'انتهى'}</span>
                                </div>
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

      {/* ══ CLOSED MODAL ══ */}
      {showClosedToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setShowClosedToast(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 text-center w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-5xl mb-3">🔒</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">المطعم مغلق حاليًا</h2>
            {opens_at && (
              <p className="text-gray-500 dark:text-slate-400 mt-1">
                سيفتح في <span className="font-bold text-gray-700 dark:text-slate-200">{formatOpenTime(opens_at)}</span>
              </p>
            )}
            <button onClick={() => setShowClosedToast(false)}
              className="mt-5 w-full py-3 rounded-2xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold active:scale-95 transition-all">
              حسناً
            </button>
          </div>
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}
