'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useDarkMode } from '@/context/ThemeContext';
import { ClientBottomNav } from '@/components/BottomNav';
import { Moon, Sun, Plus, Minus, X, ShoppingBag, Trash2 } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { items: cartItems, addItem, decrementItem, removeItem, clearCart, total } = useCart();
  const { restaurant_name, primary_color, logo_url, loaded: settingsLoaded, is_closed, opens_at } = useSettings();
  
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
  const [selectedItem,   setSelectedItem]   = useState<Item | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef    = useRef<HTMLDivElement>(null);
  const scrolling   = useRef(false);

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
    <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
        className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" 
      />
    </div>
  );

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
          <div className="w-8 h-1 bg-black dark:bg-white rounded-full mt-1 opacity-20"/>
        </div>

        {brandLogo ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative">
            <Image src={brandLogo} alt={brandName} width={60} height={60} className="h-14 w-14 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-md" unoptimized/>
          </motion.div>
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-lg shadow-black/10">
             <ShoppingBag size={20} className="text-white"/>
          </div>
        )}
      </motion.header>

      {/* ══ CATEGORY PILLS (Sticky at top-0) ══ */}
      <div className="sticky top-0 z-40 px-0 sm:px-4 py-4 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-slate-800">
        <div ref={pillsRef} className={`flex gap-3 overflow-x-auto scrollbar-hide flex-row-reverse pb-2 px-4 ${is_closed ? 'pointer-events-none opacity-50' : ''}`}>
          {[{ id: 'all', name: 'الكل' } as Category, ...categories].map((cat, idx) => {
            const isActive = activeCategory === cat.id;
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
                  ? 'bg-black text-white border-black shadow-[0_10px_20px_rgba(0,0,0,0.15)] scale-105' 
                  : 'bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-gray-500 border-gray-100 dark:border-slate-700 hover:bg-gray-50 shadow-sm'
                }`}
              >
                {cat.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="px-4 pt-2">
        {loading ? (
          <div className="flex justify-center mt-24">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map((cat, catIdx) => {
              const catItems = items.filter(i => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <motion.section 
                  key={cat.id} 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: catIdx * 0.1 }}
                  ref={el => { sectionRefs.current[cat.id] = el; }}>

                  <div className="flex items-center gap-4 mb-6 flex-row-reverse px-2">
                    <h2 className="text-xl font-black text-gray-900 dark:text-slate-100 whitespace-nowrap tracking-tight">
                      {cat.name}
                    </h2>
                    <div className="flex-1 h-[2px] bg-gradient-to-l from-black/10 to-transparent dark:from-white/10"/>
                  </div>

                  {/* ── Items Grid ── */}
                  <div className="grid grid-cols-2 gap-5 sm:gap-7 md:gap-10 px-1 sm:px-2">
                    {catItems.map((item, itemIdx) => {
                      const count  = qty(item.id);
                      const status = getStatus(item);
                      const isAvailable = !is_closed && status === 'available';
                      return (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: itemIdx * 0.05 }}
                          whileHover={{ y: -8 }}
                          onClick={() => { 
                            if (is_closed) setShowClosedToast(true);
                            else setSelectedItem(item);
                          }}
                          className={`group bg-white dark:bg-slate-900 rounded-[2.2rem] sm:rounded-[2.8rem] overflow-hidden border border-gray-100/80 dark:border-slate-800/80 shadow-[0_8px_35px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col cursor-pointer ${!isAvailable && !is_closed ? 'opacity-60' : ''}`}>

                          {/* Image Wrapper */}
                          <div className="relative flex-shrink-0 overflow-hidden m-2.5 sm:m-4 rounded-[1.8rem] sm:rounded-[2.2rem]">
                            <motion.div
                              animate={{ scale: 1 + Math.min(count, 5) * 0.05 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            >
                              <Image
                                src={item.image_url || 'https://placehold.co/400x300/f5f5f5/ccc?text='}
                                alt={item.name}
                                width={400} height={300}
                                className={`w-full h-40 sm:h-48 md:h-56 object-cover transition-transform duration-700 group-hover:scale-110 ${!isAvailable && !is_closed ? 'grayscale' : ''}`}
                                unoptimized
                              />
                            </motion.div>
                            <AnimatePresence>
                              {is_closed && (
                                <motion.div 
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/20">
                                  <div className="bg-white/90 px-4 py-2 rounded-xl shadow-2xl transform -rotate-2">
                                    <p className="text-black text-[10px] font-black tracking-widest">مغلق</p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Details */}
                          <div className="p-5 sm:p-6 flex flex-col flex-1">
                            <p className="font-black text-base sm:text-lg md:text-xl text-gray-900 dark:text-slate-100 text-right leading-tight mb-2">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-[10px] sm:text-[12px] text-gray-400 dark:text-slate-500 text-right mb-4 sm:mb-6 md:mb-8 line-clamp-2 leading-relaxed font-medium">
                                {item.description}
                              </p>
                            )}

                            <div className="mt-auto flex items-center justify-between flex-row-reverse">
                              <div className="text-right">
                                <p className="font-black text-lg sm:text-xl md:text-2xl text-black dark:text-white">
                                  {item.price.toLocaleString()}
                                </p>
                                <p className="text-[9px] sm:text-[10px] font-black opacity-30 -mt-1 uppercase tracking-tighter">د . ع</p>
                              </div>
                              
                              {isAvailable ? (
                                <div className="relative h-10 sm:h-12 flex items-center">
                                  <AnimatePresence mode="wait">
                                    {count > 0 ? (
                                      <motion.div 
                                        key="counter"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center gap-2 sm:gap-4 bg-black dark:bg-white p-1 rounded-xl sm:rounded-2xl shadow-xl">
                                        <motion.button
                                          whileTap={{ scale: 0.8 }}
                                          onClick={(e) => { e.stopPropagation(); addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url }); }}
                                          className="w-8 h-8 sm:w-10 h-10 rounded-lg sm:rounded-xl bg-white dark:bg-black text-black dark:text-white flex items-center justify-center">
                                          <Plus size={18} strokeWidth={3}/>
                                        </motion.button>
                                        <motion.span 
                                          key={count}
                                          initial={{ scale: 1.5, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          className="font-black text-sm sm:text-base w-4 sm:w-5 text-center text-white dark:text-black">
                                          {count}
                                        </motion.span>
                                        <motion.button
                                          whileTap={{ scale: 0.8 }}
                                          onClick={(e) => { e.stopPropagation(); decrementItem(item.id); }}
                                          className="w-8 h-8 sm:w-10 h-10 rounded-lg sm:rounded-xl bg-white/10 text-white dark:text-black flex items-center justify-center">
                                          <Minus size={18} strokeWidth={3}/>
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
                                        className="h-9 sm:h-12 px-4 sm:px-8 bg-black dark:bg-white text-white dark:text-black rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm shadow-lg shadow-black/10 uppercase tracking-wider">
                                        أضف للسلة
                                      </motion.button>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ) : (
                                <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{is_closed ? 'مغلق' : 'نفذ'}</span>
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
        )}
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
                 {/* زر مسح السلة المضاف */}
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
                 <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl">
                   <ShoppingBag size={24} />
                 </div>
               </div>
               <Link href="/cart" className="bg-black text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform">
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
        {(selectedItem || extrasItem) && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => { setSelectedItem(null); setExtrasItem(null); }} 
              className="absolute inset-0 bg-black/70 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ y: "100%", opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: "100%", opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden"
            >
              {/* Item Details Content */}
              {selectedItem && !extrasItem && (
                <div className="flex flex-col">
                   <div className="relative h-72 w-full">
                      <Image 
                        src={selectedItem.image_url || 'https://placehold.co/600x400/f5f5f5/ccc?text='} 
                        alt={selectedItem.name} 
                        fill 
                        className="object-cover"
                        unoptimized
                      />
                      <button 
                        onClick={() => setSelectedItem(null)}
                        className="absolute top-6 left-6 w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white">
                        <X size={24} />
                      </button>
                   </div>
                   <div className="p-8 sm:p-10">
                      <div className="flex justify-between items-center flex-row-reverse mb-6">
                        <h3 className="text-2xl sm:text-3xl font-black text-right">{selectedItem.name}</h3>
                        <div className="text-left">
                          <p className="text-2xl font-black">{selectedItem.price.toLocaleString()} <span className="text-xs opacity-40">د.ع</span></p>
                        </div>
                      </div>
                      <p className="text-gray-500 dark:text-slate-400 text-right leading-relaxed mb-10 text-base sm:text-lg">
                        {selectedItem.description || 'لا يوجد وصف متاح لهذا الطلب حالياً.'}
                      </p>
                      
                      <motion.button 
                        whileTap={{ scale: 0.95 }} 
                        onClick={() => { handleAdd(selectedItem); setSelectedItem(null); }} 
                        className="w-full py-6 bg-black text-white rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3"
                      >
                        <Plus size={24} />
                        إضافة إلى السلة
                      </motion.button>
                   </div>
                </div>
              )}

              {/* Extras Content */}
              {extrasItem && (
                <div className="p-8 sm:p-10">
                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-8"/>
                  <h3 className="text-2xl font-black text-right mb-2">{extrasItem.name}</h3>
                  <p className="text-gray-400 text-right text-sm mb-8">اختر الإضافات التي ترغب بها</p>
                  <div className="space-y-3 mb-10 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                    {getExtras(extrasItem).map(e => (
                      <motion.button whileTap={{ scale: 0.98 }} key={e.id} onClick={() => { const next = new Set(selectedExtras); next.has(e.id) ? next.delete(e.id) : next.add(e.id); setSelectedExtras(next); }} className={`w-full p-5 rounded-[1.5rem] flex items-center justify-between border-2 transition-all ${selectedExtras.has(e.id) ? 'border-black bg-black text-white shadow-xl' : 'border-gray-100 dark:border-slate-800 text-gray-500'}`}>
                        <span className="font-black">+{e.price.toLocaleString()} د.ع</span>
                        <span className="font-black text-lg">{e.name}</span>
                      </motion.button>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setExtrasItem(null)} className="flex-1 py-5 rounded-2xl font-black text-gray-400 bg-gray-50 dark:bg-slate-800">إلغاء</motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={confirmExtras} className="flex-[2] py-5 rounded-2xl font-black bg-black text-white shadow-2xl">تأكيد الإضافة</motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ClientBottomNav />
    </div>
  );
}
